import type { Config } from "tailwindcss";

// Neutral light theme. No Algoworks logo was supplied, so the accent is a plain
// accessible blue; "algo" and "cust" are the two organisation series colours.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#1d4ed8", soft: "#eff6ff" },
        algo: "#2a78d6",
        cust: "#eb6834",
      },
    },
  },
  plugins: [],
};
export default config;
