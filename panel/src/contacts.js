/* ===== Kontakty: przypomnienia o kolejnych kontaktach, rozmowy, SMS po rozmowie ===== */

const PL_MAP = { ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z', Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z' };
const stripPL = t => String(t || '').replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, c => PL_MAP[c]).replace(/[„”]/g, '"').replace(/[–—]/g, '-');
const GSM_RE = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅå_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà^{}\[\]~|€\\]*$/;
function smsInfo(text) {
  const gsm = GSM_RE.test(text);
  const len = [...text].length;
  const per = gsm ? (len > 160 ? 153 : 160) : (len > 70 ? 67 : 70);
  return { gsm, len, parts: Math.max(1, Math.ceil(len / per)) };
}
function smsThanksText(l) {
  const o = offer();
  const m = l && l.ownerId ? D().team[l.ownerId] : null;
  const who = m ? firstName(m.name) : 'ShipCenter';
  const tel = (m && m.phone) || o.telefon;
  const topic = modelOf(l) === 'shippoint' ? 'o Ship Point' : 'o franczyzie ShipCenter';
  return stripPL(`Dzień dobry, dziękuję za rozmowę ${topic}. W razie pytań proszę dzwonić: ${who}, tel. ${tel}. Pozdrawiam, ${o.smsPodpis || 'ShipCenter'}`);
}
const smsGatewayOn = () => !!((settings().integrations || {}).sms);

function queueSms(l, text) {
  const id = uid('sms');
  const doc = { leadId: l.id, leadName: l.name || '', phone: l.phone || '', text, ownerId: l.ownerId || '', status: 'oczekuje', kind: 'po_rozmowie', createdTs: new Date().toISOString(), createdBy: myMemberId() || '' };
  put('sms', id, doc);
  return id;
}
const SMS_STATUS = { oczekuje: ['Czeka na wysłanie', 'warn'], wyslany: ['Wysłany', 'good'], blad: ['Błąd wysyłki', 'bad'], anulowany: ['Anulowany', ''] };
function smsListFor(leadId) { return Object.values(D().sms || {}).filter(x => x.leadId === leadId).sort((a, b) => (b.createdTs || '').localeCompare(a.createdTs || '')); }

