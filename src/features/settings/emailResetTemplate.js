// HTML email template for Supabase → Authentication → Email Templates → Reset Password
// Use {{ .ConfirmationURL }} as the reset link variable (Supabase Go template syntax).

export const RESET_PASSWORD_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>รีเซ็ตรหัสผ่าน – TG Cold Storage WMS</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#f4f5f7;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card wrapper -->
        <table width="560" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:560px;width:100%;border-radius:12px;overflow:hidden;
                      box-shadow:0 4px 32px rgba(9,9,11,0.14);">

          <!-- ── HEADER ─────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#09090b;padding:36px 40px 28px;text-align:center;">
              <!-- Gold badge -->
              <div style="display:inline-block;background-color:#d6a11f;
                          padding:5px 18px;border-radius:5px;margin-bottom:18px;">
                <span style="color:#09090b;font-size:10px;font-weight:700;
                             letter-spacing:2.5px;text-transform:uppercase;">
                  TG COLD STORAGE
                </span>
              </div>
              <!-- Title -->
              <h1 style="margin:0 0 6px;color:#ffffff;font-size:20px;
                         font-weight:700;letter-spacing:-0.3px;">
                ระบบจัดการคลังเย็น
              </h1>
              <p style="margin:0;color:#9ca3af;font-size:13px;font-weight:400;">
                Warehouse Management System
              </p>
            </td>
          </tr>

          <!-- Gold divider line -->
          <tr>
            <td style="background-color:#d6a11f;height:3px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- ── BODY ───────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 32px;">

              <!-- Icon circle -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 0 24px;">
                <tr>
                  <td style="width:52px;height:52px;background-color:#fff4cc;
                              border-radius:50%;text-align:center;vertical-align:middle;
                              font-size:24px;line-height:52px;">
                    🔐
                  </td>
                </tr>
              </table>

              <h2 style="margin:0 0 10px;color:#09090b;font-size:22px;font-weight:700;">
                รีเซ็ตรหัสผ่านของคุณ
              </h2>
              <p style="margin:0 0 28px;color:#4b5563;font-size:15px;line-height:1.65;">
                เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชี
                <strong>TG Cold Storage WMS</strong> ของคุณ<br />
                คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 0 32px;">
                <tr>
                  <td align="center"
                      style="background-color:#d6a11f;border-radius:8px;">
                    <a href="{{ .ConfirmationURL }}"
                       style="display:inline-block;padding:15px 40px;color:#09090b;
                              font-size:15px;font-weight:700;text-decoration:none;
                              border-radius:8px;letter-spacing:0.3px;">
                      ตั้งรหัสผ่านใหม่
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Security notice -->
              <table cellpadding="0" cellspacing="0" role="presentation"
                     style="margin:0 0 28px;width:100%;">
                <tr>
                  <td style="background-color:#f9fafb;border-left:3px solid #d6a11f;
                              border-radius:0 8px 8px 0;padding:16px 20px;">
                    <p style="margin:0 0 6px;color:#09090b;font-size:13px;font-weight:600;">
                      ⏱️ ลิงก์นี้หมดอายุใน 1 ชั่วโมง
                    </p>
                    <p style="margin:0;color:#4b5563;font-size:13px;line-height:1.6;">
                      หากคุณ<strong>ไม่ได้</strong>ขอรีเซ็ตรหัสผ่าน
                      สามารถเพิกเฉยต่ออีเมลนี้ได้อย่างปลอดภัย
                      รหัสผ่านของคุณจะไม่ถูกเปลี่ยน
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <p style="margin:0;color:#6b7280;font-size:12px;line-height:1.7;">
                หากปุ่มด้านบนไม่ทำงาน คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br />
                <a href="{{ .ConfirmationURL }}"
                   style="color:#d6a11f;word-break:break-all;font-size:11px;">
                  {{ .ConfirmationURL }}
                </a>
              </p>
            </td>
          </tr>

          <!-- ── FOOTER ─────────────────────────────────────────── -->
          <tr>
            <td style="background-color:#09090b;padding:24px 40px;text-align:center;">
              <p style="margin:0 0 4px;color:#9ca3af;font-size:12px;font-weight:500;">
                บริษัท ทีจี โคลด์ สตอเรจ จำกัด
              </p>
              <p style="margin:0;color:#6b7280;font-size:11px;">
                อีเมลนี้ส่งโดยอัตโนมัติ — กรุณาอย่าตอบกลับ
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card wrapper -->

        <!-- Below-card note -->
        <p style="margin:20px 0 0;color:#9ca3af;font-size:11px;text-align:center;">
          © 2025 TG Cold Storage Co., Ltd. · ระบบ WMS
        </p>

      </td>
    </tr>
  </table>
</body>
</html>`;

export const RESET_PASSWORD_EMAIL_SUBJECT = 'รีเซ็ตรหัสผ่าน – TG Cold Storage WMS';
