/* SMS przez SMSAPI.pl – wysyłka natychmiastowa i planowana (parametr date), anulowanie planowanych */
import { cfg } from './config.js';

const smsLog = [];

export function normPhone(p) {
  let d = String(p || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (/^\d{9}$/.test(d)) d = '48' + d;
  if (!/^\d{10,15}$/.test(d)) throw new Error('Nieprawidłowy numer telefonu: ' + p);
  return d;
}

async function call(params) {
  if (!cfg.smsapi.token) throw new Error('SMS nie są skonfigurowane – brak SMSAPI_TOKEN w .env mostka');
  const body = new URLSearchParams({ format: 'json', ...params });
  const r = await fetch(cfg.smsapi.url + '/sms.do', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + cfg.smsapi.token, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  let j;
  try { j = await r.json(); } catch { throw new Error('SMSAPI: nieczytelna odpowiedź (HTTP ' + r.status + ')'); }
  if (j.error) throw new Error(`SMSAPI ${j.error}: ${j.message || 'błąd'}`);
  if (!r.ok) throw new Error('SMSAPI: HTTP ' + r.status);
  return j;
}

export async function smsSend({ to, message, date }) {
  const text = String(message || '').trim();
  if (!text) throw new Error('Pusta treść SMS-a');
  if (text.length > 918) throw new Error('SMS za długi (max 918 znaków)');
  const hourAgo = Date.now() - 3600000;
  while (smsLog.length && smsLog[0] < hourAgo) smsLog.shift();
  if (smsLog.length >= cfg.smsapi.maxPerHour) throw new Error(`Przekroczono limit ${cfg.smsapi.maxPerHour} SMS-ów na godzinę`);
  const params = { to: normPhone(to), message: text, encoding: 'utf-8' };
  if (cfg.smsapi.from) params.from = cfg.smsapi.from;
  let scheduled = false;
  if (date) {
    const t = Math.floor(new Date(date).getTime() / 1000);
    if (!Number.isFinite(t)) throw new Error('Nieprawidłowa data wysyłki');
    if (t > Date.now() / 1000 + 60) { params.date = String(t); scheduled = true; }
  }
  const j = await call(params);
  smsLog.push(Date.now());
  const it = (j.list || [])[0] || {};
  return { id: it.id || '', status: it.status || '', points: it.points ?? null, parts: it.parts ?? null, scheduled, sendAt: scheduled ? new Date(+params.date * 1000).toISOString() : new Date().toISOString() };
}

export async function smsCancel({ id }) {
  if (!id) throw new Error('Brak identyfikatora SMS-a');
  const j = await call({ sch_del: String(id) });
  return { cancelled: true, count: j.count ?? null };
}

export function smsConfigured() { return { configured: !!cfg.smsapi.token, from: cfg.smsapi.from || '' }; }
