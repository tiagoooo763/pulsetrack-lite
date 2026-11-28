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
        dashfy: {
          canvas: "#040914",
          inset: "#050b18",
          header: "#060e1f",
          sidebar: "#071022",
          card: "#0a1529",
          elevated: "#0f1e38",
          blue: "#1d74ff",
          blueHover: "#2a80ff",
          blueMid: "#3b8bff",
          blueLight: "#5ea1ff",
          sky: "#93c5fd",
        },
        obsidian: {
          950: "#040914",
          900: "#071022",
          850: "#0a1529",
          800: "#0f1e38",
          700: "#172a4a",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        display: [
          "var(--font-display)",
          "Plus Jakarta Sans",
          "var(--font-sans)",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "dashfy-card":
          "0 12px 32px -14px rgba(2, 6, 18, 0.78), inset 0 1px 0 rgba(147, 197, 253, 0.06)",
        "dashfy-blue": "0 10px 26px -8px rgba(29, 116, 255, 0.52)",
        "dashfy-glow": "0 0 0 1px rgba(59, 139, 255, 0.28), 0 14px 32px -12px rgba(29, 116, 255, 0.25)",
      },
      keyframes: {
        "shimmer-slide": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "shimmer-slide": "shimmer-slide 2.5s infinite",
        "fade-in-up": "fade-in-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "pulse-subtle": "pulse-subtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
