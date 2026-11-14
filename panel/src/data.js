/* ===== Import, eksport (CSV / XLSX), ustawienia, dane podglądowe ===== */

const LEAD_FIELDS = [
  { k: 'name', n: 'Imię i nazwisko', keys: ['imie i nazwisko', 'imię i nazwisko', 'nazwisko', 'name', 'full name', 'full_name', 'kandydat', 'osoba', 'imie', 'imię', 'first name', 'first_name'] },
  { k: 'lastName', n: 'Nazwisko (osobno)', keys: ['nazwisko', 'last name', 'last_name', 'surname'] },
  { k: 'company', n: 'Firma', keys: ['firma', 'company', 'company name', 'company_name', 'nazwa firmy'] },
  { k: 'phone', n: 'Telefon', keys: ['telefon', 'tel', 'phone', 'phone number', 'phone_number', 'numer telefonu', 'nr telefonu', 'komórka'] },
  { k: 'email', n: 'E-mail', keys: ['email', 'e-mail', 'mail', 'adres e-mail', 'adres email'] },
  { k: 'city', n: 'Miasto', keys: ['miasto', 'city', 'miejscowość', 'miejscowosc', 'lokalizacja', 'location'] },
  { k: 'region', n: 'Województwo', keys: ['województwo', 'wojewodztwo', 'region', 'state', 'woj'] },
  { k: 'source', n: 'Źródło', keys: ['źródło', 'zrodlo', 'source', 'kanał', 'kanal', 'utm_source', 'platform', 'platforma'] },
  { k: 'owner', n: 'Opiekun', keys: ['opiekun', 'owner', 'handlowiec', 'przypisany', 'assigned'] },
  { k: 'capital', n: 'Kapitał', keys: ['kapitał', 'kapital', 'budżet', 'budzet', 'capital', 'budget'] },
  { k: 'notes', n: 'Notatki', keys: ['notatki', 'notatka', 'uwagi', 'notes', 'komentarz', 'wiadomość', 'wiadomosc', 'message'] },
  { k: 'createdAt', n: 'Data zgłoszenia', keys: ['data', 'data zgłoszenia', 'data zgloszenia', 'created', 'created_time', 'created_at', 'date'] },
  { k: 'stage', n: 'Etap', keys: ['etap', 'stage'] },
  { k: 'status', n: 'Status', keys: ['status'] }
];
const normKey = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
function guessField(header) {
  const h = normKey(header);
  let best = '';
  for (const f of LEAD_FIELDS) if (f.keys.includes(h)) { best = f.k; break; }
  if (!best) for (const f of LEAD_FIELDS) if (f.keys.some(k => k.length > 3 && h.includes(k))) { best = f.k; break; }
  return best;
}
function matchSource(v) {
  const s = normKey(v);
  if (!s) return '';
  if (/(fb|facebook|instagram|meta|ig)/.test(s)) return 'meta';
  if (/(google|adwords|gads)/.test(s)) return 'google';
  if (/(portal|franczyz|franchis)/.test(s)) return 'portale';
  if (/linkedin/.test(s)) return 'linkedin';
  if (/(polec|referr)/.test(s)) return 'polecenia';
  if (/(targi|event|expo)/.test(s)) return 'targi';
  if (/(www|strona|seo|organic|site)/.test(s)) return 'www';
  if (/webinar/.test(s)) return 'webinar';
  if (/(outbound|cold|telefon)/.test(s)) return 'outbound';
  const exact = SOURCES.find(x => normKey(x.n) === s || x.k === s);
  return exact ? exact.k : 'inne';
}
function matchRegion(v) {
  const s = normKey(v).replace(/^woj\.?\s*/, '').replace('województwo ', '');
  return REGIONS.find(r => r === s) || REGIONS.find(r => r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ł', 'l') === s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace('ł', 'l')) || '';
}
function parseDateLoose(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return isoDate(d); }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/); if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  const d = new Date(s); return isNaN(d) ? '' : isoDate(d);
}
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = [';', '\t', ','].map(d => [d, firstLine.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/* ---------- import ---------- */
const IMP = { rows: [], headers: [], map: {}, fileName: '' };
function openImport() {
  IMP.rows = []; IMP.headers = []; IMP.map = {}; IMP.fileName = '';
  renderImport();
}
function renderImport() {
  const hasData = IMP.rows.length > 0;
  const preview = hasData ? buildImportRows().slice(0, 6) : [];
  const allRows = hasData ? buildImportRows() : [];
  const dups = allRows.filter(r => findDuplicate(r)).length;
  openModal(`<div class="mh"><h2>Import leadów</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
  <div class="mb">
    ${!hasData ? `<div class="dropzone" id="dropzone"><p><b>Przeciągnij plik CSV lub XLSX</b> albo wybierz go z dysku.</p><p class="small muted">Pierwszy wiersz powinien zawierać nagłówki (np. imię i nazwisko, telefon, e-mail, miasto, źródło). Obsługiwane są eksporty z Meta Lead Ads i arkuszy Google.</p>
      <div class="row" style="justify-content:center;margin-top:10px"><label class="btn primary">${ICONS.up}Wybierz plik<input type="file" id="imp-file" accept=".csv,.xlsx,.xls,.tsv,.txt" hidden></label></div></div>
      <label class="field"><span>…albo wklej dane z arkusza (z nagłówkami)</span><textarea id="imp-paste" rows="5" placeholder="Imię i nazwisko;Telefon;E-mail;Miasto&#10;Jan Kowalski;600100200;jan@example.com;Rybnik"></textarea></label>
      <div class="row"><button class="btn" data-act="imp-paste">Wczytaj wklejone dane</button></div>`
    : `<p class="small"><b>${esc(IMP.fileName || 'Wklejone dane')}</b> · ${IMP.rows.length} wierszy. Dopasuj kolumny do pól leada:</p>
      <div class="formgrid">${IMP.headers.map((h, i) => `<label class="field"><span>${esc(h || 'kolumna ' + (i + 1))}</span><select id="imp-map-${i}" data-imp-map="${i}">${opt('', '— pomiń —', IMP.map[i] || '')}${LEAD_FIELDS.map(f => opt(f.k, f.n, IMP.map[i] || '')).join('')}</select></label>`).join('')}</div>
      <div class="sep"></div>
      <div class="formgrid">
        <label class="field"><span>Źródło (gdy brak w pliku)</span><select id="imp-src">${sourceOpts(IMP.defSource || 'meta')}</select></label>
        <label class="field"><span>Opiekun dla wszystkich</span><select id="imp-owner">${ownerOpts(IMP.defOwner || '', false, '— bez opiekuna —')}</select></label>
        <label class="field"><span>Województwo (gdy brak)</span><select id="imp-region">${regionOpts(IMP.defRegion || '', false, '— nie ustawiaj —')}</select></label>
        <label class="field"><span>Duplikaty (${dups})</span><select id="imp-dups">${opt('skip', 'Pomiń duplikaty', IMP.dups || 'skip')}${opt('add', 'Dodaj mimo to', IMP.dups || 'skip')}</select></label>
      </div>
      <div class="tablewrap"><table class="t"><thead><tr><th>Imię i nazwisko</th><th>Telefon</th><th>E-mail</th><th>Miasto</th><th>Źródło</th><th></th></tr></thead><tbody>
      ${preview.map(r => `<tr><td>${esc(r.name || '—')}</td><td>${esc(r.phone)}</td><td>${esc(r.email)}</td><td>${esc(r.city)}</td><td>${esc(SOURCE_MAP[r.source]?.n || '')}</td><td>${findDuplicate(r) ? '<span class="pill warn">duplikat</span>' : ''}</td></tr>`).join('')}
      </tbody></table></div><p class="note">Podgląd pierwszych wierszy. Wiersze bez imienia i nazwiska, telefonu i e-maila zostaną pominięte.</p>
      <div id="imp-progress" class="small"></div>`}
  </div>
  <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button>${hasData ? `<button class="btn ghost" data-act="imp-reset">Wybierz inny plik</button><button class="btn primary" data-act="imp-run">Importuj ${allRows.length - ((IMP.dups || 'skip') === 'skip' ? dups : 0)} leadów</button>` : ''}</div>`, { wide: true });
  const fi = $('#imp-file');
  if (fi) fi.onchange = e => { const f = e.target.files[0]; if (f) readImportFile(f); };
  const dz = $('#dropzone');
  if (dz) {
    dz.ondragover = e => { e.preventDefault(); dz.classList.add('over'); };
    dz.ondragleave = () => dz.classList.remove('over');
    dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readImportFile(f); };
  }
}
function setImportTable(rows, name) {
  if (!rows.length || rows.length < 2) { toast('Plik nie zawiera wierszy z danymi (potrzebny nagłówek i min. 1 wiersz).', 'bad'); return; }
  IMP.headers = rows[0].map(h => String(h ?? '').trim());
  IMP.rows = rows.slice(1);
  IMP.fileName = name;
  IMP.map = {};
  const used = new Set();
  IMP.headers.forEach((h, i) => { const g = guessField(h); if (g && !used.has(g)) { IMP.map[i] = g; used.add(g); } });
  renderImport();
}
function readImportFile(file) {
  const name = file.name || 'plik';
  const isX = /\.xlsx?$/i.test(name);
  const reader = new FileReader();
  reader.onerror = () => toast('Nie udało się odczytać pliku.', 'bad');
  reader.onload = () => {
    try {
      if (isX) {
        if (!window.XLSX) { toast('Biblioteka XLSX nie wczytała się – zapisz plik jako CSV.', 'bad'); return; }
        const wb = XLSX.read(new Uint8Array(reader.result), { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        setImportTable(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }), name);
      } else {
        let text = reader.result;
        if (text.includes('\uFFFD')) { const r2 = new FileReader(); r2.onload = () => setImportTable(parseCSV(r2.result), name); r2.readAsText(file, 'windows-1250'); return; }
        setImportTable(parseCSV(text), name);
      }
    } catch (e) { toast('Błąd odczytu pliku: ' + e.message, 'bad'); }
  };
  if (isX) reader.readAsArrayBuffer(file); else reader.readAsText(file, 'utf-8');
}
function buildImportRows() {
  const src = ($('#imp-src') || {}).value || IMP.defSource || 'meta';
  const owner = ($('#imp-owner') || {}).value ?? IMP.defOwner ?? '';
  const region = ($('#imp-region') || {}).value ?? IMP.defRegion ?? '';
  return IMP.rows.map(r => {
    const o = {};
    Object.entries(IMP.map).forEach(([i, k]) => { if (k) { const v = r[i]; if (v !== '' && v != null) o[k] = o[k] ? o[k] + ' ' + v : v; } });
    const name = [o.name, o.lastName].filter(Boolean).join(' ').trim();
    const ownerId = o.owner ? (team().find(m => normKey(m.name) === normKey(o.owner) || normKey(m.name).startsWith(normKey(o.owner)))?.id || owner) : owner;
    const stage = o.stage ? (STAGES.find(s => normKey(s.n) === normKey(o.stage) || s.k === normKey(o.stage))?.k || 'nowy') : 'nowy';
    const status = o.status ? (STATUSES.find(s => normKey(s.n) === normKey(o.status) || s.k === normKey(o.status))?.k || 'do_kontaktu') : 'do_kontaktu';
    return {
      name, company: String(o.company || '').trim(), phone: String(o.phone || '').replace(/^p:/, '').trim(), email: String(o.email || '').trim(),
      city: String(o.city || '').trim(), region: matchRegion(o.region) || region, source: matchSource(o.source) || src, ownerId,
      capital: String(o.capital || '').replace(/[^\d]/g, ''), notes: String(o.notes || '').trim(), createdAt: parseDateLoose(o.createdAt) || todayISO(), stage, status
    };
  }).filter(r => r.name || r.phone || r.email);
}
async function runImport(btn) {
  const rows = buildImportRows();
  const skip = (($('#imp-dups') || {}).value || 'skip') === 'skip';
  const pool = leadsArr();
  const batchSeen = [];
  const items = [];
  rows.forEach(r => {
    if (skip && (findDuplicate(r, pool) || findDuplicate(r, batchSeen))) return;
    batchSeen.push(r);
    const lead = newLead({ ...r, name: r.name || r.email || r.phone, nextTaskDate: todayISO() });
    const sd = {}; for (let i = 0; i <= STAGE_IDX[r.stage]; i++) sd[STAGES[i].k] = r.createdAt;
    lead.stageDates = sd;
    lead.history = [histEntry('system', 'Import z pliku: ' + (IMP.fileName || 'wklejone dane'))];
    items.push(lead);
  });
  if (!items.length) { toast('Brak nowych leadów do zaimportowania.', 'bad'); return; }
  btn.disabled = true;
  const prog = $('#imp-progress');
  const res = await putMany('leads', items, (d, n) => { if (prog) prog.textContent = `Zapisywanie: ${d} / ${n}`; });
  closeModal();
  toast(`Zaimportowano ${res.done - res.failed} leadów${res.failed ? ', błędy: ' + res.failed : ''}`);
  go('leady');
}

/* ---------- eksport ---------- */
function leadRowsForExport(list) {
  return list.map(l => ({
    'Kod': leadCode(l.id), 'Imię i nazwisko': l.name || '', 'Firma': l.company || '', 'Telefon': l.phone || '', 'E-mail': l.email || '',
    'Miasto': l.city || '', 'Województwo': l.region || '', 'Źródło': SOURCE_MAP[l.source]?.n || l.source || '', 'Opiekun': memberName(l.ownerId),
    'Etap': STAGES[stageIdx(l)].n, 'Status kontaktu': STATUS_MAP[l.status]?.n || '', 'Powód utraty': l.lostReason || '',
    'Model': MODELS.find(m => m.k === l.model)?.n || '', 'Kapitał (zł)': l.capital ? +l.capital : '', 'Lokal': ({ ma: 'ma lokal', szuka: 'szuka', nie: 'brak' })[l.hasPremises] || '',
    'Następne zadanie': l.nextTask || '', 'Termin zadania': l.nextTaskDate || '', 'Spotkanie': l.meetingAt ? l.meetingAt.replace('T', ' ') : '', 'Forma spotkania': l.meetingType || '',
    'Ostatni kontakt': (lastContact(l) || '').replace('T', ' '), 'Liczba kontaktów': (l.history || []).filter(h => h.type !== 'system').length,
    'Data dodania': l.createdAt || '', ...Object.fromEntries(STAGES.slice(1).map(s => ['Data: ' + s.short, (l.stageDates || {})[s.k] || ''])), 'Notatki': l.notes || ''
  }));
}
function toCSV(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '\uFEFF' + [cols.map(cell).join(';'), ...rows.map(r => cols.map(c => cell(r[c])).join(';'))].join('\r\n');
}
function exportCSV() {
  const list = sortedLeads(filterLeads(leadsArr()));
  if (!list.length) { toast('Brak leadów do eksportu.', 'bad'); return; }
  const csv = toCSV(leadRowsForExport(list));
  offerDownload(`leady-ship-center-${todayISO()}.csv`, csv, csv);
}
function sheetFrom(rows, widths) {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'Brak danych': '' }]);
  const cols = Object.keys(rows[0] || { a: 1 });
  ws['!cols'] = cols.map((c, i) => ({ wch: widths && widths[i] || Math.min(48, Math.max(10, c.length + 2, ...rows.slice(0, 200).map(r => String(r[c] ?? '').length + 1))) }));
  return ws;
}
function xlsxBytes(wb) { return XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true }); }
function exportXLSX(onlyLeads = false) {
  if (!window.XLSX) { toast('Biblioteka XLSX nie wczytała się. Użyj eksportu CSV.', 'bad'); return; }
  const wb = XLSX.utils.book_new();
  const leads = onlyLeads ? sortedLeads(filterLeads(leadsArr())) : sortedLeads(leadsArr());
  XLSX.utils.book_append_sheet(wb, sheetFrom(leadRowsForExport(leads)), 'Leady');
  const hist = leads.flatMap(l => (l.history || []).map(h => ({ 'Kod': leadCode(l.id), 'Kandydat': l.name, 'Data': (h.at || '').replace('T', ' '), 'Rodzaj': CT_MAP[h.type]?.n || h.type, 'Wynik': h.result || '', 'Opis': h.text || '', 'Kto': memberName(h.by) })));
  XLSX.utils.book_append_sheet(wb, sheetFrom(hist), 'Historia kontaktów');
  const ho = leads.flatMap(l => (l.handoffs || []).map(h => ({ 'Kod': leadCode(l.id), 'Kandydat': l.name, 'Data': h.date, 'Od': h.fromName || '', 'Do': h.toName || '', 'Notatka': h.note || '' })));
  if (ho.length) XLSX.utils.book_append_sheet(wb, sheetFrom(ho), 'Przekazania');
  if (!onlyLeads) {
    const plan = activePlan(); const pc = computePlan(plan); const all = leadsArr(); const spend = Object.values(D().spend);
    const wins = planWindows(plan); const actM = wins.map(([a, b]) => actualsFor(all, spend, a, b));
    const summary = [
      ['Ship Center – rekrutacja franczyzobiorców', ''], ['Wygenerowano', new Date().toLocaleString('pl-PL')], ['Plan aktywny', plan.name], ['Budżet / mies. (zł)', +plan.budget], ['Cel punktów / mies.', +plan.target], ['Start 90 dni', plan.startDate], [],
      ['Wskaźnik', 'M1 plan', 'M1 wykonanie', 'M2 plan', 'M2 wykonanie', 'M3 plan', 'M3 wykonanie'],
      ...[['Leady', 'leads'], ['Spotkania', 'meetings'], ['Analizy lokalizacji', 'analyses'], ['Nowe punkty', 'points'], ['Wydatki (zł)', 'spend']].map(([n, k]) => [n, ...pc.months.flatMap((m, i) => [Math.round(m[k] * 10) / 10, actM[i][k]])]),
      [], ['Lejek (wszystkie leady)', 'Liczba', 'Konwersja z poprzedniego', 'Konwersja w planie'],
      ...(() => { const f = funnelOf(all); return STAGES.map((s, i) => [s.n, f.reached[i], i ? (f.conv[i - 1] ?? '') : '', i ? pc.conv[i - 1] : '']); })()
    ];
    const ws = XLSX.utils.aoa_to_sheet(summary); ws['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Podsumowanie');
    const plans = Object.values(D().plans).map(p => { const c = computePlan(p); return { 'Wariant': p.name, 'Aktywny': p.id === plan.id ? 'tak' : '', 'Budżet / mies.': +p.budget, 'Cel pkt / mies.': +p.target, 'Leady / mies.': Math.round(c.leads), 'CPL': Math.round(c.cplBlend || 0), 'Konwersja lead→umowa': Math.round(c.overall * 10000) / 100 + '%', 'Punkty / mies.': Math.round(c.points * 10) / 10, 'Koszt punktu (CAC)': Math.round(c.cac || 0), 'Start': p.startDate, 'Cykl (dni)': +p.cycleDays, ...Object.fromEntries(SOURCES.map(s => ['Udział ' + s.n + ' %', +(p.mix || {})[s.k] || 0])) }; });
    XLSX.utils.book_append_sheet(wb, sheetFrom(plans), 'Warianty planu');
    XLSX.utils.book_append_sheet(wb, sheetFrom(spend.sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(x => ({ 'Data': x.date, 'Kanał': SOURCE_MAP[x.source]?.n || x.source, 'Kwota netto (zł)': +x.amount, 'Opis': x.note || '' }))), 'Wydatki');
    const tasks = Object.values(D().tasks);
    XLSX.utils.book_append_sheet(wb, sheetFrom(tasks.filter(t => t.kind === 'plan90').sort((a, b) => a.week - b.week || (a.order ?? 0) - (b.order ?? 0)).map(t => ({ 'Tydzień': t.week, 'Obszar': STREAMS[t.stream] || '', 'Działanie': t.title, 'Osoba': memberName(t.ownerId), 'Wykonane': t.done ? 'tak' : 'nie' }))), 'Harmonogram 90 dni');
    XLSX.utils.book_append_sheet(wb, sheetFrom(tasks.filter(t => t.kind === 'weekly').sort((a, b) => (a.due || '').localeCompare(b.due || '')).map(t => ({ 'Termin': t.due, 'Zadanie': t.title, 'Osoba': memberName(t.ownerId), 'Lead': t.leadId && D().leads[t.leadId] ? D().leads[t.leadId].name : '', 'Wykonane': t.done ? 'tak' : 'nie' }))), 'Zadania tygodniowe');
    XLSX.utils.book_append_sheet(wb, sheetFrom(Object.values(D().locations).map(x => { const r = analyzeLocation(x); return { 'Analiza': x.name, 'Adres': x.address, 'Miasto': x.city, 'Województwo': x.region, 'Kandydat': x.leadId && D().leads[x.leadId] ? D().leads[x.leadId].name : '', 'Ocena': r.score, 'Klasa': r.grade, 'Werdykt': r.gradeText, 'Popyt (paczek/mies.)': Math.round(r.demand.base), 'Przepustowość': Math.round(r.capacity), 'Wykorzystanie %': Math.round(r.util * 100), 'Konkurenci do 3 km': r.compCount, 'Indeks konkurencji': Math.round(r.ci * 100) / 100, 'Wynik bazowy (zł/mies.)': Math.round(r.fin.base.profit), 'Nakłady na start (zł)': Math.round(r.startup), 'Zwrot (mies.)': r.payback ? Math.round(r.payback * 10) / 10 : '' }; })), 'Lokalizacje');
    XLSX.utils.book_append_sheet(wb, sheetFrom(team().map(m => ({ 'Osoba': m.name, 'Rola': m.role || '', 'Regiony': (m.regions || []).join(', '), 'Telefon': m.phone || '', 'E-mail': m.email || '', 'Aktywne leady': all.filter(l => l.ownerId === m.id && isOpen(l)).length }))), 'Zespół');
  }
  offerDownload(`${onlyLeads ? 'leady' : 'panel'}-ship-center-${todayISO()}.xlsx`, xlsxBytes(wb));
}
function exportLocationXLSX(id) {
  if (!window.XLSX) { toast('Biblioteka XLSX nie wczytała się.', 'bad'); return; }
  const x = D().locations[id]; const r = analyzeLocation(x); const o = offer();
  const aoa = [
    ['Raport lokalizacji – Ship Center'], ['Analiza', x.name], ['Adres', [x.address, x.city].filter(Boolean).join(', ')], ['Województwo', x.region], ['Data', todayISO()], [],
    ['Ocena (0–100)', r.score], ['Klasa', r.grade], ['Werdykt', r.gradeText], [],
    ['Popyt – osoby prywatne (paczek/mies.)', Math.round(r.demand.indiv)], ['Popyt – firmy', Math.round(r.demand.biz)], ['Popyt bazowy', Math.round(r.demand.base)], ['Popyt – zakres', `${Math.round(r.demand.low)}–${Math.round(r.demand.high)}`], ['Szczyt sezonu', Math.round(r.demand.peak)],
    ['Przepustowość', Math.round(r.capacity)], ['Wykorzystanie', Math.round(r.util * 100) / 100], ['Wąskie gardło', r.bottleneck], [],
    ['Scenariusz', 'Pesymistyczny', 'Bazowy', 'Optymistyczny'],
    ...[['Paczki', 'parcels'], ['Przychód', 'revenue'], ['Koszty', 'costs'], ['Wynik', 'profit']].map(([n, k]) => [n, ...['low', 'base', 'high'].map(s => Math.round(r.fin[s][k]))]),
    [], ['Nakłady na start', Math.round(r.startup)], ['Zwrot (mies.)', r.payback ? Math.round(r.payback * 10) / 10 : '—'], ['Próg rentowności (paczek)', r.breakEven ? Math.round(r.breakEven) : '—'], ['Opłata licencyjna', o.licencja], [],
    ['Konkurencja', 'Typ', 'Odległość (m)', 'Siła'], ...r.compRows.map(c => [c.name || '', c.tn, +c.dist, c.strength || 3]), [],
    ['Wnioski'], ...r.flags.map(f => [f.t])
  ];
  const wb = XLSX.utils.book_new(); const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 40 }, { wch: 22 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Raport');
  offerDownload(`raport-lokalizacji-${slug(x.city || x.name)}.xlsx`, xlsxBytes(wb));
}

