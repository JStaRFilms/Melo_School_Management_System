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

  const auth = convexBetterAuthNextJs(convexEnv);

  // Forward auth requests with a concrete body instead of passing Next's
  // streaming Request through another Request constructor. This avoids
  // undici's "expected non-null body source" failure on sign-in POSTs.
  const forward = async (request: Request) => {
    const requestUrl = new URL(request.url);
    const siteUrl = new URL(convexEnv.convexSiteUrl);
    const targetUrl = new URL(`${requestUrl.pathname}${requestUrl.search}`, siteUrl);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    headers.delete("connection");
    headers.set("accept-encoding", "application/json");
    headers.set("host", siteUrl.host);
    const body = request.method === "GET" || request.method === "HEAD"
      ? undefined
      : Buffer.from(await request.arrayBuffer());

    return fetch(targetUrl, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      redirect: "manual",
    });
  };

  return {
    ...auth,
    handler: {
      GET: forward,
      POST: forward,
    },
  };
}
