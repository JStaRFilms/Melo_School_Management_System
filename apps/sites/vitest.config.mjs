import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

const config = {
  root,
  resolve: { alias: { "@": path.resolve(root, "lib") } },
  test: { environment: "node", include: ["lib/**/__tests__/**/*.test.js"] },
};

export default config;
