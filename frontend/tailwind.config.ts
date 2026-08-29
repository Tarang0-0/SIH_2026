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
        rail: {
          dark: "#080e1a",
          card: "rgba(15, 23, 42, 0.75)",
          border: "rgba(255, 255, 255, 0.1)",
          primary: "#38bdf8",
          accent: "#f59e0b",
          success: "#10b981",
          warning: "#f59e0b",
          danger: "#ef4444",
          subtle: "#94a3b8"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
};
export default config;
