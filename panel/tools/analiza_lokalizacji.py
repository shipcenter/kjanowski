#!/usr/bin/env python3
"""Automatyczna analiza lokalizacji punktu ShipCenter na podstawie Map Google (Places API New).

Użycie:
  python3 analiza_lokalizacji.py "ul. Słoneczna 20, Katowice" [--promien 3000] [--json wynik.json]

Klucz API:
  - w środowisku Claude w chmurze: sekret sieciowy dla places.googleapis.com (nagłówek X-Goog-Api-Key)
    – skrypt nie musi go znać, proxy dokleja go do zapytań;
  - lokalnie / na serwerze: zmienna GOOGLE_MAPS_API_KEY (np. z pliku .env, patrz .env.example).

Wynik (JSON): współrzędne i adres, lista konkurencji z typem i odległością w metrach,
gęstość punktów handlowych wokół lokalu oraz podpowiedzi pól do analizy w panelu.
Liczby mieszkańców Places API nie podaje – uzupełnia się je osobno.
"""
import json, math, os, sys, time, urllib.request, urllib.error, argparse

API = 'https://places.googleapis.com/v1/places:'
FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.businessStatus'

# Zapytania o konkurencję: (fraza, czy wymagać słowa z frazy w nazwie, słowa-klucze)
QUERIES = [
    ('Epaka punkt', ['epaka']),
    ('Furgonetka punkt', ['furgonetka']),
    ('ShipCenter punkt kurierski', ['shipcenter', 'ship center']),
    ('punkt nadawczy paczek', ['paczk', 'kurier', 'przesył', 'nadaw', 'parcel', 'pack', 'shipping', 'epaka', 'furgonetka']),
    ('punkt kurierski', ['paczk', 'kurier', 'przesył', 'nadaw', 'parcel', 'pack', 'shipping']),
    ('Paczkomat InPost', ['paczkomat', 'inpost']),
    ('PaczkoPunkt InPost', ['paczkopunkt', 'inpost']),
    ('Poczta Polska', ['poczta', 'pocztex', 'urząd pocztowy']),
    ('DPD Pickup', ['dpd']),
    ('DHL POP', ['dhl']),
    ('Orlen Paczka', ['orlen']),
    ('Żabka', ['żabka', 'zabka']),
    ('Allegro One Box', ['one box', 'allegro']),
    ('GLS ParcelShop', ['gls']),
    ('UPS Access Point', ['ups']),
]
STRENGTH = {'sc': 5, 'multi': 4, 'poczta': 3, 'kurier': 3, 'automat': 3, 'paczkopunkt': 2, 'pudo': 2}


def classify(name, types):
    n = (name or '').lower()
    t = set(types or [])
    if 'shipcenter' in n or 'ship center' in n:
        return 'sc'
    if any(k in n for k in ('paczkomat', 'parcel locker', 'one box', 'automat', 'dhl box', 'boxmachine')) or 'parcel_locker' in t:
        return 'automat'
    if 'paczkopunkt' in n:
        return 'paczkopunkt'
    if any(k in n for k in ('epaka', 'furgonetka', 'punkt nadawczy', 'punkt nadania', 'punkt kurierski', 'przesyłki kurierskie')):
        return 'multi'
    if any(k in n for k in ('poczta', 'pocztex', 'urząd pocztowy')) or 'post_office' in t:
        return 'poczta'
    if any(k in n for k in ('oddział', 'terminal', 'magazyn', 'depot', 'sortownia')):
        return 'kurier'
    if any(k in n for k in ('pickup', 'dhl pop', 'dhl servicepoint', 'gls', 'ups access', 'żabka', 'zabka', 'orlen', 'ruch', 'dpd')):
        return 'pudo'
    return 'multi'


def haversine(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp, dl = p2 - p1, math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def rect(center, radius):
    dlat = radius / 111320.0
    dlng = radius / (111320.0 * math.cos(math.radians(center[0])))
    return {'rectangle': {'low': {'latitude': center[0] - dlat, 'longitude': center[1] - dlng},
                          'high': {'latitude': center[0] + dlat, 'longitude': center[1] + dlng}}}


def call(method, body, fields=FIELDS):
    headers = {'Content-Type': 'application/json', 'X-Goog-FieldMask': fields}
    key = os.environ.get('GOOGLE_MAPS_API_KEY')
    if key:
        headers['X-Goog-Api-Key'] = key
    req = urllib.request.Request(API + method, data=json.dumps(body).encode(), headers=headers, method='POST')
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode())
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors='replace')[:400]
            if e.code in (429, 500, 503) and attempt < 2:
                time.sleep(1.5 * (attempt + 1)); continue
            raise SystemExit(f'Places API {method}: HTTP {e.code} {msg}')


