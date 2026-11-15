/* ===== Ship Center – rekrutacja franczyzobiorców: rdzeń (stałe, stan, zapis, obliczenia) ===== */
'use strict';

/* Etapy ustalane automatycznie z działań: rozmowa, prezentacja, spotkanie, status „Pozyskany”. */
const STAGES = [
  { k: 'nowy', n: 'Nowy lead', short: 'Nowy' },
  { k: 'kontakt', n: 'Po pierwszej rozmowie', short: 'Po rozmowie' },
  { k: 'prezentacja', n: 'Prezentacja wysłana', short: 'Prezentacja' },
  { k: 'spotkanie', n: 'Spotkanie / negocjacje', short: 'Spotkanie' },
  { k: 'umowa', n: 'Umowa podpisana', short: 'Umowa' }
];
const NS = STAGES.length;
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.k, i]));
const CONV_LABELS = ['Lead → pierwsza rozmowa', 'Rozmowa → prezentacja', 'Prezentacja → spotkanie', 'Spotkanie → umowa'];

const STATUSES = [
  { k: 'do_kontaktu', n: 'Do kontaktu', tone: 'acc' },
  { k: 'proba', n: 'Brak odpowiedzi', tone: 'warn' },
  { k: 'w_kontakcie', n: 'W kontakcie', tone: '' },
  { k: 'czeka', n: 'Czeka na decyzję', tone: '' },
  { k: 'umowione', n: 'Spotkanie umówione', tone: 'acc' },
  { k: 'wstrzymany', n: 'Wstrzymany', tone: 'outline' },
  { k: 'czeka_umowa', n: 'Pozyskany – czeka na podpisanie umowy', tone: 'acc' },
  { k: 'utracony', n: 'Utracony', tone: 'bad' },
  { k: 'pozyskany', n: 'Pozyskany – umowa podpisana', tone: 'good' }
];
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.k, s]));
const CLOSED = new Set(['utracony', 'pozyskany']);
const LOST_REASONS = ['Brak kapitału', 'Brak lokalu / zła lokalizacja', 'Wybrał inną franczyzę', 'Brak kontaktu', 'Rezygnacja – czas / sytuacja osobista', 'Niespełnione kryteria', 'Konflikt z ochroną 3 km', 'Inne'];

const SOURCES = [
  { k: 'meta', n: 'Meta Ads (FB/IG)', cpl: 110 },
  { k: 'google', n: 'Google Ads', cpl: 190 },
  { k: 'portale', n: 'Portale franczyzowe', cpl: 260 },
  { k: 'linkedin', n: 'LinkedIn', cpl: 320 },
  { k: 'polecenia', n: 'Polecenia franczyzobiorców', cpl: 150 },
  { k: 'targi', n: 'Targi i eventy', cpl: 420 },
  { k: 'www', n: 'Strona www / SEO', cpl: 60 },
  { k: 'webinar', n: 'Webinary', cpl: 140 },
  { k: 'outbound', n: 'Outbound (telefon, e-mail)', cpl: 70 },
  { k: 'inne', n: 'Inne', cpl: 150 }
];
const SOURCE_MAP = Object.fromEntries(SOURCES.map(s => [s.k, s]));
const SERIES = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7', '--s8'];

const REGIONS = ['dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie'];
const MODELS = [
  { k: 'franczyza', n: 'Franczyza' },
  { k: 'shippoint', n: 'Ship Point' }
];
const MODEL_ALIAS = { punkt: 'franczyza', bez_punktu: 'franczyza', partner: 'shippoint' };
const modelOf = l => MODEL_ALIAS[l.model] || l.model || 'franczyza';
const modelName = k => (MODELS.find(m => m.k === (MODEL_ALIAS[k] || k)) || { n: '—' }).n;
const PACKAGES = { smart: 'SMART – ma wyposażenie', flex: 'FLEX – dobiera sprzęt' };
const CONTACT_TYPES = [
  { k: 'tel', n: 'Telefon' }, { k: 'email', n: 'E-mail' }, { k: 'sms', n: 'SMS' },
  { k: 'spotkanie', n: 'Spotkanie' }, { k: 'webinar', n: 'Webinar' }, { k: 'notatka', n: 'Notatka' },
  { k: 'system', n: 'Zmiana w systemie' }
];
const CT_MAP = Object.fromEntries(CONTACT_TYPES.map(c => [c.k, c]));
const ROLES = ['Centrala – dyrektor rozwoju', 'Opiekun regionalny', 'Analityk lokalizacji', 'Marketing', 'Inna rola'];
const STREAMS = { mkt: 'Marketing', sprz: 'Sprzedaż', lok: 'Lokalizacje', anl: 'Analityka' };
const STREAM_COLOR = { mkt: '--s2', sprz: '--s1', lok: '--s3', anl: '--s7' };

const DEFAULT_CONV = [0.75, 0.60, 0.35, 0.35];
const DEFAULT_MIX = { meta: 35, google: 20, portale: 15, linkedin: 5, polecenia: 8, targi: 5, www: 4, webinar: 4, outbound: 4, inne: 0 };

