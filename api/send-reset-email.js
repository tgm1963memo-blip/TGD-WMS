import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const HIDDEN_CODE_POINTS = new Set([0xfeff, 0xfffe, 0x200b, 0x200c, 0x200d, 0x00ad, 0x2060]);
function cleanValue(value) {
  return String(value || '').split('').filter((c) => !HIDDEN_CODE_POINTS.has(c.charCodeAt(0))).join('').trim();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? '').trim());
}

function buildResetEmailHtml(resetLink) {
  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>รีเซ็ตรหัสผ่าน – TG Cold Storage WMS</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f4f5f7;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation"
             style="max-width:560px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 32px rgba(9,9,11,0.14);">
        <!-- Header -->
        <tr>
          <td style="background-color:#09090b;padding:32px 40px 28px;text-align:center;">
            <div style="display:inline-block;background-color:#d6a11f;border-radius:8px;
                        padding:6px 18px;margin-bottom:18px;">
              <span style="color:#09090b;font-size:13px;font-weight:800;letter-spacing:0.12em;
                           text-transform:uppercase;">TG COLD STORAGE</span>
            </div>
            <div style="border-top:2px solid #d6a11f;margin:0 0 0;"></div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="background-color:#ffffff;padding:40px 40px 36px;">
            <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase;">
              ระบบจัดการคลังสินค้า
            </p>
            <h1 style="margin:0 0 24px;font-size:26px;font-weight:800;color:#09090b;line-height:1.25;">
              รีเซ็ตรหัสผ่านของคุณ
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.6;">
              เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณในระบบ TG Cold Storage WMS
              กรุณากดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
            </p>
            <!-- CTA Button -->
            <table cellpadding="0" cellspacing="0" role="presentation" style="margin:28px 0;">
              <tr>
                <td style="background-color:#d6a11f;border-radius:8px;">
                  <a href="${resetLink}"
                     style="display:inline-block;padding:14px 32px;color:#09090b;font-size:15px;
                            font-weight:800;text-decoration:none;letter-spacing:0.02em;">
                    ตั้งรหัสผ่านใหม่ →
                  </a>
                </td>
              </tr>
            </table>
            <!-- Security notice -->
            <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:24px 0 0;">
              <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#374151;">&#9888; หมายเหตุด้านความปลอดภัย</p>
              <ul style="margin:0;padding-left:20px;font-size:13px;color:#6b7280;line-height:1.7;">
                <li>ลิงก์นี้จะหมดอายุภายใน <strong>1 ชั่วโมง</strong></li>
                <li>สามารถใช้ได้เพียง <strong>1 ครั้ง</strong> เท่านั้น</li>
                <li>หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน โปรดเพิกเฉยต่ออีเมลนี้</li>
              </ul>
            </div>
            <!-- Fallback link -->
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
              หากปุ่มด้านบนไม่ทำงาน ให้คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br/>
              <a href="${resetLink}" style="color:#d6a11f;word-break:break-all;">${resetLink}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background-color:#09090b;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.5);line-height:1.6;">
              บริษัท ทีจี โคลด์ สตอเรจ จำกัด · TG Cold Storage WMS<br/>
              อีเมลนี้ถูกส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = cleanValue(req.body?.email ?? '');
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'กรุณากรอกอีเมลที่ถูกต้อง' });
  }

  const supabaseUrl = cleanValue(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '');
  const serviceRoleKey = cleanValue(process.env.SUPABASE_SERVICE_ROLE_KEY || '');
  const smtpHost = cleanValue(process.env.SMTP_HOST || '');
  const smtpUser = cleanValue(process.env.SMTP_USER || '');
  const smtpPass = cleanValue(process.env.SMTP_PASS || '');
  const smtpPort = parseInt(cleanValue(process.env.SMTP_PORT || '587'));
  const siteUrl = cleanValue(process.env.SITE_URL || process.env.UAT_BASE_URL || 'https://tgc-wms.vercel.app');

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'ระบบอีเมลยังไม่ได้รับการตั้งค่า (missing Supabase credentials)' });
  }
  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'ระบบอีเมลยังไม่ได้รับการตั้งค่า (missing SMTP credentials)' });
  }

  // 1. Generate Supabase recovery link (server-side, no rate limit)
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${siteUrl}/reset-password` },
  });

  if (linkError) {
    return res.status(400).json({ error: linkError.message });
  }

  // Use hashed_token to build a direct link to our app — bypasses Supabase's server-side
  // redirect (which uses the Dashboard "Site URL", often set to localhost in dev).
  const tokenHash = linkData?.properties?.hashed_token ?? linkData?.hashed_token;
  if (!tokenHash) {
    return res.status(500).json({ error: 'ไม่สามารถสร้างลิงก์รีเซ็ตได้' });
  }
  const resetLink = `${siteUrl}/reset-password?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;

  // 2. Send via company SMTP
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  try {
    await transporter.sendMail({
      from: `"TG Cold Storage WMS" <${smtpUser}>`,
      to: email,
      subject: 'รีเซ็ตรหัสผ่าน — TG Cold Storage WMS',
      html: buildResetEmailHtml(resetLink),
    });
    return res.status(200).json({ success: true, message: 'ส่งอีเมล์สำเร็จ' });
  } catch (smtpError) {
    return res.status(500).json({ error: `SMTP error: ${smtpError.message}` });
  }
}
