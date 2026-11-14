/* ===== Obsługa zdarzeń i start aplikacji ===== */

function openLogModal(l, { type = 'tel', title = 'Zadanie wykonane', text = '', result = 'Rozmowa przeprowadzona', stageTo = null } = {}) {
  const nextDefault = isoDate(addDays(new Date(), 2));
  openModal(`<div class="mh"><h2>${esc(title)} – ${esc(l.name)}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <form class="mb" id="log-form"><div class="formgrid">
      <label class="field"><span>Rodzaj</span><select id="lg-type">${CONTACT_TYPES.filter(c => c.k !== 'system').map(c => opt(c.k, c.n, type)).join('')}</select></label>
      <label class="field"><span>Wynik</span><select id="lg-result">${['Rozmowa przeprowadzona', 'Nie odebrał', 'Prośba o kontakt później', 'Wysłano materiały', 'Umówiono spotkanie', 'Spotkanie odbyte', 'Zainteresowany', 'Niezainteresowany', 'Inne'].map(x => opt(x, x, result)).join('')}</select></label>
      <label class="field"><span>Status kontaktu</span><select id="lg-status">${statusOpts(l.status === 'do_kontaktu' ? 'w_kontakcie' : l.status)}</select></label>
      <label class="field full"><span>Opis</span><textarea id="lg-text" rows="3">${esc(text)}</textarea></label>
      <label class="field span2"><span>Następne zadanie</span><input type="text" id="lg-next" list="task-sugg2" placeholder="Co dalej?"></label>
      <label class="field"><span>Termin</span><input type="date" id="lg-nextdate" value="${nextDefault}"></label>
    </div>
    <datalist id="task-sugg2">${['Ponowna próba kontaktu', 'Wysłać prezentację oferty', 'Umówić spotkanie', 'Zebrać dane do analizy lokalizacji', 'Przygotować raport lokalizacji', 'Wysłać ofertę i projekt umowy', 'Telefon decyzyjny', 'Zaplanować szkolenie w Katowicach'].map(x => `<option value="${x}">`).join('')}</datalist></form>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="lg-save">Zapisz</button></div>`);
  const save = () => {
    const cur = D().leads[l.id]; if (!cur) return closeModal();
    const hist = (cur.history || []).slice();
    const t = $('#lg-type').value;
    hist.push({ id: uid('h'), at: nowLocal(), type: t, text: $('#lg-text').value.trim() || (cur.nextTask ? 'Wykonano: ' + cur.nextTask : ''), result: $('#lg-result').value, by: cur.ownerId || '' });
    const p = { history: hist, status: $('#lg-status').value, nextTask: $('#lg-next').value.trim(), nextTaskDate: $('#lg-next').value.trim() ? $('#lg-nextdate').value : '', updatedTs: new Date().toISOString() };
    if (stageIdx(cur) === 0 && ['tel', 'email', 'sms', 'spotkanie'].includes(t) && p.status !== 'proba') {
      p.stage = 'kontakt'; p.stageDates = { ...(cur.stageDates || {}), kontakt: todayISO() };
    }
    if (stageTo && stageIdx(cur) < STAGE_IDX[stageTo]) {
      const sd = { ...(p.stageDates || cur.stageDates || {}) };
      for (let i = 0; i <= STAGE_IDX[stageTo]; i++) if (!sd[STAGES[i].k]) sd[STAGES[i].k] = todayISO();
      p.stage = stageTo; p.stageDates = sd;
    }
    if (p.status === 'umowione' && t === 'spotkanie') p.status = 'w_kontakcie';
    if (t === 'spotkanie') p.meetingAt = '';
    patch('leads', l.id, p);
    closeModal(); toast('Zapisano w historii');
  };
  $('#lg-save').onclick = save;
  $('#log-form').onsubmit = e => { e.preventDefault(); save(); };
}