const DEFAULT_OFFER = {
  licencja: 7999, oplataMies: 199, prowizjaP24: 1.5, progRabatu: 600, flexRabat: 15,
  licencjaBezPunktu: 5000, partnerWstepna: 299, partnerMies: 19.99,
  szkolenie: '3 dni w centrali ShipCenter w Katowicach',
  uruchomienie: 'do 1 miesiąca od podpisania umowy',
  ochrona: 3, godziny: '5 dni w tygodniu, w godz. 7:00–19:00 (min. 7 godz. dziennie)',
  minPaczek: 100, przewoznicy: 'InPost, DPD, DHL, UPS, FedEx, GLS, Poczta Polska (Pocztex), ORLEN Paczka, Ambro Express',
  email: 'franczyza@shipcenter.pl', telefon: '+48 798 344 130', www: 'shipcenter.pl',
  adres: 'ul. Gliwicka 51, 40-853 Katowice', linkSpotkanie: '', linkWebinar: '',
  linkKalkulator: 'https://shipcenter.pl/franczyza/kalkulator', linkPrezentacja: '', linkPrezentacjaShipPoint: '', linkUmowaFranczyza: '', linkUmowaPartner: 'https://drive.google.com/file/d/1zr1IC75QBJAmJPl6VhOTv5iuuIg0-o2x/view?usp=sharing', linkMeet: '', smsPodpis: 'ShipCenter'
};

