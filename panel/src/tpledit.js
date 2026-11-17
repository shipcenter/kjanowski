/* ===== Edycja szablonów i skryptów =====
   Zmienione wersje i własne szablony są we wspólnych ustawieniach (settings.tplOverrides, settings.tplCustom).
   Tekst z wstawkami {imie}, {miasto}… oraz {forma: Pan | Pani | Państwo | Ty} podmienianymi przy użyciu. */

const TPL_VARS = [
  ['powitanie', 'Dzień dobry… (wg formy zwrotu)', c => powitanie(c)],
  ['imie', 'imię kandydata', c => c.imie],
  ['imie_nazwisko', 'imię i nazwisko', c => c.pelne],
  ['miasto', 'miasto punktu', c => c.miasto],
  ['firma', 'firma kandydata', c => (c.l && (c.l.company || (c.l.companyData || {}).name)) || PH('firma')],
  ['opiekun', 'Twoje imię i nazwisko', c => c.opiekun],
  ['opiekun_imie', 'Twoje imię', c => c.opiekunImie],
  ['opiekun_telefon', 'Twój telefon', c => c.opiekunTel],
  ['opiekun_email', 'Twój e-mail', c => c.opiekunEmail],
  ['spotkanie', 'termin spotkania', c => c.spotkanie],
  ['forma_spotkania', 'forma spotkania', c => c.formaSpotkania],
  ['miejsce_spotkania', 'link / miejsce spotkania', c => c.miejsce],
  ['licencja', 'cena pakietu SMART', c => fmtZl(c.o.licencja)],
  ['oplata_mies', 'opłata miesięczna', c => fmtZl(c.o.oplataMies)],
  ['prog_paczek', 'próg paczek (0 zł opłaty)', c => String(c.o.progRabatu)],
  ['szkolenie', 'szkolenie', c => c.o.szkolenie],
  ['link_kalkulator', 'link do kalkulatora', c => c.o.linkKalkulator || PH('link do kalkulatora')],
  ['link_prezentacja', 'link do prezentacji', c => (c.model === 'shippoint' ? c.o.linkPrezentacjaShipPoint : c.o.linkPrezentacja) || PH('link do prezentacji')],
  ['link_kalendarz', 'link do kalendarza', c => c.linkKalendarz],
  ['telefon_firmy', 'telefon ShipCenter', c => c.o.telefon],
  ['www', 'strona www', c => c.o.www],
  ['podpis', 'podpis (Pozdrawiam + dane)', c => podpis(c).replace(/^\n+/, '')]
];
const TPL_VAR_MAP = Object.fromEntries(TPL_VARS.map(v => [v[0], v[2]]));

function tplRender(ov, c) {
  const fill = s => String(s || '')
    .replace(/\{forma:\s*([^|}]*)\|([^|}]*)\|([^|}]*)\|([^}]*)\}/g, (m, a, b, cc, d) => c.g(a.trim(), b.trim(), cc.trim(), d.trim()))
    .replace(/\{([a-z_]+)\}/g, (m, k) => TPL_VAR_MAP[k] ? TPL_VAR_MAP[k](c) : m);
  return { subject: ov.subject ? fill(ov.subject) : undefined, body: fill(ov.body) };
}
/* tekst domyślny z wstawkami zamiast danych konkretnego leada */
function tplDefaultText(key) {
  const t = TEMPLATES[key]; if (!t || !t.orig) return { subject: '', body: '' };
  const c = msgContext(null, 'panstwo');
  Object.assign(c, { imie: '{imie}', pelne: '{imie_nazwisko}', miasto: '{miasto}', maMiasto: true, opiekun: '{opiekun}', opiekunImie: '{opiekun_imie}', opiekunTel: '{opiekun_telefon}', opiekunEmail: '{opiekun_email}', spotkanie: '{spotkanie}', formaSpotkania: '{forma_spotkania}', miejsce: '{miejsce_spotkania}', linkKalendarz: '{link_kalendarz}' });
  c.g = (a, b, cc, d) => (a === b && b === cc && cc === d) ? a : `{forma: ${a} | ${b} | ${cc} | ${d}}`;
  const out = t.orig(c);
  const pw = powitanie(c), pd = podpis(c);
  const o = c.o;
  const swaps = [[o.linkKalkulator, '{link_kalkulator}'], [o.linkPrezentacja, '{link_prezentacja}'], [fmtZl(o.licencja), '{licencja}'], [fmtZl(o.oplataMies), '{oplata_mies}'], [o.szkolenie, '{szkolenie}']].filter(([v]) => v && String(v).length > 3);
  const clean = x => swaps.reduce((acc, [v, tok]) => acc.split(String(v)).join(tok), String(x || '').split(pd).join('\n\n{podpis}').split(pw).join('{powitanie}'));
  return { subject: clean(out.subject), body: clean(out.body) };
}

/* nadpisania i własne szablony – podpinane przy starcie i przy każdej zmianie ustawień */
function tplInstall() {
  Object.entries(TEMPLATES).forEach(([k, t]) => {
    if (t.custom || t.orig) return;
    t.orig = t.f;
    t.f = c => { const ov = (settings().tplOverrides || {})[k]; return ov && ov.body ? tplRender(ov, c) : t.orig(c); };
  });
}
function tplSyncCustom() {
  const cus = settings().tplCustom || {};
  Object.keys(TEMPLATES).forEach(k => { if (TEMPLATES[k].custom && !cus[k]) delete TEMPLATES[k]; });
  Object.entries(cus).forEach(([k, v]) => { TEMPLATES[k] = { grp: v.grp || 'Moje szablony', n: v.n || 'Nowy szablon', kind: v.kind || 'E-mail', custom: true, f: c => tplRender(v, c) }; });
}