function handleAction(act, el, e) {
  const id = el.dataset.id;
  const L = id ? D().leads[id] : null;
  switch (act) {
    case 'modal-bg': if (e.target === el) closeModal(); return;
    case 'modal-close': closeModal(); return;
    case 'demo-on': store.demo = buildDemo(); S.demo = true; S.planSel = null; closeModal(); toast('Włączono podgląd na danych przykładowych'); go('centrala'); return;
    case 'demo-off': S.demo = false; store.demo = null; S.planSel = null; S.selected.clear(); toast('Wróciłeś do prawdziwych danych'); go('centrala'); return;
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
      const owner = $('#bulk-owner').value, stage = $('#bulk-stage').value, status = $('#bulk-status').value;
      if (!owner && !stage && !status) { toast('Wybierz, co zmienić.', 'bad'); return; }
      [...S.selected].forEach(lid => {
        const l = D().leads[lid]; if (!l) return;
        if (stage) { setStage(l, stage); }
        const p = {}; const hist = (D().leads[lid].history || []).slice();
        if (owner) { p.ownerId = owner; hist.push(histEntry('system', `Opiekun (zbiorczo): ${memberName(l.ownerId) || 'brak'} → ${memberName(owner)}`)); }
        if (status) { p.status = status; hist.push(histEntry('system', `Status (zbiorczo): ${STATUS_MAP[status].n}`)); }
        if (owner || status) { p.history = hist; patch('leads', lid, p); }
      });
      toast(`Zmieniono ${S.selected.size} leadów`); S.selected.clear(); return;
    }
    case 'bulk-delete': { const n = S.selected.size; confirmBox('Usunąć leady?', `Usuniesz <b>${n}</b> leadów razem z historią kontaktów. Tej operacji nie można cofnąć.`, `Usuń ${n}`, () => { [...S.selected].forEach(lid => remove('leads', lid)); S.selected.clear(); toast('Usunięto'); }); return; }
    case 'open-lead': if (e.target.closest('[data-stop]')) return; go('lead-' + id); return;
    case 'stage-next': if (L) { const i = stageIdx(L); if (i < 6) setStage(L, STAGES[i + 1].k); } return;
    case 'set-stage': if (L && L.stage !== el.dataset.k) setStage(L, el.dataset.k); return;
    case 'task-done': if (L) openLogModal(L, { text: L.nextTask ? 'Wykonano: ' + L.nextTask : '' }); return;
    case 'task-shift': if (L) { const base = L.nextTaskDate && L.nextTaskDate > todayISO() ? parseD(L.nextTaskDate) : new Date(); patch('leads', id, { nextTaskDate: isoDate(addDays(base, +el.dataset.d)) }); } return;
    case 'meeting-log': if (L) openLogModal(L, { type: 'spotkanie', title: 'Spotkanie odbyte', result: 'Spotkanie odbyte', text: 'Spotkanie ' + (L.meetingType || '') + ' – ', stageTo: 'spotkanie' }); return;
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
      const entry = { id: uid('h'), at: $('#h-at').value || nowLocal(), type: $('#h-type').value, text, result: $('#h-result').value, by: $('#h-by').value };
      const hist = (L.history || []).slice(); hist.push(entry);
      const p = { history: hist, updatedTs: new Date().toISOString() };
      if (L.status === 'do_kontaktu' && entry.result !== 'Nie odebrał') p.status = 'w_kontakcie';
      if (L.status === 'do_kontaktu' && entry.result === 'Nie odebrał') p.status = 'proba';
      if (stageIdx(L) === 0 && entry.result !== 'Nie odebrał') { p.stage = 'kontakt'; p.stageDates = { ...(L.stageDates || {}), kontakt: todayISO() }; }
      patch('leads', id, p); toast('Dodano wpis'); return;
    }
    case 'hist-del': if (L) patch('leads', id, { history: (L.history || []).filter(h => h.id !== el.dataset.h) }); return;
    case 'lead-del': if (L) confirmBox('Usunąć leada?', `Usuniesz <b>${esc(L.name)}</b> razem z historią kontaktów. Tej operacji nie można cofnąć.`, 'Usuń leada', () => { remove('leads', id); go('leady'); toast('Lead usunięty'); }); return;
    case 'copy': copyText(el.dataset.text); return;
    case 'loc-new': newLocation(el.dataset.lead || ''); return;
    // plan
    case 'plan-new': { const p = makePlan({ name: 'Wariant ' + (Object.keys(D().plans).length + 1) }); put('plans', p.id, p); S.planSel = p.id; if (!settings().activePlanId) saveSettings({ activePlanId: p.id }); return; }
    case 'plan-seed': seedPlans(); return;
    case 'plan-sel': S.planSel = id; scheduleRender(); return;
    case 'plan-activate': saveSettings({ activePlanId: id }); toast('Ustawiono plan aktywny'); return;
    case 'plan-dup': { const src = D().plans[id]; if (!src) return; const p = { ...clone(src), id: uid('p'), name: src.name + ' (kopia)', createdAt: new Date().toISOString() }; put('plans', p.id, p); S.planSel = p.id; return; }
    case 'plan-del': { const p = D().plans[id]; if (!p) return; confirmBox('Usunąć wariant?', `Usuniesz wariant <b>${esc(p.name)}</b>.`, 'Usuń', () => { remove('plans', id); if (settings().activePlanId === id) { const other = Object.values(D().plans).find(x => x.id !== id); saveSettings({ activePlanId: other ? other.id : '' }); } S.planSel = null; }); return; }
    case 'plan-normalize': { const p = planDraft(); const tot = sum(Object.values(p.mix || {})); if (tot <= 0) return; const mix = Object.fromEntries(Object.entries(p.mix).map(([k, v]) => [k, Math.round(v / tot * 1000) / 10])); put('plans', p.id, { ...p, mix }); return; }
    case 'plan-conv-actual': { const p = planDraft(); const f = funnelOf(leadsArr()); const conv = (p.conv || DEFAULT_CONV).map((c, i) => f.conv[i] != null && f.reached[i] >= 5 ? Math.round(f.conv[i] * 100) / 100 : c); put('plans', p.id, { ...p, conv }); toast('Wczytano konwersje z lejka'); return; }
    case 'spend-add': {
      const amount = +$('#sp-amount').value;
      if (!(amount > 0)) { toast('Wpisz kwotę większą od zera.', 'bad'); return; }
      const x = { id: uid('s'), date: $('#sp-date').value || todayISO(), source: $('#sp-source').value, amount, note: $('#sp-note').value.trim(), createdAt: new Date().toISOString() };
      put('spend', x.id, x); toast('Dodano wydatek ' + zl(amount)); return;
    }
    case 'spend-del': remove('spend', id); return;
    case 'spend-all': S.ui.spendAll = !S.ui.spendAll; scheduleRender(); return;
    // harmonogram i zadania
    case 'rm-seed': seedRoadmap(); toast('Utworzono harmonogram 90 dni'); return;
    case 'rm-add': openTaskModal(null, { kind: 'plan90', week: clamp(planWeekOf(activePlan()), 1, 13) }); return;
    case 'task-toggle': { const t = D().tasks[id]; if (t) patch('tasks', id, { done: el.checked, doneAt: el.checked ? todayISO() : '' }); return; }
    case 'task-edit': { const t = D().tasks[id]; if (t) openTaskModal(t); return; }
    case 'task-del': { const t = D().tasks[id]; if (t) confirmBox('Usunąć zadanie?', esc(t.title), 'Usuń', () => remove('tasks', id)); return; }
    case 'task-new': openTaskModal(null, { kind: 'weekly', due: el.dataset.due }); return;
    case 'week-shift': S.weekOffset = el.dataset.d === '0' ? 0 : S.weekOffset + (+el.dataset.d); scheduleRender(); return;
    case 'week-generate': generateWeekTasks(); return;
    // wiadomości
    case 'tpl': S.msg.tpl = el.dataset.k; S.ui.aiText = ''; scheduleRender(); return;
    case 'copy-subject': copyText((S.ui.msgOut || {}).subject || ''); return;
    case 'copy-msg': copyText((S.ui.msgOut || {}).body || ''); return;
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
    case 'comp-add': { const x = D().locations[S.route.id]; if (!x) return; put('locations', x.id, { ...x, competitors: [...(x.competitors || []), { name: '', type: 'automat', dist: 300, strength: 3 }], updatedTs: new Date().toISOString() }); return; }
    case 'comp-del': { const x = D().locations[S.route.id]; if (!x) return; const c = (x.competitors || []).slice(); c.splice(+el.dataset.i, 1); put('locations', x.id, { ...x, competitors: c, updatedTs: new Date().toISOString() }); return; }
    case 'loc-ai': locAiComment(id, el); return;
    case 'loc-ai-clear': patch('locations', id, { aiComment: '' }); return;
    case 'report-copy': { const x = D().locations[id]; if (x) copyText(reportSummaryText(x, analyzeLocation(x))); return; }
    case 'report-xlsx': exportLocationXLSX(id); return;
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
  if (el.dataset.f === 'q') { S.f.q = el.value; debounce('q', () => scheduleRender(), 250); return; }
  if (el.dataset.plan || el.dataset.planMix || el.dataset.planCpl || el.dataset.planConv) { onPlanInput(el, false); return; }
  if (el.dataset.loc != null || el.dataset.locA || el.dataset.comp != null) { if (el.tagName !== 'SELECT') onLocInput(el); return; }
  if (el.dataset.locComment) { const id = el.dataset.locComment; const v = el.value; debounce('loc-comment', () => patch('locations', id, { aiComment: v }), 900); return; }
});

