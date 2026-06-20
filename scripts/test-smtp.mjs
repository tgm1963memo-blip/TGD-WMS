// scripts/test-smtp.mjs — test company SMTP directly
// Run: node scripts/test-smtp.mjs <to-email>
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __dirname = dirname(fileURLToPath(import.meta.url));

const envPath = join(__dirname, '../.env.local');
const env = {};
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
  }
} catch (e) {
  console.error('Could not read .env.local:', e.message);
  process.exit(1);
}

const toEmail = process.argv[2] || env.UAT_EMAIL || 'test@example.com';

console.log('SMTP Host:', env.SMTP_HOST);
console.log('SMTP Port:', env.SMTP_PORT);
console.log('SMTP User:', env.SMTP_USER);
console.log('Sending test to:', toEmail);
console.log('---');

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: parseInt(env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  tls: { rejectUnauthorized: false },
});

try {
  console.log('Verifying SMTP connection...');
  await transporter.verify();
  console.log('✅ SMTP connection OK');

  console.log('Sending test email...');
  const info = await transporter.sendMail({
    from: `"TG Cold Storage WMS" <${env.SMTP_USER}>`,
    to: toEmail,
    subject: '[TEST] TGC WMS — ทดสอบการส่งอีเมล',
    html: `<p>อีเมลทดสอบจากระบบ TG Cold Storage WMS</p><p>เวลา: ${new Date().toLocaleString('th-TH')}</p>`,
  });
  console.log('✅ Email sent! Message ID:', info.messageId);
} catch (err) {
  console.error('❌ SMTP Error:', err.message);
  if (err.code) console.error('   Code:', err.code);
  if (err.responseCode) console.error('   SMTP Response Code:', err.responseCode);
  if (err.response) console.error('   SMTP Response:', err.response);
  process.exit(1);
}
