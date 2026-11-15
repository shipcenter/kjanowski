#!/usr/bin/env python3
"""Automatyczna analiza lokalizacji punktu ShipCenter na podstawie Map Google (Places API New).

Użycie:
  python3 analiza_lokalizacji.py "ul. Słoneczna 20, Katowice" [--promien 3000] [--json wynik.json]

Klucz API:
  - w środowisku Claude w chmurze: sekret sieciowy dla places.googleapis.com (nagłówek X-Goog-Api-Key)
    – skrypt nie musi go znać, proxy dokleja go do zapytań;
  - lokalnie / na serwerze: zmienna GOOGLE_MAPS_API_KEY (np. z pliku .env, patrz .env.example).

Konkurencja to wyłącznie punkty Epaka.pl i zwykłe punkty Pakersi (bez „Pakersi Przy Okazji”) oraz inne punkty ShipCenter – ochrona 3 km.
Bez klucza Google skrypt korzysta z OpenStreetMap (dane częściowe).

Wynik (JSON): współrzędne i adres, lista konkurencji z typem i odległością w metrach,
gęstość punktów handlowych wokół lokalu oraz podpowiedzi pól do analizy w panelu.
Liczby mieszkańców Places API nie podaje – uzupełnia się je osobno.
"""
import json, math, os, sys, time, urllib.request, urllib.error, urllib.parse, argparse

API = 'https://places.googleapis.com/v1/places:'
FIELDS = 'places.id,places.displayName,places.formattedAddress,places.location,places.types,places.primaryType,places.businessStatus'

# Konkurencja ShipCenter: wyłącznie punkty Epaka.pl i Pakersi (+ inne punkty ShipCenter – ochrona 3 km)
QUERIES = [
    ('Epaka', ['epaka']),
    ('Pakersi', ['pakersi']),
    ('ShipCenter', ['shipcenter', 'ship center']),
]
STRENGTH = {'sc': 5, 'epaka': 3, 'pakersi': 3}


def classify(name, types=None):
    n = (name or '').lower()
    if 'shipcenter' in n or 'ship center' in n:
        return 'sc'
    if 'pakersi' in n:
        return 'pakersi'
    if 'epaka' in n:
        return 'epaka'
    return None


import re as _re


def postal(addr):
    m = _re.search(r'\b(\d{2})-\d{3}\b', addr or '')
    return m.group(1) if m else None


def addr_key(addr):
    a = (addr or '').lower()
    a = _re.sub(r'\b\d{2}-\d{3}\b', '', a)
    parts = [x.strip() for x in a.split(',') if _re.search(r'\d', x)]
    return _re.sub(r'[^a-ząćęłńóśźż0-9]', '', parts[0]) if parts else a


def dedupe(comps, center_addr):
    cp = postal(center_addr)
    out, seen = [], set()
    # „Pakersi Przy Okazji” (punkty partnerskie w sklepach) nie są konkurencją – pomijamy je
    # razem z innymi wpisami pod tym samym adresem (np. DHL Service Point w tym samym sklepie)
    pz = {addr_key(c.get('address')) for c in comps if 'przy okazji' in (c.get('name') or '').lower()}
    comps = [c for c in comps if not (c['type'] == 'pakersi' and ('przy okazji' in (c.get('name') or '').lower() or addr_key(c.get('address')) in pz))]
    for c in sorted(comps, key=lambda c: c['dist']):
        pc = postal(c.get('address'))
        if cp and pc and pc[0] != cp[0]:
            continue  # pinezka niezgodna z adresem (inny region kodu pocztowego)
        k = (c['type'], addr_key(c.get('address')))
        if k in seen:
            continue
        seen.add(k); out.append(c)
    return out


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
        pages = 1
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
            if not typ:
                continue
            comps.append({'name': name, 'type': typ, 'dist': int(round(dist / 10.0) * 10), 'strength': STRENGTH.get(typ, 3),
                          'address': p.get('formattedAddress', ''), 'placeId': pid, 'source': 'Google Maps',
                          'lat': loc['latitude'], 'lng': loc['longitude']})
    comps = dedupe(comps, g['formattedAddress'])
    d = density(center)
    loc_type = 'galeria' if d['mall150'] else ('ulica' if d['poi300'] >= 15 else 'osiedle')
    traffic = max(500, min(5000, 500 + d['poi300'] * 150))
    return {'address': address, 'geo': g, 'radius': radius, 'competitors': comps, 'density': d,
            'suggest': {'type': loc_type, 'traffic': traffic, 'city': g['city'], 'region': g['region']},
            'source': 'Google Maps (Places API)', 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}


