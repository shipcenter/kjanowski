/* ===== Leady: lista, kanban, formularz, widok pojedynczego leada ===== */

const LEAD_COLS = [
  { k: 'code', n: 'Kod', get: l => leadCode(l.id) },
  { k: 'name', n: 'Kandydat', get: l => (l.name || '').toLowerCase() },
  { k: 'city', n: 'Miasto / region', get: l => (l.city || '').toLowerCase() },
  { k: 'model', n: 'Model', get: l => modelOf(l) },
  { k: 'source', n: 'Źródło', get: l => l.source },
  { k: 'owner', n: 'Opiekun', get: l => memberName(l.ownerId).toLowerCase() },
  { k: 'stage', n: 'Etap', get: l => stageIdx(l) },
  { k: 'status', n: 'Status', get: l => l.status },
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
    <label class="field"><span>Zmień etap</span><select id="bulk-stage">${opt('', '— wybierz —', '')}${stageOpts('')}</select></label>
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
  const th = c => `<th class="sortable" data-act="sort" data-k="${c.k}">${c.n}${S.sort.key === c.k ? (S.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}</th>`;
  return `<div class="tablewrap"><table class="t"><thead><tr><th><input type="checkbox" id="sel-all" data-act="sel-all" ${allSel ? 'checked' : ''} aria-label="Zaznacz wszystkie"></th>${LEAD_COLS.map(th).join('')}</tr></thead><tbody>
  ${list.map(l => {
    const lc = lastContact(l);
    return `<tr class="click" data-act="open-lead" data-id="${l.id}">
      <td data-stop="1"><input type="checkbox" data-act="sel" data-id="${l.id}" ${S.selected.has(l.id) ? 'checked' : ''} aria-label="Zaznacz"></td>
      <td><span class="code">${leadCode(l.id)}</span></td>
      <td><div class="cellname"><b>${esc(l.name || '(bez nazwy)')}</b><span class="tiny muted">${esc(l.company || l.phone || l.email || '')}</span></div></td>
      <td>${esc(l.city || '—')}<div class="tiny muted">${esc(l.region || '')}</div></td>
      <td>${modelPill(l)}</td>
      <td>${sourcePill(l.source)}</td>
      <td>${esc(memberName(l.ownerId) || '—')}</td>
      <td>${stageBar(l)}<div class="tiny muted">${esc(STAGES[stageIdx(l)].short)}</div></td>
      <td>${statusPill(l.status)}</td>
      <td style="min-width:170px"><span class="small">${esc(l.nextTask || '—')}</span><div class="tiny ${dueCls(l.nextTaskDate)}">${l.nextTaskDate ? fdate(l.nextTaskDate) + (l.nextTaskTime ? ' ' + esc(l.nextTaskTime) : '') : ''}</div></td>
      <td class="small ${dueCls(l.meetingAt)}">${l.meetingAt ? fdt(l.meetingAt) : '—'}</td>
      <td class="small">${lc ? fdateShort(lc) : '<span class="muted">brak</span>'}</td>
      <td class="small muted">${fdate(l.createdAt)}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function kanbanHTML(list) {
  return `<p class="note" style="margin-bottom:8px">Przeciągnij kartę do innej kolumny, aby zmienić etap. Na telefonie użyj przycisku → na karcie.</p><div class="kanban">${STAGES.map((s, i) => {
    const items = list.filter(l => l.stage === s.k);
    return `<div class="kcol" data-drop-stage="${s.k}"><h3><span>${esc(s.n)}</span><span class="muted num">${items.length}</span></h3>
      ${items.map(l => `<div class="kcard" draggable="true" data-drag-lead="${l.id}" data-act="open-lead" data-id="${l.id}">
        <div class="row between"><b>${esc(l.name || '(bez nazwy)')}</b><span class="code">${leadCode(l.id)}</span></div>
        <span class="tiny muted">${esc([l.city, memberName(l.ownerId)].filter(Boolean).join(' · ') || '—')}</span>
        <div class="row">${statusPill(l.status)}</div>
        ${l.nextTaskDate ? `<span class="tiny ${dueCls(l.nextTaskDate)}">${esc(l.nextTask || 'Zadanie')} · ${fdateShort(l.nextTaskDate)}</span>` : ''}
        ${i < 6 && isOpen(l) ? `<div class="row between"><span></span><button class="btn sm ghost" data-act="stage-next" data-id="${l.id}" title="Przesuń do: ${esc(STAGES[i + 1].n)}">${esc(STAGES[i + 1].short)} ${ICONS.arrow}</button></div>` : ''}
      </div>`).join('')}</div>`;
  }).join('')}</div>`;
}

/* ---------- formularz leada ---------- */
function leadFormFields(l, prefix = 'lf') {
  return `<div class="formgrid">
    <label class="field span2"><span>Imię i nazwisko *</span><input type="text" id="${prefix}-name" value="${esc(l.name)}" required></label>
    <label class="field"><span>Firma (opcjonalnie)</span><input type="text" id="${prefix}-company" value="${esc(l.company)}"></label>
    <label class="field"><span>Telefon</span><input type="tel" id="${prefix}-phone" value="${esc(l.phone)}"></label>
    <label class="field"><span>E-mail</span><input type="email" id="${prefix}-email" value="${esc(l.email)}"></label>
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
  return { name: v('name').trim(), company: v('company').trim(), phone: v('phone').trim(), email: v('email').trim(), city: v('city').trim(), region: v('region'), source: v('source'), ownerId: v('owner'), model: v('model'), pkg: v('pkg'), capital: v('capital'), hasPremises: v('premises'), form: v('form') };
}
function openLeadModal() {
  const l = newLead({ ownerId: S.f.owner && S.f.owner !== '_none' ? S.f.owner : (myMemberId() || ''), source: S.f.source || 'google', region: S.f.region || '', model: S.f.model || 'franczyza' });
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
  const hist = (l.history || []).slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  const o = offer();

  const head = `<div class="row between" style="margin-bottom:10px"><a class="btn ghost sm" href="#leady">${ICONS.back}Lista leadów</a>
    <div class="row">${prevId ? `<a class="btn sm" href="#lead-${prevId}">← Poprzedni</a>` : ''}${nextId ? `<a class="btn sm" href="#lead-${nextId}">Następny →</a>` : ''}</div></div>
    <div class="leadhead"><div class="who"><span class="code">${leadCode(l.id)} · dodano ${fdate(l.createdAt)} · ${esc(SOURCE_MAP[l.source]?.n || '')}</span>
      <h1>${esc(l.name || '(bez nazwy)')}</h1>
      <p class="ink2">${esc([l.company, l.city, l.region].filter(Boolean).join(' · ') || 'Uzupełnij miasto i województwo')}</p>
      <div class="row" style="margin-top:6px">${modelPill(l)}${statusPill(l.status)}${lc ? `<span class="pill">ostatni kontakt ${fdateShort(lc)}</span>` : `<span class="pill warn">brak kontaktu</span>`}</div></div>
      <div class="stack" style="gap:8px;min-width:240px">
        <label class="field"><span>Opiekun</span><select id="ld-owner" data-lead-field="ownerId">${ownerOpts(l.ownerId)}</select></label>
        <label class="field"><span>Status kontaktu</span><select id="ld-status" data-lead-field="status">${statusOpts(l.status)}</select></label>
        ${l.status === 'utracony' ? `<label class="field"><span>Powód utraty</span><select id="ld-lost" data-lead-field="lostReason">${opt('', '— wybierz —', l.lostReason)}${LOST_REASONS.map(r => opt(r, r, l.lostReason)).join('')}</select></label>` : ''}
      </div></div>
    <div class="stepper" role="list">${STAGES.map((s, j) => `<button role="listitem" class="${j < i ? 'done' : ''} ${j === i ? 'cur' : ''} ${s.k === 'umowa' ? 'won' : ''}" data-act="set-stage" data-id="${l.id}" data-k="${s.k}" title="Ustaw etap: ${esc(s.n)}"><span class="n">${pad(j + 1)}</span><span class="t">${esc(s.n)}</span><span class="d">${(l.stageDates || {})[s.k] ? fdate(l.stageDates[s.k]) : '—'}</span></button>`).join('')}</div>`;

  const contact = `<div class="card"><div class="cardhead"><h2>Dane kandydata</h2><p>Zmiany zapisują się po opuszczeniu pola</p></div>
    <div id="lead-edit" data-lead="${l.id}">${leadFormFields(l, 'le')}</div>
    <div class="row" style="margin-top:10px">${l.phone ? `<span class="pill outline mono">${esc(l.phone)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(l.phone)}">${ICONS.copy}Kopiuj telefon</button>` : ''}${l.email ? `<span class="pill outline mono">${esc(l.email)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(l.email)}">${ICONS.copy}Kopiuj e-mail</button>` : ''}</div>
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
      <div class="pstep ${nextCls}"><span class="lbl">3 · Kolejny kontakt</span>
        <input type="text" id="ld-task" data-lead-field="nextTask" value="${esc(l.nextTask)}" list="task-sugg" placeholder="Co zrobić, np. telefon po prezentacji" aria-label="Kolejny kontakt – co zrobić">
        <div class="row" style="flex-wrap:nowrap"><input type="date" id="ld-taskdate" data-lead-field="nextTaskDate" value="${esc(l.nextTaskDate)}" aria-label="Data kolejnego kontaktu"><input type="time" id="ld-tasktime" data-lead-field="nextTaskTime" value="${esc(l.nextTaskTime || '')}" aria-label="Godzina" style="max-width:110px"></div>
        <div class="row">${[1, 3, 7].map(d => `<button class="btn sm" data-act="task-shift" data-id="${l.id}" data-d="${d}">+${d} ${d === 1 ? 'dzień' : 'dni'}</button>`).join('')}</div>
        ${l.nextTaskDate ? `<span class="tiny ${dueCls(l.nextTaskDate)}">${nextCls === 'late' ? 'Zaległe od ' + fdate(l.nextTaskDate) : nextCls === 'due' ? 'Na dziś – przypomnienie w menu „Kontakty”' : 'Przypomnienie: ' + fdate(l.nextTaskDate)}</span>` : '<span class="tiny muted">Brak terminu – lead nie pojawi się w przypomnieniach.</span>'}
      </div>
    </div>
    <datalist id="task-sugg">${['Pierwsza rozmowa telefoniczna', 'Ponowna próba kontaktu', 'Telefon po prezentacji', 'Umówić spotkanie', 'Zebrać dane do analizy lokalizacji', 'Wysłać ofertę i projekt umowy', 'Telefon decyzyjny', 'Zaplanować szkolenie'].map(x => `<option value="${x}">`).join('')}</datalist>
    <div class="row" style="margin-top:12px"><button class="btn primary" data-act="call-log" data-id="${l.id}">${ICONS.tel}Zapisz rozmowę / kontakt</button>${l.phone ? `<span class="pill outline mono">${esc(l.phone)}</span><button class="btn sm ghost" data-act="copy" data-text="${esc(l.phone)}">${ICONS.copy}Kopiuj</button>` : '<span class="note">Brak telefonu – uzupełnij w danych kandydata.</span>'}</div>
    ${smsList.length ? `<div class="sep"></div><h3 style="margin-bottom:6px">SMS</h3>${smsList.map(x => { const st = SMS_STATUS[x.status] || SMS_STATUS.oczekuje; return `<div class="contact-row"><span class="when">${fdateShort(x.createdTs)}</span><div style="min-width:0"><span class="pill ${st[1]}">${st[0]}</span> <span class="tiny muted">${esc(x.phone)}</span><div class="small ink2">${esc(x.text)}</div>${x.error ? `<div class="tiny overdue">${esc(x.error)}</div>` : ''}</div><div class="ctl">${x.status === 'oczekuje' ? `<button class="btn sm ghost" data-act="copy" data-text="${esc(x.text)}">${ICONS.copy}</button><button class="btn sm" data-act="sms-done" data-id="${x.id}">Wysłany ręcznie</button>` : ''}</div></div>`; }).join('')}` : ''}
  </div>`;

  const meeting = `<div class="card"><div class="cardhead"><h2>Spotkanie</h2>${l.meetingAt ? `<p class="${dueCls(l.meetingAt)}">${fdt(l.meetingAt)}</p>` : ''}</div>
    <div class="formgrid"><label class="field"><span>Termin</span><input type="datetime-local" id="ld-meet" data-lead-field="meetingAt" value="${esc(l.meetingAt)}"></label>
    <label class="field"><span>Forma</span><select id="ld-meettype" data-lead-field="meetingType">${opt('', '—', l.meetingType)}${opt('online', 'Online (wideo)', l.meetingType)}${opt('telefon', 'Telefon', l.meetingType)}${opt('centrala', 'Centrala – Katowice', l.meetingType)}${opt('lokal', 'W planowanym lokalu', l.meetingType)}${opt('punkt', 'W działającym punkcie', l.meetingType)}</select></label>
    <label class="field full"><span>Miejsce / link</span><input type="text" id="ld-meetplace" data-lead-field="meetingPlace" value="${esc(l.meetingPlace)}" placeholder="Adres lub link do spotkania"></label></div>
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="meeting-log" data-id="${l.id}" ${l.meetingAt ? '' : 'disabled'}>Spotkanie odbyte – zapisz</button>
    <button class="btn sm ghost" data-act="msg-for" data-id="${l.id}" data-tpl="email_potwierdzenie">Potwierdzenie spotkania</button></div></div>`;

  const handoffs = (l.handoffs || []).slice().reverse();
  const handoff = `<div class="card"><div class="cardhead"><h2>Przekazanie leada</h2><p>Zmienia opiekuna i zapisuje notatkę dla nowej osoby</p></div>
    <div class="formgrid"><label class="field"><span>Przekaż do</span><select id="ho-to">${ownerOpts('', false, '— wybierz osobę —')}</select></label>
    <label class="field"><span>Data przekazania</span><input type="date" id="ho-date" value="${todayISO()}"></label>
    <label class="field full"><span>Notatka dla przejmującego</span><textarea id="ho-note" rows="2" placeholder="Na czym stanęło, co obiecano, czego unikać…"></textarea></label></div>
    <div class="row" style="margin-top:10px"><button class="btn sm primary" data-act="handoff" data-id="${l.id}">Przekaż leada</button><button class="btn sm ghost" data-act="msg-for" data-id="${l.id}" data-tpl="wew_przekazanie">Generuj notatkę przekazania</button></div>
    ${handoffs.length ? `<div class="sep"></div><div class="timeline">${handoffs.map(h => `<div class="tl-item"><span class="tl-ic">${ICONS.arrow}</span><div><div class="meta"><span>${fdate(h.date)}</span><span>${esc(h.fromName || '—')} → <b>${esc(h.toName || '—')}</b></span></div>${h.note ? `<div class="body small">${esc(h.note)}</div>` : ''}</div></div>`).join('')}</div>` : ''}</div>`;

  const historyCard = `<div class="card"><div class="cardhead"><h2>Historia kontaktów</h2><p>${hist.filter(h => h.type !== 'system').length} kontaktów</p></div>
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
  return head + `<div class="split"><div class="stack">${next}${historyCard}${contact}</div><div class="stack">${meeting}${msgs}${handoff}${locCard}</div></div>` + danger;
}

function suggestedTemplate(l) {
  const i = stageIdx(l);
  if (modelOf(l) === 'shippoint') return ['email_partner', 'email_prezentacja', 'skrypt_pierwsza'];
  if (l.status === 'wstrzymany' || l.status === 'utracony') return ['email_reaktywacja', 'skrypt_obiekcje'];
  if (l.status === 'proba') return ['sms_pierwszy', 'email_followup', 'email_ostatni'];
  return [
    ['email_pierwszy', 'skrypt_pierwsza', 'email_prezentacja'],
    ['skrypt_pierwsza', 'email_zaproszenie', 'skrypt_obiekcje'],
    ['email_zaproszenie', 'skrypt_prezentacja', 'skrypt_obiekcje'],
    ['email_podsumowanie', 'email_dane_lokalizacji', 'skrypt_obiekcje'],
    ['email_raport', 'skrypt_domkniecie'],
    ['email_oferta', 'skrypt_domkniecie', 'skrypt_obiekcje'],
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
    if (v === 'pozyskany' && l.stage !== 'umowa') { setStage(l, 'umowa'); return; }
  }
  if (f === 'ownerId' && l.ownerId !== v) {
    const hist = (l.history || []).slice();
    hist.push(histEntry('system', `Opiekun: ${memberName(l.ownerId) || 'brak'} → ${memberName(v) || 'brak'}`));
    p.history = hist;
  }
  if (f === 'meetingAt' && v && l.status !== 'pozyskany') p.status = 'umowione';
  patch('leads', id, p);
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
}
