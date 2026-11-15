/* ===== Dane firmy po NIP – automatycznie z rejestrów =====
   Panel sam nie ma dostępu do internetu, więc rejestry otwiera przeglądarka aplikacji Claude
   (host:claude_browser – działa, gdy panel jest otwarty w aplikacji Claude na komputerze):
   1) Biała lista VAT (API Ministerstwa Finansów) – nazwa, adres, REGON, KRS, status VAT,
   2) KRS (API Ministerstwa Sprawiedliwości) – forma prawna, adres, e-mail i www z KRS, zarząd,
   3) wyszukiwarka firm biznes.gov.pl (CEIDG + KRS) – gdy firmy nie ma na Białej liście. */

const BROWSER = 'host:claude_browser';
const REG = { tabId: null, busy: {}, cache: {}, pending: {}, lastErr: '' };
const regSleep = ms => new Promise(r => setTimeout(r, ms));
const REG_FATAL = ['server_not_connected', 'not_granted', 'capability_disabled', 'capability_removed', 'not_in_manifest', 'cancelled', 'approval_required', 'blocked_by_policy'];

function mcpText(res) {
  if (!res) return '';
  if (typeof res.payload === 'string') return res.payload;
  const blocks = (res.content || []).filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text);
  if (blocks.length) return blocks.join('\n');
  if (res.payload != null) { try { return JSON.stringify(res.payload); } catch (e) { } }
  return '';
}
function mcpTabId(res) {
  const p = res && (res.structuredContent || res.payload);
  if (p && typeof p === 'object') { const v = p.tabId ?? p.tab_id ?? (p.tab && p.tab.id); if (v != null) return v; }
  const m = mcpText(res).match(/tab\s*_?id["'\s:=]*["']?([A-Za-z0-9-]+)/i);
  return m ? (/^\d+$/.test(m[1]) ? +m[1] : m[1]) : null;
}
async function browserOpen(url) {
  if (REG.tabId != null) {
    try { await S.mcp.callTool(BROWSER, 'navigate', { url, tabId: REG.tabId }, { cache: false }); return; }
    catch (e) { if (REG_FATAL.includes(e && e.code)) throw e; REG.tabId = null; }
  }
  const r = await S.mcp.callTool(BROWSER, 'preview_start', { url }, { cache: false });
  REG.tabId = mcpTabId(r);
}
async function browserText(url, { until, timeout = 15000 } = {}) {
  await browserOpen(url);
  const t0 = Date.now();
  await regSleep(900);
  for (;;) {
    const r = await S.mcp.callTool(BROWSER, 'get_page_text', REG.tabId != null ? { tabId: REG.tabId } : {}, { cache: false });
    const text = mcpText(r);
    if (!until || until(text) || Date.now() - t0 > timeout) return text;
    await regSleep(1500);
  }
}

/* KRS: pełniejszy odczyt odpisu (adres, e-mail, www, zarząd) */
function krsDetails(od) {
  const d1 = (od.dane || {}).dzial1 || {}, d2 = (od.dane || {}).dzial2 || {};
  const sa = d1.siedzibaIAdres || {};
  const rep = (d2.reprezentacja || {}).sklad || [];
  const people = rep.map(p => {
    const im = p.imiona || {}, nz = p.nazwisko || {};
    const name = [im.imie, im.imieDrugie, nz.nazwiskoICzlon, nz.nazwiskoIICzlon].filter(Boolean).join(' ');
    return name ? name + (p.funkcjaWOrganie ? ' – ' + p.funkcjaWOrganie : '') : '';
  }).filter(x => x && !/\*{3}/.test(x));
  const cap = (d1.kapital || {}).wysokoscKapitaluZakladowego;
  return {
    email: String(sa.adresPocztyElektronicznej || '').toLowerCase(),
    www: sa.adresStronyInternetowej || '',
    representatives: people,
    capital: cap ? [cap.wartosc, cap.waluta].filter(Boolean).join(' ') : ''
  };
}

/* łączenie danych z kilku rejestrów (pierwsze niepuste wygrywa) */
function mergeCompany(...parts) {
  const list = parts.filter(Boolean);
  if (!list.length) return null;
  const out = {};
  list.forEach(p => Object.entries(p).forEach(([k, v]) => {
    if (k === 'source') return;
    if (out[k] == null || out[k] === '' || (Array.isArray(out[k]) && !out[k].length)) out[k] = v;
  }));
  out.source = [...new Set(list.map(p => p.source).filter(Boolean))].join(' + ');
  out.at = todayISO();
  return out;
}

async function registryLookup(nip, onStep = () => { }) {
  const d = nipDigits(nip);
  if (REG.cache[d]) return REG.cache[d];
  let wl = null, krs = null, ceidg = null;
  onStep('Biała lista VAT');
  try {
    const t = await browserText(`https://wl-api.mf.gov.pl/api/search/nip/${d}?date=${todayISO()}`, { until: x => /"result"|"code"|"message"/.test(x) });
    wl = parseWhiteList(t);
  } catch (e) { if (REG_FATAL.includes(e && e.code)) throw e; }
  if (wl && wl.krs) {
    onStep('KRS');
    for (const rej of ['P', 'S']) {
      try {
        const t = await browserText(`https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${wl.krs}?rejestr=${rej}&format=json`, { until: x => /"odpis"|"kod"|"error"|"status"/i.test(x) });
        krs = parseWhiteList(t);
      } catch (e) { if (REG_FATAL.includes(e && e.code)) throw e; }
      if (krs) break;
    }
  }
  if (!krs && (!wl || !wl.form)) {
    onStep('CEIDG / biznes.gov.pl');
    try {
      const t = await browserText(`https://www.biznes.gov.pl/pl/wyszukiwarka-firm/?searchType=advanced&nip=${d}`,
        { until: x => x.includes(d) || /nie znaleziono|brak wynik/i.test(x), timeout: 20000 });
      if (t && t.includes(d)) ceidg = await extractCompanyWithClaude(t);
    } catch (e) { if (REG_FATAL.includes(e && e.code)) throw e; }
  }
  const c = mergeCompany(krs, wl, ceidg);
  if (c && !c.nip) c.nip = d;
  if (c) REG.cache[d] = c;
  return c;
}

function regErrMsg(e) {
  const code = e && e.code;
  if (code === 'server_not_connected' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed')
    return 'Automatyczne pobieranie działa, gdy panel jest otwarty w aplikacji Claude na komputerze. Tutaj użyj „Dane firmy z rejestru” w karcie kandydata.';
  if (code === 'not_in_manifest' || code === 'approval_required' || code === 'cancelled')
    return 'Brak zgody na użycie przeglądarki Claude. Zezwól w oknie, które się pojawi (albo w uprawnieniach panelu) i wpisz NIP ponownie.';
  if (code === 'tool_error') return 'Przeglądarka nie otworzyła rejestru: ' + String(e.message || '').slice(0, 140);
  return 'Nie udało się pobrać danych z rejestrów' + (code ? ' (' + code + ')' : '') + '.';
}

/* wpisuje dane z rejestru w puste pola formularza */
function fillFromCompany(prefix, c) {
  const set = (id, v) => { const el = $('#' + prefix + '-' + id); if (el && v && !el.value.trim()) { el.value = v; el.classList.add('autofilled'); } };
  set('company', c.name);
  set('phone', c.phone);
  set('email', c.email);
  set('name', c.owner);
  const box = $('#' + prefix + '-companybox');
  if (box) box.innerHTML = companyKv(c);
}
function companyKv(c) {
  if (!c) return '';
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : '';
  return `<dl class="kv">${row('Nazwa', esc(c.name || ''))}${row('Adres', esc(c.address || ''))}${row('NIP', esc(nipFmt(c.nip || '')))}${row('REGON', esc(c.regon || ''))}${row('KRS', esc(c.krs || ''))}${row('Forma', esc(c.form || ''))}
    ${c.statusVat ? `<dt>Status VAT</dt><dd><span class="pill ${c.statusVat === 'Czynny' ? 'good' : 'warn'}">${esc(c.statusVat)}</span></dd>` : ''}${row('Status', esc(c.status || ''))}${row('Od', esc(c.startDate || c.registrationLegalDate || ''))}${row('PKD', esc(c.pkd || ''))}
    ${row('Telefon', esc(c.phone || ''))}${row('E-mail', esc(c.email || ''))}${row('WWW', esc(c.www || ''))}${row('Kapitał', esc(c.capital || ''))}
    ${c.representatives && c.representatives.length ? `<dt>Reprezentacja</dt><dd>${c.representatives.map(esc).join('<br>')}</dd>` : ''}
    ${row('Źródło', esc((c.source || '') + (c.at ? ' · ' + fdate(c.at) : '')))}</dl>`;
}

/* zapis danych firmy w istniejącym leadzie */
function applyCompanyToLead(id, c) {
  const cur = D().leads[id]; if (!cur || !c) return;
  const p = { companyData: c, updatedTs: new Date().toISOString() };
  if (!cur.company && c.name) p.company = c.name;
  if (!cur.phone && c.phone) p.phone = c.phone;
  if (!cur.email && c.email) p.email = c.email;
  const hist = (cur.history || []).slice(); hist.push(histEntry('system', 'Pobrano dane firmy (' + c.source + '): ' + c.name)); p.history = hist;
  patch('leads', id, p);
}

/* reakcja na wpisanie NIP-u (formularz nowego leada „lf” albo karta kandydata „le”) */
async function autoNip(prefix, leadId, force = false) {
  const inp = $('#' + prefix + '-nip'); if (!inp) return;
  const d = nipDigits(inp.value);
  const st = $('#' + prefix + '-nip-st');
  const say = (t, cls = '') => { const el = $('#' + prefix + '-nip-st'); if (el) { el.className = 'hint ' + cls; el.textContent = t; } };
  if (d.length !== 10) { if (st) say(''); return; }
  if (!nipValid(d)) { say('Błędny NIP – sprawdź cyfry', 'overdue'); return; }
  if (leadId && !force) { const l = D().leads[leadId]; if (l && l.companyData && nipDigits(l.companyData.nip) === d) { say('NIP poprawny · dane firmy pobrane'); return; } }
  if (!S.mcp) { say('NIP poprawny. Dane firmy pobiorą się same, gdy panel jest otwarty w aplikacji Claude na komputerze.'); return; }
  if (REG.busy[d]) return;
  REG.busy[d] = true;
  say('Pobieram dane firmy z rejestrów…');
  try {
    const c = await registryLookup(d, s => say('Pobieram dane firmy: ' + s + '…'));
    if (nipDigits(($('#' + prefix + '-nip') || {}).value) !== d) return;
    if (!c) { say('Nie znaleziono firmy z tym NIP-em w rejestrach (może to nowa działalność).', 'warn'); return; }
    REG.pending[prefix] = c;
    if (leadId) applyCompanyToLead(leadId, c);
    else fillFromCompany(prefix, c);
    say('Uzupełniono z rejestru: ' + c.name, 'good');
  } catch (e) {
    REG.lastErr = regErrMsg(e);
    say(REG.lastErr, 'overdue');
  } finally { REG.busy[d] = false; }
}
