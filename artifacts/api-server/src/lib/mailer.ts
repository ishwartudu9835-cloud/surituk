import nodemailer from "nodemailer";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Email sending. Preference order:
 *  1. Brevo HTTP API (BREVO_API_KEY) — uses HTTPS, so it works on Render's free plan,
 *     which blocks SMTP ports 25/465/587.
 *  2. SMTP (SMTP_HOST/SMTP_USER/SMTP_PASS) — e.g. Gmail app password, on hosts that allow it.
 *  3. Nothing configured — the message is only logged (local development).
 */
const transporter = !config.brevoApiKey && config.smtp.host && config.smtp.user
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
      // Fail fast instead of hanging the login button for minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    })
  : null;

export const mailEnabled = Boolean(config.brevoApiKey || transporter);

async function sendViaBrevo(to: string, subject: string, html: string, text: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": config.brevoApiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: config.mailFromName, email: config.mailFromEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  } finally {
    clearTimeout(timer);
  }
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (config.brevoApiKey) return sendViaBrevo(to, subject, html, text);
  if (transporter) {
    await transporter.sendMail({ from: config.smtp.from, to, subject, html, text });
    return;
  }
  logger.warn({ to, subject }, `[mail disabled] ${text}`);
}

export async function sendOtpEmail(to: string, code: string) {
  const text = `Your Surituk login code is ${code}. It expires in 10 minutes. If you didn't request this, ignore this email.`;
  const html = `
  <div style="font-family:Arial,sans-serif;background:#0F0D0C;padding:32px;color:#F7EFE3">
    <div style="max-width:420px;margin:auto;background:#171412;border-radius:12px;padding:28px;border:1px solid #2a2420">
      <h2 style="margin:0 0 8px;font-family:Georgia,serif">Sur<span style="color:#E1191F">i</span>tuk</h2>
      <p style="color:#a89d90;margin:0 0 20px">Your login code</p>
      <div style="font-size:34px;letter-spacing:10px;font-weight:bold;color:#F7EFE3;background:#0F0D0C;border-radius:8px;padding:16px;text-align:center">${code}</div>
      <p style="color:#a89d90;font-size:13px;margin-top:20px">This code expires in 10 minutes. If you didn't try to log in, you can ignore this email.</p>
    </div>
  </div>`;
  await sendMail(to, `${code} is your Surituk login code`, html, text);
}
