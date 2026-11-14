/* ===== Plan i budżet: warianty, model kanałów, wydatki ===== */

function planDraft() {
  const plans = D().plans;
  if (!S.planSel || !plans[S.planSel]) S.planSel = (activePlan() || {}).id;
  return plans[S.planSel] || null;
}

function viewPlan() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie planów…</div>`;
  const plans = Object.values(D().plans).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const activeId = (activePlan() || {}).id;
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Planowanie i skalowanie</span><h1>Plan i budżet</h1>
    <p>Budżet 15–30 tys. zł miesięcznie, cel 2–3 nowe punkty miesięcznie. Zmieniaj podział budżetu, koszty leada i konwersje – wynik liczy się na bieżąco i zapisuje w wariancie.</p></div>
    <div class="actions"><button class="btn" data-act="plan-new">${ICONS.plus}Nowy wariant</button></div></div>`;
  if (!plans.length) {
    return head + `<div class="card"><div class="empty"><h3>Brak zapisanych wariantów planu</h3><p>Utwórz trzy warianty startowe (15, 22,5 i 30 tys. zł) albo zacznij od pustego planu.</p>
      <div class="actions" style="justify-content:center"><button class="btn primary" data-act="plan-seed">Utwórz warianty 15 / 22,5 / 30 tys. zł</button><button class="btn" data-act="plan-new">Pusty wariant</button></div></div></div>`;
  }
  const p = planDraft();
  const c = computePlan(p);
  const list = `<div class="grid3" style="gap:8px;grid-template-columns:repeat(auto-fill,minmax(min(100%,230px),1fr))">${plans.map(x => { const cx = computePlan(x); return `<button class="variant ${x.id === p.id ? 'sel' : ''}" data-act="plan-sel" data-id="${x.id}">
      <span class="row between"><span class="vn">${esc(x.name)}</span>${x.id === activeId ? '<span class="pill good">aktywny</span>' : ''}</span>
      <span class="small ink2 num">${zl(x.budget)} / mies. · cel ${fmt(x.target, 1)} pkt</span>
      <span class="small num"><b>${fmt(cx.points, 1)}</b> pkt/mies. · CAC ${zl(cx.cac)}</span></button>`; }).join('')}</div>`;

  const below = c.points < c.target;
  const editor = `<div class="card"><div class="cardhead"><h2>Wariant: ${esc(p.name)}</h2>
      <div class="actions">${p.id !== activeId ? `<button class="btn sm primary" data-act="plan-activate" data-id="${p.id}">Ustaw jako aktywny</button>` : '<span class="pill good">Plan aktywny – dashboard porównuje do niego</span>'}
      <button class="btn sm" data-act="plan-dup" data-id="${p.id}">Duplikuj</button><button class="btn sm danger" data-act="plan-del" data-id="${p.id}" ${plans.length < 2 ? 'disabled' : ''}>${ICONS.trash}</button></div></div>
    <div class="formgrid">
      <label class="field span2"><span>Nazwa wariantu</span><input type="text" id="pl-name" data-plan="name" value="${esc(p.name)}"></label>
      <label class="field"><span>Start 90 dni</span><input type="date" id="pl-start" data-plan="startDate" value="${esc(p.startDate)}"></label>
      <label class="field"><span>Średni cykl sprzedaży (dni)</span><input type="number" id="pl-cycle" data-plan="cycleDays" min="14" max="180" step="1" value="${esc(p.cycleDays)}"><span class="hint">od leada do podpisania umowy</span></label>
    </div>
    <div class="grid2" style="margin-top:14px">
      <label class="field"><span>Budżet miesięczny: <b class="num" id="pl-budget-out">${zl(p.budget)}</b></span>
        <div class="rangewrap"><div class="rangeband" style="left:${(15000 - 5000) / 35000 * 100}%;width:${15000 / 35000 * 100}%"></div><input type="range" id="pl-budget-r" data-plan="budget" min="5000" max="40000" step="500" value="${esc(p.budget)}"></div>
        <span class="hint">Pomarańczowy pas: zakres 15–30 tys. zł</span></label>
      <label class="field"><span>Cel: nowe punkty miesięcznie: <b class="num" id="pl-target-out">${fmt(p.target, 1)}</b></span>
        <div class="rangewrap"><div class="rangeband" style="left:${(2 - 0.5) / 5.5 * 100}%;width:${1 / 5.5 * 100}%"></div><input type="range" id="pl-target-r" data-plan="target" min="0.5" max="6" step="0.5" value="${esc(p.target)}"></div>
        <span class="hint">Pomarańczowy pas: cel 2–3 punkty</span></label>
    </div>
    <div class="sep"></div>
    <div class="row between"><h3>Podział budżetu na kanały</h3><span class="small ${Math.abs(c.mixSum - 100) > 0.5 ? 'overdue' : 'muted'}">Suma udziałów: ${fmt(c.mixSum, 1)}% ${Math.abs(c.mixSum - 100) > 0.5 ? `<button class="btn sm" data-act="plan-normalize">Wyrównaj do 100%</button>` : ''}</span></div>
    <div class="tablewrap" style="margin-top:8px"><table class="t"><thead><tr><th>Kanał</th><th class="r">Udział %</th><th class="r">CPL (zł)</th><th class="r">Budżet</th><th class="r">Leady / mies.</th><th class="r">Punkty / mies.</th></tr></thead><tbody>
    ${c.rows.map((r, i) => `<tr><td>${sourcePill(r.k)}</td>
      <td class="r"><input type="number" id="pl-mix-${r.k}" data-plan-mix="${r.k}" min="0" max="100" step="1" value="${esc(r.share)}" style="width:76px;text-align:right"></td>
      <td class="r"><input type="number" id="pl-cpl-${r.k}" data-plan-cpl="${r.k}" min="1" step="5" value="${esc(r.cpl)}" style="width:86px;text-align:right"></td>
      <td class="r" id="pl-row-spend-${r.k}">${zl(r.spend)}</td><td class="r" id="pl-row-leads-${r.k}">${fmt(r.leads, 1)}</td><td class="r" id="pl-row-pts-${r.k}">${fmt(r.leads * c.overall, 2)}</td></tr>`).join('')}
    </tbody><tfoot><tr><td>Razem</td><td class="r">${fmt(c.mixSum, 1)}%</td><td class="r">${zl(c.cplBlend)}</td><td class="r">${zl(c.budget * c.mixSum / 100)}</td><td class="r">${fmt(c.leads, 1)}</td><td class="r">${fmt(c.points, 2)}</td></tr></tfoot></table></div>
    <div class="sep"></div>
    <h3>Konwersja między etapami</h3>
    <div class="formgrid" style="margin-top:8px">${CONV_LABELS.map((lab, i) => `<label class="field"><span>${lab}</span><input type="number" id="pl-conv-${i}" data-plan-conv="${i}" min="1" max="100" step="1" value="${Math.round((c.conv[i] || 0) * 100)}"><span class="hint">%</span></label>`).join('')}</div>
    <div class="row" style="margin-top:8px"><button class="btn sm" data-act="plan-conv-actual" ${leadsArr().length >= 20 ? '' : 'disabled'} title="Wymaga min. 20 leadów">Wczytaj konwersje z danych</button><span class="note">Przenosi rzeczywiste konwersje lejka (wszystkie leady) do wariantu.</span></div>
  </div>`;

  const results = `<div class="card ${below ? '' : ''}" id="plan-results"><div class="cardhead"><h2>Wynik wariantu</h2><p>Stan ustalony – po rozruchu</p></div>
    <div class="grid2" style="gap:12px">
      <div><span class="eyebrow">Nowe punkty / mies.</span><div class="bigout" style="color:var(${below ? '--bad-ink' : '--good-ink'})">${fmt(c.points, 1)}</div><span class="small ink2">cel ${fmt(c.target, 1)} · ${below ? 'poniżej celu' : 'cel osiągalny'}</span></div>
      <div><span class="eyebrow">Koszt pozyskania punktu</span><div class="bigout">${zl(c.cac)}</div><span class="small ink2">CPL ${zl(c.cplBlend)} · konwersja ${pct(c.overall, 2)}</span></div>
    </div>
    <div class="sep"></div>
    <div class="statline"><span>Leady miesięcznie</span><b>${fmt(c.leads)}</b></div>
    <div class="statline"><span>Spotkania miesięcznie</span><b>${fmt(c.stageCounts[3], 1)}</b></div>
    <div class="statline"><span>Analizy lokalizacji miesięcznie</span><b>${fmt(c.stageCounts[4], 1)}</b></div>
    <div class="statline"><span>Potrzebne leady na cel ${fmt(c.target, 1)} pkt</span><b>${fmt(c.reqLeads)}</b></div>
    <div class="statline"><span>Potrzebny budżet na cel (przy tym CPL)</span><b>${zl(c.reqBudget)}</b></div>
    <div class="sep"></div>
    ${below ? `<div class="callout bad">Przy tym budżecie i konwersjach wychodzi ${fmt(c.points, 1)} punktu miesięcznie. Brakuje ${fmt(c.reqLeads - c.leads)} leadów (ok. ${zl(Math.max(0, c.reqBudget - c.budget))} budżetu) albo poprawy konwersji o ${pct(c.target / Math.max(c.points, 0.01) - 1)}.</div>`
      : `<div class="callout good">Wariant daje zapas ${fmt(c.points - c.target, 1)} punktu nad celem. Nadwyżkę budżetu (${zl(Math.max(0, c.budget - c.reqBudget))}) można przenieść do kanałów z najniższym kosztem punktu.</div>`}
    <div class="sep"></div>
    <h3>Pierwsze 90 dni (z opóźnieniem cyklu sprzedaży)</h3>
    <div class="tablewrap" style="margin-top:8px"><table class="t"><thead><tr><th></th><th class="r">M1</th><th class="r">M2</th><th class="r">M3</th><th class="r">Razem</th></tr></thead><tbody>
      ${[['Leady', 'leads', 0], ['Spotkania', 'meetings', 0], ['Analizy lokalizacji', 'analyses', 1], ['Nowe punkty', 'points', 1]].map(([n, k, d]) => `<tr><td>${n}</td>${c.months.map(m => `<td class="r">${fmt(m[k], d)}</td>`).join('')}<td class="r"><b>${fmt(sum(c.months, m => m[k]), d)}</b></td></tr>`).join('')}
      <tr><td>Budżet</td>${c.months.map(m => `<td class="r">${zl(m.spend)}</td>`).join('')}<td class="r"><b>${zl(c.budget * 3)}</b></td></tr>
    </tbody></table></div>
    <p class="note" style="margin-top:6px">M1 zakłada 80% skuteczności kampanii (okres uczenia się reklam). Leady z bieżącego lejka nie są tu wliczone – są w prognozie na dashboardzie.</p>
    <div class="sep"></div>
    <h3>Wrażliwość na budżet</h3>
    <div class="tablewrap" style="margin-top:8px"><table class="t"><thead><tr><th>Budżet / mies.</th><th class="r">Leady</th><th class="r">Punkty / mies.</th><th class="r">CAC</th></tr></thead><tbody>
      ${[15000, 20000, 22500, 25000, 30000].map(bud => { const cc = computePlan({ ...p, budget: bud }); return `<tr class="${bud === +p.budget ? 'today' : ''}"><td>${zl(bud)}</td><td class="r">${fmt(cc.leads)}</td><td class="r"><b>${fmt(cc.points, 1)}</b></td><td class="r">${zl(cc.cac)}</td></tr>`; }).join('')}
    </tbody></table></div>
  </div>`;

  // porównanie wariantów
  const comp = plans.map(x => ({ x, c: computePlan(x) }));
  const compare = `<div class="card"><div class="cardhead"><h2>Porównanie wariantów</h2></div><div class="tablewrap"><table class="t"><thead><tr><th>Wskaźnik</th>${comp.map(v => `<th class="r">${esc(v.x.name)}${v.x.id === activeId ? ' ●' : ''}</th>`).join('')}</tr></thead><tbody>
    ${[['Budżet / mies.', v => zl(v.c.budget)], ['Cel punktów / mies.', v => fmt(v.c.target, 1)], ['Leady / mies.', v => fmt(v.c.leads)], ['CPL (średni)', v => zl(v.c.cplBlend)], ['Konwersja lead → umowa', v => pct(v.c.overall, 2)], ['Punkty / mies. (model)', v => `<b>${fmt(v.c.points, 1)}</b>`], ['Koszt pozyskania punktu', v => zl(v.c.cac)], ['Punkty w 90 dni', v => fmt(sum(v.c.months, m => m.points), 1)], ['Budżet 90 dni', v => zl(v.c.budget * 3)]].map(([n, f]) => `<tr><td>${n}</td>${comp.map(v => `<td class="r">${f(v)}</td>`).join('')}</tr>`).join('')}
  </tbody></table></div></div>`;

  return head + `<div class="stack"><div class="stack" style="gap:8px"><span class="eyebrow">Warianty planu – kliknij, aby edytować</span>${list}</div><div class="split">${editor}${results}</div>${compare}${spendSection(p)}</div>`;
}

