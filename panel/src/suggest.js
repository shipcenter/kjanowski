/* ===== Podpowiedzi adresów przy wpisywaniu =====
   Miejscowości: zbiór 44 tys. miejscowości (TERYT, CC BY) z województwem, powiatem i gminą – od razu, bez internetu.
   Ulice: Google Places przez mostek „ShipCenter Poczta” (address_suggest / address_details),
   a bez mostka – podpowiedź Claude (nazwy ulic w danej miejscowości). */

const GEO_ASSET = '/_blob/5f462bdff9cfae9bbde779c3081a7ae1';
const SUG = { data: null, loading: null, el: null, items: [], idx: -1, seq: 0, session: '' };
const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');

function geoLoad() {
  if (SUG.data) return Promise.resolve(SUG.data);
  if (typeof GEO_DATA !== 'undefined' && GEO_DATA && GEO_DATA.e) { const j = GEO_DATA; j.n = j.e.map(e => normTxt(e[0])); SUG.data = j; return Promise.resolve(j); }
  if (!SUG.loading) SUG.loading = fetch(GEO_ASSET).then(r => r.ok ? r.json() : null).then(j => {
    if (!j) return null;
    j.n = j.e.map(e => normTxt(e[0]));
    SUG.data = j; return j;
  }).catch(() => null);
  return SUG.loading;
}
function geoFind(name, region) {
  const j = SUG.data; if (!j || !name) return null;
  const n = normTxt(name.trim());
  const hits = j.e.map((e, i) => [e, i]).filter(([e, i]) => j.n[i] === n && (!region || j.p[e[1]] === region));
  if (!hits.length) return null;
  hits.sort((a, b) => (b[0][4] === 1) - (a[0][4] === 1) || (b[0][4] === 2) - (a[0][4] === 2));
  const e = hits[0][0];
  return { name: e[0], region: j.p[e[1]], district: j.d[e[2]], commune: j.g[e[3]], city: e[4] === 1 };
}
function citySuggestions(q) {
  const j = SUG.data; if (!j) return [];
  const n = normTxt(q.trim()); if (n.length < 2) return [];
  const out = [];
  for (let i = 0; i < j.e.length && out.length < 400; i++) if (j.n[i].startsWith(n)) out.push(i);
  out.sort((a, b) => {
    const ea = j.e[a], eb = j.e[b];
    const ra = (j.n[a] === n ? 0 : 1) * 10 + (ea[4] === 1 ? 0 : ea[4] === 2 ? 1 : 2), rb = (j.n[b] === n ? 0 : 1) * 10 + (eb[4] === 1 ? 0 : eb[4] === 2 ? 1 : 2);
    return ra - rb || ea[0].length - eb[0].length || ea[0].localeCompare(eb[0], 'pl');
  });
  return out.slice(0, 8).map(i => { const e = j.e[i]; return { kind: 'city', label: e[0], sub: `${e[4] === 1 ? 'miasto' : 'gm. ' + j.g[e[3]]}, pow. ${j.d[e[2]]}, ${j.p[e[1]]}`, name: e[0], region: j.p[e[1]], district: j.d[e[2]], commune: j.g[e[3]] }; });
}
async function streetSuggestions(q, city) {
  if (q.trim().length < 3) return [];
  if (typeof mailOn === 'function' && mailOn()) {
    try {
      if (!SUG.session) SUG.session = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const r = await mailCall('address_suggest', { input: q + (city ? ', ' + city : ''), session: SUG.session });
      return ((r && r.items) || []).slice(0, 6).map(x => ({ kind: 'place', label: x.main || x.text, sub: x.secondary || '', placeId: x.placeId }));
    } catch (e) { /* mostek bez narzędzia adresowego – próbujemy dalej */ }
  }
  if (S.sample && city) {
    try {
      const r = await S.sample.json(`Podaj do 6 istniejących nazw ulic w miejscowości ${city} (Polska), które zaczynają się od lub zawierają „${q.replace(/\d.*$/, '').trim()}”. Zwróć wyłącznie tablicę JSON z nazwami ulic, np. ["ul. Piłsudskiego", "al. Piłsudskiego"]. Jeśli nie znasz, zwróć [].`, { modelTier: 'quick' });
      const num = (q.match(/\d+[a-zA-Z]?(\/\d+)?\s*$/) || [''])[0];
      return (Array.isArray(r) ? r : []).slice(0, 6).map(s => ({ kind: 'street', label: String(s).replace(/^(ul\.|ulica)\s+/i, '') + (num ? ' ' + num : ''), sub: city }));
    } catch (e) { return []; }
  }
  return [];
}

