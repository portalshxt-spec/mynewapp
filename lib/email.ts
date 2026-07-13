import { Resend } from "resend";
import { env, optionalEnv, siteUrl } from "./env";

function resend(): Resend {
  return new Resend(env("RESEND_API_KEY"));
}

export function isEmailConfigured(): boolean {
  return Boolean(optionalEnv("RESEND_API_KEY"));
}

function shell(inner: string): string {
  return `
  <div style="background:#0A0A0A;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:520px;margin:0 auto;background:#131313;border:1px solid #262626;border-radius:8px;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:28px;font-weight:bold;letter-spacing:2px;color:#C9A961;">BLakHarts</div>
        <div style="font-size:12px;color:#3DE8E8;letter-spacing:1px;margin-top:4px;">ALL FREQUENCIES. ONE SIGNAL.</div>
      </div>
      ${inner}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #262626;text-align:center;font-size:12px;color:#666;">
        BLakHarts. Stay Human.
      </div>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<div style="text-align:center;margin:24px 0;">
    <a href="${href}" style="display:inline-block;background:#C9A961;color:#0A0A0A;font-weight:bold;text-decoration:none;padding:14px 32px;border-radius:4px;letter-spacing:1px;">${label}</a>
  </div>
  <p style="color:#888;font-size:12px;text-align:center;">This link works once and expires in 24 hours.</p>`;
}

export async function sendAccessLink(email: string, token: string): Promise<void> {
  const link = `${siteUrl()}/api/auth/verify?token=${token}`;
  await resend().emails.send({
    from: env("EMAIL_FROM"),
    to: email,
    subject: "Your BLakHarts access link",
    html: shell(`
      <p style="color:#ddd;font-size:15px;line-height:1.6;">You're tuned in. Tap below to re-enter the broadcast — your music, downloads, and film are waiting.</p>
      ${button(link, "ENTER THE SIGNAL")}
    `),
  });
}

export async function sendPurchaseEmail(
  email: string,
  token: string,
  releaseTitle: string,
  tier: string
): Promise<void> {
  const link = `${siteUrl()}/api/auth/verify?token=${token}`;
  await resend().emails.send({
    from: env("EMAIL_FROM"),
    to: email,
    subject: `You're in — ${releaseTitle}`,
    html: shell(`
      <p style="color:#ddd;font-size:15px;line-height:1.6;">Welcome to the broadcast. Your <strong style="color:#C9A961;">${tier.toUpperCase()}</strong> access to <strong style="color:#C9A961;">${releaseTitle}</strong> is live.</p>
      <p style="color:#ddd;font-size:15px;line-height:1.6;">Tap below to open THE RADIO and start listening.</p>
      ${button(link, "ENTER THE SIGNAL")}
      <p style="color:#888;font-size:13px;line-height:1.6;">Need back in later? Go to the site's <a href="${siteUrl()}/access" style="color:#3DE8E8;">ACCESS</a> page and enter this email — we'll send a fresh link. No passwords, ever.</p>
    `),
  });
}

export async function sendAdminLink(email: string, token: string): Promise<void> {
  const link = `${siteUrl()}/api/auth/verify?token=${token}`;
  await resend().emails.send({
    from: env("EMAIL_FROM"),
    to: email,
    subject: "BLakHarts admin sign-in",
    html: shell(`
      <p style="color:#ddd;font-size:15px;line-height:1.6;">Admin sign-in requested. Tap below to open the control room.</p>
      ${button(link, "OPEN ADMIN")}
    `),
  });
}
