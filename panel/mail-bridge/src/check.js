/* Test połączenia: npm run check – sprawdza IMAP, SMTP i ostatnie zgłoszenia (nic nie wysyła) */
import { assertConfig } from './config.js';
import { status, fetchInquiries } from './mail.js';
import { smsConfigured } from './sms.js';
import { cfg } from './config.js';
import { addressSuggest } from './places.js';

assertConfig({ needSecret: false });
const st = await status();
console.log('IMAP:', st.imap.ok ? `OK – w Odebranych ${st.imap.inbox} wiadomości, folder Wysłane: ${st.imap.sentFolder}` : 'BŁĄD – ' + st.imap.error);
console.log('SMTP:', st.smtp.ok ? 'OK – logowanie poprawne' : 'BŁĄD – ' + st.smtp.error);
const sms = smsConfigured();
if (cfg.places.key) {
  try { const r = await addressSuggest({ input: 'Gliwicka 51 Katowice' }); console.log('Google Places:', r.items.length ? `OK – np. „${r.items[0].text}”` : 'BŁĄD – brak wyników'); }
  catch (e) { console.log('Google Places: BŁĄD – ' + e.message); }
} else console.log('Google Places: brak GOOGLE_MAPS_API_KEY – podpowiedzi ulic przez Claude');
console.log('SMS:', sms.configured ? `skonfigurowane (nadawca: ${sms.from || 'domyślny konta'})` : 'brak SMSAPI_TOKEN – SMS-y będą wysyłane ręcznie');
if (st.imap.ok) {
  const r = await fetchInquiries({ days: 14, limit: 5 });
  console.log(`Zgłoszenia z ostatnich 14 dni: ${r.count} (pokazuję max 5, bez danych osobowych)`);
  r.items.forEach(x => console.log(` - ${x.date?.slice(0, 10)} · ${x.kind} · imię: ${x.name ? 'tak' : 'BRAK'} · telefon: ${x.phone ? 'tak' : 'BRAK'} · e-mail: ${x.email ? 'tak' : 'BRAK'}`));
}
process.exit(st.imap.ok && st.smtp.ok ? 0 : 1);