/* aktualizacja pól wariantu – przelicz lokalnie, zapisz po pauzie */
function onPlanInput(el, isFinal = false) {
  const p = planDraft(); if (!p) return;
  const np = clone(p);
  if (el.dataset.plan) {
    const k = el.dataset.plan;
    np[k] = ['budget', 'target', 'cycleDays'].includes(k) ? +el.value : el.value;
  } else if (el.dataset.planMix) { np.mix = { ...(np.mix || {}), [el.dataset.planMix]: +el.value || 0 }; }
  else if (el.dataset.planCpl) { np.cpl = { ...(np.cpl || {}), [el.dataset.planCpl]: +el.value || 0 }; }
  else if (el.dataset.planConv) { const conv = (np.conv || DEFAULT_CONV).slice(); conv[+el.dataset.planConv] = clamp((+el.value || 0) / 100, 0, 1); np.conv = conv; }
  D().plans[p.id] = np; // podgląd natychmiast
  if (el.type === 'range') {
    const out = el.id === 'pl-budget-r' ? $('#pl-budget-out') : $('#pl-target-out');
    if (out) out.textContent = el.id === 'pl-budget-r' ? zl(+el.value) : fmt(+el.value, 1);
  }
  if (el.type !== 'range' || isFinal) debounce('plan-render', () => scheduleRender(), 250);
  debounce('plan-save-' + p.id, () => { const cur = D().plans[p.id]; if (cur) put('plans', p.id, cur); }, 900);
}

