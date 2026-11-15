/* ===== Umowa o zachowaniu poufności (NDA) dla kandydata =====
   Treść generowana z danymi kandydata → PDF do załączenia + akceptacja kodem SMS:
   - z mostkiem (nda_create): link do strony akceptacji, kod SMS wysyła serwer, panel sam sprawdza status,
   - bez mostka: kod SMS z panelu, kandydat odpisuje „Akceptuję” z kodem, opiekun potwierdza kod w panelu. */

function ndaParties(l) {
  const c = l.companyData || {};
  const firm = l.company || c.name || '';
  const nip = nipDigits(l.nip || c.nip || '');
  const addr = c.address || [l.pointAddress, [l.pointPostal, l.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return { name: l.name || '', firm, nip: nip ? nipFmt(nip) : '', addr, phone: fmtPhone(l.phone || ''), email: l.email || '' };
}
function ndaText(l) {
  const p = ndaParties(l);
  const pen = +settings().ndaPenalty || 0;
  const years = +settings().ndaYears || 3;
  const date = new Date().toLocaleDateString('pl-PL');
  const cand = [p.name, p.firm && p.firm.toLowerCase() !== p.name.toLowerCase() ? `prowadzący(-a) działalność pod firmą ${p.firm}` : '', p.nip ? `NIP ${p.nip}` : '', p.addr ? `adres: ${p.addr}` : '', p.phone ? `tel. ${p.phone}` : '', p.email ? `e-mail ${p.email}` : ''].filter(Boolean).join(', ');
  return `UMOWA O ZACHOWANIU POUFNOŚCI

zawarta w dniu ${date} pomiędzy:
Ship Center Poland Sp. z o.o. z siedzibą w Katowicach (40-853), ul. Gliwicka 51, wpisaną do rejestru przedsiębiorców KRS pod numerem 0000624967, NIP 6342867610, REGON 364786381, zwaną dalej „ShipCenter”,
a
${cand}, zwanym(-ą) dalej „Kandydatem”.

§ 1. Cel umowy
Strony prowadzą rozmowy o możliwej współpracy w ramach sieci ShipCenter (franczyza lub Ship Point). W związku z tym ShipCenter może przekazać Kandydatowi informacje poufne.

§ 2. Informacje poufne
Informacjami poufnymi są wszelkie informacje handlowe, finansowe, techniczne i organizacyjne przekazane Kandydatowi w jakiejkolwiek formie, w szczególności cenniki zakupu usług przewozowych i inne cenniki, warunki handlowe z przewoźnikami, stawki i marże, know-how, materiały szkoleniowe, wzory dokumentów oraz dane dostępowe do systemu shipcenter.pl.

§ 3. Obowiązki Kandydata
Kandydat zobowiązuje się:
1) zachować informacje poufne w tajemnicy i nie ujawniać ich osobom trzecim,
2) wykorzystywać je wyłącznie do oceny współpracy z ShipCenter,
3) nie kopiować ani nie utrwalać ich w zakresie szerszym, niż jest to potrzebne do tej oceny,
4) na żądanie ShipCenter niezwłocznie zwrócić lub trwale usunąć otrzymane materiały.

§ 4. Wyłączenia
Obowiązek poufności nie dotyczy informacji: 1) publicznie dostępnych bez naruszenia niniejszej umowy, 2) znanych Kandydatowi przed ich przekazaniem przez ShipCenter, 3) których ujawnienia żąda uprawniony organ na podstawie przepisów prawa – po uprzednim poinformowaniu ShipCenter, o ile jest to dopuszczalne.

§ 5. Czas obowiązywania
Obowiązek poufności trwa przez okres prowadzenia rozmów oraz ${years} ${years === 1 ? 'rok' : years < 5 ? 'lata' : 'lat'} od ich zakończenia, a w razie zawarcia umowy o współpracy – zgodnie z jej postanowieniami.

§ 6. Odpowiedzialność
${pen ? `W razie naruszenia obowiązków określonych w § 3 Kandydat zapłaci ShipCenter karę umowną w wysokości ${fmt(pen)} zł za każde naruszenie. ShipCenter może dochodzić odszkodowania przewyższającego wysokość kary umownej na zasadach ogólnych.` : 'Kandydat odpowiada za szkodę wyrządzoną naruszeniem niniejszej umowy na zasadach ogólnych.'}

§ 7. Postanowienia końcowe
1. Umowa nie zobowiązuje Stron do zawarcia umowy o współpracy.
2. Umowa zostaje zawarta w formie dokumentowej (art. 77² Kodeksu cywilnego) – przez akceptację jej treści przez Kandydata potwierdzoną jednorazowym kodem wysłanym SMS-em na numer telefonu Kandydata – albo w formie pisemnej lub elektronicznej.
3. W sprawach nieuregulowanych stosuje się przepisy Kodeksu cywilnego. Sądem właściwym jest sąd właściwy dla siedziby ShipCenter.`;
}

async function ndaPdfBytes(l) {
  const text = ndaText(l);
  const paras = text.split(/\n\s*\n/).map((p, i) => i === 0 ? `<h1>${esc(p)}</h1>` : /^§/.test(p) ? `<h2>${esc(p.split('\n')[0])}</h2><p>${esc(p.split('\n').slice(1).join('\n')).replace(/\n/g, '<br>')}</p>` : `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const css = `.nda{font-family:Arial,Helvetica,sans-serif;color:#111827;width:760px;padding:30px 36px;background:#fff;font-size:12px;line-height:1.6}
    .nda .top{border-bottom:3px solid #E94E1A;padding-bottom:10px;margin-bottom:16px}.nda .top svg{width:150px;height:auto}
    .nda h1{font-size:17px;text-align:center;margin:6px 0 14px}.nda h2{font-size:12.5px;margin:14px 0 4px}.nda p{margin:0 0 8px}
    .nda .sig{margin-top:22px;display:flex;justify-content:space-between;gap:20px;font-size:11px;color:#4B5563}.nda .sig div{border-top:1px solid #9CA3AF;padding-top:6px;width:45%}`;
  const body = `<div class="nda"><div class="top">${LOGO_SVG}</div>${paras}
    <div class="sig"><div>ShipCenter</div><div>Kandydat – akceptacja kodem SMS lub podpis</div></div></div>`;
  return pdfFromHtml(css, body, '.nda', { footerLeft: stripPL('Umowa o zachowaniu poufnosci - ' + (l.name || '')), breaks: 'h2, p, .sig' });
}
const ndaFileName = l => `Umowa-o-poufnosci-ShipCenter-${slug(l.name || 'kandydat')}.pdf`;

/* przygotowanie NDA do wysyłki: PDF + instrukcja w treści maila + akcja po wysłaniu */
async function ndaPrepare(l) {
  const pdf = await ndaPdfBytes(l);
  const attachment = { filename: ndaFileName(l), content_base64: toB64(pdf), content_type: 'application/pdf' };
  const digits = String(l.phone || '').replace(/\D/g, '');
  const masked = digits.length >= 9 ? `+48 *** *** ${digits.slice(-3)}` : '';
  if (typeof mailOn === 'function' && mailOn()) {
    try {
      const p = ndaParties(l);
      const r = await mailCall('nda_create', { lead_id: l.id, title: 'Umowa o zachowaniu poufności', text: ndaText(l), signer: { name: p.name, company: p.firm, nip: p.nip, phone: fmtPhone(l.phone), email: l.email || '' } });
      return {
        attachment,
        instructions: `Umowę o zachowaniu poufności (w załączniku) można zaakceptować online w 1 minutę – wystarczy kod SMS:\n${r.url}`,
        afterSend: () => { const cur = D().leads[l.id]; if (!cur) return; patch('leads', l.id, { nda: { method: 'online', token: r.token, url: r.url, sentAt: new Date().toISOString(), status: 'wyslana' }, updatedTs: new Date().toISOString() }); const sid = uid('sms'); put('sms', sid, { leadId: l.id, leadName: l.name || '', phone: fmtPhone(l.phone), text: stripPL(`ShipCenter: umowa o zachowaniu poufnosci do akceptacji: ${r.url}`), ownerId: l.ownerId || '', status: 'oczekuje', kind: 'nda', createdTs: new Date().toISOString(), createdBy: myMemberId() || '' }); if (smsGatewayOn()) deliverSms(sid); }
      };
    } catch (e) { /* mostek bez NDA – wersja z kodem */ }
  }
  const code = String(Math.floor(100000 + Math.random() * 900000));
  return {
    attachment,
    instructions: `W załączniku jest krótka umowa o zachowaniu poufności. Aby ją zaakceptować, proszę odpowiedzieć na tę wiadomość: „Akceptuję umowę o zachowaniu poufności” i dopisać kod, który wysłaliśmy SMS-em${masked ? ' na numer ' + masked : ''}.`,
    afterSend: () => {
      const cur = D().leads[l.id]; if (!cur) return;
      patch('leads', l.id, { nda: { method: 'kod', code, sentAt: new Date().toISOString(), status: 'wyslana' }, updatedTs: new Date().toISOString() });
      if (l.phone) { const sid = uid('sms'); put('sms', sid, { leadId: l.id, leadName: l.name || '', phone: fmtPhone(l.phone), text: `ShipCenter: kod akceptacji umowy o zachowaniu poufnosci: ${code}. Prosimy odpisac na maila: Akceptuje umowe o zachowaniu poufnosci, kod ${code}.`, ownerId: l.ownerId || '', status: 'oczekuje', kind: 'nda', createdTs: new Date().toISOString(), createdBy: myMemberId() || '' }); if (smsGatewayOn()) deliverSms(sid); }
    }
  };
}

async function ndaSendOnly(l) {
  if (!l.email) { toast('Kandydat nie ma adresu e-mail.', 'bad'); return; }
  toast('Przygotowuję umowę…');
  let prep; try { prep = await ndaPrepare(l); } catch (e) { toast('Nie udało się przygotować umowy: ' + (e.message || e), 'bad'); return; }
  const ctx = msgContext(l, l.form);
  openCompose({ leadId: l.id, subject: 'Umowa o zachowaniu poufności – ShipCenter', attachments: [prep.attachment], onSent: prep.afterSend,
    body: `${powitanie(ctx)}

zgodnie z rozmową przesyłam krótką umowę o zachowaniu poufności. Po jej zaakceptowaniu udostępnię pełny cennik i szczegóły współpracy.

${prep.instructions}

Pozdrawiam
` });
}

function ndaConfirmCode(l, code) {
  const n = l.nda || {};
  if (!n.code) return;
  if (String(code || '').replace(/\D/g, '') !== n.code) { toast('Kod się nie zgadza z wysłanym SMS-em.', 'bad'); return; }
  const at = new Date().toISOString();
  const hist = (l.history || []).slice(); hist.push(histEntry('system', 'Kandydat zaakceptował umowę o zachowaniu poufności (odpowiedź e-mail z kodem SMS)'));
  patch('leads', l.id, { ndaAt: todayISO(), nda: { ...n, status: 'podpisana', signedAt: at, confirmedBy: myMemberId() || '' }, history: hist, updatedTs: at });
  toast('NDA zaakceptowana');
}

/* automatyczne sprawdzanie podpisu online (mostek) – najwyżej raz na minutę */
const NDA_CHECK = {};
function ndaAutoCheck(l) {
  const n = l.nda; if (!n || n.method !== 'online' || !n.token || l.ndaAt || !(typeof mailOn === 'function' && mailOn())) return;
  if (NDA_CHECK[l.id] && Date.now() - NDA_CHECK[l.id] < 60000) return;
  NDA_CHECK[l.id] = Date.now();
  mailCall('nda_status', { token: n.token }).then(st => {
    if (st && st.status === 'podpisana') {
      const cur = D().leads[l.id]; if (!cur || cur.ndaAt) return;
      const hist = (cur.history || []).slice(); hist.push(histEntry('system', `Kandydat zaakceptował NDA online kodem SMS (${new Date(st.signedAt).toLocaleString('pl-PL')}, IP ${st.ip})`));
      patch('leads', l.id, { ndaAt: st.signedAt.slice(0, 10), nda: { ...n, status: 'podpisana', signedAt: st.signedAt, ip: st.ip, hash: st.hash }, history: hist, updatedTs: new Date().toISOString() });
      toast('Kandydat zaakceptował NDA: ' + (cur.name || ''));
    } else if (st && st.status === 'wygasla' && n.status !== 'wygasla') patch('leads', l.id, { nda: { ...n, status: 'wygasla' } });
  }).catch(() => { });
}

function ndaStep(l) {
  const n = l.nda || {};
  if (l.ndaAt) return `<span class="small ink2">podpisana ${fdate(l.ndaAt)}${n.method === 'online' ? ' · online kodem SMS' : n.method === 'kod' ? ' · e-mail z kodem SMS' : ''}</span><button class="btn sm ghost" data-act="nda-clear" data-id="${l.id}">${ICONS.back}Cofnij</button>`;
  ndaAutoCheck(l);
  const pdfBtn = `<button class="btn sm ghost" data-act="nda-pdf" data-id="${l.id}">${ICONS.file}PDF</button>`;
  if (n.status === 'wyslana' && n.method === 'kod') return `<span class="small ink2">Wysłana ${fdate(String(n.sentAt).slice(0, 10))} – czeka na odpowiedź z kodem z SMS-a.</span>
    <div class="row" style="flex-wrap:nowrap"><input type="text" id="nda-code" inputmode="numeric" maxlength="6" placeholder="kod z maila" style="max-width:130px"><button class="btn sm" data-act="nda-confirm" data-id="${l.id}">${ICONS.check}Potwierdź kod</button></div>
    <div class="row"><button class="btn sm ghost" data-act="nda-send" data-id="${l.id}">${ICONS.send}Wyślij ponownie</button>${pdfBtn}<button class="btn sm ghost" data-act="nda-signed" data-id="${l.id}">Podpisana inaczej</button></div>`;
  if (n.status === 'wyslana' && n.method === 'online') return `<span class="small ink2">Wysłana ${fdate(String(n.sentAt).slice(0, 10))} – czeka na akceptację online (sprawdzam automatycznie).</span>
    <div class="row"><button class="btn sm ghost" data-act="copy" data-text="${esc(n.url)}">${ICONS.copy}Link do podpisu</button><button class="btn sm ghost" data-act="nda-send" data-id="${l.id}">${ICONS.send}Wyślij ponownie</button>${pdfBtn}</div>`;
  if (n.status === 'wygasla') return `<span class="small overdue">Link do akceptacji wygasł.</span><div class="row"><button class="btn sm" data-act="nda-send" data-id="${l.id}">${ICONS.send}Wyślij nowy</button></div>`;
  return `<span class="small ink2">Krótka umowa – kandydat akceptuje ją kodem SMS. Dołącza się też do maila z cennikiem poglądowym.</span>
    <div class="row"><button class="btn sm" data-act="nda-send" data-id="${l.id}" ${l.phone ? '' : 'disabled title="Brak telefonu kandydata"'}>${ICONS.send}Wyślij NDA do podpisu</button>${pdfBtn}<button class="btn sm ghost" data-act="nda-signed" data-id="${l.id}">Podpisana inaczej</button></div>`;
}
