/* ===== Analiza lokalizacji: popyt, przepustowość, konkurencja, rachunek, raport ===== */

const LOC_TYPES = {
  ulica: { n: 'Ulica handlowa / centrum', ind: 1.15, biz: 1.0 },
  osiedle: { n: 'Osiedle mieszkaniowe', ind: 1.0, biz: 0.8 },
  galeria: { n: 'Galeria / centrum handlowe', ind: 1.2, biz: 0.85 },
  park: { n: 'Park handlowy / przy markecie', ind: 1.1, biz: 1.05 },
  biznes: { n: 'Strefa biznesowa / przemysłowa', ind: 0.75, biz: 1.45 },
  wezel: { n: 'Dworzec / węzeł komunikacyjny', ind: 1.1, biz: 0.9 }
};
const COMP_TYPES = {
  epaka: { n: 'Punkt Epaka.pl', w: 1.0 },
  pakersi: { n: 'Punkt Pakersi', w: 1.0 },
  sc: { n: 'Inny punkt ShipCenter', w: 1.2 },
  // dawne typy – nie są liczone jako konkurencja
  multi: { n: 'Inny punkt (nie liczony)', w: 0, legacy: true }, poczta: { n: 'Poczta (nie liczona)', w: 0, legacy: true }, kurier: { n: 'Oddział kuriera (nie liczony)', w: 0, legacy: true },
  pudo: { n: 'Punkt odbioru (nie liczony)', w: 0, legacy: true }, paczkopunkt: { n: 'PaczkoPunkt (nie liczony)', w: 0, legacy: true }, automat: { n: 'Paczkomat (nie liczony)', w: 0, legacy: true }
};
const LOC_DEFAULTS = {
  name: '', leadId: '', address: '', city: '', region: '', cityPop: 60000, catchment: 12000, type: 'ulica', traffic: 2000, visibility: 3, parking: 'ograniczony',
  firms: 40, area: 30, storage: 8, rent: 2500, media: 450, stations: 1, staff: 0, ownerWorks: true, staffCost: 0, hours: 9, days: 5,
  competitors: [],
  rev: { parcels: null, pickups: 300, stamps: 30, print: 20, packing: 80 },
  a: { indivRate: 0.25, capture: 0.06, bizShare: 0.15, bizAvg: 60, minPerParcel: 4, storagePerM2: 20, fitout: 3000, other: 400,
    pParcel: 25, pPickup: 1.2, pStamp: 47, pPrint: 120, pPacking: 25, mParcel: 36, mPickup: 90, mStamp: 50, mPrint: 40, mPacking: 50 }
};
/* Przychód jak w kalkulatorze shipcenter.pl/franczyza/prezentacja: liczba × średnia cena */
const REV_ITEMS = [
  { k: 'parcels', n: 'Przesyłki', d: 'Krajowe, zagraniczne i paletowe', p: 'pParcel', m: 'mParcel', max: 3000, step: 10 },
  { k: 'pickups', n: 'Wydania paczek', d: 'Paczki odbierane przez klientów w punkcie', p: 'pPickup', m: 'mPickup', max: 1000, step: 10 },
  { k: 'stamps', n: 'Pieczątki', d: 'Liczba sprzedanych pieczątek', p: 'pStamp', m: 'mStamp', max: 100, step: 1 },
  { k: 'print', n: 'Poligrafia', d: 'Liczba zamówień poligraficznych', p: 'pPrint', m: 'mPrint', max: 120, step: 1 },
  { k: 'packing', n: 'Pakowanie i materiały', d: 'Liczba usług lub zakupów materiałów', p: 'pPacking', m: 'mPacking', max: 300, step: 1 }
];
const COMP_CAP = { automat: 1.0, pudo: 1.0, paczkopunkt: 0.6, poczta: 1.2, kurier: 0.8 };
const decay = d => d <= 300 ? 1 : d <= 800 ? 0.7 : d <= 1500 ? 0.45 : d <= 3000 ? 0.2 : 0;

function analyzeLocation(x) {
  const L = { ...LOC_DEFAULTS, ...x, a: { ...LOC_DEFAULTS.a, ...(x.a || {}) }, rev: { ...LOC_DEFAULTS.rev, ...(x.rev || {}) } };
  const a = L.a;
  const o = offer();
  const lt = LOC_TYPES[L.type] || LOC_TYPES.ulica;
  const pop = +L.catchment > 0 ? +L.catchment : (+L.cityPop || 0) * 0.15;
  const trafficF = 0.75 + 0.25 * Math.min(2, (+L.traffic || 0) / 2000);
  const visF = 0.85 + 0.075 * ((+L.visibility || 3) - 1);
  const parkF = ({ brak: 0.9, ograniczony: 1.0, dobry: 1.1 })[L.parking] || 1;
  const comps = (L.competitors || []).filter(c => c && (+c.dist >= 0));
  let scConflict = null;
  const byType = {};
  const compRows = comps.map(c => {
    const t = COMP_TYPES[c.type] || COMP_TYPES.multi;
    const contrib = t.w * decay(+c.dist || 0) * ((+c.strength || 3) / 3);
    byType[c.type] = (byType[c.type] || 0) + contrib;
    if (c.type === 'sc' && +c.dist < o.ochrona * 1000) scConflict = c;
    return { ...c, tn: t.n, contrib };
  });
  const ci = Object.entries(byType).reduce((s2, [k, v]) => s2 + (COMP_CAP[k] != null ? Math.min(COMP_CAP[k], v) : v), 0);
  const compF = 1 / (1 + 0.4 * ci);
  const indiv = pop * a.indivRate * a.capture * lt.ind * trafficF * visF * compF;
  const biz = (+L.firms || 0) * a.bizShare * a.bizAvg * lt.biz * parkF * Math.sqrt(compF);
  const base = indiv + biz;
  const demand = { indiv, biz, base, low: base * 0.7, high: base * 1.3, peak: base * 1.35 };
  // przepustowość
  const daysM = (+L.days || 5) * 4.33;
  const people = Math.max(1, Math.min(+L.stations || 1, (+L.staff || 0) + (L.ownerWorks ? 1 : 0) || 1));
  const perHour = 60 / Math.max(1, a.minPerParcel) * 0.7;
  const serviceCap = people * (+L.hours || 8) * daysM * perHour;
  const storageCap = (+L.storage || 0) * a.storagePerM2 * daysM;
  const capacity = Math.max(1, storageCap > 0 ? Math.min(serviceCap, storageCap) : serviceCap);
  const P = L.rev.parcels != null && L.rev.parcels !== '' ? Math.max(0, +L.rev.parcels) : Math.round(base);
  const pickupLoad = (+L.rev.pickups || 0) * 0.4;
  const util = (P + pickupLoad) / capacity;
  const utilPeak = (P * 1.35 + pickupLoad) / capacity;
  const bottleneck = storageCap > 0 && storageCap < serviceCap ? 'zaplecze (miejsce na paczki)' : 'obsługa przy ladzie';
  // rachunek: przychód jak w kalkulatorze ShipCenter, koszt usług wg marż z założeń
  const scen = mult => {
    const lines = REV_ITEMS.map(it => { const n = (it.k === 'parcels' ? P : (+L.rev[it.k] || 0)) * mult; const rev = n * (+a[it.p] || 0); return { k: it.k, n: it.n, count: n, revenue: rev, cogs: rev * (1 - clamp((+a[it.m] || 0) / 100, 0, 1)) }; });
    const parcels = lines[0].count;
    const revenue = sum(lines, l => l.revenue), cogs = sum(lines, l => l.cogs);
    const fee = parcels >= o.progRabatu ? 0 : o.oplataMies;
    const p24 = lines[0].revenue * o.prowizjaP24 / 100;
    const staff = (+L.staff || 0) * (+L.staffCost || 0);
    const fixed = (+L.rent || 0) + (+L.media || 0) + staff + fee + p24 + (+a.other || 0);
    return { parcels, lines, revenue, cogs, fee, p24, staff, fixed, costs: cogs + fixed, margin: revenue - cogs, profit: revenue - cogs - fixed };
  };
  const fin = { low: scen(0.7), base: scen(1), high: scen(1.3) };
  const startup = o.licencja + (+a.fitout || 0);
  const payback = fin.base.profit > 0 ? startup / fin.base.profit : null;
  const fixedNoFee = (+L.rent || 0) + (+L.media || 0) + (+L.staff || 0) * (+L.staffCost || 0) + (+a.other || 0) + o.oplataMies;
  const extrasMargin = sum(fin.base.lines.slice(1), l => l.revenue - l.cogs);
  const unit = (+a.pParcel || 0) * ((+a.mParcel || 0) / 100) - (+a.pParcel || 0) * o.prowizjaP24 / 100;
  const breakEven = unit > 0 ? Math.max(0, (fixedNoFee - extrasMargin) / unit) : null;
  // ocena
  const sDemand = clamp(P / 800 * 100, 0, 100);
  const sComp = clamp(compF * 100, 0, 100);
  const siteProd = (lt.ind * 0.6 + lt.biz * 0.4) * trafficF * visF * parkF;
  const sSite = clamp((siteProd - 0.7) / 0.7 * 100, 0, 100);
  const sEcon = clamp(50 + fin.base.profit / (fin.base.profit >= 0 ? 50 : 40), 0, 100);
  const sCap = util <= 0.85 && util >= 0.35 ? 100 : util > 0.85 ? clamp(100 - (util - 0.85) * 200, 0, 100) : clamp(40 + util / 0.35 * 60, 0, 100);
  let score = Math.round(0.3 * sDemand + 0.2 * sComp + 0.2 * sSite + 0.2 * sEcon + 0.1 * sCap);
  const flags = [];
  if (scConflict) { flags.push({ k: 'bad', t: `Inny punkt Ship Center w odległości ${fmt(+scConflict.dist)} m – narusza ochronę ${o.ochrona} km (OWU § 6 ust. 4).` }); score = Math.min(score, 35); }
  if (P < o.minPaczek) flags.push({ k: 'bad', t: `Przyjęta liczba przesyłek (${fmt(P)}) jest poniżej minimum ${o.minPaczek} paczek miesięcznie z umowy.` });
  if (P >= o.progRabatu) flags.push({ k: 'good', t: `Ponad ${o.progRabatu} przesyłek miesięcznie – opłata miesięczna ${o.oplataMies} zł spada do 0 zł.` });
  if (utilPeak > 1) flags.push({ k: 'warn', t: `W szczycie sezonu (listopad–grudzień) obciążenie sięga ${pct(utilPeak)} przepustowości – wąskie gardło: ${bottleneck}. Zaplanuj dodatkową osobę lub większe zaplecze.` });
  else if (util < 0.35) flags.push({ k: 'warn', t: `Wykorzystanie przepustowości tylko ${pct(util)} – lokal lub obsada może być przewymiarowana względem popytu.` });
  if (fin.base.profit < 0) flags.push({ k: 'warn', t: `W scenariuszu bazowym koszty przewyższają przychód o ${zl(-fin.base.profit)} miesięcznie. Próg rentowności: ok. ${fmt(breakEven)} paczek.` });
  if (ci > 1.2) flags.push({ k: 'warn', t: `Blisko działają punkty Epaka.pl / Pakersi (indeks ${fmt(ci, 2)}) – kluczowe będzie wyróżnienie się obsługą i pozyskanie klientów biznesowych.` });
  const grade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
  const gradeText = { A: 'Rekomendowana', B: 'Dobra – warunkowo', C: 'Do weryfikacji', D: 'Nie rekomendowana' }[grade];
  return { L, P, pop, trafficF, visF, parkF, lt, ci, compF, compRows, compCount: compRows.filter(c => +c.dist <= 3000).length, demand, capacity, serviceCap, storageCap, util, utilPeak, bottleneck, people, fin, startup, payback, breakEven, subs: { sDemand, sComp, sSite, sEcon, sCap }, score, grade, gradeText, flags, scConflict };
}

