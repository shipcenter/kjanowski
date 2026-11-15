/* IMAP (odbiór, folder Wysłane) i SMTP (wysyłka) dla skrzynki franczyza@shipcenter.pl */
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import MailComposer from 'nodemailer/lib/mail-composer';
import { simpleParser } from 'mailparser';
import { cfg } from './config.js';
import { INQUIRY_KINDS, parseInquiry, htmlToText } from './inquiry.js';

const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[A-Za-z]{2,}$/;
const MAX_ATTACH_TOTAL = 10 * 1024 * 1024;
let sentFolderCache = '';
const sendLog = [];

function imapClient() {
  return new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: cfg.imap.secure,
    auth: { user: cfg.imap.user, pass: cfg.imap.pass },
    tls: { rejectUnauthorized: cfg.tlsRejectUnauthorized },
    logger: false,
    socketTimeout: 60000
  });
}

export async function withImap(fn) {
  const client = imapClient();
  await client.connect();
  try { return await fn(client); }
  finally { try { await client.logout(); } catch { client.close(); } }
}

export async function sentFolder(client) {
  if (cfg.sentFolder) return cfg.sentFolder;
  if (sentFolderCache) return sentFolderCache;
  const list = await client.list();
  const bySpecial = list.find(f => f.specialUse === '\\Sent');
  const byName = list.find(f => /^(inbox[./])?(sent|sent items|sent messages|wys[lł]ane|elementy wys[lł]ane)$/i.test(f.path));
  sentFolderCache = (bySpecial || byName || {}).path || 'INBOX.Sent';
  return sentFolderCache;
}

async function resolveFolder(client, folder) {
  if (!folder || /^inbox$/i.test(folder)) return 'INBOX';
  if (/^(sent|wys[lł]ane)$/i.test(folder)) return sentFolder(client);
  return folder;
}

const addr = list => (list || []).map(a => ({ name: a.name || '', address: (a.address || '').toLowerCase() }));
const sinceDate = days => new Date(Date.now() - Math.max(1, days) * 86400000);

/* ---------- zgłoszenia z formularzy ---------- */
export async function fetchInquiries({ sinceUid = 0, days = 30, limit = 100 } = {}) {
  return withImap(async client => {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uidValidity = String(client.mailbox.uidValidity || '');
      const crit = { since: sinceDate(days), or: INQUIRY_KINDS.map(k => ({ subject: k.imap })) };
      if (sinceUid > 0) crit.uid = `${sinceUid + 1}:*`;
      let uids = (await client.search(crit, { uid: true })) || [];
      uids = uids.filter(u => u > sinceUid).sort((a, b) => a - b).slice(-limit);
      const items = [];
      for (const uid of uids) {
        const msg = await client.fetchOne(String(uid), { source: true, internalDate: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const p = await simpleParser(msg.source);
        const inq = parseInquiry({
          uid,
          subject: p.subject || '',
          text: p.text || '',
          html: typeof p.html === 'string' ? p.html : '',
          replyTo: p.replyTo ? p.replyTo.text : '',
          date: p.date || msg.internalDate,
          messageId: p.messageId || ''
        });
        if (inq) items.push(inq);
      }
      const lastUid = Math.max(sinceUid, ...uids, 0);
      return { uidValidity, lastUid, count: items.length, items };
    } finally { lock.release(); }
  });
}

/* ---------- lista wiadomości (opcjonalnie tylko z/do danego adresu) ---------- */
export async function listMessages({ address = '', folder = 'all', limit = 30 } = {}) {
  return withImap(async client => {
    const folders = folder === 'all' ? ['INBOX', await sentFolder(client)] : [await resolveFolder(client, folder)];
    const out = [];
    for (const path of folders) {
      let lock;
      try { lock = await client.getMailboxLock(path); } catch { continue; }
      try {
        const a = String(address || '').trim().toLowerCase();
        const crit = a ? { or: [{ from: a }, { to: a }, { cc: a }] } : { all: true };
        let uids = (await client.search(crit, { uid: true })) || [];
        uids = uids.sort((x, y) => y - x).slice(0, limit);
        if (!uids.length) continue;
        for await (const m of client.fetch(uids.join(','), { envelope: true, flags: true, internalDate: true, bodyStructure: true, size: true }, { uid: true })) {
          const hasAtt = JSON.stringify(m.bodyStructure || {}).includes('"disposition":"attachment"');
          out.push({
            folder: path === 'INBOX' ? 'INBOX' : 'Sent',
            uid: m.uid,
            date: (m.envelope.date || m.internalDate || new Date()).toISOString(),
            subject: m.envelope.subject || '',
            from: addr(m.envelope.from),
            to: addr(m.envelope.to),
            cc: addr(m.envelope.cc),
            messageId: m.envelope.messageId || '',
            seen: m.flags ? m.flags.has('\\Seen') : true,
            hasAttachments: hasAtt,
            size: m.size || 0
          });
        }
      } finally { lock.release(); }
    }
    out.sort((x, y) => y.date.localeCompare(x.date));
    return { count: out.length, items: out.slice(0, limit) };
  });
}

/* ---------- jedna wiadomość ---------- */
export async function getMessage({ folder = 'INBOX', uid, markSeen = true }) {
  return withImap(async client => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      const msg = await client.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
      if (!msg || !msg.source) throw new Error('Nie znaleziono wiadomości');
      const p = await simpleParser(msg.source);
      if (markSeen && path === 'INBOX' && msg.flags && !msg.flags.has('\\Seen')) await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
      const html = typeof p.html === 'string' ? p.html : '';
      return {
        folder: path === 'INBOX' ? 'INBOX' : 'Sent',
        uid: Number(uid),
        messageId: p.messageId || '',
        references: Array.isArray(p.references) ? p.references : (p.references ? [p.references] : []),
        date: (p.date || new Date()).toISOString(),
        subject: p.subject || '',
        from: addr(p.from ? p.from.value : []),
        to: addr(p.to ? p.to.value : []),
        cc: addr(p.cc ? p.cc.value : []),
        replyTo: addr(p.replyTo ? p.replyTo.value : []),
        text: (p.text || htmlToText(html)).slice(0, 200000),
        html: html.slice(0, 400000),
        attachments: (p.attachments || []).filter(x => x.contentDisposition !== 'inline' || !x.cid).map((x, i) => ({ index: i, filename: x.filename || `zalacznik-${i + 1}`, contentType: x.contentType, size: x.size }))
      };
    } finally { lock.release(); }
  });
}

