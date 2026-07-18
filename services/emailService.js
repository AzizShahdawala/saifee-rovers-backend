import nodemailer from "nodemailer";
import crypto from "crypto";

const gmailUser = process.env.SMTP_USER || "azizshada@gmail.com";
const gmailPassword = String(process.env.SMTP_PASSWORD || "").replace(/\s/g, "");
const hasGmailCredentials = () => Boolean(gmailUser && gmailPassword);
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]);

function createTransport() {
  if (hasGmailCredentials()) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    });
  }
  if (process.env.NODE_ENV === "production") throw new Error("Gmail delivery is not configured. Set SMTP_PASSWORD to a Google app password");
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
  const transporter = createTransport();
  const action = purpose === "activation" ? "activate your member account" : "reset your password";
  const reference = crypto.randomBytes(3).toString("hex").toUpperCase();
  const subject = purpose === "activation" ? "Activate your Saifee Rovers account" : "Reset your Saifee Rovers password";
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || `Saifee Rovers <${gmailUser}>`,
    to: email,
    subject: `${subject} [${reference}]`,
    headers: { "X-Entity-Ref-ID": reference },
    text: `Hello ${name}, use verification code ${otp} to ${action}. It expires in 10 minutes. If you did not request this, ignore this email.`,
    html: emailHtml({ name, otp, action }),
  });
  if (!hasGmailCredentials() && info.message) console.log(`[development email]\n${info.message.toString()}`);
  if (hasGmailCredentials()) console.info("Verification email accepted", { to: email, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  return { messageId: info.messageId, accepted: info.accepted || [], rejected: info.rejected || [] };
}

export async function verifyEmailTransport() {
  if (!hasGmailCredentials()) return { configured: false };
  await createTransport().verify();
  return { configured: true, account: gmailUser };
}
