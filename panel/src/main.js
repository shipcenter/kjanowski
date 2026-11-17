/* ===== Obsługa zdarzeń i start aplikacji ===== */

function handleAction(act, el, e) {
  const id = el.dataset.id;
  const L = id ? D().leads[id] : null;
  switch (act) {
    case 'modal-bg': if (e.target === el) closeModal(); return;
    case 'modal-close': closeModal(); return;
    case 'demo-on': store.demo = buildDemo(); S.demo = true; S.ui.cOwner = null; closeModal(); toast('Włączono podgląd na danych przykładowych'); go('centrala'); return;
    case 'demo-off': S.demo = false; store.demo = null; S.ui.cOwner = null; S.selected.clear(); toast('Wróciłeś do prawdziwych danych'); go('centrala'); return;
    case 'lead-new': openLeadModal(); return;
    case 'import-open': openImport(); return;
    case 'export-xlsx': exportXLSX(false); return;
    case 'export-xlsx-leads': exportXLSX(true); return;
    case 'export-csv': exportCSV(); return;
    case 'filters-clear': S.f = { ...S.f, source: '', owner: '', region: '', status: '', q: '', ids: null, idsLabel: '' }; scheduleRender(); return;
    case 'filter-source': S.f.source = el.dataset.k; scheduleRender(); return;
    case 'filter-owner': S.f.owner = el.dataset.k; scheduleRender(); return;
    case 'alert-list': S.f.ids = (S.ui.alertLists || [])[+el.dataset.i] || []; S.f.idsLabel = el.textContent; go('leady'); return;
    case 'leads-view': S.leadsView = el.dataset.v; scheduleRender(); return;
    case 'sort': { const k = el.dataset.k; S.sort = { key: k, dir: S.sort.key === k && S.sort.dir === 'asc' ? 'desc' : 'asc' }; scheduleRender(); return; }
    case 'sel-all': { const ids = S.ui.visibleLeadIds || []; if (el.checked) ids.forEach(x => S.selected.add(x)); else S.selected.clear(); scheduleRender(); return; }
    case 'sel': if (el.checked) S.selected.add(id); else S.selected.delete(id); scheduleRender(); return;
    case 'bulk-clear': S.selected.clear(); scheduleRender(); return;
    case 'bulk-apply': {
      const owner = $('#bulk-owner').value, status = $('#bulk-status').value;
      if (!owner && !status) { toast('Wybierz, co zmienić.', 'bad'); return; }
      [...S.selected].forEach(lid => {
        const l = D().leads[lid]; if (!l) return;
        const p = {}; const hist = (D().leads[lid].history || []).slice();
        if (owner) { p.ownerId = owner; hist.push(histEntry('system', `Opiekun (zbiorczo): ${memberName(l.ownerId) || 'brak'} → ${memberName(owner)}`)); }
        if (status) { p.status = status; hist.push(histEntry('system', `Status (zbiorczo): ${STATUS_MAP[status].n}`)); }
        if (owner || status) { p.history = hist; patch('leads', lid, p); }
      });
      toast(`Zmieniono ${S.selected.size} leadów`); S.selected.clear(); return;
    }
    case 'bulk-delete': { openDeleteGate([...S.selected]); return; const n = S.selected.size; confirmBox('Usunąć leady?', `Usuniesz <b>${n}</b> leadów razem z historią kontaktów. Tej operacji nie można cofnąć.`, `Usuń ${n}`, () => { [...S.selected].forEach(lid => remove('leads', lid)); S.selected.clear(); toast('Usunięto'); }); return; }
    case 'open-lead': if (e.target.closest('[data-stop]')) return; go('lead-' + id); return;
    case 'task-done': case 'call-log': if (L) openCallModal(L, {}); return;
    case 'snooze': if (L) { patch('leads', id, { nextTaskDate: isoDate(addDays(new Date(), +el.dataset.d)), nextTask: L.nextTask || 'Kontakt' }); toast('Przesunięto na ' + fdate(isoDate(addDays(new Date(), +el.dataset.d)))); } return;
    case 'pres-sent': if (L) markPresentation(L); return;
    case 'mail-tpl': if (L) openMailModal(L, el.dataset.tpl); return;
    case 'train-plan': if (L) setTraining(L, nextMonday()); return;
    case 'contract-sent': if (L) { const hist = (L.history || []).slice(); hist.push(histEntry('system', 'Umowa wysłana do podpisu w Autenti', { by: myMemberId() || L.ownerId || '' })); patch('leads', id, { contractSentAt: todayISO(), status: 'czeka_umowa', history: hist, nextTask: 'Sprawdzić podpis umowy w Autenti', nextTaskDate: isoDate(addDays(new Date(), 2)), updatedTs: new Date().toISOString() }); toast('Status: czeka na podpisanie umowy'); } return;
    case 'contract-signed': if (L) { const hist = (L.history || []).slice(); hist.push(histEntry('system', 'Umowa podpisana (Autenti)', { by: myMemberId() || L.ownerId || '' })); patch('leads', id, { contractSignedAt: todayISO(), status: 'pozyskany', stageDates: { ...(L.stageDates || {}), umowa: (L.stageDates || {}).umowa || todayISO() }, history: hist, nextTask: '', nextTaskDate: '', updatedTs: new Date().toISOString() }); toast('Umowa podpisana – zaplanuj szkolenie w centrali'); } return;
    case 'c-expand': S.ui.cExpand = { ...(S.ui.cExpand || {}), [el.dataset.i]: true }; scheduleRender(); return;
    case 'pres-clear': if (L) patch('leads', id, { presentationAt: '', presentationLastAt: '', presentationSends: 0 }); return;
    case 'reg-lookup': if (L) { delete REG.cache[nipDigits(L.nip)]; autoNip('le', id, true); } return;
    case 'pl-pdf': if (L) plDownload(L, el.dataset.lvl); return;
    case 'pl-mail': if (L) plMail(L, el.dataset.lvl); return;
    case 'nda-send': if (L) ndaSendOnly(L); return;
    case 'nda-pdf': if (L) { toast('Przygotowuję PDF…'); ndaPdfBytes(L).then(b => offerDownload(ndaFileName(L), new Uint8Array(b))).catch(e2 => toast('Nie udało się: ' + e2.message, 'bad')); } return;
    case 'nda-confirm': if (L) ndaConfirmCode(L, ($('#nda-code') || {}).value); return;
    case 'nda-signed': if (L) { const hist = (L.history || []).slice(); hist.push(histEntry('system', 'Kandydat podpisał umowę o zachowaniu poufności (NDA)')); patch('leads', L.id, { ndaAt: todayISO(), history: hist, updatedTs: new Date().toISOString() }); toast('Zapisano: NDA podpisana'); } return;
    case 'nda-clear': if (L) patch('leads', L.id, { ndaAt: '', updatedTs: new Date().toISOString() }); return;
    case 'prem-add': if (L) openPremAdd(L); return;
    case 'prem-mail': if (L) premMail(L); return;
    case 'prem-del': if (L) { const list = (L.premises || []).slice(); list.splice(+el.dataset.i, 1); patch('leads', L.id, { premises: list, updatedTs: new Date().toISOString() }); } return;
    case 'krd-check': if (L) openKrd(L); return;
    case 'script-open': if (L) openScript(L); return;
    case 'meet-quick': if (L) openMeetQuick(L); return;
    case 'photo-open': if (L) openPhoto(L, +el.dataset.i); return;
    case 'sms-compose': if (L) openSmsCompose(L); return;
    case 'mail-compose': if (L) openCompose({ leadId: L.id }); else openCompose({}); return;
    case 'mail-open': if (e.target.closest('a')) return; openMailReader(el.dataset.folder, el.dataset.uid); return;
    case 'mail-att': downloadMailAttachment(el.dataset.folder, el.dataset.uid, el.dataset.i); return;
    case 'mail-refresh': mailRefresh(el.dataset.key); return;
    case 'mail-sync': syncInquiries(true); return;
    case 'mail-filter': MAIL.filter = el.dataset.k; scheduleRender(); return;
    case 'flex-mail': if (L) openCompose({ leadId: L.id, subject: 'Konfiguracja pakietu FLEX – ShipCenter', body: flexEmailBody(L) }); return;
    case 'smart-reset': if (L) { patch('leads', L.id, { smartPrice: '', updatedTs: new Date().toISOString() }); } return;
    case 'smart-mail': if (L) openCompose({ leadId: L.id, subject: 'Pakiet SMART – podsumowanie oferty ShipCenter', body: smartEmailBody(L) }); return;
    case 'set-pkg': if (L) { const v = L.pkg === el.dataset.pkg ? '' : el.dataset.pkg; const hist = (L.history || []).slice(); hist.push(histEntry('system', `Pakiet: ${PACKAGES[L.pkg] || '—'} → ${PACKAGES[v] || '—'}`)); patch('leads', L.id, { pkg: v, history: hist, updatedTs: new Date().toISOString() }); } return;
    case 'del-approve': if (L) openDeleteGate([L.id], { approve: true }); return;
    case 'del-reject': if (L) { const hist = (L.history || []).slice(); hist.push(histEntry('system', 'Administrator odrzucił prośbę o usunięcie leada')); patch('leads', id, { deleteRequest: null, history: hist, updatedTs: new Date().toISOString() }); toast('Odrzucono prośbę o usunięcie'); } return;
    case 'admin-pass': openAdminPassModal(); return;
    case 'flex-clear': if (L) patch('leads', L.id, { flexItems: [], updatedTs: new Date().toISOString() }); return;
    case 'contract-pdf': downloadContract(el.dataset.file); return;
    case 'meet-use': if (L) { const link = meetLinkFor(L); if (link) { patch('leads', id, { meetingPlace: link, updatedTs: new Date().toISOString() }); setTimeout(() => syncReminders(id, 'spotkanie'), 300); } } return;
    case 'meet-confirm': if (L) openMailModal(L, 'email_potwierdzenie'); return;
    case 'sms-remind': if (L) openSmsReminderModal(L, el.dataset.topic || 'spotkanie', el.dataset.sms || ''); return;
    case 'sms-done': { const x = D().sms[id]; if (x) patch('sms', id, { status: 'wyslany', sentTs: new Date().toISOString(), manual: true }); return; }
    case 'sms-cancel': { if (D().sms[id]) cancelSms(id); return; }
    case 'me-bind': { if (!S.userId) { toast('Nie udało się ustalić Twojego konta – otwórz panel w claude.ai po zalogowaniu.', 'bad'); return; } Object.values(D().team).filter(m => m.userId === S.userId && m.id !== id).forEach(m => patch('team', m.id, { userId: '' })); patch('team', id, { userId: S.userId }); S.ui.cOwner = null; toast('Zapamiętano: to Ty'); return; }
    case 'me-unbind': patch('team', id, { userId: '' }); S.ui.cOwner = null; return;
    case 'task-shift': if (L) { const base = L.nextTaskDate && L.nextTaskDate > todayISO() ? parseD(L.nextTaskDate) : new Date(); patch('leads', id, { nextTaskDate: isoDate(addDays(base, +el.dataset.d)) }); } return;
    case 'meeting-log': if (L) openCallModal(L, { type: 'spotkanie', title: 'Spotkanie odbyte', result: 'Spotkanie odbyte', text: 'Spotkanie ' + (L.meetingType || '') + ' – ', stageTo: 'spotkanie' }); return;
    case 'msg-for': if (L) { S.msg = { tpl: el.dataset.tpl, leadId: id, form: L.form || 'panstwo' }; S.ui.aiText = ''; go('wiadomosci'); } return;
    case 'handoff': {
      if (!L) return;
      const to = $('#ho-to').value; if (!to) { toast('Wybierz osobę, której przekazujesz leada.', 'bad'); return; }
      if (to === L.ownerId) { toast('Ta osoba już jest opiekunem leada.', 'bad'); return; }
      const h = { id: uid('ho'), date: $('#ho-date').value || todayISO(), from: L.ownerId || '', fromName: memberName(L.ownerId) || 'brak', to, toName: memberName(to), note: $('#ho-note').value.trim() };
      const hist = (L.history || []).slice(); hist.push(histEntry('system', `Przekazano leada: ${h.fromName} → ${h.toName}${h.note ? '. ' + h.note : ''}`));
      patch('leads', id, { ownerId: to, handoffs: [...(L.handoffs || []), h], history: hist });
      toast('Lead przekazany: ' + h.toName); return;
    }
    case 'hist-add': {
      if (!L) return;
      const text = $('#h-text').value.trim();
      if (!text) { toast('Wpisz opis kontaktu.', 'bad'); $('#h-text').focus(); return; }
      const entry = { id: uid('h'), at: $('#h-at').value || nowLocal(), type: $('#h-type').value, text, result: $('#h-result').value, by: $('#h-by').value, manual: true };
      const hist = (L.history || []).slice(); hist.push(entry);
      const p = { history: hist, updatedTs: new Date().toISOString() };
      if (L.status === 'do_kontaktu' && entry.result !== 'Nie odebrał') p.status = 'w_kontakcie';
      if (L.status === 'do_kontaktu' && entry.result === 'Nie odebrał') p.status = 'proba';
      if (entry.type === 'tel' && entry.result !== 'Nie odebrał' && !L.firstCallAt) p.firstCallAt = (entry.at || todayISO()).slice(0, 10);
      if (entry.type === 'spotkanie' && !(L.stageDates || {}).spotkanie) p.stageDates = { ...(L.stageDates || {}), spotkanie: (entry.at || todayISO()).slice(0, 10) };
      patch('leads', id, p); toast('Dodano wpis'); return;
    }
    case 'hist-del': if (L) patch('leads', id, { history: (L.history || []).filter(h => h.id !== el.dataset.h) }); return;
    case 'lead-del': if (L) { openDeleteGate([L.id]); return; } if (L) confirmBox('Usunąć leada?', `Usuniesz <b>${esc(L.name)}</b> razem z historią kontaktów. Tej operacji nie można cofnąć.`, 'Usuń leada', () => { remove('leads', id); go('leady'); toast('Lead usunięty'); }); return;
    case 'copy': copyText(el.dataset.text); return;
    case 'loc-new': newLocation(el.dataset.lead || ''); return;
    // wiadomości
    case 'tpl': S.msg.tpl = el.dataset.k; S.ui.aiText = ''; S.ui.tplEdit = null; scheduleRender(); return;
    case 'tpl-edit': S.ui.tplEdit = el.dataset.k; scheduleRender(); return;
    case 'tpl-new': S.ui.tplEdit = '__new'; scheduleRender(); return;
    case 'te-save': tplSave(el.dataset.k); return;
    case 'te-cancel': S.ui.tplEdit = null; scheduleRender(); return;
    case 'te-reset': confirmBox('Przywrócić wersję domyślną?', 'Twoje zmiany w tym szablonie zostaną usunięte.', 'Przywróć', () => tplReset(el.dataset.k), false); return;
    case 'te-del': confirmBox('Usunąć szablon?', 'Własny szablon zniknie z listy.', 'Usuń', () => tplDelete(el.dataset.k)); return;
    case 'te-var': tplInsertVar(el.dataset.k); return;
    case 'copy-subject': copyText((S.ui.msgOut || {}).subject || ''); return;
    case 'copy-msg': copyText((S.ui.msgOut || {}).body || ''); return;
    case 'copy-msg-html': { const b = (S.ui.msgOut || {}).body || ''; copyEmailHtml(emailHtml(b, S.msg.leadId ? D().leads[S.msg.leadId] : null, false), b); return; }
    case 'copy-ai': copyText(S.ui.aiText || ''); return;
    case 'ai-clear': S.ui.aiText = ''; scheduleRender(); return;
    case 'ai-rewrite': aiRewrite(el); return;
    case 'msg-log': {
      if (!L) return; const t = TEMPLATES[S.msg.tpl];
      const type = ({ 'E-mail': 'email', SMS: 'sms', LinkedIn: 'notatka', Skrypt: 'tel', Notatka: 'notatka' })[t.kind] || 'notatka';
      const hist = (L.history || []).slice(); hist.push({ id: uid('h'), at: nowLocal(), type, text: (t.kind === 'Skrypt' ? 'Rozmowa wg skryptu: ' : 'Wysłano: ') + t.n + ((S.ui.msgOut || {}).subject ? ' – „' + S.ui.msgOut.subject + '”' : ''), result: t.kind === 'Skrypt' ? 'Rozmowa przeprowadzona' : 'Wysłano materiały', by: L.ownerId || '' });
      const p = { history: hist }; if (L.status === 'do_kontaktu') p.status = 'w_kontakcie';
      patch('leads', id, p); toast('Zapisano w historii leada'); return;
    }
    // lokalizacje
    case 'loc-del': { const x = D().locations[id]; if (x) confirmBox('Usunąć analizę?', `Usuniesz analizę <b>${esc(x.name)}</b>.`, 'Usuń', () => { remove('locations', id); go('lokalizacje'); }); return; }
    case 'comp-add': { const x = D().locations[S.route.id]; if (!x) return; put('locations', x.id, { ...x, competitors: [...(x.competitors || []), { name: '', type: 'epaka', dist: 500, strength: 3 }], updatedTs: new Date().toISOString() }); return; }
    case 'comp-del': { const x = D().locations[S.route.id]; if (!x) return; const c = (x.competitors || []).slice(); c.splice(+el.dataset.i, 1); put('locations', x.id, { ...x, competitors: c, updatedTs: new Date().toISOString() }); return; }
    case 'loc-ai': locAiComment(id, el); return;
    case 'loc-ai-clear': patch('locations', id, { aiComment: '' }); return;
    case 'report-copy': { const x = D().locations[id]; if (x) copyText(reportSummaryText(x, analyzeLocation(x))); return; }
    case 'report-xlsx': exportLocationXLSX(id); return;
    case 'report-pdf': downloadReportPdf(id, el); return;
    case 'loc-autofill': autoFillLocation(id, el); return;
    case 'rev-auto': { const x = D().locations[id]; if (x) put('locations', id, { ...x, rev: { ...LOC_DEFAULTS.rev, ...(x.rev || {}), parcels: null }, updatedTs: new Date().toISOString() }); return; }
    case 'report-mail': openReportMailModal(id); return;
    case 'report-html': { const x = D().locations[id]; if (!x) return; const doc = reportHTML(x, analyzeLocation(x), true); offerDownload(`raport-lokalizacji-${slug(x.city || x.name)}.html`, doc, doc); return; }
    // zespół i ustawienia
    case 'member-new': openMemberModal(); return;
    case 'member-edit': openMemberModal(D().team[id]); return;
    case 'member-del': { const m = D().team[id]; if (!m) return; const n = leadsArr().filter(l => l.ownerId === id).length; confirmBox('Usunąć osobę?', `Usuniesz <b>${esc(m.name)}</b> z zespołu.${n ? ` ${n} leadów zostanie bez opiekuna – przypisz je ponownie.` : ''}`, 'Usuń', () => remove('team', id)); return; }
    case 'auto-assign': autoAssign(); return;
    case 'offer-reset': saveSettings({ offer: {} }); toast('Przywrócono parametry z umowy'); return;
    // import
    case 'imp-paste': { const t = $('#imp-paste').value; if (!t.trim()) { toast('Wklej dane z arkusza.', 'bad'); return; } setImportTable(parseCSV(t), 'Wklejone dane'); return; }
    case 'imp-reset': openImport(); return;
    case 'imp-run': runImport(el); return;
  }
}

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  if (el.tagName === 'A' && el.getAttribute('href')) return;
  if (el.tagName === 'BUTTON' || act === 'modal-bg') { if (el.type === 'submit') e.preventDefault(); }
  handleAction(act, el, e);
});

