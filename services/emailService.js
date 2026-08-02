import nodemailer from "nodemailer";
import crypto from "crypto";

const smtpHost = process.env.SMTP_HOST || "smtp-relay.brevo.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = String(process.env.SMTP_USER || "").trim();
const smtpPassword = String(process.env.SMTP_PASSWORD || "").trim();
const hasSmtpCredentials = () => Boolean(smtpHost && smtpPort && smtpUser && smtpPassword);
const brevoApiKey = String(process.env.BREVO_API_KEY || "").trim();
const senderEmail = process.env.EMAIL_FROM_ADDRESS || "webdevelopment5253@gmail.com";
const senderName = process.env.EMAIL_FROM_NAME || "Saifee Rovers";
const hasBrevoApiCredentials = () => Boolean(brevoApiKey && senderEmail);
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

function createTransport() {
  if (hasSmtpCredentials()) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      requireTLS: !smtpSecure,
      auth: { user: smtpUser, pass: smtpPassword },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }
  if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured. Set the SMTP credentials");
  return nodemailer.createTransport({ streamTransport: true, newline: "unix", buffer: true });
}

function emailHtml({ name, otp, action }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef4f8;font-family:Arial,Helvetica,sans-serif;color:#102a43">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef4f8;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 12px 36px rgba(15,53,87,.12)">
        <tr><td style="padding:30px 36px;text-align:center;background:linear-gradient(135deg,#071a33,#0b6680,#1ca6a0)">
          <div style="font-size:25px;line-height:1.2;font-weight:800;color:#ffffff">Saifee Rovers</div>
          <div style="margin-top:6px;font-size:13px;letter-spacing:1.4px;text-transform:uppercase;color:#c8f3ef">Secure account verification</div>
        </td></tr>
        <tr><td style="padding:36px">
          <p style="margin:0 0 16px;font-size:18px;font-weight:700">Hello ${escapeHtml(name)},</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#52677a">We received a request to ${escapeHtml(action)}. Enter the verification code below in the Saifee Rovers application.</p>
          <div style="margin:0 auto 24px;padding:20px;text-align:center;background:#edf9f7;border:1px solid #bce7e2;border-radius:14px">
            <div style="font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#39716e">Verification code</div>
            <div style="margin-top:8px;font-size:36px;line-height:1;font-weight:800;letter-spacing:9px;color:#075b63">${escapeHtml(otp)}</div>
          </div>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#52677a">This code expires in <strong>10 minutes</strong> and can be used only once.</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#52677a">If you did not request this change, ignore this email. Your current password remains unchanged.</p>
        </td></tr>
        <tr><td style="padding:20px 36px;text-align:center;background:#f7fafc;border-top:1px solid #e6edf2;font-size:12px;line-height:1.6;color:#7b8b99">This is an automated security email from Saifee Rovers.<br>Please do not reply.</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function sendPasswordOtp({ email, name, otp, purpose = "reset" }) {
  const action = purpose === "activation" ? "activate your member account" : "reset your password";
  const reference = crypto.randomBytes(3).toString("hex").toUpperCase();
  const subject = purpose === "activation" ? "Activate your Saifee Rovers account" : "Reset your Saifee Rovers password";
  const text = `Hello ${name}, use verification code ${otp} to ${action}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = emailHtml({ name, otp, action });

  if (hasBrevoApiCredentials()) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { accept: "application/json", "api-key": brevoApiKey, "content-type": "application/json" },
      body: JSON.stringify({
        sender: { email: senderEmail, name: senderName },
        to: [{ email, name }],
        subject: `${subject} [${reference}]`,
        textContent: text,
        htmlContent: html,
        headers: { "X-Entity-Ref-ID": reference },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Brevo email delivery failed (${response.status}): ${result.message || "Unknown error"}`);
    console.info("Verification email accepted by Brevo API", { to: email, messageId: result.messageId });
    return { messageId: result.messageId, accepted: [email], rejected: [] };
  }

  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `${senderName} <${senderEmail}>`,
    to: email,
    subject: `${subject} [${reference}]`,
    headers: { "X-Entity-Ref-ID": reference },
    text,
    html,
  });
  if (!hasSmtpCredentials() && info.message) console.log(`[development email]\n${info.message.toString()}`);
  if (hasSmtpCredentials()) console.info("Verification email accepted", { to: email, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  return { messageId: info.messageId, accepted: info.accepted || [], rejected: info.rejected || [] };
}

export async function verifyEmailTransport() {
  if (hasBrevoApiCredentials()) {
    const response = await fetch("https://api.brevo.com/v3/account", {
      headers: { accept: "application/json", "api-key": brevoApiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Brevo API verification failed (${response.status})`);
    return { configured: true, provider: "api.brevo.com", account: senderEmail };
  }
  if (!hasSmtpCredentials()) return { configured: false };
  await createTransport().verify();
  return { configured: true, provider: smtpHost, account: smtpUser };
}
