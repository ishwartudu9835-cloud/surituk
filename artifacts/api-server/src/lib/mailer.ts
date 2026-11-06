import nodemailer from "nodemailer";
import { config } from "./config";
import { logger } from "./logger";

const transporter = config.smtp.host && config.smtp.user
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

export const mailEnabled = Boolean(transporter);

export async function sendMail(to: string, subject: string, html: string, text: string) {
  if (!transporter) {
    logger.warn({ to, subject }, `[mail disabled] ${text}`);
    return;
  }
  await transporter.sendMail({ from: config.smtp.from, to, subject, html, text });
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
