import { createAppAuthServer, hasConvexAuthEnv } from "@school/auth";

const authServer = hasConvexAuthEnv() ? createAppAuthServer() : null;

export const handler = authServer?.handler ?? {
  GET: async () => new Response("Convex auth is not configured.", { status: 503 }),
  POST: async () => new Response("Convex auth is not configured.", { status: 503 }),
};
