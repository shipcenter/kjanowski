/* ===== Cennik franczyzowy dla kandydatów =====
   Dane (ceny zakupu dla punktu) są wyłącznie w bazie panelu – kolekcja „pricelist”:
   dokument „krajowy” i opcjonalnie „miedzynarodowy”, wgrywane z XLSX w ustawieniach.
   Kandydat dostaje PDF ze znakiem wodnym: poglądowy (wybrane usługi) albo pełny (po NDA). */

const PL_DOCS = { krajowy: 'Przesyłki krajowe', miedzynarodowy: 'Przesyłki międzynarodowe' };
const PL_DEFAULT_PREVIEW = [
  'Paczkomaty|InPost Paczkomaty (Gabaryt A)|Paczka', 'Paczkomaty|InPost Paczkomaty (Gabaryt B)|Paczka', 'Paczkomaty|InPost Paczkomaty (Gabaryt C)|Paczka',
  'Orlen Paczka|Orlen Paczka (Small)|Paczka', 'Orlen Paczka|Orlen Paczka (Medium)|Paczka', 'Orlen Paczka|Orlen Paczka (Large)|Paczka',
  'DPD Pickup|DPD Pickup|Paczka', 'InPost|Kurier Standard|Paczka', 'DPD|DPD Krajowe|Paczka', 'DHL Parcel|DHL Parcel|Paczka',
  'Pocztex Punkt|Pocztex Punkt (Gabaryt S)|Paczka', 'Pocztex Punkt|Pocztex Punkt (Gabaryt M)|Paczka', 'Pocztex Punkt|Pocztex Punkt (Gabaryt L)|Paczka',
  'Pocztex|Pocztex 120x80|Paleta'
];
const PL_DEFAULT_COUNTRIES = ['Niemcy', 'Wielka Brytania', 'Holandia', 'Czechy', 'Francja', 'Włochy', 'Hiszpania', 'Austria', 'Irlandia', 'Ukraina'];

const plDoc = k => (D().pricelist || {})[k] || null;
const plKey = r => `${r.c}|${r.s}|${r.t}`;
const plPreviewKeys = () => { const v = settings().pricePreview; return Array.isArray(v) ? v : PL_DEFAULT_PREVIEW; };
const plCountries = () => { const v = settings().priceCountries; return Array.isArray(v) && v.length ? v : PL_DEFAULT_COUNTRIES; };
const plMarkup = () => +settings().priceMarkup || 0;
const zl2 = v => Number(v).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }) + ' zł';
function plRange(r) {
  if (/Gabaryt|Small|Medium|Large|\d+x\d+/i.test(r.s) && (!r.from || r.from <= 0.01)) return `do ${fmt(r.to, r.to % 1 ? 1 : 0)} kg`;
  return `${fmt(r.from, r.from % 1 ? 2 : 0)}–${fmt(r.to, r.to % 1 ? 1 : 0)} kg`;
}

/* ---------- import XLSX ---------- */
function plParseSheet(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const head = (rows[0] || []).map(h => normKey(h));
  const idx = (...names) => head.findIndex(h => names.some(n => h.startsWith(n)));
  const ic = idx('przewoźnik', 'przewoznik', 'carrier'), is = idx('usługa', 'usluga', 'service'), it = idx('typ', 'type'),
    ifr = idx('waga od'), ito = idx('waga do'), ip = idx('cena'), ik = idx('kraj', 'country');
  if (ic < 0 || is < 0 || ip < 0) throw new Error('Nie rozpoznano kolumn – potrzebne: Przewoźnik, Usługa, Typ, Waga od, Waga do, Cena netto (opcjonalnie Kraj).');
  const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  return rows.slice(1).filter(r => r && r[ic] && r[ip] != null && r[ip] !== '').map(r => ({
    c: String(r[ic]).trim(), s: String(r[is] || '').trim(), t: it >= 0 ? String(r[it] || '').trim() : '',
    from: ifr >= 0 ? num(r[ifr]) : 0, to: ito >= 0 ? num(r[ito]) : 0, p: num(r[ip]), ...(ik >= 0 && r[ik] ? { k: String(r[ik]).trim() } : {})
  }));
}
async function plImport(kind, file) {
  if (!isAdmin()) { toast('Cennik może wgrać tylko administrator.', 'bad'); return; }
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const rows = plParseSheet(wb.Sheets[wb.SheetNames[0]]);
    if (!rows.length) throw new Error('Plik nie zawiera pozycji cennika.');
    put('pricelist', kind, { rows, file: file.name, uploadedAt: new Date().toISOString(), by: myMemberId() || '' });
    toast(`Wgrano cennik (${PL_DOCS[kind].toLowerCase()}): ${rows.length} pozycji`);
  } catch (e) { toast('Nie udało się wgrać cennika: ' + e.message, 'bad'); }
}