/* ---------- logo ShipCenter (SVG ze strony shipcenter.pl) ---------- */
const LOGO_SVG = `<svg class="rlogo" role="img" aria-label="ShipCenter" xmlns="http://www.w3.org/2000/svg" xml:space="preserve" viewBox="0 0 362.6 73.9"><path fill="#101827" d="M93.9 19.5v36.9H82.6V19.5h11.3zM131.2 21.3c2.4 1.5 4.3 3.7 5.7 6.5 1.4 2.8 2.1 6.2 2.1 10.1 0 3.8-.7 7.2-2.1 10-1.4 2.9-3.3 5.1-5.7 6.6-2.4 1.5-5.1 2.3-8.2 2.3-2.8 0-5.2-.6-7.3-1.9-2-1.3-3.5-3-4.4-5.2v24.2H100V19.5h11.3v6.7c.9-2.2 2.4-3.9 4.4-5.2 2-1.3 4.4-1.9 7.3-1.9 3.1-.1 5.8.6 8.2 2.2zm-17.7 10c-1.5 1.6-2.3 3.8-2.3 6.6 0 2.7.8 4.9 2.3 6.5 1.5 1.6 3.5 2.4 5.8 2.4 2.4 0 4.4-.8 5.8-2.4 1.5-1.6 2.2-3.8 2.2-6.6s-.7-5-2.2-6.6c-1.5-1.6-3.4-2.4-5.8-2.4-2.3.1-4.2.9-5.8 2.5zM179.3 13.8c3.9 3.1 6.4 7.4 7.6 12.7h-12c-.9-2.2-2.2-3.9-4.1-5.1-1.8-1.2-4-1.8-6.5-1.8-3.3 0-6 1.2-8 3.6-2 2.4-3 5.7-3 9.7 0 4.1 1 7.3 3 9.7 2 2.4 4.7 3.6 8 3.6 2.5 0 4.7-.6 6.5-1.8 1.8-1.2 3.2-2.9 4.1-5h12c-1.1 5.3-3.7 9.5-7.6 12.7-3.9 3.1-8.8 4.7-14.8 4.7-4.5 0-8.5-1-12-3-3.4-2-6.1-4.8-8-8.4-1.9-3.6-2.8-7.7-2.8-12.4 0-4.6.9-8.7 2.8-12.4 1.9-3.6 4.5-6.4 8-8.4 3.4-2 7.4-3 12-3 6-.1 10.9 1.5 14.8 4.6zM226.2 39.9h-25.6c.1 2.8.8 4.8 2.1 6 1.3 1.2 2.9 1.8 4.9 1.8 1.7 0 3.1-.4 4.2-1.3 1.1-.8 1.8-1.9 2.2-3.2h12c-.5 2.6-1.5 4.9-3.2 7-1.6 2-3.7 3.7-6.2 4.8-2.5 1.2-5.3 1.8-8.4 1.8-3.6 0-6.8-.8-9.6-2.3-2.8-1.5-5-3.7-6.6-6.6-1.6-2.9-2.4-6.2-2.4-10 0-3.9.8-7.2 2.3-10.1 1.6-2.8 3.8-5 6.6-6.5s6-2.3 9.6-2.3c3.7 0 6.9.7 9.6 2.2 2.8 1.5 4.9 3.6 6.4 6.3 1.5 2.7 2.3 5.8 2.3 9.3.2 1 0 2-.2 3.1zm-13-10.2c-1.3-1.2-3-1.8-5-1.8-2.1 0-3.8.6-5.2 1.8-1.4 1.2-2.1 3-2.3 5.4h14.4c.1-2.3-.6-4.2-1.9-5.4zM264.2 23.3c2.5 2.8 3.7 6.7 3.7 11.6v21.4h-11.3V36.2c0-2.5-.7-4.4-1.9-5.8-1.3-1.4-3-2.1-5.2-2.1-2.3 0-4.1.7-5.5 2.2-1.3 1.5-2 3.5-2 6.2v19.6h-11.3V19.5H242v6.7c1.1-2.2 2.6-3.9 4.7-5.2 2.1-1.3 4.5-1.9 7.4-1.9 4.3 0 7.7 1.4 10.1 4.2zM294.7 46.6v9.7h-5.1c-4.3 0-7.7-1.1-10.1-3.2-2.4-2.1-3.6-5.7-3.6-10.6V29h-5v-9.5h5v-9.1h11.3v9.1h7.4V29h-7.4v13.7c0 1.5.3 2.5.9 3 .6.6 1.6.9 3 .9h3.6zM334.1 39.9h-25.6c.1 2.8.8 4.8 2.1 6 1.3 1.2 2.9 1.8 4.9 1.8 1.7 0 3.1-.4 4.2-1.3 1.1-.8 1.8-1.9 2.2-3.2h12c-.5 2.6-1.5 4.9-3.2 7-1.6 2-3.7 3.7-6.2 4.8-2.5 1.2-5.3 1.8-8.4 1.8-3.6 0-6.8-.8-9.6-2.3-2.8-1.5-5-3.7-6.6-6.6-1.6-2.9-2.4-6.2-2.4-10 0-3.9.8-7.2 2.3-10.1 1.6-2.8 3.8-5 6.6-6.5s6-2.3 9.6-2.3c3.7 0 6.9.7 9.6 2.2 2.8 1.5 4.9 3.6 6.4 6.3 1.5 2.7 2.3 5.8 2.3 9.3.1 1 0 2-.2 3.1zM321 29.7c-1.3-1.2-3-1.8-5-1.8-2.1 0-3.8.6-5.2 1.8-1.4 1.2-2.1 3-2.3 5.4H323c0-2.3-.7-4.2-2-5.4zM355.4 21c2.2-1.3 4.6-2 7.2-2v12.1h-3.2c-3 0-5.3.6-7 1.9-1.7 1.3-2.5 3.4-2.5 6.5v16.8h-11.3V19.5h11.3v6.9c1.4-2.3 3.2-4 5.5-5.4z"></path><g fill="#101827"><path d="M6.8 33.9c1.5.8 3.4 1.7 5.6 2.4 6.9 2 14 1.5 20.9.3-.1-.3-.3-.5-.5-.7-1.4-1.9-3-3.3-4.9-4.3-1.9-1-4.3-2-7.3-3-2.1-.7-3.7-1.4-4.8-1.9-1.1-.5-2-1.1-2.7-1.9-.7-.8-1.1-1.7-1.1-2.8 0-1.4.4-2.4 1.2-3.1.8-.7 1.9-1.1 3.2-1.1 1.5 0 2.8.5 3.7 1.4.9.9 1.5 2.1 1.7 3.7H34c-.4-4.3-2.1-7.7-5.2-10.2C25.7 10.2 21.6 9 16.4 9c-3.2 0-6.1.5-8.6 1.6S3.4 13.2 2 15.3c-1.4 2-2.1 4.4-2.1 7.2 0 3 .7 5.4 2 7.3 1.5 1.7 3.1 3.1 4.9 4.1zM18.2 47.9c-13.1-.1-18-5.7-18-5.7.3 4.6 2.2 8.1 5.6 10.7 3.4 2.6 7.7 3.8 12.9 3.8 3.5 0 6.4-.6 8.9-1.8 2.4-1.2 4.3-2.9 5.5-5 .9-1.4 1.4-3 1.7-4.6-5.8 1.9-11.2 2.7-16.6 2.6z"></path></g><path fill="#f1582f" d="M96 1.1c-.9-1.4-6.9-1.7-11.2 1-2.1 1.3-3.1 3.1-3.1 4.9l.4-.4c1.5-1 3.6-.6 4.6.9 1 1.5.6 3.6-.9 4.6-.1.1-.2.1-.2.1 1.5.4 3.3.1 5.2-1.3C94.7 8.5 97 2.4 96 1.1z"></path><g fill="#101827"><path d="M54.4 29.4c.3-.2.7-.4 1-.5 4.9-2.4 9.7-5.2 14.4-8.2-1.9-1.1-4.2-1.6-6.8-1.6-2.8 0-5.3.6-7.4 1.9-2.1 1.3-3.7 3-4.7 5.2V7.4H39.6V35c5-1.3 9.9-3.3 14.8-5.6zM39.6 43.6v12.7h11.3V37.8c-4 2.4-7.7 4.3-11.3 5.8zM71.7 22c-3.2 2.8-6.2 5.3-9.2 7.6.3.2.7.5 1 .8 1.3 1.4 1.9 3.3 1.9 5.8v20.1h11.3V34.9c0-4.9-1.2-8.8-3.7-11.6-.4-.5-.8-.9-1.3-1.3z"></path></g></svg>`;

