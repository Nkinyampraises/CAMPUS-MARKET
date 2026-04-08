import "./runtime.js";
import nodemailer from "nodemailer";

const SMTP_HOST = (Deno.env.get("SMTP_HOST") || "").trim();
const SMTP_PORT = Number.parseInt((Deno.env.get("SMTP_PORT") || "").trim(), 10) || 587;
const SMTP_SECURE = /^(1|true|yes|on)$/i.test((Deno.env.get("SMTP_SECURE") || "").trim());
const SMTP_USER = (Deno.env.get("SMTP_USER") || "").trim();
const SMTP_PASS = (Deno.env.get("SMTP_PASS") || "").trim();
const SMTP_FROM = (Deno.env.get("SMTP_FROM") || "").trim();
const APP_NAME = (Deno.env.get("APP_NAME") || "Campus Market").trim();

export const isEmailDeliveryConfigured = Boolean(
  SMTP_HOST &&
  SMTP_PORT > 0 &&
  SMTP_FROM &&
  (!SMTP_USER || SMTP_PASS),
);

let transporter: any = null;

function getTransporter() {
  if (!isEmailDeliveryConfigured) {
    throw new Error("Email delivery is not configured");
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      ...(SMTP_USER
        ? {
            auth: {
              user: SMTP_USER,
              pass: SMTP_PASS,
            },
          }
        : {}),
    });
  }

  return transporter;
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  if (!isEmailDeliveryConfigured) {
    return { sent: false, skipped: true };
  }

  await getTransporter().sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  return { sent: true };
}

export async function sendAccountConfirmationEmail(email: string, confirmationLink: string) {
  const subject = `Confirm your ${APP_NAME} account`;
  const text = [
    `Welcome to ${APP_NAME}.`,
    "",
    "Please confirm your email address by opening this link:",
    confirmationLink,
    "",
    "If you did not create this account, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>Welcome to <strong>${APP_NAME}</strong>.</p>
    <p>Please confirm your email address by opening this link:</p>
    <p><a href="${confirmationLink}">${confirmationLink}</a></p>
    <p>If you did not create this account, you can ignore this email.</p>
  `;

  return await sendEmail(email, subject, text, html);
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const subject = `${APP_NAME} password reset`;
  const text = [
    `We received a request to reset your ${APP_NAME} password.`,
    "",
    "Open this link to choose a new password:",
    resetLink,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <p>We received a request to reset your <strong>${APP_NAME}</strong> password.</p>
    <p>Open this link to choose a new password:</p>
    <p><a href="${resetLink}">${resetLink}</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return await sendEmail(email, subject, text, html);
}
