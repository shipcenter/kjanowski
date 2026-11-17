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
  assert.deepEqual(tools, ['address_details', 'address_suggest', 'inquiries_fetch', 'mail_attachment', 'mail_get', 'mail_list', 'mail_send', 'mail_status', 'nda_create', 'nda_status', 'public_prices', 'sms_cancel', 'sms_send']);
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

test('sms_send i sms_cancel przez SMSAPI (atrapa serwera)', async () => {
  const { createServer } = await import('node:http');
  const calls = [];
  const api = createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const p = Object.fromEntries(new URLSearchParams(b)); calls.push({ auth: req.headers.authorization, p }); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(p.sch_del ? { count: 1, list: [{ id: p.sch_del }] } : { count: 1, list: [{ id: 'SMS123', points: 0.16, status: p.date ? 'QUEUE' : 'SENT', parts: 1 }] })); }); });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  process.env.SMSAPI_TOKEN = 'tok-test'; process.env.SMSAPI_FROM = 'ShipCenter'; process.env.SMSAPI_URL = `http://127.0.0.1:${api.address().port}`;
  const { smsSend, smsCancel, normPhone } = await import('../src/sms.js?' + Date.now());
  const { cfg } = await import('../src/config.js');
  Object.assign(cfg.smsapi, { token: 'tok-test', from: 'ShipCenter', url: process.env.SMSAPI_URL });
  assert.equal(normPhone('+48 600 100 200'), '48600100200');
  const now = await smsSend({ to: '600 100 200', message: 'Dzien dobry, test' });
  assert.equal(now.id, 'SMS123'); assert.equal(now.scheduled, false);
  const later = await smsSend({ to: '+48600100200', message: 'Przypomnienie', date: new Date(Date.now() + 86400000).toISOString() });
  assert.equal(later.scheduled, true);
  await smsCancel({ id: 'SMS123' });
  api.close();
  assert.equal(calls[0].auth, 'Bearer tok-test');
  assert.equal(calls[0].p.to, '48600100200'); assert.equal(calls[0].p.from, 'ShipCenter'); assert.ok(!calls[0].p.date);
  assert.ok(+calls[1].p.date > Date.now() / 1000);
  assert.equal(calls[2].p.sch_del, 'SMS123');
  await assert.rejects(() => smsSend({ to: '123', message: 'x' }), /Nieprawidłowy numer/);
});

test('address_suggest i address_details (atrapa Google Places)', async () => {
  const { createServer } = await import('node:http');
  const api = createServer((req, res) => {
    let b = ''; req.on('data', c => b += c); req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.headers['x-goog-api-key'] !== 'k-test') { res.statusCode = 403; return res.end('{"error":{"message":"bad key"}}'); }
      if (req.url.startsWith('/v1/places:autocomplete')) return res.end(JSON.stringify({ suggestions: [{ placePrediction: { placeId: 'P1', text: { text: 'Główna 22, Świerklaniec, Polska' }, structuredFormat: { mainText: { text: 'Główna 22' }, secondaryText: { text: 'Świerklaniec, Polska' } } } }] }));
      res.end(JSON.stringify({ formattedAddress: 'Główna 22, 42-622 Świerklaniec, Polska', addressComponents: [{ longText: '22', types: ['street_number'] }, { longText: 'Główna', types: ['route'] }, { longText: 'Świerklaniec', types: ['locality'] }, { longText: 'Powiat tarnogórski', types: ['administrative_area_level_2'] }, { longText: 'Województwo śląskie', types: ['administrative_area_level_1'] }, { longText: '42-622', types: ['postal_code'] }], location: { latitude: 50.44, longitude: 18.93 } }));
    });
  });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const { cfg } = await import('../src/config.js');
  cfg.places.key = 'k-test'; cfg.places.url = `http://127.0.0.1:${api.address().port}`;
  const { addressSuggest, addressDetails } = await import('../src/places.js');
  const s = await addressSuggest({ input: 'Główna 22 Świerkl' });
  assert.equal(s.items[0].main, 'Główna 22'); assert.equal(s.items[0].placeId, 'P1');
  const d = await addressDetails({ placeId: 'P1' });
  api.close();
  assert.equal(d.postalCode, '42-622'); assert.equal(d.region, 'śląskie'); assert.equal(d.district, 'tarnogórski'); assert.equal(d.city, 'Świerklaniec'); assert.equal(d.street, 'Główna'); assert.equal(d.number, '22');
});

