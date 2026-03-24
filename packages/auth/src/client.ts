import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { AuthClient as ConvexBetterAuthClient } from "@convex-dev/better-auth/react";
import { createAuthClient } from "better-auth/react";

/**
 * Create an auth client for a specific app.
 *
 * @param baseUrl - The base URL of the app (e.g., "http://localhost:3002" for admin)
 */
export type AppAuthClient = ConvexBetterAuthClient;

export function createAppAuthClient(baseUrl?: string): AppAuthClient {
  return createAuthClient({
    baseURL: `${baseUrl ?? ""}/api/auth`,
    plugins: [convexClient()],
  });
}

/**
 * Auth client types for type safety.
 */
export type AuthClient = AppAuthClient;

/**
 * Session type for authenticated users.
 */
export interface AuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
    schoolId?: string;
    image?: string | null;
  };
  session: {
    id: string;
    userId?: string | null;
    expiresAt: Date | string;
  };
}
