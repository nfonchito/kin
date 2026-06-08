import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#090907",
        surface: "#111110",
        "surface-2": "#1a1a18",
        "surface-3": "#232320",
        border: "#2a2a27",
        "border-2": "#333330",
        teal: {
          DEFAULT: "#15c489",
          dim: "#0fa070",
          muted: "rgba(21,196,137,0.12)",
          subtle: "rgba(21,196,137,0.06)",
        },
        text: {
          primary: "#f0efe8",
          secondary: "#9e9d94",
          muted: "#5a5a54",
        },
      },
      fontFamily: {
        sans: ["Figtree", "sans-serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)",
        glow: "0 0 24px rgba(21,196,137,0.15)",
        "glow-sm": "0 0 12px rgba(21,196,137,0.1)",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
