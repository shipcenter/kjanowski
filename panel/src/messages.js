/* ===== Generator wiadomości i skryptów rozmów (PL) ===== */

const FORMS = { panstwo: 'forma „Państwo”', pan: 'forma „Pan”', pani: 'forma „Pani”', ty: 'forma „Ty”' };
const formLabel = f => FORMS[f] || FORMS.panstwo;
const regionLoc = r => r ? 'województwie ' + r.replace(/ie$/, 'im') : '';
const fdtLong = s => { const d = parseD(s); if (!d) return ''; const base = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }); return String(s).includes('T') ? base + ' o ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : base; };
const PH = t => `[uzupełnij: ${t}]`;

function msgContext(l, form) {
  const o = offer();
  const m = (myMemberId() && D().team[myMemberId()]) || (l && l.ownerId ? D().team[l.ownerId] : null);
  form = form || (l && l.form) || 'panstwo';
  const g = (pan, pani, panstwo, ty) => ({ pan, pani, panstwo, ty })[form] ?? panstwo;
  const first = l && l.name ? l.name.trim().split(/\s+/)[0] : '';
  const loc = l && l.locId ? D().locations[l.locId] : (l ? Object.values(D().locations).find(x => x.leadId === l.id) : null);
  return {
    l: l || {}, o, g, form,
    imie: first || PH('imię'), pelne: (l && l.name) || PH('imię i nazwisko'),
    miasto: (l && l.city) || PH('miasto'), maMiasto: !!(l && l.city),
    region: l && l.region ? regionLoc(l.region) : '',
    opiekun: m ? m.name : PH('Twoje imię i nazwisko'),
    opiekunImie: m ? firstName(m.name) : PH('Twoje imię'),
    opiekunTel: (m && m.phone) || o.telefon, opiekunEmail: (m && m.email) || o.email,
    rola: m && m.role ? m.role.replace('Centrala – ', '') : 'Rozwój sieci franczyzowej',
    spotkanie: l && l.meetingAt ? fdtLong(l.meetingAt) : PH('termin spotkania'),
    formaSpotkania: l && l.meetingType ? ({ online: 'spotkanie online', telefon: 'rozmowa telefoniczna', centrala: 'spotkanie w centrali ShipCenter w Katowicach', lokal: 'spotkanie w planowanym lokalu', punkt: 'spotkanie w działającym punkcie ShipCenter' })[l.meetingType] : 'spotkanie online',
    miejsce: (l && l.meetingPlace) || o.linkSpotkanie || PH('link lub adres spotkania'),
    linkKalendarz: o.linkSpotkanie || PH('link do kalendarza'),
    linkWebinar: o.linkWebinar || PH('link do zapisu na webinar'),
    loc: loc ? analyzeLocation(loc) : null, locDoc: loc,
    model: (l && l.model) || 'punkt'
  };
}
const podpis = c => `\n\nPozdrawiam\n${c.opiekun}\n${c.rola} · Ship Center Poland\ntel. ${c.opiekunTel} · ${c.opiekunEmail}\n${c.o.www}`;
const powitanie = c => c.g('Dzień dobry,', 'Dzień dobry,', 'Dzień dobry,', `Dzień dobry ${c.imie},`);
const fmtZl = v => fmt(v, v % 1 ? 2 : 0) + ' zł netto';
const offerBullets = c => `• punkt ShipCenter nadaje paczki, palety i przesyłki zagraniczne u wielu przewoźników (${c.o.przewoznicy}) przez platformę ${c.o.www},
• klientami są osoby prywatne, sklepy internetowe i lokalne firmy – franczyzobiorca zarabia na każdej nadanej przesyłce i usługach dodatkowych (druk, pieczątki),
• pakiet startowy SMART: ${fmtZl(c.o.licencja)} jednorazowo – licencja i marka, szkolenie (${c.o.szkolenie}), helpdesk i opiekun, strona punktu, wizytówka Google, materiały marketingowe i paczka startowa,
• opłata miesięczna 0 zł w miesiącu, w którym punkt wyśle ponad ${c.o.progRabatu} paczek (w pozostałych ${fmtZl(c.o.oplataMies)}),
• kto nie ma wyposażenia, dobiera sprzęt w wariancie FLEX z rabatem do ${c.o.flexRabat || 15}%.`;
const kalk = c => c.o.linkKalkulator ? `\n\nKoszt startu można policzyć w kalkulatorze: ${c.o.linkKalkulator}` : '';

