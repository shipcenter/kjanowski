/* ===== Widok centrali (dashboard) ===== */

function emptyLeadsState() {
  return `<div class="card"><div class="empty">
    <h3>Nie ma jeszcze żadnych leadów</h3>
    <p>Dodaj pierwszego kandydata ręcznie albo zaimportuj listę z pliku CSV lub XLSX. Po podłączeniu skrzynki franczyza@ zapytania z formularzy (franczyza i Ship Point) będą trafiać tu same.</p>
    <div class="actions" style="justify-content:center">
      <button class="btn primary" data-act="lead-new">${ICONS.plus}Dodaj lead</button>
      <button class="btn" data-act="import-open">${ICONS.up}Importuj CSV / XLSX</button>
      <button class="btn ghost" data-act="demo-on">Zobacz podgląd na danych przykładowych</button>
    </div></div></div>`;
}

function adsRows(a, b) { return Object.values(D().ads || {}).filter(x => inRange(x.date, a, b)); }

function viewDashboard() {
  if (isLoading()) return `<div class="skeleton">Wczytywanie danych zespołu…</div>`;
  const plan = activePlan();
  const conv = (plan.conv && plan.conv.length === NS - 1) ? plan.conv : DEFAULT_CONV;
  const all = leadsArr();
  const leads = filterLeads(all);
  const [a, b, plabel] = periodRange(S.f.period, plan);
  const isAll = S.f.period === 'all';
  const days = isAll ? null : Math.max(1, daysBetween(a, b));
  const cohort = leads.filter(l => inRange(l.createdAt, a, b));
  const won = leads.filter(l => inRange(stageDatesOf(l).umowa, a, b)).length;
  const fr = cohort.filter(l => modelOf(l) === 'franczyza').length, sp = cohort.length - fr;
  const fun = funnelOf(cohort);
  const overallAct = fun.reached[0] > 0 ? fun.reached[NS - 1] / fun.reached[0] : null;
  const fastCall = cohort.filter(l => l.firstCallAt && daysBetween(parseD(l.createdAt), parseD(l.firstCallAt)) <= 1).length;
  const called = cohort.filter(l => l.firstCallAt).length;
  const pres = leads.filter(l => inRange(l.presentationAt, a, b)).length;
  const ads = adsRows(a, b);
  const adsCost = sum(ads, x => x.cost), adsConv = sum(ads, x => x.conversions);
  const gLeads = cohort.filter(l => l.source === 'google').length;
  const last60 = all.filter(l => inRange(l.createdAt, addDays(new Date(), -60), addDays(new Date(), 1))).length / 2;
  const fc = forecast(plan, leads, last60);
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Widok centrali</span><h1>Pozyskiwanie franczyzobiorców</h1>
    <p>Cel: <b>${fmt(goal(), 1)} nowych punktów miesięcznie</b> · okres: ${esc(plabel)}</p></div>
    <div class="actions"><button class="btn" data-act="export-xlsx">${ICONS.down}Eksport XLSX</button><button class="btn primary" data-act="lead-new">${ICONS.plus}Dodaj lead</button></div></div>`;
  if (!all.length) return head + emptyLeadsState() + adsCard(a, b, plabel, 0);

  const kpis = `<div class="kpis">
    ${kpi('Nowe leady', fmt(cohort.length), `franczyza ${fr} · Ship Point ${sp}`)}
    ${kpi('Pierwsza rozmowa do 24 h', cohort.length ? pct(fastCall / cohort.length) : '—', `rozmowy: ${called} z ${cohort.length}`, cohort.length ? fastCall / cohort.length : null)}
    ${kpi('Wysłane prezentacje', fmt(pres), plabel)}
    ${kpi('Konwersja lead → umowa', overallAct == null ? '—' : pct(overallAct, 1), `kohorta ${fmt(fun.reached[0])} leadów`)}
    ${kpi('Nowe punkty (umowy)', fmt(won), isAll ? `cel: ${fmt(goal(), 1)} / mies.` : `cel na okres: ${fmt(goal() * days / 30, 1)}`, !isAll && goal() > 0 ? won / (goal() * days / 30) : null, true)}
    ${kpi('Google Ads – koszt leada', ads.length && gLeads ? zl(adsCost / gLeads) : '—', ads.length ? `wydano ${zl(adsCost)} · ${gLeads} leadów z Google` : 'nie podłączono Google Ads')}
  </div>`;

  const maxR = Math.max(1, fun.reached[0]);
  const funnel = `<div class="card"><div class="cardhead"><h2>Lejek i konwersja między etapami</h2><p>Leady pozyskane: ${esc(plabel)}</p></div>
    <div class="funnel">${STAGES.map((s, i) => {
      const r = fun.reached[i]; const w = r / maxR * 100;
      const cv = i > 0 ? fun.conv[i - 1] : null;
      return `<div class="frow" data-tip="${esc(s.n + ': ' + r + ' leadów' + (cv != null ? ' · konwersja z poprzedniego etapu ' + pct(cv) : ''))}">
        <span class="fl">${esc(s.n)}</span>
        <div class="ftrack"><div class="fbar ${i === NS - 1 ? 'won' : ''}" style="width:${w}%"></div><span class="fnum" style="${w > 82 ? `right:calc(${100 - w}% + 8px);color:#fff` : `left:calc(${w}% + 6px)`}">${fmt(r)}</span></div>
        <span class="fconv">${i === 0 ? '<span class="muted">100%</span>' : `<b>${cv == null ? '—' : pct(cv)}</b>`}</span></div>`;
    }).join('')}</div>
    <p class="note" style="margin-top:8px">Etapy ustawiają się same: zapis pierwszej rozmowy, wysłanie prezentacji, odbyte spotkanie i status „Pozyskany”. Procent to odsetek leadów z poprzedniego etapu, które doszły dalej.</p></div>`;

  const t = todayISO(), tomorrow = isoDate(addDays(new Date(), 1));
  const open = leads.filter(isOpen);
  const al = [];
  const noContact = open.filter(l => !l.firstCallAt && l.status === 'do_kontaktu' && l.createdTs && (Date.now() - new Date(l.createdTs)) > 864e5);
  if (noContact.length) al.push(['bad', `${noContact.length} nowych leadów czeka na pierwszą rozmowę dłużej niż 24 h`, noContact]);
  const overdue = open.filter(l => l.nextTaskDate && l.nextTaskDate < t);
  if (overdue.length) al.push(['bad', `${overdue.length} leadów ma zaległy kontakt`, overdue]);
  const noOwner = open.filter(l => !l.ownerId);
  if (noOwner.length) al.push(['warn', `${noOwner.length} aktywnych leadów nie ma opiekuna`, noOwner]);
  const noNext = open.filter(l => l.firstCallAt && !l.nextTaskDate);
  if (noNext.length) al.push(['warn', `${noNext.length} leadów po rozmowie nie ma zaplanowanego kolejnego kontaktu`, noNext]);
  const noTraining = leads.filter(l => isWon(l) && !l.trainingStart);
  if (noTraining.length) al.push(['warn', `${noTraining.length} podpisanych umów bez zaplanowanego szkolenia w centrali`, noTraining]);
  const presNoFollow = open.filter(l => l.presentationAt && daysBetween(parseD(l.presentationAt), new Date()) > 5 && (lastContact(l) || '').slice(0, 10) <= l.presentationAt);
  if (presNoFollow.length) al.push(['warn', `${presNoFollow.length} kandydatów dostało prezentację ponad 5 dni temu i nie było telefonu`, presNoFollow]);
  const meetSoon = open.filter(l => l.meetingAt && (l.meetingAt.slice(0, 10) === t || l.meetingAt.slice(0, 10) === tomorrow));
  if (meetSoon.length) al.push(['info', `Spotkania dziś i jutro: ${meetSoon.map(l => esc(l.name) + ' (' + fdt(l.meetingAt) + ')').join(', ')}`, meetSoon]);
  const pendingSms = Object.values(D().sms || {}).filter(x => x.status === 'oczekuje').length;
  if (pendingSms) al.push(['info', `${pendingSms} SMS czeka w kolejce na wysłanie`, []]);
  S.ui.alertLists = al.map(x => x[2].map(l => l.id));
  const alerts = `<div class="card"><div class="cardhead"><h2>Wymaga uwagi</h2><p>${al.length ? 'Kliknij, aby zobaczyć listę' : ''}</p></div>
    ${al.length ? `<div class="alerts">${al.map(([k, txt, list], i) => `<div class="alert ${k}"><span class="ic">${k === 'info' ? 'i' : '!'}</span><div>${list.length ? `<a data-act="alert-list" data-i="${i}">${txt}</a>` : `<a href="#kontakty">${txt}</a>`}</div></div>`).join('')}</div>` : `<p class="muted">Wszystkie leady mają opiekuna, zaplanowany kontakt i świeżą rozmowę.</p>`}</div>`;

  const wk0 = mondayOf(new Date());
  const weeks = Array.from({ length: 13 }, (_, i) => addDays(wk0, (i - 12) * 7));
  const wdata = weeks.map(w => { const ls = leads.filter(l => inRange(l.createdAt, w, addDays(w, 7))); const f = ls.filter(l => modelOf(l) === 'franczyza').length; return { label: fdateShort(isoDate(w)), value: ls.length, tip: `Tydzień od ${fdate(isoDate(w))}: ${ls.length} leadów (franczyza ${f}, Ship Point ${ls.length - f})` }; });
  const weekly = `<div class="card"><div class="cardhead"><h2>Nowe leady tygodniowo</h2><p>Ostatnie 13 tygodni</p></div>${columnChart(wdata, { valueFmt: v => fmt(v) })}</div>`;

  const fmax = Math.max(1, ...fc.total, goal());
  const fcCard = `<div class="card"><div class="cardhead"><h2>Prognoza nowych punktów</h2><p>Otwarte leady × szansa z etapu + napływ ${fmt(last60)} leadów / mies.</p></div>
    <div class="subbars">${['0–30 dni', '31–60 dni', '61–90 dni'].map((lab, i) => `<div class="subbar" data-tip="${esc(lab + ': z obecnych leadów ' + fmt(fc.pipeline[i], 1) + ', z nowych ' + fmt(fc.fromNew[i], 1))}"><span class="small">${lab}</span><div class="track" style="display:flex;gap:2px;background:transparent"><i style="width:${fc.pipeline[i] / fmax * 100}%;background:var(--s1)"></i><i style="width:${fc.fromNew[i] / fmax * 100}%;background:var(--s2)"></i></div><span class="small num"><b>${fmt(fc.total[i], 1)}</b></span></div>`).join('')}</div>
    <div class="legend"><span><i style="background:var(--s1)"></i>Z obecnych leadów</span><span><i style="background:var(--s2)"></i>Z nowych leadów</span></div>
    <div class="sep"></div>
    <div class="tablewrap"><table class="t"><thead><tr><th>Etap</th><th class="r">Otwarte leady</th><th class="r">Szansa na umowę</th><th class="r">Oczekiwane punkty</th></tr></thead><tbody>
    ${STAGES.slice(0, -1).map((s, i) => `<tr><td>${esc(s.n)}</td><td class="r">${fc.pipeByStage[i].n}</td><td class="r muted">${pct(winProbFrom(i, conv), 1)}</td><td class="r">${fmt(fc.pipeByStage[i].exp, 1)}</td></tr>`).join('')}
    </tbody></table></div><p class="note" style="margin-top:6px">Szanse z etapów to założenia (konwersje i cykl ok. ${fmt(plan.cycleDays || 60)} dni) – po zebraniu danych można je zastąpić rzeczywistymi.</p></div>`;

  const srcRows = SOURCES.map((s, i) => {
    const inP = leads.filter(l => l.source === s.k && inRange(l.createdAt, a, b));
    const w = leads.filter(l => l.source === s.k && inRange(stageDatesOf(l).umowa, a, b)).length;
    const cost = s.k === 'google' && ads.length ? adsCost : null;
    return { s, i, leads: inP.length, calls: inP.filter(l => l.firstCallAt).length, meet: inP.filter(l => stageIdx(l) >= 3).length, won: w, cost, cpl: cost != null && inP.length ? cost / inP.length : null };
  }).filter(r => r.leads || r.won);
  const maxSrc = Math.max(1, ...srcRows.map(r => r.leads));
  const sources = `<div class="card"><div class="cardhead"><h2>Źródła leadów</h2><p>${esc(plabel)}</p></div>
    ${srcRows.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Źródło</th><th>Leady</th><th class="r">Rozmowy</th><th class="r">Spotkania</th><th class="r">Umowy</th><th class="r">Koszt</th><th class="r">Koszt leada</th></tr></thead><tbody>
    ${srcRows.sort((x, y) => y.leads - x.leads).map(r => `<tr class="click" data-act="filter-source" data-k="${r.s.k}"><td>${sourcePill(r.s.k)}</td><td><div class="bar-inline">${inlineBar(r.leads, maxSrc, null, SERIES[r.i % 8])}<span class="num small">${r.leads}</span></div></td><td class="r">${r.calls}</td><td class="r">${r.meet}</td><td class="r">${r.won}</td><td class="r">${r.cost != null ? zl(r.cost) : '—'}</td><td class="r">${zl(r.cpl)}</td></tr>`).join('')}
    </tbody></table></div><p class="note" style="margin-top:8px">Kliknij źródło, aby przefiltrować widok. Koszt pokazuje się dla Google Ads po podłączeniu kampanii.</p>` : `<p class="muted">Brak leadów w wybranym okresie.</p>`}</div>`;

  const owners = [...team(), { id: '', name: 'Bez opiekuna' }].map(m => {
    const ls = leads.filter(l => (l.ownerId || '') === m.id);
    const op = ls.filter(isOpen);
    return { m, total: ls.length, open: op.length, overdue: op.filter(l => l.nextTaskDate && l.nextTaskDate < t).length, today: op.filter(l => l.nextTaskDate === t).length,
      pres: ls.filter(l => inRange(l.presentationAt, a, b)).length, won: ls.filter(l => inRange(stageDatesOf(l).umowa, a, b)).length,
      stale: op.filter(l => { const lc = lastContact(l) || l.createdAt; return lc && daysBetween(parseD(lc), new Date()) > 7; }).length };
  }).filter(r => r.total);
  const ownersCard = `<div class="card"><div class="cardhead"><h2>Opiekunowie</h2><p>Obciążenie i wyniki</p></div>
    ${owners.length ? `<div class="tablewrap"><table class="t"><thead><tr><th>Opiekun</th><th class="r">Aktywne</th><th class="r">Na dziś</th><th class="r">Zaległe</th><th class="r">Bez kontaktu 7+ dni</th><th class="r">Prezentacje</th><th class="r">Umowy</th></tr></thead><tbody>
    ${owners.map(r => `<tr class="click" data-act="filter-owner" data-k="${r.m.id || '_none'}"><td>${esc(r.m.name)}</td><td class="r">${r.open}</td><td class="r ${r.today ? 'today' : ''}">${r.today}</td><td class="r ${r.overdue ? 'overdue' : ''}">${r.overdue}</td><td class="r">${r.stale}</td><td class="r">${r.pres}</td><td class="r"><b>${r.won}</b></td></tr>`).join('')}
    </tbody></table></div>` : `<p class="muted">Dodaj osoby w zakładce „Zespół i ustawienia” i przypisz im leady.</p>`}</div>`;

  const regs = REGIONS.map(r => ({ r, n: cohort.filter(l => l.region === r).length, w: leads.filter(l => l.region === r && inRange(stageDatesOf(l).umowa, a, b)).length })).filter(x => x.n || x.w).sort((x, y) => y.n - x.n);
  const maxReg = Math.max(1, ...regs.map(x => x.n));
  const regionsCard = `<div class="card"><div class="cardhead"><h2>Regiony</h2><p>Leady i umowy</p></div>
    ${regs.length ? `<div class="subbars">${regs.slice(0, 10).map(x => `<div class="subbar" data-tip="${esc(x.r + ': ' + x.n + ' leadów, ' + x.w + ' umów')}"><span class="small">${esc(x.r)}</span><div class="track"><i style="width:${x.n / maxReg * 100}%"></i></div><span class="small num r">${x.n}${x.w ? ` · <b>${x.w}</b>` : ''}</span></div>`).join('')}</div>` : `<p class="muted">Uzupełnij województwa w leadach, aby zobaczyć rozkład.</p>`}</div>`;

  return head + filterBar() + kpis + `<div class="grid2">${funnel}${alerts}</div><div style="height:16px"></div>` +
    `<div class="grid2">${adsCard(a, b, plabel, gLeads, leads)}${fcCard}</div><div style="height:16px"></div>${sources}<div style="height:16px"></div><div class="grid2">${weekly}${ownersCard}</div><div style="height:16px"></div>${regionsCard}`;
}

function adsCard(a, b, plabel, gLeads, leads = []) {
  const rows = adsRows(a, b).sort((x, y) => (x.date || '').localeCompare(y.date || ''));
  if (!rows.length) {
    return `<div class="card"><div class="cardhead"><h2>Google Ads – kampania franczyza</h2><span class="pill">nie podłączono</span></div>
      <p class="ink2 small">Po podłączeniu zobaczysz tu codziennie: wydatki kampanii, kliknięcia, konwersje z Google Ads oraz rzeczywisty koszt leada i koszt pozyskania punktu (wydatki ÷ leady z Google w panelu).</p>
      <div class="row" style="margin-top:10px"><a class="btn sm" href="#ustawienia">Jak podłączyć</a></div></div>`;
  }
  const cost = sum(rows, x => x.cost), clicks = sum(rows, x => x.clicks), convs = sum(rows, x => x.conversions), impr = sum(rows, x => x.impressions);
  const won = leads.filter(l => l.source === 'google' && inRange(stageDatesOf(l).umowa, a, b)).length;
  const data = rows.slice(-30).map(x => ({ label: fdateShort(x.date), value: +x.cost || 0, tip: `${fdate(x.date)}: ${zl(x.cost)} · ${x.clicks || 0} kliknięć · ${fmt(x.conversions || 0, 1)} konwersji` }));
  return `<div class="card"><div class="cardhead"><h2>Google Ads – kampania franczyza</h2><p>${esc(plabel)}</p></div>
    <div class="grid2" style="gap:10px">
      <div><span class="eyebrow">Wydatki</span><div class="bigout">${zl(cost)}</div><span class="small ink2">${fmt(clicks)} kliknięć · CPC ${zl(clicks ? cost / clicks : null, 2)}</span></div>
      <div><span class="eyebrow">Konwersje Google</span><div class="bigout">${fmt(convs, 1)}</div><span class="small ink2">koszt konwersji ${zl(convs ? cost / convs : null)}</span></div>
    </div>
    <div class="sep"></div>
    <div class="statline"><span>Leady z Google w panelu</span><b>${gLeads}</b></div>
    <div class="statline"><span>Koszt leada (wg panelu)</span><b>${zl(gLeads ? cost / gLeads : null)}</b></div>
    <div class="statline"><span>Umowy z Google</span><b>${won}</b></div>
    <div class="statline"><span>Koszt pozyskania punktu</span><b>${zl(won ? cost / won : null)}</b></div>
    ${columnChart(data, { height: 140, valueFmt: v => zl(v) })}
    <p class="note">Wyświetlenia: ${fmt(impr)} · dane z ${fdate(rows[rows.length - 1].date)}.</p></div>`;
}

function kpi(label, value, sub, ratio = null, hl = false) {
  const meter = ratio != null && isFinite(ratio) ? `<div class="meter"><i style="width:${clamp(ratio * 100, 0, 100)}%;background:var(${ratio >= 1 ? '--good' : ratio >= 0.75 ? '--s1' : '--s2'})"></i></div>` : '';
  return `<div class="kpi ${hl ? 'hl' : ''}"><span class="label">${esc(label)}</span><span class="value">${value}</span><span class="sub">${sub}</span>${meter}</div>`;
}
