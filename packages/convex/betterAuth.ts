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

function getTrustedOrigins() {
  const configuredOrigins =
    process.env.TRUSTED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const localOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3001", "http://localhost:3002"];

  return Array.from(new Set([...configuredOrigins, ...localOrigins]));
}

export function createAuthOptions(ctx: GenericCtx<DataModel>) {
  return {
    appName: "School Management System",
    baseURL: process.env.CONVEX_SITE_URL ?? process.env.SITE_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    trustedOrigins: getTrustedOrigins(),
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
        },
        schoolId: {
          type: "string",
          required: false,
        },
      },
    },
    plugins: [convexPlugin({ authConfig })],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}
