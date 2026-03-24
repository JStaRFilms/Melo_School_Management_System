"use client";

import { createAppAuthClient } from "@school/auth";

export const authClient = createAppAuthClient(
  typeof window !== "undefined" ? window.location.origin : "http://localhost:3002"
);