document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.suggest) sugOnInput(el);
  if (el.dataset.f === 'q') { S.f.q = el.value; debounce('q', () => scheduleRender(), 250); return; }
  if (el.dataset.loc != null || el.dataset.locA || el.dataset.comp != null) { if (el.tagName !== 'SELECT') onLocInput(el); return; }
  if (el.dataset.rev) { onRevInput(el, false); return; }
  if (el.dataset.geo === 'lf') { debounce('geo-lf', () => autoGeo('lf'), 1200); return; }
  if (el.dataset.nipAuto === 'lf') { debounce('nip-lf', () => autoNip('lf'), 500); return; }
  if (el.dataset.locComment) { const id = el.dataset.locComment; const v = el.value; debounce('loc-comment', () => patch('locations', id, { aiComment: v }), 900); return; }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.f && el.dataset.f !== 'q') { S.f[el.dataset.f] = el.value; S.selected.clear(); scheduleRender(); return; }
  if (el.dataset.rev) { onRevInput(el, true); return; }
  if (el.dataset.geo) { const pf = el.dataset.geo; if (pf === 'le') saveLeadEdit(); debounce('geo-' + pf, () => autoGeo(pf), 250); return; }
  if ((el.id === 'lf-region' || el.id === 'le-region') && el.dataset.prog) { delete el.dataset.prog; if (el.id === 'le-region') saveLeadEdit(); return; }
  if (el.id === 'lf-region' || el.id === 'le-region') { el.dataset.touched = '1'; el.dataset.auto = ''; if (el.id === 'le-region') { saveLeadEdit(); patch('leads', S.route.id, { regionManual: !!el.value }); } return; }
  if (el.dataset.prem) { const l = D().leads[S.route.id]; if (l) patch('leads', l.id, { premCrit: { ...(l.premCrit || {}), [el.dataset.prem]: +el.value || '' }, updatedTs: new Date().toISOString() }); return; }
  if (el.dataset.premSt != null) { const l = D().leads[S.route.id]; if (l) { const list = (l.premises || []).slice(); if (list[+el.dataset.premSt]) list[+el.dataset.premSt] = { ...list[+el.dataset.premSt], status: el.value }; patch('leads', l.id, { premises: list, updatedTs: new Date().toISOString() }); } return; }
  if (el.dataset.settingChk) { saveSettings({ [el.dataset.settingChk]: el.checked }); return; }
  if (el.dataset.plImport) { const f = el.files && el.files[0]; if (f) plImport(el.dataset.plImport, f); el.value = ''; return; }
  if (el.dataset.plPrev) { plTogglePreview(el.dataset.plPrev, el.checked); return; }
  if (el.dataset.plCountry) { plToggleCountry(el.dataset.plCountry, el.checked); return; }
  if (el.dataset.spParcel) { toggleSpParcel(S.route.id, el.dataset.spParcel, el.checked); return; }
  if (el.dataset.photoUp) { uploadPhotos(el.dataset.photoUp, el.files); el.value = ''; return; }
  if (el.dataset.flex) { toggleFlex(S.route.id, el.dataset.flex, el.checked); return; }
  if (el.dataset.train) { const l = D().leads[el.dataset.train]; if (l) setTraining(l, el.value); return; }
  if (el.dataset.leadField) { saveLeadField(el); return; }
  if (el.closest && el.closest('#lead-edit')) { saveLeadEdit(); return; }
  if (el.dataset.msg) {
    S.msg[el.dataset.msg] = el.value;
    if (el.dataset.msg === 'leadId') { const l = D().leads[el.value]; S.msg.form = l ? (l.form || 'panstwo') : S.msg.form; }
    S.ui.aiText = ''; scheduleRender(); return;
  }
  if (el.dataset.loc != null || el.dataset.locA || el.dataset.comp != null) { onLocInput(el); if (el.dataset.loc === 'address' || el.dataset.loc === 'city') setTimeout(() => maybeAutoFill(S.route.id), 1000); return; }
  if (el.dataset.offer) {
    const o = { ...(settings().offer || {}) };
    o[el.dataset.offer] = el.type === 'number' ? +el.value : el.value;
    saveSettings({ offer: o }); return;
  }
  if (el.dataset.impMap != null) { IMP.map[el.dataset.impMap] = el.value; keepImpDefaults(); renderImport(); return; }
  if (['imp-src', 'imp-owner', 'imp-region', 'imp-dups'].includes(el.id)) { keepImpDefaults(); renderImport(); return; }
  if (el.id === 'c-owner') { S.ui.cOwner = el.value; scheduleRender(); return; }
  if (el.dataset.setting) { const v = el.type === 'number' ? +el.value : el.value; saveSettings({ [el.dataset.setting]: v }); return; }
});
function keepImpDefaults() {
  IMP.defSource = ($('#imp-src') || {}).value || IMP.defSource;
  IMP.defOwner = ($('#imp-owner') || {}).value ?? IMP.defOwner;
  IMP.defRegion = ($('#imp-region') || {}).value ?? IMP.defRegion;
  IMP.dups = ($('#imp-dups') || {}).value || IMP.dups;
}

document.addEventListener('paste', e => {
  const el = e.target;
  if (el && el.dataset && el.dataset.nipPaste) { const text = (e.clipboardData || window.clipboardData).getData('text'); e.preventDefault(); onNipPaste(el, text); }
});
document.addEventListener('keydown', e => { if (sugOnKey(e)) return; if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });
document.addEventListener('focusout', e => { const t = e.target; if (t && t.dataset && t.dataset.suggest) setTimeout(() => { if (document.activeElement !== t) sugHide(); }, 180); });
window.addEventListener('scroll', () => { if (SUG.el) sugHide(); }, true);

function afterRender() { }

S.route = parseRoute();
render();
initCapabilities();
