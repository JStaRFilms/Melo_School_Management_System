// Auth Package - Better Auth + Convex Integration for School Management System

export { createAppAuthClient } from "./client";
export type { AppAuthClient, AuthClient, AuthSession } from "./client";

export { getConvexAuthEnv, hasConvexAuthEnv } from "./config";
export type { ConvexAuthEnv } from "./config";

export { createAppAuthServer } from "./server";

export { BetterAuthConvexProvider } from "./provider";
