import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@school/ai": new URL("../ai/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "edge-runtime",
    // Convex-test uses an in-process isolate; serial files avoid fixture setup
    // contention and keep the contract suite deterministic.
    fileParallelism: false,
    env: {
      LEGACY_SUBJECT_TRUSTED_ISSUER: "https://legacy-auth.test",
    },
  },
});
