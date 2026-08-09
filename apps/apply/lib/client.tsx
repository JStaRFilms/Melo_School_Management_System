"use client";

import { BetterAuthConvexProvider, createAppAuthClient } from "@school/auth";
import { ConvexReactClient } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;
export const authClient = createAppAuthClient(typeof window === "undefined" ? "http://localhost:3004" : window.location.origin);

import { MeloLoader } from "@school/shared";
export { MeloLoader };

export function ApplyClientProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Keep the server and the browser's first render identical. Next public
  // environment values are compiled for the browser and may not be present in
  // an already-running development server until it is restarted.
  if (!mounted) {
    return <main className="shell"><MeloLoader message="Loading the application service…" /></main>;
  }

  if (!client) {
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
