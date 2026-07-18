import nodemailer from "nodemailer";

const hasSmtp = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);

function createTransport() {
  if (hasSmtp()) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    });
  }
  if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured");
  return nodemailer.createTransport({ streamTransport: true, newline: "unix", buffer: true });
}

export async function sendPasswordOtp({ email, name, otp, purpose = "reset" }) {
  const transporter = createTransport();
  const action = purpose === "activation" ? "activate your member account" : "reset your password";
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || "Saifee Rovers <noreply@localhost>",
    to: email,
    subject: "Your Saifee Rovers verification code",
    text: `Hello ${name}, use ${otp} to ${action}. This code expires in 10 minutes. If you did not request this, ignore this email.`,
    html: `<p>Hello ${name},</p><p>Use this verification code to ${action}:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>`,
  });
  if (!hasSmtp() && info.message) console.log(`[development email]\n${info.message.toString()}`);
}
