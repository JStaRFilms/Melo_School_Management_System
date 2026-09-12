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

async function sendVerificationEmail(email: string, verificationUrl: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MELO_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Email verification delivery is not configured. Set RESEND_API_KEY and MELO_EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Verify your guardian email", text: `Verify your email to continue your school application: ${verificationUrl}\n\nIf you did not create this account, ignore this message.` }),
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
      requireEmailVerification: true,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
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