/* ---------- utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0, useGrouping: 'always' });
const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 0, useGrouping: 'always' });
const nf2 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const fmt = (v, d = 0) => (v == null || !isFinite(v)) ? '—' : (d === 0 ? nf0 : d === 1 ? nf1 : nf2).format(v);
const zl = (v, d = 0) => (v == null || !isFinite(v)) ? '—' : fmt(v, d) + ' zł';
const pct = (v, d = 0) => (v == null || !isFinite(v)) ? '—' : fmt(v * 100, d) + '%';
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => isoDate(new Date());
const nowLocal = () => { const d = new Date(); return `${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const parseD = s => { if (!s) return null; const d = new Date(String(s).length <= 10 ? s + 'T00:00:00' : s); return isNaN(d) ? null : d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((parseD(isoDate(b)) - parseD(isoDate(a))) / 864e5);
const fdate = s => { const d = parseD(s); return d ? d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; };
const fdateShort = s => { const d = parseD(s); return d ? d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'; };
const fdt = s => { const d = parseD(s); if (!d) return '—'; const t = String(s).includes('T') ? ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : ''; return d.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }) + t; };
const mondayOf = d => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; };
const inRange = (s, a, b) => { const d = parseD(s); return !!d && d >= a && d < b; };
const firstName = n => String(n || '').replace(/^Przykład:\s*/, '').trim().split(/\s+/)[0] || '';
const leadCode = id => 'SC-' + String(id).replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase();
const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; };
const debounceMap = {};
const debounce = (key, fn, ms = 700) => { clearTimeout(debounceMap[key]); debounceMap[key] = setTimeout(fn, ms); };
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plik';

const ICONS = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M8 13h8M8 17h5"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  sms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  spotkanie: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/></svg>',
  webinar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  notatka: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  system: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5L12 12l9-4.5M12 12v9"/></svg>'
};

/* ---------- stan ---------- */
const COLS = ['leads', 'team', 'plans', 'tasks', 'spend', 'locations', 'sms', 'ads'];
const emptyData = () => ({ leads: {}, team: {}, plans: {}, tasks: {}, spend: {}, locations: {}, sms: {}, ads: {}, settings: {} });
const store = { live: emptyData(), demo: null };
const S = {
  db: null, mode: 'loading', demo: false, readonly: false, slow: false,
  confirmed: new Set(), pending: 0, sample: null, downloads: null,
  route: { view: 'centrala', id: null },
  f: { period: '30', source: '', owner: '', region: '', status: '', model: '', q: '' }, userId: null, user: null,
  leadsView: 'tabela', sort: { key: 'createdAt', dir: 'desc' }, selected: new Set(),
  planSel: null, msg: { tpl: 'email_pierwszy', leadId: '', form: 'panstwo' }, weekOffset: 0, ui: {}
};
const D = () => S.demo ? store.demo : store.live;
const settings = () => D().settings || {};
const offer = () => ({ ...DEFAULT_OFFER, ...(settings().offer || {}) });
const team = () => Object.values(D().team).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl'));
const memberName = id => (D().team[id] || {}).name || '';
const leadsArr = () => Object.values(D().leads);
const activePlan = () => {
  const plans = D().plans; const id = settings().activePlanId;
  return plans[id] || Object.values(plans).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))[0] || defaultPlanObj();
};
function defaultPlanObj() {
  return { id: '_default', name: 'Plan domyślny', budget: 22500, target: 2.5, startDate: todayISO(), cycleDays: 60, mix: { ...DEFAULT_MIX }, cpl: Object.fromEntries(SOURCES.map(s => [s.k, s.cpl])), conv: [...DEFAULT_CONV], createdAt: '' };
}

