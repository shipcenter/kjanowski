# kjanowski

## Panel franczyzy Ship Center (`panel/`)

Interaktywny panel do planowania, monitorowania i skalowania pozyskiwania franczyzobiorców Ship Center.
Opublikowany jako strona (Artifact) ze wspólną bazą danych zespołu.

**Widoki**
- **Centrala** – liczba leadów, konwersja między etapami lejka, CPL i koszt pozyskania punktu, prognoza nowych punktów (30/60/90 dni), plan a wykonanie, źródła, opiekunowie, regiony, alerty. Filtry: okres, źródło, opiekun, region, status.
- **Leady** – tabela i kanban (przeciąganie między etapami), import CSV/XLSX lub wklejenie z arkusza (z wykrywaniem duplikatów), operacje zbiorcze, eksport CSV i XLSX.
- **Lead** (`#lead-<id>`) – etapy, status kontaktu, opiekun, następne zadanie, spotkanie, przekazanie leada, historia kontaktów, notatki, gotowe wiadomości.
- **Plan i budżet** – warianty planu (15–30 tys. zł, cel 2–3 punkty/mies.), podział budżetu na kanały, CPL, konwersje, projekcja 90 dni z cyklem sprzedaży, wrażliwość na budżet, wydatki marketingowe.
- **Harmonogram 90 dni** – 13 tygodni, 4 fazy, działania marketingu, sprzedaży, lokalizacji i analityki.
- **Zadania tygodnia** – generator zadań z harmonogramu i przypomnień, następne kroki z leadów, spotkania, przekazania.
- **Wiadomości i skrypty** – 23 szablony po polsku (e-mail, SMS, LinkedIn, skrypty rozmów, obiekcje), formy Państwo/Pan/Pani/Ty, opcjonalne dopracowanie z Claude.
- **Lokalizacje** – popyt (osoby prywatne + firmy), przepustowość punktu, konkurencja w promieniu 3 km, rachunek w 3 scenariuszach, ocena 0–100 i raport dla kandydata (HTML/XLSX).
- **Zespół i ustawienia** – osoby i regiony, parametry oferty (wg wzoru umowy 01.09.2026 i OWU).

**Budowanie**

```bash
./panel/build.sh   # składa panel/src/* w panel/dist/index.html
```

Źródła: `panel/src/` (`styles.css`, `shell.html`, moduły JS). Biblioteka XLSX: SheetJS 0.18.5 z cdnjs.