/* pola adresowe w danym kontekście: lf/le (lead), lo (analiza lokalizacji) */
function sugFields(ctx) {
  if (ctx === 'lo') return { street: 'lo-address', city: 'lo-city', postal: 'lo-postal', region: 'lo-region' };
  return { street: ctx + '-pointAddress', city: ctx + '-city', postal: ctx + '-pointPostal', region: ctx + '-region' };
}
function setField(id, v, { onlyEmpty = false } = {}) {
  const el = document.getElementById(id); if (!el || v == null || v === '') return;
  if (onlyEmpty && el.value.trim()) return;
  if (el.value === v) return;
  el.value = v;
  if (el.tagName === 'SELECT') { el.dataset.auto = '1'; el.dataset.prog = '1'; }
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function sugBox() {
  let b = document.getElementById('sugbox');
  if (!b) { b = document.createElement('div'); b.id = 'sugbox'; b.className = 'sugbox'; b.setAttribute('role', 'listbox'); document.body.appendChild(b); }
  return b;
}
function sugHide() { const b = document.getElementById('sugbox'); if (b) b.hidden = true; SUG.items = []; SUG.idx = -1; SUG.el = null; }
function sugShow(el, items) {
  SUG.el = el.id; SUG.items = items; SUG.idx = -1;
  const b = sugBox();
  if (!items.length) { b.hidden = true; return; }
  const r = el.getBoundingClientRect();
  b.style.left = r.left + 'px'; b.style.top = (r.bottom + 4) + 'px'; b.style.width = Math.max(r.width, 280) + 'px';
  b.innerHTML = items.map((it, i) => `<div class="sugitem" role="option" data-sug-i="${i}"><b>${esc(it.label)}</b>${it.sub ? `<span>${esc(it.sub)}</span>` : ''}</div>`).join('');
  b.hidden = false;
  b.querySelectorAll('[data-sug-i]').forEach(x => x.onmousedown = e => { e.preventDefault(); sugPick(+x.dataset.sugI); });
}
function sugMark() { const b = document.getElementById('sugbox'); if (!b) return; b.querySelectorAll('.sugitem').forEach((x, i) => x.classList.toggle('on', i === SUG.idx)); }

async function sugInput(el) {
  const kind = el.dataset.suggest, ctx = el.dataset.suggestCtx;
  const seq = ++SUG.seq;
  let items = [];
  if (kind === 'city') { await geoLoad(); items = citySuggestions(el.value); }
  else if (kind === 'street') {
    const f = sugFields(ctx); const city = ((document.getElementById(f.city) || {}).value || '').trim();
    if (el.value.trim().length < 3) { sugHide(); return; }
    const canGoogle = typeof mailOn === 'function' && mailOn();
    if (!canGoogle && !city) { sugShow(el, [{ kind: 'info', label: 'Najpierw wpisz miejscowość', sub: 'podpowiem ulice w tej miejscowości' }]); return; }
    if (!canGoogle && !S.sample) { sugShow(el, [{ kind: 'info', label: 'Podpowiedzi ulic są niedostępne w tym widoku', sub: 'pełne podpowiedzi Google ruszą po podłączeniu mostka pocztowego' }]); return; }
    const key = normTxt(city + '|' + el.value.trim());
    SUG.cache = SUG.cache || {};
    if (SUG.cache[key]) items = SUG.cache[key];
    else {
      sugShow(el, [{ kind: 'info', label: 'Szukam ulic…', sub: canGoogle ? 'Google' : 'podpowiedź Claude' }]);
      items = await streetSuggestions(el.value, city);
      if (items.length) SUG.cache[key] = items;
      else items = [{ kind: 'info', label: 'Brak podpowiedzi', sub: 'wpisz adres ręcznie' }];
    }
  }
  if (seq !== SUG.seq || document.activeElement !== el) return;
  sugShow(el, items);
}
async function sugPick(i) {
  const it = SUG.items[i]; const el = document.getElementById(SUG.el); if (!it || !el || it.kind === 'info') return sugHide();
  const ctx = el.dataset.suggestCtx, f = sugFields(ctx);
  sugHide();
  if (it.kind === 'city') {
    setField(f.city, it.name);
    setField(f.region, it.region);
  } else if (it.kind === 'place') {
    try {
      const d = await mailCall('address_details', { placeId: it.placeId, session: SUG.session });
      SUG.session = '';
      setField(f.street, [d.street, d.number].filter(Boolean).join(' ') || it.label);
      if (d.city) setField(f.city, d.city);
      if (d.postalCode) setField(f.postal, d.postalCode);
      if (d.region) setField(f.region, d.region);
    } catch (e) { setField(f.street, it.label); }
  } else {
    setField(f.street, it.label);
  }
}

/* zdarzenia (podpinane w main.js) */
function sugOnInput(el) { debounce('sug', () => sugInput(el), el.dataset.suggest === 'city' ? 80 : 400); }
function sugOnKey(e) {
  const b = document.getElementById('sugbox');
  if (!b || b.hidden || !SUG.items.length || !e.target.dataset || !e.target.dataset.suggest) return false;
  if (e.key === 'ArrowDown') { SUG.idx = (SUG.idx + 1) % SUG.items.length; sugMark(); e.preventDefault(); return true; }
  if (e.key === 'ArrowUp') { SUG.idx = (SUG.idx - 1 + SUG.items.length) % SUG.items.length; sugMark(); e.preventDefault(); return true; }
  if (e.key === 'Enter' && SUG.idx >= 0) { e.preventDefault(); sugPick(SUG.idx); return true; }
  if (e.key === 'Escape') { sugHide(); return true; }
  return false;
}