/* ---------- zapis ---------- */
const queues = {};
function enqueue(path, fn) {
  const p = (queues[path] || Promise.resolve()).catch(() => { }).then(fn);
  queues[path] = p;
  return p;
}
function canWrite() {
  if (S.demo || S.mode !== 'live') return true;
  if (S.readonly) { toast('Masz dostęp tylko do odczytu – zmiany nie zostaną zapisane.', 'bad'); return false; }
  return true;
}
async function dbWrite(path, op, attempt = 0) {
  S.pending++; renderSync();
  try {
    await enqueue(path, op);
  } catch (e) {
    const code = e && e.code;
    if (code === 'unavailable' && attempt < 1) {
      S.pending--; await new Promise(r => setTimeout(r, 600 + Math.random() * 900));
      return dbWrite(path, op, attempt + 1);
    }
    if (code === 'invalid_argument') { S.readonly = true; toast('Nie masz uprawnień do zapisu w tej bazie. Panel działa w trybie tylko do odczytu.', 'bad'); scheduleRender(); }
    else if (code === 'quota_exceeded') toast('Baza danych jest pełna. Usuń stare rekordy (np. utracone leady) i spróbuj ponownie.', 'bad');
    else if (code === 'resource_exhausted') toast('Za dużo zapisów naraz – odczekaj chwilę i spróbuj ponownie.', 'bad');
    else toast('Nie udało się zapisać zmian' + (e && e.message ? ': ' + e.message : '.'), 'bad');
    throw e;
  } finally {
    S.pending = Math.max(0, S.pending - 1); renderSync();
  }
}
function stripId(o) { const c = clone(o) || {}; delete c.id; return c; }
async function put(col, id, data) {
  if (!canWrite()) return;
  const body = stripId(data);
  D()[col][id] = { ...body, id };
  scheduleRender();
  if (S.demo || S.mode !== 'live') return;
  return dbWrite(col + '/' + id, () => S.db.collection(col).doc(id).set(body)).catch(() => { });
}
async function patch(col, id, partial) {
  if (!canWrite()) return;
  const cur = D()[col][id];
  if (!cur) return;
  const body = stripId(partial);
  D()[col][id] = { ...cur, ...body, id };
  scheduleRender();
  if (S.demo || S.mode !== 'live') return;
  return dbWrite(col + '/' + id, () => S.db.collection(col).doc(id).update(body)).catch(() => { });
}
async function remove(col, id) {
  if (!canWrite()) return;
  delete D()[col][id];
  scheduleRender();
  if (S.demo || S.mode !== 'live') return;
  return dbWrite(col + '/' + id, () => S.db.collection(col).doc(id).delete()).catch(() => { });
}
async function saveSettings(partial) {
  if (!canWrite()) return;
  const next = { ...clone(settings()), ...partial };
  D().settings = next;
  scheduleRender();
  if (S.demo || S.mode !== 'live') return;
  return dbWrite('settings/main', () => S.db.doc('settings/main').set(next)).catch(() => { });
}
/* zapis wielu dokumentów (import) z ograniczoną równoległością */
async function putMany(col, items, onProgress) {
  let done = 0, failed = 0;
  const queue = items.slice();
  const worker = async () => {
    while (queue.length) {
      const it = queue.shift();
      try { await put(col, it.id, it); } catch (e) { failed++; }
      done++; onProgress && onProgress(done, items.length);
      if (S.readonly) { queue.length = 0; }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { done, failed };
}

/* ---------- połączenie z bazą ---------- */
function subscribeAll() {
  const db = S.db;
  COLS.forEach(col => {
    db.collection(col).onSnapshot(snap => {
      const o = {};
      snap.docs.forEach(d => { o[d.id] = { ...clone(d.data()), id: d.id }; });
      store.live[col] = o;
      if (!snap.metadata.fromCache) S.confirmed.add(col);
      if (S.confirmed.size >= COLS.length) S.slow = false;
      scheduleRender();
    }, err => {
      S.confirmed.add(col);
      if (err && err.code === 'revoked') { S.mode = 'local'; }
      toast('Połączenie z bazą (' + col + ') zostało przerwane.', 'bad');
      scheduleRender();
    });
  });
  db.doc('settings/main').onSnapshot(d => {
    store.live.settings = d.exists ? clone(d.data()) : {};
    if (!d.metadata.fromCache) S.confirmed.add('settings');
    scheduleRender();
  }, () => { S.confirmed.add('settings'); scheduleRender(); });
}
function initCapabilities() {
  const c = window.claude;
  const slowTimer = setTimeout(() => { if (S.mode === 'loading' || (S.mode === 'live' && S.confirmed.size < COLS.length)) { S.slow = true; scheduleRender(); } }, 10000);
  if (!c || typeof c.use !== 'function') { S.mode = 'local'; clearTimeout(slowTimer); scheduleRender(); return; }
  c.use('db').then(db => {
    if (!db) { S.mode = 'local'; clearTimeout(slowTimer); scheduleRender(); return; }
    S.db = db; S.mode = 'live'; subscribeAll(); scheduleRender();
  }).catch(() => { S.mode = 'local'; scheduleRender(); });
  c.use('downloads').then(x => { S.downloads = x; scheduleRender(); }).catch(() => { });
  c.use('sample').then(x => { S.sample = x; scheduleRender(); }).catch(() => { });
  c.use('assets').then(x => { S.assets = x; scheduleRender(); }).catch(() => { });
  c.use('mcp').then(x => { S.mcp = x; scheduleRender(); if (x) setTimeout(mailInit, 600); }).catch(() => { });
  c.use('user').then(async u => { S.user = u; if (u) { try { S.userId = await u.id(); } catch (e) { } try { S.isOwner = !!(await u.isOwner()); } catch (e) { S.isOwner = false; } scheduleRender(); } }).catch(() => { });
}
const isLoading = () => S.mode === 'loading' || (S.mode === 'live' && !S.demo && S.confirmed.size < 3 && !S.slow);

/* ---------- logika leadów ---------- */
function stageDatesOf(l) {
  const old = l.stageDates || {};
  const meetHist = (l.history || []).find(h => h.type === 'spotkanie' && h.result !== 'Nie odebrał');
  return {
    nowy: l.createdAt || '',
    kontakt: l.firstCallAt || old.kontakt || '',
    prezentacja: l.presentationAt || '',
    spotkanie: old.spotkanie || (meetHist ? String(meetHist.at).slice(0, 10) : ''),
    umowa: old.umowa || (l.status === 'pozyskany' ? (l.updatedTs || '').slice(0, 10) : '')
  };
}
const stageIdx = l => { const d = stageDatesOf(l); return ((d.umowa && l.status !== 'czeka_umowa') || l.status === 'pozyskany') ? 4 : (d.spotkanie || l.status === 'czeka_umowa' || l.contractSentAt) ? 3 : d.prezentacja ? 2 : d.kontakt ? 1 : 0; };
const isOpen = l => !CLOSED.has(l.status);
const isWon = l => l.status === 'pozyskany' || (!!(l.stageDates || {}).umowa && l.status !== 'czeka_umowa');
const lastContact = l => {
  const h = (l.history || []).filter(x => x.type !== 'system').map(x => x.at).sort();
  return h.length ? h[h.length - 1] : null;
};
const leadAgeDays = l => l.createdAt ? daysBetween(parseD(l.createdAt), new Date()) : null;

function newLead(data = {}) {
  const now = new Date().toISOString();
  const today = todayISO();
  return {
    id: uid('l'), name: '', company: '', phone: '', email: '', city: '', region: '', source: 'meta', ownerId: '',
    status: 'do_kontaktu', capital: '', model: 'franczyza', pkg: '', hasPremises: '', form: 'panstwo',
    nextTask: 'Pierwsza rozmowa telefoniczna', nextTaskDate: today, nextTaskTime: '', firstCallAt: '', presentationAt: '',
    meetingAt: '', meetingType: '', meetingPlace: '',
    notes: '', lostReason: '', handoffs: [], history: [], stageDates: {},
    createdAt: today, createdTs: now, updatedTs: now, ...data
  };
}
function histEntry(type, text, extra = {}) {
  return { id: uid('h'), at: nowLocal(), type, text, by: extra.by || '', result: extra.result || '', auto: true };
}
function setWon(lead) {
  const hist = (lead.history || []).slice();
  hist.push(histEntry('system', 'Umowa podpisana – status „Pozyskany”'));
  return patch('leads', lead.id, { status: 'pozyskany', stageDates: { ...(lead.stageDates || {}), umowa: (lead.stageDates || {}).umowa || todayISO() }, history: hist, updatedTs: new Date().toISOString() });
}

/* filtry globalne */
function periodRange(period, plan) {
  const now = new Date();
  const end = addDays(parseD(todayISO()), 1);
  if (period === 'plan' || period === '90') return [addDays(end, -90), end, 'ostatnie 90 dni'];
  if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1), 'bieżący miesiąc'];
  if (period === '30') return [addDays(end, -30), end, 'ostatnie 30 dni'];
  if (period === '7') return [addDays(end, -7), end, 'ostatnie 7 dni'];
  return [new Date(2000, 0, 1), new Date(2100, 0, 1), 'cały okres'];
}
function matchStatus(l, st) {
  if (!st) return true;
  if (st === 'aktywne') return isOpen(l);
  if (st.startsWith('etap:')) return STAGES[stageIdx(l)].k === st.slice(5);
  if (st.startsWith('st:')) return l.status === st.slice(3);
  return true;
}
function matchQ(l, q) {
  if (!q) return true;
  const hay = [l.name, l.company, l.city, l.email, l.phone, l.notes, leadCode(l.id)].join(' ').toLowerCase();
  return q.toLowerCase().split(/\s+/).every(t => hay.includes(t));
}
function filterLeads(arr, f = S.f) {
  return arr.filter(l =>
    (!f.source || l.source === f.source) &&
    (!f.owner || (f.owner === '_none' ? !l.ownerId : l.ownerId === f.owner)) &&
    (!f.region || l.region === f.region) &&
    (!f.model || modelOf(l) === f.model) &&
    (!f.ids || f.ids.includes(l.id)) &&
    matchStatus(l, f.status) && matchQ(l, f.q));
}
const filtersActive = () => !!(S.f.source || S.f.owner || S.f.region || S.f.status || S.f.model || S.f.q || S.f.ids);
const myMemberId = () => { if (!S.userId) return ''; const m = Object.values(D().team).find(x => x.userId === S.userId); return m ? m.id : ''; };
const goal = () => +(settings().goal ?? 2.5) || 2.5;

