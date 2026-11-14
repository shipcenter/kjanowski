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

**Dane dostępowe do integracji**

Wzór zmiennych jest w `.env.example` (IMAP franczyza@, SMSAPI, SMTP, Google Maps, Google Ads). Prawdziwy plik `.env` tworzy się tylko tam, gdzie działa skrypt integracji. Jest w `.gitignore`, więc nie trafia do repozytorium. Danych dostępowych nie wkleja się do czatu. Klucze dla zadań uruchamianych przez Claude w chmurze wpisuje się w bezpiecznym formularzu sekretów środowiska.

**Automatyczna analiza lokalizacji (Mapy Google)**

`panel/tools/analiza_lokalizacji.py "adres"` geokoduje adres przez Places API (New). Potem szuka w promieniu 3 km punktów konkurencji: Epaka, Furgonetka, punkty nadawcze, paczkomaty i PaczkoPunkty InPost, Poczta Polska, DPD Pickup, DHL POP, Orlen Paczka, Żabka, Allegro One Box, GLS, UPS, inne punkty ShipCenter. Zwraca JSON z typem i odległością każdego punktu oraz podpowiedziami typu lokalizacji i ruchu, w formacie pól analizy w panelu. Klucz: sekret sieciowy środowiska dla `places.googleapis.com` (nagłówek `X-Goog-Api-Key`) albo zmienna `GOOGLE_MAPS_API_KEY`.

**Budowanie**

```bash
./panel/build.sh   # składa panel/src/* w panel/dist/index.html
```

Źródła: `panel/src/` (`styles.css`, `shell.html`, moduły JS). Biblioteka XLSX: SheetJS 0.18.5 z cdnjs.