export async function getAttachment({ folder = 'INBOX', uid, index }) {
  return withImap(async client => {
    const path = await resolveFolder(client, folder);
    const lock = await client.getMailboxLock(path);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) throw new Error('Nie znaleziono wiadomości');
      const p = await simpleParser(msg.source);
      const list = (p.attachments || []).filter(x => x.contentDisposition !== 'inline' || !x.cid);
      const a = list[index];
      if (!a) throw new Error('Nie ma takiego załącznika');
      if (a.size > 8 * 1024 * 1024) throw new Error('Załącznik jest za duży do pobrania przez panel (max 8 MB)');
      return { filename: a.filename || `zalacznik-${index + 1}`, contentType: a.contentType, size: a.size, base64: a.content.toString('base64') };
    } finally { lock.release(); }
  });
}

/* ---------- wysyłka ---------- */
function normList(v) {
  const arr = Array.isArray(v) ? v : String(v || '').split(/[,;]/);
  return arr.map(x => String(x).trim()).filter(Boolean);
}

export async function sendMail(input) {
  const to = normList(input.to), cc = normList(input.cc), bcc = normList(input.bcc);
  const bad = [...to, ...cc, ...bcc].filter(x => !EMAIL_RE.test(x.replace(/^.*<([^>]+)>$/, '$1')));
  if (!to.length) throw new Error('Brak adresata');
  if (bad.length) throw new Error('Nieprawidłowy adres: ' + bad.join(', '));
  if (!String(input.subject || '').trim()) throw new Error('Brak tematu');
  if (!input.html && !input.text) throw new Error('Pusta treść');

  const hourAgo = Date.now() - 3600000;
  while (sendLog.length && sendLog[0] < hourAgo) sendLog.shift();
  if (sendLog.length >= cfg.maxSendPerHour) throw new Error(`Przekroczono limit ${cfg.maxSendPerHour} maili na godzinę`);

  const attachments = (input.attachments || []).map(a => ({
    filename: String(a.filename || 'zalacznik'),
    content: Buffer.from(String(a.content_base64 || ''), 'base64'),
    contentType: a.content_type || undefined
  }));
  const total = attachments.reduce((s, a) => s + a.content.length, 0);
  if (total > MAX_ATTACH_TOTAL) throw new Error('Załączniki przekraczają 10 MB');

  const mail = {
    from: { name: cfg.fromName, address: cfg.from },
    replyTo: { name: cfg.fromName, address: cfg.from },
    to, cc: cc.length ? cc : undefined, bcc: bcc.length ? bcc : undefined,
    subject: String(input.subject).trim(),
    text: input.text || htmlToText(input.html),
    html: input.html || undefined,
    inReplyTo: input.in_reply_to || undefined,
    references: input.references && input.references.length ? input.references : (input.in_reply_to || undefined),
    attachments,
    headers: { 'X-Mailer': 'ShipCenter Panel Franczyzy' }
  };
  const raw = await new MailComposer(mail).compile().build();
  const messageId = (raw.toString('utf8', 0, 4000).match(/^Message-ID:\s*(<[^>]+>)/im) || [])[1] || '';

  const transport = nodemailer.createTransport({
    host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
    tls: { rejectUnauthorized: cfg.tlsRejectUnauthorized }
  });
  const info = await transport.sendMail({ envelope: { from: cfg.from, to: [...to, ...cc, ...bcc].map(x => x.replace(/^.*<([^>]+)>$/, '$1')) }, raw });
  sendLog.push(Date.now());

  // kopia do „Wysłanych”, żeby mail był widoczny także w Thunderbirdzie
  let appended = false, appendError = '', folder = '';
  try {
    await withImap(async client => { folder = await sentFolder(client); await client.append(folder, raw, ['\\Seen']); });
    appended = true;
  } catch (e) { appendError = e.message; }

  return { messageId, accepted: info.accepted || [], rejected: info.rejected || [], sentFolder: folder, appended, appendError };
}

/* ---------- diagnostyka ---------- */
export async function status() {
  const out = { from: cfg.from, imap: { ok: false }, smtp: { ok: false } };
  try {
    await withImap(async client => {
      const st = await client.status('INBOX', { messages: true, unseen: true });
      out.imap = { ok: true, inbox: st.messages, unseen: st.unseen, sentFolder: await sentFolder(client) };
    });
  } catch (e) { out.imap = { ok: false, error: e.message }; }
  try {
    const t = nodemailer.createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.secure, auth: { user: cfg.smtp.user, pass: cfg.smtp.pass }, tls: { rejectUnauthorized: cfg.tlsRejectUnauthorized } });
    await t.verify();
    out.smtp = { ok: true };
  } catch (e) { out.smtp = { ok: false, error: e.message }; }
  return out;
}