/* ---------- ustawienia ---------- */
function viewSettings() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie…</div>`;
  const o = offer();
  const members = team();
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Konfiguracja</span><h1>Zespół i ustawienia</h1><p>Osoby, którym przypisujesz leady, oraz parametry oferty używane w wiadomościach, skryptach i raportach lokalizacji.</p></div></div>`;
  const teamCard = `<div class="card"><div class="cardhead"><h2>Zespół</h2><p>${members.length} osób</p></div>
    ${members.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Osoba</th><th>Rola</th><th>Regiony</th><th>Kontakt</th><th class="r">Aktywne leady</th><th></th></tr></thead><tbody>
    ${members.map(m => `<tr><td><b>${esc(m.name)}</b></td><td class="small">${esc(m.role || '')}</td><td class="small">${esc((m.regions || []).join(', ') || '—')}</td><td class="small">${esc([m.phone, m.email].filter(Boolean).join(' · ') || '—')}</td><td class="r">${leadsArr().filter(l => l.ownerId === m.id && isOpen(l)).length}</td>
      <td><div class="row" style="flex-wrap:nowrap"><button class="iconbtn" data-act="member-edit" data-id="${m.id}" aria-label="Edytuj">${ICONS.notatka}</button><button class="iconbtn" data-act="member-del" data-id="${m.id}" aria-label="Usuń">${ICONS.trash}</button></div></td></tr>`).join('')}
    </tbody></table></div>` : `<p class="muted">Dodaj osoby z centrali i opiekunów regionalnych – pojawią się w polu „Opiekun” przy leadach i w filtrach.</p>`}
    <div class="row" style="margin-top:10px"><button class="btn primary sm" data-act="member-new">${ICONS.plus}Dodaj osobę</button>${members.length ? '<button class="btn sm" data-act="auto-assign">Przypisz leady bez opiekuna wg regionów</button>' : ''}</div></div>`;
  const f = (k, label, type = 'text', hint = '') => `<label class="field"><span>${label}</span><input type="${type}" id="of-${k}" data-offer="${k}" value="${esc(o[k])}" ${type === 'number' ? 'step="any" min="0"' : ''}>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const offerCard = `<div class="card"><div class="cardhead"><h2>Parametry oferty franczyzowej</h2><p>Wg wzoru Umowy Franczyzowej (01.09.2026) i OWU</p></div>
    <div class="formgrid">
      ${f('licencja', 'Opłata licencyjna (zł netto)', 'number')}${f('oplataMies', 'Opłata miesięczna (zł netto)', 'number')}
      ${f('progRabatu', 'Próg rabatu 100% (paczek / mies.)', 'number')}${f('prowizjaP24', 'Płatności online (% transakcji)', 'number')}
      ${f('minPaczek', 'Minimum paczek / mies.', 'number')}${f('ochrona', 'Ochrona terytorialna (km)', 'number')}
      ${f('licencjaBezPunktu', 'Franczyza bez punktu – licencja (zł)', 'number')}${f('partnerWstepna', 'Partner – opłata wstępna (zł)', 'number')}${f('partnerMies', 'Partner – abonament (zł / mies.)', 'number')}
      <label class="field span2"><span>Szkolenie</span><input type="text" id="of-szkolenie" data-offer="szkolenie" value="${esc(o.szkolenie)}"></label>
      <label class="field span2"><span>Uruchomienie punktu</span><input type="text" id="of-uruchomienie" data-offer="uruchomienie" value="${esc(o.uruchomienie)}"></label>
      <label class="field full"><span>Godziny otwarcia (standard)</span><input type="text" id="of-godziny" data-offer="godziny" value="${esc(o.godziny)}"></label>
      <label class="field full"><span>Przewoźnicy</span><input type="text" id="of-przewoznicy" data-offer="przewoznicy" value="${esc(o.przewoznicy)}"></label>
      ${f('email', 'E-mail działu franczyzy', 'email')}${f('telefon', 'Telefon', 'tel')}${f('www', 'Strona', 'text')}${f('adres', 'Adres centrali', 'text')}
      ${f('linkSpotkanie', 'Link do kalendarza spotkań', 'url', 'np. Calendly, Google Kalendarz')}${f('linkWebinar', 'Link do zapisów na webinar', 'url')}
    </div>
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="offer-reset">Przywróć wartości z umowy</button><span class="note">Zmiany zapisują się automatycznie po opuszczeniu pola.</span></div></div>`;
  const dataCard = `<div class="card"><div class="cardhead"><h2>Dane</h2></div>
    <div class="row"><button class="btn" data-act="export-xlsx">${ICONS.down}Eksport całego panelu (XLSX)</button><button class="btn" data-act="export-csv">${ICONS.down}Leady (CSV)</button><button class="btn" data-act="import-open">${ICONS.up}Import leadów</button>${!S.demo ? `<button class="btn ghost" data-act="demo-on">Podgląd na danych przykładowych</button>` : ''}</div>
    <p class="note" style="margin-top:8px">Dane panelu są wspólne dla wszystkich osób, którym udostępnisz stronę z prawem edycji (Contributor lub wyżej). Osoby z prawem podglądu widzą dane bez możliwości zmian. CSV używa średnika i kodowania UTF-8 – otwiera się poprawnie w polskim Excelu.</p></div>`;
  return head + `<div class="stack">${teamCard}${offerCard}${dataCard}</div>`;
}
function openMemberModal(m = null) {
  const isNew = !m;
  m = m || { id: uid('m'), name: '', role: 'Opiekun regionalny', regions: [], phone: '', email: '' };
  openModal(`<div class="mh"><h2>${isNew ? 'Nowa osoba' : 'Edytuj osobę'}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <form class="mb" id="member-form"><div class="formgrid">
      <label class="field span2"><span>Imię i nazwisko *</span><input type="text" id="mf-name" value="${esc(m.name)}" required></label>
      <label class="field"><span>Rola</span><select id="mf-role">${ROLES.map(r => opt(r, r, m.role)).join('')}</select></label>
      <label class="field"><span>Telefon</span><input type="tel" id="mf-phone" value="${esc(m.phone)}"></label>
      <label class="field"><span>E-mail</span><input type="email" id="mf-email" value="${esc(m.email)}"></label>
      <div class="field full"><span>Regiony (do automatycznego przypisywania leadów)</span><div class="row">${REGIONS.map((r, i) => `<label class="chk small"><input type="checkbox" id="mf-reg-${i}" value="${esc(r)}" ${(m.regions || []).includes(r) ? 'checked' : ''}>${esc(r)}</label>`).join('')}</div></div>
    </div></form>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="mf-save">Zapisz</button></div>`);
  const save = () => {
    const name = $('#mf-name').value.trim();
    if (!name) { toast('Wpisz imię i nazwisko.', 'bad'); return; }
    put('team', m.id, { ...m, name, role: $('#mf-role').value, phone: $('#mf-phone').value.trim(), email: $('#mf-email').value.trim(), regions: REGIONS.filter((r, i) => $('#mf-reg-' + i).checked) });
    closeModal(); toast('Zapisano');
  };
  $('#mf-save').onclick = save;
  $('#member-form').onsubmit = e => { e.preventDefault(); save(); };
}
function autoAssign() {
  const members = team();
  const loads = Object.fromEntries(members.map(m => [m.id, leadsArr().filter(l => l.ownerId === m.id && isOpen(l)).length]));
  let n = 0;
  leadsArr().filter(l => !l.ownerId && isOpen(l)).forEach(l => {
    const cands = members.filter(m => (m.regions || []).includes(l.region));
    if (!cands.length) return;
    const m = cands.sort((a, b) => loads[a.id] - loads[b.id])[0];
    loads[m.id]++; n++;
    const hist = (l.history || []).slice(); hist.push(histEntry('system', 'Automatyczne przypisanie wg regionu: ' + m.name));
    patch('leads', l.id, { ownerId: m.id, history: hist });
  });
  toast(n ? `Przypisano ${n} leadów` : 'Brak leadów do przypisania (sprawdź regiony osób i leadów).', n ? '' : 'bad');
}

