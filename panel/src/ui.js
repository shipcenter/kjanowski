/* ===== Powłoka aplikacji: routing, renderowanie, modale, wykresy ===== */

const VIEWS = {
  centrala: { n: 'Centrala', render: () => viewDashboard() },
  leady: { n: 'Leady', render: () => viewLeads() },
  kontakty: { n: 'Kontakty', render: () => viewContacts() },
  wiadomosci: { n: 'Wiadomości i skrypty', render: () => viewMessages() },
  poczta: { n: 'Poczta', render: () => viewMail(null) },
  lokalizacje: { n: 'Lokalizacje', render: () => viewLocations() },
  ustawienia: { n: 'Zespół i ustawienia', render: () => viewSettings() }
};
const NAV_ORDER = ['centrala', 'kontakty', 'leady', 'poczta', 'wiadomosci', 'lokalizacje', 'ustawienia'];

function parseRoute() {
  const h = (location.hash || '').replace(/^#/, '');
  if (h.startsWith('lead-')) return { view: 'lead', id: h.slice(5) };
  if (h.startsWith('lok-')) return { view: 'lok', id: h.slice(4) };
  if (h.startsWith('raport-')) return { view: 'raport', id: h.slice(7) };
  if (h.startsWith('poczta-')) return { view: 'poczta', id: h.slice(7) };
  if (h === 'zadania') return { view: 'kontakty', id: null };
  if (VIEWS[h]) return { view: h, id: null };
  return { view: 'centrala', id: null };
}
function go(hash) { if (location.hash === '#' + hash) { S.route = parseRoute(); scheduleRender(); } else location.hash = hash; }
window.addEventListener('hashchange', () => { S.route = parseRoute(); S.selected.clear(); scheduleRender(); window.scrollTo(0, 0); });

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}
function render() {
  const app = $('#app');
  if (!app) return;
  // zachowaj fokus i wpisywany tekst
  const ae = document.activeElement;
  let keep = null;
  if (ae && ae.id && app.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) {
    keep = { id: ae.id, value: ae.value, ss: ae.selectionStart, se: ae.selectionEnd, type: ae.type };
  }
  renderChrome();
  const r = S.route;
  let html;
  try {
    if (r.view === 'lead') html = viewLead(r.id);
    else if (r.view === 'lok') html = viewLocationEditor(r.id);
    else if (r.view === 'raport') html = viewReport(r.id);
    else if (r.view === 'poczta') html = viewMail(r.id);
    else html = VIEWS[r.view].render();
  } catch (e) {
    console.error(e);
    html = `<div class="card"><h2>Coś poszło nie tak przy wyświetlaniu widoku</h2><p class="muted">${esc(e.message)}</p></div>`;
  }
  $('#view').innerHTML = html;
  afterRender();
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) {
      if (el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'file' && el.tagName !== 'SELECT') el.value = keep.value;
      el.focus({ preventScroll: true });
      try { if (keep.ss != null && el.setSelectionRange) el.setSelectionRange(keep.ss, keep.se); } catch (e) { }
    }
  }
}
function renderSync() {
  const el = $('#sync');
  if (!el) return;
  let cls = '', txt = '';
  if (S.demo) { cls = 'busy'; txt = 'Podgląd – dane przykładowe'; }
  else if (S.mode === 'loading') { cls = 'busy'; txt = 'Łączenie z bazą…'; }
  else if (S.mode === 'local') { cls = 'off'; txt = 'Tryb lokalny – bez zapisu'; }
  else if (S.readonly) { cls = 'off'; txt = 'Tylko do odczytu'; }
  else if (S.pending > 0) { cls = 'busy'; txt = 'Zapisywanie…'; }
  else if (S.slow && S.confirmed.size < COLS.length) { cls = 'off'; txt = 'Brak odpowiedzi bazy'; }
  else { cls = 'ok'; txt = 'Zapisano we wspólnej bazie'; }
  el.className = 'syncstate ' + cls;
  el.innerHTML = `<span class="dot"></span><span>${txt}</span>`;
}
function renderChrome() {
  const cur = S.route.view === 'lead' ? 'leady' : (S.route.view === 'lok' || S.route.view === 'raport') ? 'lokalizacje' : S.route.view;
  const due = dueContactsCount();
  $('#nav').innerHTML = NAV_ORDER.map(k => `<a href="#${k}" class="${k === cur ? 'on' : ''}">${VIEWS[k].n}${k === 'kontakty' && due ? `<span class="badge" title="Kontakty na dziś i zaległe${myMemberId() ? ' (Twoje)' : ''}">${due}</span>` : ''}</a>`).join('');
  renderSync();
  let b = '';
  if (S.demo) b = `<div class="banner demo"><div class="wrap"><b>Podgląd na danych przykładowych.</b><span>Leady, osoby i liczby są zmyślone, a zmiany nie są nigdzie zapisywane.</span><button class="btn sm" data-act="demo-off">Wróć do prawdziwych danych</button></div></div>`;
  else if (S.mode === 'local') b = `<div class="banner local"><div class="wrap"><b>Brak połączenia ze wspólną bazą.</b><span>Możesz pracować, ale zmiany znikną po zamknięciu strony – przed wyjściem wyeksportuj dane do XLSX. Otwórz panel w claude.ai po zalogowaniu, by zapisywać dane zespołu.</span></div></div>`;
  else if (S.slow && S.confirmed.size < COLS.length) b = `<div class="banner local"><div class="wrap"><b>Baza danych jeszcze nie odpowiada.</b><span>Wyświetlane dane mogą być nieaktualne. Panel spróbuje ponownie sam.</span></div></div>`;
  else if (S.readonly) b = `<div class="banner ro"><div class="wrap"><b>Tylko do odczytu.</b><span>Twoje uprawnienia pozwalają przeglądać dane, ale nie zapisywać zmian. Poproś właściciela panelu o rolę „Contributor” lub wyższą.</span></div></div>`;
  $('#banner').innerHTML = b;
}

