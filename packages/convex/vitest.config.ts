import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@school/ai": new URL("../ai/src/index.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "edge-runtime",
  },
});