/* modal: zapis rozmowy (pierwszej lub kolejnej) */
function openCallModal(l, { type = 'tel', title = null, result = 'Rozmowa przeprowadzona', text = '', stageTo = null } = {}) {
  const first = !l.firstCallAt && type === 'tel';
  const smsText = smsThanksText(l);
  const nextDefault = isoDate(addDays(new Date(), 3));
  openModal(`<div class="mh"><h2>${esc(title || (first ? 'Pierwsza rozmowa' : 'Zapis kontaktu'))} – ${esc(l.name)}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <form class="mb" id="call-form"><div class="formgrid">
      <label class="field"><span>Rodzaj</span><select id="cl-type">${CONTACT_TYPES.filter(c => c.k !== 'system').map(c => opt(c.k, c.n, type)).join('')}</select></label>
      <label class="field"><span>Wynik</span><select id="cl-result">${['Rozmowa przeprowadzona', 'Nie odebrał', 'Prośba o kontakt później', 'Wysłano materiały', 'Umówiono spotkanie', 'Spotkanie odbyte', 'Zainteresowany', 'Niezainteresowany', 'Inne'].map(x => opt(x, x, result)).join('')}</select></label>
      <label class="field"><span>Status kontaktu</span><select id="cl-status">${statusOpts(l.status === 'do_kontaktu' ? 'w_kontakcie' : l.status)}</select></label>
      <label class="field full"><span>Notatka z rozmowy</span><textarea id="cl-text" rows="3" placeholder="Co ustaliliście, czego oczekuje, obawy, kapitał, lokal…">${esc(text)}</textarea></label>
      <label class="chk full"><input type="checkbox" id="cl-pres" ${l.presentationAt ? 'disabled' : ''}> ${l.presentationAt ? 'Prezentacja wysłana ' + fdate(l.presentationAt) : 'Wysłałem prezentację (zapisz datę dzisiejszą)'}</label>
    </div>
    <div class="smsbox" id="cl-trainbox" ${l.status === 'pozyskany' ? '' : 'hidden'}>
      <b>Umowa podpisana – zaplanuj szkolenie wstępne (3 dni w centrali)</b>
      <div class="formgrid"><label class="field"><span>Data rozpoczęcia</span><input type="date" id="cl-train" value="${esc(l.trainingStart || nextMonday())}"></label><div class="field"><span>Koniec (3 dni robocze)</span><b id="cl-trainend" style="padding-top:8px">${fdate(trainingEnd(l.trainingStart || nextMonday()))}</b></div></div>
      <span class="note">Kolejnego kontaktu nie trzeba planować – przypomnienie pojawi się w dniu szkolenia.</span>
    </div>
    <div id="cl-nextwrap" ${l.status === 'pozyskany' ? 'hidden' : ''}>
    <div class="formgrid">
      <label class="field span2"><span>Kolejny kontakt – co zrobić</span><input type="text" id="cl-next" list="task-sugg3" value="${esc(l.presentationAt ? 'Telefon po prezentacji' : 'Telefon – kolejny krok')}"></label>
      <label class="field"><span>Data</span><input type="date" id="cl-nextdate" value="${nextDefault}"></label>
      <label class="field"><span>Godzina (opcjonalnie)</span><input type="time" id="cl-nexttime" value=""></label>
    </div>
    <div class="row">${[1, 2, 3, 7, 14].map(d => `<button type="button" class="btn sm" data-days="${d}">za ${d} ${d === 1 ? 'dzień' : 'dni'}</button>`).join('')}<button type="button" class="btn sm ghost" data-days="none">bez kolejnego kontaktu</button></div>
    </div>
    <datalist id="task-sugg3">${['Telefon po prezentacji', 'Ponowna próba kontaktu', 'Umówić spotkanie', 'Zebrać dane do analizy lokalizacji', 'Wysłać ofertę i projekt umowy', 'Telefon decyzyjny', 'Zaplanować szkolenie'].map(x => `<option value="${x}">`).join('')}</datalist>
    ${first ? `<div class="smsbox" id="sms-box">
      <label class="chk"><input type="checkbox" id="cl-sms" ${l.phone ? 'checked' : 'disabled'}> <b>Wyślij SMS z podziękowaniem za rozmowę</b>${l.phone ? ` na numer ${esc(l.phone)}` : ' – brak numeru telefonu'}</label>
      <textarea id="cl-smstext" rows="3">${esc(smsText)}</textarea>
      <div class="row between"><span class="note" id="cl-smsinfo"></span><button type="button" class="btn sm ghost" id="cl-smspl">Usuń polskie znaki</button></div>
      ${smsGatewayOn() ? '' : '<span class="note">Bramka SMS nie jest jeszcze podłączona – SMS trafi do kolejki i wyjdzie automatycznie po podłączeniu. Możesz też skopiować treść.</span>'}
    </div>` : ''}
    </form>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="cl-save">Zapisz</button></div>`);
  const upd = () => { const t = $('#cl-smstext'); if (t) { const i = smsInfo(t.value); $('#cl-smsinfo').textContent = `${i.len} znaków · ${i.parts} SMS${i.gsm ? '' : ' (polskie znaki – krótsze SMS-y)'}`; } };
  upd();
  if ($('#cl-smstext')) { $('#cl-smstext').oninput = upd; $('#cl-smspl').onclick = () => { $('#cl-smstext').value = stripPL($('#cl-smstext').value); upd(); }; }
  const syncWon = () => { const won = $('#cl-status').value === 'pozyskany'; $('#cl-trainbox').hidden = !won; $('#cl-nextwrap').hidden = won; const sb = $('#sms-box'); if (sb && won) sb.hidden = true; };
  $('#cl-status').onchange = syncWon;
  $('#cl-train').onchange = () => { $('#cl-trainend').textContent = fdate(trainingEnd($('#cl-train').value)); };
  $('#cl-result').onchange = () => { const box = $('#sms-box'); if (box) box.hidden = $('#cl-result').value === 'Nie odebrał'; if ($('#cl-result').value === 'Nie odebrał') { $('#cl-status').value = 'proba'; $('#cl-next').value = 'Ponowna próba kontaktu'; $('#cl-nextdate').value = isoDate(addDays(new Date(), 1)); } };
  $$('#modal [data-days]').forEach(b => b.onclick = () => { if (b.dataset.days === 'none') { $('#cl-next').value = ''; $('#cl-nextdate').value = ''; } else $('#cl-nextdate').value = isoDate(addDays(new Date(), +b.dataset.days)); });
  $('#cl-pres').onchange = () => { if ($('#cl-pres').checked && !/prezentac/i.test($('#cl-next').value)) $('#cl-next').value = 'Telefon po prezentacji'; };
  const save = () => {
    const cur = D().leads[l.id]; if (!cur) return closeModal();
    const t = $('#cl-type').value, res = $('#cl-result').value;
    const hist = (cur.history || []).slice();
    const by = myMemberId() || cur.ownerId || '';
    const noteTxt = $('#cl-text').value.trim();
    hist.push({ id: uid('h'), at: nowLocal(), type: t, text: noteTxt, result: res, by, manual: !!noteTxt, auto: !noteTxt });
    const won = $('#cl-status').value === 'pozyskany';
    const nextTxt = won ? '' : $('#cl-next').value.trim();
    const p = { history: hist, status: $('#cl-status').value, nextTask: nextTxt, nextTaskDate: nextTxt ? $('#cl-nextdate').value : '', nextTaskTime: nextTxt ? $('#cl-nexttime').value : '', updatedTs: new Date().toISOString() };
    if (won) {
      const ts = $('#cl-train').value;
      p.stageDates = { ...(cur.stageDates || {}), umowa: (cur.stageDates || {}).umowa || todayISO() };
      if (ts) { p.trainingStart = ts; p.trainingEnd = trainingEnd(ts); p.trainingPlace = cur.trainingPlace || 'centrala ShipCenter, ul. Gliwicka 51, Katowice'; p.nextTask = 'Szkolenie wstępne w centrali (3 dni)'; p.nextTaskDate = ts; hist.push(histEntry('system', `Umowa podpisana. Szkolenie w centrali: ${fdate(ts)} – ${fdate(p.trainingEnd)}`, { by })); }
    }
    const reached = res !== 'Nie odebrał';
    if (t === 'tel' && reached && !cur.firstCallAt) p.firstCallAt = todayISO();
    if ($('#cl-pres').checked && !cur.presentationAt) { p.presentationAt = todayISO(); hist.push(histEntry('email', 'Wysłano prezentację', { by, result: 'Wysłano materiały' })); }
    if ((t === 'spotkanie' || stageTo === 'spotkanie') && reached && !(cur.stageDates || {}).spotkanie) p.stageDates = { ...(cur.stageDates || {}), spotkanie: todayISO() };
    if (t === 'spotkanie') { p.meetingAt = ''; if (p.status === 'umowione') p.status = 'w_kontakcie'; }
    patch('leads', l.id, p);
    const smsOn = !won && $('#cl-sms') && $('#cl-sms').checked && reached && cur.phone;
    if (smsOn) {
      const text = $('#cl-smstext').value.trim();
      queueSms(cur, text);
      const h2 = (D().leads[l.id].history || []).slice(); h2.push(histEntry('sms', 'SMS z podziękowaniem: ' + text, { by, result: smsGatewayOn() ? 'Wysłano materiały' : 'Inne' }));
      patch('leads', l.id, { history: h2 });
    }
    closeModal();
    toast(smsOn ? (smsGatewayOn() ? 'Zapisano. SMS zostanie wysłany w ciągu minuty.' : 'Zapisano. SMS czeka w kolejce na podłączenie bramki.') : 'Zapisano rozmowę');
  };
  $('#cl-save').onclick = save;
  $('#call-form').onsubmit = e => { e.preventDefault(); save(); };
}

