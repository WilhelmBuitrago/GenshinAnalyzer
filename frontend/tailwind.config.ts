import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/services/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#0F0F13",
        surface: "#1A1A23",
        primary: "#7C3AED",
        primaryHover: "#9333EA",
        text: "#E5E7EB",
        muted: "#9CA3AF"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.35)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.04)"
      },
      borderRadius: {
        subtle: "14px"
      },
      fontFamily: {
        sans: ["'InterVariable'", "'Inter'", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