/* ---------- model planu ---------- */
function cumConv(conv) { const p = [1]; for (let i = 0; i < NS - 1; i++) p.push(p[i] * (+conv[i] || 0)); return p; }
function winProbFrom(idx, conv) { let p = 1; for (let i = idx; i < NS - 1; i++) p *= (+conv[i] || 0); return p; }
function lagWeights(days, n = 6) {
  days = Math.max(1, +days || 60);
  const sd = Math.max(7, days * 0.45);
  const cdf = x => 0.5 * (1 + erf((x - days) / (sd * Math.SQRT2)));
  const w = [];
  for (let k = 0; k < n; k++) w.push(cdf(30 * (k + 1)) - cdf(30 * k));
  w[0] += cdf(0);
  return w;
}
function computePlan(plan) {
  const budget = +plan.budget || 0;
  const conv = (plan.conv && plan.conv.length === NS - 1) ? plan.conv.map(Number) : DEFAULT_CONV;
  const rows = SOURCES.map(s => {
    const share = +((plan.mix || {})[s.k]) || 0;
    const cpl = +((plan.cpl || {})[s.k]) || s.cpl;
    const spend = budget * share / 100;
    return { k: s.k, n: s.n, share, cpl, spend, leads: cpl > 0 ? spend / cpl : 0 };
  });
  const mixSum = sum(rows, r => r.share);
  const leads = sum(rows, r => r.leads);
  const p = cumConv(conv);
  const overall = p[NS - 1];
  const points = leads * overall;
  const cplBlend = leads > 0 ? budget / leads : null;
  const cac = points > 0 ? budget / points : null;
  const target = +plan.target || 0;
  const reqLeads = overall > 0 ? target / overall : null;
  const reqBudget = reqLeads && cplBlend ? reqLeads * cplBlend : null;
  const cycle = +plan.cycleDays || 60;
  const wWin = lagWeights(cycle), wMeet = lagWeights(cycle * 0.3), wLoc = lagWeights(cycle * 0.55);
  const ramp = [0.8, 1, 1];
  const months = [0, 1, 2].map(m => {
    let pts = 0, meet = 0, loc = 0;
    for (let j = 0; j <= m; j++) {
      const L = leads * ramp[j];
      pts += L * overall * wWin[m - j]; meet += L * p[3] * wMeet[m - j]; loc += L * p[2] * wLoc[m - j];
    }
    return { leads: leads * ramp[m], meetings: meet, analyses: loc, points: pts, spend: budget };
  });
  return { rows, mixSum, leads, p, overall, points, cplBlend, cac, target, reqLeads, reqBudget, months, conv, budget, cycle, stageCounts: p.map(x => x * leads) };
}
function planWindows(plan) {
  const s = parseD(plan.startDate) || parseD(todayISO());
  return [0, 1, 2].map(m => [addDays(s, m * 30), addDays(s, (m + 1) * 30)]);
}