function viewLocations() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie analiz…</div>`;
  const locs = Object.values(D().locations).sort((a, b) => (b.updatedTs || '').localeCompare(a.updatedTs || ''));
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Ocena potencjału punktów</span><h1>Analiza lokalizacji</h1>
    <p>Szacuje popyt na nadania, przepustowość punktu, presję konkurencji w promieniu 3 km i rachunek miesięczny. Z każdej analizy wygenerujesz raport dla kandydata na franczyzobiorcę.</p></div>
    <div class="actions"><button class="btn primary" data-act="loc-new">${ICONS.pin}Nowa analiza</button></div></div>`;
  if (!locs.length) return head + `<div class="card"><div class="empty"><h3>Nie ma jeszcze żadnej analizy</h3><p>Wprowadź dane lokalu i okolicy: liczbę mieszkańców, ruch pieszy, firmy wysyłające paczki, czynsz, obsadę i punkty konkurencji. Ocena i raport policzą się od razu.</p><button class="btn primary" data-act="loc-new">${ICONS.pin}Nowa analiza</button></div></div>`;
  return head + `<div class="grid3">${locs.map(x => {
    const r = analyzeLocation(x); const l = x.leadId ? D().leads[x.leadId] : null;
    return `<a class="card loccard" href="#lok-${x.id}" style="text-decoration:none;color:inherit">
      <span class="scorebadge grade-${r.grade}"><b>${r.score}</b><span>/ 100</span></span>
      <span style="min-width:0"><b>${esc(x.name || x.address || x.city || 'Lokalizacja')}</b><br>
      <span class="small ink2">${esc([x.city, x.region].filter(Boolean).join(' · '))}</span><br>
      <span class="small"><span class="pill ${r.grade === 'A' ? 'good' : r.grade === 'D' ? 'bad' : r.grade === 'C' ? 'warn' : ''}">${r.gradeText}</span></span><br>
      <span class="tiny muted">${fmt(r.demand.base)} paczek/mies. · wynik ${zl(r.fin.base.profit)}${l ? ' · ' + esc(l.name) : ''}</span></span></a>`;
  }).join('')}</div>`;
}

function newLocation(leadId = '') {
  const l = leadId ? D().leads[leadId] : null;
  const x = clone(LOC_DEFAULTS);
  Object.assign(x, { id: uid('loc'), leadId, name: l ? `${l.city || 'Lokalizacja'} – ${l.name}` : 'Nowa lokalizacja', city: l ? l.city : '', region: l ? l.region : '', createdAt: todayISO(), updatedTs: new Date().toISOString() });
  put('locations', x.id, x);
  go('lok-' + x.id);
}

