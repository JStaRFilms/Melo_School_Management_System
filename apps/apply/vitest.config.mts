import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "jsdom", setupFiles: ["./tests/setup.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "."), "@school/shared": path.resolve(__dirname, "../../packages/shared/src"), "@school/convex": path.resolve(__dirname, "../../packages/convex") } },
});
