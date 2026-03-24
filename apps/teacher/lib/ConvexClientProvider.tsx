"use client";

import type { ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { BetterAuthConvexProvider } from "@school/auth";
import { convexUrl, isValidConvexUrl } from "@/lib/convex-runtime";
import { authClient } from "@/lib/auth-client";

if (!convexUrl) {
  console.warn(
    "NEXT_PUBLIC_CONVEX_URL is not set. Convex features will not work."
  );
} else if (!isValidConvexUrl(convexUrl)) {
  console.error(
    "NEXT_PUBLIC_CONVEX_URL is not a valid Convex URL. Expected format: https://your-project.convex.cloud"
  );
}

const convex = convexUrl && isValidConvexUrl(convexUrl)
  ? new ConvexReactClient(convexUrl)
  : (null as unknown as ConvexReactClient);

export function ConvexClientProvider({
  children,
  initialToken,
}: {
  children: ReactNode;
  initialToken?: string | null;
}) {
  if (!convexUrl || !isValidConvexUrl(convexUrl)) {
    return <>{children}</>;
  }

  return (
    <BetterAuthConvexProvider
      client={convex}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </BetterAuthConvexProvider>
  );
}