/* ---------- toasty i modale ---------- */
function toast(msg, kind = '') {
  const box = $('#toasts');
  if (!box) return;
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => t.remove(), kind === 'bad' ? 6500 : 3200);
}
let modalOnClose = null;
function openModal(html, { wide = false, onClose = null } = {}) {
  const root = $('#modal');
  root.innerHTML = `<div class="modal-bg" data-act="modal-bg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  root.hidden = false;
  modalOnClose = onClose;
  const first = root.querySelector('input:not([type=hidden]):not([type=checkbox]), select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() {
  const root = $('#modal');
  root.hidden = true; root.innerHTML = '';
  if (modalOnClose) { const f = modalOnClose; modalOnClose = null; f(); }
}
function confirmBox(title, text, okLabel, onOk, danger = true) {
  openModal(`<div class="mh"><h2>${esc(title)}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <div class="mb"><p>${text}</p></div>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn ${danger ? 'danger solid' : 'primary'}" id="confirm-ok">${esc(okLabel)}</button></div>`);
  $('#confirm-ok').onclick = () => { closeModal(); onOk(); };
}
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Skopiowano do schowka');
  } catch (e) {
    openModal(`<div class="mh"><h2>Skopiuj tekst</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
      <div class="mb"><p class="small muted">Schowek jest niedostępny w tym widoku. Tekst jest zaznaczony – użyj Ctrl+C (Cmd+C).</p><textarea id="copy-fallback" rows="14">${esc(text)}</textarea></div>
      <div class="mf"><button class="btn" data-act="modal-close">Zamknij</button></div>`);
    setTimeout(() => { const t = $('#copy-fallback'); if (t) { t.focus(); t.select(); } }, 50);
  }
}
async function offerDownload(filename, data, textFallback) {
  if (!S.downloads) {
    if (textFallback != null) {
      openModal(`<div class="mh"><h2>Pobieranie niedostępne w tym widoku</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
      <div class="mb"><p class="small muted">Skopiuj zawartość pliku <b>${esc(filename)}</b> i wklej ją do edytora lub arkusza.</p><textarea id="dl-fallback" rows="14">${esc(textFallback)}</textarea></div>
      <div class="mf"><button class="btn" data-act="modal-close">Zamknij</button><button class="btn primary" id="dl-copy">Kopiuj</button></div>`);
      $('#dl-copy').onclick = () => copyText(textFallback);
    } else toast('Pobieranie plików nie jest dostępne w tym widoku. Otwórz panel w claude.ai.', 'bad');
    return;
  }
  try {
    await S.downloads.save({ filename, data });
    toast('Plik ' + filename + ' zapisany');
  } catch (e) {
    const code = e && e.code;
    if (code === 'declined') return;
    if (code === 'rate_limited') toast('Poprzednie pobieranie czeka na potwierdzenie – spróbuj za chwilę.', 'bad');
    else toast('Nie udało się zapisać pliku' + (e && e.message ? ': ' + e.message : '.'), 'bad');
  }
}