function makePlan(over = {}) {
  return { id: uid('p'), name: 'Nowy wariant', budget: 22500, target: 2.5, startDate: todayISO(), cycleDays: 60, mix: { ...DEFAULT_MIX }, cpl: Object.fromEntries(SOURCES.map(s => [s.k, s.cpl])), conv: [...DEFAULT_CONV], createdAt: new Date().toISOString(), ...over };
}
function seedPlans() {
  const start = isoDate(mondayOf(addDays(new Date(), 2)));
  const a = makePlan({ name: 'Start – 15 tys. zł', budget: 15000, target: 2, startDate: start, mix: { meta: 40, google: 15, portale: 15, linkedin: 0, polecenia: 10, targi: 0, www: 6, webinar: 6, outbound: 8, inne: 0 } });
  const b = makePlan({ name: 'Bazowy – 22,5 tys. zł', budget: 22500, target: 2.5, startDate: start, createdAt: new Date(Date.now() + 1).toISOString() });
  const c = makePlan({ name: 'Skalowanie – 30 tys. zł', budget: 30000, target: 3, startDate: start, mix: { meta: 32, google: 22, portale: 14, linkedin: 7, polecenia: 7, targi: 8, www: 3, webinar: 4, outbound: 3, inne: 0 }, createdAt: new Date(Date.now() + 2).toISOString() });
  [a, b, c].forEach(x => put('plans', x.id, x));
  saveSettings({ activePlanId: b.id });
  S.planSel = b.id;
}