const TEMPLATES = {
  email_pierwszy: { grp: 'Pierwszy kontakt', n: 'Pierwszy kontakt po zgłoszeniu', kind: 'E-mail', f: c => ({
    subject: `Franczyza ShipCenter${c.maMiasto ? ' – ' + c.miasto : ''}: kolejne kroki`,
    body: `${powitanie(c)}

dziękuję za zainteresowanie otwarciem punktu ShipCenter${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}. Nazywam się ${c.opiekun} i odpowiadam za rozwój sieci${c.region ? ' w ' + c.region : ''}.

Najważniejsze informacje w skrócie:
${offerBullets(c)}${kalk(c)}

Proponuję krótką rozmowę telefoniczną (ok. 15 minut): opowiem o modelu współpracy, odpowiem na pytania i sprawdzimy, czy wybrana lokalizacja ma potencjał. ${c.g('Kiedy będzie Panu wygodnie porozmawiać?', 'Kiedy będzie Pani wygodnie porozmawiać?', 'Kiedy będzie Państwu wygodnie porozmawiać?', 'Kiedy będzie Ci wygodnie porozmawiać?')} Termin można też wybrać tutaj: ${c.linkKalendarz}${podpis(c)}` }) },

  email_prezentacja: { grp: 'Prezentacja i kalkulator', n: 'Mail z prezentacją', kind: 'E-mail', f: c => {
    const sp = c.model === 'shippoint' || MODEL_ALIAS[c.model] === 'shippoint';
    const link = sp ? (c.o.linkPrezentacjaShipPoint || c.o.linkPrezentacja) : c.o.linkPrezentacja;
    const kiedy = c.l.nextTaskDate && c.l.nextTaskDate > todayISO() ? fdtLong(c.l.nextTaskDate + (c.l.nextTaskTime ? 'T' + c.l.nextTaskTime : '')) : 'w ciągu 2–3 dni';
    if (sp) return {
      subject: 'Ship Point – informacje o współpracy z ShipCenter',
      body: `${powitanie(c)}

dziękuję za rozmowę. Zgodnie z obietnicą przesyłam informacje o współpracy w modelu Ship Point${link ? ': ' + link : ' (prezentacja w załączniku)'}.

W skrócie:
• w obecnym lokalu można przyjmować nadania paczek u wielu przewoźników przez platformę ${c.o.www},
• opłata wstępna to ${fmtZl(c.o.partnerWstepna)}, abonament ${fmtZl(c.o.partnerMies)} miesięcznie,
• ShipCenter zapewnia dostęp do przewoźników, konto na platformie, naklejkę i materiały,
• można też prowadzić PaczkoPunkt InPost.

Zadzwonię ${kiedy}, żeby odpowiedzieć na pytania.${podpis(c)}` };
    return {
      subject: 'Prezentacja oferty franczyzowej ShipCenter',
      body: `${powitanie(c)}

dziękuję za rozmowę. Zgodnie z obietnicą przesyłam prezentację oferty franczyzowej ShipCenter${link ? ': ' + link : ' (w załączniku)'}.

W prezentacji jest opisane, jak działa punkt ShipCenter, z czego składa się przychód, co obejmuje pakiet startowy SMART (${fmtZl(c.o.licencja)} jednorazowo) i jak wygląda start punktu krok po kroku.${c.o.linkKalkulator ? `

Koszt startu razem z wyposażeniem można policzyć w kalkulatorze: ${c.o.linkKalkulator}` : ''}

Zadzwonię ${kiedy}, żeby odpowiedzieć na pytania.${podpis(c)}` };
  } },

  email_kalkulator: { grp: 'Prezentacja i kalkulator', n: 'Mail z kalkulatorem', kind: 'E-mail', f: c => ({
    subject: 'Kalkulator kosztów punktu ShipCenter',
    body: `${powitanie(c)}

przesyłam link do kalkulatora, w którym można samodzielnie skonfigurować punkt i sprawdzić koszt startu:
${c.o.linkKalkulator || PH('link do kalkulatora')}

Jak z niego korzystać:
1. Wariant SMART – jeśli ${c.g('ma Pan', 'ma Pani', 'mają Państwo', 'masz')} wyposażenie zgodne ze standardem ShipCenter: ${fmtZl(c.o.licencja)} jednorazowo.
2. Wariant FLEX – ${c.g('dobiera Pan', 'dobiera Pani', 'dobierają Państwo', 'dobierasz')} tylko brakujący sprzęt (meble, komputer, drukarki, skaner). Rabat rośnie z liczbą produktów, do ${c.o.flexRabat || 15}%.
3. Gotową konfigurację można wysłać z kalkulatora prosto do działu franczyzy.

Opłata miesięczna wynosi 0 zł w miesiącu, w którym punkt wyśle ponad ${c.o.progRabatu} paczek, a w pozostałych ${fmtZl(c.o.oplataMies)}.

Chętnie omówię konfigurację telefonicznie.${podpis(c)}` }) },

  sms_po_rozmowie: { grp: 'Pierwszy kontakt', n: 'Podziękowanie po rozmowie (SMS)', kind: 'SMS', f: c => ({ body: smsThanksText(c.l.id ? c.l : { model: 'franczyza' }) }) },

  sms_pierwszy: { grp: 'Pierwszy kontakt', n: 'Nie odebrał – prośba o kontakt (SMS)', kind: 'SMS', f: c => ({
    body: `${c.g('Dzień dobry', 'Dzień dobry', 'Dzień dobry', 'Cześć ' + c.imie)}, tu ${c.opiekunImie} z ShipCenter. Dziękuję za zgłoszenie w sprawie franczyzy${c.maMiasto ? ' (' + c.miasto + ')' : ''}. ${c.g('Kiedy mogę zadzwonić', 'Kiedy mogę zadzwonić', 'Kiedy mogę zadzwonić', 'Kiedy mogę zadzwonić')} na 15 min rozmowy? Mój numer: ${c.opiekunTel}` }) },

  email_followup: { grp: 'Brak odpowiedzi', n: 'Przypomnienie po braku odpowiedzi', kind: 'E-mail', f: c => ({
    subject: 'Punkt ShipCenter – czy temat jest nadal aktualny?',
    body: `${powitanie(c)}

próbowaliśmy się skontaktować w sprawie franczyzy ShipCenter${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}, ale nie udało nam się porozmawiać.

${c.g('Czy temat jest dla Pana nadal aktualny?', 'Czy temat jest dla Pani nadal aktualny?', 'Czy temat jest dla Państwa nadal aktualny?', 'Czy temat jest dla Ciebie nadal aktualny?')} Jeśli tak, wystarczy odpisać jednym zdaniem z dogodną porą na telefon albo wybrać termin w kalendarzu: ${c.linkKalendarz}

Na rozmowie mogę też od razu wstępnie ocenić lokalizację: liczbę mieszkańców, konkurencję i spodziewaną liczbę paczek.${podpis(c)}` }) },

  email_ostatni: { grp: 'Brak odpowiedzi', n: 'Ostatnia wiadomość (zamknięcie wątku)', kind: 'E-mail', f: c => ({
    subject: 'Zamykam temat franczyzy – chyba że…',
    body: `${powitanie(c)}

nie chcę zasypywać wiadomościami, więc to ostatnia z mojej strony. Zakładam, że franczyza ShipCenter nie jest teraz priorytetem – to zupełnie zrozumiałe.

${c.g('Gdyby Pan wrócił do tematu', 'Gdyby Pani wróciła do tematu', 'Gdyby Państwo wrócili do tematu', 'Gdybyś wrócił(a) do tematu')}, jestem pod numerem ${c.opiekunTel}. Warto wtedy sprawdzić, czy lokalizacja${c.maMiasto ? ' w miejscowości ' + c.miasto : ''} jest nadal wolna – w sieci obowiązuje ochrona ${c.o.ochrona} km, więc o dostępności decyduje kolejność zgłoszeń.${podpis(c)}` }) },

  email_zaproszenie: { grp: 'Spotkanie', n: 'Zaproszenie na prezentację online', kind: 'E-mail', f: c => ({
    subject: 'Zaproszenie: prezentacja franczyzy ShipCenter (45 min)',
    body: `${powitanie(c)}

dziękuję za rozmowę. Tak jak ustaliliśmy, zapraszam na prezentację modelu biznesowego ShipCenter.

Podczas spotkania (ok. 45 minut) pokażę:
1. jak wygląda dzień pracy w punkcie i obsługa klienta na platformie ${c.o.www},
2. z czego składa się przychód punktu i jakie są koszty stałe,
3. wymagania wobec lokalu, obsady i godzin otwarcia,
4. przebieg startu: umowa, szkolenie (${c.o.szkolenie}), uruchomienie punktu ${c.o.uruchomienie},
5. wstępną ocenę lokalizacji${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}.

Proponowany termin: ${c.spotkanie}
Forma: ${c.formaSpotkania}
Link / miejsce: ${c.miejsce}

${c.g('Jeśli termin Panu nie odpowiada', 'Jeśli termin Pani nie odpowiada', 'Jeśli termin Państwu nie odpowiada', 'Jeśli termin Ci nie odpowiada')}, proszę wybrać inny: ${c.linkKalendarz}${podpis(c)}` }) },

  email_potwierdzenie: { grp: 'Spotkanie', n: 'Potwierdzenie spotkania i agenda', kind: 'E-mail', f: c => ({
    subject: `Potwierdzenie: ${c.spotkanie} – ShipCenter`,
    body: `${powitanie(c)}

potwierdzam nasze spotkanie: ${c.spotkanie} (${c.formaSpotkania}).
Link / miejsce: ${c.miejsce}

Agenda:
• model biznesowy i źródła przychodu punktu,
• koszty startu i opłaty (licencja ${fmtZl(c.o.licencja)}, opłata miesięczna ${fmtZl(c.o.oplataMies)}),
• lokalizacja${c.maMiasto ? ' – ' + c.miasto : ''}: ruch, konkurencja, potencjał,
• pytania i kolejne kroki.

${c.g('Warto, żeby Pan przygotował', 'Warto, żeby Pani przygotowała', 'Warto, żeby Państwo przygotowali', 'Warto, żebyś przygotował(a)')} adres lub okolicę rozważanego lokalu – dzięki temu od razu porozmawiamy o konkretach.${podpis(c)}` }) },

  sms_przypomnienie: { grp: 'Spotkanie', n: 'Przypomnienie o spotkaniu (SMS)', kind: 'SMS', f: c => ({
    body: `${c.g('Dzień dobry', 'Dzień dobry', 'Dzień dobry', 'Cześć ' + c.imie)}, przypominam o spotkaniu ShipCenter: ${c.spotkanie}. ${c.l.meetingType === 'online' || !c.l.meetingType ? 'Link: ' + c.miejsce : 'Miejsce: ' + c.miejsce}. Do zobaczenia! ${c.opiekunImie}, ${c.opiekunTel}` }) },

  email_podsumowanie: { grp: 'Po spotkaniu', n: 'Podsumowanie i kolejne kroki', kind: 'E-mail', f: c => ({
    subject: 'Podsumowanie spotkania i kolejne kroki – ShipCenter',
    body: `${powitanie(c)}

dziękuję za dzisiejsze spotkanie. Krótkie podsumowanie:

Ustalenia:
• ${PH('najważniejsze ustalenie 1')}
• ${PH('najważniejsze ustalenie 2')}

Kolejne kroki:
1. ${c.g('Pan przesyła', 'Pani przesyła', 'Państwo przesyłają', 'Przesyłasz')} dane lokalu (adres, metraż, czynsz, zdjęcia witryny) – na tej podstawie przygotujemy analizę lokalizacji.
2. ShipCenter przygotowuje raport: szacowana liczba paczek, konkurencja w promieniu 3 km, przepustowość punktu i wstępny rachunek.
3. Omawiamy raport i warunki umowy na krótkiej rozmowie.

W załączeniu przesyłam materiały z prezentacji. W razie pytań jestem do dyspozycji.${podpis(c)}` }) },

  email_dane_lokalizacji: { grp: 'Po spotkaniu', n: 'Prośba o dane do analizy lokalizacji', kind: 'E-mail', f: c => ({
    subject: 'Analiza lokalizacji – potrzebne informacje',
    body: `${powitanie(c)}

aby przygotować analizę lokalizacji${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}, ${c.g('proszę Pana', 'proszę Panią', 'proszę Państwa', 'proszę Cię')} o kilka informacji:

1. Adres lokalu (lub ulica / okolica, jeśli lokal jest dopiero szukany).
2. Powierzchnia sali obsługi i zaplecza (m²) – zaplecze służy do składowania paczek przed odbiorem przez kuriera.
3. Czynsz netto i szacunkowe media miesięcznie.
4. Typ okolicy: ulica handlowa, osiedle, galeria, park handlowy, strefa biznesowa.
5. Czy przy lokalu jest parking i jak widoczna jest witryna z ulicy.
6. Planowana obsada: ile osób i w jakich godzinach (punkt działa ${c.o.godziny}).
7. 2–3 zdjęcia witryny i wnętrza.
8. Czy ${c.g('rozważa Pan', 'rozważa Pani', 'rozważają Państwo', 'rozważasz')} również PaczkoPunkt InPost w tym lokalu.

Konkurencję w okolicy (paczkomaty, punkty odbioru, placówki pocztowe) sprawdzimy po naszej stronie. Raport będzie gotowy w ciągu 2–3 dni roboczych od otrzymania danych.${podpis(c)}` }) },

  email_raport: { grp: 'Po spotkaniu', n: 'Przesłanie raportu lokalizacji', kind: 'E-mail', f: c => {
    const r = c.loc;
    const facts = r ? `• ocena lokalizacji: ${r.score}/100 (${r.gradeText}),
• szacowany popyt: ok. ${fmt(r.demand.base)} paczek miesięcznie (zakres ${fmt(r.demand.low)}–${fmt(r.demand.high)}),
• przepustowość przy planowanej obsadzie: ok. ${fmt(r.capacity)} paczek miesięcznie (wykorzystanie ${pct(r.util)}),
• konkurencja w promieniu 3 km: ${r.compCount} punktów (indeks presji ${fmt(r.ci, 2)}),
• wstępny wynik miesięczny w scenariuszu bazowym: ${zl(r.fin.base.profit)}.` : `• ${PH('ocena lokalizacji – utwórz analizę w zakładce Lokalizacje')}`;
    return {
      subject: `Raport lokalizacji${c.maMiasto ? ' – ' + c.miasto : ''} | ShipCenter`,
      body: `${powitanie(c)}

w załączniku przesyłam raport analizy lokalizacji${c.locDoc && c.locDoc.address ? ': ' + c.locDoc.address : c.maMiasto ? ' w miejscowości ' + c.miasto : ''}.

Najważniejsze wnioski:
${facts}

Raport opiera się na danych o lokalu i okolicy oraz założeniach sieci – to szacunek, a nie gwarancja wyników. Ostateczny wynik zależy przede wszystkim od zaangażowania w pozyskiwanie klientów biznesowych i aktywności w punkcie.

Proponuję 30-minutową rozmowę, na której omówimy raport i warunki umowy. ${c.g('Jaki termin będzie dla Pana dogodny?', 'Jaki termin będzie dla Pani dogodny?', 'Jaki termin będzie dla Państwa dogodny?', 'Jaki termin będzie dla Ciebie dogodny?')}${podpis(c)}` };
  } },

  email_oferta: { grp: 'Domknięcie', n: 'Oferta i zaproszenie do podpisania umowy', kind: 'E-mail', f: c => ({
    subject: 'Oferta franczyzowa ShipCenter i projekt umowy',
    body: `${powitanie(c)}

dziękuję za dotychczasowe rozmowy. Zgodnie z ustaleniami przesyłam ofertę otwarcia punktu ShipCenter${c.maMiasto ? ' w miejscowości ' + c.miasto : ''} oraz projekt umowy franczyzowej wraz z OWU.

Najważniejsze warunki:
• pakiet startowy SMART: ${fmtZl(c.o.licencja)} + VAT (płatny w ciągu 7 dni od podpisania umowy),
• opłata miesięczna: 0 zł w miesiącu z ponad ${c.o.progRabatu} paczkami, w pozostałych ${fmtZl(c.o.oplataMies)} + VAT,
• koszt obsługi płatności online: ${fmt(c.o.prowizjaP24, 1)}% wartości transakcji,
• umowa na czas nieokreślony, okres wypowiedzenia 2 miesiące,
• ochrona terytorialna: inny punkt sieci nie powstanie bliżej niż ${c.o.ochrona} km,
• szkolenie wstępne: ${c.o.szkolenie}, uruchomienie punktu ${c.o.uruchomienie},
• sprzęt: wariant SMART (własne wyposażenie zgodne ze standardem) lub FLEX (dobór sprzętu z rabatem do ${c.o.flexRabat || 15}%),
• standard działania: ${c.o.godziny}, min. ${c.o.minPaczek} paczek miesięcznie przez platformę.

Proponowane kolejne kroki:
1. lektura umowy i OWU – chętnie odpowiem na pytania na krótkiej rozmowie,
2. podpisanie umowy (termin: ${PH('data')}),
3. szkolenie i przygotowanie lokalu, start punktu.

${c.g('Czy możemy umówić się na rozmowę o umowie w tym tygodniu?', 'Czy możemy umówić się na rozmowę o umowie w tym tygodniu?', 'Czy możemy umówić się na rozmowę o umowie w tym tygodniu?', 'Czy możemy umówić się na rozmowę o umowie w tym tygodniu?')}${podpis(c)}` }) },

  email_powitanie: { grp: 'Domknięcie', n: 'Powitanie w sieci po podpisaniu umowy', kind: 'E-mail', f: c => ({
    subject: 'Witamy w sieci ShipCenter – plan uruchomienia punktu',
    body: `${powitanie(c)}

witamy w sieci ShipCenter! Cieszymy się, że${c.maMiasto ? ' w miejscowości ' + c.miasto : ''} powstanie nowy punkt.

Plan na najbliższe tygodnie:
1. Szkolenie wstępne: ${c.o.szkolenie} – termin: ${PH('data szkolenia')} (w ciągu 30 dni od podpisania umowy).
2. Dostęp do platformy: subkonto ${c.o.www}, 2 adresy e-mail @shipcenter.pl, podstrona punktu.
3. Oznakowanie lokalu zgodnie z wytycznymi sieci i wpis w Google Maps.
4. Uruchomienie punktu ${c.o.uruchomienie}.
5. Pierwsze działania sprzedażowe: oferty do lokalnych firm przez platformę i ogłoszenia lokalne.

${c.g('Pytania proszę kierować do mnie:', 'Pytania proszę kierować do mnie:', 'Pytania proszę kierować do mnie:', 'Pytania kieruj śmiało do mnie:')} ${c.opiekunTel}, ${c.opiekunEmail}.${podpis(c)}` }) },

  email_umowa_wglad: { grp: 'Domknięcie', n: 'Umowa do wglądu', kind: 'E-mail', f: c => {
    const sp = c.model === 'shippoint' || MODEL_ALIAS[c.model] === 'shippoint';
    return {
      subject: sp ? 'Umowa Ship Center Point – wzór do wglądu' : 'Umowa franczyzowa ShipCenter – wzór do wglądu',
      body: `${powitanie(c)}

zgodnie z rozmową przesyłam w załączniku wzór ${sp ? 'umowy o współpracy Ship Center Point' : 'umowy franczyzowej ShipCenter wraz z Ogólnymi Warunkami Umów (OWU)'} do spokojnego zapoznania się.

Najważniejsze zapisy w skrócie:
${sp ? `• opłata wstępna ${fmtZl(c.o.partnerWstepna)}, abonament ${fmtZl(c.o.partnerMies)} miesięcznie,
• umowa na czas nieokreślony z 1-miesięcznym okresem wypowiedzenia,
• dostęp do przewoźników i platformy ${c.o.www}, naklejka i materiały w cenie.` : `• pakiet startowy SMART: ${fmtZl(c.o.licencja)} jednorazowo,
• opłata miesięczna 0 zł w miesiącu z ponad ${c.o.progRabatu} paczkami, w pozostałych ${fmtZl(c.o.oplataMies)},
• umowa na czas nieokreślony z 2-miesięcznym okresem wypowiedzenia,
• ochrona terytorialna ${c.o.ochrona} km, szkolenie ${c.o.szkolenie}.`}

Umowę podpisujemy elektronicznie w Autenti – bez wizyty i drukowania. Gdy ${c.g('będzie Pan gotowy', 'będzie Pani gotowa', 'będą Państwo gotowi', 'będziesz gotowy/a')}, wyślę dokument do podpisu.

Chętnie odpowiem na pytania do zapisów – ${c.g('proszę dać znać', 'proszę dać znać', 'proszę dać znać', 'daj znać')}, kiedy porozmawiamy.${podpis(c)}` };
  } },

  email_szkolenie: { grp: 'Domknięcie', n: 'Termin szkolenia w centrali', kind: 'E-mail', f: c => ({
    subject: 'Szkolenie wstępne ShipCenter – termin i informacje',
    body: `${powitanie(c)}

potwierdzam termin szkolenia wstępnego w centrali ShipCenter:

Termin: ${c.l.trainingStart ? fdate(c.l.trainingStart) + ' – ' + fdate(c.l.trainingEnd || trainingEnd(c.l.trainingStart)) : PH('termin szkolenia')} (3 dni)
Miejsce: ${c.l.trainingPlace || 'centrala ShipCenter, ' + c.o.adres}
Godziny: ${PH('np. 9:00–16:00')}

Podczas szkolenia omówimy obsługę platformy ${c.o.www}, nadawanie przesyłek krajowych, zagranicznych i paletowych, wydania paczek, sprzedaż usług dodatkowych (pieczątki, poligrafia, pakowanie) oraz pozyskiwanie klientów biznesowych.

Proszę zabrać ze sobą: ${PH('dokumenty / laptop / dane firmy')}.${podpis(c)}` }) },

  email_webinar: { grp: 'Marketing', n: 'Zaproszenie na webinar', kind: 'E-mail', f: c => ({
    subject: 'Webinar: jak otworzyć punkt nadawczy ShipCenter',
    body: `${powitanie(c)}

zapraszam na bezpłatny webinar „Jak otworzyć punkt ShipCenter – koszty, przychody, lokalizacja”.

Termin: ${PH('data i godzina webinaru')}
Zapisy: ${c.linkWebinar}

W programie:
• jak zarabia punkt nadawczy obsługujący wielu przewoźników,
• ile kosztuje start i jakie są opłaty w sieci,
• jak wybrać lokal i sprawdzić konkurencję,
• rozmowa z działającym franczyzobiorcą i pytania na żywo.

Webinar potrwa ok. 45 minut. Nagranie wyślemy wszystkim zapisanym.${podpis(c)}` }) },

  email_reaktywacja: { grp: 'Marketing', n: 'Reaktywacja wstrzymanego leada', kind: 'E-mail', f: c => ({
    subject: 'Wracam z tematem franczyzy ShipCenter',
    body: `${powitanie(c)}

jakiś czas temu ${c.g('rozmawialiśmy o otwarciu punktu ShipCenter', 'rozmawialiśmy o otwarciu punktu ShipCenter', 'rozmawialiśmy o otwarciu punktu ShipCenter', 'rozmawialiśmy o otwarciu punktu ShipCenter')}${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}. Odzywam się, bo ${PH('powód: nowy webinar / wolna lokalizacja / zmiana w ofercie')}.

Lokalizacja${c.maMiasto ? ' ' + c.miasto : ''} jest nadal dostępna, ale w sieci obowiązuje ochrona ${c.o.ochrona} km i decyduje kolejność. ${c.g('Czy chciałby Pan wrócić do rozmowy?', 'Czy chciałaby Pani wrócić do rozmowy?', 'Czy chcieliby Państwo wrócić do rozmowy?', 'Czy chcesz wrócić do rozmowy?')} Wystarczy krótka odpowiedź z dogodnym terminem.${podpis(c)}` }) },

  linkedin_outbound: { grp: 'Marketing', n: 'Wiadomość LinkedIn (outbound)', kind: 'LinkedIn', f: c => ({
    body: `${c.g('Dzień dobry,', 'Dzień dobry,', 'Dzień dobry,', `Cześć ${c.imie},`)} rozwijam sieć punktów nadawczych ShipCenter${c.region ? ' w ' + c.region : ''}. Szukamy przedsiębiorców, którzy chcą prowadzić własny punkt obsługujący nadania paczek u wielu przewoźników – z platformą, szkoleniem i ochroną terytorialną ${c.o.ochrona} km. ${c.g('Czy byłby Pan otwarty na 15-minutową rozmowę?', 'Czy byłaby Pani otwarta na 15-minutową rozmowę?', 'Czy byliby Państwo otwarci na 15-minutową rozmowę?', 'Masz 15 minut na rozmowę w tym tygodniu?')}` }) },

  email_partner: { grp: 'Pierwszy kontakt', n: 'Ship Point – odpowiedź na zapytanie', kind: 'E-mail', f: c => ({
    subject: 'Ship Point – dodatkowy przychód z nadawania paczek',
    body: `${powitanie(c)}

dziękuję za zapytanie o Ship Point. To model dla firm, które ${c.g('tak jak Pan', 'tak jak Pani', 'tak jak Państwo', 'tak jak Ty')} mają już lokal dostępny dla klientów (sklep, punkt usługowy) i chcą dodatkowo nadawać paczki.

Na czym to polega:
• w obecnym lokalu można przyjmować nadania paczek u wielu przewoźników przez platformę ${c.o.www},
• opłata wstępna to ${fmtZl(c.o.partnerWstepna)}, abonament ${fmtZl(c.o.partnerMies)} miesięcznie,
• ShipCenter zapewnia dostęp do przewoźników, konto na platformie, naklejkę i materiały,
• dodatkowo możliwe jest prowadzenie PaczkoPunktu InPost.

To sposób na dodatkowy przychód i nowych klientów w sklepie bez inwestycji w nowy lokal. ${c.g('Czy możemy porozmawiać 10 minut?', 'Czy możemy porozmawiać 10 minut?', 'Czy możemy porozmawiać 10 minut?', 'Masz 10 minut na rozmowę?')}${podpis(c)}` }) },

  email_polecenie: { grp: 'Marketing', n: 'Prośba o polecenie (do franczyzobiorców)', kind: 'E-mail', f: c => ({
    subject: 'Znasz kogoś, kto chce otworzyć punkt ShipCenter?',
    body: `Dzień dobry,

rozwijamy sieć ShipCenter i szukamy kolejnych franczyzobiorców. Najlepsi kandydaci często przychodzą z polecenia – od osób, które znają realia prowadzenia punktu.

Jeśli znasz kogoś, kto myśli o własnym biznesie (najlepiej w mieście bez punktu ShipCenter lub co najmniej ${c.o.ochrona} km od istniejących punktów), prześlij mi proszę jego kontakt albo przekaż mój numer: ${c.opiekunTel}.

Za polecenie zakończone podpisaniem umowy przewidujemy premię: ${PH('wysokość premii')}.

Dziękuję!${podpis(c)}` }) },

  skrypt_pierwsza: { grp: 'Skrypty rozmów', n: 'Pierwsza rozmowa – kwalifikacja', kind: 'Skrypt', f: c => ({
    body: `SKRYPT: PIERWSZA ROZMOWA KWALIFIKACYJNA (10–15 min)
Kandydat: ${c.pelne} · ${c.maMiasto ? c.miasto : 'miasto do ustalenia'} · źródło: ${SOURCE_MAP[c.l.source]?.n || '—'}

1. OTWARCIE (30 s)
„Dzień dobry, ${c.opiekunImie} z ShipCenter. ${c.g('Zostawił Pan', 'Zostawiła Pani', 'Zostawili Państwo', 'Zostawiłeś/aś')} zgłoszenie w sprawie franczyzy – czy to dobry moment na 15 minut rozmowy?”
→ Nie: „Kiedy mogę oddzwonić?” – zapisz termin jako następne zadanie.

2. CEL ROZMOWY (20 s)
„Chcę poznać ${c.g('Pana', 'Pani', 'Państwa', 'Twoje')} plany, krótko opowiedzieć, jak działa punkt, i ustalić, czy umawiamy się na pełną prezentację.”

3. PYTANIA KWALIFIKACYJNE (zapisuj odpowiedzi w notatkach)
☐ Motywacja: „Co skłoniło ${c.g('Pana', 'Panią', 'Państwa', 'Cię')} do szukania własnego biznesu?”
☐ Lokalizacja: „W jakim mieście i okolicy ${c.g('widzi Pan', 'widzi Pani', 'widzą Państwo', 'widzisz')} punkt? Jest już lokal?”
☐ Kapitał: „Start to opłata licencyjna ${fmtZl(c.o.licencja)} plus przygotowanie lokalu. Jaki budżet ${c.g('ma Pan', 'ma Pani', 'mają Państwo', 'masz')} na start?”
☐ Czas: „Kto będzie na co dzień prowadził punkt? Punkt działa ${c.o.godziny}.”
☐ Doświadczenie: obsługa klienta, sprzedaż, logistyka, własna firma?
☐ Termin: „Kiedy ${c.g('chciałby Pan', 'chciałaby Pani', 'chcieliby Państwo', 'chcesz')} wystartować?”
☐ Model: punkt stacjonarny / bez punktu (${fmtZl(c.o.licencjaBezPunktu)}) / Partner w istniejącym lokalu.

4. PREZENTACJA W 60 SEKUND
„ShipCenter to sieć punktów nadawczych. W punkcie klient nadaje paczkę lub paletę u jednego z wielu przewoźników – ${c.o.przewoznicy}. Franczyzobiorca zarabia na każdej przesyłce, obsługuje osoby prywatne i lokalne firmy. My dajemy platformę, cenniki, szkolenie, marketing i ochronę ${c.o.ochrona} km. Start w ciągu miesiąca od umowy.”

5. KWALIFIKACJA – DECYZJA
Zakwalifikowany, gdy: realny budżet na start, konkretna lokalizacja (lub gotowość szukania), osoba do prowadzenia punktu, start w ciągu 3 miesięcy.
→ TAK: umów prezentację (45 min), ustaw etap „Kwalifikacja” i termin spotkania.
→ NIE TERAZ: status „Wstrzymany”, zadanie przypomnienia za 30–60 dni.
→ NIE: status „Utracony” + powód.

6. ZAMKNIĘCIE
„Proponuję prezentację online, na której pokażę liczby i wstępnie ocenimy lokalizację. Pasuje ${PH('dzień')} o ${PH('godzina')}? Wyślę potwierdzenie mailem.”` }) },

  skrypt_prezentacja: { grp: 'Skrypty rozmów', n: 'Prezentacja modelu biznesowego', kind: 'Skrypt', f: c => ({
    body: `SKRYPT: PREZENTACJA MODELU BIZNESOWEGO (45 min)
Kandydat: ${c.pelne} · ${c.maMiasto ? c.miasto : '—'} · kapitał: ${c.l.capital ? zl(+c.l.capital) : 'nie podano'} · lokal: ${({ ma: 'ma lokal', szuka: 'szuka lokalu', nie: 'brak' })[c.l.hasPremises] || 'nie wiadomo'}

0–5 min · PRZYPOMNIENIE CELU
„Na koniec spotkania będziemy wiedzieć, czy lokalizacja ma sens i jakie są kolejne kroki.” Zapytaj, co się zmieniło od ostatniej rozmowy.

5–15 min · JAK DZIAŁA PUNKT
• Klient przychodzi z paczką → nadanie przez platformę ${c.o.www} → wybór przewoźnika i ceny → etykieta → odbiór przez kuriera.
• Klienci: osoby prywatne (nadania, zwroty), sklepy internetowe, firmy z okolicy (stałe nadania, palety, przesyłki zagraniczne).
• Dodatkowo: możliwość PaczkoPunktu InPost w tym samym lokalu.

15–25 min · PIENIĄDZE
• Start: licencja ${fmtZl(c.o.licencja)}, przygotowanie i oznakowanie lokalu, kaucja za najem.
• Opłaty: ${fmtZl(c.o.oplataMies)} miesięcznie (0 zł po miesiącu z min. ${c.o.progRabatu} paczkami), ${fmt(c.o.prowizjaP24, 1)}% od płatności online.
• Przychód: marża od każdej przesyłki – pokaż przykładowy rachunek z raportu lokalizacji.
• Zasada: nie obiecujemy wyniku – zależy od lokalizacji i aktywności w pozyskiwaniu firm.

25–35 min · LOKALIZACJA
• Ruch pieszy, widoczność witryny, parking, firmy wysyłające paczki w okolicy.
• Konkurencja: paczkomaty, punkty odbioru w sklepach, poczta, inne punkty nadań.
• Ochrona ${c.o.ochrona} km dla punktu.

35–40 min · WYMAGANIA I START
• ${c.o.godziny}; min. ${c.o.minPaczek} paczek miesięcznie, regularne oferty do lokalnych firm i ogłoszenia lokalne.
• Szkolenie: ${c.o.szkolenie}; uruchomienie ${c.o.uruchomienie}.

40–45 min · KOLEJNY KROK
„Następny krok to analiza lokalizacji. Potrzebuję adresu lokalu, metrażu, czynszu i zdjęć. Raport przygotuję w 2–3 dni. Kiedy ${c.g('może Pan', 'może Pani', 'mogą Państwo', 'możesz')} przesłać dane?”
→ Ustaw etap „Spotkanie”, zadanie „Zebrać dane do analizy lokalizacji”.` }) },

  skrypt_obiekcje: { grp: 'Skrypty rozmów', n: 'Obsługa obiekcji', kind: 'Skrypt', f: c => ({
    body: `OBSŁUGA OBIEKCJI – zasada: dopytaj → przyznaj rację → odpowiedz faktem → zapytaj o kolejny krok

„TO ZA DROGO”
Dopytaj: „W porównaniu z czym? Która część kosztów budzi wątpliwość?”
Odpowiedź: pakiet SMART ${fmtZl(c.o.licencja)} płaci się raz; opłata miesięczna wynosi 0 zł w miesiącu z ponad ${c.o.progRabatu} paczkami (inaczej ${fmtZl(c.o.oplataMies)}). Sprzęt można mieć własny (SMART) albo dobrać z rabatem do ${c.o.flexRabat || 15}% (FLEX). Alternatywy: franczyza bez punktu (${fmtZl(c.o.licencjaBezPunktu)}) albo model Partner w istniejącym lokalu (${fmtZl(c.o.partnerWstepna)} + ${fmtZl(c.o.partnerMies)}/mies.).
Pytanie: „Czy jeśli analiza pokaże realny popyt, koszt startu przestanie być barierą?”

„PACZKOMATY I ŻABKI ZABIORĄ MI KLIENTÓW”
Dopytaj: „Jakie punkty są w okolicy?”
Odpowiedź: paczkomat obsługuje głównie jednego przewoźnika i proste nadania. Punkt ShipCenter obsługuje wielu przewoźników, palety, przesyłki zagraniczne, pakowanie i stałą współpracę z firmami. Konkurencję liczymy w raporcie lokalizacji.
Pytanie: „Sprawdzimy to na liczbach w analizie?”

„NIE MAM DOŚWIADCZENIA”
Odpowiedź: szkolenie ${c.o.szkolenie}, stałe wsparcie centrali, gotowa platforma i cenniki. Najważniejsze jest nastawienie na obsługę klienta i aktywne pozyskiwanie firm.

„ILE ZAROBIĘ?”
Odpowiedź: „Nie obiecujemy wyniku, bo zależy od lokalizacji i Twojej aktywności. Dlatego przygotowujemy analizę: szacowany popyt, konkurencja, przepustowość i rachunek w trzech scenariuszach.”
→ Zaproponuj analizę lokalizacji.

„NIE MAM LOKALU”
Odpowiedź: pomożemy ocenić 2–3 lokale analizą. Można też zacząć od franczyzy bez punktu (${fmtZl(c.o.licencjaBezPunktu)}) – bez wymogów lokalu i godzin otwarcia, z minimum ${c.o.minPaczek} paczek miesięcznie.

„MUSZĘ SIĘ ZASTANOWIĆ / PORADZIĆ SIĘ RODZINY”
Dopytaj: „Co jest dla ${c.g('Pana', 'Pani', 'Państwa', 'Ciebie')} najważniejsze przy tej decyzji? Czego brakuje, żeby podjąć decyzję?”
Działanie: zaproponuj rozmowę z udziałem osoby współdecydującej, ustal konkretny termin kontaktu.

„A JEŚLI SIĘ NIE UDA?”
Odpowiedź: umowa na czas nieokreślony z 2-miesięcznym wypowiedzeniem; warunki wcześniejszego zakończenia (w pierwszych 12 miesiącach) są opisane w umowie i OWU – omówimy je otwarcie przed podpisaniem.

„KONKURENCYJNA FRANCZYZA JEST TAŃSZA”
Dopytaj: „Co obejmuje ich opłata?” Porównaj: liczba przewoźników, palety i zagranica, ochrona ${c.o.ochrona} km, szkolenie, platforma z fakturowaniem klientów.` }) },

  skrypt_domkniecie: { grp: 'Skrypty rozmów', n: 'Rozmowa domykająca', kind: 'Skrypt', f: c => ({
    body: `SKRYPT: ROZMOWA DOMYKAJĄCA (20–30 min)
Kandydat: ${c.pelne}${c.loc ? ` · ocena lokalizacji ${c.loc.score}/100, popyt ok. ${fmt(c.loc.demand.base)} paczek/mies.` : ''}

1. PODSUMOWANIE DROGI
„Przeszliśmy przez model, liczby i analizę lokalizacji${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}. Zanim porozmawiamy o umowie – czy coś pozostało niejasne?”

2. POTWIERDZENIE KRYTERIÓW
☐ Lokal: adres, umowa najmu, termin dostępności
☐ Finansowanie startu: licencja ${fmtZl(c.o.licencja)} + przygotowanie lokalu
☐ Osoba prowadząca punkt i godziny pracy
☐ Działalność z PKD 53.20.Z (lub gotowość jej rejestracji)

3. PYTANIE O DECYZJĘ
„Czy ${c.g('jest Pan gotowy', 'jest Pani gotowa', 'są Państwo gotowi', 'jesteś gotowy/a')}, żebyśmy przygotowali umowę na tę lokalizację?”
→ TAK: ustal datę podpisania i termin szkolenia (w ciągu 30 dni). Etap „Oferta” → po podpisaniu „Umowa podpisana”.
→ WAHANIE: „Co musiałoby się wydarzyć, żeby ${c.g('był Pan pewny', 'była Pani pewna', 'byli Państwo pewni', 'mieć pewność')}?” – wróć do skryptu obiekcji.
→ NIE: zapisz powód, zaproponuj kontakt za 60 dni.

4. LOKALIZACJA I OCHRONA
„Lokalizację rezerwujemy w chwili podpisania umowy – inny punkt sieci nie powstanie bliżej niż ${c.o.ochrona} km.”

5. KOLEJNE KROKI PO TAK
1) projekt umowy i OWU mailem dziś, 2) podpisanie: ${PH('data')}, 3) płatność licencji w 7 dni, 4) szkolenie: ${PH('termin')}, 5) uruchomienie ${c.o.uruchomienie}.` }) },

  skrypt_voicemail: { grp: 'Skrypty rozmów', n: 'Nagranie na pocztę głosową', kind: 'Skrypt', f: c => ({
    body: `„Dzień dobry, ${c.opiekunImie} z ShipCenter, dzwonię w sprawie zgłoszenia dotyczącego franczyzy${c.maMiasto ? ' w miejscowości ' + c.miasto : ''}. Chcę umówić krótką, 15-minutową rozmowę. Mój numer to ${c.opiekunTel} – powtarzam: ${c.opiekunTel}. Wyślę też SMS. Dziękuję i do usłyszenia.”

Po nagraniu: wyślij SMS (szablon „Pierwszy kontakt (SMS)”), dodaj wpis w historii „Nie odebrał”, ustaw zadanie „Ponowna próba kontaktu” na jutro.` }) },

  wew_przekazanie: { grp: 'Wewnętrzne', n: 'Notatka przekazania leada', kind: 'Notatka', f: c => {
    const l = c.l; const hist = (l.history || []).filter(h => h.type !== 'system').sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, 3);
    return { body: `PRZEKAZANIE LEADA ${l.id ? leadCode(l.id) : ''}
Kandydat: ${c.pelne}${l.company ? ' (' + l.company + ')' : ''}
Kontakt: ${l.phone || '—'} · ${l.email || '—'}
Lokalizacja: ${c.maMiasto ? c.miasto : '—'}${l.region ? ', ' + l.region : ''}
Źródło: ${SOURCE_MAP[l.source]?.n || '—'} · w bazie od ${fdate(l.createdAt)}
Etap: ${STAGES[stageIdx(l)].n} · status: ${STATUS_MAP[l.status]?.n || '—'}
Model: ${MODELS.find(m => m.k === l.model)?.n || '—'} · kapitał: ${l.capital ? zl(+l.capital) : 'nie podano'} · lokal: ${({ ma: 'ma lokal', szuka: 'szuka', nie: 'brak' })[l.hasPremises] || 'nie wiadomo'}
Następne zadanie: ${l.nextTask || '—'} (${l.nextTaskDate ? fdate(l.nextTaskDate) : 'bez terminu'})
Spotkanie: ${l.meetingAt ? fdtLong(l.meetingAt) : 'brak'}

Ostatnie kontakty:
${hist.length ? hist.map(h => `• ${fdate(h.at)} – ${CT_MAP[h.type]?.n || h.type}${h.result ? ' (' + h.result + ')' : ''}: ${h.text || ''}`).join('\n') : '• brak wpisów'}

Notatki:
${l.notes || '—'}

Uwagi przekazującego: ${PH('na co uważać, co obiecano')}` };
  } }
};

