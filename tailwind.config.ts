import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // Sunset: soft pastel-yellow paper, warm brown ink, a sunset-orange accent.
      // Backgrounds stay low-contrast and close together; the accent carries
      // the emphasis. Two accent tones because one has to stay legible as
      // small text while the other is only ever decorative.
      colors: {
        bg: "#fdf6e8",          // pastel warm yellow
        surface: "#fffbf2",     // cards, a touch lighter than the page
        "surface-2": "#f8efdc",
        "surface-3": "#f1e5cc",
        border: "#ebdec3",      // soft — deliberately low contrast
        "border-2": "#dcc9a4",
        accent: {
          // Deep sunset, reserved for small text, icons and rules where the
          // colour has to stay legible against paper.
          DEFAULT: "#c2610c",
          dim: "#a04f08",
          // Pastel sunset for the large saturated areas — buttons, bubbles,
          // the logo tile. These carry dark ink rather than cream, which is
          // what lets the fill stay this soft.
          soft: "#f6bd7c",
          "soft-dim": "#efad63",
          sun: "#f7cb98",       // decorative only — glows and washes
          muted: "rgba(194,97,12,0.09)",
          subtle: "rgba(194,97,12,0.045)",
        },
        text: {
          primary: "#4a3a24",   // warm brown ink
          secondary: "#7c6b4e",
          muted: "#8f7d5e",
        },
      },
      fontFamily: {
        sans: ["Figtree", "sans-serif"],
        display: ["'Instrument Serif'", "Georgia", "serif"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
        "3xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(74,58,36,0.05), 0 1px 3px rgba(74,58,36,0.04)",
        glow: "0 0 24px rgba(240,169,60,0.22)",
        "glow-sm": "0 0 12px rgba(240,169,60,0.16)",
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
