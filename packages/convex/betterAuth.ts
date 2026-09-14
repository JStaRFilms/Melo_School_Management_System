import { createClient } from "@convex-dev/better-auth";
import { convex as convexPlugin } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(components.betterAuth, {
  verbose: false,
});

function getStaticJwks() {
  const jwks = process.env.JWKS?.trim();
  return jwks && jwks.length > 0 ? jwks : undefined;
}

function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function verificationEmailHtml(verificationUrl: string) {
  const safeUrl = escapeEmailHtml(verificationUrl);
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Verify your Melo email</title>
  </head>
  <body style="margin:0;background:#f5f1e8;color:#29251f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Confirm your email address to continue your school application.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f1e8;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #ded6c8;border-radius:18px;overflow:hidden;background:#fffdf8;">
          <tr><td style="padding:20px 26px;background:#29251f;color:#fffdf8;"><span style="font-family:Georgia,serif;font-size:25px;font-weight:700;">Melo</span><span style="float:right;padding-top:8px;color:#d8b15c;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">School applications</span></td></tr>
          <tr><td style="padding:36px 28px 30px;">
            <p style="margin:0 0 10px;color:#b07b18;font-size:11px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;">Email verification</p>
            <h1 style="margin:0 0 16px;color:#29251f;font-family:Georgia,serif;font-size:32px;line-height:1.15;">Verify your email</h1>
            <p style="margin:0 0 26px;color:#675f54;font-size:15px;line-height:1.7;">Confirm this email address to continue your school application and keep your application records secure.</p>
            <a href="${safeUrl}" style="display:inline-block;border-radius:10px;background:#29251f;color:#fffdf8;padding:14px 22px;text-decoration:none;font-size:14px;font-weight:700;">Verify email</a>
            <p style="margin:26px 0 0;color:#82796d;font-size:12px;line-height:1.7;">If the button does not work, copy this link:<br /><span style="word-break:break-all;color:#29251f;">${safeUrl}</span></p>
          </td></tr>
          <tr><td style="padding:20px 28px;border-top:1px solid #ebe4d8;color:#82796d;font-size:12px;line-height:1.6;">If you did not create a Melo account, you can ignore this email.<br />Melo by J StaR Films Studios</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

async function sendVerificationEmail(email: string, verificationUrl: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MELO_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Email verification delivery is not configured. Set RESEND_API_KEY and MELO_EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Verify your Melo email", html: verificationEmailHtml(verificationUrl), text: `Verify your email for your Melo account: ${verificationUrl}\n\nIf you did not create this account, ignore this message.` }),
  });
  if (!response.ok) throw new Error(`Email verification delivery failed (${response.status}).`);
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || typeof Reflect.get(result, "id") !== "string") throw new Error("Email verification provider did not confirm delivery.");
}

function getTrustedOrigins() {
  const configuredOrigins =
    process.env.TRUSTED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const localOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : [
          "http://localhost:3000",
          "http://localhost:3001",
          "http://localhost:3002",
          "http://localhost:3003",
          "http://localhost:3004",
          "http://localhost:3005",
          "http://localhost:3006",
        ];

  return Array.from(new Set([...configuredOrigins, ...localOrigins]));
}

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  const jwks = getStaticJwks();

  return {
    appName: "School Management System",
    baseURL: process.env.CONVEX_SITE_URL ?? process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => sendVerificationEmail(user.email, url),
    },
    trustedOrigins: getTrustedOrigins(),
    plugins: [
      convexPlugin({
        authConfig,
        jwks,
        jwksRotateOnTokenGenerationError: !jwks,
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}
