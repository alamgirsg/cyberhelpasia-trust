import "server-only";
import type { Transporter } from "nodemailer";

/**
 * Optional email. Configure with SMTP_* env vars to send real email; otherwise sendEmail is a
 * no-op that returns { sent: false }, and callers fall back to showing a link in the app.
 *
 * In test, set EMAIL_CAPTURE_FILE to a path to append JSON lines of every message instead of sending.
 */
let transporter: Transporter | null | undefined;

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST) || Boolean(process.env.EMAIL_CAPTURE_FILE);
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "CyberHELP Asia Trust <no-reply@cyberhelpasia.com>";
}

async function getTransport(): Promise<Transporter | null> {
  if (transporter !== undefined) return transporter;
  if (!process.env.SMTP_HOST) return (transporter = null);
  const nodemailer = await import("nodemailer");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true" || Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export type Mail = { to: string; subject: string; text: string };

export async function sendEmail(m: Mail): Promise<{ sent: boolean }> {
  // Test capture: write the message to a file instead of sending.
  if (process.env.EMAIL_CAPTURE_FILE) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.EMAIL_CAPTURE_FILE, JSON.stringify({ ...m, at: new Date().toISOString() }) + "\n");
    return { sent: true };
  }
  try {
    const t = await getTransport();
    if (!t) return { sent: false };
    await t.sendMail({ from: fromAddress(), to: m.to, subject: m.subject, text: m.text });
    return { sent: true };
  } catch (e) {
    console.error("email send failed", e);
    return { sent: false };
  }
}

export function inviteEmail(tenantName: string, role: string, link: string): { subject: string; text: string } {
  return {
    subject: `You've been invited to ${tenantName} on CyberHELP Asia Trust`,
    text: [
      `You've been invited to join ${tenantName} as ${role} on the CyberHELP Asia Trust Platform.`,
      "",
      `Accept the invitation (the link works once and expires in 7 days):`,
      link,
      "",
      "If you did not expect this, you can ignore this email.",
    ].join("\n"),
  };
}

export function resetEmail(link: string): { subject: string; text: string } {
  return {
    subject: "Reset your CyberHELP Asia Trust password",
    text: [
      "We received a request to reset your password.",
      "",
      "Set a new password with this link (it works once and expires in 1 hour):",
      link,
      "",
      "If you did not request this, you can ignore this email; your password is unchanged.",
    ].join("\n"),
  };
}
