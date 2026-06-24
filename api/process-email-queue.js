import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const HIDDEN_CODE_POINTS = new Set([0xfeff, 0xfffe, 0x200b, 0x200c, 0x200d, 0x00ad, 0x2060]);
function cleanValue(value) {
  return String(value || '').split('').filter((c) => !HIDDEN_CODE_POINTS.has(c.charCodeAt(0))).join('').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'POST, GET');
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const supabaseUrl = cleanValue(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = cleanValue(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

  const smtpHost = cleanValue(process.env.SMTP_HOST || '');
  const smtpUser = cleanValue(process.env.SMTP_USER || '');
  const smtpPass = cleanValue(process.env.SMTP_PASS || '');
  const smtpPort = parseInt(cleanValue(process.env.SMTP_PORT || '587'));

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }
  if (!smtpHost || !smtpUser || !smtpPass) {
    return res.status(500).json({ error: 'Missing SMTP credentials' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Fetch pending emails
  const { data: queue, error: fetchError } = await adminClient
    .from('tgd_customer_request_email_queue')
    .select('*')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: true })
    .limit(50);

  if (fetchError) {
    return res.status(500).json({ error: `Failed to fetch queue: ${fetchError.message}` });
  }

  if (!queue || queue.length === 0) {
    return res.status(200).json({ success: true, message: 'No pending emails' });
  }

  // 2. Configure SMTP transporter
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  let successCount = 0;
  let failureCount = 0;

  // 3. Process each email
  for (const item of queue) {
    try {
      const emailHtml = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>${item.subject}</title>
</head>
<body style="font-family:sans-serif;background-color:#f4f5f7;padding:40px;">
  <div style="background-color:#fff;padding:40px;border-radius:8px;max-width:600px;margin:0 auto;">
    <h2 style="color:#09090b;">${item.subject}</h2>
    <p style="color:#374151;font-size:16px;">${item.body_preview}</p>
    <br/>
    <p style="color:#6b7280;font-size:14px;">TG Cold Storage WMS</p>
  </div>
</body>
</html>`;

      await transporter.sendMail({
        from: `"TG Cold Storage WMS" <${smtpUser}>`,
        to: item.recipient_email,
        subject: item.subject,
        html: emailHtml,
      });

      await adminClient
        .from('tgd_customer_request_email_queue')
        .update({ status: 'SENT', sent_at: new Date().toISOString() })
        .eq('id', item.id);
      
      successCount++;
    } catch (err) {
      console.error(`Failed to send email ${item.id}:`, err);
      await adminClient
        .from('tgd_customer_request_email_queue')
        .update({ status: 'FAILED', error_log: err.message })
        .eq('id', item.id);
      
      failureCount++;
    }
  }

  return res.status(200).json({
    success: true,
    processed: queue.length,
    successCount,
    failureCount,
  });
}