def text_search(query, restriction=None, bias=None, pages=1):
    out, token = [], None
    for _ in range(pages):
        body = {'textQuery': query, 'languageCode': 'pl', 'regionCode': 'PL', 'pageSize': 20}
        if restriction: body['locationRestriction'] = restriction
        if bias: body['locationBias'] = bias
        if token: body['pageToken'] = token
        res = call('searchText', body, FIELDS + ',nextPageToken')
        out += res.get('places', [])
        token = res.get('nextPageToken')
        if not token: break
        time.sleep(1.2)
    return out


def geocode(address):
    res = call('searchText', {'textQuery': address, 'languageCode': 'pl', 'regionCode': 'PL', 'pageSize': 1},
               'places.id,places.formattedAddress,places.location,places.addressComponents,places.types')
    pl = (res.get('places') or [None])[0]
    if not pl:
        raise SystemExit(f'Nie znaleziono adresu: {address}')
    comps = pl.get('addressComponents', [])
    def comp(kind):
        for c in comps:
            if kind in c.get('types', []): return c.get('longText', '')
        return ''
    region = comp('administrative_area_level_1').lower().replace('województwo', '').strip()
    city = comp('locality') or comp('postal_town') or comp('administrative_area_level_2')
    loc = pl['location']
    return {'lat': loc['latitude'], 'lng': loc['longitude'], 'formattedAddress': pl.get('formattedAddress', ''),
            'city': city, 'region': region, 'street': ' '.join(x for x in (comp('route'), comp('street_number')) if x)}


def density(center):
    res = call('searchNearby', {'includedTypes': ['store', 'restaurant', 'cafe', 'bakery', 'pharmacy', 'supermarket', 'convenience_store', 'clothing_store'],
                                'maxResultCount': 20, 'languageCode': 'pl',
                                'locationRestriction': {'circle': {'center': {'latitude': center[0], 'longitude': center[1]}, 'radius': 300.0}}})
    mall = call('searchNearby', {'includedTypes': ['shopping_mall'], 'maxResultCount': 5, 'languageCode': 'pl',
                                 'locationRestriction': {'circle': {'center': {'latitude': center[0], 'longitude': center[1]}, 'radius': 150.0}}})
    return {'poi300': len(res.get('places', [])), 'mall150': bool(mall.get('places'))}


def analyze(address, radius=3000):
    g = geocode(address)
    center = (g['lat'], g['lng'])
    restriction = rect(center, radius)
    seen, comps = set(), []
    for query, words in QUERIES:
        pages = 3 if 'Paczkomat' in query else 1
        for p in text_search(query, restriction=restriction, pages=pages):
            pid = p.get('id')
            name = (p.get('displayName') or {}).get('text', '')
            if not pid or pid in seen or p.get('businessStatus') == 'CLOSED_PERMANENTLY':
                continue
            if words and not any(w in name.lower() for w in words):
                continue
            loc = p.get('location') or {}
            if 'latitude' not in loc:
                continue
            dist = haversine(center, (loc['latitude'], loc['longitude']))
            if dist > radius:
                continue
            seen.add(pid)
            typ = classify(name, p.get('types'))
            comps.append({'name': name, 'type': typ, 'dist': int(round(dist / 10.0) * 10), 'strength': STRENGTH.get(typ, 3),
                          'address': p.get('formattedAddress', ''), 'placeId': pid, 'source': 'Google Maps'})
    comps.sort(key=lambda c: c['dist'])
    d = density(center)
    loc_type = 'galeria' if d['mall150'] else ('ulica' if d['poi300'] >= 15 else 'osiedle')
    traffic = max(500, min(5000, 500 + d['poi300'] * 150))
    return {'address': address, 'geo': g, 'radius': radius, 'competitors': comps, 'density': d,
            'suggest': {'type': loc_type, 'traffic': traffic, 'city': g['city'], 'region': g['region']},
            'source': 'Google Maps (Places API)', 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Analiza lokalizacji ShipCenter (Google Maps)')
    ap.add_argument('adres')
    ap.add_argument('--promien', type=int, default=3000)
    ap.add_argument('--json', help='zapisz wynik do pliku')
    a = ap.parse_args()
    out = analyze(a.adres, a.promien)
    txt = json.dumps(out, ensure_ascii=False, indent=2)
    if a.json:
        open(a.json, 'w', encoding='utf8').write(txt)
    print(txt)
