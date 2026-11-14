# kjanowski

## Panel franczyzy Ship Center (`panel/`)

Interaktywny panel do planowania, monitorowania i skalowania pozyskiwania franczyzobiorców Ship Center.
Opublikowany jako strona (Artifact) ze wspólną bazą danych zespołu.

**Widoki**
- **Centrala** – nowe leady (franczyza / Ship Point), pierwsza rozmowa do 24 h, wysłane prezentacje, konwersje lejka, nowe punkty vs cel, Google Ads (koszt leada i punktu), prognoza, źródła, opiekunowie, regiony, alerty. Filtry: okres, model, źródło, opiekun, region, status.
- **Kontakty** – przypomnienia: zaległe, dziś, jutro, 7 dni; nowe leady do pierwszego kontaktu; SMS w kolejce; licznik w menu dla zalogowanej osoby („To ja”).
- **Leady** – tabela i kanban, import CSV/XLSX (rozpoznaje „Ship Point”), eksport CSV i XLSX.
- **Lead** (`#lead-<id>`) – przebieg kontaktu: pierwsza rozmowa (z SMS-em z podziękowaniem), prezentacja wysłana (data), kolejny kontakt (data, godzina); historia, notatki, spotkanie, przekazanie leada.
- **Wiadomości i skrypty** – szablony po polsku (oferta 2026: pakiet SMART / FLEX, Ship Point), formy Państwo/Pan/Pani/Ty.
- **Lokalizacje** – popyt, przepustowość, konkurencja do 3 km, rachunek, raport dla kandydata (HTML/XLSX).
- **Zespół i ustawienia** – osoby, „To ja”, integracje, cel, parametry oferty.

Kolorystyka wg shipcenter.pl (Poppins, pomarańcz #ea580c, skala szarości).

**Budowanie**

```bash
./panel/build.sh   # składa panel/src/* w panel/dist/index.html
```

Źródła: `panel/src/` (`styles.css`, `shell.html`, moduły JS). Biblioteka XLSX: SheetJS 0.18.5 z cdnjs.