/* ---------- metryki wykonania ---------- */
function actualsFor(leads, spend, a, b) {
  return {
    leads: leads.filter(l => inRange(l.createdAt, a, b)).length,
    meetings: leads.filter(l => inRange(stageDatesOf(l).spotkanie, a, b)).length,
    analyses: leads.filter(l => inRange(stageDatesOf(l).lokalizacja, a, b)).length,
    points: leads.filter(l => inRange(stageDatesOf(l).umowa, a, b)).length,
    spend: sum(spend.filter(x => inRange(x.date, a, b)), x => x.amount)
  };
}
function funnelOf(cohort) {
  const reached = STAGES.map((s, i) => cohort.filter(l => stageIdx(l) >= i).length);
  const conv = reached.slice(0, NS - 1).map((r, i) => r > 0 ? reached[i + 1] / r : null);
  return { reached, conv };
}
function filteredSpend(f = S.f) {
  return Object.values(D().spend).filter(x => !f.source || x.source === f.source);
}
/* prognoza: lejek otwartych leadów + nowe leady z planu */
function forecast(plan, leads, lpm = null) {
  const c = computePlan(plan);
  if (lpm != null) c.leads = lpm;
  const buckets = [0, 0, 0];
  const pipeByStage = STAGES.map(() => ({ n: 0, exp: 0 }));
  leads.filter(isOpen).forEach(l => {
    const i = stageIdx(l);
    if (i >= NS - 1) return;
    const pw = winProbFrom(i, c.conv);
    const progress = i / (NS - 1);
    const remaining = Math.max(10, c.cycle * (1 - progress * 0.9));
    const w = lagWeights(remaining, 3);
    w.forEach((x, k) => { buckets[k] += pw * x; });
    pipeByStage[i].n++; pipeByStage[i].exp += pw * sum(w);
  });
  const wWin = lagWeights(c.cycle, 3);
  const fromNew = [0, 0, 0];
  for (let m = 0; m < 3; m++) for (let j = 0; j <= m; j++) fromNew[m] += c.leads * c.overall * wWin[m - j];
  return { pipeline: buckets, fromNew, total: buckets.map((x, i) => x + fromNew[i]), pipeByStage };
}

