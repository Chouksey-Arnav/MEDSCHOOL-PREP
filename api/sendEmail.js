// api/send-otp.js — Vercel Serverless Function
// Sends OTP verification/reset codes via Gmail + Nodemailer.
// Required env vars in Vercel dashboard: GMAIL_USER, GMAIL_APP_PASSWORD

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // ── CORS ──
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, code, name, type } = req.body || {};

  if (!to || !subject || !code) {
    return res.status(400).json({ error: 'Missing required fields: to, subject, code' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(to)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD');
    return res.status(500).json({ error: 'Email service not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD in Vercel dashboard.' });
  }

  const isReset = type === 'reset';

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
</head>
<body style="margin:0;padding:0;background:#030014;font-family:-apple-system,'Inter',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030014;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:500px;">

        <!-- Logo -->
        <tr><td style="padding-bottom:28px;">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);text-align:center;line-height:48px;font-weight:900;font-size:22px;color:#fff;display:inline-block;">M</div>
          <span style="vertical-align:middle;margin-left:10px;font-size:17px;font-weight:800;color:#fff;letter-spacing:-0.02em;">MedSchoolPrep</span>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#0d1117;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px 36px;">

          <h2 style="color:#f9fafb;font-size:22px;font-weight:800;margin:0 0 8px;letter-spacing:-0.03em;">
            ${isReset ? 'Reset your password' : `Welcome to MedSchoolPrep${name ? `, ${name}` : ''}!`}
          </h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 30px;line-height:1.65;">
            ${isReset
              ? 'Enter the verification code below to complete your password reset.'
              : 'Enter the code below to verify your email address and activate your account.'}
            <br/><strong style="color:rgba(255,255,255,0.4);">This code expires in 15 minutes.</strong>
          </p>

          <!-- OTP Box -->
          <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:16px;padding:28px;text-align:center;margin-bottom:30px;">
            <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:rgba(147,197,253,0.6);margin-bottom:14px;">
              Your one-time verification code
            </div>
            <div style="font-size:46px;font-weight:900;letter-spacing:14px;color:#93c5fd;font-family:'Courier New',Courier,monospace;">
              ${code}
            </div>
            <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:12px;">
              Valid for 15 minutes &nbsp;&bull;&nbsp; Do not share this code
            </div>
          </div>

          ${!isReset ? `
          <!-- Steps -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="padding:6px 0;">
              <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.35);text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#a5b4fc;vertical-align:middle;">1</span>
              <span style="margin-left:10px;font-size:13px;color:rgba(255,255,255,0.5);vertical-align:middle;">Return to the MedSchoolPrep tab in your browser</span>
            </td></tr>
            <tr><td style="padding:6px 0;">
              <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.35);text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#a5b4fc;vertical-align:middle;">2</span>
              <span style="margin-left:10px;font-size:13px;color:rgba(255,255,255,0.5);vertical-align:middle;">Enter the 6-digit code in the verification field</span>
            </td></tr>
            <tr><td style="padding:6px 0;">
              <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.35);text-align:center;line-height:22px;font-size:11px;font-weight:700;color:#a5b4fc;vertical-align:middle;">3</span>
              <span style="margin-left:10px;font-size:13px;color:rgba(255,255,255,0.5);vertical-align:middle;">Your account activates instantly — start studying</span>
            </td></tr>
          </table>
          ` : ''}

          <!-- Security notice -->
          <div style="background:rgba(245,158,11,0.07);border:1px solid rgba(245,158,11,0.2);border-radius:12px;padding:14px 18px;">
            <p style="font-size:12.5px;color:rgba(253,230,138,0.7);margin:0;line-height:1.65;">
              <strong style="color:rgba(253,230,138,0.9);">Security notice:</strong>
              MedSchoolPrep will never ask for this code over phone or chat.
              If you did not request this, you can safely ignore this email.
            </p>
          </div>

        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="color:rgba(255,255,255,0.18);font-size:12px;margin:0 0 4px;">
            Questions? <a href="mailto:${gmailUser}" style="color:rgba(147,197,253,0.4);text-decoration:none;">${gmailUser}</a>
          </p>
          <p style="color:rgba(255,255,255,0.12);font-size:11px;margin:0;">
            © 2025 MedSchoolPrep. The Everything App for Premeds.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"MedSchoolPrep" <${gmailUser}>`,
      to,
      subject,
      text: `Your MedSchoolPrep verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, please ignore this email.`,
      html,
    });
    console.log(`OTP sent to: ${to}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Nodemailer error:', err.message);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
}
