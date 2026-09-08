/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./lib/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
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
        sans: ["Plus Jakarta Sans", "sans-serif"],
        display: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        soft: "0 22px 60px -30px rgba(15, 23, 42, 0.35)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
