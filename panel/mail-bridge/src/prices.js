/* Publiczny cennik shipcenter.pl (ceny dla klienta bez logowania).
   Strony /cennik-<przewoźnik> to Next.js – ceny są w <script id="__NEXT_DATA__">. */
import { cfg } from './config.js';

const num = v => parseFloat(String(v || '').replace(/[^\d,.-]/g, '').replace(',', '.'));
const TYPES = { Koperta: 'Koperta/list' };

async function page(path) {
  const r = await fetch(cfg.shopUrl + path, { headers: { 'User-Agent': 'ShipCenter-panel/1.0', Accept: 'text/html' }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  const html = await r.text();
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`${path}: brak danych cennika na stronie`);
  const queries = (((JSON.parse(m[1]).props || {}).pageProps || {}).dehydratedState || {}).queries || [];
  return key => (queries.find(q => Array.isArray(q.queryKey) && q.queryKey[0] === key) || { state: {} }).state.data || null;
}

/* „do 1 kg” → {from:0,to:1}; „1,01 kg - 2 kg” → {from:1.01,to:2} */
export function parseWeight(w) {
  const s = String(w || '');
  let m = s.match(/do\s+([\d,.]+)\s*kg/i);
  if (m) return { from: 0, to: num(m[1]) };
  m = s.match(/([\d,.]+)\s*kg\s*-\s*([\d,.]+)\s*kg/i);
  if (m) return { from: num(m[1]), to: num(m[2]) };
  return null;
}

export function parseServices(services, uId) {
  const rows = [];
  for (const sv of services || []) {
    for (const g of Object.values(sv.list || {})) {
      for (const it of g.items || []) {
        const w = parseWeight(it.waga);
        const netto = num(it.cena_netto);
        if (!w || !Number.isFinite(netto)) continue;
        rows.push({ courier: uId, s: sv.name, t: TYPES[g.type] || g.type || 'Paczka', from: w.from, to: w.to, w: it.waga, netto, brutto: num(it.cena_brutto) });
      }
    }
  }
  return rows;
}

export async function publicPrices({ couriers } = {}) {
  let list = couriers;
  if (!list || !list.length) {
    const get = await page('/cennik');
    list = (((get('price-list-couriers') || {}).couriers) || []).filter(c => !c.isOld).map(c => c.uId);
  }
  const rows = [], errors = [];
  for (const uId of list.slice(0, 30)) {
    if (!/^[a-z0-9-]{2,40}$/.test(uId)) continue;
    try {
      const get = await page('/cennik-' + uId);
      const data = get('price-list-data') || {};
      if (!data.services) { errors.push(`${uId}: strona bez tabeli cen`); continue; }
      rows.push(...parseServices(data.services, uId));
    } catch (e) { errors.push(e.message); }
  }
  return { source: cfg.shopUrl + '/cennik', fetchedAt: new Date().toISOString(), rows, errors };
}
