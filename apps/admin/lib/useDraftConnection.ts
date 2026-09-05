"use client";
import { useConvexAuth, useConvexConnectionState } from "convex/react";
import { useAuth } from "@/AuthProvider";
import type { DraftConnection } from "@school/shared/drafts";
/** Call only beneath the configured Convex provider. Browser online is not server connectivity. */
export function useDraftConnection(): DraftConnection {
  const connection = useConvexConnectionState();
  const auth = useConvexAuth();
  const { session } = useAuth();
  return { connected: connection.isWebSocketConnected, authenticated: auth.isAuthenticated && !auth.isLoading, accountId: session?.user.id ?? null };
}
