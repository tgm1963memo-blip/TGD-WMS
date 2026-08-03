import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import { buildDocumentExcelBuffer } from './_lib/documentExcelBuilders.js';

const HIDDEN_CODE_POINTS = new Set([0xfeff, 0xfffe, 0x200b, 0x200c, 0x200d, 0x00ad, 0x2060]);
function cleanValue(value) {
  return String(value || '').split('').filter((c) => !HIDDEN_CODE_POINTS.has(c.charCodeAt(0))).join('').trim();
}

const HEADER_SELECT_BY_DOCUMENT_TYPE = {
  CUSTOMER_DEPOSIT_REQUEST: {
    table: 'tgd_customer_deposit_requests',
    docNoField: 'request_no',
    select: 'id, request_no, customer_id, customer:tgd_customers(customer_code, customer_name, name, address, phone), expected_arrival_date, contact_name, vehicle_registration, note, created_at',
    linesTable: 'tgd_customer_deposit_request_lines',
    linesFk: 'deposit_request_id',
    linesSelect: 'line_no, customer_product_code, internal_product_code, product_name, lot_no, tracking_code, mfg_date, exp_date, expected_boxes, expected_weight, actual_boxes, actual_weight, note, actual_note',
  },
  CUSTOMER_WITHDRAWAL_REQUEST: {
    table: 'tgd_customer_withdrawal_requests',
    docNoField: 'withdrawal_no',
    select: 'id, withdrawal_no, customer_id, customer:tgd_customers(customer_code, customer_name, name, address, phone), requested_dispatch_date, destination, vehicle_registration, pickup_contact, note, created_at',
    linesTable: 'tgd_customer_withdrawal_request_lines',
    linesFk: 'withdrawal_request_id',
    linesSelect: 'line_no, customer_product_code, internal_product_code, product_name, lot_no, source_lot_no, tracking_code, mfg_date, exp_date, requested_boxes, requested_weight, picked_boxes, picked_weight, note, admin_note',
  },
};

// Builds the deposit/withdrawal report attachment for a queued customer
// confirmation email. Returns null (never throws) on any failure — a
// missing/failed attachment must never block the notification itself from
// being sent, since the confirmation text is the primary thing the
// customer needs.
async function buildAttachmentForQueueItem(adminClient, item) {
  const config = HEADER_SELECT_BY_DOCUMENT_TYPE[item.document_type];
  if (!config || item.notification_kind !== 'CUSTOMER_CONFIRMATION') return null;

  try {
    const [{ data: header, error: headerError }, { data: lines, error: linesError }] = await Promise.all([
      adminClient.from(config.table).select(config.select).eq('id', item.document_id).maybeSingle(),
      adminClient.from(config.linesTable).select(config.linesSelect).eq(config.linesFk, item.document_id).order('line_no'),
    ]);
    if (headerError || linesError || !header) return null;

    const buffer = buildDocumentExcelBuffer(item.document_type, header, lines ?? []);
    if (!buffer) return null;

    const docNo = header[config.docNoField] ?? item.document_no ?? 'document';
    return { filename: `${docNo}.xlsx`, content: buffer };
  } catch (err) {
    console.error(`Failed to build attachment for email ${item.id}:`, err);
    return null;
  }
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
      const appUrl = cleanValue(process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tgc-wms.vercel.app');
      const emailHtml = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${item.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Card wrapper -->
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;border-radius:12px;overflow:hidden;box-shadow:0 4px 32px rgba(9,9,11,0.14);">
          <!-- HEADER -->
          <tr>
            <td style="background-color:#09090b;padding:36px 40px 28px;text-align:center;">
              <div style="display:inline-block;background-color:#d6a11f;padding:5px 18px;border-radius:5px;margin-bottom:18px;">
                <span style="color:#09090b;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;">
                  TG COLD STORAGE
                </span>
              </div>
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">
                ระบบจัดการคลังเย็น
              </h1>
              <p style="margin:0;color:#9ca3af;font-size:13px;font-weight:400;">
                Warehouse Management System
              </p>
            </td>
          </tr>
          <!-- Gold divider -->
          <tr>
            <td style="background-color:#d6a11f;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- BODY -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;">
              <!-- Delight Icon -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 24px;">
                <tr>
                  <td style="width:52px;height:52px;background-color:#eff6ff;border-radius:50%;text-align:center;vertical-align:middle;font-size:24px;line-height:52px;">
                    &#128276;
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 16px;color:#09090b;font-size:20px;font-weight:700;">
                ${item.subject}
              </h2>
              <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.65;white-space:pre-wrap;">${item.body_preview}</p>
              
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 16px;width:100%;">
                <tr>
                  <td align="center">
                    <a href="${appUrl}" style="display:inline-block;padding:15px 40px;background-color:#d6a11f;color:#09090b;font-size:15px;font-weight:700;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                      เข้าสู่ระบบ (Login)
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;text-align:center;color:#9ca3af;font-size:13px;">หากมีข้อสงสัย กรุณาติดต่อแอดมิน TG Cold Storage</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const attachment = await buildAttachmentForQueueItem(adminClient, item);

      await transporter.sendMail({
        from: `"TG Cold Storage WMS" <${smtpUser}>`,
        to: item.recipient_email,
        subject: item.subject,
        html: emailHtml,
        attachments: attachment ? [attachment] : undefined,
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
