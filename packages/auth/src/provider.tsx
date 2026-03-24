"use client";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ReactNode } from "react";
import type { ConvexReactClient } from "convex/react";
import type { AppAuthClient } from "./client";

interface BetterAuthConvexProviderProps {
  children: ReactNode;
  client: ConvexReactClient;
  authClient: AppAuthClient;
  initialToken?: string | null;
}

export function BetterAuthConvexProvider({
  children,
  client,
  authClient,
  initialToken,
}: BetterAuthConvexProviderProps) {
  return (
    <ConvexBetterAuthProvider
      client={client}
      authClient={authClient}
      initialToken={initialToken}
    >
      {children}
    </ConvexBetterAuthProvider>
  );
}