function markPresentation(l) {
  const today = todayISO();
  const hist = (l.history || []).slice();
  hist.push(histEntry('email', 'Wysłano prezentację', { by: myMemberId() || l.ownerId || '', result: 'Wysłano materiały' }));
  const p = { presentationAt: today, history: hist, updatedTs: new Date().toISOString() };
  if (!l.nextTaskDate || l.nextTaskDate <= today) { p.nextTask = 'Telefon po prezentacji'; p.nextTaskDate = isoDate(addDays(new Date(), 3)); }
  patch('leads', l.id, p);
  toast('Zapisano wysłanie prezentacji' + (p.nextTaskDate ? ' · kolejny kontakt ' + fdate(p.nextTaskDate) : ''));
}

/* widok Kontakty */
function viewContacts() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie kontaktów…</div>`;
  const me = myMemberId();
  if (S.ui.cOwner == null) S.ui.cOwner = me || '';
  const owner = S.ui.cOwner;
  const byOwner = l => !owner || (owner === '_none' ? !l.ownerId : l.ownerId === owner);
  const t = todayISO(), tm = isoDate(addDays(new Date(), 1)), wk = isoDate(addDays(new Date(), 7));
  const open = leadsArr().filter(isOpen).filter(byOwner);
  const withNext = open.filter(l => l.nextTaskDate).sort((a, b) => (a.nextTaskDate + (a.nextTaskTime || '99')).localeCompare(b.nextTaskDate + (b.nextTaskTime || '99')));
  const groups = [
    ['Zaległe', 'bad', withNext.filter(l => l.nextTaskDate < t)],
    ['Dziś', 'acc', withNext.filter(l => l.nextTaskDate === t)],
    ['Jutro', '', withNext.filter(l => l.nextTaskDate === tm)],
    ['Najbliższe 7 dni', '', withNext.filter(l => l.nextTaskDate > tm && l.nextTaskDate <= wk)]
  ];
  const newOnes = open.filter(l => !l.firstCallAt && l.status === 'do_kontaktu').sort((a, b) => (a.createdTs || '').localeCompare(b.createdTs || ''));
  const noNext = open.filter(l => !l.nextTaskDate && l.firstCallAt);
  const meetings = open.filter(l => l.meetingAt && l.meetingAt.slice(0, 10) >= t && l.meetingAt.slice(0, 10) <= wk).sort((a, b) => a.meetingAt.localeCompare(b.meetingAt));
  const pendingSms = Object.values(D().sms || {}).filter(x => x.status === 'oczekuje');
  const ownerLabel = owner ? (owner === '_none' ? 'leady bez opiekuna' : memberName(owner)) : 'cały zespół';
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Przypomnienia</span><h1>Kontakty</h1>
    <p>Kogo i kiedy trzeba złapać – ${esc(ownerLabel)}. Na dziś i zaległe: <b>${groups[0][2].length + groups[1][2].length}</b>.</p></div>
    <div class="actions"><label class="field" style="width:210px"><span>Osoba</span><select id="c-owner" data-act-change="c-owner">${opt('', 'Cały zespół', owner)}${opt('_none', 'Bez opiekuna', owner)}${team().map(m => opt(m.id, m.name + (m.id === me ? ' (Ty)' : ''), owner)).join('')}</select></label>
    <button class="btn primary" data-act="lead-new">${ICONS.plus}Dodaj lead</button></div></div>
    ${!me && team().length ? `<div class="callout" style="margin-bottom:16px">Wskaż, którą osobą z zespołu jesteś (zakładka „Zespół i ustawienia” → „To ja”), a ten widok i licznik w menu pokażą tylko Twoje kontakty.</div>` : ''}`;
  const row = l => {
    const time = l.nextTaskTime ? l.nextTaskTime : (l.nextTaskDate === t ? 'dziś' : fdateShort(l.nextTaskDate));
    return `<div class="contact-row"><span class="when ${dueCls(l.nextTaskDate)}">${esc(time)}</span>
      <div style="min-width:0"><a href="#lead-${l.id}"><b>${esc(l.name || '(bez nazwy)')}</b></a> ${modelPill(l)}<div class="small ink2">${esc(l.nextTask || 'Kontakt')}${l.nextTaskDate < t ? ` · <span class="overdue">od ${fdate(l.nextTaskDate)}</span>` : ''}</div>
      <div class="tiny muted">${esc([l.phone, l.city, STAGES[stageIdx(l)].short, owner ? '' : memberName(l.ownerId)].filter(Boolean).join(' · '))}${l.presentationAt ? ' · prezentacja ' + fdateShort(l.presentationAt) : ''}</div></div>
      <div class="ctl">${l.phone ? `<button class="btn sm ghost" data-act="copy" data-text="${esc(l.phone)}">${ICONS.copy}Telefon</button>` : ''}<button class="btn sm" data-act="snooze" data-id="${l.id}" data-d="1">+1 dzień</button><button class="btn sm primary" data-act="call-log" data-id="${l.id}">Zapisz kontakt</button></div></div>`;
  };
  S.ui.cExpand = S.ui.cExpand || {};
  const groupsHtml = groups.map(([n, tone, list], gi) => { if (!list.length) return ''; const lim = gi < 2 || S.ui.cExpand[gi] ? list.length : 6; return `<div class="card daygroup"><h3>${n} <span class="pill ${tone}">${list.length}</span></h3>${list.slice(0, lim).map(row).join('')}${list.length > lim ? `<button class="btn sm ghost" data-act="c-expand" data-i="${gi}">Pokaż wszystkie (${list.length})</button>` : ''}</div>`; }).join('');
  const newCard = `<div class="card"><div class="cardhead"><h2>Do pierwszego kontaktu</h2><p>${newOnes.length} nowych</p></div>
    ${newOnes.length ? newOnes.map(l => `<div class="contact-row"><span class="when ${l.createdTs && Date.now() - new Date(l.createdTs) > 864e5 ? 'overdue' : 'today'}">${fdateShort(l.createdAt)}</span><div style="min-width:0"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a> ${modelPill(l)}<div class="tiny muted">${esc([l.phone, l.email, l.city, SOURCE_MAP[l.source]?.n].filter(Boolean).join(' · '))}</div></div>
      <div class="ctl">${l.phone ? `<button class="btn sm ghost" data-act="copy" data-text="${esc(l.phone)}">${ICONS.copy}Telefon</button>` : ''}<button class="btn sm primary" data-act="call-log" data-id="${l.id}">Pierwsza rozmowa</button></div></div>`).join('') : '<p class="muted small">Wszyscy nowi kandydaci mają już za sobą pierwszą rozmowę.</p>'}</div>`;
  const trainings = leadsArr().filter(byOwner).filter(l => l.trainingStart && (l.trainingEnd || l.trainingStart) >= t).sort((a2, b2) => a2.trainingStart.localeCompare(b2.trainingStart));
  const wonNoTraining = leadsArr().filter(byOwner).filter(l => isWon(l) && !l.trainingStart);
  const trainCard = (trainings.length || wonNoTraining.length) ? `<div class="card"><div class="cardhead"><h2>Szkolenia w centrali</h2><p>${trainings.length}</p></div>
    ${wonNoTraining.map(l => `<div class="contact-row"><span class="when overdue">brak</span><div style="min-width:0"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a><div class="tiny muted">Umowa podpisana – zaplanuj 3-dniowe szkolenie</div></div><div class="ctl"><button class="btn sm primary" data-act="train-plan" data-id="${l.id}">Od poniedziałku</button></div></div>`).join('')}
    ${trainings.map(l => `<div class="contact-row"><span class="when ${dueCls(l.trainingStart)}">${fdateShort(l.trainingStart)}</span><div style="min-width:0"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a> ${modelPill(l)}<div class="tiny muted">${fdate(l.trainingStart)} – ${fdate(l.trainingEnd || trainingEnd(l.trainingStart))} · centrala</div></div><div></div></div>`).join('')}</div>` : '';
  const meetCard = `<div class="card"><div class="cardhead"><h2>Spotkania – 7 dni</h2><p>${meetings.length}</p></div>${meetings.length ? meetings.map(l => `<div class="contact-row"><span class="when ${dueCls(l.meetingAt)}">${fdateShort(l.meetingAt)}</span><div style="min-width:0"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a><div class="tiny muted">${fdt(l.meetingAt)} · ${esc(l.meetingType || '')} ${esc(l.meetingPlace || '')}</div></div><div></div></div>`).join('') : '<p class="muted small">Brak zaplanowanych spotkań.</p>'}</div>`;
  const noNextCard = noNext.length ? `<div class="card"><div class="cardhead"><h2>Bez zaplanowanego kontaktu</h2><p>${noNext.length}</p></div><p class="note" style="margin-bottom:6px">Aktywni kandydaci po pierwszej rozmowie, którym nikt nie ustawił kolejnego kontaktu.</p>${noNext.slice(0, 15).map(l => `<div class="contact-row"><span class="when muted">—</span><div style="min-width:0"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a> ${modelPill(l)}<div class="tiny muted">ostatni kontakt ${fdateShort(lastContact(l) || l.createdAt)}</div></div><div class="ctl"><button class="btn sm" data-act="snooze" data-id="${l.id}" data-d="1">Na jutro</button></div></div>`).join('')}</div>` : '';
  const smsCard = pendingSms.length ? `<div class="card"><div class="cardhead"><h2>SMS w kolejce</h2><p>${pendingSms.length}</p></div>${smsGatewayOn() ? '' : '<p class="note" style="margin-bottom:6px">Bramka SMS nie jest podłączona. Skopiuj treść i wyślij ręcznie albo poczekaj na podłączenie.</p>'}${pendingSms.map(x => `<div class="contact-row"><span class="when">${fdateShort(x.createdTs)}</span><div style="min-width:0"><a href="#lead-${x.leadId}"><b>${esc(x.leadName)}</b></a> <span class="mono small">${esc(x.phone)}</span><div class="tiny muted">${esc(x.text)}</div></div><div class="ctl"><button class="btn sm ghost" data-act="copy" data-text="${esc(x.text)}">${ICONS.copy}Treść</button><button class="btn sm" data-act="sms-done" data-id="${x.id}">Wysłany ręcznie</button><button class="iconbtn" data-act="sms-cancel" data-id="${x.id}" aria-label="Anuluj">${ICONS.x}</button></div></div>`).join('')}</div>` : '';
  const empty = !groups.some(g => g[2].length) ? `<div class="card"><div class="empty"><h3>Brak zaplanowanych kontaktów na najbliższy tydzień</h3><p>Kolejny kontakt ustawisz przy zapisie rozmowy albo w karcie leada.</p></div></div>` : '';
  return head + `<div class="split"><div class="stack">${groupsHtml}${empty}</div><div class="stack">${newCard}${trainCard}${smsCard}${meetCard}${noNextCard}</div></div>`;
}