/* ---------- elementy formularzy ---------- */
const opt = (v, label, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(label)}</option>`;
const sourceOpts = (sel, withAll = false) => (withAll ? opt('', 'Wszystkie źródła', sel) : '') + SOURCES.map(s => opt(s.k, s.n, sel)).join('');
const regionOpts = (sel, withAll = false, emptyLabel = '— wybierz —') => (withAll ? opt('', 'Wszystkie regiony', sel) : opt('', emptyLabel, sel)) + REGIONS.map(r => opt(r, r, sel)).join('');
const ownerOpts = (sel, withAll = false, emptyLabel = '— bez opiekuna —') => (withAll ? opt('', 'Wszyscy opiekunowie', sel) + opt('_none', 'Bez opiekuna', sel) : opt('', emptyLabel, sel)) + team().map(m => opt(m.id, m.name, sel)).join('');
const stageOpts = sel => STAGES.map(s => opt(s.k, s.n, sel)).join('');
const statusOpts = sel => STATUSES.map(s => opt(s.k, s.n, sel)).join('');
function statusFilterOpts(sel) {
  return opt('', 'Wszystkie statusy', sel) + opt('aktywne', 'Tylko aktywne', sel) +
    `<optgroup label="Etap lejka">${STAGES.map(s => opt('etap:' + s.k, s.n, sel)).join('')}</optgroup>` +
    `<optgroup label="Status kontaktu">${STATUSES.map(s => opt('st:' + s.k, s.n, sel)).join('')}</optgroup>`;
}
const statusPill = k => { const s = STATUS_MAP[k] || STATUS_MAP.do_kontaktu; return `<span class="pill ${s.tone}">${esc(s.n)}</span>`; };
const sourcePill = k => { const i = SOURCES.findIndex(s => s.k === k); const s = SOURCES[i] || { n: k || '—' }; return `<span class="pill outline"><span class="sw" style="background:var(${SERIES[i % 8] || '--muted'})"></span>${esc(s.n)}</span>`; };
const stageBar = l => { const i = stageIdx(l); const cls = isWon(l) ? 'won' : l.status === 'utracony' ? 'lost' : ''; return `<span class="stagebar ${cls}" title="${esc(STAGES[i].n)}">${STAGES.map((s, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>`; };
function dueCls(d) { if (!d) return ''; const t = todayISO(); return d.slice(0, 10) < t ? 'overdue' : d.slice(0, 10) === t ? 'today' : ''; }

function filterBar({ period = true, search = true } = {}) {
  const f = S.f;
  return `<div class="filters" role="search">
    ${period ? `<label class="field"><span>Okres</span><select id="f-period" data-f="period">${opt('7', 'Ostatnie 7 dni', f.period)}${opt('30', 'Ostatnie 30 dni', f.period)}${opt('month', 'Bieżący miesiąc', f.period)}${opt('90', 'Ostatnie 90 dni', f.period)}${opt('all', 'Cały okres', f.period)}</select></label>` : ''}
    <label class="field"><span>Model</span><select id="f-model" data-f="model">${opt('', 'Franczyza i Ship Point', f.model)}${MODELS.map(m => opt(m.k, m.n, f.model)).join('')}</select></label>
    <label class="field"><span>Źródło</span><select id="f-source" data-f="source">${sourceOpts(f.source, true)}</select></label>
    <label class="field"><span>Opiekun</span><select id="f-owner" data-f="owner">${ownerOpts(f.owner, true)}</select></label>
    <label class="field"><span>Region</span><select id="f-region" data-f="region">${regionOpts(f.region, true)}</select></label>
    <label class="field"><span>Status</span><select id="f-status" data-f="status">${statusFilterOpts(f.status)}</select></label>
    ${search ? `<label class="field search"><span>Szukaj</span><input type="search" id="f-q" data-f="q" placeholder="Nazwisko, miasto, telefon, kod SC-…" value="${esc(f.q)}"></label>` : ''}
    ${S.f.ids ? `<span class="pill acc" style="align-self:center">Lista: ${esc(S.f.idsLabel || 'wybrane leady')}</span>` : ''}
    ${filtersActive() ? `<button class="btn ghost clear" data-act="filters-clear">Wyczyść filtry</button>` : ''}
  </div>`;
}

/* ---------- wykresy (SVG) ---------- */
function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
/* kolumny + linia planu; data: [{label, value, tip}] */
function columnChart(data, { planValue = null, height = 190, color = '--s1', planLabel = 'Plan', valueFmt = v => fmt(v) } = {}) {
  const W = 640, H = height, L = 34, R = 10, T = 16, B = 26;
  const maxV = niceMax(Math.max(1, ...data.map(d => d.value), planValue || 0));
  const iw = W - L - R, ih = H - T - B;
  const bw = Math.min(24, iw / data.length * 0.62);
  const x = i => L + iw / data.length * (i + 0.5);
  const y = v => T + ih - (v / maxV) * ih;
  const ticks = [0, maxV / 2, maxV];
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Wykres kolumnowy">`;
  ticks.forEach(t => { s += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmt(t, t < 10 && t % 1 ? 1 : 0)}</text>`; });
  data.forEach((d, i) => {
    const h = Math.max(0, ih - (y(d.value) - T));
    const bx = x(i) - bw / 2, by = y(d.value);
    if (d.value > 0) s += `<path d="M${bx},${T + ih} V${by + 4} Q${bx},${by} ${bx + 4},${by} H${bx + bw - 4} Q${bx + bw},${by} ${bx + bw},${by + 4} V${T + ih} Z" fill="var(${d.color || color})"/>`;
    s += `<rect x="${x(i) - iw / data.length / 2}" y="${T}" width="${iw / data.length}" height="${ih}" fill="transparent" data-tip="${esc(d.tip || (d.label + ': ' + valueFmt(d.value)))}"/>`;
    if (data.length <= 16 && (i % Math.ceil(data.length / 13) === 0)) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  s += `<line class="base" x1="${L}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/>`;
  if (planValue != null && planValue > 0) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(planValue)}" y2="${y(planValue)}" stroke="var(--ink-2)" stroke-width="2"/>`;
    s += `<text class="lbl" x="${W - R}" y="${y(planValue) - 5}" text-anchor="end">${esc(planLabel)}: ${valueFmt(planValue)}</text>`;
  }
  return `<div class="chart">${s}</svg></div>`;
}
/* grupowane kolumny plan vs wykonanie dla M1..M3 */
function planActualChart(groups, { height = 180 } = {}) {
  const W = 640, H = height, L = 34, R = 10, T = 14, B = 26;
  const maxV = niceMax(Math.max(1, ...groups.flatMap(g => [g.plan, g.actual])));
  const iw = W - L - R, ih = H - T - B, gw = iw / groups.length, bw = Math.min(24, gw * 0.28);
  const y = v => T + ih - (v / maxV) * ih;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Plan a wykonanie">`;
  [0, maxV / 2, maxV].forEach(t => { s += `<line class="gridl" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmt(t, t % 1 ? 1 : 0)}</text>`; });
  const bar = (bx, v, col) => v > 0 ? `<path d="M${bx},${T + ih} V${y(v) + Math.min(4, ih - (y(v) - T))} Q${bx},${y(v)} ${bx + 4},${y(v)} H${bx + bw - 4} Q${bx + bw},${y(v)} ${bx + bw},${y(v) + 4} V${T + ih} Z" fill="var(${col})"/>` : '';
  groups.forEach((g, i) => {
    const cx = L + gw * (i + 0.5);
    s += bar(cx - bw - 1, g.plan, '--plan') + bar(cx + 1, g.actual, '--s1');
    s += `<text class="val" x="${cx - bw / 2 - 1}" y="${y(g.plan) - 4}" text-anchor="middle">${fmt(g.plan, g.plan < 10 ? 1 : 0)}</text>`;
    s += `<text class="val" x="${cx + bw / 2 + 1}" y="${y(g.actual) - 4}" text-anchor="middle">${fmt(g.actual)}</text>`;
    s += `<rect x="${cx - gw / 2}" y="${T}" width="${gw}" height="${ih}" fill="transparent" data-tip="${esc(g.label + ' – plan: ' + fmt(g.plan, 1) + ', wykonanie: ' + fmt(g.actual))}"/>`;
    s += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(g.label)}</text>`;
  });
  s += `<line class="base" x1="${L}" x2="${W - R}" y1="${T + ih}" y2="${T + ih}"/></svg>`;
  return `<div class="chart">${s}</div><div class="legend"><span><i style="background:var(--plan)"></i>Plan</span><span><i style="background:var(--s1)"></i>Wykonanie</span></div>`;
}
function inlineBar(value, max, planMark = null, color = '--s1') {
  const w = max > 0 ? clamp(value / max * 100, 0, 100) : 0;
  const pm = planMark != null && max > 0 ? `<b style="left:${clamp(planMark / max * 100, 0, 100)}%"></b>` : '';
  return `<div class="track"><i style="width:${w}%;background:var(${color})"></i>${pm}</div>`;
}

/* tooltip dla [data-tip] */
let tipEl = null;
document.addEventListener('pointermove', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { if (tipEl) tipEl.hidden = true; return; }
  if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
  tipEl.textContent = t.getAttribute('data-tip');
  tipEl.hidden = false;
  const x = Math.min(e.clientX + 12, window.innerWidth - 250);
  tipEl.style.left = x + 'px';
  tipEl.style.top = (e.clientY + 14) + 'px';
});

function dueContactsCount() {
  const me = myMemberId(); const t = todayISO();
  return leadsArr().filter(l => isOpen(l) && l.nextTaskDate && l.nextTaskDate <= t && (!me || l.ownerId === me)).length;
}
const modelPill = l => { const k = modelOf(l); return `<span class="pill ${k === 'shippoint' ? 'outline' : 'acc'}">${esc(modelName(k))}${k === 'franczyza' && l.pkg ? ' · ' + esc(l.pkg.toUpperCase()) : ''}</span>`; };