function viewLocationEditor(id) {
  if (isLoading()) return `<div class="skeleton">Wczytywanie…</div>`;
  const x = D().locations[id];
  if (!x) return `<div class="card"><div class="empty"><h3>Nie znaleziono analizy</h3><a class="btn" href="#lokalizacje">Wróć do listy</a></div></div>`;
  const r = analyzeLocation(x);
  const L = r.L, a = L.a;
  const num = (k, label, step = 1, hint = '', min = 0) => `<label class="field"><span>${label}</span><input type="number" id="lo-${k}" data-loc="${k}" min="${min}" step="${step}" value="${esc(L[k])}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const anum = (k, label, step, hint = '') => `<label class="field"><span>${label}</span><input type="number" id="la-${k}" data-loc-a="${k}" min="0" step="${step}" value="${esc(a[k])}">${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;
  const head = `<div class="row between" style="margin-bottom:10px"><a class="btn ghost sm" href="#lokalizacje">${ICONS.back}Wszystkie analizy</a>
    <div class="row"><a class="btn primary" href="#raport-${x.id}">${ICONS.file}Raport dla kandydata</a><button class="btn danger sm" data-act="loc-del" data-id="${x.id}">${ICONS.trash}</button></div></div>
    <div class="viewhead"><div class="grow"><span class="eyebrow">Analiza lokalizacji · ${esc(fdate(x.createdAt))}</span><h1>${esc(x.name || 'Lokalizacja')}</h1></div></div>`;

  const form = `<div class="stack">
    <div class="card"><div class="cardhead"><h2>Lokal i kandydat</h2></div><div class="formgrid">
      <label class="field span2"><span>Nazwa analizy</span><input type="text" id="lo-name" data-loc="name" value="${esc(L.name)}"></label>
      <label class="field"><span>Kandydat (lead)</span><select id="lo-leadId" data-loc="leadId">${opt('', '— brak —', L.leadId)}${leadsArr().sort((p, q) => (p.name || '').localeCompare(q.name || '', 'pl')).map(l => opt(l.id, l.name + (l.city ? ' – ' + l.city : ''), L.leadId)).join('')}</select></label>
      <label class="field span2"><span>Adres lokalu</span><input type="text" id="lo-address" data-loc="address" value="${esc(L.address)}" placeholder="ul. …, kod, miasto"></label>
      <label class="field"><span>Miasto</span><input type="text" id="lo-city" data-loc="city" value="${esc(L.city)}"></label>
      <label class="field"><span>Województwo</span><select id="lo-region" data-loc="region">${regionOpts(L.region)}</select></label>
    </div></div>
    <div class="card"><div class="cardhead"><h2>Okolica i popyt</h2>${S.sample ? `<button class="btn sm ${L.auto && L.auto.status === 'done' ? '' : 'primary'}" data-act="loc-autofill" data-id="${x.id}" ${L.city ? '' : 'disabled title="Wpisz najpierw miasto"'}>${ICONS.spark}${L.auto && L.auto.status === 'done' ? 'Uzupełnij ponownie' : 'Uzupełnij automatycznie'}</button>` : ''}</div>
      ${autoInfo(L)}<div class="formgrid">
      ${num('cityPop', 'Mieszkańcy miasta', 1000)}
      ${num('catchment', 'Mieszkańcy w zasięgu punktu', 500, 'ok. 1,5 km pieszo / 5 min autem')}
      <label class="field"><span>Typ lokalizacji</span><select id="lo-type" data-loc="type">${Object.entries(LOC_TYPES).map(([k, t]) => opt(k, t.n, L.type)).join('')}</select></label>
      ${num('traffic', 'Ruch pieszy przy lokalu (osób/dzień)', 100)}
      <label class="field"><span>Widoczność witryny (1–5)</span><input type="number" id="lo-visibility" data-loc="visibility" min="1" max="5" step="1" value="${esc(L.visibility)}"></label>
      <label class="field"><span>Parking</span><select id="lo-parking" data-loc="parking">${opt('brak', 'brak', L.parking)}${opt('ograniczony', 'ograniczony', L.parking)}${opt('dobry', 'dobry, blisko wejścia', L.parking)}</select></label>
      ${num('firms', 'Firmy wysyłające paczki w promieniu 3 km', 5, 'sklepy internetowe, hurtownie, warsztaty, producenci')}
    </div></div>
    <div class="card"><div class="cardhead"><h2>Lokal, obsada i przepustowość</h2></div><div class="formgrid">
      ${num('area', 'Sala obsługi (m²)', 1)}${num('storage', 'Zaplecze na paczki (m²)', 1)}
      ${num('rent', 'Czynsz netto / mies. (zł)', 100)}${num('media', 'Media / mies. (zł)', 50)}
      ${num('stations', 'Stanowiska obsługi', 1, '', 1)}${num('staff', 'Zatrudnieni pracownicy', 1)}
      <label class="field"><span>Właściciel pracuje w punkcie</span><select id="lo-ownerWorks" data-loc="ownerWorks">${opt('true', 'tak', String(L.ownerWorks))}${opt('false', 'nie', String(L.ownerWorks))}</select></label>
      ${num('staffCost', 'Koszt pracownika / mies. (zł)', 100, 'całkowity koszt pracodawcy')}
      ${num('hours', 'Godziny otwarcia dziennie', 1, 'min. 7 godz. (OWU)', 1)}${num('days', 'Dni otwarcia w tygodniu', 1, 'min. 5 (OWU)', 1)}
    </div></div>
    ${revenueCard(x, r)}
    <div class="card"><div class="cardhead"><h2>Konkurencja w okolicy</h2><p>tylko punkty Epaka.pl i Pakersi do ok. 3 km</p></div>
      ${L.compAuto ? `<div class="callout ${(L.competitors || []).filter(c => (COMP_TYPES[c.type] || {}).w > 0 && +c.dist <= 3000).length ? '' : 'good'}" style="margin-bottom:12px"><b>Sprawdzono automatycznie ${fdt(L.compAuto.at)}</b> · źródło: ${esc(L.compAuto.source || '')}<br><span class="small">${esc(L.compAuto.note || '')}</span></div>` : ''}
      ${(L.competitors || []).map((c, i) => `<div class="comprow">
        <input type="text" id="lc-name-${i}" data-comp="${i}" data-k="name" value="${esc(c.name)}" placeholder="Nazwa / adres" aria-label="Nazwa">
        <select id="lc-type-${i}" data-comp="${i}" data-k="type" aria-label="Typ">${Object.entries(COMP_TYPES).filter(([k, t]) => !t.legacy || k === c.type).map(([k, t]) => opt(k, t.n, c.type)).join('')}</select>
        <input type="number" id="lc-dist-${i}" data-comp="${i}" data-k="dist" value="${esc(c.dist)}" min="0" step="50" placeholder="m" aria-label="Odległość w metrach">
        <select id="lc-str-${i}" data-comp="${i}" data-k="strength" aria-label="Siła" title="Siła konkurenta">${[1, 2, 3, 4, 5].map(v => opt(v, 'siła ' + v, c.strength || 3)).join('')}</select>
        <button class="iconbtn" data-act="comp-del" data-i="${i}" aria-label="Usuń">${ICONS.x}</button></div>`).join('')}
      <div class="row" style="margin-top:6px"><button class="btn sm" data-act="comp-add">${ICONS.plus}Dodaj punkt Epaka / Pakersi</button>
      <span class="note">Odległość w metrach. Siła: 1 – słaby punkt (krótkie godziny, mało usług), 5 – bardzo silny. Paczkomaty, poczta i punkty odbioru nie są liczone jako konkurencja.</span></div></div>
    <details class="adv card"><summary>Założenia modelu (dla zaawansowanych)</summary><div class="formgrid">
      ${anum('indivRate', 'Nadania osób prywatnych (paczek/mieszkańca/mies.)', 0.01)}${anum('capture', 'Udział punktu w nadaniach prywatnych', 0.005, 'przed korektą o konkurencję')}
      ${anum('bizShare', 'Odsetek firm, które zaczną nadawać w punkcie', 0.01)}${anum('bizAvg', 'Średnio paczek na firmę / mies.', 5)}
      ${anum('minPerParcel', 'Czas obsługi nadania (min)', 0.5)}${anum('storagePerM2', 'Paczek dziennie na 1 m² zaplecza', 1)}
      ${anum('fitout', 'Sprzęt i adaptacja lokalu (zł)', 500)}${anum('other', 'Inne koszty / mies. (zł)', 50, 'internet, księgowość')}
      ${REV_ITEMS.map(it => anum(it.p, it.n + ' – średnia cena (zł)', it.k === 'pickups' ? 0.1 : 1)).join('')}
      ${REV_ITEMS.map(it => anum(it.m, it.n + ' – marża punktu (%)', 1, 'część przychodu, która zostaje w punkcie po zakupie usługi')).join('')}
    </div></details>
  </div>`;

  const sub = (n, v) => `<div class="subbar"><span class="small">${n}</span><div class="track"><i style="width:${v}%;background:var(${v >= 70 ? '--good' : v >= 45 ? '--s1' : '--s2'})"></i></div><span class="small num">${Math.round(v)}</span></div>`;
  const results = `<div class="stack" style="position:sticky;top:110px">
    <div class="card"><div class="row" style="gap:16px;flex-wrap:nowrap"><span class="scorebadge grade-${r.grade}"><b>${r.score}</b><span>/ 100</span></span>
      <div><span class="eyebrow">Ocena lokalizacji</span><h2>${r.gradeText}</h2><p class="small ink2">Klasa ${r.grade} · konkurencja: ${r.compCount} punktów w 3 km</p></div></div>
      <div class="sep"></div><div class="subbars">${sub('Popyt (30%)', r.subs.sDemand)}${sub('Konkurencja (20%)', r.subs.sComp)}${sub('Lokal i ruch (20%)', r.subs.sSite)}${sub('Rachunek (20%)', r.subs.sEcon)}${sub('Przepustowość (10%)', r.subs.sCap)}</div>
      ${r.flags.length ? `<div class="sep"></div><div class="alerts">${r.flags.map(f => `<div class="alert ${f.k === 'good' ? 'info' : f.k}"><span class="ic">${f.k === 'good' ? '✓' : '!'}</span><div class="small">${esc(f.t)}</div></div>`).join('')}</div>` : ''}</div>
    <div class="card"><div class="cardhead"><h2>Popyt a przepustowość</h2><p>paczek / mies.</p></div>
      ${capacityBars(r)}
      <div class="statline"><span>Popyt – osoby prywatne</span><b>${fmt(r.demand.indiv)}</b></div>
      <div class="statline"><span>Popyt – firmy</span><b>${fmt(r.demand.biz)}</b></div>
      <div class="statline"><span>Przepustowość (${r.people} os., wąskie gardło: ${esc(r.bottleneck)})</span><b>${fmt(r.capacity)}</b></div>
      <div class="statline"><span>Wykorzystanie / w szczycie sezonu</span><b>${pct(r.util)} / ${pct(r.utilPeak)}</b></div></div>
    <div class="card"><div class="cardhead"><h2>Rachunek miesięczny</h2><p>scenariusze</p></div>
      <div class="tablewrap"><table class="t"><thead><tr><th></th><th class="r">Pesym.</th><th class="r">Bazowy</th><th class="r">Optym.</th></tr></thead><tbody>
      ${[['Przesyłki', 'parcels', v => fmt(v)], ['Przychód', 'revenue', zl], ['Koszt usług', 'cogs', zl], ['Koszty stałe', 'fixed', zl], ['Wynik', 'profit', v => `<b class="${v < 0 ? 'overdue' : ''}">${zl(v)}</b>`]].map(([n, k, f]) => `<tr><td>${n}</td>${['low', 'base', 'high'].map(s => `<td class="r">${f(r.fin[s][k])}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="statline" style="margin-top:8px"><span>Nakłady na start</span><b>${zl(r.startup)}</b></div>
      <div class="statline"><span>Zwrot nakładów (bazowy)</span><b>${r.payback ? fmt(r.payback, 1) + ' mies.' : 'brak przy obecnych założeniach'}</b></div>
      <div class="statline"><span>Próg rentowności</span><b>${r.breakEven ? fmt(r.breakEven) + ' paczek' : '—'}</b></div></div>
    <div class="card"><div class="cardhead"><h2>Mapa konkurencji</h2><p>odległości w skali, kierunki umowne</p></div>${compRadar(r)}</div>
  </div>`;
  return head + `<div class="split">${form}${results}</div>`;
}

function capacityBars(r) {
  const max = Math.max(r.capacity, r.demand.high, r.demand.peak) * 1.05;
  const row = (n, v, col, tip) => `<div class="subbar" data-tip="${esc(tip)}"><span class="small">${n}</span><div class="track" style="height:12px"><i style="width:${clamp(v / max * 100, 0, 100)}%;background:var(${col})"></i></div><span class="small num">${fmt(v)}</span></div>`;
  return `<div class="subbars" style="margin-bottom:10px">${row('Popyt – zakres', r.demand.high, '--s1', `Zakres popytu ${fmt(r.demand.low)}–${fmt(r.demand.high)}`)}${row('Popyt – bazowy', r.demand.base, '--s1', 'Scenariusz bazowy')}${row('Szczyt sezonu', r.demand.peak, '--s2', 'Listopad–grudzień: +35%')}${row('Przepustowość', r.capacity, '--s3', 'Maksymalna liczba nadań przy obecnej obsadzie i zapleczu')}</div>`;
}

function compRadar(r, forReport = false) {
  const size = 300, c = size / 2, R = c - 18;
  const rings = [300, 800, 1500, 3000];
  const rad = d => Math.sqrt(Math.min(d, 3000) / 3000) * R;
  const col = forReport ? { s1: '#2a78d6', ink: '#0f1b2d', muted: '#6f7c91', grid: '#dce2eb', acc: '#e2691a', bad: '#d03b3b' } : null;
  const v = k => forReport ? col[k] : `var(--${k === 'ink' ? 'ink' : k === 'muted' ? 'muted' : k === 'grid' ? 'line' : k === 'acc' ? 'accent' : k === 'bad' ? 'bad' : 's1'})`;
  const typeColor = { multi: forReport ? '#eb6834' : 'var(--s2)', sc: v('bad'), poczta: forReport ? '#6250d6' : 'var(--s7)', kurier: forReport ? '#1baf7a' : 'var(--s3)', pudo: forReport ? '#e87ba4' : 'var(--s5)', paczkopunkt: forReport ? '#eda100' : 'var(--s4)', automat: forReport ? '#2a78d6' : 'var(--s1)' };
  let s = `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="Mapa odległości konkurencji" style="max-width:340px;margin:0 auto;display:block">`;
  rings.forEach(d => { const q = rad(d) * 0.7071; s += `<circle cx="${c}" cy="${c}" r="${rad(d)}" fill="none" stroke="${v('grid')}" stroke-width="1"/><text x="${c + q + 2}" y="${c + q + 9}" style="fill:${v('muted')};font-size:9px;font-family:monospace">${d >= 1000 ? fmt(d / 1000, 1) + ' km' : d + ' m'}</text>`; });
  r.compRows.forEach((cp, i) => {
    const ang = i * 2.39996 - Math.PI / 2;
    const rr = rad(+cp.dist || 0);
    const x = c + Math.cos(ang) * rr, y = c + Math.sin(ang) * rr;
    s += `<circle cx="${x}" cy="${y}" r="${4 + (+cp.strength || 3)}" fill="${typeColor[cp.type] || v('s1')}" stroke="${forReport ? '#fff' : 'var(--surface)'}" stroke-width="2" ${forReport ? '' : `data-tip="${esc((cp.name || cp.tn) + ' · ' + cp.tn + ' · ' + fmt(+cp.dist) + ' m · siła ' + (cp.strength || 3))}"`}/>`;
  });
  s += `<rect x="${c - 8}" y="${c - 8}" width="16" height="16" rx="3" fill="${v('acc')}" stroke="${forReport ? '#fff' : 'var(--surface)'}" stroke-width="2"/></svg>`;
  const used = [...new Set(r.compRows.map(x => x.type))];
  const legend = `<div class="legend" style="justify-content:center"><span><i style="background:${v('acc')}"></i>Lokal</span>${used.map(t => `<span><i style="background:${typeColor[t]};border-radius:50%"></i>${esc(COMP_TYPES[t]?.n || t)}</span>`).join('')}</div>`;
  if (forReport) return { svg: s, legend: `<p style="font-size:11px;color:#44526a;text-align:center;margin:6px 0 0">■ lokal · ${used.map(t => `<span style="color:${typeColor[t]}">●</span> ${esc(COMP_TYPES[t]?.n || t)}`).join(' · ')}</p>` };
  return r.compRows.length ? s + legend : `<p class="muted small">Dodaj punkty konkurencji, aby zobaczyć mapę odległości.</p>`;
}

/* zapis pól analizy */
function onLocInput(el) {
  const id = S.route.id; const x = D().locations[id]; if (!x) return;
  const nx = clone(x);
  if (el.dataset.loc) {
    const k = el.dataset.loc; let v = el.value;
    if (el.type === 'number') v = el.value === '' ? '' : +el.value;
    if (v === 'true') v = true; else if (v === 'false') v = false;
    nx[k] = v;
  } else if (el.dataset.locA) { nx.a = { ...(nx.a || {}), [el.dataset.locA]: +el.value || 0 }; }
  else if (el.dataset.comp != null) {
    const i = +el.dataset.comp; const comps = (nx.competitors || []).slice();
    comps[i] = { ...comps[i], [el.dataset.k]: el.type === 'number' || el.dataset.k === 'strength' ? +el.value : el.value }; nx.competitors = comps;
  }
  nx.updatedTs = new Date().toISOString();
  D().locations[id] = nx;
  debounce('loc-render', () => scheduleRender(), 300);
  debounce('loc-save-' + id, () => { const cur = D().locations[id]; if (cur) put('locations', id, cur); }, 900);
}

/* ---------- raport dla kandydata ---------- */
function reportHTML(x, r, standalone = true) {
  const o = offer();
  const l = x.leadId ? D().leads[x.leadId] : null;
  const L = r.L;
  const gradeCol = { A: '#0ca30c', B: '#2a78d6', C: '#c98500', D: '#d03b3b' }[r.grade];
  const radar = compRadar(r, true);
  const owner = l && l.ownerId ? D().team[l.ownerId] : null;
  const row = (k, v) => `<tr><td>${k}</td><td class="r">${v}</td></tr>`;
  const css = `.rpt{font-family:Poppins,Arial,sans-serif;color:#0f1b2d;background:#fff;line-height:1.5;font-size:13px;color-scheme:light}
  .rpt .pg{max-width:820px;margin:0 auto;padding:32px 28px}
  .rpt h1{font-family:Poppins,Arial,sans-serif;font-size:26px;margin:4px 0 2px;color:#0f1b2d}
  .rpt h2{font-family:Poppins,Arial,sans-serif;font-size:16px;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid #111827;color:#0f1b2d}
  .rpt ol{padding-left:20px}
  .rpt .top{display:flex;justify-content:space-between;align-items:center;border-bottom:4px solid #ea580c;padding-bottom:12px;gap:12px;flex-wrap:wrap}
  .rpt .brand{line-height:0}.rpt .brand svg{height:30px;width:auto;display:block}
  .rpt .code{font-family:"IBM Plex Mono",monospace;font-size:11px;color:#6f7c91;letter-spacing:.06em;text-transform:uppercase}
  .rpt .hero{display:flex;gap:20px;align-items:center;margin-top:18px;flex-wrap:wrap}
  .rpt .score{width:96px;height:96px;border-radius:50%;border:7px solid ${gradeCol};display:flex;flex-direction:column;align-items:center;justify-content:center;flex:none}
  .rpt .score b{font-size:32px;line-height:1;font-family:Poppins,Arial,sans-serif}.rpt .score span{font-size:10px;color:#6f7c91}
  .rpt .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-top:14px}
  .rpt .k{border:1px solid #dce2eb;border-radius:6px;padding:10px 12px}.rpt .k .l{font-size:11px;color:#44526a}.rpt .k .v{font-family:Poppins,Arial,sans-serif;font-size:21px;font-weight:700;font-variant-numeric:tabular-nums}
  .rpt table{width:100%;border-collapse:collapse;font-size:12.5px}.rpt td,.rpt th{padding:6px 8px;border-bottom:1px solid #e4e9f0;text-align:left;color:#0f1b2d}.rpt th{background:#eef1f5;font-size:11px;color:#44526a}.rpt .r{text-align:right;font-variant-numeric:tabular-nums}
  .rpt .flag{padding:8px 10px;border-radius:5px;margin:6px 0;font-size:12.5px}.rpt .flag.bad{background:#fcebeb;color:#a82727}.rpt .flag.warn{background:#fff4dc;color:#7a5000}.rpt .flag.good{background:#e5f5e5;color:#006300}
  .rpt .two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start}@media(max-width:640px){.rpt .two{grid-template-columns:1fr}.rpt .pg{padding:20px 14px}}
  .rpt .bar{height:10px;background:#e4e9f0;border-radius:5px;overflow:hidden}.rpt .bar i{display:block;height:100%;border-radius:5px}
  .rpt .muted{color:#6f7c91}.rpt .small{font-size:11.5px}.rpt .comment{background:#f2f4f7;border-left:3px solid #111827;padding:10px 14px;white-space:pre-wrap}
  .rpt svg{max-width:100%;height:auto}
  .rpt .foot{margin-top:28px;padding-top:12px;border-top:1px solid #dce2eb;font-size:11px;color:#6f7c91}`;
  const capRow = (n, v, colr) => { const mx = Math.max(r.capacity, r.demand.high, r.demand.peak) * 1.05; return `<tr><td style="width:34%">${n}</td><td><div class="bar"><i style="width:${clamp(v / mx * 100, 0, 100)}%;background:${colr}"></i></div></td><td class="r" style="width:16%">${fmt(v)}</td></tr>`; };
  const body = `<div class="rpt"><div class="pg">
  <div class="top"><div><div class="brand">${LOGO_SVG}</div><div class="code">Raport potencjału lokalizacji · ${esc(fdate(todayISO()))}</div></div><div class="code" style="text-align:right">Przygotowano dla:<br><b style="color:#0f1b2d;font-size:13px;text-transform:none;letter-spacing:0">${esc(l ? l.name : PH('kandydat'))}</b></div></div>
  <div class="hero"><div class="score"><b>${r.score}</b><span>/ 100</span></div><div><div class="code">Klasa ${r.grade}</div><h1>${esc(r.gradeText)}</h1><div>${esc(L.address || '')}${L.address && L.city ? ', ' : ''}${esc(L.city || '')}${L.region ? ' · woj. ' + esc(L.region) : ''}</div><div class="muted small">${esc(r.lt.n)} · ${fmt(+L.traffic)} osób dziennie przy lokalu · parking: ${esc(L.parking)}</div></div></div>
  <div class="kpis"><div class="k"><div class="l">Szacowany popyt</div><div class="v">${fmt(r.demand.base)}</div><div class="small muted">paczek / mies. (${fmt(r.demand.low)}–${fmt(r.demand.high)})</div></div>
  <div class="k"><div class="l">Przepustowość punktu</div><div class="v">${fmt(r.capacity)}</div><div class="small muted">wykorzystanie ${pct(r.util)}</div></div>
  <div class="k"><div class="l">Konkurencja do 3 km</div><div class="v">${r.compCount}</div><div class="small muted">indeks presji ${fmt(r.ci, 2)}</div></div>
  <div class="k"><div class="l">Wynik miesięczny (bazowy)</div><div class="v" style="color:${r.fin.base.profit < 0 ? '#a82727' : '#006300'}">${zl(r.fin.base.profit)}</div><div class="small muted">zwrot: ${r.payback ? fmt(r.payback, 1) + ' mies.' : '—'}</div></div></div>
  ${r.flags.length ? `<h2>Najważniejsze wnioski</h2>${r.flags.map(f => `<div class="flag ${f.k}">${esc(f.t)}</div>`).join('')}` : ''}
  ${x.aiComment ? `<h2>Komentarz analityka</h2><div class="comment">${esc(x.aiComment)}</div>` : ''}
  <h2>Popyt i przepustowość</h2>
  <table>${capRow('Popyt – osoby prywatne', r.demand.indiv, '#2a78d6')}${capRow('Popyt – firmy', r.demand.biz, '#1baf7a')}${capRow('Popyt łącznie (bazowy)', r.demand.base, '#13294b')}${capRow('Szczyt sezonu (XI–XII)', r.demand.peak, '#eb6834')}${capRow('Przepustowość', r.capacity, '#6f7c91')}</table>
  <p class="small muted">Przepustowość: ${r.people} os. przy obsłudze, ${fmt(+L.hours)} godz. dziennie, ${fmt(+L.days)} dni w tygodniu, zaplecze ${fmt(+L.storage)} m². Wąskie gardło: ${esc(r.bottleneck)}. Uwzględniono też wydania paczek (${fmt(+L.rev.pickups || 0)} miesięcznie).</p>
  <h2>Konkurencja</h2>
  ${L.compAuto ? `<p class="small" style="margin:0 0 8px">${esc(L.compAuto.note || '')} <span class="muted">(źródło: ${esc(L.compAuto.source || '')}, ${esc(fdate(L.compAuto.at))})</span></p>` : ''}
  <div class="two"><div>${radar.svg}${radar.legend}</div><div>${r.compRows.length ? `<table><thead><tr><th>Punkt</th><th>Typ</th><th class="r">Odległość</th></tr></thead><tbody>${r.compRows.slice().sort((p, q) => (+p.dist) - (+q.dist)).map(cp => `<tr><td>${esc(cp.name || '—')}</td><td class="small">${esc(cp.tn)}</td><td class="r">${fmt(+cp.dist)} m</td></tr>`).join('')}</tbody></table>` : `<p class="muted">${L.compAuto ? 'Brak punktów Epaka.pl i Pakersi w promieniu 3 km.' : 'Nie wprowadzono punktów konkurencji.'}</p>`}
  <p class="small muted">Jako konkurencję liczymy punkty pośredników kurierskich Epaka.pl i Pakersi. Inny punkt sieci ShipCenter nie powstanie bliżej niż ${o.ochrona} km.</p></div></div>
  <h2>Szacowany przychód punktu</h2>
  <table>${r.fin.base.lines.map(ln => { const it = REV_ITEMS.find(i => i.k === ln.k); return `<tr><td>${esc(ln.n)}</td><td class="small muted">${fmt(ln.count)} / mies. × ${zl(+L.a[it.p], ln.k === 'pickups' ? 2 : 0)}</td><td class="r">${zl(ln.revenue)}</td></tr>`; }).join('')}<tr><td><b>Razem</b></td><td class="small muted">w skali roku ok. ${zl(r.fin.base.revenue * 12)}</td><td class="r"><b>${zl(r.fin.base.revenue)}</b></td></tr></table>
  <p class="small muted">Szacunkowy przychód ze sprzedaży przed odjęciem kosztów usług i prowadzenia punktu – liczony jak w kalkulatorze na shipcenter.pl. Wynik zależy od liczby i rodzaju zamówień i nie jest gwarantowany.</p>
  <h2>Rachunek miesięczny – scenariusze</h2>
  <table><thead><tr><th></th><th class="r">Pesymistyczny</th><th class="r">Bazowy</th><th class="r">Optymistyczny</th></tr></thead><tbody>
  ${[['Przesyłki', 'parcels', v => fmt(v)], ['Przychód ze sprzedaży', 'revenue', zl], ['Koszt usług (zakup przesyłek, druku, materiałów)', 'cogs', zl], ['Czynsz i media', null, () => zl((+L.rent || 0) + (+L.media || 0))], ['Wynagrodzenia', 'staff', zl], ['Opłata miesięczna Ship Center', 'fee', zl], ['Płatności online (' + fmt(o.prowizjaP24, 1) + '%)', 'p24', zl], ['Pozostałe koszty', null, () => zl(L.a.other)], ['Wynik przed podatkiem', 'profit', v => `<b>${zl(v)}</b>`]].map(([n, k, f]) => `<tr><td>${n}</td>${['low', 'base', 'high'].map(s => `<td class="r">${k ? f(r.fin[s][k]) : f()}</td>`).join('')}</tr>`).join('')}
  </tbody></table>
  <p class="small muted">Wynagrodzenia obejmują zatrudnionych pracowników${L.ownerWorks ? '; praca właściciela nie jest wliczona w koszty' : ''}. Marża punktu (założenie): przesyłki ${fmt(+L.a.mParcel)}%, pieczątki ${fmt(+L.a.mStamp)}%, poligrafia ${fmt(+L.a.mPrint)}%, pakowanie ${fmt(+L.a.mPacking)}%.</p>
  <div class="two"><div><h2>Nakłady na start</h2><table>${row('Pakiet startowy SMART', zl(o.licencja))}${row('Sprzęt i adaptacja lokalu', zl(L.a.fitout))}${row('<b>Razem</b>', `<b>${zl(r.startup)}</b>`)}</table>
  <p class="small muted">Próg rentowności: ok. ${r.breakEven ? fmt(r.breakEven) : '—'} paczek miesięcznie.</p></div>
  <div><h2>Warunki współpracy</h2><table>${row('Pakiet SMART (jednorazowo)', zl(o.licencja) + ' netto')}${row('Opłata miesięczna', '0 zł przy ponad ' + o.progRabatu + ' paczkach, inaczej ' + zl(o.oplataMies) + ' netto')}${row('Sprzęt FLEX', 'rabat do ' + (o.flexRabat || 15) + '%')}${row('Płatności online', fmt(o.prowizjaP24, 1) + '% transakcji')}${row('Szkolenie', esc(o.szkolenie))}${row('Uruchomienie punktu', esc(o.uruchomienie))}${row('Ochrona terytorialna', o.ochrona + ' km')}</table></div></div>
  <h2>Kolejne kroki</h2><ol><li>Omówienie raportu i pytań – rozmowa z opiekunem.</li><li>Weryfikacja lokalu (umowa najmu, witryna, zaplecze).</li><li>Oferta i projekt umowy franczyzowej z OWU.</li><li>Podpisanie umowy, szkolenie wstępne, uruchomienie punktu.</li></ol>
  <div class="foot">Raport ma charakter szacunkowy i opiera się na danych o lokalu i okolicy przekazanych przez kandydata oraz na założeniach sieci Ship Center. Nie stanowi gwarancji wyników finansowych – sukces punktu zależy w szczególności od zaangażowania franczyzobiorcy, stosowania standardów sieci i aktywnego pozyskiwania klientów.<br><br>
  Ship Center Poland Sp. z o.o. · ${esc(o.adres)} · ${esc(o.email)} · ${esc(o.telefon)}${owner ? `<br>Opiekun: ${esc(owner.name)}${owner.phone ? ' · ' + esc(owner.phone) : ''}${owner.email ? ' · ' + esc(owner.email) : ''}` : ''}</div></div></div>`;
  if (!standalone) return { css, body };
  return `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Raport lokalizacji – ${esc(L.city || L.name || 'Ship Center')}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=IBM+Plex+Mono&display=swap"><style>body{margin:0;background:#fff}${css}</style></head><body>${body}</body></html>`;
}

function viewReport(id) {
  if (isLoading()) return `<div class="skeleton">Wczytywanie…</div>`;
  const x = D().locations[id];
  if (!x) return `<div class="card"><div class="empty"><h3>Nie znaleziono analizy</h3><a class="btn" href="#lokalizacje">Wróć</a></div></div>`;
  const r = analyzeLocation(x);
  S.ui.reportDoc = reportHTML(x, r, true);
  const inline = reportHTML(x, r, false);
  return `<div class="row between" style="margin-bottom:10px"><a class="btn ghost sm" href="#lok-${id}">${ICONS.back}Wróć do analizy</a>
    <div class="actions">${S.sample ? `<button class="btn" data-act="loc-ai" data-id="${id}">${ICONS.spark}${x.aiComment ? 'Napisz komentarz od nowa' : 'Dodaj komentarz analityka (Claude)'}</button>` : ''}
    <button class="btn" data-act="report-copy" data-id="${id}">${ICONS.copy}Kopiuj podsumowanie</button>
    <button class="btn" data-act="report-xlsx" data-id="${id}">${ICONS.down}XLSX</button>
    <button class="btn" data-act="report-pdf" data-id="${id}">${ICONS.down}Pobierz PDF</button>
    <button class="btn primary" data-act="report-mail" data-id="${id}">${ICONS.email}Wyślij raport mailem</button></div></div>
    <div class="viewhead"><div class="grow"><span class="eyebrow">Raport dla potencjalnego franczyzobiorcy</span><h1>${esc(x.name || 'Raport lokalizacji')}</h1><p>Podgląd dokumentu dla kandydata. „Wyślij raport mailem” przygotuje wiadomość z podsumowaniem i plik PDF do załączenia.${x.reportSentAt ? ` Raport wysłano ${fdate(x.reportSentAt)}${x.reportSentTo ? ' na ' + esc(x.reportSentTo) : ''}.` : ''}</p></div></div>
    ${x.aiComment ? `<div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>Komentarz analityka</h2><button class="btn sm ghost" data-act="loc-ai-clear" data-id="${id}">Usuń z raportu</button></div><label class="field"><span>Możesz poprawić tekst – zapisze się w raporcie</span><textarea id="loc-ai-text" data-loc-comment="${id}" rows="6">${esc(x.aiComment)}</textarea></label></div>` : ''}
    <div class="reportframe"><style>${inline.css}</style><div style="max-width:880px;margin:0 auto;border-radius:6px;overflow:hidden;box-shadow:var(--shadow)">${inline.body}</div></div>`;
}

function reportSummaryText(x, r) {
  const o = offer();
  return `Raport potencjału lokalizacji – Ship Center
${x.address || ''}${x.city ? ', ' + x.city : ''}
Ocena: ${r.score}/100 – ${r.gradeText} (klasa ${r.grade})

• Szacowany popyt: ${fmt(r.demand.base)} paczek/mies. (zakres ${fmt(r.demand.low)}–${fmt(r.demand.high)}), w tym firmy: ${fmt(r.demand.biz)}
• Przepustowość: ${fmt(r.capacity)} paczek/mies., wykorzystanie ${pct(r.util)} (szczyt sezonu ${pct(r.utilPeak)})
• Konkurencja do 3 km: ${r.compCount} punktów, indeks presji ${fmt(r.ci, 2)}
• Wynik miesięczny: pesymistyczny ${zl(r.fin.low.profit)}, bazowy ${zl(r.fin.base.profit)}, optymistyczny ${zl(r.fin.high.profit)}
• Nakłady na start: ${zl(r.startup)} (w tym pakiet SMART ${zl(o.licencja)}); zwrot: ${r.payback ? fmt(r.payback, 1) + ' mies.' : '—'}
${r.flags.map(f => '• ' + f.t).join('\n')}

Szacunek na podstawie przekazanych danych – nie stanowi gwarancji wyników.`;
}

async function locAiComment(id, btn) {
  const x = D().locations[id]; if (!x || !S.sample) return;
  const r = analyzeLocation(x);
  const prompt = `Jesteś analitykiem sieci franczyzowej Ship Center (punkty nadawcze paczek obsługujące wielu przewoźników). Napisz po polsku zwięzły komentarz (120–180 słów, 2–3 akapity, bez nagłówków i list) do raportu lokalizacji dla kandydata na franczyzobiorcę. Opieraj się wyłącznie na danych poniżej; nie wymyślaj liczb; nie obiecuj zarobków – zaznacz, że to szacunek. Wskaż mocne strony, ryzyka i 2 konkretne rekomendacje (np. obsada w szczycie, pozyskanie firm, negocjacja czynszu). Pisz w formie neutralnej (bez zwracania się per Pan/Pani).

Dane: ${reportSummaryText(x, r)}
Typ lokalizacji: ${r.lt.n}; ruch pieszy ${x.traffic} os./dzień; widoczność ${x.visibility}/5; parking ${x.parking}; firmy wysyłające w 3 km: ${x.firms}; czynsz ${x.rent} zł; obsada: ${r.people} os.; zaplecze ${x.storage} m²; przychód bazowy ${Math.round(r.fin.base.revenue)} zł/mies. (przesyłki ${r.P}, wydania ${r.L.rev.pickups}, pieczątki ${r.L.rev.stamps}, poligrafia ${r.L.rev.print}, pakowanie ${r.L.rev.packing}).
Konkurenci: ${r.compRows.map(c => `${c.tn} ${c.dist} m (siła ${c.strength || 3})`).join('; ') || 'brak danych'}.`;
  btn.disabled = true; btn.textContent = 'Claude pisze…';
  try {
    const res = await S.sample(prompt, { modelTier: 'default' });
    await patch('locations', id, { aiComment: (res.text || '').trim(), updatedTs: new Date().toISOString() });
    toast('Komentarz dodany do raportu');
  } catch (e) {
    if (e && e.code === 'not_granted') { S.sample = null; toast('Dostęp do Claude nie został przyznany dla tej strony.', 'bad'); }
    else toast('Claude nie odpowiedział: ' + (e && e.message || 'błąd'), 'bad');
  }
  btn.disabled = false; scheduleRender();
}

/* ---------- PDF raportu (render w przeglądarce) ---------- */
const PDF_LIBS = ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'];
let pdfLibsPromise = null;
function loadPdfLibs() {
  if (window.html2canvas && window.jspdf) return Promise.resolve();
  if (!pdfLibsPromise) pdfLibsPromise = PDF_LIBS.reduce((p, src) => p.then(() => new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('Nie udało się wczytać biblioteki PDF')); document.head.appendChild(sc); })), Promise.resolve()).catch(e => { pdfLibsPromise = null; throw e; });
  return pdfLibsPromise;
}
async function reportPdfBytes(x) {
  await loadPdfLibs();
  const r = analyzeLocation(x);
  const { css, body } = reportHTML(x, r, false);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:820px;background:#fff;z-index:-1';
  host.innerHTML = `<style>${css} .rpt .pg{padding:28px 30px}</style>${body}`;
  document.body.appendChild(host);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const root = host.querySelector('.rpt');
    const scale = 2;
    const canvas = await window.html2canvas(root, { scale, backgroundColor: '#ffffff', logging: false });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pageW = 210, pageH = 297, margin = 10;
    const pxPerMm = canvas.width / (pageW - 2 * margin);
    const pagePx = Math.floor((pageH - 2 * margin) * pxPerMm);
    const top0 = root.getBoundingClientRect().top;
    const breaks = [...root.querySelectorAll('h2, tr, .flag, .kpis, .two, ol, .foot, .comment, p')].map(el => Math.round((el.getBoundingClientRect().top - top0) * scale)).filter(v => v > 0).sort((a, b) => a - b);
    const heads = [...root.querySelectorAll('h2')].map(el => Math.round((el.getBoundingClientRect().top - top0) * scale) - 6);
    let y = 0, first = true;
    while (y < canvas.height - 4) {
      let end = Math.min(y + pagePx, canvas.height);
      if (end < canvas.height) {
        const cand = breaks.filter(b => b > y + pagePx * 0.5 && b <= end); if (cand.length) end = cand[cand.length - 1];
        const orphan = heads.filter(h => h > y + pagePx * 0.4 && h < end && end - h < 70 * scale); if (orphan.length) end = orphan[0];
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width; slice.height = end - y;
      const ctx = slice.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, pageW - 2 * margin, (end - y) / pxPerMm);
      first = false; y = end;
    }
    const n = pdf.getNumberOfPages();
    for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(140); pdf.text(`${i} / ${n}`, pageW - margin, pageH - 4, { align: 'right' }); }
    return pdf.output('arraybuffer');
  } finally { host.remove(); }
}
const reportFileName = x => `Raport-lokalizacji-ShipCenter-${slug(x.city || x.name)}.pdf`;
async function downloadReportPdf(id, btn) {
  const x = D().locations[id]; if (!x) return;
  const label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Tworzę PDF…'; }
  try { const bytes = await reportPdfBytes(x); await offerDownload(reportFileName(x), bytes); }
  catch (e) { toast('Nie udało się utworzyć PDF: ' + (e && e.message || 'błąd') + '. Możesz pobrać wersję HTML.', 'bad'); }
  finally { if (btn) { btn.disabled = false; btn.innerHTML = label; } }
}
function openReportMailModal(id) {
  const x = D().locations[id]; if (!x) return;
  const l = x.leadId ? D().leads[x.leadId] : null;
  const c = msgContext(l ? { ...l, locId: x.id } : { locId: x.id }, l ? l.form : 'panstwo');
  c.loc = analyzeLocation(x); c.locDoc = x;
  const out = TEMPLATES.email_raport.f(c);
  const body = out.body.replace('w załączniku przesyłam raport analizy lokalizacji', 'w załączniku (PDF) przesyłam raport analizy lokalizacji');
  openModal(`<div class="mh"><h2>Wyślij raport mailem</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <div class="mb">
      ${x.reportSentAt ? `<p class="callout">Raport był już wysłany ${fdate(x.reportSentAt)}${x.reportSentTo ? ' na ' + esc(x.reportSentTo) : ''}.</p>` : ''}
      <ol class="small ink2" style="margin:0;padding-left:18px"><li>Pobierz PDF i dołącz go do wiadomości.</li><li>Skopiuj temat i treść albo otwórz program pocztowy.</li><li>Po wysłaniu kliknij „Zapisz jako wysłany”.</li></ol>
      <div class="formgrid">
        <label class="field span2"><span>Do</span><input type="email" id="rm-to" value="${esc(l && l.email || '')}" placeholder="adres kandydata"></label>
        <div class="field" style="justify-content:flex-end"><button type="button" class="btn sm" id="rm-copy-to">${ICONS.copy}Kopiuj adres</button></div>
        <label class="field full"><span>Temat</span><input type="text" id="rm-subj" value="${esc(out.subject)}"></label>
        <label class="field full"><span>Treść</span><textarea id="rm-body" rows="13">${esc(body)}</textarea></label>
      </div>
      <div class="row"><button type="button" class="btn primary sm" id="rm-pdf">${ICONS.down}Pobierz PDF (załącznik)</button><button type="button" class="btn sm" id="rm-copy-subj">${ICONS.copy}Kopiuj temat</button><button type="button" class="btn sm" id="rm-copy-body">${ICONS.copy}Kopiuj treść</button><a class="btn sm" id="rm-open" href="#" target="_blank" rel="noopener">${ICONS.email}Otwórz w programie pocztowym</a></div>
      <p class="note">Dlaczego PDF, a nie HTML w treści: Gmail i Outlook wycinają style i wykresy z HTML-a, a załączniki .html bywają oznaczane jako podejrzane. PDF wygląda u kandydata tak samo jak w podglądzie. Panel nie wysyła maili sam – wyślij ze skrzynki ${esc(offer().email)}.</p>
    </div>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="rm-save">Zapisz jako wysłany</button></div>`, { wide: true });
  const href = () => `mailto:${encodeURIComponent($('#rm-to').value)}?subject=${encodeURIComponent($('#rm-subj').value)}&body=${encodeURIComponent($('#rm-body').value)}`;
  const upd = () => { $('#rm-open').href = href(); };
  upd(); ['rm-to', 'rm-subj', 'rm-body'].forEach(i => { $('#' + i).oninput = upd; });
  $('#rm-copy-to').onclick = () => copyText($('#rm-to').value);
  $('#rm-copy-subj').onclick = () => copyText($('#rm-subj').value);
  $('#rm-copy-body').onclick = () => copyText($('#rm-body').value);
  $('#rm-pdf').onclick = e => downloadReportPdf(id, e.currentTarget);
  $('#rm-save').onclick = () => {
    const to = $('#rm-to').value.trim();
    patch('locations', id, { reportSentAt: todayISO(), reportSentTo: to, updatedTs: new Date().toISOString() });
    if (l) {
      const cur = D().leads[l.id];
      const hist = (cur.history || []).slice();
      hist.push(histEntry('email', `Wysłano raport lokalizacji (PDF): ${x.address || x.city || x.name}`, { by: myMemberId() || cur.ownerId || '', result: 'Wysłano materiały' }));
      const p = { history: hist, updatedTs: new Date().toISOString() };
      if (to && to !== cur.email) p.email = to;
      if (!cur.nextTaskDate || cur.nextTaskDate <= todayISO()) { p.nextTask = 'Omówić raport lokalizacji'; p.nextTaskDate = isoDate(addDays(new Date(), 2)); }
      patch('leads', l.id, p);
    }
    closeModal(); toast('Zapisano wysłanie raportu');
  };
}