# ---------- OpenStreetMap (Nominatim) – bez klucza, dane częściowe ----------
NOMINATIM = 'https://nominatim.openstreetmap.org/search'
UA = 'location-analysis-script/1.0'


def nominatim(params):
    q = urllib.parse.urlencode({**params, 'format': 'jsonv2', 'countrycodes': 'pl', 'addressdetails': 1})
    req = urllib.request.Request(NOMINATIM + '?' + q, headers={'User-Agent': UA, 'Accept-Language': 'pl'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        out = json.loads(resp.read().decode())
    time.sleep(1.1)  # zasady Nominatim: max 1 zapytanie na sekundę
    return out


def analyze_osm(address, radius=3000):
    res = nominatim({'q': address, 'limit': 1})
    if not res:
        raise SystemExit(f'Nie znaleziono adresu w OpenStreetMap: {address}')
    g0 = res[0]
    center = (float(g0['lat']), float(g0['lon']))
    ad = g0.get('address', {})
    city = ad.get('city') or ad.get('town') or ad.get('village') or ad.get('municipality') or ''
    region = (ad.get('state') or '').lower().replace('województwo', '').strip()
    box = rect(center, radius)['rectangle']
    viewbox = f"{box['low']['longitude']},{box['high']['latitude']},{box['high']['longitude']},{box['low']['latitude']}"
    seen, comps = set(), []
    for query, words in QUERIES:
        for p in nominatim({'q': query, 'viewbox': viewbox, 'bounded': 1, 'limit': 50}):
            key = (p.get('osm_type'), p.get('osm_id'))
            name = p.get('name') or p.get('display_name', '').split(',')[0]
            if key in seen or not any(w in (name or '').lower() for w in words):
                continue
            dist = haversine(center, (float(p['lat']), float(p['lon'])))
            if dist > radius:
                continue
            seen.add(key)
            typ = classify(name)
            if not typ:
                continue
            a2 = p.get('address', {})
            addr = ', '.join(x for x in [' '.join(y for y in (a2.get('road', ''), a2.get('house_number', '')) if y), a2.get('city') or a2.get('town') or a2.get('village') or ''] if x)
            comps.append({'name': name, 'type': typ, 'dist': int(round(dist / 10.0) * 10), 'strength': STRENGTH.get(typ, 3), 'address': addr, 'source': 'OpenStreetMap',
                          'lat': float(p['lat']), 'lng': float(p['lon'])})
    comps = dedupe(comps, g0.get('display_name', ''))
    return {'address': address, 'geo': {'lat': center[0], 'lng': center[1], 'formattedAddress': g0.get('display_name', ''), 'city': city, 'region': region},
            'radius': radius, 'competitors': comps, 'source': 'OpenStreetMap (Nominatim) – dane mogą być niepełne', 'at': time.strftime('%Y-%m-%dT%H:%M:%S')}


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Analiza lokalizacji ShipCenter (Google Maps)')
    ap.add_argument('adres')
    ap.add_argument('--promien', type=int, default=3000)
    ap.add_argument('--json', help='zapisz wynik do pliku')
    ap.add_argument('--zrodlo', choices=['auto', 'google', 'osm'], default='auto', help='google = Places API (wymaga klucza), osm = OpenStreetMap')
    a = ap.parse_args()
    if a.zrodlo == 'osm':
        out = analyze_osm(a.adres, a.promien)
    else:
        try:
            out = analyze(a.adres, a.promien)
        except SystemExit as e:
            if a.zrodlo == 'google' or 'HTTP 403' not in str(e):
                raise
            print('Brak klucza Google – używam OpenStreetMap.', file=sys.stderr)
            out = analyze_osm(a.adres, a.promien)
    txt = json.dumps(out, ensure_ascii=False, indent=2)
    if a.json:
        open(a.json, 'w', encoding='utf8').write(txt)
    print(txt)
