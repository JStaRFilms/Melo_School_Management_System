"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { BetterAuthConvexProvider } from "@school/auth";
import { isConvexConfigured, isValidConvexUrl } from "@/convex-runtime";
import { authClient } from "@/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set. Platform app will run in preview mode."
  );
} else if (!isValidConvexUrl(convexUrl)) {
  console.error(
    "NEXT_PUBLIC_CONVEX_URL is not a valid Convex URL. Expected format: https://your-project.convex.cloud"
  );
}

const convexClient =
  convexUrl && isConvexConfigured() && isValidConvexUrl(convexUrl)
    ? new ConvexReactClient(convexUrl)
    : null;

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  if (!convexClient) {
    return <>{children}</>;
  }

  return (
    <BetterAuthConvexProvider
      client={convexClient}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </BetterAuthConvexProvider>
  );
}