/* ---------- ustawienia ---------- */
function priceSettingsCard() {
  if (!isAdmin()) return '';
  const dk = plDoc('krajowy'), di = plDoc('miedzynarodowy');
  const groups = dk ? [...new Map(dk.rows.map(r => [plKey(r), r])).values()] : [];
  const sel = new Set(plPreviewKeys());
  const countries = di ? [...new Set(di.rows.map(r => r.k).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl')) : [];
  const csel = new Set(plCountries());
  const line = (k, d) => `<div class="row between" style="padding:6px 0;border-bottom:1px dashed var(--line)"><span><b>${esc(PL_DOCS[k])}</b> <span class="small muted">${d ? `${d.rows.length} pozycji · ${esc(d.file || '')} · ${fdate(String(d.uploadedAt).slice(0, 10))}` : 'nie wgrano'}</span></span>
    <label class="btn sm" style="cursor:pointer">${ICONS.up}${d ? 'Wgraj nowy' : 'Wgraj XLSX'}<input type="file" accept=".xlsx,.xls,.csv" hidden data-pl-import="${k}"></label></div>`;
  return `<div class="card"><div class="cardhead"><h2>Cennik franczyzowy</h2><p>ceny zakupu dla punktu – poufne</p></div>
    ${line('krajowy', dk)}${line('miedzynarodowy', di)}
    <p class="tiny muted" style="margin-top:6px">Format pliku: Przewoźnik, Usługa, Typ, Waga od [kg], Waga do [kg], Cena netto (dla międzynarodowego dodatkowo kolumna Kraj). Ceny są tylko w bazie panelu.</p>
    <div class="formgrid" style="margin-top:8px"><label class="field"><span>Przykładowa cena dla klienta: narzut %</span><input type="number" min="0" max="300" step="5" data-setting="priceMarkup" value="${esc(settings().priceMarkup || '')}" placeholder="0 = nie pokazuj"><span class="hint">Doda w PDF kolumny „przykładowa cena dla klienta” i „marża”.</span></label></div>
    ${groups.length ? `<details class="adv" style="margin-top:8px"><summary>Usługi w cenniku poglądowym (${groups.filter(g => sel.has(plKey(g))).length} z ${groups.length})</summary>
      <div class="row" style="gap:4px 14px;margin-top:8px">${groups.map(g => `<label class="chk small"><input type="checkbox" data-pl-prev="${esc(plKey(g))}" ${sel.has(plKey(g)) ? 'checked' : ''}> ${esc(g.s)}${g.t === 'Paleta' ? ' (paleta)' : g.t === 'Koperta/list' ? ' (koperta)' : ''}</label>`).join('')}</div></details>` : ''}
    ${countries.length ? `<details class="adv" style="margin-top:8px"><summary>Kraje w cenniku poglądowym (${countries.filter(c => csel.has(c)).length})</summary>
      <div class="row" style="gap:4px 14px;margin-top:8px">${countries.map(c => `<label class="chk small"><input type="checkbox" data-pl-country="${esc(c)}" ${csel.has(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}</div></details>` : ''}
  </div>`;
}
function plTogglePreview(key, on) {
  const s = new Set(plPreviewKeys()); if (on) s.add(key); else s.delete(key);
  saveSettings({ pricePreview: [...s] });
}
function plToggleCountry(c, on) {
  const s = new Set(plCountries()); if (on) s.add(c); else s.delete(c);
  saveSettings({ priceCountries: [...s] });
}

/* ---------- karta w leadzie ---------- */
function priceCard(l) {
  const dk = plDoc('krajowy');
  const nda = l.ndaAt;
  const sent = l.priceSent || {};
  return `<div class="card"><div class="cardhead"><h2>Cennik dla kandydata</h2><p>${dk ? 'ceny zakupu dla punktu' : 'cennik nie jest wgrany'}</p></div>
    ${!dk ? `<p class="note">Wgraj cennik franczyzowy (XLSX) w „Zespół i ustawienia” → „Cennik franczyzowy”.</p>` : `
    <div class="stack" style="gap:10px">
      <div class="pstep ${sent.preview ? 'done' : ''}"><span class="lbl">1 · Poglądowy – wybrane usługi</span>${sent.preview ? `<span class="small ink2">wysłany ${fdate(sent.preview)}</span>` : '<span class="small ink2">Najpopularniejsze usługi, bez całej tabeli. Można wysłać od razu po rozmowie.</span>'}
        <div class="row"><button class="btn sm" data-act="pl-mail" data-id="${l.id}" data-lvl="preview">${ICONS.send}Wyślij cennik poglądowy</button><button class="btn sm ghost" data-act="pl-pdf" data-id="${l.id}" data-lvl="preview">${ICONS.file}PDF</button></div></div>
      <div class="pstep ${nda ? 'done' : ''}"><span class="lbl">2 · Umowa o poufności (NDA)</span>${nda ? `<span class="small ink2">podpisana ${fdate(nda)}</span><button class="btn sm ghost" data-act="nda-clear" data-id="${l.id}">${ICONS.back}Cofnij</button>` : `<span class="small ink2">Pełny cennik udostępniamy po podpisaniu NDA (np. w Autenti).</span><button class="btn sm" data-act="nda-signed" data-id="${l.id}">${ICONS.check}NDA podpisana (dziś)</button>`}</div>
      <div class="pstep ${sent.full ? 'done' : ''}"><span class="lbl">3 · Pełny cennik</span>${sent.full ? `<span class="small ink2">wysłany ${fdate(sent.full)}</span>` : `<span class="small ink2">${nda ? 'Kandydat podpisał NDA – możesz wysłać pełny cennik.' : 'Dostępny po podpisaniu NDA.'}</span>`}
        <div class="row"><button class="btn sm" data-act="pl-mail" data-id="${l.id}" data-lvl="full" ${nda ? '' : 'disabled title="Najpierw NDA"'}>${ICONS.send}Wyślij pełny cennik</button><button class="btn sm ghost" data-act="pl-pdf" data-id="${l.id}" data-lvl="full" ${nda ? '' : 'disabled'}>${ICONS.file}PDF</button></div></div>
    </div>`}</div>`;
}

/* ---------- PDF ---------- */
function plSections(level) {
  const out = [];
  const dk = plDoc('krajowy');
  if (dk) {
    let rows = dk.rows.slice();
    if (level === 'preview') { const order = plPreviewKeys(); const sel = new Set(order); rows = rows.filter(r => sel.has(plKey(r)) && !(r.t === 'Paczka' && r.from > 30)); rows = rows.map((r, i) => [r, i]).sort((a, b) => (order.indexOf(plKey(a[0])) - order.indexOf(plKey(b[0]))) || (a[1] - b[1])).map(x => x[0]); }
    out.push({ title: 'Przesyłki krajowe', rows });
  }
  const di = plDoc('miedzynarodowy');
  if (di) {
    let rows = di.rows.slice();
    if (level === 'preview') { const cs = new Set(plCountries()); rows = rows.filter(r => !r.k || cs.has(r.k)); }
    if (rows.length) out.push({ title: 'Przesyłki międzynarodowe', rows, intl: true });
  }
  return out;
}
function plHtml(l, level) {
  const mk = plMarkup();
  const today = new Date().toLocaleDateString('pl-PL');
  const css = `.pl{font-family:Arial,Helvetica,sans-serif;color:#111827;width:760px;padding:26px 30px;background:#fff}
    .pl .top{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #E94E1A;padding-bottom:12px;margin-bottom:14px}
    .pl .top svg{width:170px;height:auto}.pl h1{font-size:20px;margin:0 0 4px}.pl .meta{font-size:11px;color:#4B5563;text-align:right;line-height:1.5}
    .pl .conf{background:#FFF7ED;border:1px solid #FED7AA;color:#9A3412;font-size:11px;padding:8px 10px;border-radius:6px;margin-bottom:14px}
    .pl h2{font-size:15px;margin:18px 0 6px;color:#E94E1A}.pl h3{font-size:12px;margin:12px 0 4px;color:#111827}
    .pl table{width:100%;border-collapse:collapse;font-size:11px;table-layout:fixed}.pl col.a{width:46%}.pl col.b{width:28%}.pl col.c{width:26%}.pl.mk col.a{width:34%}.pl.mk col.b{width:20%}.pl.mk col.c{width:16%}.pl th{text-align:left;background:#F3F4F6;padding:5px 6px;font-weight:bold}
    .pl td{padding:4px 6px;border-bottom:1px solid #E5E7EB}.pl td.n,.pl th.n{text-align:right;white-space:nowrap}
    .pl .foot{margin-top:16px;font-size:10px;color:#6B7280;line-height:1.5}`;
  const secs = plSections(level).map(sec => {
    const groups = new Map();
    sec.rows.forEach(r => { const g = (sec.intl ? (r.k || 'Inne') + ' · ' : '') + r.c; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); });
    const body = [...groups.entries()].map(([g, rows]) => `<h3>${esc(g)}</h3><table><colgroup><col class="a"><col class="b"><col class="c">${mk ? '<col><col>' : ''}</colgroup><tr><th>Usługa</th><th>Waga / gabaryt</th><th class="n">Cena netto dla punktu</th>${mk ? '<th class="n">Przykładowa cena dla klienta</th><th class="n">Marża punktu</th>' : ''}</tr>
      ${rows.map(r => { const sale = Math.round(r.p * (1 + mk / 100) * 100) / 100; return `<tr><td>${esc(r.s)}${r.t && r.t !== 'Paczka' ? ' <span style="color:#6B7280">(' + esc(r.t.toLowerCase()) + ')</span>' : ''}</td><td>${esc(plRange(r))}</td><td class="n"><b>${zl2(r.p)}</b></td>${mk ? `<td class="n">${zl2(sale)}</td><td class="n">${zl2(sale - r.p)}</td>` : ''}</tr>`; }).join('')}</table>`).join('');
    return `<h2>${esc(sec.title)}</h2>${body}`;
  }).join('');
  const dk = plDoc('krajowy');
  const body = `<div class="pl ${mk ? 'mk' : ''}"><div class="top"><div>${LOGO_SVG}<h1 style="margin-top:10px">${level === 'preview' ? 'Cennik poglądowy' : 'Cennik franczyzowy'}</h1><div style="font-size:12px;color:#4B5563">${level === 'preview' ? 'wybrane, najpopularniejsze usługi' : 'pełny cennik zakupu dla punktu ShipCenter'}</div></div>
      <div class="meta">Przygotowano dla:<br><b>${esc(l.name || '')}</b>${l.company ? '<br>' + esc(l.company) : ''}<br>${today}</div></div>
    <div class="conf"><b>Dokument poufny.</b> Ceny netto zakupu usług dla punktu ShipCenter – wyłącznie do wglądu ${esc(l.name || 'kandydata')}. Nie przekazuj dalej.${level === 'preview' ? ' Pełny cennik udostępniamy po podpisaniu umowy o zachowaniu poufności.' : ''}</div>
    ${secs}
    <div class="foot">Ceny netto (bez VAT) według cennika z ${dk ? fdate(String(dk.uploadedAt).slice(0, 10)) : today}. Ceny mogą się zmieniać zgodnie z umową i OWU.${mk ? ` Przykładowa cena dla klienta – narzut ${mk}% (cenę sprzedaży punkt ustala według wytycznych sieci).` : ''}<br>Ship Center Poland Sp. z o.o., ul. Gliwicka 51, 40-853 Katowice · franczyza@shipcenter.pl</div></div>`;
  return { css, body };
}
async function plPdfBytes(l, level) {
  await loadPdfLibs();
  const { css, body } = plHtml(l, level);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;background:#fff;z-index:-1';
  host.innerHTML = `<style>${css}</style>${body}`;
  document.body.appendChild(host);
  try {
    const root = host.querySelector('.pl'); const scale = 2;
    const canvas = await window.html2canvas(root, { scale, backgroundColor: '#ffffff', logging: false });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pageW = 210, pageH = 297, margin = 10;
    const pxPerMm = canvas.width / (pageW - 2 * margin);
    const pagePx = Math.floor((pageH - 2 * margin) * pxPerMm);
    const top0 = root.getBoundingClientRect().top;
    const breaks = [...root.querySelectorAll('h2, h3, tr, .foot')].map(el => Math.round((el.getBoundingClientRect().top - top0) * scale)).filter(v => v > 0).sort((a, b) => a - b);
    let y = 0, first = true;
    while (y < canvas.height - 4) {
      let end = Math.min(y + pagePx, canvas.height);
      if (end < canvas.height) { const cand = breaks.filter(b => b > y + pagePx * 0.5 && b <= end); if (cand.length) end = cand[cand.length - 1]; }
      const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = end - y;
      const ctx = slice.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, pageW - 2 * margin, (end - y) / pxPerMm);
      first = false; y = end;
    }
    const n = pdf.getNumberOfPages();
    const wm = stripPL(`POUFNE - ${l.name || 'kandydat'} - ${new Date().toLocaleDateString('pl-PL')}`);
    for (let i = 1; i <= n; i++) {
      pdf.setPage(i);
      pdf.setTextColor(238, 238, 238); pdf.setFontSize(30);
      pdf.text(wm, 30, 210, { angle: 35 }); pdf.text(wm, 40, 290, { angle: 35 });
      pdf.setFontSize(8); pdf.setTextColor(140);
      pdf.text(`${i} / ${n}`, pageW - margin, pageH - 4, { align: 'right' });
      pdf.text(stripPL(`Poufne - przygotowano dla: ${l.name || ''}`), margin, pageH - 4);
    }
    return pdf.output('arraybuffer');
  } finally { host.remove(); }
}
const plFileName = (l, level) => `Cennik-${level === 'preview' ? 'poglad' : 'pelny'}-ShipCenter-${slug(l.name || 'kandydat')}.pdf`;
async function plDownload(l, level) {
  toast('Przygotowuję PDF…');
  try { await offerDownload(plFileName(l, level), new Uint8Array(await plPdfBytes(l, level))); }
  catch (e) { toast('Nie udało się przygotować PDF: ' + (e.message || e), 'bad'); }
}
async function plMail(l, level) {
  toast('Przygotowuję cennik PDF…');
  let bytes;
  try { bytes = await plPdfBytes(l, level); } catch (e) { toast('Nie udało się przygotować PDF: ' + (e.message || e), 'bad'); return; }
  const ctx = msgContext(l, l.form);
  const body = level === 'preview'
    ? `${powitanie(ctx)}

zgodnie z rozmową przesyłam w załączniku poglądowy cennik ShipCenter – ceny zakupu najpopularniejszych usług dla punktu (paczkomaty, Orlen Paczka, DPD Pickup, kurierzy, Pocztex). Pozwoli to oszacować, ile punkt zarabia na każdej nadanej paczce.

Pełny cennik wszystkich przewoźników i usług udostępniamy po podpisaniu krótkiej umowy o zachowaniu poufności – chętnie ją prześlę.

Pozdrawiam
`
    : `${powitanie(ctx)}

dziękuję za podpisanie umowy o zachowaniu poufności. W załączniku przesyłam pełny cennik zakupu usług dla punktu ShipCenter.

Cennik jest poufny i przygotowany imiennie – proszę nie przekazywać go dalej. W razie pytań o konkretne usługi lub marże jestem do dyspozycji.

Pozdrawiam
`;
  openCompose({
    leadId: l.id, subject: level === 'preview' ? 'Cennik poglądowy ShipCenter' : 'Pełny cennik ShipCenter – poufne', body,
    attachments: [{ filename: plFileName(l, level), content_base64: toB64(bytes), content_type: 'application/pdf' }],
    onSent: () => { const cur = D().leads[l.id]; if (cur) patch('leads', l.id, { priceSent: { ...(cur.priceSent || {}), [level]: todayISO() }, updatedTs: new Date().toISOString() }); }
  });
}
