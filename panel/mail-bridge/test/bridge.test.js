/* Testy mostka: parser zgłoszeń (dane fikcyjne) + wysyłka przez lokalny serwer SMTP i protokół MCP */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { parseInquiry, inquiryKind } from '../src/inquiry.js';

test('rozpoznaje zgłoszenie franczyzowe (tekst)', () => {
  const r = parseInquiry({ subject: '[shipcenter.pl] - ZAPYTANIE FRANCZYZOWE', replyTo: 'Anna <anna.test@example.com>',
    text: 'Nowe zgłoszenie z formularza franczyzy · 01.01.2026, 10:00\n\nImię: Anna\nTelefon: 600 100 200\nE-mail: anna.test@example.com\n\nKandydat otrzymuje mail z prezentacją franczyzy i dwoma pytaniami.' });
  assert.equal(r.kind, 'franczyza'); assert.equal(r.name, 'Anna'); assert.equal(r.phone, '600100200'); assert.equal(r.email, 'anna.test@example.com'); assert.equal(r.autoPresentation, true);
});

test('rozpoznaje zapytanie ShipPoint (sam HTML) i bierze e-mail z Reply-To', () => {
  const r = parseInquiry({ subject: '[shipcenter.pl] - zapytanie ShipPoint', replyTo: 'jan.test@example.com',
    html: '<html><head><style>p{}</style></head><body><div id="content"><p>Imi=C4=99 x</p><p>Imię: Jan<br>Telefon: 501-202-303</p></div></body></html>' });
  assert.equal(r.kind, 'shippoint'); assert.equal(r.name, 'Jan'); assert.equal(r.phone, '501202303'); assert.equal(r.email, 'jan.test@example.com');
  assert.equal(inquiryKind('Re: coś innego'), null);
});

test('mail_send przez MCP: HTML ze stopką, załącznik, nadawca franczyza@', async () => {
  const received = [];
  const smtp = new SMTPServer({ authOptional: true, secure: false, disabledCommands: ['STARTTLS'], logger: false,
    onAuth(auth, s, cb) { cb(null, { user: auth.username }); },
    onData(stream, s, cb) { const chunks = []; stream.on('data', c => chunks.push(c)); stream.on('end', () => { received.push({ env: s.envelope, raw: Buffer.concat(chunks) }); cb(); }); } });
  smtp.listen(0, '127.0.0.1'); await once(smtp.server, 'listening');
  Object.assign(process.env, { MCP_SECRET: 'x'.repeat(40), SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.server.address().port), SMTP_SECURE: 'false', SMTP_PASS: 'test', IMAP_HOST: '127.0.0.1', IMAP_PORT: '1', IMAP_PASS: 'test', MAIL_FROM: 'franczyza@shipcenter.pl' });
  const { buildApp } = await import('../src/server.js?' + Date.now());
  const http = buildApp().listen(0, '127.0.0.1'); await once(http, 'listening');
  const url = `http://127.0.0.1:${http.address().port}/mcp/${'x'.repeat(40)}`;
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
  const client = new Client({ name: 'test', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));
  const tools = (await client.listTools()).tools.map(t => t.name).sort();
  assert.deepEqual(tools, ['inquiries_fetch', 'mail_attachment', 'mail_get', 'mail_list', 'mail_send', 'mail_status']);
  const res = await client.callTool({ name: 'mail_send', arguments: { to: 'kandydat@example.com', subject: 'Test – prezentacja', html: '<p>Dzień dobry</p><table><tr><td>Stopka ShipCenter</td></tr></table>', text: 'Dzień dobry', attachments: [{ filename: 'Umowa.pdf', content_base64: Buffer.from('%PDF-1.4 test').toString('base64'), content_type: 'application/pdf' }] } });
  assert.ok(!res.isError, JSON.stringify(res.content));
  const out = JSON.parse(res.content[0].text);
  assert.deepEqual(out.accepted, ['kandydat@example.com']);
  assert.equal(out.appended, false); // brak IMAP w teście – wysyłka i tak się udaje
  const bad = await client.callTool({ name: 'mail_send', arguments: { to: 'zly-adres', subject: 'x', text: 'y' } });
  assert.ok(bad.isError);
  const wrong = await fetch(url.replace(/x+$/, 'zly'), { method: 'POST' });
  assert.equal(wrong.status, 404);
  await client.close(); http.close(); smtp.close();
  assert.equal(received.length, 1);
  const p = await simpleParser(received[0].raw);
  assert.equal(p.from.value[0].address, 'franczyza@shipcenter.pl');
  assert.match(p.html, /Stopka ShipCenter/);
  assert.equal(p.attachments[0].filename, 'Umowa.pdf');
  assert.equal(p.subject, 'Test – prezentacja');
});
