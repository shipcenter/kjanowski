/* Rozpoznawanie zgłoszeń z formularzy shipcenter.pl
   - „[shipcenter.pl] - ZAPYTANIE FRANCZYZOWE”  → model: franczyza
   - „[shipcenter.pl] - zapytanie ShipPoint”    → model: shippoint
   Dane kandydata: pola „Imię:”, „Telefon:”, „E-mail:/Email:” w treści; adres e-mail
   zapasowo z nagłówka Reply-To (formularz ustawia tam adres kandydata). */

export const INQUIRY_KINDS = [
  { kind: 'franczyza', re: /zapytanie\s+franczyzowe/i, imap: 'ZAPYTANIE FRANCZYZOWE' },
  { kind: 'shippoint', re: /zapytanie\s+ship\s*-?\s*point/i, imap: 'zapytanie ShipPoint' }
];

export function inquiryKind(subject) {
  const k = INQUIRY_KINDS.find(x => x.re.test(String(subject || '')));
  return k ? k.kind : null;
}

const ENT = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export function htmlToText(html) {
  return String(html || '')
    .replace(/<(style|head|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h\d|li|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (ENT[e.toLowerCase()] ?? m))
    .replace(/[͏​-‍⁠﻿]/g, '')
    .split('\n').map(l => l.replace(/[ \t ]+/g, ' ').trim()).filter(Boolean).join('\n');
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function field(text, labels) {
  for (const l of labels) {
    const m = text.match(new RegExp('(?:^|\\n)\\s*' + l + '\\s*:?\\s*\\n?\\s*([^\\n]+)', 'i'));
    if (m && m[1].trim()) return m[1].trim();
  }
  return '';
}

/**
 * @param {{subject:string, text?:string, html?:string, replyTo?:string, date?:Date|string, messageId?:string, uid?:number}} msg
 */
export function parseInquiry(msg) {
  const kind = inquiryKind(msg.subject);
  if (!kind) return null;
  const text = (msg.text && msg.text.trim()) ? msg.text.replace(/\r/g, '') : htmlToText(msg.html);
  let name = field(text, ['Imi[ęe] i nazwisko', 'Imi[ęe]']);
  let phone = field(text, ['Telefon', 'Tel\\.?', 'Nr telefonu']);
  let email = field(text, ['E-?mail', 'Adres e-?mail']);
  const city = field(text, ['Miasto', 'Miejscowo[śs][ćc]', 'Lokalizacja']);
  const note = field(text, ['Wiadomo[śs][ćc]', 'Tre[śs][ćc]', 'Uwagi']);
  // „Imię: Artur Email: …” w jednej linii (gdy HTML bez podziałów)
  name = name.split(/\s+(?:E-?mail|Telefon)\s*:/i)[0].trim();
  const pm = phone.match(/\+?\d[\d\s()-]{5,}\d/);
  phone = pm ? pm[0].replace(/[^\d+]/g, '') : '';
  const em = email.match(EMAIL_RE) || String(msg.replyTo || '').match(EMAIL_RE);
  email = em ? em[0].toLowerCase() : '';
  return {
    uid: msg.uid ?? null,
    messageId: msg.messageId || '',
    date: msg.date ? new Date(msg.date).toISOString() : null,
    kind,
    name,
    phone,
    email,
    city,
    note: note.slice(0, 500),
    autoPresentation: kind === 'franczyza' && /otrzymuje mail z prezentacj/i.test(text),
    subject: msg.subject || ''
  };
}
