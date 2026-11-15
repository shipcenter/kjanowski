/* ===== Import, eksport (CSV / XLSX), ustawienia, dane podglądowe ===== */

const LEAD_FIELDS = [
  { k: 'name', n: 'Imię i nazwisko', keys: ['imie i nazwisko', 'imię i nazwisko', 'nazwisko', 'name', 'full name', 'full_name', 'kandydat', 'osoba', 'imie', 'imię', 'first name', 'first_name'] },
  { k: 'lastName', n: 'Nazwisko (osobno)', keys: ['nazwisko', 'last name', 'last_name', 'surname'] },
  { k: 'company', n: 'Firma', keys: ['firma', 'company', 'company name', 'company_name', 'nazwa firmy'] },
  { k: 'phone', n: 'Telefon', keys: ['telefon', 'tel', 'phone', 'phone number', 'phone_number', 'numer telefonu', 'nr telefonu', 'komórka'] },
  { k: 'email', n: 'E-mail', keys: ['email', 'e-mail', 'mail', 'adres e-mail', 'adres email'] },
  { k: 'city', n: 'Miasto', keys: ['miasto', 'city', 'miejscowość', 'miejscowosc', 'lokalizacja', 'location'] },
  { k: 'pointAddress', n: 'Adres planowanego punktu', keys: ['adres', 'adres punktu', 'adres lokalu', 'ulica', 'address', 'street'] },
  { k: 'nip', n: 'NIP', keys: ['nip', 'tax id', 'vat id'] },
  { k: 'region', n: 'Województwo', keys: ['województwo', 'wojewodztwo', 'region', 'state', 'woj'] },
  { k: 'source', n: 'Źródło', keys: ['źródło', 'zrodlo', 'source', 'kanał', 'kanal', 'utm_source', 'platform', 'platforma'] },
  { k: 'owner', n: 'Opiekun', keys: ['opiekun', 'owner', 'handlowiec', 'przypisany', 'assigned'] },
  { k: 'capital', n: 'Kapitał', keys: ['kapitał', 'kapital', 'budżet', 'budzet', 'capital', 'budget'] },
  { k: 'notes', n: 'Notatki', keys: ['notatki', 'notatka', 'uwagi', 'notes', 'komentarz', 'wiadomość', 'wiadomosc', 'message'] },
  { k: 'createdAt', n: 'Data zgłoszenia', keys: ['data', 'data zgłoszenia', 'data zgloszenia', 'created', 'created_time', 'created_at', 'date'] },
  { k: 'model', n: 'Model (franczyza / Ship Point)', keys: ['model', 'typ', 'typ zapytania', 'rodzaj zapytania', 'rodzaj', 'temat', 'formularz', 'subject', 'model współpracy'] },
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
    const status = o.status ? (STATUSES.find(s => normKey(s.n) === normKey(o.status) || s.k === normKey(o.status))?.k || 'do_kontaktu') : 'do_kontaktu';
    return {
      name, company: String(o.company || '').trim(), phone: String(o.phone || '').replace(/^p:/, '').trim(), email: String(o.email || '').trim(),
      city: String(o.city || '').trim(), region: matchRegion(o.region) || region, source: matchSource(o.source) || src, ownerId,
      model: /ship\s*-?\s*point|partner|point/i.test(String(o.model || '')) ? 'shippoint' : 'franczyza',
      capital: String(o.capital || '').replace(/[^\d]/g, ''), notes: String(o.notes || '').trim(), createdAt: parseDateLoose(o.createdAt) || todayISO(), status
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
    lead.stageDates = r.status === 'pozyskany' ? { umowa: r.createdAt } : {};
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
    'Miasto': l.city || '', 'Adres punktu': l.pointAddress || '', 'Województwo': l.region || '', 'NIP': l.nip || '', 'Firma (rejestr)': (l.companyData || {}).name || '', 'Adres firmy': (l.companyData || {}).address || '', 'REGON': (l.companyData || {}).regon || '', 'KRS': (l.companyData || {}).krs || '', 'Źródło': SOURCE_MAP[l.source]?.n || l.source || '', 'Opiekun': memberName(l.ownerId),
    'Etap': STAGES[stageIdx(l)].n, 'Status kontaktu': STATUS_MAP[l.status]?.n || '', 'Powód utraty': l.lostReason || '',
    'Model': modelName(modelOf(l)), 'Pakiet': l.pkg ? l.pkg.toUpperCase() : '', 'Pierwsza rozmowa': l.firstCallAt || '', 'Prezentacja wysłana': l.presentationAt || '', 'Kapitał (zł)': l.capital ? +l.capital : '', 'Lokal': ({ ma: 'ma lokal', szuka: 'szuka', nie: 'brak' })[l.hasPremises] || '',
    'Kolejny kontakt': l.nextTask || '', 'Termin kontaktu': l.nextTaskDate || '', 'Godzina': l.nextTaskTime || '', 'Spotkanie': l.meetingAt ? l.meetingAt.replace('T', ' ') : '', 'Forma spotkania': l.meetingType || '',
    'Ostatni kontakt': (lastContact(l) || '').replace('T', ' '), 'Liczba kontaktów': (l.history || []).filter(h => h.type !== 'system').length,
    'Data dodania': l.createdAt || '', ...(() => { const sd = stageDatesOf(l); return Object.fromEntries(STAGES.slice(3).map(s => ['Data: ' + s.short, sd[s.k] || ''])); })(), 'Notatki': l.notes || ''
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
    const all = leadsArr();
    const f = funnelOf(all);
    const byM = k => all.filter(l => modelOf(l) === k).length;
    const summary = [
      ['ShipCenter – rekrutacja franczyzobiorców', ''], ['Wygenerowano', new Date().toLocaleString('pl-PL')], ['Cel: nowe punkty / mies.', goal()], [],
      ['Leady razem', all.length], ['Franczyza', byM('franczyza')], ['Ship Point', byM('shippoint')], ['Aktywne', all.filter(isOpen).length], ['Po pierwszej rozmowie', all.filter(l => l.firstCallAt).length], ['Z wysłaną prezentacją', all.filter(l => l.presentationAt).length], [],
      ['Lejek (wszystkie leady)', 'Liczba', 'Konwersja z poprzedniego etapu'],
      ...STAGES.map((st, i) => [st.n, f.reached[i], i ? (f.conv[i - 1] ?? '') : ''])
    ];
    const ws = XLSX.utils.aoa_to_sheet(summary); ws['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Podsumowanie');
    XLSX.utils.book_append_sheet(wb, sheetFrom(Object.values(D().sms || {}).sort((x, y) => (x.createdTs || '').localeCompare(y.createdTs || '')).map(x => ({ 'Data': (x.createdTs || '').slice(0, 16).replace('T', ' '), 'Kandydat': x.leadName, 'Telefon': x.phone, 'Treść': x.text, 'Status': (SMS_STATUS[x.status] || [x.status])[0], 'Opiekun': memberName(x.ownerId) }))), 'SMS');
    const adsAll = Object.values(D().ads || {}).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
    if (adsAll.length) XLSX.utils.book_append_sheet(wb, sheetFrom(adsAll.map(x => ({ 'Data': x.date, 'Kampania': x.campaign || '', 'Koszt (zł)': +x.cost || 0, 'Wyświetlenia': +x.impressions || 0, 'Kliknięcia': +x.clicks || 0, 'Konwersje': +x.conversions || 0 }))), 'Google Ads');
    XLSX.utils.book_append_sheet(wb, sheetFrom(Object.values(D().locations).map(x => { const r = analyzeLocation(x); return { 'Analiza': x.name, 'Adres': x.address, 'Miasto': x.city, 'Województwo': x.region, 'Kandydat': x.leadId && D().leads[x.leadId] ? D().leads[x.leadId].name : '', 'Ocena': r.score, 'Klasa': r.grade, 'Werdykt': r.gradeText, 'Popyt (paczek/mies.)': Math.round(r.demand.base), 'Przepustowość': Math.round(r.capacity), 'Wykorzystanie %': Math.round(r.util * 100), 'Konkurenci do 3 km': r.compCount, 'Indeks konkurencji': Math.round(r.ci * 100) / 100, 'Przychód bazowy (zł/mies.)': Math.round(r.fin.base.revenue), 'Wynik bazowy (zł/mies.)': Math.round(r.fin.base.profit), 'Nakłady na start (zł)': Math.round(r.startup), 'Zwrot (mies.)': r.payback ? Math.round(r.payback * 10) / 10 : '' }; })), 'Lokalizacje');
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
    ...[['Przesyłki', 'parcels'], ['Przychód', 'revenue'], ['Koszt usług', 'cogs'], ['Koszty stałe', 'fixed'], ['Wynik', 'profit']].map(([n, k]) => [n, ...['low', 'base', 'high'].map(s => Math.round(r.fin[s][k]))]),
    [], ['Przychód (bazowy)', 'Liczba / mies.', 'Kwota (zł)'], ...r.fin.base.lines.map(l => [l.n, Math.round(l.count), Math.round(l.revenue)]),
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
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Konfiguracja</span><h1>Zespół i ustawienia</h1><p>Osoby, którym przypisujesz leady, integracje oraz parametry oferty używane w wiadomościach, SMS-ach i raportach lokalizacji.</p></div></div>`;
  const teamCard = `<div class="card"><div class="cardhead"><h2>Zespół</h2><p>${members.length} osób</p></div>
    ${members.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Osoba</th><th>Rola</th><th>Regiony</th><th>Kontakt</th><th class="r">Aktywne leady</th><th></th></tr></thead><tbody>
    ${members.map(m => `<tr><td><b>${esc(m.name)}</b></td><td class="small">${esc(m.role || '')}</td><td class="small">${esc((m.regions || []).join(', ') || '—')}</td><td class="small">${esc([m.phone, m.email].filter(Boolean).join(' · ') || '—')}</td><td class="r">${leadsArr().filter(l => l.ownerId === m.id && isOpen(l)).length}</td>
      <td><div class="row" style="flex-wrap:nowrap">${m.userId && m.userId === S.userId ? `<span class="pill good">to Ty</span><button class="btn sm ghost" data-act="me-unbind" data-id="${m.id}">Odłącz</button>` : m.userId ? '<span class="pill">połączono</span>' : (S.userId && !myMemberId() ? `<button class="btn sm" data-act="me-bind" data-id="${m.id}">To ja</button>` : '')}<button class="iconbtn" data-act="member-edit" data-id="${m.id}" aria-label="Edytuj">${ICONS.notatka}</button><button class="iconbtn" data-act="member-del" data-id="${m.id}" aria-label="Usuń">${ICONS.trash}</button></div></td></tr>`).join('')}
    </tbody></table></div>` : `<p class="muted">Dodaj osoby z centrali i opiekunów regionalnych – pojawią się w polu „Opiekun” przy leadach i w filtrach.</p>`}
    <div class="row" style="margin-top:10px"><button class="btn primary sm" data-act="member-new">${ICONS.plus}Dodaj osobę</button>${members.length ? '<button class="btn sm" data-act="auto-assign">Przypisz leady bez opiekuna wg regionów</button>' : ''}</div></div>`;
  const integ = settings().integrations || {};
  const st = on => on ? '<span class="pill good">działa</span>' : '<span class="pill">nie podłączono</span>';
  const integCard = `<div class="card"><div class="cardhead"><h2>Integracje</h2><p>Podłączane po stronie centrali – szczegóły ustalamy osobno</p></div>
    <div class="integr"><span class="ic">${ICONS.email}</span><div><b>Skrzynka franczyza@shipcenter.pl</b><p class="small ink2">Nowe zapytania „franczyza” i „Ship Point” z formularzy trafiają automatycznie do leadów, z właściwym modelem współpracy i bez duplikatów.</p></div>${st(integ.mail)}</div>
    <div class="integr"><span class="ic">${ICONS.sms}</span><div><b>Bramka SMS</b><p class="small ink2">SMS z podziękowaniem po pierwszej rozmowie wychodzi automatycznie. Do czasu podłączenia SMS-y czekają w kolejce (widok „Kontakty”).</p></div>${st(integ.sms)}</div>
    <div class="integr"><span class="ic">${ICONS.spotkanie}</span><div><b>Przypomnienia dla opiekunów</b><p class="small ink2">Codziennie rano e-mail z listą kontaktów na dziś i zaległych. Już teraz: licznik w menu „Kontakty” po wskazaniu „To ja”.</p></div>${st(integ.reminders)}</div>
    <div class="integr"><span class="ic">${ICONS.webinar}</span><div><b>Google Ads – kampania franczyza</b><p class="small ink2">Dzienne wydatki, kliknięcia i konwersje kampanii na dashboardzie, z kosztem leada i kosztem pozyskania punktu.</p></div>${st(integ.ads)}</div></div>`;
  const goalCard = `<div class="card"><div class="cardhead"><h2>Cel</h2></div><div class="formgrid"><label class="field"><span>Nowe punkty miesięcznie</span><input type="number" id="set-goal" data-setting="goal" min="0" step="0.5" value="${esc(goal())}"></label></div></div>`;
  const f = (k, label, type = 'text', hint = '') => `<label class="field"><span>${label}</span><input type="${type}" id="of-${k}" data-offer="${k}" value="${esc(o[k])}" ${type === 'number' ? 'step="any" min="0"' : ''}>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const offerCard = `<div class="card"><div class="cardhead"><h2>Parametry oferty</h2><p>Oferta franczyzowa 2026 (pakiet SMART / FLEX) i warunki z umowy</p></div>
    <div class="formgrid">
      ${f('licencja', 'Pakiet SMART – opłata jednorazowa (zł netto)', 'number')}${f('oplataMies', 'Opłata miesięczna poniżej progu (zł netto)', 'number')}
      ${f('progRabatu', 'Opłata 0 zł powyżej (paczek / mies.)', 'number')}${f('flexRabat', 'Maks. rabat FLEX na sprzęt (%)', 'number')}${f('prowizjaP24', 'Płatności online (% transakcji)', 'number')}
      ${f('minPaczek', 'Minimum paczek / mies.', 'number')}${f('ochrona', 'Ochrona terytorialna (km)', 'number')}
      ${f('licencjaBezPunktu', 'Franczyza bez punktu – licencja (zł)', 'number')}${f('partnerWstepna', 'Ship Point – opłata wstępna (zł)', 'number')}${f('partnerMies', 'Ship Point – abonament (zł / mies.)', 'number')}
      <label class="field span2"><span>Szkolenie</span><input type="text" id="of-szkolenie" data-offer="szkolenie" value="${esc(o.szkolenie)}"></label>
      <label class="field span2"><span>Uruchomienie punktu</span><input type="text" id="of-uruchomienie" data-offer="uruchomienie" value="${esc(o.uruchomienie)}"></label>
      <label class="field full"><span>Godziny otwarcia (standard)</span><input type="text" id="of-godziny" data-offer="godziny" value="${esc(o.godziny)}"></label>
      <label class="field full"><span>Przewoźnicy</span><input type="text" id="of-przewoznicy" data-offer="przewoznicy" value="${esc(o.przewoznicy)}"></label>
      ${f('email', 'E-mail działu franczyzy', 'email')}${f('telefon', 'Telefon', 'tel')}${f('www', 'Strona', 'text')}${f('adres', 'Adres centrali', 'text')}
      ${f('linkKalkulator', 'Link do kalkulatora franczyzy', 'url')}${f('smsPodpis', 'Podpis w SMS', 'text')}
      ${f('linkPrezentacja', 'Link do prezentacji – franczyza', 'url', 'np. PDF na Dysku Google; puste = prezentacja w załączniku')}${f('linkPrezentacjaShipPoint', 'Link do prezentacji – Ship Point', 'url')}
      ${f('linkUmowaFranczyza', 'Link do wzoru umowy franczyzowej z OWU (PDF)', 'url', 'Dysk Google: Udostępnij → „Każdy, kto ma link” → Kopiuj link')}${f('linkUmowaPartner', 'Link do wzoru umowy Partner / Ship Point (PDF)', 'url')}
      ${f('linkSpotkanie', 'Link do kalendarza spotkań', 'url', 'np. Calendly, Google Kalendarz')}${f('linkMeet', 'Domyślny link Google Meet', 'url', 'gdy opiekun nie ma własnego pokoju Meet')}${f('linkWebinar', 'Link do zapisów na webinar', 'url')}
    </div>
    <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-act="offer-reset">Przywróć wartości domyślne</button><span class="note">Zmiany zapisują się automatycznie po opuszczeniu pola.</span></div></div>`;
  const dataCard = `<div class="card"><div class="cardhead"><h2>Dane</h2></div>
    <div class="row"><button class="btn" data-act="export-xlsx">${ICONS.down}Eksport całego panelu (XLSX)</button><button class="btn" data-act="export-csv">${ICONS.down}Leady (CSV)</button><button class="btn" data-act="import-open">${ICONS.up}Import leadów</button>${!S.demo ? `<button class="btn ghost" data-act="demo-on">Podgląd na danych przykładowych</button>` : ''}</div>
    <p class="note" style="margin-top:8px">Dane panelu są wspólne dla wszystkich osób, którym udostępnisz stronę z prawem edycji (Contributor lub wyżej). Osoby z prawem podglądu widzą dane bez możliwości zmian. CSV używa średnika i kodowania UTF-8 – otwiera się poprawnie w polskim Excelu.</p></div>`;
  return head + `<div class="stack">${teamCard}${integCard}${goalCard}${offerCard}${dataCard}</div>`;
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
      <label class="field full"><span>Stały link Google Meet (opcjonalnie)</span><input type="url" id="mf-meet" value="${esc(m.meetLink || '')}" placeholder="https://meet.google.com/abc-defg-hij"><span class="hint">Wstawi się sam przy spotkaniach online tej osoby. Stały pokój: utwórz w Kalendarzu Google wydarzenie cykliczne z Google Meet i skopiuj jego link.</span></label>
      <div class="field full"><span>Regiony (do automatycznego przypisywania leadów)</span><div class="row">${REGIONS.map((r, i) => `<label class="chk small"><input type="checkbox" id="mf-reg-${i}" value="${esc(r)}" ${(m.regions || []).includes(r) ? 'checked' : ''}>${esc(r)}</label>`).join('')}</div></div>
    </div></form>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="mf-save">Zapisz</button></div>`);
  const save = () => {
    const name = $('#mf-name').value.trim();
    if (!name) { toast('Wpisz imię i nazwisko.', 'bad'); return; }
    put('team', m.id, { ...m, name, role: $('#mf-role').value, phone: $('#mf-phone').value.trim(), email: $('#mf-email').value.trim(), meetLink: $('#mf-meet').value.trim(), regions: REGIONS.filter((r, i) => $('#mf-reg-' + i).checked) });
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
  const rnd = (() => { let x = 7; return () => (x = (x * 16807) % 2147483647) / 2147483647; })();
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const people = [['Przykład: Marta Zielińska', 'Centrala – dyrektor rozwoju', ['śląskie', 'opolskie', 'małopolskie']], ['Przykład: Paweł Nowicki', 'Opiekun regionalny', ['mazowieckie', 'łódzkie', 'podlaskie', 'lubelskie']], ['Przykład: Tomasz Wrona', 'Opiekun regionalny', ['wielkopolskie', 'dolnośląskie', 'pomorskie', 'kujawsko-pomorskie', 'podkarpackie', 'świętokrzyskie']]];
  people.forEach(([name, role, regions], i) => { const id = 'demo-m' + i; d.team[id] = { id, name, role, regions, phone: '+48 600 000 0' + pad(i + 10), email: `demo${i + 1}@example.com`, userId: i === 0 && S.userId ? S.userId : '' }; });
  const memberIds = Object.keys(d.team);
  d.settings = { goal: 2.5, offer: { ...(settings().offer || {}) } };
  const cities = [['Rybnik', 'śląskie'], ['Opole', 'opolskie'], ['Płock', 'mazowieckie'], ['Radom', 'mazowieckie'], ['Łódź', 'łódzkie'], ['Białystok', 'podlaskie'], ['Tarnów', 'małopolskie'], ['Rzeszów', 'podkarpackie'], ['Kielce', 'świętokrzyskie'], ['Kalisz', 'wielkopolskie'], ['Legnica', 'dolnośląskie'], ['Słupsk', 'pomorskie'], ['Toruń', 'kujawsko-pomorskie'], ['Gliwice', 'śląskie'], ['Lublin', 'lubelskie']];
  const first = ['Anna', 'Piotr', 'Katarzyna', 'Michał', 'Agnieszka', 'Krzysztof', 'Magdalena', 'Łukasz', 'Joanna', 'Marcin', 'Natalia', 'Adam', 'Karolina', 'Jakub', 'Monika', 'Grzegorz'];
  const last = ['Kowalczyk', 'Wiśniewski', 'Lewandowska', 'Dąbrowski', 'Mazur', 'Kaczmarek', 'Zając', 'Pawlak', 'Michalska', 'Sikora', 'Baran', 'Wróbel', 'Górska', 'Jabłoński'];
  const srcW = ['google', 'google', 'google', 'google', 'www', 'www', 'meta', 'portale', 'polecenia', 'inne'];
  const conv = [0.78, 0.65, 0.4, 0.4];
  const t = todayISO();
  for (let i = 0; i < 120; i++) {
    const age = Math.floor(Math.pow(rnd(), 0.9) * 75);
    const created = addDays(new Date(), -age);
    let st = 0; while (st < NS - 1 && rnd() < conv[st] && age > st * 9) st++;
    const [city, region] = pick(cities);
    const owner = rnd() < 0.06 ? '' : (Object.values(d.team).find(m => m.regions.includes(region)) || {}).id || pick(memberIds);
    const lost = st < NS - 1 && age > 20 && rnd() < 0.35;
    const sd = {}; if (st >= 3) sd.spotkanie = isoDate(addDays(created, Math.min(age, 8 + Math.round(rnd() * 10)))); if (st >= 4) sd.umowa = isoDate(addDays(created, Math.min(age, 20 + Math.round(rnd() * 20))));
    const fn = pick(first), ln = pick(last);
    const model = rnd() < 0.72 ? 'franczyza' : 'shippoint';
    const status = st === 4 ? 'pozyskany' : lost ? 'utracony' : st === 0 ? (age > 2 ? 'proba' : 'do_kontaktu') : st === 3 && rnd() < 0.4 ? 'umowione' : pick(['w_kontakcie', 'czeka', 'w_kontakcie', 'wstrzymany']);
    const firstCallAt = st >= 1 ? isoDate(addDays(created, Math.min(age, rnd() < 0.75 ? 0 : 2))) : '';
    const presentationAt = st >= 2 ? isoDate(addDays(parseD(firstCallAt || isoDate(created)), Math.min(age, 1))) : '';
    const hist = [histEntry('system', 'Zapytanie z formularza: ' + (model === 'shippoint' ? 'Ship Point' : 'franczyza') + ' (dane przykładowe)')];
    hist[0].at = isoDate(created) + 'T09:00';
    if (firstCallAt) hist.push({ id: uid('h'), at: firstCallAt + 'T10:30', type: 'tel', text: 'Pierwsza rozmowa – omówiony pakiet SMART, pytania o lokal.', result: 'Rozmowa przeprowadzona', by: owner });
    if (presentationAt) hist.push({ id: uid('h'), at: presentationAt + 'T11:00', type: 'email', text: 'Wysłano prezentację', result: 'Wysłano materiały', by: owner });
    if (sd.spotkanie) hist.push({ id: uid('h'), at: sd.spotkanie + 'T13:15', type: 'spotkanie', text: 'Spotkanie online – pytania o lokal i konkurencję paczkomatów.', result: 'Spotkanie odbyte', by: owner });
    if (sd.umowa) hist.push({ id: uid('h'), at: sd.umowa + 'T12:00', type: 'notatka', text: 'Umowa podpisana.', result: 'Inne', by: owner });
    const id = 'demo-l' + pad(i);
    const open = !['pozyskany', 'utracony'].includes(status);
    const nt = open && (st > 0 || rnd() < 0.5) && rnd() < 0.9 ? isoDate(addDays(new Date(), Math.floor(rnd() * 11) - 3)) : '';
    d.leads[id] = { id, name: `${fn} ${ln}`, company: model === 'shippoint' ? `${ln} – sklep` : '', phone: '+48 5' + String(10000000 + Math.floor(rnd() * 89999999)), email: `${fn}.${ln}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l') + '@example.com', city, region, source: pick(srcW), ownerId: owner, status, capital: String(20000 + Math.floor(rnd() * 8) * 10000), model, pkg: model === 'franczyza' && st >= 2 ? pick(['smart', 'flex', '']) : '', hasPremises: pick(['ma', 'szuka', '']), form: 'panstwo',
      nextTask: nt ? (presentationAt ? 'Telefon po prezentacji' : firstCallAt ? 'Umówić spotkanie' : 'Pierwsza rozmowa telefoniczna') : '', nextTaskDate: nt, nextTaskTime: nt && rnd() < 0.4 ? pick(['09:30', '11:00', '13:00', '15:30']) : '', firstCallAt, presentationAt,
      meetingAt: st === 3 && status === 'umowione' ? isoDate(addDays(new Date(), Math.floor(rnd() * 6))) + 'T1' + Math.floor(rnd() * 6) + ':00' : '', meetingType: 'online', meetingPlace: '', notes: '', lostReason: lost ? pick(LOST_REASONS) : '', handoffs: [], history: hist, stageDates: sd, createdAt: isoDate(created), createdTs: created.toISOString(), updatedTs: created.toISOString() };
    if (firstCallAt && rnd() < 0.6 && age < 30) { const sid = uid('sms'); d.sms[sid] = { leadId: id, leadName: `${fn} ${ln}`, phone: d.leads[id].phone, text: smsThanksText(d.leads[id]), ownerId: owner, status: age < 1 ? 'oczekuje' : 'wyslany', createdTs: firstCallAt + 'T10:35:00.000Z', id: sid }; }
  }
  for (let k = 0; k < 75; k++) { const dt = isoDate(addDays(new Date(), -k)); const cost = Math.round(380 + rnd() * 260); const clicks = Math.round(cost / (3.5 + rnd() * 2)); d.ads['demo-' + dt] = { id: 'demo-' + dt, date: dt, campaign: 'Franczyza – Search (przykład)', cost, clicks, impressions: clicks * Math.round(14 + rnd() * 10), conversions: Math.round(rnd() * 3 * 10) / 10 }; }
  const l0 = Object.values(d.leads).find(l => stageIdx(l) === 3) || Object.values(d.leads)[0];
  const loc = { ...clone(LOC_DEFAULTS), id: 'demo-loc1', name: `${l0.city} – ul. Przykładowa 12`, leadId: l0.id, address: 'ul. Przykładowa 12', city: l0.city, region: l0.region, cityPop: 135000, catchment: 15000, traffic: 2600, visibility: 4, parking: 'ograniczony', firms: 55, rent: 2600, createdAt: t,
    competitors: [{ name: 'Punkt Epaka – sklep papierniczy (przykład)', type: 'epaka', dist: 650, strength: 3 }, { name: 'Pakersi – ul. Przykładowa 3 (przykład)', type: 'pakersi', dist: 1900, strength: 4 }] };
  d.locations[loc.id] = loc;
  return d;
}
