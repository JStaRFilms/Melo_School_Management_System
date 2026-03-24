"use client";

import type { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { isConvexConfigured } from "@/convex-runtime";

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

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    return <>{children}</>;
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
