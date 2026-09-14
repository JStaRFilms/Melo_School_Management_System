import { createAppAuthClient } from "@school/auth";

export const authClient = createAppAuthClient(typeof window === "undefined" ? "http://localhost:3004" : window.location.origin);
