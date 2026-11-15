# ShipCenter Poczta – mostek pocztowy panelu franczyzy

Mały serwer (Node.js), przez który panel franczyzy w claude.ai:

- **pobiera zgłoszenia** ze skrzynki `franczyza@shipcenter.pl` („[shipcenter.pl] - ZAPYTANIE FRANCZYZOWE” i „[shipcenter.pl] - zapytanie ShipPoint”) i zakłada z nich leady,
- **pokazuje korespondencję** z kandydatem (Odebrane + Wysłane, wyszukiwanie po adresie e-mail),
- **wysyła maile** z `franczyza@shipcenter.pl` – z firmową stopką HTML (stopkę składa panel) i załącznikami; kopia trafia do folderu „Wysłane”, więc jest widoczna też w Thunderbirdzie.

Działa jako **serwer MCP** (Streamable HTTP). Panel łączy się z nim przez *własny konektor* w claude.ai, więc dane logowania do poczty zostają wyłącznie na tym serwerze.

```
panel (claude.ai) ──HTTPS──▶ https://mcp.shipcenter.pl/mcp/<MCP_SECRET> ──▶ Node :8787 ──▶ IMAP 143 / SMTP 587 (shipcenter.pl)
```

## Wymagania

- Node.js **20.6 lub nowszy** (`node -v`)
- dostęp z serwera do `shipcenter.pl` na portach IMAP (143) i SMTP (587 lub 465)
- subdomena z HTTPS, np. `mcp.shipcenter.pl` (Apache/Nginx jako reverse proxy, certyfikat Let's Encrypt)

## Instalacja

```bash
# katalog np. /opt/shipcenter-poczta
git clone https://github.com/shipcenter/kjanowski.git /tmp/kj && cp -r /tmp/kj/panel/mail-bridge /opt/shipcenter-poczta
cd /opt/shipcenter-poczta
npm ci --omit=dev        # albo: npm install --omit=dev
cp .env.example .env
chmod 600 .env
openssl rand -hex 32     # wynik wpisz jako MCP_SECRET w .env
nano .env                # hasło skrzynki franczyza@ do IMAP_PASS i SMTP_PASS, sprawdź port SMTP
npm run check            # test logowania IMAP i SMTP (nic nie wysyła)
```

`npm run check` powinien pokazać `IMAP: OK` i `SMTP: OK` oraz liczbę zgłoszeń z ostatnich 14 dni.
Jeśli certyfikat serwera poczty nie pasuje do nazwy `shipcenter.pl` (np. jest wystawiony na `da23090.serwervps.pl`), wpisz tę nazwę w `IMAP_HOST` / `SMTP_HOST` albo – w ostateczności – `TLS_REJECT_UNAUTHORIZED=false`.

> **Repozytorium jest publiczne.** Plik `.env` z hasłami trzymaj tylko na serwerze – nigdy go nie commituj.

## Uruchomienie na stałe (systemd)

`/etc/systemd/system/shipcenter-poczta.service`:

```ini
[Unit]
Description=ShipCenter Poczta (MCP dla panelu franczyzy)
After=network-online.target

[Service]
WorkingDirectory=/opt/shipcenter-poczta
ExecStart=/usr/bin/node --env-file=.env src/server.js
Restart=always
User=www-data
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now shipcenter-poczta
curl http://127.0.0.1:8787/health      # {"ok":true}
```

(Zamiast systemd może być PM2: `pm2 start "node --env-file=.env src/server.js" --name shipcenter-poczta`.)

## Apache – subdomena z HTTPS

```apache
<VirtualHost *:443>
    ServerName mcp.shipcenter.pl
    # certyfikat: certbot --apache -d mcp.shipcenter.pl
    ProxyPreserveHost On
    ProxyPass        /mcp/  http://127.0.0.1:8787/mcp/ timeout=120
    ProxyPassReverse /mcp/  http://127.0.0.1:8787/mcp/
    ProxyPass        /health http://127.0.0.1:8787/health

    # adres zawiera tajny klucz – nie zapisuj go w logach
    SetEnvIf Request_URI "^/mcp/" nolog
    CustomLog ${APACHE_LOG_DIR}/mcp-access.log combined env=!nolog
</VirtualHost>
```

Moduły: `a2enmod proxy proxy_http ssl`. Sprawdzenie z zewnątrz: `curl https://mcp.shipcenter.pl/health`.

## Podłączenie w claude.ai

1. claude.ai → **Ustawienia → Konektory → Dodaj własny konektor** (w planie Team/Enterprise robi to właściciel organizacji, a pozostali tylko klikają „Połącz”).
2. Nazwa: **`ShipCenter Poczta`** (dokładnie tak – panel szuka konektora po tej nazwie).
3. Adres: `https://mcp.shipcenter.pl/mcp/<MCP_SECRET>` – bez logowania OAuth.
4. Otwórz panel franczyzy → zakładka **Poczta**. Przy pierwszym użyciu claude.ai zapyta o zgodę na użycie konektora przez panel.

## Narzędzia (dla ciekawych)

| narzędzie | co robi |
|---|---|
| `mail_status` | test logowania IMAP/SMTP |
| `inquiries_fetch` | nowe zgłoszenia z formularzy (imię, telefon, e-mail, model) od podanego UID |
| `mail_list` | lista wiadomości (Odebrane/Wysłane), opcjonalnie tylko z/do danego adresu |
| `mail_get` | treść wiadomości + lista załączników |
| `mail_attachment` | pobranie załącznika (base64) |
| `mail_send` | wysyłka z `franczyza@shipcenter.pl` + kopia w „Wysłanych” |

Zabezpieczenia: tajny klucz w adresie (min. 32 znaki, porównanie w stałym czasie, zły klucz = 404), nasłuch tylko na `127.0.0.1`, limit `MAX_SEND_PER_HOUR`, walidacja adresów, max 10 MB załączników. Mostek wysyła wyłącznie z adresu z `MAIL_FROM`.

## Testy

```bash
npm install          # z devDependencies
npm test             # parser zgłoszeń + wysyłka przez lokalny serwer SMTP (bez prawdziwej poczty)
```
