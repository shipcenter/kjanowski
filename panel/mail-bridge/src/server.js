/* Serwer MCP „ShipCenter Poczta” – konektor dla panelu franczyzy w claude.ai
   Adres konektora: https://<twoja-domena>/mcp/<MCP_SECRET>  (Streamable HTTP, bez sesji) */
import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { cfg, assertConfig } from './config.js';
import { fetchInquiries, listMessages, getMessage, getAttachment, sendMail, status } from './mail.js';
import { smsSend, smsCancel, smsConfigured } from './sms.js';
import { addressSuggest, addressDetails } from './places.js';
import { ndaCreate, ndaStatus, ndaRoutes } from './nda.js';
import { publicPrices } from './prices.js';

const json = data => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
const fail = e => ({ isError: true, content: [{ type: 'text', text: String((e && e.message) || e) }] });
const wrap = fn => async args => { try { return json(await fn(args || {})); } catch (e) { console.error(new Date().toISOString(), 'tool error:', e.message); return fail(e); } };
const RO = { readOnlyHint: true, openWorldHint: false };

export function buildServer() {
  const s = new McpServer({ name: 'shipcenter-poczta', version: '1.0.0' });

  s.registerTool('mail_status', {
    title: 'Stan połączenia z pocztą',
    description: 'Sprawdza logowanie do IMAP i SMTP skrzynki franczyza@shipcenter.pl.',
    inputSchema: {},
    annotations: RO
  }, wrap(async () => ({ ...(await status()), sms: smsConfigured() })));

  s.registerTool('inquiries_fetch', {
    title: 'Nowe zgłoszenia z formularzy',
    description: 'Zwraca zgłoszenia „ZAPYTANIE FRANCZYZOWE” i „zapytanie ShipPoint” ze skrzynki odbiorczej, nowsze niż since_uid (imię, telefon, e-mail, model).',
    inputSchema: {
      since_uid: z.number().int().min(0).optional().describe('UID ostatniego przetworzonego zgłoszenia (0 = od początku okresu)'),
      days: z.number().int().min(1).max(365).optional().describe('Ile dni wstecz szukać (domyślnie 30)'),
      limit: z.number().int().min(1).max(200).optional()
    },
    annotations: RO
  }, wrap(a => fetchInquiries({ sinceUid: a.since_uid || 0, days: a.days || 30, limit: a.limit || 100 })));

  s.registerTool('mail_list', {
    title: 'Lista wiadomości',
    description: 'Lista wiadomości z Odebranych i/lub Wysłanych; z address – tylko korespondencja z tym adresem.',
    inputSchema: {
      address: z.string().max(200).optional().describe('Adres e-mail kandydata (opcjonalnie)'),
      folder: z.enum(['all', 'INBOX', 'Sent']).optional(),
      limit: z.number().int().min(1).max(100).optional()
    },
    annotations: RO
  }, wrap(a => listMessages({ address: a.address || '', folder: a.folder || 'all', limit: a.limit || 30 })));

  s.registerTool('mail_get', {
    title: 'Treść wiadomości',
    description: 'Pełna treść jednej wiadomości (tekst, HTML, lista załączników). Oznacza odebraną jako przeczytaną.',
    inputSchema: {
      folder: z.enum(['INBOX', 'Sent']),
      uid: z.number().int().min(1),
      mark_seen: z.boolean().optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, wrap(a => getMessage({ folder: a.folder, uid: a.uid, markSeen: a.mark_seen !== false })));

  s.registerTool('mail_attachment', {
    title: 'Pobierz załącznik',
    description: 'Zwraca załącznik wiadomości jako base64 (max 8 MB).',
    inputSchema: {
      folder: z.enum(['INBOX', 'Sent']),
      uid: z.number().int().min(1),
      index: z.number().int().min(0)
    },
    annotations: RO
  }, wrap(a => getAttachment(a)));

  s.registerTool('mail_send', {
    title: 'Wyślij e-mail',
    description: 'Wysyła e-mail z franczyza@shipcenter.pl (HTML z firmową stopką przygotowuje panel) i zapisuje kopię w folderze Wysłane.',
    inputSchema: {
      to: z.union([z.string(), z.array(z.string())]),
      cc: z.union([z.string(), z.array(z.string())]).optional(),
      bcc: z.union([z.string(), z.array(z.string())]).optional(),
      subject: z.string().min(1).max(300),
      html: z.string().max(2000000).optional(),
      text: z.string().max(500000).optional(),
      in_reply_to: z.string().max(500).optional(),
      references: z.array(z.string().max(500)).max(50).optional(),
      attachments: z.array(z.object({
        filename: z.string().max(200),
        content_base64: z.string(),
        content_type: z.string().max(100).optional()
      })).max(10).optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, wrap(a => sendMail(a)));

  s.registerTool('address_suggest', {
    title: 'Podpowiedzi adresu',
    description: 'Podpowiedzi adresów w Polsce (Google Places) dla wpisywanego tekstu, np. „Główna 22 Świerkl”.',
    inputSchema: { input: z.string().min(1).max(200), session: z.string().max(100).optional() },
    annotations: RO
  }, wrap(a => addressSuggest(a)));

  s.registerTool('address_details', {
    title: 'Szczegóły adresu',
    description: 'Ulica, numer, miejscowość, kod pocztowy, powiat i województwo dla wybranej podpowiedzi (placeId).',
    inputSchema: { placeId: z.string().min(1).max(300), session: z.string().max(100).optional() },
    annotations: RO
  }, wrap(a => addressDetails(a)));

  s.registerTool('nda_create', {
    title: 'Utwórz NDA do akceptacji SMS',
    description: 'Tworzy umowę o zachowaniu poufności do akceptacji przez kandydata kodem SMS i zwraca link.',
    inputSchema: {
      lead_id: z.string().max(100).optional(),
      title: z.string().max(200).optional(),
      text: z.string().min(200).max(60000),
      signer: z.object({ name: z.string().min(1).max(200), company: z.string().max(300).optional(), nip: z.string().max(20).optional(), phone: z.string().min(9).max(20), email: z.string().max(200).optional() }),
      expires_days: z.number().int().min(1).max(60).optional()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, wrap(a => ndaCreate(a)));

  s.registerTool('nda_status', {
    title: 'Status NDA',
    description: 'Czy kandydat zaakceptował umowę o zachowaniu poufności (data, IP, skrót treści).',
    inputSchema: { token: z.string().min(10).max(100) },
    annotations: RO
  }, wrap(a => ndaStatus(a)));

  s.registerTool('sms_send', {
    title: 'Wyślij SMS',
    description: 'Wysyła SMS przez SMSAPI (od razu albo o podanej godzinie – parametr date w ISO 8601). Zwraca id SMS-a (do anulowania planowanego).',
    inputSchema: {
      to: z.string().min(9).max(20),
      message: z.string().min(1).max(918),
      date: z.string().max(40).optional().describe('Planowana wysyłka, np. 2026-11-20T17:00:00.000Z')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, wrap(a => smsSend(a)));

  s.registerTool('sms_cancel', {
    title: 'Anuluj zaplanowany SMS',
    description: 'Anuluje SMS zaplanowany w SMSAPI (po id zwróconym przez sms_send).',
    inputSchema: { id: z.string().min(1).max(64) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true }
  }, wrap(a => smsCancel(a)));

  s.registerTool('public_prices', {
    title: 'Publiczny cennik shipcenter.pl',
    description: 'Ceny dla klienta (netto i brutto) z publicznego cennika shipcenter.pl – bez logowania. Panel porównuje je z cennikiem franczyzowym i liczy zysk punktu.',
    inputSchema: { couriers: z.array(z.string().max(40)).max(30).optional().describe('np. ["inpost","dpd"]; puste = wszyscy przewoźnicy krajowi') },
    annotations: { readOnlyHint: true, openWorldHint: true }
  }, wrap(a => publicPrices(a)));

  return s;
}

function secretOk(given) {
  const a = Buffer.from(String(given || '')), b = Buffer.from(cfg.secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function buildApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use(express.json({ limit: '16mb' }));

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.post('/mcp/:secret', async (req, res) => {
    if (!secretOk(req.params.secret)) return res.status(404).end();
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      console.error(new Date().toISOString(), 'mcp error:', e.message);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Błąd serwera' }, id: null });
    }
  });
  const notAllowed = (req, res) => {
    if (!secretOk(req.params.secret)) return res.status(404).end();
    res.status(405).set('Allow', 'POST').json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed' }, id: null });
  };
  app.get('/mcp/:secret', notAllowed);
  app.delete('/mcp/:secret', notAllowed);
  ndaRoutes(app, express);
  app.use((req, res) => res.status(404).end());
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertConfig();
  buildApp().listen(cfg.port, cfg.host, () => console.log(`ShipCenter Poczta MCP: http://${cfg.host}:${cfg.port}/mcp/<MCP_SECRET> (skrzynka ${cfg.from})`));
}
