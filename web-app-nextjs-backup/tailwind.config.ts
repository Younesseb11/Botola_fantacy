import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          DEFAULT: "#0D1321",
          light: "#1A2235",
          dark: "#080c15",
          card: "#121A2B"
        },
        neon: {
          DEFAULT: "#4ADE80",
          bg: "rgba(74, 222, 128, 0.15)",
        }
      },
    },
  },
  plugins: [],
};
export default config;
