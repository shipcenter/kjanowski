/* ===== Leady: lista, kanban, formularz, widok pojedynczego leada ===== */

const LEAD_COLS = [
  { k: 'code', n: 'Kod', get: l => leadCode(l.id) },
  { k: 'name', n: 'Kandydat', get: l => (l.name || '').toLowerCase() },
  { k: 'city', n: 'Miasto / region', get: l => (l.city || '').toLowerCase() },
  { k: 'model', n: 'Model', get: l => modelOf(l) },
  { k: 'stage', n: 'Etap', get: l => stageIdx(l) },
  { k: 'status', n: 'Status', get: l => l.status },
  { k: 'mail', n: 'E-mail', nosort: true },
  { k: 'nextTaskDate', n: 'Następne zadanie', get: l => l.nextTaskDate || '9999' },
  { k: 'meetingAt', n: 'Spotkanie', get: l => l.meetingAt || '9999' },
  { k: 'last', n: 'Ostatni kontakt', get: l => lastContact(l) || '' },
  { k: 'createdAt', n: 'Dodano', get: l => l.createdTs || l.createdAt || '' }
];

function sortedLeads(arr) {
  const c = LEAD_COLS.find(x => x.k === S.sort.key) || LEAD_COLS[LEAD_COLS.length - 1];
  const dir = S.sort.dir === 'asc' ? 1 : -1;
  return arr.slice().sort((a, b) => { const x = c.get(a), y = c.get(b); return (x > y ? 1 : x < y ? -1 : 0) * dir; });
}

function viewLeads() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie leadów…</div>`;
  const all = leadsArr();
  const list = sortedLeads(filterLeads(all));
  S.ui.visibleLeadIds = list.map(l => l.id);
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Baza kandydatów</span><h1>Leady</h1>
    <p>${fmt(list.length)} z ${fmt(all.length)} leadów${filtersActive() ? ' (filtr aktywny)' : ''} · aktywnych: ${fmt(list.filter(isOpen).length)}</p></div>
    <div class="actions">
      <div class="tabs" role="tablist"><button class="${S.leadsView === 'tabela' ? 'on' : ''}" data-act="leads-view" data-v="tabela">Tabela</button><button class="${S.leadsView === 'kanban' ? 'on' : ''}" data-act="leads-view" data-v="kanban">Lejek (kanban)</button></div>
      <button class="btn" data-act="import-open">${ICONS.up}Importuj</button>
      <button class="btn" data-act="export-csv" ${all.length ? '' : 'disabled'}>${ICONS.down}CSV</button>
      <button class="btn" data-act="export-xlsx-leads" ${all.length ? '' : 'disabled'}>${ICONS.down}XLSX</button>
      <button class="btn primary" data-act="lead-new">${ICONS.plus}Dodaj lead</button>
    </div></div>`;
  if (!all.length) return head + emptyLeadsState();
  const bulk = S.selected.size ? `<div class="filters" style="background:var(--accent-wash);border-color:var(--accent)">
    <b style="align-self:center">${S.selected.size} zaznaczonych</b>
    <label class="field"><span>Przypisz opiekuna</span><select id="bulk-owner">${ownerOpts('', false, '— wybierz —')}</select></label>
    <label class="field"><span>Zmień status</span><select id="bulk-status">${opt('', '— wybierz —', '')}${statusOpts('')}</select></label>
    <button class="btn primary" data-act="bulk-apply">Zastosuj</button>
    <button class="btn danger" data-act="bulk-delete">${ICONS.trash}Usuń</button>
    <button class="btn ghost" data-act="bulk-clear">Odznacz</button></div>` : '';
  const body = S.leadsView === 'kanban' ? kanbanHTML(list) : tableHTML(list);
  return head + filterBar({ period: false }) + bulk + body;
}

