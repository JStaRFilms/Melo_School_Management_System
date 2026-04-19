import globals from "globals";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tsParser from "@typescript-eslint/parser";

const nextAppConfigs = [...nextCoreWebVitals, ...nextTypescript].map((config) => ({
  ...config,
  files:
    config.name === "next/typescript"
      ? ["apps/**/*.ts", "apps/**/*.tsx"]
      : ["apps/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
}));

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/dist/**",
      "**/coverage/**",
      "**/build/**",
      "**/out/**",
      "**/*.tsbuildinfo",
      "packages/convex/_generated/**",
      "apps/admin/convex/**",
      "apps/teacher/convex/**",
      "**/next-env.d.ts",
    ],
  },
  ...nextAppConfigs,
  {
    files: ["apps/**/*.{js,jsx,mjs,ts,tsx,mts,cts}", "packages/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["packages/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["*.{js,mjs,cjs}", "scripts/**/*.{js,mjs,cjs}", "e2e/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
