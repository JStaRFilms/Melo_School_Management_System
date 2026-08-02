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

function getTrustedOrigins() {
  const configuredOrigins =
    process.env.TRUSTED_ORIGINS?.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const localOrigins =
    process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:3001", "http://localhost:3002", "http://localhost:3003"];

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
    advanced: {
      useSecureCookies: process.env.BETTER_AUTH_ALLOW_INSECURE_COOKIES !== "true",
    },
    trustedOrigins: getTrustedOrigins(),
    plugins: [
      convexPlugin({
        authConfig,
        jwks,
        jwt: {
          definePayload: ({ user, session }) => {
            const createdAt = session.createdAt.getTime();
            const payload = Object.fromEntries(Object.entries(user).filter(([key]) => key !== "id" && key !== "image" && key !== "auth_time"));
            return {
              ...payload,
              // Session creation represents authentication; token iat only represents a refresh.
              ...(Number.isFinite(createdAt) ? { auth_time: Math.floor(createdAt / 1_000) } : {}),
            };
          },
        },
        jwksRotateOnTokenGenerationError: !jwks,
      }),
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(ctx: GenericCtx<DataModel>) {
  return betterAuth(createAuthOptions(ctx));
}