function tableHTML(list) {
  if (!list.length) return `<div class="card"><div class="empty"><h3>Brak leadów dla wybranych filtrów</h3><button class="btn" data-act="filters-clear">Wyczyść filtry</button></div></div>`;
  const allSel = list.length && list.every(l => S.selected.has(l.id));
  const th = c => c.nosort ? `<th>${c.n}</th>` : `<th class="sortable" data-act="sort" data-k="${c.k}">${c.n}${S.sort.key === c.k ? (S.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`;
  return `<div class="tablewrap"><table class="t"><thead><tr><th><input type="checkbox" id="sel-all" data-act="sel-all" ${allSel ? 'checked' : ''} aria-label="Zaznacz wszystkie"></th>${LEAD_COLS.map(th).join('')}</tr></thead><tbody>
  ${list.map(l => {
    const lc = lastContact(l);
    return `<tr class="click" data-act="open-lead" data-id="${l.id}">
      <td data-stop="1"><input type="checkbox" data-act="sel" data-id="${l.id}" ${S.selected.has(l.id) ? 'checked' : ''} aria-label="Zaznacz"></td>
      <td><span class="code">${leadCode(l.id)}</span></td>
      <td><div class="cellname"><b>${esc(l.name || '(bez nazwy)')}</b><span class="tiny muted">${esc(l.company || l.phone || l.email || '')}</span></div></td>
      <td>${esc(l.city || '—')}<div class="tiny muted">${esc(l.region || '')}</div></td>
      <td>${modelPill(l)}</td>
      <td>${stageBar(l)}<div class="tiny muted">${esc(STAGES[stageIdx(l)].short)}</div></td>
      <td>${statusPill(l.status)}</td>
      <td data-stop="1"><button class="btn sm primary" style="white-space:nowrap" data-act="mail-compose" data-id="${l.id}" title="${esc(l.email ? 'Napisz do: ' + l.email : 'Brak adresu e-mail – wpiszesz go w oknie wiadomości')}">${ICONS.email}Wyślij e-mail</button></td>
      <td style="min-width:170px"><span class="small">${esc(l.nextTask || '—')}</span><div class="tiny ${dueCls(l.nextTaskDate)}">${l.nextTaskDate ? fdate(l.nextTaskDate) + (l.nextTaskTime ? ' ' + esc(l.nextTaskTime) : '') : ''}</div></td>
      <td class="small ${dueCls(l.meetingAt)}">${l.meetingAt ? fdt(l.meetingAt) : '—'}</td>
      <td class="small">${lc ? fdateShort(lc) : '<span class="muted">brak</span>'}</td>
      <td class="small muted">${fdate(l.createdAt)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function kanbanHTML(list) {
  return `<p class="note" style="margin-bottom:8px">Kolumny to etapy ustawiane automatycznie: pierwsza rozmowa, prezentacja, spotkanie, umowa. Kliknij kartę, aby otworzyć leada.</p><div class="kanban">${STAGES.map((s, i) => {
    const items = list.filter(l => stageIdx(l) === i);
    return `<div class="kcol"><h3><span>${esc(s.n)}</span><span class="muted num">${items.length}</span></h3>
      ${items.map(l => `<div class="kcard" data-act="open-lead" data-id="${l.id}" style="cursor:pointer">
        <div class="row between"><b>${esc(l.name || '(bez nazwy)')}</b><span class="code">${leadCode(l.id)}</span></div>
        <span class="tiny muted">${esc([l.city, memberName(l.ownerId)].filter(Boolean).join(' · ') || '—')}</span>
        <div class="row">${modelPill(l)}${statusPill(l.status)}</div>
        ${l.nextTaskDate ? `<span class="tiny ${dueCls(l.nextTaskDate)}">${esc(l.nextTask || 'Kontakt')} · ${fdateShort(l.nextTaskDate)}</span>` : ''}
      </div>`).join('')}</div>`;
  }).join('')}</div>`;
}

/* ---------- formularz leada ---------- */
function leadFormFields(l, prefix = 'lf') {
  return `<div class="formgrid">
    <label class="field span2"><span>Imię i nazwisko *</span><input type="text" id="${prefix}-name" value="${esc(l.name)}" required></label>
    <label class="field"><span>Firma (opcjonalnie)</span><input type="text" id="${prefix}-company" value="${esc(l.company)}"></label>
    <label class="field"><span>NIP</span><input type="text" id="${prefix}-nip" data-nip-auto="${prefix}" inputmode="numeric" value="${esc(l.nip ? nipFmt(l.nip) : '')}" placeholder="np. 634-286-76-10"><span class="hint ${l.nip && !nipValid(l.nip) ? 'overdue' : ''}" id="${prefix}-nip-st">${l.nip ? (nipValid(l.nip) ? 'NIP poprawny' + (l.companyData ? ' · dane firmy pobrane' : '') : 'Błędny NIP – sprawdź cyfry') : (prefix === 'lf' ? 'Po wpisaniu NIP-u dane firmy uzupełnią się same' : '')}</span></label>
    <label class="field"><span>Telefon</span><input type="tel" id="${prefix}-phone" value="${esc(l.phone)}"></label>
    <label class="field"><span>E-mail</span><input type="email" id="${prefix}-email" value="${esc(l.email)}"></label>
    ${prefix === 'lf' ? `<div class="field full" id="lf-companybox"></div>` : ''}
    <label class="field span2"><span>Adres planowanego punktu (opcjonalnie)</span><input type="text" id="${prefix}-pointAddress" value="${esc(l.pointAddress || '')}" placeholder="ulica i numer, jeśli kandydat ma już lokal na oku"></label>
    <label class="field"><span>Miasto planowanego punktu</span><input type="text" id="${prefix}-city" value="${esc(l.city)}"></label>
    <label class="field"><span>Województwo</span><select id="${prefix}-region">${regionOpts(l.region)}</select></label>
    <label class="field"><span>Źródło</span><select id="${prefix}-source">${sourceOpts(l.source)}</select></label>
    <label class="field"><span>Opiekun</span><select id="${prefix}-owner">${ownerOpts(l.ownerId)}</select></label>
    <label class="field"><span>Model współpracy (rodzaj zapytania)</span><select id="${prefix}-model">${MODELS.map(m => opt(m.k, m.n, modelOf(l))).join('')}</select></label>
    <label class="field"><span>Pakiet (franczyza)</span><select id="${prefix}-pkg">${opt('', 'jeszcze nie wiadomo', l.pkg)}${Object.entries(PACKAGES).map(([k, n]) => opt(k, n, l.pkg)).join('')}</select></label>
    <label class="field"><span>Kapitał deklarowany (zł)</span><input type="number" id="${prefix}-capital" min="0" step="1000" value="${esc(l.capital)}"></label>
    <label class="field"><span>Lokal</span><select id="${prefix}-premises">${opt('', 'nie wiadomo', l.hasPremises)}${opt('ma', 'ma lokal', l.hasPremises)}${opt('szuka', 'szuka lokalu', l.hasPremises)}${opt('nie', 'nie ma i nie szuka', l.hasPremises)}</select></label>
    <label class="field"><span>Forma zwrotu w wiadomościach</span><select id="${prefix}-form">${opt('panstwo', 'Państwo (neutralnie)', l.form)}${opt('pan', 'Pan', l.form)}${opt('pani', 'Pani', l.form)}${opt('ty', 'Ty (bezpośrednio)', l.form)}</select></label>
  </div>`;
}
function readLeadForm(prefix = 'lf') {
  const v = id => ($('#' + prefix + '-' + id) || {}).value || '';
  return { name: v('name').trim(), company: v('company').trim(), phone: v('phone').trim(), email: v('email').trim(), city: v('city').trim(), pointAddress: v('pointAddress').trim(), region: v('region'), source: v('source'), ownerId: v('owner'), model: v('model'), pkg: v('pkg'), nip: nipDigits(v('nip')), capital: v('capital'), hasPremises: v('premises'), form: v('form') };
}
function openLeadModal() {
  const l = newLead({ ownerId: S.f.owner && S.f.owner !== '_none' ? S.f.owner : (myMemberId() || ''), source: S.f.source || 'google', region: S.f.region || '', model: S.f.model || 'franczyza' });
  REG.pending.lf = null;
  openModal(`<div class="mh"><h2>Nowy lead</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <form class="mb" id="lead-form">${leadFormFields(l)}
      <div class="formgrid">
        <label class="field span2"><span>Następne zadanie</span><input type="text" id="lf-task" value="${esc(l.nextTask)}"></label>
        <label class="field"><span>Termin</span><input type="date" id="lf-taskdate" value="${l.nextTaskDate}"></label>
        <label class="field full"><span>Notatka</span><textarea id="lf-notes" rows="3" placeholder="Skąd się zgłosił, czego oczekuje, pierwsze ustalenia…"></textarea></label>
      </div>
    </form>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn" id="lf-save-more">Zapisz i dodaj kolejny</button><button class="btn primary" id="lf-save">Zapisz i otwórz</button></div>`);
  const save = (openAfter) => {
    const d = readLeadForm();
    if (!d.name) { toast('Wpisz imię i nazwisko kandydata.', 'bad'); $('#lf-name').focus(); return; }
    const dup = findDuplicate(d);
    const lead = newLead({ ...d, nextTask: $('#lf-task').value.trim(), nextTaskDate: $('#lf-taskdate').value, notes: $('#lf-notes').value.trim() });
    const pc = REG.pending.lf;
    if (pc && d.nip && nipDigits(pc.nip) === d.nip) lead.companyData = pc;
    REG.pending.lf = null;
    lead.history = [histEntry('system', 'Lead dodany ręcznie' + (d.ownerId ? ' · opiekun: ' + memberName(d.ownerId) : ''))];
    put('leads', lead.id, lead);
    toast(dup ? `Zapisano. Uwaga: podobny lead już istnieje (${dup.name}).` : 'Lead zapisany');
    if (openAfter) { closeModal(); go('lead-' + lead.id); } else { closeModal(); openLeadModal(); }
  };
  $('#lf-save').onclick = () => save(true);
  $('#lf-save-more').onclick = () => save(false);
  $('#lead-form').onsubmit = e => { e.preventDefault(); save(true); };
}
const normPhone = p => String(p || '').replace(/\D/g, '').replace(/^48(?=\d{9}$)/, '');
function findDuplicate(d, pool = leadsArr()) {
  const e = (d.email || '').toLowerCase().trim(), p = normPhone(d.phone);
  return pool.find(l => (e && (l.email || '').toLowerCase().trim() === e) || (p && p.length >= 9 && normPhone(l.phone) === p));
}

/* ---------- widok pojedynczego leada ---------- */
function viewLead(id) {
  if (isLoading()) return `<div class="skeleton">Wczytywanie…</div>`;
  const l = D().leads[id];
  if (!l) return `<div class="card"><div class="empty"><h3>Nie znaleziono leada</h3><p>Mógł zostać usunięty albo link jest niepełny.</p><a class="btn" href="#leady">Wróć do listy</a></div></div>`;
  const i = stageIdx(l);
  const lc = lastContact(l);
  const ids = S.ui.visibleLeadIds || [];
  const pos = ids.indexOf(id);
  const prevId = pos > 0 ? ids[pos - 1] : null, nextId = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;
  const locs = Object.values(D().locations).filter(x => x.leadId === id);
  const hist = (l.history || []).filter(isManualEntry).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const o = offer();

  const head = `<div class="row between" style="margin-bottom:10px"><a class="btn ghost sm" href="#leady">${ICONS.back}Lista leadów</a>
    <div class="row">${prevId ? `<a class="btn sm" href="#lead-${prevId}">← Poprzedni</a>` : ''}${nextId ? `<a class="btn sm" href="#lead-${nextId}">Następny →</a>` : ''}</div></div>
    <div class="leadhead"><div class="who"><span class="code">${leadCode(l.id)} · dodano ${fdate(l.createdAt)} · ${esc(SOURCE_MAP[l.source]?.n || '')}</span>
      <h1>${esc(l.name || '(bez nazwy)')}</h1>
      <p class="ink2">${esc([l.company, l.city, l.region].filter(Boolean).join(' · ') || 'Uzupełnij miasto i województwo')}</p>
      <div class="row" style="margin-top:6px">${modelPill(l)}<span class="pill ${isWon(l) ? 'good' : ''}" title="Etap ustawia się sam na podstawie rozmów, prezentacji i spotkań">Etap: ${esc(STAGES[i].n)}</span>${statusPill(l.status)}${lc ? `<span class="pill">ostatni kontakt ${fdateShort(lc)}</span>` : `<span class="pill warn">brak kontaktu</span>`}</div></div>
      <div class="stack" style="gap:8px;min-width:240px">
        <label class="field"><span>Opiekun</span><select id="ld-owner" data-lead-field="ownerId">${ownerOpts(l.ownerId)}</select></label>
        <label class="field"><span>Status kontaktu</span><select id="ld-status" data-lead-field="status">${statusOpts(l.status)}</select></label>
        ${l.status === 'utracony' ? `<label class="field"><span>Powód utraty</span><select id="ld-lost" data-lead-field="lostReason">${opt('', '— wybierz —', l.lostReason)}${LOST_REASONS.map(r => opt(r, r, l.lostReason)).join('')}</select></label>` : ''}
      </div></div>
`;

  const contact = `<div class="card"><div class="cardhead"><h2>Dane kandydata</h2><p>Zmiany zapisują się po opuszczeniu pola</p></div>
    <div id="lead-edit" data-lead="${l.id}">${leadFormFields(l, 'le')}</div>
    <div class="row" style="margin-top:10px">${l.phone ? `<span class="pill outline mono">${esc(l.phone)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(l.phone)}">${ICONS.copy}Kopiuj telefon</button>` : ''}${l.email ? `<span class="pill outline mono">${esc(l.email)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(l.email)}">${ICONS.copy}Kopiuj e-mail</button>` : ''}</div>
    ${companyBox(l)}
    <div class="sep"></div>
    <label class="field"><span>Notatki</span><textarea id="ld-notes" data-lead-field="notes" rows="5" placeholder="Motywacja, sytuacja finansowa, lokal, obawy, ustalenia…">${esc(l.notes)}</textarea></label></div>`;

  const t0 = todayISO();
  const nextCls = !l.nextTaskDate ? '' : l.nextTaskDate < t0 ? 'late' : l.nextTaskDate === t0 ? 'due' : '';
  const smsList = smsListFor(l.id);
  const next = `<div class="card"><div class="cardhead"><h2>Przebieg kontaktu</h2><p>${l.firstCallAt ? 'pierwsza rozmowa ' + fdate(l.firstCallAt) : 'czeka na pierwszą rozmowę'}</p></div>
    <div class="progress3">
      <div class="pstep ${l.firstCallAt ? 'done' : 'due'}"><span class="lbl">1 · Pierwsza rozmowa</span>${l.firstCallAt ? `<span class="val">${fdate(l.firstCallAt)}</span>` : `<span class="small ink2">Zadzwoń, porozmawiaj i zapisz notatkę. Po rozmowie można wysłać SMS z podziękowaniem.</span><button class="btn sm primary" data-act="call-log" data-id="${l.id}">Zapisz pierwszą rozmowę</button>`}</div>
      <div class="pstep ${l.presentationAt ? 'done' : ''}"><span class="lbl">2 · Prezentacja${modelOf(l) === 'franczyza' ? ' i kalkulator' : ''}</span>
        ${l.presentationAt ? `<span class="val">prezentacja ${fdate(l.presentationAt)}</span>${l.presentationLastAt && l.presentationLastAt !== l.presentationAt ? `<span class="tiny muted">ponownie ${fdate(l.presentationLastAt)}${l.presentationSends > 2 ? ' · razem ' + l.presentationSends + '×' : ''}</span>` : ''}` : `<span class="small ink2">Wyślij kandydatowi maila z prezentacją${modelOf(l) === 'franczyza' ? ' albo z linkiem do kalkulatora' : ''}.</span>`}
        ${l.calcSentAt ? `<span class="small">kalkulator ${fdate(l.calcLastAt || l.calcSentAt)}</span>` : ''}
        <button class="btn sm ${l.presentationAt ? '' : 'primary'}" data-act="mail-tpl" data-id="${l.id}" data-tpl="email_prezentacja">${ICONS.email}${l.presentationAt ? 'Wyślij ponownie prezentację' : 'Mail z prezentacją'}</button>
        ${modelOf(l) === 'franczyza' ? `<button class="btn sm" data-act="mail-tpl" data-id="${l.id}" data-tpl="email_kalkulator">${ICONS.email}${l.calcSentAt ? 'Wyślij ponownie kalkulator' : 'Mail z kalkulatorem'}</button>` : ''}
        ${l.presentationAt ? `<button class="btn sm ghost" data-act="pres-clear" data-id="${l.id}">Cofnij datę prezentacji</button>` : `<details><summary class="small muted" style="cursor:pointer">Zaznacz bez maila</summary><div class="stack" style="gap:6px;margin-top:6px"><button class="btn sm ghost" data-act="pres-sent" data-id="${l.id}">Prezentacja wysłana dziś</button><label class="field"><span>…albo innego dnia</span><input type="date" id="ld-pres" data-lead-field="presentationAt" value=""></label></div></details>`}
      </div>
      ${isWon(l) ? trainingStep(l) : `      <div class="pstep ${nextCls}"><span class="lbl">3 · Kolejny kontakt</span>
        <input type="text" id="ld-task" data-lead-field="nextTask" value="${esc(l.nextTask)}" list="task-sugg" placeholder="Co zrobić, np. telefon po prezentacji" aria-label="Kolejny kontakt – co zrobić">
        <div class="row" style="flex-wrap:nowrap"><input type="date" id="ld-taskdate" data-lead-field="nextTaskDate" value="${esc(l.nextTaskDate)}" aria-label="Data kolejnego kontaktu"><input type="time" id="ld-tasktime" data-lead-field="nextTaskTime" value="${esc(l.nextTaskTime || '')}" aria-label="Godzina" style="max-width:110px"></div>
        <div class="row">${[1, 3, 7].map(d => `<button class="btn sm" data-act="task-shift" data-id="${l.id}" data-d="${d}">+${d} ${d === 1 ? 'dzień' : 'dni'}</button>`).join('')}</div>
        ${l.nextTaskDate ? `<span class="tiny ${dueCls(l.nextTaskDate)}">${nextCls === 'late' ? 'Zaległe od ' + fdate(l.nextTaskDate) : nextCls === 'due' ? 'Na dziś – przypomnienie w menu „Kontakty”' : 'Przypomnienie: ' + fdate(l.nextTaskDate)}</span>` : '<span class="tiny muted">Brak terminu – lead nie pojawi się w przypomnieniach.</span>'}
      </div>
`}
    </div>
    <datalist id="task-sugg">${['Pierwsza rozmowa telefoniczna', 'Ponowna próba kontaktu', 'Telefon po prezentacji', 'Umówić spotkanie', 'Zebrać dane do analizy lokalizacji', 'Wysłać ofertę i projekt umowy', 'Telefon decyzyjny', 'Zaplanować szkolenie'].map(x => `<option value="${x}">`).join('')}</datalist>
    <div class="row" style="margin-top:12px"><button class="btn primary" data-act="call-log" data-id="${l.id}">${ICONS.tel}Zapisz rozmowę / kontakt</button><button class="btn" data-act="mail-compose" data-id="${l.id}">${ICONS.email}Napisz e-mail do klienta</button>${l.phone ? `<span class="pill outline mono">${esc(l.phone)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(l.phone)}">${ICONS.copy}Kopiuj</button>` : '<span class="note">Brak telefonu – uzupełnij w danych kandydata.</span>'}</div>
    ${smsList.length ? `<div class="sep"></div><h3 style="margin-bottom:6px">SMS</h3>${smsList.map(x => { const st = SMS_STATUS[x.status] || SMS_STATUS.oczekuje; return `<div class="contact-row"><span class="when">${fdateShort(x.createdTs)}</span><div style="min-width:0"><span class="pill ${st[1]}">${st[0]}</span> <span class="tiny muted">${esc(x.phone)}</span><div class="small ink2">${esc(x.text)}</div>${x.error ? `<div class="tiny overdue">${esc(x.error)}</div>` : ''}</div><div class="ctl">${x.status === 'oczekuje' ? `<button class="btn sm ghost" data-act="copy" data-text="${esc(x.text)}">${ICONS.copy}</button><button class="btn sm" data-act="sms-done" data-id="${x.id}">Wysłany ręcznie</button>` : ''}</div></div>`; }).join('')}` : ''}
  </div>`;

  const contract = contractCard(l);
  const meeting = `<div class="card"><div class="cardhead"><h2>Spotkanie</h2>${l.meetingAt ? `<p class="${dueCls(l.meetingAt)}">${fdt(l.meetingAt)}</p>` : ''}</div>
    <div class="formgrid"><label class="field"><span>Termin</span><input type="datetime-local" id="ld-meet" data-lead-field="meetingAt" value="${esc(l.meetingAt)}"></label>
    <label class="field"><span>Forma</span><select id="ld-meettype" data-lead-field="meetingType">${opt('', '—', l.meetingType)}${opt('online', 'Online (wideo)', l.meetingType)}${opt('telefon', 'Telefon', l.meetingType)}${opt('centrala', 'Centrala – Katowice', l.meetingType)}${opt('lokal', 'W planowanym lokalu', l.meetingType)}${opt('punkt', 'W działającym punkcie', l.meetingType)}</select></label>
    <label class="field full"><span>${l.meetingType === 'online' ? 'Link do spotkania (Google Meet)' : 'Miejsce / link'}</span><input type="text" id="ld-meetplace" data-lead-field="meetingPlace" value="${esc(l.meetingPlace)}" placeholder="${l.meetingType === 'online' ? 'https://meet.google.com/…' : 'Adres lub link do spotkania'}"></label></div>
    ${l.meetingType === 'online' ? meetHelper(l) : ''}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="meeting-log" data-id="${l.id}" ${l.meetingAt ? '' : 'disabled'}>Spotkanie odbyte – zapisz</button>
    <button class="btn sm ${l.meetingType === 'online' && l.meetingPlace ? 'primary' : 'ghost'}" data-act="meet-confirm" data-id="${l.id}" ${l.meetingAt ? '' : 'disabled'}>${ICONS.email}${l.meetingType === 'online' ? 'Wyślij klientowi link i potwierdzenie' : 'Potwierdzenie spotkania'}</button></div>
    ${l.meetingAt ? remindersBlock(l, 'spotkanie') : ''}</div>`;

  const handoffs = (l.handoffs || []).slice().reverse();
  const handoff = `<div class="card"><div class="cardhead"><h2>Przekazanie leada</h2><p>Zmienia opiekuna i zapisuje notatkę dla nowej osoby</p></div>
    <div class="formgrid"><label class="field"><span>Przekaż do</span><select id="ho-to">${ownerOpts('', false, '— wybierz osobę —')}</select></label>
    <label class="field"><span>Data przekazania</span><input type="date" id="ho-date" value="${todayISO()}"></label>
    <label class="field full"><span>Notatka dla przejmującego</span><textarea id="ho-note" rows="2" placeholder="Na czym stanęło, co obiecano, czego unikać…"></textarea></label></div>
    <div class="row" style="margin-top:10px"><button class="btn sm primary" data-act="handoff" data-id="${l.id}">Przekaż leada</button><button class="btn sm ghost" data-act="msg-for" data-id="${l.id}" data-tpl="wew_przekazanie">Generuj notatkę przekazania</button></div>
    ${handoffs.length ? `<div class="sep"></div><div class="timeline">${handoffs.map(h => `<div class="tl-item"><span class="tl-ic">${ICONS.arrow}</span><div><div class="meta"><span>${fdate(h.date)}</span><span>${esc(h.fromName || '—')} → <b>${esc(h.toName || '—')}</b></span></div>${h.note ? `<div class="body small">${esc(h.note)}</div>` : ''}</div></div>`).join('')}</div>` : ''}</div>`;

  const historyCard = `<div class="card"><div class="cardhead"><h2>Historia kontaktów</h2><p>${hist.length} wpisów</p></div>
    <div class="formgrid">
      <label class="field"><span>Rodzaj</span><select id="h-type">${CONTACT_TYPES.filter(c => c.k !== 'system').map(c => opt(c.k, c.n, 'tel')).join('')}</select></label>
      <label class="field"><span>Kiedy</span><input type="datetime-local" id="h-at" value="${nowLocal()}"></label>
      <label class="field"><span>Wynik</span><select id="h-result">${['Rozmowa przeprowadzona', 'Nie odebrał', 'Prośba o kontakt później', 'Wysłano materiały', 'Umówiono spotkanie', 'Zainteresowany', 'Niezainteresowany', 'Inne'].map(x => opt(x, x, '')).join('')}</select></label>
      <label class="field"><span>Kto</span><select id="h-by">${ownerOpts(l.ownerId, false, '— nie wskazano —')}</select></label>
      <label class="field full"><span>Opis</span><textarea id="h-text" rows="2" placeholder="O czym rozmawialiście, ustalenia, kolejny krok"></textarea></label>
    </div>
    <div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="hist-add" data-id="${l.id}">${ICONS.plus}Dodaj wpis</button></div>
    <div class="sep"></div>
    ${hist.length ? `<div class="timeline">${hist.map(h => `<div class="tl-item"><span class="tl-ic">${ICONS[h.type] || ICONS.notatka}</span><div style="min-width:0">
      <div class="meta"><span>${fdt(h.at)}</span><span>${esc(CT_MAP[h.type]?.n || h.type)}</span>${h.result ? `<span class="pill">${esc(h.result)}</span>` : ''}${h.by ? `<span>${esc(memberName(h.by) || '')}</span>` : ''}
      <button class="iconbtn" data-act="hist-del" data-id="${l.id}" data-h="${h.id}" title="Usuń wpis" aria-label="Usuń wpis">${ICONS.x}</button></div>
      ${h.text ? `<div class="body">${esc(h.text)}</div>` : ''}</div></div>`).join('')}</div>` : '<p class="muted">Brak wpisów. Dodaj pierwszy kontakt powyżej.</p>'}</div>`;

  const sugg = suggestedTemplate(l);
  const msgs = `<div class="card"><div class="cardhead"><h2>Wiadomości i skrypty</h2><p>Dopasowane do etapu: ${esc(STAGES[i].n)}</p></div>
    <div class="row">${sugg.map(k => `<button class="btn sm" data-act="msg-for" data-id="${l.id}" data-tpl="${k}">${esc(TEMPLATES[k].n)}</button>`).join('')}</div>
    <p class="note" style="margin-top:8px">Otwiera generator z danymi kandydata (${esc(formLabel(l.form))}). Wszystkie szablony znajdziesz w zakładce „Wiadomości i skrypty”.</p></div>`;

  const locCard = `<div class="card"><div class="cardhead"><h2>Analiza lokalizacji</h2></div>
    ${locs.length ? locs.map(x => { const r = analyzeLocation(x); return `<a class="loccard" href="#lok-${x.id}" style="text-decoration:none;color:inherit;margin-bottom:8px"><span class="scorebadge grade-${r.grade}" style="width:58px;height:58px;border-width:4px"><b style="font-size:1.2rem">${r.score}</b></span><span><b>${esc(x.address || x.city || 'Lokalizacja')}</b><br><span class="small muted">${esc(r.gradeText)} · ${fmt(r.demand.base)} paczek/mies.</span></span></a>`; }).join('') : '<p class="muted small">Brak analizy dla tego kandydata.</p>'}
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="loc-new" data-lead="${l.id}">${ICONS.pin}Nowa analiza dla leada</button></div></div>`;

  const danger = `<div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn danger sm" data-act="lead-del" data-id="${l.id}">${ICONS.trash}Usuń leada</button></div>`;
  const flex = modelOf(l) !== 'franczyza' ? '' : l.pkg === 'flex' ? flexCard(l) : l.pkg === 'smart' ? smartCard(l) : '';
  return head + `<div class="split"><div class="stack">${next}${historyCard}${contact}${flex}</div><div class="stack">${leadMailCard(l)}${contract}${meeting}${msgs}${handoff}${locCard}</div></div>` + danger;
}

function suggestedTemplate(l) {
  const i = stageIdx(l);
  if (modelOf(l) === 'shippoint') return ['email_partner', 'email_prezentacja', 'skrypt_pierwsza'];
  if (l.status === 'wstrzymany' || l.status === 'utracony') return ['email_reaktywacja', 'skrypt_obiekcje'];
  if (l.status === 'proba') return ['sms_pierwszy', 'email_followup', 'email_ostatni'];
  return [
    ['email_pierwszy', 'skrypt_pierwsza', 'email_prezentacja'],
    ['email_prezentacja', 'email_kalkulator', 'skrypt_obiekcje'],
    ['email_zaproszenie', 'skrypt_prezentacja', 'skrypt_obiekcje'],
    ['email_podsumowanie', 'email_oferta', 'skrypt_domkniecie'],
    ['email_powitanie']
  ][i];
}

/* zapis pól leada (na change) */
function saveLeadField(el) {
  const id = S.route.id; const l = D().leads[id]; if (!l) return;
  const f = el.getAttribute('data-lead-field');
  let v = el.value;
  if (f && l[f] === v) return;
  const p = { [f]: v, updatedTs: new Date().toISOString() };
  if (f === 'status') {
    const hist = (l.history || []).slice();
    hist.push(histEntry('system', `Status: ${STATUS_MAP[l.status]?.n || '—'} → ${STATUS_MAP[v]?.n}`));
    p.history = hist;
    if (v === 'pozyskany') { setWon(l); return; }
    if (l.status === 'pozyskany' || (l.stageDates || {}).umowa) { const sd = { ...(l.stageDates || {}) }; delete sd.umowa; p.stageDates = sd; p.contractSignedAt = ''; }
  }
  if (f === 'meetingType' && v === 'online' && !l.meetingPlace && meetLinkFor(l)) p.meetingPlace = meetLinkFor(l);
  if (f === 'ownerId' && l.ownerId !== v) {
    const hist = (l.history || []).slice();
    hist.push(histEntry('system', `Opiekun: ${memberName(l.ownerId) || 'brak'} → ${memberName(v) || 'brak'}`));
    p.history = hist;
  }
  if (f === 'meetingAt' && v && l.status !== 'pozyskany' && l.status !== 'czeka_umowa') p.status = 'umowione';
  patch('leads', id, p);
  if (['meetingAt', 'meetingPlace', 'meetingType', 'phone'].includes(f)) setTimeout(() => syncReminders(id, 'spotkanie'), 300);
}
function saveLeadEdit() {
  const id = S.route.id; const l = D().leads[id]; if (!l) return;
  const d = readLeadForm('le');
  if (!d.name) { toast('Imię i nazwisko nie może być puste.', 'bad'); return; }
  const changed = Object.keys(d).filter(k => String(l[k] ?? '') !== String(d[k] ?? ''));
  if (!changed.length) return;
  const p = { ...Object.fromEntries(changed.map(k => [k, d[k]])), updatedTs: new Date().toISOString() };
  if (changed.includes('ownerId')) {
    const hist = (l.history || []).slice();
    hist.push(histEntry('system', `Opiekun: ${memberName(l.ownerId) || 'brak'} → ${memberName(d.ownerId) || 'brak'}`));
    p.history = hist;
  }
  patch('leads', id, p);
  if (changed.includes('nip') && nipValid(d.nip)) setTimeout(() => autoNip('le', id), 50);
}

/* dane firmy z Białej listy VAT (Ministerstwo Finansów) */
function companyBox(l) {
  const d = nipDigits(l.nip);
  const ok = nipValid(d);
  const c = l.companyData;
  const krs = (c && c.krs) || '';
  const wl = ok ? `https://wl-api.mf.gov.pl/api/search/nip/${d}?date=${todayISO()}` : '';
  const auto = S.mcp ? `<button class="btn sm ${c ? '' : 'primary'}" data-act="reg-lookup" data-id="${l.id}">${ICONS.file}${c ? 'Pobierz ponownie z rejestrów' : 'Pobierz dane z rejestrów'}</button>` : '';
  return `<div class="sep"></div><div class="row between"><h3>Dane firmy z rejestru</h3>${c ? `<span class="tiny muted">pobrano ${fdate(c.at)}</span>` : ''}</div>
    ${c ? `<div style="margin-top:8px">${companyKv(c)}</div>` : ''}
    ${!d ? '<p class="note" style="margin-top:6px">Wpisz NIP w danych kandydata – dane firmy (CEIDG / KRS / Biała lista VAT) uzupełnią się same.</p>'
      : !ok ? '<p class="note overdue" style="margin-top:6px">NIP ma błędną sumę kontrolną – popraw cyfry.</p>'
      : `<div class="stack" style="gap:8px;margin-top:8px">
        ${auto ? `<div class="row">${auto}</div>` : `<p class="note">Automatyczne pobieranie działa, gdy panel jest otwarty w aplikacji Claude na komputerze. Tutaj możesz skorzystać z wklejania poniżej.</p>`}
        <details class="adv" ${c || S.mcp ? '' : 'open'}><summary>Ręcznie: otwórz rejestr i wklej stronę</summary>
        <div class="stack" style="gap:8px;margin-top:8px">
        <div class="row">
          <a class="btn sm" href="${wl}" target="_blank" rel="noopener">${ICONS.file}Biała lista VAT</a>
          <a class="btn sm" href="https://www.biznes.gov.pl/pl/wyszukiwarka-firm/?searchType=advanced&nip=${d}" target="_blank" rel="noopener">${ICONS.file}CEIDG / KRS – wyszukiwarka firm</a>
          ${krs ? `<a class="btn sm" href="https://api-krs.ms.gov.pl/api/krs/OdpisAktualny/${esc(krs)}?rejestr=P&format=json" target="_blank" rel="noopener">${ICONS.file}Odpis KRS</a>` : ''}
          <button class="btn sm ghost" data-act="copy" data-text="${d}">${ICONS.copy}Kopiuj NIP</button>
        </div>
        <label class="field"><span>Wklej tutaj (Ctrl+V) skopiowaną stronę – panel sam rozpozna dane</span><textarea id="nip-paste" data-nip-paste="${l.id}" rows="2" placeholder="Ctrl+A, Ctrl+C na stronie rejestru, potem Ctrl+V tutaj"></textarea></label></div></details></div>`}`;
}
function parseWhiteList(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { const m = String(text).match(/\{[\s\S]*\}/); if (!m) return null; try { j = JSON.parse(m[0]); } catch (e2) { return null; } }
  const sub = j && j.result && (j.result.subject || (j.result.subjects || [])[0]);
  if (sub) return { name: sub.name || '', address: sub.workingAddress || sub.residenceAddress || '', nip: sub.nip || '', regon: sub.regon || '', krs: sub.krs || '', statusVat: sub.statusVat || '', registrationLegalDate: sub.registrationLegalDate || '', at: todayISO(), source: 'Biała lista VAT' };
  const od = j && j.odpis;
  if (od && od.dane) {
    const d1 = od.dane.dzial1 || {}, dp = d1.danePodmiotu || {}, ad = (d1.siedzibaIAdres || {}).adres || {};
    const addr = [[ad.ulica, ad.nrDomu].filter(Boolean).join(' ') + (ad.nrLokalu ? '/' + ad.nrLokalu : ''), [ad.kodPocztowy, ad.miejscowosc].filter(Boolean).join(' ')].filter(x => x && x.trim()).join(', ');
    return { name: dp.nazwa || '', address: addr, nip: (dp.identyfikatory || {}).nip || '', regon: String((dp.identyfikatory || {}).regon || '').replace(/0{5}$/, ''), krs: (od.naglowekA || {}).numerKRS || '', form: dp.formaPrawna || '', ...krsDetails(od), at: todayISO(), source: 'KRS' };
  }
  return null;
}
async function extractCompanyWithClaude(text) {
  if (!S.sample) return null;
  const prompt = `Z poniższego tekstu skopiowanego ze strony rejestru firm (CEIDG, KRS, REGON lub Biała lista VAT) wyciągnij dane jednej firmy. Zwróć wyłącznie JSON: {"name": "nazwa firmy", "address": "adres siedziby lub stałego miejsca wykonywania działalności (ulica nr, kod miejscowość)", "nip": "10 cyfr", "regon": "", "krs": "", "form": "forma prawna, np. jednoosobowa działalność gospodarcza, spółka z o.o.", "status": "status działalności, np. aktywny, zawieszony, wykreślony", "startDate": "data rozpoczęcia działalności RRRR-MM-DD", "pkd": "przeważające PKD z opisem", "owner": "imię i nazwisko właściciela (tylko jednoosobowa działalność)", "phone": "telefon firmy, jeśli podany", "email": "e-mail firmy, jeśli podany", "www": "", "registry": "CEIDG | KRS | REGON | Biała lista"}. Puste pola zostaw jako "". Nie zgaduj danych, których nie ma w tekście.

Tekst:
${String(text).slice(0, 12000)}`;
  const r = await S.sample.json(prompt, { modelTier: 'quick' });
  if (!r || !r.name) return null;
  return { name: r.name, address: r.address || '', nip: nipDigits(r.nip), regon: r.regon || '', krs: r.krs || '', form: r.form || '', status: r.status || '', startDate: r.startDate || '', pkd: r.pkd || '', owner: r.owner || '', phone: r.phone || '', email: String(r.email || '').toLowerCase(), www: r.www || '', at: todayISO(), source: r.registry ? r.registry : 'rejestr (odczyt Claude)' };
}
async function onNipPaste(el, text) {
  const id = el.dataset.nipPaste; const l = D().leads[id]; if (!l) return;
  let c = parseWhiteList(text);
  if (!c) {
    if (!S.sample) { toast('Nie rozpoznano danych. Wklej wynik z Białej listy VAT lub wyciąg KRS (JSON).', 'bad'); return; }
    el.value = 'Claude odczytuje dane firmy…'; el.disabled = true;
    try { c = await extractCompanyWithClaude(text); } catch (e) { c = null; }
    el.disabled = false; el.value = '';
    if (!c) { toast('Nie udało się odczytać danych firmy z wklejonego tekstu. Skopiuj całą stronę z wynikiem wyszukiwania.', 'bad'); return; }
  }
  const cur = D().leads[id];
  if (c.nip && nipDigits(c.nip) !== nipDigits(cur.nip)) toast('Uwaga: wklejone dane dotyczą innego NIP-u (' + c.nip + ').', 'bad');
  const p = { companyData: c, updatedTs: new Date().toISOString() };
  if (!cur.company && c.name) p.company = c.name;
  const hist = (cur.history || []).slice(); hist.push(histEntry('system', 'Pobrano dane firmy (' + c.source + '): ' + c.name)); p.history = hist;
  patch('leads', id, p);
  toast('Uzupełniono dane firmy: ' + c.name);
}

function meetHelper(l) {
  const link = meetLinkFor(l);
  const isMeet = /meet\.google\.com\//.test(l.meetingPlace || '');
  return `<div class="callout" style="margin-top:10px"><div class="stack" style="gap:6px">
    ${l.meetingPlace && isMeet ? `<span class="small">Link Google Meet jest gotowy – wyślij go klientowi przyciskiem poniżej.</span>` : link ? `<span class="small">Twój stały pokój Google Meet: <span class="mono">${esc(link)}</span></span>` : `<span class="small">Utwórz spotkanie w Google Meet, skopiuj link i wklej go w polu wyżej. Możesz też w „Zespół i ustawienia” wpisać swój stały link Meet – wtedy wstawi się sam.</span>`}
    <div class="row">${link && l.meetingPlace !== link ? `<button class="btn sm primary" data-act="meet-use" data-id="${l.id}">Wstaw link Meet</button>` : ''}<a class="btn sm" href="https://meet.google.com/new" target="_blank" rel="noopener">Nowe spotkanie Google Meet</a>${l.meetingPlace && isMeet ? `<a class="btn sm ghost" href="${esc(l.meetingPlace)}" target="_blank" rel="noopener">Otwórz Meet</a>` : ''}</div>
  </div></div>`;
}
function trainingStep(l) {
  const start = l.trainingStart || '';
  const end = start ? (l.trainingEnd || trainingEnd(start)) : '';
  const cls = !start ? 'due' : start < todayISO() && end < todayISO() ? 'done' : '';
  return `<div class="pstep ${cls}"><span class="lbl">3 · Szkolenie w centrali</span>
    ${start ? `<span class="val">${fdate(start)} – ${fdate(end)}</span><span class="small ink2">3 dni robocze · ${esc(l.trainingPlace || 'centrala ShipCenter, ul. Gliwicka 51, Katowice')}</span>` : '<span class="small ink2">Umowa podpisana. Zaplanuj 3-dniowe szkolenie wstępne w centrali (w ciągu 30 dni od podpisania umowy).</span>'}
    <label class="field"><span>${start ? 'Zmień datę rozpoczęcia' : 'Data rozpoczęcia szkolenia'}</span><input type="date" id="ld-train" data-train="${l.id}" value="${esc(start)}"></label>
    ${start ? `<button class="btn sm ghost" data-act="msg-for" data-id="${l.id}" data-tpl="email_szkolenie">${ICONS.email}Mail z terminem szkolenia</button>${remindersBlock(l, 'szkolenie')}` : `<button class="btn sm primary" data-act="train-plan" data-id="${l.id}">Zaplanuj od najbliższego poniedziałku</button>`}
  </div>`;
}
function setTraining(l, start) {
  const end = start ? trainingEnd(start) : '';
  const hist = (l.history || []).slice();
  hist.push(histEntry('system', start ? `Zaplanowano szkolenie w centrali: ${fdate(start)} – ${fdate(end)}` : 'Usunięto termin szkolenia'));
  patch('leads', l.id, { trainingStart: start, trainingEnd: end, trainingPlace: l.trainingPlace || 'centrala ShipCenter, ul. Gliwicka 51, Katowice', nextTask: start ? 'Szkolenie wstępne w centrali (3 dni)' : '', nextTaskDate: start || '', nextTaskTime: '', history: hist, updatedTs: new Date().toISOString() });
  toast(start ? `Szkolenie: ${fdate(start)} – ${fdate(end)}` : 'Usunięto termin szkolenia');
  setTimeout(() => syncReminders(l.id, 'szkolenie'), 300);
}

/* umowa: do wglądu → Autenti → podpisana */
function contractCard(l) {
  const kind = modelOf(l) === 'shippoint' ? 'Umowa Partnerska ShipCenter' : 'Umowa franczyzowa + OWU';
  const pdfs = contractFilesFor(l).map(f => `<button class="btn sm ghost" data-act="contract-pdf" data-file="${f.id}">${ICONS.file}${esc(f.n)}</button>`).join('');
  const won = isWon(l);
  const step = (lbl, date, body, cls = '') => `<div class="pstep ${date ? 'done' : cls}"><span class="lbl">${lbl}</span>${date ? `<span class="val">${fdate(date)}</span>` : ''}${body}</div>`;
  return `<div class="card"><div class="cardhead"><h2>Umowa</h2><p>${esc(kind)}</p></div>
    <div class="row" style="margin-bottom:10px"><span class="small muted">Wzory:</span>${pdfs}</div>
    <div class="stack" style="gap:10px">
      ${step('1 · Do wglądu', l.contractPreviewAt, `<span class="small ink2">${l.contractPreviewAt ? 'Kandydat dostał wzór umowy do zapoznania się.' : 'Dla kandydata, który chce przeczytać umowę przed decyzją.'}</span><button class="btn sm ${l.contractPreviewAt ? '' : 'primary'}" data-act="mail-tpl" data-id="${l.id}" data-tpl="email_umowa_wglad">${ICONS.email}${l.contractPreviewAt ? 'Wyślij ponownie do wglądu' : 'Wyślij umowę do wglądu'}</button>`)}
      ${step('2 · Do podpisu w Autenti', l.contractSentAt, `${l.contractSentAt ? '<span class="small ink2">Status: czeka na podpisanie umowy.</span>' : '<span class="small ink2">Po wysłaniu dokumentu w Autenti zaznacz to tutaj.</span>'}
        <label class="field"><span>Link do dokumentu w Autenti (opcjonalnie)</span><input type="url" id="ld-autenti" data-lead-field="autentiLink" value="${esc(l.autentiLink || '')}" placeholder="https://…autenti…"></label>
        ${l.autentiLink ? `<a class="btn sm" href="${esc(l.autentiLink)}" target="_blank" rel="noopener">Otwórz w Autenti</a>` : ''}
        ${l.contractSentAt ? '' : `<button class="btn sm primary" data-act="contract-sent" data-id="${l.id}">Wysłano do podpisu (dziś)</button>`}`, l.contractPreviewAt ? 'due' : '')}
      ${step('3 · Podpisana', won ? ((l.stageDates || {}).umowa || l.contractSignedAt) : '', won ? '<span class="small ink2">Status: Pozyskany – umowa podpisana.</span>' : `<span class="small ink2">Gdy wszystkie strony podpiszą umowę w Autenti.</span><button class="btn sm ${l.contractSentAt ? 'primary' : ''}" data-act="contract-signed" data-id="${l.id}">Umowa podpisana</button>`, l.contractSentAt ? 'due' : '')}
    </div></div>`;
}

/* konfiguracja pakietu FLEX – co kandydat chce zamówić */
function flexCard(l) {
  const sel = new Set(l.flexItems || []);
  const c = flexCalc(l.flexItems || [], l.smartPrice);
  const zl = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always' }) + '\u00a0zł';
  return `<div class="card"><div class="cardhead"><h2>Konfiguracja FLEX</h2><p>${c.n ? c.n + ' ' + (c.n === 1 ? 'produkt' : c.n < 5 ? 'produkty' : 'produktów') : 'bez sprzętu'}</p></div>
    <div class="flexwrap"><div class="stack" style="gap:14px">
    ${FLEX_GROUPS.map(g => `<div><div class="row between" style="margin-bottom:6px"><span class="eyebrow">${esc(g.n)}</span>${g.one ? '<span class="tiny muted">jeden wariant</span>' : ''}</div>
      <div class="flexitems">${g.items.map(it => `<label class="flexitem ${sel.has(it.id) ? 'on' : ''}"><input type="checkbox" data-flex="${it.id}" ${sel.has(it.id) ? 'checked' : ''}><span style="min-width:0"><b class="small">${esc(it.n)}</b><span class="tiny muted" style="display:block">${esc(it.d)}</span></span><span class="small mono" style="white-space:nowrap">${zl(it.p)}</span></label>`).join('')}</div></div>`).join('')}
    </div>
    <div class="flexsum">
      ${smartPriceField(l)}
      <dl class="kv flexkv"><dt>Pakiet SMART</dt><dd class="mono">${zl(c.smart)}</dd><dt>Sprzęt przed rabatem</dt><dd class="mono">${zl(c.gross)}</dd><dt>Rabat FLEX ${c.pct}%</dt><dd class="mono">${c.disc ? '−' + zl(c.disc) : zl(0)}</dd><dt>Sprzęt po rabacie</dt><dd class="mono">${zl(c.after)}</dd></dl>
      <div class="flextotal"><span class="tiny muted">Razem netto</span><b>${zl(c.net)}</b><span class="tiny muted">brutto (23% VAT): ${zl(c.brutto)}</span></div>
      <div class="flextiers">${FLEX_TIERS.map(t => `<span class="${c.n >= t.min ? 'on' : ''}">${t.min}${t.max < 99 ? '–' + t.max : '+'} · ${t.pct}%</span>`).join('')}</div>
      <p class="tiny muted">${c.next ? `Dodaj jeszcze ${c.next.need} ${c.next.need === 1 ? 'produkt' : 'produkty'}, aby uzyskać rabat ${c.next.pct}%.` : c.n ? 'Maksymalny rabat FLEX.' : 'Rabat liczony od liczby różnych produktów.'}</p>
      <div class="row"><button class="btn sm primary" data-act="flex-mail" data-id="${l.id}" ${c.n ? '' : 'disabled'}>${ICONS.email}Wyślij konfigurację klientowi</button>${c.n ? `<button class="btn sm ghost" data-act="flex-clear" data-id="${l.id}">Wyczyść</button>` : ''}</div>
    </div></div></div>`;
}
function toggleFlex(id, item, on) {
  const l = D().leads[id]; if (!l) return;
  let sel = new Set(l.flexItems || []);
  const it = FLEX_ITEMS.find(x => x.id === item); if (!it) return;
  if (on) { const g = FLEX_GROUPS.find(x => x.k === it.g); if (g.one) g.items.forEach(x => sel.delete(x.id)); sel.add(item); } else sel.delete(item);
  patch('leads', id, { flexItems: [...sel], updatedTs: new Date().toISOString() });
}
function flexEmailBody(l) {
  const c = flexCalc(l.flexItems || [], l.smartPrice); const ctx = msgContext(l, l.form);
  const zl = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always' }) + ' zł';
  return `${powitanie(ctx)}

zgodnie z rozmową przesyłam podsumowanie konfiguracji pakietu FLEX:

${c.items.map(it => `• ${it.n} – ${zl(it.p)} netto`).join('\n')}

Pakiet SMART: ${zl(c.smart)} netto
Sprzęt przed rabatem: ${zl(c.gross)} netto
Rabat FLEX ${c.pct}%: ${c.disc ? '−' + zl(c.disc) : '0 zł'}
Razem: ${zl(c.net)} netto (${zl(c.brutto)} brutto)

Konfigurację można w każdej chwili zmienić – wystarczy odpisać na tę wiadomość. Pełny kalkulator: ${offer().linkKalkulator || 'https://shipcenter.pl/franczyza/kalkulator'}

Pozdrawiam
`;
}

const zlFmt = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always' }) + '\u00a0zł';
function smartPriceField(l) {
  const zl = zlFmt;
  const list = +offer().licencja || 0;
  const custom = +l.smartPrice > 0 && +l.smartPrice !== list;
  return `<label class="field"><span>Cena pakietu SMART (licencja)${custom ? ' · <b>indywidualna</b>' : ''}</span><input type="number" id="ld-smart" data-lead-field="smartPrice" min="0" step="1" value="${esc(l.smartPrice || '')}" placeholder="${list}"><span class="hint">${custom ? `Cennik: ${zl(list)} · <button type="button" class="btn sm ghost" style="padding:0 4px;min-height:0" data-act="smart-reset" data-id="${l.id}">przywróć cenę z cennika</button>` : 'Puste = cena z cennika. Wpisz kwotę, jeśli ustaliliście z kandydatem inną.'}</span></label>`;
}
/* podsumowanie pakietu SMART (kandydat ma własne wyposażenie) */
function smartCard(l) {
  const o = offer(); const smart = smartPriceOf(l); const zl = zlFmt;
  return `<div class="card"><div class="cardhead"><h2>Pakiet SMART</h2><p>własne wyposażenie, bez zakupu sprzętu</p></div>
    <div class="flexsum" style="position:static;max-width:520px">
      ${smartPriceField(l)}
      <dl class="kv flexkv"><dt>Pakiet SMART (licencja)</dt><dd class="mono">${zl(smart)}</dd><dt>Sprzęt</dt><dd class="mono">${zl(0)}</dd></dl>
      <div class="flextotal"><span class="tiny muted">Razem netto – jednorazowo</span><b>${zl(smart)}</b><span class="tiny muted">brutto (23% VAT): ${zl(Math.round(smart * 123) / 100)}</span></div>
      <p class="tiny muted">Opłata miesięczna ${zl(+o.oplataMies || 0)} netto, 0 zł w miesiącu z ponad ${o.progRabatu || 600} paczkami. Sprzęt musi spełniać standard ShipCenter.</p>
      <div class="row"><button class="btn sm primary" data-act="smart-mail" data-id="${l.id}">${ICONS.email}Wyślij podsumowanie klientowi</button></div>
    </div></div>`;
}
function smartEmailBody(l) {
  const o = offer(); const smart = smartPriceOf(l); const ctx = msgContext(l, l.form);
  const zl = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always' }) + ' zł';
  return `${powitanie(ctx)}

zgodnie z rozmową przesyłam podsumowanie pakietu SMART – ${ctx.g('korzysta Pan', 'korzysta Pani', 'korzystają Państwo', 'korzystasz')} z własnego wyposażenia, więc bez zakupu sprzętu:

Pakiet SMART (licencja): ${zl(smart)} netto (${zl(Math.round(smart * 123) / 100)} brutto) – jednorazowo
Opłata miesięczna: ${zl(+o.oplataMies || 0)} netto, 0 zł w miesiącu z ponad ${o.progRabatu || 600} paczkami

Warunek: sprzęt (komputer, drukarka laserowa i termiczna, skaner) musi spełniać standard ShipCenter – chętnie pomożemy to sprawdzić. Gdyby jednak potrzebny był sprzęt, zestaw można dobrać w kalkulatorze: ${o.linkKalkulator || 'https://shipcenter.pl/franczyza/kalkulator'}

Pozdrawiam
`;
}
