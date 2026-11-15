/* Podpowiedzi adresów: Google Places API (New) – autocomplete + szczegóły (kod pocztowy, województwo) */
import { cfg } from './config.js';

const BASE = () => cfg.places.url;
async function call(path, { method = 'GET', body, fieldMask } = {}) {
  if (!cfg.places.key) throw new Error('Podpowiedzi adresów nie są skonfigurowane – brak GOOGLE_MAPS_API_KEY w .env mostka');
  const headers = { 'X-Goog-Api-Key': cfg.places.key };
  if (body) headers['Content-Type'] = 'application/json';
  if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
  const r = await fetch(BASE() + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Google Places: ' + ((j.error && j.error.message) || 'HTTP ' + r.status));
  return j;
}

export async function addressSuggest({ input, session }) {
  const q = String(input || '').trim();
  if (q.length < 3) return { items: [] };
  const j = await call('/v1/places:autocomplete', { method: 'POST', body: { input: q, includedRegionCodes: ['pl'], languageCode: 'pl', ...(session ? { sessionToken: session } : {}) } });
  const items = (j.suggestions || []).map(s => s.placePrediction).filter(Boolean).slice(0, 6).map(p => ({
    placeId: p.placeId,
    text: (p.text && p.text.text) || '',
    main: (p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text) || '',
    secondary: (p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text) || ''
  }));
  return { items };
}

export async function addressDetails({ placeId, session }) {
  if (!placeId) throw new Error('Brak placeId');
  const j = await call('/v1/places/' + encodeURIComponent(placeId) + '?languageCode=pl' + (session ? '&sessionToken=' + encodeURIComponent(session) : ''), { fieldMask: 'addressComponents,formattedAddress,location' });
  const comp = t => ((j.addressComponents || []).find(c => (c.types || []).includes(t)) || {}).longText || '';
  return {
    formatted: j.formattedAddress || '',
    street: comp('route'),
    number: comp('street_number') + (comp('subpremise') ? '/' + comp('subpremise') : ''),
    city: comp('locality') || comp('postal_town') || comp('administrative_area_level_3'),
    postalCode: comp('postal_code'),
    district: comp('administrative_area_level_2').replace(/^powiat\s+/i, ''),
    region: comp('administrative_area_level_1').replace(/^województwo\s+/i, '').toLowerCase(),
    lat: j.location ? j.location.latitude : null,
    lng: j.location ? j.location.longitude : null
  };
}