test('NDA: link, kod SMS, akceptacja, status', async () => {
  const { createServer } = await import('node:http');
  const os = await import('node:os'); const fs2 = await import('node:fs'); const path2 = await import('node:path');
  const sms = [];
  const api = createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { sms.push(Object.fromEntries(new URLSearchParams(b))); res.setHeader('Content-Type', 'application/json'); res.end('{"count":1,"list":[{"id":"S1"}]}'); }); });
  api.listen(0, '127.0.0.1'); await once(api, 'listening');
  const { cfg } = await import('../src/config.js');
  Object.assign(cfg.smsapi, { token: 't', url: `http://127.0.0.1:${api.address().port}`, from: '' });
  cfg.dataDir = fs2.mkdtempSync(path2.join(os.tmpdir(), 'nda-')); cfg.publicUrl = 'https://mcp.example';
  cfg.smtp.host = '127.0.0.1'; cfg.smtp.port = 1; cfg.imap.port = 1;
  const { ndaCreate, ndaStatus } = await import('../src/nda.js');
  const { buildApp } = await import('../src/server.js?nda' + Date.now());
  const http = buildApp().listen(0, '127.0.0.1'); await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;
  const text = 'UMOWA O ZACHOWANIU POUFNOŚCI\n\n' + 'Treść testowa umowy. '.repeat(20);
  const c = ndaCreate({ lead_id: 'L1', text, signer: { name: 'Anna Test', phone: '600100200', email: '' } });
  assert.match(c.url, /^https:\/\/mcp\.example\/nda\//);
  const pg = await fetch(`${base}/nda/${c.token}`); assert.equal(pg.status, 200); assert.match(await pg.text(), /Anna Test/);
  const noAcc = await fetch(`${base}/nda/${c.token}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"code":"000000"}' }); assert.equal(noAcc.status, 400);
  const r1 = await fetch(`${base}/nda/${c.token}/code`, { method: 'POST' }); assert.equal(r1.status, 200);
  const code = sms[0].message.match(/(\d{6})/)[1]; assert.equal(sms[0].to, '48600100200');
  const bad = await fetch(`${base}/nda/${c.token}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code === '111111' ? '222222' : '111111', accepted: true }) }); assert.equal(bad.status, 400);
  const ok = await fetch(`${base}/nda/${c.token}/sign`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, accepted: true }) }); assert.equal(ok.status, 200);
  const st = ndaStatus({ token: c.token }); assert.equal(st.status, 'podpisana'); assert.ok(st.signedAt); assert.equal(st.hash.length, 64);
  assert.equal((await fetch(`${base}/nda/nieistnieje`)).status, 404);
  await new Promise(r => setTimeout(r, 300)); http.close(); api.close();
});

test('public_prices: cennik shipcenter.pl z __NEXT_DATA__ (atrapa strony)', async () => {
  const { createServer } = await import('node:http');
  const nd = queries => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { dehydratedState: { queries } } } })}</script></html>`;
  const pages = {
    '/cennik': nd([{ queryKey: ['price-list-couriers'], state: { data: { couriers: [{ uId: 'inpost' }, { uId: 'gls' }, { uId: 'stary', isOld: true }] } } }]),
    '/cennik-inpost': nd([{ queryKey: ['price-list-data', 'cennik-inpost'], state: { data: { services: [{ name: 'Kurier Standard', list: {
      1: { type: 'Koperta', items: [{ waga: 'do 2 kg', cena_netto: '21,00 PLN', cena_brutto: '25,83 PLN' }] },
      2: { type: 'Paczka', items: [{ waga: 'do 1 kg', cena_netto: '21,00 PLN', cena_brutto: '25,83 PLN' }, { waga: '1,01 kg - 2 kg', cena_netto: '21,90 PLN', cena_brutto: '26,94 PLN' }] } } }] } } }]),
    '/cennik-gls': nd([{ queryKey: ['price-list-data', 'cennik-gls'], state: { data: { additionalServices: [] } } }])
  };
  const srv = createServer((req, res) => { const b = pages[req.url]; res.writeHead(b ? 200 : 404, { 'Content-Type': 'text/html' }); res.end(b || 'nie ma'); });
  srv.listen(0, '127.0.0.1'); await once(srv, 'listening');
  const { cfg } = await import('../src/config.js');
  cfg.shopUrl = `http://127.0.0.1:${srv.address().port}`;
  const { publicPrices, parseWeight } = await import('../src/prices.js');
  try {
    assert.deepEqual(parseWeight('20,01 kg - 31,50 kg'), { from: 20.01, to: 31.5 });
    const r = await publicPrices();
    assert.equal(r.rows.length, 3);
    assert.deepEqual(r.rows[0], { courier: 'inpost', s: 'Kurier Standard', t: 'Koperta/list', from: 0, to: 2, w: 'do 2 kg', netto: 21, brutto: 25.83 });
    assert.equal(r.rows[2].from, 1.01);
    assert.match(r.errors.join(' '), /gls/);
  } finally { srv.close(); }
});
