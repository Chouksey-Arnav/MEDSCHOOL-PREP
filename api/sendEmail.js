// api/sendEmail.js — Vercel Serverless Function (ESM)
// Sends OTP password-reset codes via Gmail + Nodemailer.
// Required env vars in Vercel dashboard:
//   GMAIL_USER         → e.g. yourapp@gmail.com
//   GMAIL_APP_PASSWORD → 16-char Google App Password (no spaces)
//
// This file uses ES Module syntax because package.json has "type": "module".

import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { to, subject, code } = req.body || {};

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
    return res.status(500).json({ error: 'Email service not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel dashboard.' });
  }

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
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
        <tr><td style="padding-bottom:28px;">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#3b82f6,#6366f1);text-align:center;line-height:48px;font-weight:900;font-size:22px;color:#fff;">M</div>
        </td></tr>
        <tr><td style="background:#090d1a;border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:36px 32px;">
          <h2 style="color:#f9fafb;font-size:22px;font-weight:800;margin:0 0 8px;letter-spacing:-0.03em;">Reset your password</h2>
          <p style="color:rgba(255,255,255,0.5);font-size:14px;margin:0 0 28px;line-height:1.6;">
            Enter the code below in MedSchoolPrep to reset your password.<br/>
            <strong style="color:rgba(255,255,255,0.4);">This code expires in 15 minutes.</strong>
          </p>
          <div style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);border-radius:14px;padding:24px;text-align:center;margin-bottom:28px;">
            <div style="font-size:42px;font-weight:900;letter-spacing:10px;color:#60a5fa;font-family:monospace;">${code}</div>
          </div>
          <p style="color:rgba(255,255,255,0.35);font-size:12px;margin:0;line-height:1.6;">
            If you did not request a password reset, ignore this email.<br/>
            MedSchoolPrep staff will <strong>never</strong> ask you for this code.
          </p>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="color:rgba(255,255,255,0.18);font-size:12px;margin:0;">© 2025 MedSchoolPrep. All rights reserved.</p>
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
      text: `Your MedSchoolPrep verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
      html,
    });
    console.log(`OTP sent to: ${to}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Nodemailer error:', err.message);
    return res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
}
