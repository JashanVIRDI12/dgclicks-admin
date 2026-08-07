import "server-only";

import { Resend } from "resend";

import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    throw new Error("Resend is not configured.");
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const safeName = escapeHtml(input.name || "there");
  const safeUrl = escapeHtml(input.resetUrl);

  const { error } = await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: input.to,
    subject: `Reset your ${siteConfig.name} password`,
    text: [
      `Hi ${input.name || "there"},`,
      "",
      `Use this link to reset your ${siteConfig.name} password:`,
      input.resetUrl,
      "",
      "This link expires in one hour. If you did not request it, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717;max-width:560px;margin:0 auto">
        <h1 style="font-size:22px">Reset your password</h1>
        <p>Hi ${safeName},</p>
        <p>Use the button below to reset your ${siteConfig.name} password.</p>
        <p style="margin:28px 0">
          <a href="${safeUrl}" style="background:#171717;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Reset password</a>
        </p>
        <p style="font-size:14px;color:#666">This link expires in one hour. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Resend could not send the password reset email: ${error.message}`);
  }
}