function tplEditorHtml(key) {
  const t = TEMPLATES[key]; const isNew = key === '__new';
  const ov = isNew ? null : (t.custom ? (settings().tplCustom || {})[key] : (settings().tplOverrides || {})[key]);
  const def = isNew ? { subject: '', body: '{powitanie}\n\n\n\n{podpis}' } : t.custom ? ov : tplDefaultText(key);
  const cur = ov && ov.body ? ov : def;
  const kind = isNew ? 'E-mail' : t.kind;
  return `<div class="card"><div class="cardhead"><h2>${isNew ? 'Nowy szablon' : 'Edycja: ' + esc(t.n)}</h2><span class="pill">${esc(kind)}</span></div>
    <div class="formgrid">
      ${isNew || t.custom ? `<label class="field span2"><span>Nazwa</span><input type="text" id="te-n" value="${esc(isNew ? '' : t.n)}" placeholder="np. Odpowiedź na pytanie o zarobki"></label>
        <label class="field"><span>Rodzaj</span><select id="te-kind">${['E-mail', 'SMS', 'Skrypt'].map(x => opt(x, x, kind)).join('')}</select></label>
        <label class="field span2"><span>Grupa</span><input type="text" id="te-grp" value="${esc(isNew ? 'Moje szablony' : t.grp)}"></label>` : ''}
      ${kind === 'E-mail' || isNew ? `<label class="field full" id="te-subj-wrap"><span>Temat</span><input type="text" id="te-subj" value="${esc(cur.subject || '')}"></label>` : ''}
      <label class="field full"><span>Treść</span><textarea id="te-body" rows="18" style="font-family:inherit">${esc(cur.body || '')}</textarea></label>
    </div>
    <div class="stack" style="gap:6px;margin-top:8px"><span class="small muted">Wstaw dane kandydata (kliknij, wstawi się w miejscu kursora):</span>
      <div class="row" style="gap:6px">${TPL_VARS.map(([k, n]) => `<button class="btn sm ghost" data-act="te-var" data-k="${k}" title="${esc(n)}">{${k}}</button>`).join('')}<button class="btn sm ghost" data-act="te-var" data-k="forma" title="różny tekst zależnie od formy zwrotu">{forma: Pan | Pani | Państwo | Ty}</button></div>
      <span class="tiny muted">Kwoty i linki wpisane zwykłym tekstem nie zmienią się same po zmianie ustawień oferty – wtedy użyj wstawek {licencja}, {link_kalkulator} itd.</span></div>
    <div class="row" style="margin-top:12px"><button class="btn primary" data-act="te-save" data-k="${key}">${ICONS.check}Zapisz szablon</button><button class="btn" data-act="te-cancel">Anuluj</button>
      ${!isNew && !t.custom && ov ? `<button class="btn ghost" data-act="te-reset" data-k="${key}">${ICONS.back}Przywróć wersję domyślną</button>` : ''}
      ${!isNew && t.custom ? `<button class="btn danger" data-act="te-del" data-k="${key}">${ICONS.trash}Usuń szablon</button>` : ''}</div>
  </div>`;
}
function tplSave(key) {
  const body = ($('#te-body') || {}).value || '';
  if (!body.trim()) { toast('Treść nie może być pusta.', 'bad'); return; }
  const subject = ($('#te-subj') || {}).value || '';
  const stamp = { updatedAt: new Date().toISOString(), by: myMemberId() || '' };
  if (key === '__new' || (TEMPLATES[key] && TEMPLATES[key].custom)) {
    const n = ($('#te-n') || {}).value.trim(); if (!n) { toast('Wpisz nazwę szablonu.', 'bad'); return; }
    const id = key === '__new' ? 'own_' + uid('t') : key;
    const kind = $('#te-kind').value;
    const cus = { ...(settings().tplCustom || {}), [id]: { n, kind, grp: ($('#te-grp') || {}).value.trim() || 'Moje szablony', subject: kind === 'E-mail' ? subject : '', body, ...stamp } };
    saveSettings({ tplCustom: cus });
    S.ui.tplEdit = null; S.msg.tpl = id; tplSyncCustom(); toast('Zapisano szablon');
  } else {
    saveSettings({ tplOverrides: { ...(settings().tplOverrides || {}), [key]: { subject, body, ...stamp } } });
    S.ui.tplEdit = null; toast('Zapisano zmiany szablonu');
  }
  scheduleRender();
}
function tplReset(key) {
  const o = { ...(settings().tplOverrides || {}) }; delete o[key];
  saveSettings({ tplOverrides: o }); S.ui.tplEdit = null; toast('Przywrócono wersję domyślną'); scheduleRender();
}
function tplDelete(key) {
  const o = { ...(settings().tplCustom || {}) }; delete o[key];
  saveSettings({ tplCustom: o }); S.ui.tplEdit = null; S.msg.tpl = 'email_pierwszy'; tplSyncCustom(); toast('Usunięto szablon'); scheduleRender();
}
function tplInsertVar(k) {
  const ta = $('#te-body'); if (!ta) return;
  const txt = k === 'forma' ? '{forma: Pan | Pani | Państwo | Ty}' : `{${k}}`;
  const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? s;
  ta.value = ta.value.slice(0, s) + txt + ta.value.slice(e);
  ta.focus(); ta.setSelectionRange(s + txt.length, s + txt.length);
}

tplInstall();