document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.f && el.dataset.f !== 'q') { S.f[el.dataset.f] = el.value; S.selected.clear(); scheduleRender(); return; }
  if (el.dataset.leadField) { saveLeadField(el); return; }
  if (el.closest && el.closest('#lead-edit')) { saveLeadEdit(); return; }
  if (el.dataset.plan || el.dataset.planMix || el.dataset.planCpl || el.dataset.planConv) { onPlanInput(el, true); return; }
  if (el.dataset.taskOwner) { patch('tasks', el.dataset.taskOwner, { ownerId: el.value }); return; }
  if (el.dataset.msg) {
    S.msg[el.dataset.msg] = el.value;
    if (el.dataset.msg === 'leadId') { const l = D().leads[el.value]; S.msg.form = l ? (l.form || 'panstwo') : S.msg.form; }
    S.ui.aiText = ''; scheduleRender(); return;
  }
  if (el.dataset.loc != null || el.dataset.locA || el.dataset.comp != null) { onLocInput(el); return; }
  if (el.dataset.offer) {
    const o = { ...(settings().offer || {}) };
    o[el.dataset.offer] = el.type === 'number' ? +el.value : el.value;
    saveSettings({ offer: o }); return;
  }
  if (el.dataset.impMap != null) { IMP.map[el.dataset.impMap] = el.value; keepImpDefaults(); renderImport(); return; }
  if (['imp-src', 'imp-owner', 'imp-region', 'imp-dups'].includes(el.id)) { keepImpDefaults(); renderImport(); return; }
  if (el.id === 'task-owner-f') { S.ui.taskOwner = el.value; scheduleRender(); return; }
});
function keepImpDefaults() {
  IMP.defSource = ($('#imp-src') || {}).value || IMP.defSource;
  IMP.defOwner = ($('#imp-owner') || {}).value ?? IMP.defOwner;
  IMP.defRegion = ($('#imp-region') || {}).value ?? IMP.defRegion;
  IMP.dups = ($('#imp-dups') || {}).value || IMP.dups;
}

/* przeciąganie kart w kanbanie */
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('[data-drag-lead]');
  if (c) { e.dataTransfer.setData('text/plain', c.dataset.dragLead); e.dataTransfer.effectAllowed = 'move'; }
});
document.addEventListener('dragover', e => {
  const col = e.target.closest && e.target.closest('[data-drop-stage]');
  if (col) { e.preventDefault(); $$('.kcol.drop').forEach(x => x !== col && x.classList.remove('drop')); col.classList.add('drop'); }
});
document.addEventListener('dragleave', e => {
  const col = e.target.closest && e.target.closest('[data-drop-stage]');
  if (col && !col.contains(e.relatedTarget)) col.classList.remove('drop');
});
document.addEventListener('drop', e => {
  const col = e.target.closest && e.target.closest('[data-drop-stage]');
  if (!col) return;
  e.preventDefault(); col.classList.remove('drop');
  const id = e.dataTransfer.getData('text/plain'); const l = D().leads[id];
  if (l && l.stage !== col.dataset.dropStage) setStage(l, col.dataset.dropStage);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

function afterRender() { }

S.route = parseRoute();
render();
initCapabilities();