function renderMsgBody(text) {
  return esc(text).replace(/\[uzupełnij: [^\]]*\]/g, m => `<span class="ph">${m}</span>`);
}

function viewMessages() {
  const m = S.msg;
  const leads = leadsArr().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pl'));
  const l = m.leadId ? D().leads[m.leadId] : null;
  if (!TEMPLATES[m.tpl]) m.tpl = 'email_pierwszy';
  const t = TEMPLATES[m.tpl];
  const c = msgContext(l, m.form);
  const out = t.f(c);
  S.ui.msgOut = out;
  const groups = [...new Set(Object.values(TEMPLATES).map(x => x.grp))];
  const custom = S.ui.aiText;
  const head = `<div class="viewhead"><div class="grow"><span class="eyebrow">Komunikacja z kandydatami</span><h1>Wiadomości i skrypty</h1>
    <p>Gotowe e-maile, SMS-y i skrypty rozmów po polsku, wypełnione danymi leada i parametrami oferty ShipCenter. Pola <span class="pill warn">[uzupełnij]</span> wymagają ręcznej edycji.</p></div></div>`;
  const left = `<div class="card" style="padding:8px"><div class="tplist">${groups.map(gname => `<div class="grp">${esc(gname)}</div>${Object.entries(TEMPLATES).filter(([k, x]) => x.grp === gname).map(([k, x]) => `<button class="${k === m.tpl ? 'on' : ''}" data-act="tpl" data-k="${k}"><span class="pill outline tiny">${esc(x.kind)}</span>${esc(x.n)}</button>`).join('')}`).join('')}</div></div>`;
  const controls = `<div class="formgrid">
      <label class="field span2"><span>Kandydat</span><select id="msg-lead" data-msg="leadId">${opt('', '— bez leada (szablon ogólny) —', m.leadId)}${leads.map(x => opt(x.id, `${x.name}${x.city ? ' – ' + x.city : ''} (${STAGES[stageIdx(x)].short})`, m.leadId)).join('')}</select></label>
      <label class="field"><span>Forma zwrotu</span><select id="msg-form" data-msg="form">${Object.entries(FORMS).map(([k, n]) => opt(k, n.replace('forma ', ''), m.form)).join('')}</select></label>
    </div>`;
  const ai = S.sample ? `<div class="sep"></div><div class="formgrid"><label class="field full"><span>Poproś Claude o wersję lub nową wiadomość</span><input type="text" id="ai-instr" placeholder="np. krótsza i cieplejsza wersja · dodaj wątek PaczkoPunktu InPost · odpowiedź na pytanie o zyski"></label></div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="ai-rewrite">${ICONS.spark}Dopracuj z Claude</button><span class="note">Claude dostaje szablon, dane leada i warunki oferty. Nie dopisze obietnic finansowych.</span></div>` : '';
  const main = `<div class="card"><div class="cardhead"><h2>${esc(t.n)}</h2><span class="pill">${esc(t.kind)}</span></div>
    ${controls}
    <div class="sep"></div>
    ${out.subject ? `<div class="row between" style="margin-bottom:6px"><span class="small"><span class="muted">Temat:</span> <b>${esc(out.subject)}</b></span><button class="btn sm ghost" data-act="copy-subject">${ICONS.copy}Kopiuj temat</button></div>` : ''}
    <div class="msgout" id="msg-out">${renderMsgBody(out.body)}</div>
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="copy-msg">${ICONS.copy}Kopiuj ${out.subject ? 'treść' : ''}</button>
    ${t.kind === 'SMS' ? `<span class="note">${out.body.length} znaków · ${Math.ceil(out.body.length / 160)} SMS</span>` : ''}
    ${l ? `<button class="btn" data-act="msg-log" data-id="${l.id}">Zapisz wysłanie w historii leada</button><a class="btn ghost" href="#lead-${l.id}">Otwórz leada</a>` : ''}</div>
    ${ai}
    ${custom ? `<div class="sep"></div><div class="row between"><h3>Wersja od Claude</h3><div class="row"><button class="btn sm" data-act="copy-ai">${ICONS.copy}Kopiuj</button><button class="btn sm ghost" data-act="ai-clear">Usuń</button></div></div><div class="msgout" style="margin-top:8px" id="ai-out">${renderMsgBody(custom)}</div>` : ''}
  </div>`;
  return head + `<div class="split-side">${left}<div class="stack">${main}</div></div>`;
}

