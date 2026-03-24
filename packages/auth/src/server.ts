import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { getConvexAuthEnv } from "./config";

export interface AppAuthServer {
  getToken: () => Promise<string | undefined>;
  handler: {
    GET: (request: Request) => Promise<Response>;
    POST: (request: Request) => Promise<Response>;
  };
  isAuthenticated: () => Promise<boolean>;
}

export function createAppAuthServer(
  env: NodeJS.ProcessEnv = process.env
): AppAuthServer {
  const convexEnv = getConvexAuthEnv(env);

  if (!convexEnv) {
    throw new Error(
      "Convex auth env is not configured. Set NEXT_PUBLIC_CONVEX_URL first."
    );
  }

  return convexBetterAuthNextJs(convexEnv);
}
