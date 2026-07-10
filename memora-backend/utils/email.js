const nodemailer = require('nodemailer');
require('dotenv').config();

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_SERVICE = process.env.SMTP_SERVICE || '';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Memora';
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || `no-reply@${process.env.DOMAIN || 'memora.app'}`;

let transporter = null;

function isEmailConfigured() {
  const hasServiceConfig = Boolean(SMTP_SERVICE && SMTP_USER && SMTP_PASS && EMAIL_FROM);
  const hasHostConfig = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && EMAIL_FROM);
  return hasServiceConfig || hasHostConfig;
}

function getTransporter() {
  if (transporter) return transporter;
  if (!isEmailConfigured()) return null;

  transporter = nodemailer.createTransport({
    ...(SMTP_SERVICE ? { service: SMTP_SERVICE } : { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE }),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  return transporter;
}

async function sendResetCode(toEmail, code, opts = {}) {
  const t = getTransporter();
  if (!t) {
    throw new Error('Email not configured');
  }

  const expiresMinutes = opts.expiresMinutes || 10;

  const subject = 'Memora — Your password reset code';
  const text = `Your Memora password reset code is ${code}. It expires in ${expiresMinutes} minutes.`;
  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial; color: #0f172a;">
      <h3 style="margin:0 0 8px 0">Memora password reset</h3>
      <p style="margin:0 0 12px 0">Your 6-digit password reset code is:</p>
      <div style="font-size:24px; font-weight:700; letter-spacing:6px; background:#f3f4f6; padding:10px 14px; display:inline-block; border-radius:6px">${code}</div>
      <p style="margin:12px 0 0 0; color:#475569; font-size:13px">This code expires in ${expiresMinutes} minutes.</p>
      <p style="margin:12px 0 0 0; color:#475569; font-size:13px">If you did not request this request, you can safely ignore this email.</p>
    </div>
  `;

  const msg = {
    from: `"${SMTP_FROM_NAME}" <${EMAIL_FROM}>`,
    to: toEmail,
    subject,
    text,
    html
  };

  return t.sendMail(msg);
}

module.exports = {
  isEmailConfigured,
  sendResetCode
};
