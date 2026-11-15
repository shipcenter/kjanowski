/* Konfiguracja z pliku .env (node --env-file=.env) */

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();
const bool = (k, d) => { const v = env(k, d ? 'true' : 'false').toLowerCase(); return v === 'true' || v === '1' || v === 'yes'; };
const int = (k, d) => { const n = parseInt(env(k, String(d)), 10); return Number.isFinite(n) ? n : d; };

export const cfg = {
  host: env('HOST', '127.0.0.1'),
  port: int('PORT', 8787),
  secret: env('MCP_SECRET'),
  imap: {
    host: env('IMAP_HOST', 'shipcenter.pl'),
    port: int('IMAP_PORT', 143),
    secure: bool('IMAP_SECURE', false),
    user: env('IMAP_USER', 'franczyza@shipcenter.pl'),
    pass: env('IMAP_PASS')
  },
  smtp: {
    host: env('SMTP_HOST', 'shipcenter.pl'),
    port: int('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false),
    user: env('SMTP_USER', 'franczyza@shipcenter.pl'),
    pass: env('SMTP_PASS')
  },
  from: env('MAIL_FROM', 'franczyza@shipcenter.pl'),
  fromName: env('MAIL_FROM_NAME', 'ShipCenter – Franczyza'),
  sentFolder: env('SENT_FOLDER'),
  tlsRejectUnauthorized: bool('TLS_REJECT_UNAUTHORIZED', true),
  maxSendPerHour: int('MAX_SEND_PER_HOUR', 80),
  smsapi: {
    token: env('SMSAPI_TOKEN'),
    from: env('SMSAPI_FROM'),
    url: env('SMSAPI_URL', 'https://api.smsapi.pl').replace(/\/+$/, ''),
    maxPerHour: int('MAX_SMS_PER_HOUR', 60)
  }
};

export function assertConfig({ needSecret = true } = {}) {
  const errors = [];
  if (needSecret && cfg.secret.length < 32) errors.push('MCP_SECRET musi mieć co najmniej 32 znaki (openssl rand -hex 32)');
  if (!cfg.imap.pass) errors.push('Brak IMAP_PASS');
  if (!cfg.smtp.pass) errors.push('Brak SMTP_PASS');
  if (errors.length) {
    console.error('Błędna konfiguracja (.env):\n - ' + errors.join('\n - '));
    process.exit(1);
  }
}
