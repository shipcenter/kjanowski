/* ===== Poczta: korespondencja z kandydatami, wysyłka ze stopką HTML, import zgłoszeń =====
   Wszystko idzie przez konektor „ShipCenter Poczta” (mostek pocztowy na serwerze ShipCenter,
   panel/mail-bridge). Bez konektora panel działa jak dotąd: e-mail można skopiować z formatowaniem. */

const MAIL_SERVER = 'ShipCenter Poczta';
const MAIL = { avail: null, checking: false, err: '', cache: {}, loading: {}, syncing: false, syncMsg: '', timer: null, filter: 'all' };

async function mailInit() {
  if (!S.mcp || MAIL.checking || MAIL.avail !== null) return;
  MAIL.checking = true;
  try {
    const r = await S.mcp.listTools(MAIL_SERVER);
    const sv = (r.servers || []).find(s => s.server === MAIL_SERVER);
    MAIL.avail = !!(sv && (sv.tools || []).length);
  } catch (e) { MAIL.avail = false; MAIL.err = (e && e.code) || ''; }
  MAIL.checking = false; scheduleRender();
  if (MAIL.avail) {
    mailCall('mail_status', {}).then(st => { MAIL.status = st; MAIL.sms = !!(st && st.sms && st.sms.configured); scheduleRender(); }).catch(() => { });
    setTimeout(() => syncInquiries(false), 1500);
    MAIL.timer = setInterval(() => { if (!document.hidden) syncInquiries(false); }, 5 * 60000);
  }
}
const mailOn = () => MAIL.avail === true;

async function mailCall(tool, input) {
  const r = await S.mcp.callTool(MAIL_SERVER, tool, input || {}, { cache: false });
  let p = r && r.payload;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { } }
  return p;
}
function mailErr(e) {
  const c = e && e.code;
  if (c === 'server_not_connected' || c === 'not_granted' || c === 'capability_disabled' || c === 'capability_removed') return 'Poczta nie jest podłączona – brak konektora „ShipCenter Poczta” w claude.ai.';
  if (c === 'not_in_manifest' || c === 'approval_required') return 'Brak zgody na użycie poczty przez panel – zezwól w okienku claude.ai i spróbuj ponownie.';
  if (c === 'needs_reauth') return 'Połącz ponownie konektor „ShipCenter Poczta” w ustawieniach claude.ai.';
  if (c === 'tool_error') return 'Serwer poczty: ' + String((e && e.message) || '').slice(0, 220);
  if (c === 'server_unavailable') return 'Serwer poczty chwilowo nie odpowiada – spróbuj za chwilę.';
  return 'Błąd poczty' + (c ? ' (' + c + ')' : '') + (e && e.message ? ': ' + String(e.message).slice(0, 160) : '');
}

