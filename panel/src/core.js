/* ===== Ship Center – rekrutacja franczyzobiorców: rdzeń (stałe, stan, zapis, obliczenia) ===== */
'use strict';

const STAGES = [
  { k: 'nowy', n: 'Nowy lead', short: 'Nowy' },
  { k: 'kontakt', n: 'Pierwszy kontakt', short: 'Kontakt' },
  { k: 'kwalifikacja', n: 'Kwalifikacja', short: 'Kwalif.' },
  { k: 'spotkanie', n: 'Spotkanie / prezentacja', short: 'Spotkanie' },
  { k: 'lokalizacja', n: 'Analiza lokalizacji', short: 'Lokalizacja' },
  { k: 'oferta', n: 'Oferta i negocjacje', short: 'Oferta' },
  { k: 'umowa', n: 'Umowa podpisana', short: 'Umowa' }
];
const STAGE_IDX = Object.fromEntries(STAGES.map((s, i) => [s.k, i]));
const CONV_LABELS = ['Lead → kontakt', 'Kontakt → kwalifikacja', 'Kwalifikacja → spotkanie', 'Spotkanie → analiza lokalizacji', 'Analiza → oferta', 'Oferta → umowa'];

const STATUSES = [
  { k: 'do_kontaktu', n: 'Do kontaktu', tone: 'acc' },
  { k: 'proba', n: 'Brak odpowiedzi', tone: 'warn' },
  { k: 'w_kontakcie', n: 'W kontakcie', tone: '' },
  { k: 'czeka', n: 'Czeka na decyzję', tone: '' },
  { k: 'umowione', n: 'Spotkanie umówione', tone: 'acc' },
  { k: 'wstrzymany', n: 'Wstrzymany', tone: 'outline' },
  { k: 'utracony', n: 'Utracony', tone: 'bad' },
  { k: 'pozyskany', n: 'Pozyskany', tone: 'good' }
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
  { k: 'punkt', n: 'Punkt stacjonarny (franczyza)' },
  { k: 'bez_punktu', n: 'Franczyza bez punktu' },
  { k: 'partner', n: 'Partner – Ship Center Point' }
];
const CONTACT_TYPES = [
  { k: 'tel', n: 'Telefon' }, { k: 'email', n: 'E-mail' }, { k: 'sms', n: 'SMS' },
  { k: 'spotkanie', n: 'Spotkanie' }, { k: 'webinar', n: 'Webinar' }, { k: 'notatka', n: 'Notatka' },
  { k: 'system', n: 'Zmiana w systemie' }
];
const CT_MAP = Object.fromEntries(CONTACT_TYPES.map(c => [c.k, c]));
const ROLES = ['Centrala – dyrektor rozwoju', 'Opiekun regionalny', 'Analityk lokalizacji', 'Marketing', 'Inna rola'];
const STREAMS = { mkt: 'Marketing', sprz: 'Sprzedaż', lok: 'Lokalizacje', anl: 'Analityka' };
const STREAM_COLOR = { mkt: '--s2', sprz: '--s1', lok: '--s3', anl: '--s7' };

const DEFAULT_CONV = [0.65, 0.40, 0.45, 0.60, 0.55, 0.45];
const DEFAULT_MIX = { meta: 35, google: 20, portale: 15, linkedin: 5, polecenia: 8, targi: 5, www: 4, webinar: 4, outbound: 4, inne: 0 };

const DEFAULT_OFFER = {
  licencja: 12000, oplataMies: 199, prowizjaP24: 1.5, progRabatu: 600,
  licencjaBezPunktu: 5000, partnerWstepna: 299, partnerMies: 19.99,
  szkolenie: '3–4 dni w siedzibie Ship Center w Katowicach',
  uruchomienie: 'do 1 miesiąca od podpisania umowy',
  ochrona: 3, godziny: '5 dni w tygodniu, w godz. 7:00–19:00 (min. 7 godz. dziennie)',
  minPaczek: 100, przewoznicy: 'InPost, DPD, DHL, UPS, FedEx, GLS, Poczta Polska (Pocztex), ORLEN Paczka, Ambro Express',
  email: 'franczyza@shipcenter.pl', telefon: '+48 32 785 05 55', www: 'shipcenter.pl',
  adres: 'ul. Gliwicka 51, 40-853 Katowice', linkSpotkanie: '', linkWebinar: ''
};

