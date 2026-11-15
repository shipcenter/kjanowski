#!/usr/bin/env python3
"""Mapa konkurencji dla analizy lokalizacji ShipCenter (kafelki OpenStreetMap).

Użycie:
  python3 mapa_konkurencji.py wynik.json mapa.jpg [--promien 3000]

wynik.json – wynik analiza_lokalizacji.py (geo.lat/lng, competitors[].lat/lng/type).
Rysuje lokal, okrąg promienia ochrony, ponumerowane punkty konkurencji (numery wg odległości)
oraz legendę i atrybucję „© OpenStreetMap contributors”.
"""
import io, json, math, os, sys, time, argparse, urllib.request
from PIL import Image, ImageDraw, ImageFont

TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
UA = 'location-analysis-script/1.0'
CACHE = os.path.join(os.environ.get('TMPDIR', '/tmp'), 'osm-tiles')
COLORS = {'pakersi': (98, 80, 214), 'epaka': (42, 120, 214), 'sc': (227, 73, 72)}
LABELS = {'pakersi': 'Pakersi', 'epaka': 'Epaka.pl', 'sc': 'ShipCenter'}
ORANGE = (234, 88, 12)
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def font(size, bold=False):
    try:
        return ImageFont.truetype(FONT_B if bold else FONT, size)
    except OSError:
        return ImageFont.load_default()


def world_px(lat, lng, z):
    n = 256 * 2 ** z
    x = (lng + 180) / 360 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def tile(z, x, y):
    os.makedirs(CACHE, exist_ok=True)
    f = os.path.join(CACHE, f'{z}_{x}_{y}.png')
    if not os.path.exists(f):
        req = urllib.request.Request(TILE.format(z=z, x=x, y=y), headers={'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=30) as r:
            open(f, 'wb').write(r.read())
        time.sleep(0.15)
    return Image.open(f).convert('RGB')


def render(res, out, radius=3000, W=1600, H=1100):
    lat, lng = res['geo']['lat'], res['geo']['lng']
    mpp = lambda z: 156543.03392 * math.cos(math.radians(lat)) / 2 ** z
    z = 17
    while z > 10 and radius / mpp(z) > H * 0.43:
        z -= 1
    cx, cy = world_px(lat, lng, z)
    x0, y0 = cx - W / 2, cy - H / 2
    img = Image.new('RGB', (W, H), (240, 240, 240))
    for tx in range(int(x0 // 256), int((x0 + W) // 256) + 1):
        for ty in range(int(y0 // 256), int((y0 + H) // 256) + 1):
            try:
                img.paste(tile(z, tx, ty), (int(tx * 256 - x0), int(ty * 256 - y0)))
            except Exception as e:
                print('kafelek', z, tx, ty, e, file=sys.stderr)
    # lekkie rozjaśnienie mapy, żeby znaczniki były czytelne
    img = Image.blend(img, Image.new('RGB', (W, H), (255, 255, 255)), 0.18)
    d = ImageDraw.Draw(img, 'RGBA')
    rpx = radius / mpp(z)
    d.ellipse([W / 2 - rpx, H / 2 - rpx, W / 2 + rpx, H / 2 + rpx], fill=ORANGE + (14,), outline=ORANGE + (230,), width=5)
    r1 = 1000 / mpp(z)
    if r1 > 40:
        d.ellipse([W / 2 - r1, H / 2 - r1, W / 2 + r1, H / 2 + r1], outline=(17, 24, 39, 110), width=2)
        d.text((W / 2 - r1 * 0.72 - 70, H / 2 + r1 * 0.72), '1 km', font=font(24), fill=(17, 24, 39, 200))
    d.text((W / 2 + rpx * 0.72 + 8, H / 2 + rpx * 0.72), f'{radius / 1000:g} km', font=font(26, True), fill=ORANGE + (255,))
    # lokal – pinezka
    x, y = W / 2, H / 2
    d.ellipse([x - 30, y - 92, x + 30, y - 32], fill=(255, 255, 255, 255))
    d.polygon([(x - 26, y - 56), (x + 26, y - 56), (x, y)], fill=ORANGE + (255,))
    d.ellipse([x - 26, y - 88, x + 26, y - 36], fill=ORANGE + (255,))
    d.ellipse([x - 10, y - 72, x + 10, y - 52], fill=(255, 255, 255, 255))
    comps = sorted([c for c in res.get('competitors', []) if c.get('lat') is not None and c.get('dist', 0) <= radius], key=lambda c: c['dist'])
    for i, c in enumerate(comps, 1):
        px, py = world_px(c['lat'], c['lng'], z)
        x, y = px - x0, py - y0
        col = COLORS.get(c['type'], (107, 114, 128))
        R = 24
        d.ellipse([x - R - 4, y - R - 4, x + R + 4, y + R + 4], fill=(255, 255, 255, 255))
        d.ellipse([x - R, y - R, x + R, y + R], fill=col + (255,))
        t = str(i); f = font(26, True); bb = d.textbbox((0, 0), t, font=f)
        d.text((x - (bb[2] - bb[0]) / 2 - bb[0], y - (bb[3] - bb[1]) / 2 - bb[1]), t, font=f, fill=(255, 255, 255))
        c['no'] = i
    # legenda
    items = [('Lokal', ORANGE)] + [(LABELS[k], COLORS[k]) for k in ('pakersi', 'epaka', 'sc') if any(c['type'] == k for c in comps)]
    f = font(26); pad = 18; lh = 40
    wbox = max(d.textbbox((0, 0), t, font=f)[2] for t, _ in items) + 80
    hbox = pad * 2 + lh * len(items)
    d.rounded_rectangle([24, H - hbox - 24, 24 + wbox, H - 24], radius=16, fill=(255, 255, 255, 235), outline=(229, 231, 235, 255), width=2)
    for i, (t, col) in enumerate(items):
        yy = H - hbox - 24 + pad + i * lh + lh / 2
        d.ellipse([24 + pad, yy - 11, 24 + pad + 22, yy + 11], fill=col + (255,))
        d.text((24 + pad + 36, yy - 15), t, font=f, fill=(17, 24, 39))
    att = '© OpenStreetMap contributors'
    fa = font(20); bb = d.textbbox((0, 0), att, font=fa)
    d.rectangle([W - bb[2] - 24, H - 34, W, H], fill=(255, 255, 255, 220))
    d.text((W - bb[2] - 14, H - 30), att, font=fa, fill=(75, 85, 99))
    img.save(out, 'JPEG', quality=86, optimize=True, progressive=True)
    return comps


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('wynik'); ap.add_argument('mapa'); ap.add_argument('--promien', type=int, default=3000)
    a = ap.parse_args()
    res = json.load(open(a.wynik, encoding='utf8'))
    comps = render(res, a.mapa, a.promien)
    print(json.dumps([{k: c.get(k) for k in ('no', 'name', 'type', 'dist', 'address', 'lat', 'lng')} for c in comps], ensure_ascii=False))
