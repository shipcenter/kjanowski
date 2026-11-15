/* ===== E-mail w szablonie ShipCenter: klikalne linki + firmowa stopka ===== */

const EMAIL_LOGO_URL = 'https://shipcenter.pl/panel/logo_stopka.png';
const A = 'font-family:Arial,Helvetica,sans-serif;';

function senderOf(l) {
  const o = offer();
  const m = (myMemberId() && D().team[myMemberId()]) || (l && l.ownerId ? D().team[l.ownerId] : null);
  return {
    name: m ? String(m.name).replace(/^Przykład:\s*/, '') : 'Dział Franczyzy',
    role: m && m.role ? m.role.replace('Centrala – ', '') : 'Rozwój sieci franczyzowej',
    phone: (m && m.phone) || o.telefon,
    email: (m && m.email) || o.email
  };
}

function signatureHtml(s, preview = false) {
  const tel = 'tel:' + String(s.phone || '').replace(/[^\d+]/g, '');
  const phoneTxt = esc(s.phone || '').replace(/ /g, '&nbsp;');
  const logo = preview
    ? `<span style="display:block;width:160px">${LOGO_SVG.replace('<svg ', '<svg style="width:160px;height:auto;display:block" ')}</span>`
    : `<img src="${EMAIL_LOGO_URL}" width="160" height="33" alt="Ship Center" style="display:block;width:160px;height:33px;border:0;outline:none;text-decoration:none;">`;
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="480" style="width:480px;border-collapse:collapse;${A}color:#111827;">
  <tr>
    <td valign="top" style="padding:0 22px 0 0;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr><td style="${A}font-size:18px;line-height:22px;font-weight:bold;color:#111827;">${esc(s.name)}</td></tr>
        <tr><td style="${A}font-size:13px;line-height:18px;color:#6B7280;padding:2px 0 0 0;">${esc(s.role)}</td></tr>
        <tr><td style="padding:10px 0 10px 0;"><table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;"><tr><td width="32" height="3" bgcolor="#E94E1A" style="width:32px;height:3px;background-color:#E94E1A;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
        <tr><td><table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
          <tr><td width="18" style="width:18px;${A}font-size:12px;line-height:20px;font-weight:bold;color:#E94E1A;">T</td><td style="${A}font-size:13px;line-height:20px;"><a href="${esc(tel)}" style="color:#111827;text-decoration:none;">${phoneTxt}</a></td></tr>
          <tr><td width="18" style="width:18px;${A}font-size:12px;line-height:20px;font-weight:bold;color:#E94E1A;">E</td><td style="${A}font-size:13px;line-height:20px;"><a href="mailto:${esc(s.email)}" style="color:#111827;text-decoration:none;">${esc(s.email)}</a></td></tr>
        </table></td></tr>
      </table>
    </td>
    <td width="1" bgcolor="#E5E7EB" style="width:1px;background-color:#E5E7EB;font-size:0;line-height:0;">&nbsp;</td>
    <td valign="top" style="padding:2px 0 0 22px;">
      <table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
        <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;"><a href="https://shipcenter.pl" target="_blank" style="text-decoration:none;">${logo}</a></td></tr>
        <tr><td style="${A}font-size:12px;line-height:19px;color:#4B5563;padding:12px 0 0 0;">ul. Gliwicka 51, 40-853 Katowice<br><a href="https://shipcenter.pl" target="_blank" style="color:#E94E1A;text-decoration:none;font-weight:bold;">shipcenter.pl</a></td></tr>
      </table>
    </td>
  </tr>
  <tr><td colspan="3" style="padding:16px 0 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
  <tr><td colspan="3" style="border-top:1px solid #E5E7EB;padding:10px 0 0 0;${A}font-size:10px;line-height:14px;color:#9CA3AF;">
    Ship Center Poland Sp. z o.o., ul. Gliwicka 51, 40-853 Katowice, Sąd Rejonowy Katowice-Wschód w Katowicach, VIII Wydział Gospodarczy KRS, KRS 0000624967, NIP 6342867610, REGON 364786381, kapitał zakładowy 105&nbsp;000,00&nbsp;zł.<br>
    Korzystając z usług akceptujesz <a href="https://shipcenter.pl/regulamin" target="_blank" style="color:#6B7280;text-decoration:underline;">Regulamin</a> oraz <a href="https://shipcenter.pl/polityka-prywatnosci" target="_blank" style="color:#6B7280;text-decoration:underline;">Politykę prywatności</a>.
  </td></tr>
</table>`;
}

function linkify(escapedLine) {
  return escapedLine
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)])/g, '<a href="$1" target="_blank" style="color:#E94E1A;font-weight:bold;text-decoration:underline;">$1</a>')
    .replace(/(^|[\s(])([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, '$1<a href="mailto:$2" style="color:#E94E1A;text-decoration:underline;">$2</a>');
}

/* zwykły tekst wiadomości → HTML (akapity, listy, linki) + stopka */
function emailHtml(text, l, preview = false) {
  let body = String(text || '').replace(/\r/g, '');
  let closing = 'Pozdrawiam';
  const cut = body.search(/\n\s*\n(Pozdrawiam|Z pozdrowieniami|Pozdrawiamy)[^\n]*\n[\s\S]*$/);
  if (cut >= 0) { closing = body.slice(cut).trim().split('\n')[0].trim(); body = body.slice(0, cut); }
  const blocks = body.split(/\n\s*\n/);
  const P = `margin:0 0 14px 0;${A}font-size:14px;line-height:22px;color:#111827;`;
  const html = blocks.map(b => {
    const lines = b.split('\n').filter(x => x.trim() !== '');
    if (!lines.length) return '';
    const out = []; let list = null, listType = '';
    const flush = () => { if (list) { out.push(`<${listType} style="margin:0 0 14px 0;padding-left:22px;${A}font-size:14px;line-height:22px;color:#111827;">${list.join('')}</${listType}>`); list = null; } };
    const para = [];
    const flushPara = () => { if (para.length) { out.push(`<p style="${P}">${para.join('<br>')}</p>`); para.length = 0; } };
    lines.forEach(ln => {
      const bullet = ln.match(/^\s*[•\-–]\s+(.*)$/), num = ln.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || num) {
        flushPara();
        const t = bullet ? 'ul' : 'ol';
        if (!list || listType !== t) { flush(); list = []; listType = t; }
        list.push(`<li style="margin:0 0 4px 0;">${linkify(esc((bullet || num)[1]))}</li>`);
      } else { flush(); para.push(linkify(esc(ln))); }
    });
    flushPara(); flush();
    return out.join('');
  }).join('');
  return `<div style="${A}font-size:14px;line-height:22px;color:#111827;max-width:600px;">${html}<p style="${P}margin-bottom:18px;">${esc(closing)}</p>${signatureHtml(senderOf(l), preview)}</div>`;
}

/* kopiowanie jako sformatowany e-mail (HTML + zwykły tekst) */
async function copyEmailHtml(html, plain) {
  try {
    if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]);
      toast('Skopiowano e-mail z formatowaniem – wklej go w nowej wiadomości (Ctrl+V)');
      return;
    }
    throw new Error('no ClipboardItem');
  } catch (e) {
    const box = document.createElement('div');
    box.contentEditable = 'true';
    box.style.cssText = 'position:fixed;left:-10000px;top:0;width:640px;background:#fff';
    box.innerHTML = html;
    document.body.appendChild(box);
    const range = document.createRange(); range.selectNodeContents(box);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    sel.removeAllRanges(); box.remove();
    if (ok) toast('Skopiowano e-mail z formatowaniem – wklej go w nowej wiadomości (Ctrl+V)');
    else copyText(plain);
  }
}

/* blok podglądu e-maila do okien wysyłki */
function emailPreviewBlock(id) {
  return `<details class="adv" id="${id}-wrap"><summary>Podgląd e-maila ze stopką</summary><div id="${id}" style="background:#fff;border:1px solid var(--line);border-radius:10px;padding:18px;overflow-x:auto;color-scheme:light"></div></details>`;
}