/* ---------- wydatki ---------- */
function spendSection(plan) {
  const all = Object.values(D().spend).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const wins = planWindows(plan);
  const pc = computePlan(plan);
  const perM = wins.map(([a, b]) => sum(all.filter(x => inRange(x.date, a, b)), x => x.amount));
  const bySrc = SOURCES.map(s => ({ s, plan: pc.rows.find(r => r.k === s.k).spend * 3, act: sum(all.filter(x => x.source === s.k && wins.some(([a, b]) => inRange(x.date, a, b))), x => x.amount) })).filter(r => r.plan || r.act);
  return `<div class="card"><div class="cardhead"><h2>Wydatki marketingowe – wykonanie budżetu</h2><p>Na ich podstawie liczony jest rzeczywisty CPL i koszt punktu</p></div>
    <div class="formgrid">
      <label class="field"><span>Data</span><input type="date" id="sp-date" value="${todayISO()}"></label>
      <label class="field"><span>Kanał</span><select id="sp-source">${sourceOpts('meta')}</select></label>
      <label class="field"><span>Kwota netto (zł)</span><input type="number" id="sp-amount" min="0" step="10" placeholder="np. 2500"></label>
      <label class="field"><span>Opis</span><input type="text" id="sp-note" placeholder="np. kampania lead form – tydzień 1"></label>
    </div>
    <div class="row" style="margin-top:8px"><button class="btn sm primary" data-act="spend-add">${ICONS.plus}Dodaj wydatek</button></div>
    <div class="sep"></div>
    <div class="grid2">
      <div><h3>Miesiące planu</h3><div class="subbars" style="margin-top:8px">${perM.map((v, i) => `<div class="subbar" data-tip="${esc('M' + (i + 1) + ': ' + zl(v) + ' z ' + zl(plan.budget))}"><span class="small">M${i + 1} · ${fdateShort(isoDate(wins[i][0]))}</span><div class="track"><i style="width:${clamp(v / Math.max(1, plan.budget) * 100, 0, 100)}%;background:var(${v > plan.budget ? '--s2' : '--s1'})"></i></div><span class="small num">${pct(v / Math.max(1, plan.budget))}</span></div>`).join('')}</div></div>
      <div><h3>Kanały – 90 dni</h3><div class="tablewrap" style="margin-top:8px"><table class="t"><thead><tr><th>Kanał</th><th class="r">Plan</th><th class="r">Wydano</th></tr></thead><tbody>${bySrc.map(r => `<tr><td>${esc(r.s.n)}</td><td class="r muted">${zl(r.plan)}</td><td class="r">${zl(r.act)}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Brak danych</td></tr>'}</tbody></table></div></div>
    </div>
    ${all.length ? `<div class="sep"></div><div class="tablewrap"><table class="t"><thead><tr><th>Data</th><th>Kanał</th><th>Opis</th><th class="r">Kwota</th><th></th></tr></thead><tbody>${all.slice(0, S.ui.spendAll ? 400 : 12).map(x => `<tr><td>${fdate(x.date)}</td><td>${esc(SOURCE_MAP[x.source]?.n || x.source)}</td><td class="small">${esc(x.note || '')}</td><td class="r">${zl(x.amount)}</td><td><button class="iconbtn" data-act="spend-del" data-id="${x.id}" aria-label="Usuń">${ICONS.trash}</button></td></tr>`).join('')}</tbody></table></div>${all.length > 12 ? `<div class="row" style="margin-top:8px"><button class="btn sm ghost" data-act="spend-all">${S.ui.spendAll ? 'Zwiń listę' : 'Pokaż wszystkie (' + all.length + ')'}</button><span class="note">Pełna lista jest też w eksporcie XLSX.</span></div>` : ''}` : ''}
  </div>`;
}

/* ===== Harmonogram 90 dni ===== */
const ROADMAP_PHASES = [
  { n: 'Przygotowanie', w: [1, 2], c: '--s7' },
  { n: 'Generowanie i kwalifikacja', w: [3, 6], c: '--s1' },
  { n: 'Domykanie umów', w: [7, 10], c: '--s3' },
  { n: 'Skalowanie i podsumowanie', w: [11, 13], c: '--s2' }
];
const ROADMAP_TEMPLATE = [
  [1, 'sprz', 'Profil idealnego franczyzobiorcy i kryteria kwalifikacji (kapitał, lokal, czas, motywacja)'],
  [1, 'mkt', 'Landing page franczyzy z formularzem i pytaniami kwalifikacyjnymi (miasto, kapitał, lokal)'],
  [1, 'anl', 'Piksele Meta i Google, tagi UTM dla każdego źródła, import leadów do panelu'],
  [1, 'lok', 'Mapa białych plam: 30 miast bez punktu Ship Center (z zachowaniem 3 km od istniejących)'],
  [2, 'mkt', 'Start kampanii Meta Ads (formularz kontaktowy) i Google Ads („franczyza kurierska”, „własny biznes”)'],
  [2, 'mkt', 'Profile na portalach franczyzowych: opis oferty, koszty (12 000 zł netto), zdjęcia punktów'],
  [2, 'sprz', 'Skrypty rozmów i szablony wiadomości; zasada: kontakt z nowym leadem w ciągu 2 godzin roboczych'],
  [2, 'mkt', 'Program poleceń dla obecnych franczyzobiorców (premia za podpisaną umowę)'],
  [3, 'anl', 'Pierwszy przegląd CPL per kanał – wyłączenie reklam z CPL ponad 2× plan'],
  [3, 'sprz', 'Codzienna kwalifikacja nowych leadów i umawianie prezentacji online'],
  [4, 'mkt', 'Webinar #1 „Jak otworzyć punkt Ship Center” + nagranie do follow-upów'],
  [4, 'sprz', 'Prezentacje online modelu biznesowego dla zakwalifikowanych kandydatów'],
  [5, 'lok', 'Analizy lokalizacji i raporty dla kandydatów po spotkaniu'],
  [5, 'mkt', 'Outbound i LinkedIn do właścicieli sklepów i punktów usługowych (model Partner)'],
  [6, 'anl', 'Raport 6 tygodni: konwersje etapów vs plan, korekta podziału budżetu'],
  [6, 'sprz', 'Dzień otwarty w centrali w Katowicach / wizyta w działającym punkcie'],
  [7, 'sprz', 'Oferty i projekty umów dla kandydatów z pozytywną analizą lokalizacji'],
  [7, 'mkt', 'Skalowanie kanałów z najniższym kosztem punktu (+20% budżetu)'],
  [8, 'mkt', 'Webinar #2 z udziałem działającego franczyzobiorcy (case study)'],
  [8, 'lok', 'Weryfikacja lokali z kandydatami: czynsz, witryna, ruch pieszy, parking'],
  [9, 'sprz', 'Podpisanie pierwszych umów i planowanie szkoleń wstępnych (3–4 dni, Katowice)'],
  [10, 'sprz', 'Przegląd lejka: leady bez kontaktu 7+ dni, reaktywacja wstrzymanych'],
  [10, 'anl', 'Przegląd prognozy: czy lejek pokrywa cel 2–3 punktów na kolejne 2 miesiące'],
  [11, 'lok', 'Onboarding nowych punktów – uruchomienie do 1 miesiąca od podpisania umowy'],
  [11, 'mkt', 'Testy nowych kreacji i grup odbiorców; odświeżenie landing page'],
  [12, 'anl', 'Decyzja o budżecie na kolejny kwartał (wariant 15 / 22,5 / 30 tys. zł)'],
  [13, 'anl', 'Raport 90 dni: plan a wykonanie, koszt pozyskania punktu, rekomendacje'],
  [13, 'sprz', 'Plan działań na kolejne 90 dni i cele dla opiekunów']
];
function roadmapTasks() { return Object.values(D().tasks).filter(t => t.kind === 'plan90'); }
function seedRoadmap() {
  ROADMAP_TEMPLATE.forEach(([w, s, t], i) => {
    const id = 'r' + pad(w) + '-' + pad(i);
    put('tasks', id, { kind: 'plan90', week: w, stream: s, title: t, ownerId: '', done: false, order: i, createdAt: new Date().toISOString() });
  });
}
function planWeekOf(plan, date = new Date()) {
  const s = parseD(plan.startDate) || new Date();
  return Math.floor(daysBetween(s, date) / 7) + 1;
}
function viewRoadmap() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie harmonogramu…</div>`;
  const plan = activePlan();
  const tasks = roadmapTasks();
  const start = parseD(plan.startDate) || new Date();
  const curW = planWeekOf(plan);
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Plan aktywny: ${esc(plan.name)}</span><h1>Harmonogram 90 dni</h1>
    <p>Od ${fdate(plan.startDate)} do ${fdate(isoDate(addDays(start, 90)))}. ${curW >= 1 && curW <= 13 ? `Trwa <b>tydzień ${curW}</b>.` : curW < 1 ? `Start za ${daysBetween(new Date(), start)} dni.` : 'Okres planu minął – zmień datę startu w planie.'} Datę startu zmienisz w zakładce „Plan i budżet”.</p></div>
    <div class="actions"><button class="btn" data-act="rm-add">${ICONS.plus}Dodaj działanie</button></div></div>`;
  if (!tasks.length) return head + `<div class="card"><div class="empty"><h3>Harmonogram jest pusty</h3><p>Utwórz 13-tygodniowy plan działań z szablonu: marketing, sprzedaż, lokalizacje i analityka – ${ROADMAP_TEMPLATE.length} działań do edycji i przypisania.</p><button class="btn primary" data-act="rm-seed">Utwórz harmonogram z szablonu</button></div></div>`;
  const done = tasks.filter(t => t.done).length;
  const nowPos = clamp((daysBetween(start, new Date()) / 91) * 100, 0, 100);
  const gantt = `<div class="card"><div class="cardhead"><h2>Fazy</h2><p>${done} z ${tasks.length} działań wykonanych (${pct(done / tasks.length)})</p></div>
    <div class="weekticks">${Array.from({ length: 13 }, (_, i) => `<span>T${i + 1}</span>`).join('')}</div>
    <div class="gantt">${ROADMAP_PHASES.map(p => `<div class="ph" style="grid-column:${p.w[0]} / ${p.w[1] + 1};background:var(${p.c})" title="${esc(p.n)}">${esc(p.n)}</div>`).join('')}${curW >= 1 && curW <= 13 ? `<span class="now" style="left:${nowPos}%"></span>` : ''}</div>
    <div class="legend">${Object.entries(STREAMS).map(([k, n]) => `<span><i style="background:var(${STREAM_COLOR[k]})"></i>${n}: ${tasks.filter(t => t.stream === k && t.done).length}/${tasks.filter(t => t.stream === k).length}</span>`).join('')}</div></div>`;
  const weeks = Array.from({ length: 13 }, (_, i) => i + 1).map(w => {
    const items = tasks.filter(t => +t.week === w).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    const ws = addDays(start, (w - 1) * 7);
    const ph = ROADMAP_PHASES.find(p => w >= p.w[0] && w <= p.w[1]);
    return `<div class="weekgroup ${w === curW ? 'current' : ''}"><div class="weeklabel"><b>Tydzień ${w}</b><span class="small muted">${fdateShort(isoDate(ws))} – ${fdateShort(isoDate(addDays(ws, 6)))}</span><br><span class="tiny muted">${esc(ph ? ph.n : '')}</span></div>
      <div>${items.map(t => roadmapRow(t)).join('') || '<span class="muted small">Brak działań</span>'}</div></div>`;
  }).join('');
  return head + gantt + `<div style="height:16px"></div><div class="card">${weeks}</div>`;
}
function roadmapRow(t) {
  return `<div class="taskrow ${t.done ? 'done' : ''}"><input type="checkbox" data-act="task-toggle" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Wykonane">
    <div class="tt"><span class="pill outline"><span class="sw" style="background:var(${STREAM_COLOR[t.stream] || '--muted'})"></span>${esc(STREAMS[t.stream] || 'Inne')}</span> ${esc(t.title)}</div>
    <div class="ctl"><select id="rm-owner-${t.id}" data-task-owner="${t.id}" aria-label="Osoba odpowiedzialna">${ownerOpts(t.ownerId, false, '— kto? —')}</select><button class="iconbtn" data-act="task-edit" data-id="${t.id}" title="Edytuj" aria-label="Edytuj">${ICONS.notatka}</button><button class="iconbtn" data-act="task-del" data-id="${t.id}" title="Usuń" aria-label="Usuń">${ICONS.trash}</button></div></div>`;
}
function openTaskModal(t = null, defaults = {}) {
  const isNew = !t;
  t = t || { id: uid('t'), kind: defaults.kind || 'weekly', title: '', ownerId: '', done: false, week: defaults.week || 1, stream: 'sprz', due: defaults.due || todayISO(), leadId: '', createdAt: new Date().toISOString() };
  const isRm = t.kind === 'plan90';
  openModal(`<div class="mh"><h2>${isNew ? 'Nowe' : 'Edytuj'} ${isRm ? 'działanie w harmonogramie' : 'zadanie'}</h2><button class="iconbtn" data-act="modal-close" aria-label="Zamknij">${ICONS.x}</button></div>
    <form class="mb" id="task-form"><div class="formgrid">
      <label class="field full"><span>Treść</span><input type="text" id="tf-title" value="${esc(t.title)}" required></label>
      ${isRm ? `<label class="field"><span>Tydzień planu</span><select id="tf-week">${Array.from({ length: 13 }, (_, i) => opt(i + 1, 'Tydzień ' + (i + 1), t.week)).join('')}</select></label>
      <label class="field"><span>Obszar</span><select id="tf-stream">${Object.entries(STREAMS).map(([k, n]) => opt(k, n, t.stream)).join('')}</select></label>`
      : `<label class="field"><span>Termin</span><input type="date" id="tf-due" value="${esc(t.due)}"></label>
      <label class="field"><span>Lead (opcjonalnie)</span><select id="tf-lead">${opt('', '— brak —', t.leadId)}${leadsArr().filter(isOpen).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl')).map(l => opt(l.id, l.name + (l.city ? ' – ' + l.city : ''), t.leadId)).join('')}</select></label>`}
      <label class="field"><span>Osoba</span><select id="tf-owner">${ownerOpts(t.ownerId, false, '— nieprzypisane —')}</select></label>
    </div></form>
    <div class="mf"><button class="btn" data-act="modal-close">Anuluj</button><button class="btn primary" id="tf-save">Zapisz</button></div>`);
  const save = () => {
    const title = $('#tf-title').value.trim();
    if (!title) { toast('Wpisz treść zadania.', 'bad'); return; }
    const n = { ...t, title, ownerId: $('#tf-owner').value };
    if (isRm) { n.week = +$('#tf-week').value; n.stream = $('#tf-stream').value; }
    else { n.due = $('#tf-due').value; n.leadId = $('#tf-lead').value; }
    put('tasks', n.id, n); closeModal(); toast('Zapisano');
  };
  $('#tf-save').onclick = save;
  $('#task-form').onsubmit = e => { e.preventDefault(); save(); };
}

/* ===== Zadania tygodnia ===== */
function viewTasks() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie zadań…</div>`;
  const plan = activePlan();
  const ws = addDays(mondayOf(new Date()), S.weekOffset * 7);
  const we = addDays(ws, 7);
  const pw = planWeekOf(plan, ws);
  const owner = S.ui.taskOwner || '';
  const byOwner = x => !owner || (owner === '_none' ? !x.ownerId : x.ownerId === owner);
  const weekly = Object.values(D().tasks).filter(t => t.kind === 'weekly' && inRange(t.due, ws, we) && byOwner(t)).sort((a, b) => (a.done - b.done) || (a.due || '').localeCompare(b.due || ''));
  const overdueWeekly = S.weekOffset === 0 ? Object.values(D().tasks).filter(t => t.kind === 'weekly' && !t.done && t.due && parseD(t.due) < ws && byOwner(t)) : [];
  const rm = roadmapTasks().filter(t => +t.week === pw && byOwner(t));
  const open = leadsArr().filter(isOpen).filter(byOwner);
  const leadTasks = open.filter(l => l.nextTaskDate && (inRange(l.nextTaskDate, ws, we) || (S.weekOffset === 0 && l.nextTaskDate < isoDate(ws)))).sort((a, b) => a.nextTaskDate.localeCompare(b.nextTaskDate));
  const meetings = open.filter(l => inRange(l.meetingAt, ws, we)).sort((a, b) => a.meetingAt.localeCompare(b.meetingAt));
  const handoffs = leadsArr().flatMap(l => (l.handoffs || []).filter(h => inRange(h.date, ws, we)).map(h => ({ ...h, l })));
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Plan tygodnia${pw >= 1 && pw <= 13 ? ' · tydzień ' + pw + ' z 13' : ''}</span><h1>Zadania tygodnia</h1>
    <p>${fdate(isoDate(ws))} – ${fdate(isoDate(addDays(ws, 6)))}</p></div>
    <div class="actions"><button class="btn" data-act="week-shift" data-d="-1">← Poprzedni</button>${S.weekOffset ? `<button class="btn" data-act="week-shift" data-d="0">Bieżący</button>` : ''}<button class="btn" data-act="week-shift" data-d="1">Następny →</button>
    <label class="field" style="width:180px"><span>Osoba</span><select id="task-owner-f" data-act-change="task-owner-f">${ownerOpts(owner, true)}</select></label></div></div>
    <div class="row" style="margin-bottom:16px"><button class="btn primary" data-act="week-generate">${ICONS.spark}Wygeneruj zadania na ten tydzień</button><button class="btn" data-act="task-new" data-due="${isoDate(ws < new Date() && new Date() < we ? new Date() : ws)}">${ICONS.plus}Dodaj zadanie</button>
    <span class="note">Generator tworzy zadania z harmonogramu 90 dni i przypomnienia dla leadów bez kontaktu od 7 dni (bez duplikatów).</span></div>`;
  const taskRow = t => `<div class="taskrow ${t.done ? 'done' : ''}"><input type="checkbox" data-act="task-toggle" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Wykonane">
    <div class="tt">${esc(t.title)}${t.leadId && D().leads[t.leadId] ? ` · <a href="#lead-${t.leadId}">${esc(D().leads[t.leadId].name)}</a>` : ''}<div class="tiny ${t.done ? 'muted' : dueCls(t.due)}">${fdt(t.due)}${t.source === 'roadmap' ? ' · z harmonogramu' : t.source === 'stale' ? ' · przypomnienie' : ''}</div></div>
    <div class="ctl"><select id="tw-owner-${t.id}" data-task-owner="${t.id}" aria-label="Osoba">${ownerOpts(t.ownerId, false, '— kto? —')}</select><button class="iconbtn" data-act="task-edit" data-id="${t.id}" aria-label="Edytuj">${ICONS.notatka}</button><button class="iconbtn" data-act="task-del" data-id="${t.id}" aria-label="Usuń">${ICONS.trash}</button></div></div>`;
  const weeklyCard = `<div class="card"><div class="cardhead"><h2>Zadania zespołu</h2><p>${weekly.filter(t => t.done).length}/${weekly.length} wykonanych</p></div>
    ${overdueWeekly.length ? `<p class="small overdue" style="margin-bottom:6px">Zaległe z poprzednich tygodni</p>${overdueWeekly.map(taskRow).join('')}<div class="sep"></div>` : ''}
    ${weekly.length ? weekly.map(taskRow).join('') : '<p class="muted">Brak zadań na ten tydzień. Użyj generatora albo dodaj zadanie.</p>'}</div>`;
  const leadCard = `<div class="card"><div class="cardhead"><h2>Następne kroki z leadów</h2><p>${leadTasks.length} zadań</p></div>
    ${leadTasks.length ? leadTasks.map(l => `<div class="taskrow"><span class="tl-ic" style="width:20px;height:20px">${ICONS.arrow}</span><div class="tt"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a> – ${esc(l.nextTask || 'zadanie')}<div class="tiny ${dueCls(l.nextTaskDate)}">${fdate(l.nextTaskDate)} · ${esc(memberName(l.ownerId) || 'bez opiekuna')} · ${esc(STAGES[stageIdx(l)].short)}</div></div><div class="ctl"><button class="btn sm" data-act="task-done" data-id="${l.id}">Zrobione</button></div></div>`).join('') : '<p class="muted">Brak zadań przypisanych do leadów w tym tygodniu.</p>'}</div>`;
  const meetCard = `<div class="card"><div class="cardhead"><h2>Spotkania</h2><p>${meetings.length}</p></div>
    ${meetings.length ? meetings.map(l => `<div class="taskrow"><span class="tl-ic" style="width:20px;height:20px">${ICONS.spotkanie}</span><div class="tt"><a href="#lead-${l.id}"><b>${esc(l.name)}</b></a> · ${esc(l.city || '')}<div class="tiny ${dueCls(l.meetingAt)}">${fdt(l.meetingAt)} · ${esc(l.meetingType || '')} ${esc(l.meetingPlace || '')}</div></div><div class="ctl"><span class="small muted">${esc(memberName(l.ownerId))}</span></div></div>`).join('') : '<p class="muted">Brak spotkań w tym tygodniu.</p>'}</div>`;
  const rmCard = `<div class="card"><div class="cardhead"><h2>Harmonogram – tydzień ${pw}</h2><a href="#harmonogram" class="small">Cały harmonogram</a></div>${rm.length ? rm.map(roadmapRow).join('') : '<p class="muted">Brak działań z harmonogramu w tym tygodniu.</p>'}</div>`;
  const hoCard = handoffs.length ? `<div class="card"><div class="cardhead"><h2>Przekazania leadów</h2></div>${handoffs.map(h => `<div class="taskrow"><span class="tl-ic" style="width:20px;height:20px">${ICONS.arrow}</span><div class="tt"><a href="#lead-${h.l.id}"><b>${esc(h.l.name)}</b></a>: ${esc(h.fromName || '—')} → ${esc(h.toName || '—')}<div class="tiny muted">${fdate(h.date)}${h.note ? ' · ' + esc(h.note) : ''}</div></div><div></div></div>`).join('')}</div>` : '';
  return head + `<div class="split"><div class="stack">${weeklyCard}${leadCard}</div><div class="stack">${meetCard}${rmCard}${hoCard}</div></div>`;
}
function generateWeekTasks() {
  const plan = activePlan();
  const ws = addDays(mondayOf(new Date()), S.weekOffset * 7);
  const we = addDays(ws, 7);
  const pw = planWeekOf(plan, ws);
  const existing = Object.values(D().tasks).filter(t => t.kind === 'weekly');
  const has = key => existing.some(t => t.genKey === key);
  const out = [];
  roadmapTasks().filter(t => +t.week === pw && !t.done).forEach(t => {
    const key = 'rm:' + t.id + ':' + isoDate(ws);
    if (!has(key)) out.push({ id: uid('t'), kind: 'weekly', title: t.title, ownerId: t.ownerId || '', done: false, due: isoDate(addDays(ws, 4)), source: 'roadmap', genKey: key, createdAt: new Date().toISOString() });
  });
  leadsArr().filter(isOpen).filter(l => l.status !== 'wstrzymany').forEach(l => {
    const lc = lastContact(l) || l.createdAt;
    if (lc && daysBetween(parseD(lc), ws) >= 7) {
      const key = 'stale:' + l.id + ':' + isoDate(ws);
      if (!has(key)) out.push({ id: uid('t'), kind: 'weekly', title: `Przypomnieć się: ${l.name} (${STAGES[stageIdx(l)].short}, ostatni kontakt ${fdateShort(lc)})`, ownerId: l.ownerId || '', leadId: l.id, done: false, due: isoDate(ws < new Date() && new Date() < we ? new Date() : ws), source: 'stale', genKey: key, createdAt: new Date().toISOString() });
    }
  });
  if (!out.length) { toast('Nie ma nic nowego do wygenerowania na ten tydzień.'); return; }
  out.forEach(t => put('tasks', t.id, t));
  toast(`Dodano ${out.length} zadań`);
}
