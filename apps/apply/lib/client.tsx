"use client";

import { BetterAuthConvexProvider, createAppAuthClient, hasConvexAuthEnv } from "@school/auth";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;
export const authClient = createAppAuthClient(typeof window === "undefined" ? "http://localhost:3004" : window.location.origin);

export function ApplyClientProvider({ children }: { children: ReactNode }) {
  if (!client || !hasConvexAuthEnv()) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Application service unavailable</h1>
          <p className="muted">The application service is not configured for this environment.</p>
        </section>
      </main>
    );
  }
  return <BetterAuthConvexProvider client={client} authClient={authClient}>{children}</BetterAuthConvexProvider>;
}

export function functionRef(name: string): any {
  return name;
}
