"use client";

import { useMemo, type ReactNode } from "react";
import { ConvexReactClient } from "convex/react";
import { BetterAuthConvexProvider } from "@school/auth";
import { authClient } from "./auth-client";

export function ApplyProvider({ children, initialToken }: { children: ReactNode; initialToken?: string | null }) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  const client = useMemo(() => {
    if (!url) return null;
    try { const parsed = new URL(url); return parsed.protocol === "https:" || parsed.hostname === "localhost" ? new ConvexReactClient(url) : null; } catch { return null; }
  }, [url]);
  if (!client) return <main className="apply-shell"><section className="apply-card"><h1>Application service unavailable</h1><p>The application service is not configured for this environment.</p></section></main>;
  return <BetterAuthConvexProvider client={client} authClient={authClient} initialToken={initialToken}>{children}</BetterAuthConvexProvider>;
}
