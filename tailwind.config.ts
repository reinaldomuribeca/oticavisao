import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        gold: {
          DEFAULT: "#F5C542",
          50: "#FEF7DA",
          100: "#FDEFB6",
          200: "#FBE383",
          300: "#F8D561",
          400: "#F5C542",
          500: "#E5B22C",
          600: "#B88A1F",
          700: "#8A6517",
          800: "#5C430F",
          900: "#2E2207",
        },
        ink: {
          950: "#0a0a0a",
          900: "#111111",
          800: "#1a1a1a",
          700: "#262626",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
        shine: "shine 3s linear infinite",
        "slot-spin": "slot-spin 0.08s linear infinite",
      },
      keyframes: {
        "pulse-gold": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(245, 197, 66, 0.5)" },
          "50%": { boxShadow: "0 0 0 18px rgba(245, 197, 66, 0)" },
        },
        shine: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slot-spin": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(-100%)" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
