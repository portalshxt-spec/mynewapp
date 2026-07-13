import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        panel: "#131313",
        edge: "#262626",
        gold: "#C9A961",
        "gold-dim": "#8f7743",
        cyan: "#3DE8E8",
        onair: "#FF3B47",
      },
      fontFamily: {
        display: ["var(--font-display)", "Impact", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "neon-cyan": "0 0 6px rgba(61,232,232,0.6), 0 0 18px rgba(61,232,232,0.25)",
        "neon-gold": "0 0 6px rgba(201,169,97,0.6), 0 0 18px rgba(201,169,97,0.25)",
        "neon-red": "0 0 6px rgba(255,59,71,0.7), 0 0 20px rgba(255,59,71,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