/* ---------- szkolenie wstępne (3 dni robocze w centrali) ---------- */
function addWorkDays(iso, n) { let d = parseD(iso); if (!d) return ''; let k = 0; while (k < n) { d = addDays(d, 1); const wd = d.getDay(); if (wd !== 0 && wd !== 6) k++; } return isoDate(d); }
function nextMonday() { const d = new Date(); const add = ((8 - d.getDay()) % 7) || 7; return isoDate(addDays(d, add)); }
const trainingEnd = start => start ? addWorkDays(start, 2) : '';
/* ---------- NIP ---------- */
const nipDigits = v => String(v || '').replace(/\D/g, '');
function nipValid(v) { const d = nipDigits(v); if (d.length !== 10) return false; const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]; const s = w.reduce((a, x, i) => a + x * +d[i], 0) % 11; return s !== 10 && s === +d[9]; }
const nipFmt = v => { const d = nipDigits(v); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8)}` : v; };

/* w historii pokazujemy tylko wpisy napisane przez człowieka */
const isManualEntry = h => h.manual || (!h.auto && h.type !== 'system' && String(h.text || '').trim() && !/^(Wysłano|Ponownie wysłano|SMS z podziękowaniem|Wykonano:|Rozmowa wg skryptu)/.test(h.text));


/* wzory umów zapisane w panelu (pliki PDF do pobrania i dołączenia do maila) */
const CONTRACT_FILES = {
  franczyza: [
    { id: '3797b8cb458ca45c42fffd6557d59633', file: 'Umowa_Franczyzowa_ShipCenter.pdf', n: 'Umowa franczyzowa (PDF)' },
    { id: '077e5a73ee486d69409072b9661af6bd', file: 'OWU_ShipCenter.pdf', n: 'OWU (PDF)' }
  ],
  shippoint: [
    { id: '10b7bbd10aa752e1459f59e2cc25d9b4', file: 'Umowa_Partnerska_ShipCenter.pdf', n: 'Umowa Partnerska (PDF)' }
  ]
};
const contractFilesFor = l => CONTRACT_FILES[modelOf(l) === 'shippoint' ? 'shippoint' : 'franczyza'];
async function downloadContract(id) {
  const f = Object.values(CONTRACT_FILES).flat().find(x => x.id === id); if (!f) return;
  try {
    const r = await fetch('/_blob/' + f.id);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    await offerDownload(f.file, new Uint8Array(buf));
  } catch (e) { toast('Nie udało się pobrać pliku ' + f.file + ' (' + e.message + ')', 'bad'); }
}

/* Google Meet: stały pokój opiekuna albo domyślny z ustawień */
function meetLinkFor(l) {
  const m = (l && l.ownerId && D().team[l.ownerId]) || (myMemberId() && D().team[myMemberId()]) || null;
  return (m && m.meetLink) || offer().linkMeet || '';
}

/* pakiet FLEX – sprzęt jak w kalkulatorze shipcenter.pl/franczyza/kalkulator */
const FLEX_GROUPS = [
  { k: 'meble', n: 'Meble', one: true, items: [
    { id: 'meble1', n: 'Meble – 1 stanowisko', d: 'Biurko, regał niski, regał wysoki, krzesła wg standardu', p: 1990 },
    { id: 'meble2', n: 'Meble – 2 stanowiska', d: '2 biurka, regał niski, regał wysoki, krzesła wg standardu', p: 2690 }] },
  { k: 'komputer', n: 'Komputer', one: true, items: [
    { id: 'pc_aio', n: 'Komputer AllInOne', d: 'Ekran 23–24", 8 GB RAM, SSD 512 GB, Windows 11', p: 2790 },
    { id: 'pc_lease', n: 'Komputer – zestaw poleasingowy', d: 'Sprawdzony zestaw zgodny ze standardem ShipCenter', p: 1990 }] },
  { k: 'urzadzenia', n: 'Urządzenia', items: [
    { id: 'laser', n: 'Drukarka laserowa A4', d: 'Laserowa, czarno-biała', p: 690 },
    { id: 'thermal', n: 'Drukarka termiczna', d: 'Etykiety 100 × 150 mm, min. 203 dpi', p: 690 },
    { id: 'scanner', n: 'Skaner do kodów kreskowych', d: 'Kody 1D i 2D, również z ekranów telefonów', p: 249 },
    { id: 'stamps', n: 'Maszynka do pieczątek', d: 'Dodatkowe źródło przychodu w punkcie', p: 3990 }] },
  { k: 'marketing', n: 'Marketing i widoczność', items: [
    { id: 'flag', n: 'Flaga reklamowa', d: 'Widoczność punktu z ulicy', p: 349 },
    { id: 'ads', n: 'Kampania reklamowa FB + Google Ads', d: 'Start z promocją prowadzoną przez centralę', p: 2990 }] }
];
const FLEX_ITEMS = FLEX_GROUPS.flatMap(g => g.items.map(it => ({ ...it, g: g.k })));
const FLEX_TIERS = [{ min: 1, max: 2, pct: 0 }, { min: 3, max: 4, pct: 5 }, { min: 5, max: 6, pct: 10 }, { min: 7, max: 99, pct: 15 }];
const smartPriceOf = l => (l && +l.smartPrice > 0) ? +l.smartPrice : (+offer().licencja || 0);
function flexCalc(ids, smartOverride) {
  const items = FLEX_ITEMS.filter(it => (ids || []).includes(it.id));
  const n = items.length;
  const tier = FLEX_TIERS.find(t => n >= t.min && n <= t.max) || { pct: 0 };
  const gross = items.reduce((s, it) => s + it.p, 0);
  const disc = Math.round(gross * tier.pct) / 100;
  const smart = +smartOverride > 0 ? +smartOverride : (+offer().licencja || 0);
  const next = FLEX_TIERS.find(t => t.min > n && t.pct > tier.pct);
  const net = smart + gross - disc;
  return { items, n, pct: tier.pct, gross, disc, after: gross - disc, smart, net, brutto: Math.round(net * 123) / 100, next: next ? { need: next.min - n, pct: next.pct } : null };
}

/* usuwanie leadów: tylko administrator (właściciel panelu) albo po haśle administratora */
const isAdmin = () => S.demo || S.mode === 'local' || S.isOwner === true;
async function passHash(p) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shipcenter-panel:' + p));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* numer telefonu zawsze w formacie +48 600 100 200 */
function fmtPhone(p) {
  const raw = String(p || '').trim(); if (!raw) return '';
  let d = raw.replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = '+' + d.slice(2);
  if (/^\d{9}$/.test(d)) d = '+48' + d;
  if (/^48\d{9}$/.test(d)) d = '+' + d;
  const m = d.match(/^\+48(\d{3})(\d{3})(\d{3})$/);
  if (m) return `+48 ${m[1]} ${m[2]} ${m[3]}`;
  return raw;
}
const telHref = p => 'tel:' + fmtPhone(p).replace(/\s/g, '');
function phoneChip(l, { copy = true } = {}) {
  if (!l.phone) return '';
  const f = fmtPhone(l.phone);
  return `<a class="phonechip" href="${esc(telHref(l.phone))}" title="Zadzwoń">${ICONS.tel}<span>${esc(f)}</span></a>${copy ? `<button class="btn sm ghost" data-act="copy" data-text="${esc(f)}" title="Kopiuj numer">${ICONS.copy}Kopiuj</button>` : ''}`;
}
