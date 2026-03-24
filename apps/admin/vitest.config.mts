import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./__tests__/setup.ts"],
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@/exam-helpers": path.resolve(__dirname, "lib/exam-helpers.ts"),
      "@/types": path.resolve(__dirname, "lib/types.ts"),
      "@/mock-data": path.resolve(__dirname, "lib/mock-data.ts"),
      "@/convex-runtime": path.resolve(__dirname, "lib/convex-runtime.ts"),
      "@school/shared": path.resolve(__dirname, "../../packages/shared/src"),
      "@school/convex": path.resolve(__dirname, "../../packages/convex"),
    },
  },
});
