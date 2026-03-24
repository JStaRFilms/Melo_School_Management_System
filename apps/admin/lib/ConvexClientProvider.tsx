"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { BetterAuthConvexProvider } from "@school/auth";
import { isConvexConfigured } from "@/convex-runtime";
import { authClient } from "@/auth-client";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set. Admin app will run in preview mode."
  );
}

const convexClient =
  convexUrl && isConvexConfigured()
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
