/* Umowa o zachowaniu poufności (NDA) z akceptacją kodem SMS
   Panel tworzy umowę (nda_create) → kandydat dostaje link https://<PUBLIC_URL>/nda/<token>,
   czyta treść, prosi o kod SMS, wpisuje go → umowa zaakceptowana (forma dokumentowa, art. 77² KC).
   Zapisujemy: datę, IP, przeglądarkę, numer telefonu i skrót SHA-256 treści. Kopia idzie mailem do obu stron. */
import { randomBytes, createHash, randomInt, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cfg } from './config.js';
import { smsSend } from './sms.js';
import { sendMail } from './mail.js';

const FILE = () => path.join(cfg.dataDir, 'nda.json');
const sha = s => createHash('sha256').update(String(s)).digest('hex');
const now = () => new Date().toISOString();

function load() { try { return JSON.parse(fs.readFileSync(FILE(), 'utf8')); } catch { return {}; } }
function save(db) {
  fs.mkdirSync(cfg.dataDir, { recursive: true });
  const tmp = FILE() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1), { mode: 0o600 });
  fs.renameSync(tmp, FILE());
}
const maskPhone = p => { const d = String(p || '').replace(/\D/g, ''); return d.length >= 9 ? `+48 *** *** ${d.slice(-3)}` : '***'; };

export function ndaCreate({ lead_id, title, text, signer, expires_days }) {
  if (!text || String(text).length < 200) throw new Error('Brak treści umowy');
  if (!signer || !signer.name) throw new Error('Brak danych kandydata');
  if (!signer.phone) throw new Error('Kandydat nie ma numeru telefonu – kod SMS nie może zostać wysłany');
  const db = load();
  const token = randomBytes(24).toString('base64url');
  const days = Math.min(60, Math.max(1, +expires_days || 14));
  db[token] = {
    leadId: lead_id || '', title: title || 'Umowa o zachowaniu poufności', text: String(text), hash: sha(text),
    signer: { name: signer.name, company: signer.company || '', nip: signer.nip || '', phone: signer.phone, email: signer.email || '' },
    createdAt: now(), expiresAt: new Date(Date.now() + days * 86400000).toISOString(), status: 'oczekuje', codes: [], attempts: 0
  };
  save(db);
  return { token, url: `${cfg.publicUrl}/nda/${token}`, expiresAt: db[token].expiresAt };
}

