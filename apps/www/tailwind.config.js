/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./remotion/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        melo: {
          ink: "#0a0a0a",
          paper: "#fafaf8",
          stone: "#1c1917",
          ash: "#44403c",
          muted: "#78716c",
          gold: "#ca8a04",
          "gold-light": "#fef3c7",
          surface: "#ffffff",
          border: "#e7e5e4",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        serif: ["Instrument Serif", "Georgia", "serif"],
      },
      maxWidth: {
        content: "72rem",
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)",
        lift: "0 4px 24px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        glow: "0 0 48px rgba(202,138,4,0.15)",
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