/* ---------- dane podglądowe (tylko w pamięci) ---------- */
function buildDemo() {
  const d = emptyData();
  const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const people = [['Przykład: Marta Zielińska', 'Centrala – dyrektor rozwoju', ['śląskie', 'opolskie']], ['Przykład: Paweł Nowicki', 'Opiekun regionalny', ['mazowieckie', 'łódzkie', 'podlaskie']], ['Przykład: Ewa Król', 'Opiekun regionalny', ['małopolskie', 'podkarpackie', 'świętokrzyskie']], ['Przykład: Tomasz Wrona', 'Opiekun regionalny', ['wielkopolskie', 'dolnośląskie', 'pomorskie', 'kujawsko-pomorskie']]];
  people.forEach(([name, role, regions], i) => { const id = 'demo-m' + i; d.team[id] = { id, name, role, regions, phone: '+48 600 000 0' + pad(i + 10), email: `demo${i + 1}@example.com` }; });
  const memberIds = Object.keys(d.team);
  const plan = makePlan({ id: 'demo-plan', name: 'Bazowy – 22,5 tys. zł (podgląd)', startDate: isoDate(addDays(new Date(), -52)) });
  d.plans[plan.id] = plan; d.settings = { activePlanId: plan.id, offer: { ...(settings().offer || {}) } };
  const cities = [['Rybnik', 'śląskie'], ['Opole', 'opolskie'], ['Płock', 'mazowieckie'], ['Radom', 'mazowieckie'], ['Łódź', 'łódzkie'], ['Białystok', 'podlaskie'], ['Tarnów', 'małopolskie'], ['Rzeszów', 'podkarpackie'], ['Kielce', 'świętokrzyskie'], ['Kalisz', 'wielkopolskie'], ['Legnica', 'dolnośląskie'], ['Słupsk', 'pomorskie'], ['Toruń', 'kujawsko-pomorskie'], ['Gliwice', 'śląskie'], ['Nowy Sącz', 'małopolskie']];
  const first = ['Anna', 'Piotr', 'Katarzyna', 'Michał', 'Agnieszka', 'Krzysztof', 'Magdalena', 'Łukasz', 'Joanna', 'Marcin', 'Natalia', 'Adam', 'Karolina', 'Jakub', 'Monika', 'Grzegorz'];
  const last = ['Kowalczyk', 'Wiśniewski', 'Lewandowska', 'Dąbrowski', 'Mazur', 'Kaczmarek', 'Zając', 'Pawlak', 'Michalska', 'Sikora', 'Baran', 'Wróbel', 'Górska', 'Jabłoński'];
  const srcW = ['meta', 'meta', 'meta', 'meta', 'google', 'google', 'portale', 'portale', 'polecenia', 'www', 'webinar', 'outbound', 'linkedin', 'targi'];
  const conv = [0.74, 0.5, 0.52, 0.66, 0.62, 0.55];
  for (let i = 0; i < 230; i++) {
    const age = Math.floor(Math.pow(rnd(), 0.9) * 72);
    const created = addDays(new Date(), -age);
    let st = 0; while (st < 6 && rnd() < conv[st] && age > st * 7) st++;
    const [city, region] = pick(cities);
    const owner = rnd() < 0.08 ? '' : (Object.values(d.team).find(m => m.regions.includes(region)) || {}).id || pick(memberIds);
    const lost = st < 6 && age > 20 && rnd() < 0.35;
    const sd = {}; for (let j = 0; j <= st; j++) sd[STAGES[j].k] = isoDate(addDays(created, Math.min(age, Math.round(j * (5 + rnd() * 6)))));
    const fn = pick(first), ln = pick(last);
    const status = st === 6 ? 'pozyskany' : lost ? 'utracony' : st === 0 ? (age > 2 ? 'proba' : 'do_kontaktu') : st === 3 && rnd() < 0.4 ? 'umowione' : pick(['w_kontakcie', 'czeka', 'w_kontakcie', 'wstrzymany']);
    const hist = [histEntry('system', 'Lead z formularza (dane przykładowe)')];
    hist[0].at = isoDate(created) + 'T09:00';
    for (let j = 1; j <= st; j++) hist.push({ id: uid('h'), at: sd[STAGES[j].k] + 'T1' + (j % 7) + ':15', type: j === 3 ? 'spotkanie' : pick(['tel', 'tel', 'email']), text: ['Rozmowa wstępna, zainteresowany modelem punktu.', 'Wysłano prezentację i warunki.', 'Omówienie kosztów startu.', 'Prezentacja online – pytania o konkurencję paczkomatów.', 'Przesłał dane lokalu do analizy.', 'Negocjacje terminu startu.'][j - 1], result: 'Rozmowa przeprowadzona', by: owner });
    const id = 'demo-l' + pad(i);
    const nt = isOpen({ status }) ? isoDate(addDays(new Date(), Math.floor(rnd() * 10) - 3)) : '';
    d.leads[id] = { id, name: `${fn} ${ln}`, company: rnd() < 0.3 ? `${ln} Usługi` : '', phone: '+48 5' + String(10000000 + Math.floor(rnd() * 89999999)), email: `${fn}.${ln}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l') + '@example.com', city, region, source: pick(srcW), ownerId: owner, stage: STAGES[st].k, status, capital: String(20000 + Math.floor(rnd() * 8) * 10000), model: rnd() < 0.85 ? 'punkt' : 'bez_punktu', hasPremises: pick(['ma', 'szuka', '']), form: 'panstwo',
      nextTask: nt ? ['Telefon po prezentacji', 'Umówić spotkanie', 'Zebrać dane lokalu', 'Wysłać ofertę', 'Ponowna próba kontaktu'][Math.min(4, st)] : '', nextTaskDate: nt,
      meetingAt: st === 3 && status === 'umowione' ? isoDate(addDays(new Date(), Math.floor(rnd() * 6))) + 'T1' + Math.floor(rnd() * 6) + ':00' : '', meetingType: 'online', meetingPlace: '', notes: '', lostReason: lost ? pick(LOST_REASONS) : '', handoffs: [], history: hist, stageDates: sd, createdAt: isoDate(created), createdTs: created.toISOString(), updatedTs: created.toISOString() };
  }
  const wins = planWindows(plan);
  wins.forEach(([a], m) => { if (a > new Date()) return; computePlan(plan).rows.filter(r => r.spend > 0).forEach(r => { [0, 1, 2, 3].forEach(w => { const dt = addDays(a, w * 7 + 1); if (dt > new Date()) return; const id = uid('s'); d.spend[id] = { id, date: isoDate(dt), source: r.k, amount: Math.round(r.spend / 4 * (0.85 + rnd() * 0.3)), note: 'Dane przykładowe' }; }); }); });
  ROADMAP_TEMPLATE.forEach(([w, s, t], i) => { const id = 'demo-r' + i; d.tasks[id] = { id, kind: 'plan90', week: w, stream: s, title: t, ownerId: pick(memberIds), done: w < planWeekOf(plan) && rnd() < 0.85, order: i }; });
  const l0 = Object.values(d.leads).find(l => l.stage === 'lokalizacja' || l.stage === 'oferta') || Object.values(d.leads)[0];
  const loc = { ...clone(LOC_DEFAULTS), id: 'demo-loc1', name: `${l0.city} – ul. Przykładowa 12`, leadId: l0.id, address: 'ul. Przykładowa 12', city: l0.city, region: l0.region, cityPop: 135000, catchment: 15000, traffic: 2600, visibility: 4, parking: 'ograniczony', firms: 55, rent: 2600, createdAt: todayISO(),
    competitors: [{ name: 'Paczkomat przy markecie', type: 'automat', dist: 150, strength: 3 }, { name: 'Paczkomat – parking', type: 'automat', dist: 420, strength: 3 }, { name: 'Żabka', type: 'pudo', dist: 260, strength: 2 }, { name: 'Poczta Polska UP 3', type: 'poczta', dist: 900, strength: 3 }, { name: 'Punkt nadań „Paczka Expres”', type: 'multi', dist: 1700, strength: 4 }, { name: 'Orlen – stacja', type: 'pudo', dist: 1100, strength: 2 }] };
  d.locations[loc.id] = loc;
  return d;
}
