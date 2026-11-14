/* ===== Widok centrali (dashboard) ===== */

function emptyLeadsState() {
  return `<div class="card"><div class="empty">
    <h3>Nie ma jeszcze żadnych leadów</h3>
    <p>Dodaj pierwszego kandydata ręcznie albo zaimportuj listę z pliku CSV lub XLSX (np. eksport z formularza Meta Ads czy portalu franczyzowego). Dashboard wypełni się sam.</p>
    <div class="actions" style="justify-content:center">
      <button class="btn primary" data-act="lead-new">${ICONS.plus}Dodaj lead</button>
      <button class="btn" data-act="import-open">${ICONS.up}Importuj CSV / XLSX</button>
      <button class="btn ghost" data-act="demo-on">Zobacz podgląd na danych przykładowych</button>
    </div></div></div>`;
}

function viewDashboard() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie danych zespołu…</div>`;
  const plan = activePlan();
  const pc = computePlan(plan);
  const all = leadsArr();
  const leads = filterLeads(all);
  const spendAll = filteredSpend();
  const [a, b, plabel] = periodRange(S.f.period, plan);
  const cohort = leads.filter(l => inRange(l.createdAt, a, b));
  const act = actualsFor(leads, spendAll, a, b);
  const days = Math.max(1, Math.min(daysBetween(a, b), 3650));
  const elapsed = clamp(daysBetween(a, new Date()) + 1, 1, days);
  const isAll = S.f.period === 'all';
  const planLeads = isAll ? null : pc.leads / 30 * days;
  const planLeadsToDate = isAll ? null : pc.leads / 30 * elapsed;
  const fun = funnelOf(cohort);
  const overallAct = fun.reached[0] > 0 ? fun.reached[6] / fun.reached[0] : null;
  const cpl = act.leads > 0 && act.spend > 0 ? act.spend / act.leads : null;
  const cac = act.points > 0 && act.spend > 0 ? act.spend / act.points : null;
  const fc = forecast(plan, leads);
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Widok centrali · ${esc(plan.name || 'plan')}</span><h1>Pozyskiwanie franczyzobiorców</h1>
    <p>Cel: <b>${fmt(plan.target, 1)} nowych punktów miesięcznie</b> przy budżecie <b>${zl(plan.budget)}</b> / mies. Start planu 90-dniowego: ${fdate(plan.startDate)}.</p></div>
    <div class="actions"><button class="btn" data-act="export-xlsx">${ICONS.down}Eksport XLSX</button><button class="btn primary" data-act="lead-new">${ICONS.plus}Dodaj lead</button></div></div>`;
  if (!all.length) return head + emptyLeadsState() + planOnlyPanel(plan, pc);

  const kpis = `<div class="kpis">
    ${kpi('Leady · ' + plabel, fmt(act.leads), isAll ? `plan: ${fmt(pc.leads)} / mies.` : `plan na dziś: ${fmt(planLeadsToDate)} · na okres: ${fmt(planLeads)}`, planLeadsToDate > 0 ? act.leads / planLeadsToDate : null)}
    ${kpi('Konwersja lead → umowa', overallAct == null ? '—' : pct(overallAct, 1), `plan: ${pct(pc.overall, 1)} · kohorta ${fmt(fun.reached[0])} leadów`)}
    ${kpi('Koszt leada (CPL)', cpl == null ? '—' : zl(cpl), `plan: ${zl(pc.cplBlend)}${act.spend ? ' · wydano ' + zl(act.spend) : ' · brak wpisanych wydatków'}`)}
    ${kpi('Koszt pozyskania punktu', cac == null ? '—' : zl(cac), `plan (CAC): ${zl(pc.cac)}`)}
    ${kpi('Nowe punkty · ' + plabel, fmt(act.points), isAll ? `cel: ${fmt(plan.target, 1)} / mies.` : `cel: ${fmt(plan.target * days / 30, 1)} w okresie`, !isAll && plan.target > 0 ? act.points / (plan.target * elapsed / 30) : null, true)}
    ${kpi('Prognoza – 90 dni', fmt(sum(fc.total), 1), `30 dni: ${fmt(fc.total[0], 1)} · 60: ${fmt(fc.total[0] + fc.total[1], 1)} · lejek: ${fmt(sum(fc.pipeline), 1)}`)}
  </div>`;

  // lejek
  const maxR = Math.max(1, fun.reached[0]);
  const funnel = `<div class="card"><div class="cardhead"><h2>Lejek i konwersja między etapami</h2><p>Kohorta: leady pozyskane w okresie „${esc(plabel)}”</p></div>
    <div class="funnel">${STAGES.map((s, i) => {
      const r = fun.reached[i]; const w = r / maxR * 100;
      const cv = i > 0 ? fun.conv[i - 1] : null; const pl = i > 0 ? pc.conv[i - 1] : null;
      const tone = cv == null ? '' : cv >= pl ? 'up' : cv >= pl * 0.8 ? '' : 'down';
      return `<div class="frow" data-tip="${esc(s.n + ': ' + r + ' leadów' + (cv != null ? ' · konwersja ' + pct(cv) + ' (plan ' + pct(pl) + ')' : ''))}">
        <span class="fl">${esc(s.n)}</span>
        <div class="ftrack"><div class="fbar ${i === 6 ? 'won' : ''}" style="width:${w}%"></div><span class="fnum" style="${w > 82 ? `right:calc(${100 - w}% + 8px);color:#fff` : `left:calc(${w}% + 6px)`}">${fmt(r)}</span></div>
        <span class="fconv">${i === 0 ? '<span class="muted">100%</span>' : `<span class="delta ${tone}">${cv == null ? '—' : pct(cv)}</span><span class="pl">plan ${pct(pl)}</span>`}</span></div>`;
    }).join('')}</div>
    <p class="note" style="margin-top:8px">Procent przy etapie to odsetek leadów z poprzedniego etapu, które doszły dalej. Leady utracone liczą się do etapu, na którym odpadły.</p></div>`;

  // plan vs wykonanie (okna planu)
  const wins = planWindows(plan);
  const rowsPA = [
    { k: 'leads', n: 'Leady', d: 0 }, { k: 'meetings', n: 'Spotkania', d: 0 }, { k: 'analyses', n: 'Analizy lokalizacji', d: 0 },
    { k: 'points', n: 'Nowe punkty (umowy)', d: 1 }, { k: 'spend', n: 'Wydatki marketingowe', d: 0, money: true }
  ];
  const actM = wins.map(([x, y]) => actualsFor(leads, spendAll, x, y));
  const tot = k => sum(actM, m => m[k]);
  const ptot = k => sum(pc.months, m => m[k]);
  const pa = `<div class="card"><div class="cardhead"><h2>Plan a wykonanie – 90 dni</h2><p>M1 ${fdateShort(isoDate(wins[0][0]))}–${fdateShort(isoDate(addDays(wins[0][1], -1)))} · M2 · M3${filtersActive() ? ' · przy filtrach porównanie orientacyjne' : ''}</p></div>
    ${planActualChart(pc.months.map((m, i) => ({ label: 'M' + (i + 1) + ' – umowy', plan: m.points, actual: actM[i].points })).concat([{ label: 'Razem 90 dni', plan: ptot('points'), actual: tot('points') }]), { height: 160 })}
    <div class="tablewrap" style="margin-top:12px"><table class="t"><thead><tr><th>Wskaźnik</th>${[1, 2, 3].map(i => `<th class="r">M${i} plan</th><th class="r">M${i} wyk.</th>`).join('')}<th class="r">90 dni</th><th>Realizacja</th></tr></thead><tbody>
    ${rowsPA.map(r => {
      const p = ptot(r.k), w = tot(r.k), f = r.money ? (v => zl(v)) : (v => fmt(v, r.d));
      return `<tr><td>${r.n}</td>${pc.months.map((m, i) => `<td class="r muted">${f(m[r.k])}</td><td class="r"><b>${f(actM[i][r.k])}</b></td>`).join('')}<td class="r">${f(w)} / ${f(p)}</td><td><div class="bar-inline">${inlineBar(w, Math.max(p, w), p, r.money && w > p ? '--s2' : '--s1')}<span class="small num">${p > 0 ? pct(w / p) : '—'}</span></div></td></tr>`;
    }).join('')}</tbody></table></div>
    <p class="note" style="margin-top:8px">Plan uwzględnia cykl sprzedaży ok. ${fmt(pc.cycle)} dni – pierwsze umowy z nowych leadów pojawiają się zwykle w 2. miesiącu.</p></div>`;

  // leady tygodniowo
  const wk0 = mondayOf(new Date());
  const weeks = Array.from({ length: 13 }, (_, i) => addDays(wk0, (i - 12) * 7));
  const wdata = weeks.map(w => { const n = leads.filter(l => inRange(l.createdAt, w, addDays(w, 7))).length; return { label: fdateShort(isoDate(w)), value: n, tip: `Tydzień od ${fdate(isoDate(w))}: ${n} leadów` }; });
  const weekly = `<div class="card"><div class="cardhead"><h2>Nowe leady tygodniowo</h2><p>Ostatnie 13 tygodni · linia = tempo z planu</p></div>${columnChart(wdata, { planValue: pc.leads * 12 / 52, planLabel: 'plan / tydz.', valueFmt: v => fmt(v, v % 1 ? 1 : 0) })}</div>`;

  // źródła
  const srcRows = SOURCES.map((s, i) => {
    const ls = leads.filter(l => l.source === s.k);
    const inP = ls.filter(l => inRange(l.createdAt, a, b));
    const sp = sum(Object.values(D().spend).filter(x => x.source === s.k && inRange(x.date, a, b)), x => x.amount);
    const won = ls.filter(l => inRange((l.stageDates || {}).umowa, a, b)).length;
    const meet = inP.filter(l => stageIdx(l) >= 3).length;
    return { s, i, leads: inP.length, meet, won, sp, cpl: inP.length && sp ? sp / inP.length : null, cac: won && sp ? sp / won : null, conv: inP.length ? inP.filter(isWon).length / inP.length : null, planCpl: +(plan.cpl || {})[s.k] || s.cpl };
  }).filter(r => r.leads || r.sp || r.won);
  const maxSrc = Math.max(1, ...srcRows.map(r => r.leads));
  const sources = `<div class="card"><div class="cardhead"><h2>Źródła leadów i koszty pozyskania</h2><p>${esc(plabel)}</p></div>
    ${srcRows.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Źródło</th><th>Leady</th><th class="r">Spotkania</th><th class="r">Umowy</th><th class="r">Wydatki</th><th class="r">CPL</th><th class="r">CPL plan</th><th class="r">Koszt punktu</th></tr></thead><tbody>
    ${srcRows.sort((x, y) => y.leads - x.leads).map(r => `<tr class="click" data-act="filter-source" data-k="${r.s.k}"><td>${sourcePill(r.s.k)}</td><td><div class="bar-inline">${inlineBar(r.leads, maxSrc, null, SERIES[r.i % 8])}<span class="num small">${r.leads}</span></div></td><td class="r">${r.meet}</td><td class="r">${r.won}</td><td class="r">${r.sp ? zl(r.sp) : '—'}</td><td class="r ${r.cpl && r.cpl > r.planCpl * 1.3 ? 'overdue' : ''}">${zl(r.cpl)}</td><td class="r muted">${zl(r.planCpl)}</td><td class="r">${zl(r.cac)}</td></tr>`).join('')}
    </tbody></table></div><p class="note" style="margin-top:8px">Kliknij źródło, aby przefiltrować dashboard. Wydatki dodasz w zakładce „Plan i budżet”. Na czerwono: CPL o ponad 30% wyższy niż w planie.</p>` : `<p class="muted">Brak leadów w wybranym okresie.</p>`}</div>`;

  // opiekunowie
  const owners = [...team(), { id: '', name: 'Bez opiekuna' }].map(m => {
    const ls = leads.filter(l => (l.ownerId || '') === m.id);
    const open = ls.filter(isOpen);
    return { m, total: ls.length, open: open.length, overdue: open.filter(l => l.nextTaskDate && l.nextTaskDate < todayISO()).length,
      meetWeek: open.filter(l => inRange(l.meetingAt, mondayOf(new Date()), addDays(mondayOf(new Date()), 7))).length,
      won: ls.filter(l => inRange((l.stageDates || {}).umowa, a, b)).length, stale: open.filter(l => { const lc = lastContact(l) || l.createdAt; return lc && daysBetween(parseD(lc), new Date()) > 7; }).length };
  }).filter(r => r.total);
  const ownersCard = `<div class="card"><div class="cardhead"><h2>Opiekunowie</h2><p>Obciążenie i realizacja</p></div>
    ${owners.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Opiekun</th><th class="r">Aktywne</th><th class="r">Zaległe zadania</th><th class="r">Bez kontaktu 7+ dni</th><th class="r">Spotkania w tym tyg.</th><th class="r">Umowy</th></tr></thead><tbody>
    ${owners.map(r => `<tr class="click" data-act="filter-owner" data-k="${r.m.id || '_none'}"><td>${esc(r.m.name)}</td><td class="r">${r.open}</td><td class="r ${r.overdue ? 'overdue' : ''}">${r.overdue}</td><td class="r ${r.stale ? 'today' : ''}">${r.stale}</td><td class="r">${r.meetWeek}</td><td class="r"><b>${r.won}</b></td></tr>`).join('')}
    </tbody></table></div>` : `<p class="muted">Dodaj osoby w zakładce „Zespół i ustawienia” i przypisz im leady.</p>`}</div>`;

  // regiony
  const regs = REGIONS.map(r => ({ r, n: cohort.filter(l => l.region === r).length, w: leads.filter(l => l.region === r && inRange((l.stageDates || {}).umowa, a, b)).length })).filter(x => x.n || x.w).sort((x, y) => y.n - x.n);
  const maxReg = Math.max(1, ...regs.map(x => x.n));
  const regionsCard = `<div class="card"><div class="cardhead"><h2>Regiony</h2><p>Leady i umowy w okresie</p></div>
    ${regs.length ? `<div class="subbars">${regs.slice(0, 10).map(x => `<div class="subbar" data-tip="${esc(x.r + ': ' + x.n + ' leadów, ' + x.w + ' umów')}"><span class="small">${esc(x.r)}</span><div class="track"><i style="width:${x.n / maxReg * 100}%"></i></div><span class="small num r">${x.n}${x.w ? ` · <b>${x.w}</b>` : ''}</span></div>`).join('')}</div>` : `<p class="muted">Uzupełnij województwa w leadach, aby zobaczyć rozkład.</p>`}</div>`;

  // prognoza
  const fmax = Math.max(1, ...fc.total, plan.target);
  const fcCard = `<div class="card"><div class="cardhead"><h2>Prognoza nowych punktów</h2><p>Otwarte leady × szansa z etapu + nowe leady z planu</p></div>
    <div class="subbars">${['0–30 dni', '31–60 dni', '61–90 dni'].map((lab, i) => `<div class="subbar" data-tip="${esc(lab + ': z lejka ' + fmt(fc.pipeline[i], 1) + ', z nowych leadów ' + fmt(fc.fromNew[i], 1))}"><span class="small">${lab}</span><div class="track" style="display:flex;gap:2px;background:transparent"><i style="width:${fc.pipeline[i] / fmax * 100}%;background:var(--s1)"></i><i style="width:${fc.fromNew[i] / fmax * 100}%;background:var(--s3)"></i></div><span class="small num"><b>${fmt(fc.total[i], 1)}</b></span></div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--s1)"></i>Z obecnego lejka</span><span><i style="background:var(--s3)"></i>Z nowych leadów (plan)</span><span><i class="line" style="background:var(--accent)"></i>Cel: ${fmt(plan.target, 1)} / mies.</span></div>
    <div class="sep"></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Etap</th><th class="r">Otwarte leady</th><th class="r">Szansa na umowę</th><th class="r">Oczekiwane punkty</th></tr></thead><tbody>
    ${STAGES.slice(0, 6).map((s, i) => `<tr><td>${esc(s.n)}</td><td class="r">${fc.pipeByStage[i].n}</td><td class="r muted">${pct(winProbFrom(i, pc.conv), 1)}</td><td class="r">${fmt(fc.pipeByStage[i].exp, 1)}</td></tr>`).join('')}
    </tbody></table></div></div>`;

  // alerty
  const t = todayISO();
  const tomorrow = isoDate(addDays(new Date(), 1));
  const open = leads.filter(isOpen);
  const al = [];
  const noContact = open.filter(l => l.status === 'do_kontaktu' && l.createdTs && (Date.now() - new Date(l.createdTs)) > 864e5);
  if (noContact.length) al.push(['bad', `${noContact.length} nowych leadów czeka na kontakt dłużej niż 24 h`, noContact]);
  const overdue = open.filter(l => l.nextTaskDate && l.nextTaskDate < t);
  if (overdue.length) al.push(['bad', `${overdue.length} leadów ma zaległe zadanie`, overdue]);
  const noOwner = open.filter(l => !l.ownerId);
  if (noOwner.length) al.push(['warn', `${noOwner.length} aktywnych leadów nie ma opiekuna`, noOwner]);
  const stale = open.filter(l => { const lc = lastContact(l) || l.createdAt; return lc && daysBetween(parseD(lc), new Date()) > 7 && l.status !== 'wstrzymany'; });
  if (stale.length) al.push(['warn', `${stale.length} leadów bez kontaktu od ponad 7 dni`, stale]);
  const meetSoon = open.filter(l => l.meetingAt && (l.meetingAt.slice(0, 10) === t || l.meetingAt.slice(0, 10) === tomorrow));
  if (meetSoon.length) al.push(['info', `Spotkania dziś i jutro: ${meetSoon.map(l => esc(l.name) + ' (' + fdt(l.meetingAt) + ')').join(', ')}`, meetSoon]);
  const alerts = `<div class="card"><div class="cardhead"><h2>Wymaga uwagi</h2><p>${al.length ? 'Kliknij, aby zobaczyć listę' : ''}</p></div>
    ${al.length ? `<div class="alerts">${al.map(([k, txt, list], i) => `<div class="alert ${k}"><span class="ic">${k === 'info' ? 'i' : '!'}</span><div><a data-act="alert-list" data-i="${i}">${txt}</a></div></div>`).join('')}</div>` : `<p class="muted">Wszystkie leady mają opiekuna, aktualne zadania i świeży kontakt.</p>`}</div>`;
  S.ui.alertLists = al.map(x => x[2].map(l => l.id));

  return head + filterBar() + kpis + `<div class="grid2">${funnel}${alerts}</div><div style="height:16px"></div>` + pa +
    `<div style="height:16px"></div><div class="grid2">${weekly}${fcCard}</div><div style="height:16px"></div>${sources}<div style="height:16px"></div><div class="grid2">${ownersCard}${regionsCard}</div>`;
}

function kpi(label, value, sub, ratio = null, hl = false) {
  const meter = ratio != null && isFinite(ratio) ? `<div class="meter"><i style="width:${clamp(ratio * 100, 0, 100)}%;background:var(${ratio >= 1 ? '--good' : ratio >= 0.75 ? '--s1' : '--s2'})"></i></div>` : '';
  return `<div class="kpi ${hl ? 'hl' : ''}"><span class="label">${esc(label)}</span><span class="value">${value}</span><span class="sub">${sub}</span>${meter}</div>`;
}

function planOnlyPanel(plan, pc) {
  return `<div style="height:16px"></div><div class="grid3">
    <div class="card"><span class="eyebrow">Model planu</span><div class="bigout">${fmt(pc.leads)}</div><p class="ink2">leadów miesięcznie przy CPL ${zl(pc.cplBlend)}</p></div>
    <div class="card"><span class="eyebrow">Oczekiwane punkty</span><div class="bigout">${fmt(pc.points, 1)}</div><p class="ink2">miesięcznie w stanie ustalonym (cel ${fmt(plan.target, 1)})</p></div>
    <div class="card"><span class="eyebrow">Koszt pozyskania punktu</span><div class="bigout">${zl(pc.cac)}</div><p class="ink2">konwersja lead → umowa ${pct(pc.overall, 1)}</p></div>
  </div>`;
}