export function ndaStatus({ token }) {
  const n = load()[token];
  if (!n) throw new Error('Nie znaleziono umowy');
  const expired = n.status !== 'podpisana' && n.expiresAt < now();
  return { status: expired ? 'wygasla' : n.status, signedAt: n.signedAt || null, ip: n.ip || null, userAgent: n.userAgent || null, phone: maskPhone(n.signer.phone), hash: n.hash, createdAt: n.createdAt, expiresAt: n.expiresAt, codeSentAt: (n.codes.slice(-1)[0] || {}).at || null };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function page(n, token) {
  const signed = n.status === 'podpisana';
  const expired = !signed && n.expiresAt < now();
  const paras = n.text.split(/\n\s*\n/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${esc(n.title)} – ShipCenter</title>
<style>body{margin:0;background:#f7f7f8;font-family:Arial,Helvetica,sans-serif;color:#111827}.w{max-width:760px;margin:0 auto;padding:24px 16px 60px}.c{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:24px}
h1{font-size:22px;margin:0 0 4px}.m{color:#6b7280;font-size:14px;margin-bottom:16px}.t{font-size:14px;line-height:1.6;max-height:55vh;overflow:auto;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;background:#fcfcfd}
.b{display:inline-block;background:#ea580c;color:#fff;border:0;border-radius:9px;padding:12px 18px;font-size:15px;font-weight:bold;cursor:pointer}.b:disabled{opacity:.5;cursor:default}
.r{margin-top:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}input[type=text]{font-size:20px;letter-spacing:6px;padding:10px 12px;width:150px;border:1px solid #d1d5db;border-radius:9px;text-align:center}
.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;padding:14px;border-radius:10px;margin-top:16px}.er{color:#b91c1c;font-size:14px}.top{border-bottom:3px solid #ea580c;padding-bottom:10px;margin-bottom:16px;font-weight:bold;color:#ea580c;letter-spacing:.05em}</style></head>
<body><div class="w"><div class="top">SHIPCENTER</div><div class="c"><h1>${esc(n.title)}</h1><div class="m">${esc(n.signer.name)}${n.signer.company ? ' · ' + esc(n.signer.company) : ''}</div>
<div class="t">${paras}</div>
${signed ? `<div class="ok"><b>Umowa zaakceptowana</b> ${esc(new Date(n.signedAt).toLocaleString('pl-PL'))}. Kopia treści została wysłana na adres e-mail.</div>`
    : expired ? `<p class="er">Link wygasł – poproś opiekuna ShipCenter o nowy.</p>`
    : `<label class="r"><input type="checkbox" id="acc"> <span>Zapoznałem(-am) się z treścią umowy i akceptuję jej warunki.</span></label>
<div class="r"><button class="b" id="snd" disabled>Wyślij kod SMS na ${esc(maskPhone(n.signer.phone))}</button></div>
<div class="r" id="cw" hidden><input type="text" id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"><button class="b" id="sig">Akceptuję i podpisuję</button></div>
<p class="er" id="er"></p>
<script>
const T=${JSON.stringify(token)};const $=i=>document.getElementById(i);
$('acc').onchange=()=>{$('snd').disabled=!$('acc').checked};
async function post(u,b){const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b||{})});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Błąd');return j}
$('snd').onclick=async()=>{$('er').textContent='';$('snd').disabled=true;try{await post('/nda/'+T+'/code');$('cw').hidden=false;$('snd').textContent='Wyślij kod ponownie';$('code').focus()}catch(e){$('er').textContent=e.message}setTimeout(()=>{$('snd').disabled=!$('acc').checked},30000)};
$('sig').onclick=async()=>{$('er').textContent='';try{await post('/nda/'+T+'/sign',{code:$('code').value.trim(),accepted:$('acc').checked});location.reload()}catch(e){$('er').textContent=e.message}};
</script>`}
</div><p class="m" style="margin-top:14px">Ship Center Poland Sp. z o.o., ul. Gliwicka 51, 40-853 Katowice · ${esc(cfg.from)}</p></div></body></html>`;
}

export function ndaRoutes(app, express) {
  const jsonBody = express.json({ limit: '10kb' });
  app.get('/nda/:token', (req, res) => {
    const n = load()[req.params.token];
    if (!n) return res.status(404).type('text/plain').send('Nie znaleziono umowy.');
    res.set('Cache-Control', 'no-store').set('X-Robots-Tag', 'noindex').type('html').send(page(n, req.params.token));
  });
  app.post('/nda/:token/code', jsonBody, async (req, res) => {
    const db = load(); const n = db[req.params.token];
    if (!n || n.status === 'podpisana' || n.expiresAt < now()) return res.status(400).json({ error: 'Umowa jest niedostępna.' });
    const recent = n.codes.filter(c => Date.parse(c.at) > Date.now() - 3600000);
    if (recent.length >= 3) return res.status(429).json({ error: 'Wysłano już 3 kody w ciągu godziny – spróbuj później.' });
    const code = String(randomInt(0, 1000000)).padStart(6, '0');
    try { await smsSend({ to: n.signer.phone, message: `ShipCenter: kod akceptacji umowy o zachowaniu poufnosci: ${code}. Kod wazny 10 minut.` }); }
    catch (e) { return res.status(502).json({ error: 'Nie udało się wysłać SMS-a. Spróbuj za chwilę.' }); }
    n.codes.push({ hash: sha(req.params.token + code), at: now() }); n.attempts = 0;
    save(db); res.json({ ok: true });
  });
  app.post('/nda/:token/sign', jsonBody, async (req, res) => {
    const db = load(); const n = db[req.params.token];
    if (!n || n.status === 'podpisana' || n.expiresAt < now()) return res.status(400).json({ error: 'Umowa jest niedostępna.' });
    if (!req.body || req.body.accepted !== true) return res.status(400).json({ error: 'Zaznacz akceptację treści umowy.' });
    const last = n.codes.slice(-1)[0];
    if (!last || Date.parse(last.at) < Date.now() - 600000) return res.status(400).json({ error: 'Kod wygasł – wyślij nowy.' });
    n.attempts = (n.attempts || 0) + 1;
    if (n.attempts > 5) { save(db); return res.status(429).json({ error: 'Za dużo prób – wyślij nowy kod.' }); }
    const a = Buffer.from(sha(req.params.token + String(req.body.code || ''))), b = Buffer.from(last.hash);
    if (a.length !== b.length || !timingSafeEqual(a, b)) { save(db); return res.status(400).json({ error: 'Nieprawidłowy kod.' }); }
    Object.assign(n, { status: 'podpisana', signedAt: now(), ip: req.ip, userAgent: String(req.headers['user-agent'] || '').slice(0, 300) });
    save(db);
    res.json({ ok: true });
    const meta = `Zaakceptowano: ${new Date(n.signedAt).toLocaleString('pl-PL')} · kod SMS na ${maskPhone(n.signer.phone)} · IP ${n.ip} · SHA-256 treści: ${n.hash}`;
    const to = [n.signer.email].filter(Boolean);
    try { await sendMail({ to: to.length ? to : cfg.from, bcc: to.length ? cfg.from : undefined, subject: `${n.title} – potwierdzenie akceptacji`, text: `${n.text}\n\n---\n${n.signer.name}\n${meta}` }); } catch (e) { console.error('NDA mail:', e.message); }
  });
}