/* mail z prezentacją / kalkulatorem: gotowa wiadomość + zapis wysłania */
function openMailModal(l, tplKey) {
  const t = TEMPLATES[tplKey]; if (!t) return;
  const out = t.f(msgContext(l, l.form));
  const isPres = tplKey === 'email_prezentacja';
  const again = tplKey === 'email_umowa_wglad' ? !!l.contractPreviewAt : isPres ? !!l.presentationAt : !!l.calcSentAt;
  const mailto = () => `mailto:${encodeURIComponent(l.email || '')}?subject=${encodeURIComponent($('#ml-subj').value)}&body=${encodeURIComponent($('#ml-body').value)}`;
  openModal(`<div class="mh"><h2>${esc(again ? 'Wyślij ponownie: ' + t.n.toLowerCase() : t.n)} – ${esc(l.name)}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <div class="mb">
      ${again ? `<p class="callout">${tplKey === 'email_umowa_wglad' ? 'Umowa do wglądu była już wysłana ' + fdate(l.contractPreviewAt) : (isPres ? 'Prezentacja była już wysłana ' + fdate(l.presentationAt) : 'Kalkulator był już wysłany ' + fdate(l.calcSentAt))}.</p>` : ''}
      <div class="formgrid">
        <label class="field span2"><span>Do</span><input type="email" id="ml-to" value="${esc(l.email || '')}" placeholder="brak adresu e-mail w karcie leada"></label>
        <div class="field" style="justify-content:flex-end"><button type="button" class="btn sm" id="ml-copy-to">${ICONS.copy}Kopiuj adres</button></div>
        <label class="field full"><span>Temat</span><input type="text" id="ml-subj" value="${esc(out.subject || '')}"></label>
        <label class="field full"><span>Treść</span><textarea id="ml-body" rows="14">${esc(out.body)}</textarea></label>
      </div>
      <div class="row"><button type="button" class="btn sm" id="ml-copy-subj">${ICONS.copy}Kopiuj temat</button><button type="button" class="btn sm" id="ml-copy-body">${ICONS.copy}Kopiuj treść</button><a class="btn sm" id="ml-open" href="#" target="_blank" rel="noopener">${ICONS.email}Otwórz w programie pocztowym</a></div>
      <p class="note">Panel nie wysyła maili sam – wyślij wiadomość ze skrzynki ${esc(offer().email)} (np. Thunderbird), dołącz ${tplKey === 'email_umowa_wglad' ? 'wzór umowy (PDF)' : 'prezentację, jeśli nie ma linku,'} i kliknij „Zapisz jako wysłany”.${(isPres && !offer().linkPrezentacja) ? ' Link do prezentacji możesz ustawić w „Zespół i ustawienia”.' : ''}</p>
    </div>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="ml-save">Zapisz jako wysłany</button></div>`, { wide: true });
  const refreshLink = () => { const a = $('#ml-open'); if (a) a.href = mailto().replace(encodeURIComponent(l.email || ''), encodeURIComponent($('#ml-to').value)); };
  refreshLink();
  ['ml-to', 'ml-subj', 'ml-body'].forEach(id => { $('#' + id).oninput = refreshLink; });
  $('#ml-copy-to').onclick = () => copyText($('#ml-to').value);
  $('#ml-copy-subj').onclick = () => copyText($('#ml-subj').value);
  $('#ml-copy-body').onclick = () => copyText($('#ml-body').value);
  $('#ml-save').onclick = () => {
    const cur = D().leads[l.id]; if (!cur) return closeModal();
    const by = myMemberId() || cur.ownerId || '';
    const hist = (cur.history || []).slice();
    hist.push(histEntry('email', `${again ? 'Ponownie wysłano' : 'Wysłano'}: ${t.n.toLowerCase()} – „${$('#ml-subj').value}”`, { by, result: 'Wysłano materiały' }));
    const p = { history: hist, updatedTs: new Date().toISOString() };
    const to = $('#ml-to').value.trim();
    if (to && to !== cur.email) p.email = to;
    if (tplKey === 'email_umowa_wglad') { p.contractPreviewAt = todayISO(); if (!cur.nextTaskDate || cur.nextTaskDate <= todayISO()) { p.nextTask = 'Telefon – pytania do umowy'; p.nextTaskDate = isoDate(addDays(new Date(), 3)); } }
    else if (isPres) { if (!cur.presentationAt) p.presentationAt = todayISO(); p.presentationSends = (cur.presentationSends || (cur.presentationAt ? 1 : 0)) + 1; p.presentationLastAt = todayISO(); }
    else { if (!cur.calcSentAt) p.calcSentAt = todayISO(); p.calcLastAt = todayISO(); }
    if (tplKey !== 'email_umowa_wglad' && (!cur.nextTaskDate || cur.nextTaskDate <= todayISO())) { p.nextTask = isPres ? 'Telefon po prezentacji' : 'Telefon – omówić konfigurację z kalkulatora'; p.nextTaskDate = isoDate(addDays(new Date(), 3)); }
    if (cur.status === 'do_kontaktu') p.status = 'w_kontakcie';
    patch('leads', l.id, p);
    closeModal();
    toast('Zapisano wysłanie maila' + (p.nextTaskDate ? ' · kolejny kontakt ' + fdate(p.nextTaskDate) : ''));
  };
}