const leadByEmail = email => { const e = String(email || '').toLowerCase().trim(); return e ? leadsArr().find(l => (l.email || '').toLowerCase().trim() === e) : null; };
const mailPeer = m => (m.folder === 'Sent' ? (m.to || [])[0] : (m.from || [])[0]) || { name: '', address: '' };
function hashStr(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

/* ---------- lista wiadomości (cache per adres) ---------- */
function mailListFor(key) {
  const c = MAIL.cache[key];
  if (!mailOn()) return null;
  if (!c && !MAIL.loading[key]) loadMailList(key);
  return c || null;
}
async function loadMailList(key) {
  MAIL.loading[key] = true; scheduleRender();
  try {
    const address = key.startsWith('addr:') ? key.slice(5) : '';
    const r = await mailCall('mail_list', { address, folder: 'all', limit: address ? 50 : 60 });
    MAIL.cache[key] = { items: (r && r.items) || [], at: new Date().toISOString() };
  } catch (e) { MAIL.cache[key] = { items: [], err: mailErr(e), at: new Date().toISOString() }; }
  MAIL.loading[key] = false; scheduleRender();
}
function mailRefresh(key) { if (key) delete MAIL.cache[key]; else MAIL.cache = {}; scheduleRender(); }

function mailRows(items, { showLead = true } = {}) {
  if (!items.length) return '<p class="muted small">Brak wiadomości.</p>';
  return items.map(m => {
    const peer = mailPeer(m); const l = leadByEmail(peer.address);
    const out = m.folder === 'Sent';
    return `<div class="contact-row mailrow ${!out && !m.seen ? 'unread' : ''}" data-act="mail-open" data-folder="${m.folder}" data-uid="${m.uid}" data-lead="${l ? l.id : ''}" style="cursor:pointer">
      <span class="when">${fdateShort(m.date)}</span>
      <div style="min-width:0"><span class="pill ${out ? '' : 'good'}">${out ? '→ wysłana' : '← odebrana'}</span> <b>${esc(peer.name || peer.address || '—')}</b>${showLead && l ? ` <a href="#lead-${l.id}" class="tiny">${esc(l.name)}</a>` : ''}
        <div class="small ink2" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.hasAttachments ? '📎 ' : ''}${esc(m.subject || '(bez tematu)')}</div></div>
      <div class="tiny muted">${new Date(m.date).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</div></div>`;
  }).join('');
}

/* ---------- widok „Poczta” (#poczta, #poczta-<idLeada>) ---------- */
function viewMail(leadId) {
  const l = leadId ? D().leads[leadId] : null;
  const key = l && l.email ? 'addr:' + l.email.toLowerCase().trim() : 'all';
  const st = settings().mailSync || {};
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Skrzynka franczyza@shipcenter.pl</span><h1>${l ? 'Korespondencja: ' + esc(l.name) : 'Poczta'}</h1>
    <p>${l ? (l.email ? esc(l.email) + ' · <a href="#lead-' + l.id + '">karta leada</a> · <a href="#poczta">cała skrzynka</a>' : 'Kandydat nie ma adresu e-mail – uzupełnij go w karcie leada.') : `Wysyłka ze stopką firmową, kopie w „Wysłanych”. ${st.at ? 'Zgłoszenia z formularzy sprawdzone ' + fdt(st.at.slice(0, 16)) + '.' : ''}`}</p></div>
    <div class="actions">${mailOn() ? `<button class="btn" data-act="mail-refresh" data-key="${esc(key)}">Odśwież</button>${l ? '' : `<button class="btn" data-act="mail-sync" ${MAIL.syncing ? 'disabled' : ''}>${MAIL.syncing ? 'Sprawdzam…' : 'Pobierz zgłoszenia'}</button>`}` : ''}
    <button class="btn primary" data-act="mail-compose" data-id="${l ? l.id : ''}">${ICONS.email}${l ? 'Napisz do klienta' : 'Nowa wiadomość'}</button></div></div>`;
  if (!mailOn()) {
    return head + `<div class="card"><div class="cardhead"><h2>Poczta nie jest jeszcze podłączona</h2><p>${MAIL.checking ? 'sprawdzam…' : ''}</p></div>
      <div class="stack" style="gap:8px">
      <p class="small">Żeby czytać i wysyłać maile z franczyza@shipcenter.pl bezpośrednio w panelu, na serwerze ShipCenter musi działać mostek pocztowy (instrukcja dla programisty: <span class="mono">panel/mail-bridge/README.md</span> w repozytorium), a w claude.ai trzeba dodać konektor o nazwie <b>„${MAIL_SERVER}”</b>.</p>
      <p class="small">Do tego czasu „Nowa wiadomość” i „Napisz do klienta” przygotują e-mail ze stopką – skopiujesz go z formatowaniem do Thunderbirda.</p>
      <p class="tiny muted">Działa tylko w aplikacji / stronie claude.ai, w której konektor jest podłączony.</p></div></div>`;
  }
  const c = mailListFor(key);
  let items = c ? c.items : [];
  if (!l && MAIL.filter === 'leads') items = items.filter(m => leadByEmail(mailPeer(m).address));
  if (!l && MAIL.filter === 'in') items = items.filter(m => m.folder === 'INBOX');
  if (!l && MAIL.filter === 'out') items = items.filter(m => m.folder === 'Sent');
  const filters = l ? '' : `<div class="row" style="margin-bottom:10px">${[['all', 'Wszystkie'], ['in', 'Odebrane'], ['out', 'Wysłane'], ['leads', 'Tylko kandydaci']].map(([k, n]) => `<button class="btn sm ${MAIL.filter === k ? 'primary' : 'ghost'}" data-act="mail-filter" data-k="${k}">${n}</button>`).join('')}</div>`;
  return head + `${MAIL.syncMsg ? `<p class="note" style="margin-bottom:10px">${esc(MAIL.syncMsg)}</p>` : ''}<div class="card">${filters}
    ${!c ? '<p class="muted small">Wczytuję wiadomości…</p>' : c.err ? `<p class="note overdue">${esc(c.err)}</p>` : mailRows(items, { showLead: !l })}</div>`;
}

/* karta „Korespondencja e-mail” w widoku leada */
function leadMailCard(l) {
  const btns = `<button class="btn sm primary" data-act="mail-compose" data-id="${l.id}">${ICONS.email}Napisz e-mail</button><a class="btn sm" href="#poczta-${l.id}">Koresponduj z klientem</a>`;
  if (!mailOn()) return `<div class="card"><div class="cardhead"><h2>Korespondencja e-mail</h2><p>${l.email ? esc(l.email) : 'brak e-maila'}</p></div><div class="row">${btns}</div><p class="tiny muted" style="margin-top:8px">Po podłączeniu poczty zobaczysz tu maile od kandydata i odpowiesz prosto z panelu.</p></div>`;
  if (!l.email) return `<div class="card"><div class="cardhead"><h2>Korespondencja e-mail</h2></div><p class="note">Uzupełnij adres e-mail kandydata, żeby zobaczyć korespondencję.</p></div>`;
  const c = mailListFor('addr:' + l.email.toLowerCase().trim());
  return `<div class="card"><div class="cardhead"><h2>Korespondencja e-mail</h2><p>${c && !c.err ? c.items.length + ' wiadomości' : ''}</p></div>
    ${!c ? '<p class="muted small">Wczytuję…</p>' : c.err ? `<p class="note overdue">${esc(c.err)}</p>` : mailRows(c.items.slice(0, 5), { showLead: false })}
    <div class="row" style="margin-top:10px">${btns}</div></div>`;
}

/* ---------- czytanie wiadomości ---------- */
async function openMailReader(folder, uid) {
  openModal(`<div class="mh"><h2>Wiadomość</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div><div class="mb"><p class="muted">Wczytuję…</p></div>`, { wide: true });
  let m;
  try { m = await mailCall('mail_get', { folder, uid: +uid }); } catch (e) { $('#modal .mb').innerHTML = `<p class="note overdue">${esc(mailErr(e))}</p>`; return; }
  const peer = folder === 'Sent' ? (m.to || [])[0] : ((m.replyTo || [])[0] || (m.from || [])[0]);
  const l = leadByEmail(peer && peer.address);
  const who = a => (a || []).map(x => x.name ? `${esc(x.name)} &lt;${esc(x.address)}&gt;` : esc(x.address)).join(', ');
  openModal(`<div class="mh"><h2>${esc(m.subject || '(bez tematu)')}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <div class="mb">
      <dl class="kv"><dt>Od</dt><dd>${who(m.from)}</dd><dt>Do</dt><dd>${who(m.to)}</dd>${(m.cc || []).length ? `<dt>DW</dt><dd>${who(m.cc)}</dd>` : ''}<dt>Data</dt><dd>${fdt(m.date.slice(0, 16))}</dd>${l ? `<dt>Kandydat</dt><dd><a href="#lead-${l.id}" data-act="modal-close">${esc(l.name)}</a></dd>` : ''}</dl>
      ${(m.attachments || []).length ? `<div class="row" style="margin:10px 0">${m.attachments.map(a => `<button class="btn sm" data-act="mail-att" data-folder="${folder}" data-uid="${m.uid}" data-i="${a.index}">📎 ${esc(a.filename)} <span class="tiny muted">${Math.max(1, Math.round(a.size / 1024))} kB</span></button>`).join('')}</div>` : ''}
      <div id="mr-text" style="white-space:pre-wrap;font-size:.92rem;line-height:1.55;border-top:1px solid var(--line);padding-top:12px;margin-top:10px;max-height:52vh;overflow:auto">${linkifyText(m.text || '')}</div>
      ${m.html ? `<details class="adv" style="margin-top:10px"><summary>Pokaż oryginalny wygląd (HTML)</summary><iframe sandbox="" referrerpolicy="no-referrer" style="width:100%;height:60vh;border:1px solid var(--line);border-radius:8px;background:#fff" srcdoc="${esc(m.html)}"></iframe></details>` : ''}
    </div>
    <div class="mf">${!l && peer && peer.address && folder === 'INBOX' ? `<button class="btn" id="mr-newlead">Utwórz leada z nadawcy</button>` : ''}<button class="btn" data-act="modal-close">Zamknij</button><button class="btn primary" id="mr-reply">Odpowiedz</button></div>`, { wide: true });
  $('#mr-reply').onclick = () => {
    const q = String(m.text || '').split('\n').slice(0, 60).map(x => '> ' + x).join('\n');
    const refs = [...(m.references || []), m.messageId].filter(Boolean);
    openCompose({ leadId: l ? l.id : '', to: peer ? peer.address : '', subject: /^re:/i.test(m.subject || '') ? m.subject : 'Re: ' + (m.subject || ''), body: `\n\nPozdrawiam\n\n\nW dniu ${fdt(m.date.slice(0, 16))} ${peer && peer.name ? peer.name : (peer && peer.address) || ''} napisał(a):\n${q}`, replyTo: { messageId: m.messageId, references: refs } });
  };
  const nl = $('#mr-newlead');
  if (nl) nl.onclick = () => {
    const lead = newLead({ name: peer.name || peer.address, email: peer.address, source: 'www', ownerId: myMemberId() || '', nextTask: 'Pierwsza rozmowa telefoniczna', nextTaskDate: todayISO(), notes: 'Z maila: ' + (m.subject || '') });
    lead.history = [histEntry('system', 'Lead utworzony z wiadomości e-mail: „' + (m.subject || '') + '”')];
    put('leads', lead.id, lead); closeModal(); go('lead-' + lead.id); toast('Utworzono leada');
  };
  if (folder === 'INBOX') Object.keys(MAIL.cache).forEach(k => { const it = (MAIL.cache[k].items || []).find(x => x.folder === folder && x.uid === +uid); if (it) it.seen = true; });
}
const linkifyText = t => esc(t).replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

async function downloadMailAttachment(folder, uid, index) {
  try {
    const a = await mailCall('mail_attachment', { folder, uid: +uid, index: +index });
    const bin = Uint8Array.from(atob(a.base64), ch => ch.charCodeAt(0));
    await offerDownload(a.filename, bin);
  } catch (e) { toast(mailErr(e), 'bad'); }
}

/* ---------- pisanie / wysyłka ---------- */
const toB64 = buf => { let s = ''; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
async function contractAttachment(id) {
  const f = Object.values(CONTRACT_FILES).flat().find(x => x.id === id); if (!f) return null;
  const r = await fetch('/_blob/' + f.id); if (!r.ok) throw new Error('Nie udało się wczytać ' + f.file);
  return { filename: f.file, content_base64: toB64(await r.arrayBuffer()), content_type: 'application/pdf' };
}
const MAX_ATT_B64 = 900000; // limit wejścia narzędzia (~1 MB)

function openCompose(o = {}) {
  const fixedLead = o.leadId ? D().leads[o.leadId] : null;
  const curLead = () => fixedLead || leadByEmail(($('#cm-to') || {}).value);
  const files = fixedLead ? contractFilesFor(fixedLead) : Object.values(CONTRACT_FILES).flat();
  const preset = new Set(o.files || []);
  const uploads = [];
  const tpls = Object.entries(TEMPLATES).filter(([k, t]) => t.kind === 'E-mail');
  openModal(`<div class="mh"><h2>${o.replyTo ? 'Odpowiedź' : 'Nowa wiadomość'}${fixedLead ? ' – ' + esc(fixedLead.name) : ''}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <div class="mb"><div class="formgrid">
      <label class="field span2"><span>Do</span><input type="email" id="cm-to" list="cm-leads" value="${esc(o.to || (fixedLead && fixedLead.email) || '')}" placeholder="adres kandydata"></label>
      <label class="field"><span>Szablon</span><select id="cm-tpl"><option value="">— bez szablonu —</option>${tpls.map(([k, t]) => `<option value="${k}" ${o.tplKey === k ? 'selected' : ''}>${esc(t.grp + ': ' + t.n)}</option>`).join('')}</select></label>
      <label class="field full"><span>Temat</span><input type="text" id="cm-subj" value="${esc(o.subject || '')}"></label>
      <label class="field full"><span>Treść</span><textarea id="cm-body" rows="13">${esc(o.body || '')}</textarea><span class="hint">Stopka firmowa (imię, telefon, logo, dane spółki) dodaje się sama przy wysyłce.</span></label>
    </div>
    <div class="row" style="margin-top:6px"><span class="small muted">Załączniki:</span>${files.map(f => `<label class="chk small"><input type="checkbox" data-cm-file="${f.id}" ${preset.has(f.id) ? 'checked' : ''}>${esc(f.n)}</label>`).join('')}
      <label class="btn sm ghost" style="cursor:pointer">+ plik z komputera<input type="file" id="cm-file" multiple hidden></label></div>
    <div class="row" id="cm-ups" style="margin-top:4px"></div>
    ${emailPreviewBlock('cm-prev')}
    ${mailOn() ? '' : '<p class="callout" style="margin-top:10px">Poczta nie jest jeszcze podłączona – skopiuj e-mail z formatowaniem i wyślij go z Thunderbirda (załączniki dołącz ręcznie).</p>'}
    <datalist id="cm-leads">${leadsArr().filter(x => x.email).map(x => `<option value="${esc(x.email)}">${esc(x.name)}</option>`).join('')}</datalist></div>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn" id="cm-copy">${ICONS.copy}Kopiuj z formatowaniem</button><button class="btn primary" id="cm-send" ${mailOn() ? '' : 'disabled title="Poczta niepodłączona"'}>Wyślij</button></div>`, { wide: true });
  const refresh = () => { const pv = $('#cm-prev'); if (pv) pv.innerHTML = emailHtml($('#cm-body').value, curLead(), true); };
  const applyTpl = () => {
    const k = $('#cm-tpl').value; const l = curLead(); if (!k) return;
    if (!l) { toast('Szablony wypełniają się danymi leada – wpisz adres kandydata z bazy.', 'bad'); return; }
    const out = TEMPLATES[k].f(msgContext(l, l.form));
    if (out.subject) $('#cm-subj').value = out.subject;
    $('#cm-body').value = out.body; refresh();
  };
  $('#cm-tpl').onchange = applyTpl;
  if (o.tplKey && !o.body) applyTpl();
  $('#cm-body').oninput = refresh; $('#cm-to').oninput = refresh; refresh();
  const showUps = () => { $('#cm-ups').innerHTML = uploads.map((u, i) => `<span class="pill">📎 ${esc(u.filename)} <button class="iconbtn" data-cm-rm="${i}" aria-label="Usuń">${ICONS.x}</button></span>`).join(''); $$('#cm-ups [data-cm-rm]').forEach(b => b.onclick = () => { uploads.splice(+b.dataset.cmRm, 1); showUps(); }); };
  $('#cm-file').onchange = e => {
    [...e.target.files].forEach(f => {
      const rd = new FileReader();
      rd.onload = () => { uploads.push({ filename: f.name, content_base64: String(rd.result).split(',')[1] || '', content_type: f.type || 'application/octet-stream' }); showUps(); };
      rd.readAsDataURL(f);
    });
    e.target.value = '';
  };
  $('#cm-copy').onclick = () => copyEmailHtml(emailHtml($('#cm-body').value, curLead(), false), $('#cm-body').value);
  $('#cm-send').onclick = async () => {
    const btn = $('#cm-send');
    const to = $('#cm-to').value.trim(), subject = $('#cm-subj').value.trim(), body = $('#cm-body').value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) { toast('Wpisz poprawny adres odbiorcy.', 'bad'); return; }
    if (!subject) { toast('Wpisz temat.', 'bad'); return; }
    if (!body.trim()) { toast('Wiadomość jest pusta.', 'bad'); return; }
    btn.disabled = true; btn.textContent = 'Wysyłam…';
    try {
      const atts = [];
      for (const cb of $$('[data-cm-file]:checked')) { const a = await contractAttachment(cb.dataset.cmFile); if (a) atts.push(a); }
      atts.push(...uploads);
      const size = atts.reduce((s, a) => s + a.content_base64.length, 0);
      if (size > MAX_ATT_B64) throw { code: 'local', message: `Załączniki są za duże (${Math.round(size * 0.75 / 1024)} kB, limit ok. 650 kB). Wyślij większe pliki linkiem.` };
      const l = curLead();
      const r = await mailCall('mail_send', { to, subject, html: emailHtml(body, l, false), text: body, attachments: atts, ...(o.replyTo && o.replyTo.messageId ? { in_reply_to: o.replyTo.messageId, references: o.replyTo.references || [] } : {}) });
      if (r && r.rejected && r.rejected.length) throw { code: 'local', message: 'Serwer odrzucił adres: ' + r.rejected.join(', ') };
      if (l) logMailSent(l, subject, atts.map(a => a.filename));
      if (o.onSent) o.onSent(r);
      mailRefresh(l && l.email ? 'addr:' + l.email.toLowerCase().trim() : null); mailRefresh('all');
      closeModal();
      toast('Wysłano e-mail do ' + to + (r && r.appended === false ? ' (uwaga: bez kopii w „Wysłanych”)' : ''));
    } catch (e) {
      toast(e && e.code === 'local' ? e.message : mailErr(e), 'bad');
      btn.disabled = false; btn.textContent = 'Wyślij';
    }
  };
}
function logMailSent(l, subject, files = []) {
  const cur = D().leads[l.id]; if (!cur) return;
  const hist = (cur.history || []).slice();
  hist.push(histEntry('email', `Wysłano e-mail: „${subject}”${files.length ? ' · załączniki: ' + files.join(', ') : ''}`, { by: myMemberId() || cur.ownerId || '', result: 'Wysłano materiały' }));
  const p = { history: hist, lastEmailAt: new Date().toISOString(), updatedTs: new Date().toISOString() };
  if (cur.status === 'do_kontaktu') p.status = 'w_kontakcie';
  patch('leads', l.id, p);
}