/* ---------- utils ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (+f(x) || 0), 0);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nf0 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
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
const COLS = ['leads', 'team', 'plans', 'tasks', 'spend', 'locations'];
const emptyData = () => ({ leads: {}, team: {}, plans: {}, tasks: {}, spend: {}, locations: {}, settings: {} });
const store = { live: emptyData(), demo: null };
const S = {
  db: null, mode: 'loading', demo: false, readonly: false, slow: false,
  confirmed: new Set(), pending: 0, sample: null, downloads: null,
  route: { view: 'centrala', id: null },
  f: { period: 'plan', source: '', owner: '', region: '', status: '', q: '' },
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
}
const isLoading = () => S.mode === 'loading' || (S.mode === 'live' && !S.demo && S.confirmed.size < 3 && !S.slow);

/* ---------- logika leadów ---------- */
const stageIdx = l => STAGE_IDX[l.stage] ?? 0;
const isOpen = l => !CLOSED.has(l.status);
const isWon = l => l.stage === 'umowa' || l.status === 'pozyskany';
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
    stage: 'nowy', status: 'do_kontaktu', capital: '', model: 'punkt', hasPremises: '', form: 'panstwo',
    nextTask: 'Pierwszy kontakt telefoniczny', nextTaskDate: today, meetingAt: '', meetingType: '', meetingPlace: '',
    notes: '', lostReason: '', handoffs: [], history: [], stageDates: { nowy: today },
    createdAt: today, createdTs: now, updatedTs: now, ...data
  };
}
function histEntry(type, text, extra = {}) {
  return { id: uid('h'), at: nowLocal(), type, text, by: extra.by || '', result: extra.result || '' };
}
function setStage(lead, k, opts = {}) {
  const idx = STAGE_IDX[k];
  const sd = { ...(lead.stageDates || {}) };
  const today = todayISO();
  for (let i = 0; i <= idx; i++) if (!sd[STAGES[i].k]) sd[STAGES[i].k] = today;
  const p = { stage: k, stageDates: sd, updatedTs: new Date().toISOString() };
  if (k === 'umowa') p.status = 'pozyskany';
  else if (lead.status === 'pozyskany') p.status = 'w_kontakcie';
  if (k === 'kontakt' && lead.status === 'do_kontaktu') p.status = 'w_kontakcie';
  const hist = (lead.history || []).slice();
  hist.push(histEntry('system', `Etap: ${STAGES[stageIdx(lead)].n} → ${STAGES[idx].n}`));
  p.history = hist;
  return patch('leads', lead.id, p);
}

/* filtry globalne */
function periodRange(period, plan) {
  const now = new Date();
  const end = addDays(parseD(todayISO()), 1);
  if (period === 'plan') { const s = parseD(plan.startDate) || parseD(todayISO()); return [s, addDays(s, 90), '90 dni planu']; }
  if (period === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1), 'bieżący miesiąc'];
  if (period === '30') return [addDays(end, -30), end, 'ostatnie 30 dni'];
  if (period === '7') return [addDays(end, -7), end, 'ostatnie 7 dni'];
  return [new Date(2000, 0, 1), new Date(2100, 0, 1), 'cały okres'];
}
function matchStatus(l, st) {
  if (!st) return true;
  if (st === 'aktywne') return isOpen(l);
  if (st.startsWith('etap:')) return l.stage === st.slice(5);
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
    (!f.ids || f.ids.includes(l.id)) &&
    matchStatus(l, f.status) && matchQ(l, f.q));
}
const filtersActive = () => !!(S.f.source || S.f.owner || S.f.region || S.f.status || S.f.q || S.f.ids);

/* ---------- model planu ---------- */
function cumConv(conv) { const p = [1]; for (let i = 0; i < 6; i++) p.push(p[i] * (+conv[i] || 0)); return p; }
function winProbFrom(idx, conv) { let p = 1; for (let i = idx; i < 6; i++) p *= (+conv[i] || 0); return p; }
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
  const conv = (plan.conv && plan.conv.length === 6) ? plan.conv.map(Number) : DEFAULT_CONV;
  const rows = SOURCES.map(s => {
    const share = +((plan.mix || {})[s.k]) || 0;
    const cpl = +((plan.cpl || {})[s.k]) || s.cpl;
    const spend = budget * share / 100;
    return { k: s.k, n: s.n, share, cpl, spend, leads: cpl > 0 ? spend / cpl : 0 };
  });
  const mixSum = sum(rows, r => r.share);
  const leads = sum(rows, r => r.leads);
  const p = cumConv(conv);
  const overall = p[6];
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
      pts += L * overall * wWin[m - j]; meet += L * p[3] * wMeet[m - j]; loc += L * p[4] * wLoc[m - j];
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
    meetings: leads.filter(l => inRange((l.stageDates || {}).spotkanie, a, b)).length,
    analyses: leads.filter(l => inRange((l.stageDates || {}).lokalizacja, a, b)).length,
    points: leads.filter(l => inRange((l.stageDates || {}).umowa, a, b)).length,
    spend: sum(spend.filter(x => inRange(x.date, a, b)), x => x.amount)
  };
}
function funnelOf(cohort) {
  const reached = STAGES.map((s, i) => cohort.filter(l => stageIdx(l) >= i).length);
  const conv = reached.slice(0, 6).map((r, i) => r > 0 ? reached[i + 1] / r : null);
  return { reached, conv };
}
function filteredSpend(f = S.f) {
  return Object.values(D().spend).filter(x => !f.source || x.source === f.source);
}
/* prognoza: lejek otwartych leadów + nowe leady z planu */
function forecast(plan, leads) {
  const c = computePlan(plan);
  const buckets = [0, 0, 0];
  const pipeByStage = STAGES.map(() => ({ n: 0, exp: 0 }));
  leads.filter(isOpen).forEach(l => {
    const i = stageIdx(l);
    if (i >= 6) return;
    const pw = winProbFrom(i, c.conv);
    const progress = c.p[i] > 0 ? i / 6 : 0;
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