async function aiRewrite(btn) {
  if (!S.sample) return;
  const instr = ($('#ai-instr') || {}).value || 'Dopracuj styl, zachowaj fakty i strukturę.';
  const out = S.ui.msgOut || {};
  const l = S.msg.leadId ? D().leads[S.msg.leadId] : null;
  const o = offer();
  const prompt = `Jesteś doświadczonym specjalistą od rekrutacji franczyzobiorców sieci ShipCenter (punkty nadawcze paczek, wielu przewoźników). Pisz wyłącznie po polsku, poprawną polszczyzną, w formie zwrotu: ${formLabel(S.msg.form)}.
Zasady: nie wymyślaj nowych liczb ani obietnic zarobków (franczyzodawca nie gwarantuje wyników); używaj tylko faktów z danych poniżej; zostaw pola w nawiasach [uzupełnij: …], jeśli brakuje danych; zwróć sam tekst wiadomości (jeśli to e-mail – pierwsza linia „Temat: …”), bez komentarzy.

Warunki oferty: licencja ${o.licencja} zł netto, opłata miesięczna ${o.oplataMies} zł netto (0 zł w miesiącu po min. ${o.progRabatu} paczkach), ${o.prowizjaP24}% od płatności online, szkolenie ${o.szkolenie}, uruchomienie ${o.uruchomienie}, ochrona ${o.ochrona} km, godziny ${o.godziny}, min. ${o.minPaczek} paczek/mies., przewoźnicy: ${o.przewoznicy}. Franczyza bez punktu: ${o.licencjaBezPunktu} zł. Partner: ${o.partnerWstepna} zł + ${o.partnerMies} zł/mies.
Kandydat: ${l ? JSON.stringify({ imie_nazwisko: l.name, miasto: l.city, region: l.region, etap: STAGES[stageIdx(l)].n, status: STATUS_MAP[l.status]?.n, kapital: l.capital, lokal: l.hasPremises, model: l.model, notatki: (l.notes || '').slice(0, 800) }) : 'brak – szablon ogólny'}

Szablon (${TEMPLATES[S.msg.tpl].n}):
${out.subject ? 'Temat: ' + out.subject + '\n' : ''}${out.body}

Polecenie użytkownika: ${instr}`;
  btn.disabled = true; const label = btn.innerHTML; btn.innerHTML = 'Claude pisze…';
  S.ui.aiText = 'Claude pisze…'; scheduleRender();
  try {
    const res = await S.sample(prompt, { modelTier: 'default', onText: ({ text }) => { S.ui.aiText = text; const el = $('#ai-out'); if (el) el.innerHTML = renderMsgBody(text); } });
    S.ui.aiText = res.text;
  } catch (e) {
    S.ui.aiText = '';
    if (e && e.code === 'not_granted') { S.sample = null; toast('Dostęp do Claude nie został przyznany dla tej strony.', 'bad'); }
    else if (e && e.code === 'rate_limited') toast('Za dużo zapytań do Claude – spróbuj za chwilę.', 'bad');
    else toast('Claude nie odpowiedział: ' + (e && e.message || 'błąd'), 'bad');
  }
  btn.disabled = false; btn.innerHTML = label;
  scheduleRender();
}