/* ---------- automatyczne uzupełnianie „Okolica i popyt” ---------- */
const AUTO_BUSY = {};
function autoInfo(L) {
  if (AUTO_BUSY[L.id]) return `<p class="callout" style="margin-bottom:12px">Claude ustala dane o okolicy dla: ${esc([L.address, L.city].filter(Boolean).join(', '))}…</p>`;
  const a = L.auto;
  if (!a) return L.city ? '' : '<p class="note" style="margin-bottom:10px">Wpisz miasto i ulicę w sekcji „Lokal i kandydat” – pola poniżej uzupełnią się automatycznie.</p>';
  if (a.status === 'error') return `<p class="callout bad" style="margin-bottom:12px">Nie udało się uzupełnić danych: ${esc(a.error || 'błąd')}</p>`;
  const src = (a.sources || []).length ? ` · źródła: ${a.sources.slice(0, 3).map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(String(u).replace(/^https?:\/\/(www\.)?/, '').split('/')[0])}</a>`).join(', ')}` : '';
  return `<div class="callout ${a.confidence === 'niska' ? 'bad' : 'good'}" style="margin-bottom:12px"><b>Uzupełniono automatycznie ${fdt(a.at)}</b> · pewność: ${esc(a.confidence || '—')}${a.forAddress ? ' · ' + esc(a.forAddress) : ''}${src}<br><span class="small">${esc(a.notes || '')}</span><br><span class="tiny muted">${esc(a.source || '')} Sprawdź liczby i popraw je, jeśli znasz okolicę lepiej.</span></div>`;
}
function maybeAutoFill(id) {
  const x = D().locations[id];
  if (!x || !S.sample || !x.city || AUTO_BUSY[id]) return;
  const key = [x.address, x.city].filter(Boolean).join(', ');
  if (x.auto && x.auto.forAddress === key) return;
  autoFillLocation(id);
}
async function autoFillLocation(id, btn) {
  const x = D().locations[id]; if (!x || !S.sample) return;
  const key = [x.address, x.city].filter(Boolean).join(', ');
  AUTO_BUSY[id] = true; scheduleRender();
  const prompt = `Jesteś analitykiem lokalizacji sieci ShipCenter (punkty nadawcze paczek) w Polsce. Dla adresu "${key}"${x.region ? ' (województwo ' + x.region + ')' : ''} ustal dane o okolicy na podstawie swojej wiedzy: dane GUS o mieście i dzielnicach, charakter dzielnicy i ulicy (centrum, osiedle bloków, domy jednorodzinne, strefa przemysłowa, galeria, dworzec). Zwróć wyłącznie obiekt JSON z polami:
{"city": "nazwa miasta", "region": "województwo małymi literami, np. śląskie", "cityPop": liczba mieszkańców miasta lub gminy, "cityAreaKm2": powierzchnia miasta w km2, "district": "dzielnica lub pusty tekst", "catchment": mieszkańcy w promieniu ok. 1,5 km od adresu (gęstość dzielnicy razy ok. 7 km2, nie więcej niż cityPop), "type": jedno z "ulica" | "osiedle" | "galeria" | "park" | "biznes" | "wezel" (ulica = ulica handlowa lub centrum, park = park handlowy lub przy markecie, biznes = strefa biznesowa lub przemysłowa, wezel = dworzec lub węzeł komunikacyjny), "traffic": szacowany ruch pieszy przy lokalu w osobach na dzień (deptak dużego miasta 5000-15000, ulica handlowa 2000-5000, osiedle 500-1500, strefa przemysłowa 200-600), "parking": "brak" | "ograniczony" | "dobry", "firms": szacowana liczba firm w promieniu 3 km regularnie wysyłających paczki (około 1-1,5% podmiotów REGON w tym obszarze, minimum 10), "confidence": "niska" | "średnia" | "wysoka", "notes": "2-3 zdania po polsku: skąd liczby i co jest niepewne, np. czy taka ulica istnieje w tym mieście"}
Liczby podawaj jako liczby całkowite. Jeśli nie znasz ulicy, oprzyj się na mieście, napisz to w notes i ustaw confidence na "niska".`;
  try {
    const r = await S.sample.json(prompt, { modelTier: 'default' });
    const num = (v, lo, hi) => { const n = Math.round(+v); return isFinite(n) ? clamp(n, lo, hi) : null; };
    const cur = D().locations[id]; if (!cur) return;
    const p = { updatedTs: new Date().toISOString() };
    const cityPop = num(r.cityPop, 100, 5000000); if (cityPop) p.cityPop = cityPop;
    const catchment = num(r.catchment, 50, 500000); if (catchment) p.catchment = Math.min(catchment, cityPop || catchment);
    if (LOC_TYPES[r.type]) p.type = r.type;
    const traffic = num(r.traffic, 50, 50000); if (traffic) p.traffic = traffic;
    if (['brak', 'ograniczony', 'dobry'].includes(r.parking)) p.parking = r.parking;
    const firms = num(r.firms, 1, 20000); if (firms) p.firms = firms;
    const reg = String(r.region || '').toLowerCase().replace('województwo', '').trim();
    if (REGIONS.includes(reg) && !cur.region) p.region = reg;
    if (r.city && !cur.city) p.city = String(r.city);
    p.auto = { status: 'done', at: nowLocal(), forAddress: key, confidence: ['niska', 'średnia', 'wysoka'].includes(r.confidence) ? r.confidence : 'średnia', notes: String(r.notes || '').slice(0, 600) + (r.district ? ` Dzielnica: ${r.district}.` : '') + (r.cityAreaKm2 ? ` Powierzchnia miasta ok. ${fmt(+r.cityAreaKm2)} km².` : ''), source: 'Źródło: wiedza Claude (dane GUS i charakter okolicy, bez wyszukiwania na żywo).' };
    if (reg && cur.region && REGIONS.includes(reg) && reg !== cur.region) p.auto.notes += ` Uwaga: adres wskazuje na województwo ${reg}, a w analizie wpisano ${cur.region}.`;
    await patch('locations', id, p);
    toast('Uzupełniono dane o okolicy');
  } catch (e) {
    const code = e && e.code;
    if (code === 'not_granted') { S.sample = null; toast('Claude nie ma zgody na odpowiedzi w tym panelu – uzupełnij dane ręcznie.', 'bad'); }
    else if (code === 'rate_limited') toast('Za dużo zapytań do Claude – spróbuj za chwilę.', 'bad');
    else patch('locations', id, { auto: { status: 'error', at: nowLocal(), forAddress: key, error: (e && e.message) || 'brak odpowiedzi' } });
  } finally { delete AUTO_BUSY[id]; scheduleRender(); }
}

/* ---------- karta „Przychód punktu” z suwakami ---------- */
function revenueCard(x, r) {
  const L = r.L, base = r.fin.base;
  const maxRev = Math.max(1, ...base.lines.map(l => l.revenue));
  const rows = REV_ITEMS.map((it, i) => {
    const val = it.k === 'parcels' ? r.P : (+L.rev[it.k] || 0);
    const auto = it.k === 'parcels' && (L.rev.parcels == null || L.rev.parcels === '');
    return `<div class="revrow"><div class="top"><div><b>${it.n}</b><div class="small muted">${it.d} · średnio ${zl(+L.a[it.p], it.k === 'pickups' ? 2 : 0)}</div></div><span class="badge" id="rv-n-${it.k}">${fmt(val)} / mies.</span></div>
      <input type="range" id="rv-${it.k}" data-rev="${it.k}" min="0" max="${Math.max(it.max, val)}" step="${it.step}" value="${val}" aria-label="${it.n} miesięcznie">
      <div class="mm"><span>0</span>${it.k === 'parcels' ? `<span>${auto ? 'szacunek popytu z analizy' : `szacunek z analizy: ${fmt(r.demand.base)} · <a data-act="rev-auto" data-id="${x.id}" style="cursor:pointer">przywróć</a>`}</span>` : ''}<span>${fmt(Math.max(it.max, val))} / mies.</span></div></div>`;
  }).join('');
  const lines = base.lines.map(l => `<div class="rline"><div class="row between"><span>${esc(l.n)}</span><b id="rv-r-${l.k}">${zl(l.revenue)}</b></div><div class="rbar"><i id="rv-b-${l.k}" style="width:${l.revenue / maxRev * 100}%"></i></div></div>`).join('');
  return `<div class="card"><div class="cardhead"><h2>Przychód punktu</h2><p>jak w kalkulatorze na shipcenter.pl</p></div>
    <div class="revgrid"><div>${rows}</div>
    <div class="revbox"><span class="revlbl">Szacowany przychód punktu</span><div class="revbig"><span id="rv-total">${zl(base.revenue)}</span> <small>/ mies.</small></div><p>W skali roku to około <b id="rv-year">${zl(base.revenue * 12)}</b>.</p>${lines}</div></div>
    <p class="note" style="margin-top:10px">Szacunkowy przychód ze sprzedaży przed odjęciem kosztów usług i prowadzenia punktu. Wynik zależy od liczby i rodzaju zamówień i nie jest gwarantowany. Ceny średnie i marże zmienisz w „Założeniach modelu”.</p></div>`;
}
function onRevInput(el, final) {
  const id = S.route.id; const x = D().locations[id]; if (!x) return;
  const nx = clone(x); nx.rev = { ...LOC_DEFAULTS.rev, ...(nx.rev || {}), [el.dataset.rev]: +el.value }; nx.updatedTs = new Date().toISOString();
  D().locations[id] = nx;
  const r = analyzeLocation(nx);
  const b = $('#rv-n-' + el.dataset.rev); if (b) b.textContent = fmt(+el.value) + ' / mies.';
  const maxRev = Math.max(1, ...r.fin.base.lines.map(l => l.revenue));
  r.fin.base.lines.forEach(l => { const v = $('#rv-r-' + l.k); if (v) v.textContent = zl(l.revenue); const bar = $('#rv-b-' + l.k); if (bar) bar.style.width = (l.revenue / maxRev * 100) + '%'; });
  const t = $('#rv-total'); if (t) t.textContent = zl(r.fin.base.revenue);
  const yv = $('#rv-year'); if (yv) yv.textContent = zl(r.fin.base.revenue * 12);
  if (final) { scheduleRender(); debounce('loc-save-' + id, () => { const cur = D().locations[id]; if (cur) put('locations', id, cur); }, 600); }
}
