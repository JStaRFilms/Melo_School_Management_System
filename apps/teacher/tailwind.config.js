/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/shared/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        surface: {
          50: "#ffffff",
          100: "#fcfcfd",
          200: "#f8fafc",
        },
        brand: {
          primary: "var(--school-primary, #0f172a)",
          "primary-contrast": "var(--school-primary-contrast, #ffffff)",
          "primary-surface": "var(--school-primary-surface, rgba(15, 23, 42, 0.06))",
          accent: "var(--school-accent, #2563eb)",
          "accent-contrast": "var(--school-accent-contrast, #ffffff)",
          "accent-surface": "var(--school-accent-surface, rgba(37, 99, 235, 0.1))",
          focus: "var(--school-focus-ring, rgba(37, 99, 235, 0.45))",
          progress: "var(--school-progress, #2563eb)",
        },
      },
      fontFamily: {
        heading: ["Outfit", "sans-serif"],
        display: ["Outfit", "sans-serif"],
        body: ["Instrument Sans", "sans-serif"],
      },
      borderRadius: {
        lg: "0.625rem",
        md: "0.375rem",
        sm: "0.25rem",
      },
    },
  },
  plugins: [],
};