/* ---------- import zgłoszeń z formularzy ---------- */
async function syncInquiries(manual) {
  if (!mailOn() || MAIL.syncing || S.demo) return;
  if (isLoading() || S.mode !== 'live') { setTimeout(() => syncInquiries(manual), 4000); return; }
  MAIL.syncing = true; scheduleRender();
  try {
    const st = settings().mailSync || {};
    let r = await mailCall('inquiries_fetch', { since_uid: st.lastUid || 0, days: st.lastUid ? 60 : 7 });
    if (st.uidValidity && r.uidValidity && r.uidValidity !== st.uidValidity) r = await mailCall('inquiries_fetch', { since_uid: 0, days: 14 });
    const now = new Date().toISOString();
    let created = 0, merged = 0;
    for (const it of (r.items || [])) {
      const id = 'm' + hashStr(it.messageId || ('uid' + it.uid + it.date));
      if (D().leads[id]) continue;
      const dup = findDuplicate({ email: it.email, phone: it.phone });
      if (dup) {
        if (!(dup.inquiryIds || []).includes(id)) {
          const hist = (dup.history || []).slice();
          hist.push(histEntry('system', `Ponowne zgłoszenie z formularza (${modelName(it.kind)}) – ${fdate((it.date || now).slice(0, 10))}`));
          patch('leads', dup.id, { history: hist, inquiryIds: [...(dup.inquiryIds || []), id], updatedTs: now });
          merged++;
        }
        continue;
      }
      const day = (it.date || now).slice(0, 10);
      const lead = newLead({ name: it.name || it.email || 'Zgłoszenie z formularza', phone: fmtPhone(it.phone || ''), email: it.email || '', city: it.city || '', model: it.kind, source: 'www', notes: it.note || '', nextTask: 'Pierwsza rozmowa telefoniczna', nextTaskDate: todayISO() });
      Object.assign(lead, { id, createdAt: day, createdTs: it.date || now, sourceMsgId: it.messageId || '', inquiryIds: [id], autoPresentationAt: it.autoPresentation ? day : '' });
      lead.history = [histEntry('system', `Zgłoszenie z formularza shipcenter.pl (${modelName(it.kind)}) – pobrane automatycznie z poczty${it.autoPresentation ? '; formularz wysłał kandydatowi prezentację' : ''}`)];
      put('leads', id, lead);
      created++;
    }
    saveSettings({ mailSync: { lastUid: r.lastUid || st.lastUid || 0, uidValidity: r.uidValidity || '', at: now } });
    MAIL.syncMsg = '';
    if (created || merged) toast(`Poczta: ${created ? 'nowe zgłoszenia ' + created : ''}${created && merged ? ', ' : ''}${merged ? 'ponowne ' + merged : ''}`);
    else if (manual) toast('Brak nowych zgłoszeń');
  } catch (e) {
    MAIL.syncMsg = 'Import zgłoszeń: ' + mailErr(e);
    if (manual) toast(MAIL.syncMsg, 'bad');
  }
  MAIL.syncing = false; scheduleRender();
}
