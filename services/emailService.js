import nodemailer from "nodemailer";

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);
}

export async function sendMemberOtp(member, otp) {
  if (!smtpConfigured()) {
    if (process.env.NODE_ENV === "production") throw new Error("Email delivery is not configured");
    console.log(`[development] Member OTP for ${member.email}: ${otp}`);
    return false;
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: member.email,
    subject: "Your Saifee Rovers verification code",
    text: `Hello ${member.name}, your verification code is ${otp}. It expires in 10 minutes.`,
    html: `<p>Hello ${member.name},</p><p>Your Saifee Rovers verification code is:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes.</p>`,
  });
  return true;
}
