import type { Config } from "tailwindcss";

/**
 * NEYO Design Tokens
 * ------------------
 * The single source of visual truth. No raw hex anywhere else in the app.
 * Palette: navy (authority) + green (Kenyan growth) + warm white (calm).
 * EDIT POINTS:
 *  - Brand colors: edit the `navy`, `green`, `warm` scales below.
 *  - Corner radius: edit `borderRadius`.
 *  - Motion: edit `transitionTimingFunction.apple`.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  // The /brand style guide builds swatch classes from template literals
  // (e.g. `bg-navy-${shade}`), which Tailwind's scanner can't see. Safelist the
  // full brand scales so every swatch renders. (A.20)
  safelist: [
    {
      pattern: /^bg-(navy|green)-(50|100|200|300|400|500|600|700|800|900|950)$/,
    },
    {
      pattern: /^bg-warm-(50|100|200)$/,
    },
  ],
  theme: {
    extend: {
      colors: {
        // Brand navy — primary structure, text, headers
        navy: {
          50: "#f3f5f9",
          100: "#e4e9f1",
          200: "#c6d0e1",
          300: "#9aabc9",
          400: "#677fab",
          500: "#456090",
          600: "#344b76",
          700: "#2b3d60",
          800: "#263452",
          900: "#1c2740",
          950: "#121a2e",
        },
        // Brand green — Kenyan growth, success, primary CTAs
        green: {
          50: "#eefbf3",
          100: "#d6f5e1",
          200: "#b0e9c7",
          300: "#7dd6a6",
          400: "#46bd80",
          500: "#1f9d5f", // NEYO primary green
          600: "#137e4c",
          700: "#11643f",
          800: "#114f34",
          900: "#0f412d",
          950: "#07241a",
        },
        // Warm white — calm app background
        warm: {
          50: "#fdfcf9",
          100: "#faf8f2",
          200: "#f3efe4",
        },
        // Deliberate status colors (Linear-style pills)
        status: {
          present: "#1f9d5f",
          absent: "#dc2626",
          late: "#d97706",
          excused: "#2563eb",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.25rem",
      },
      boxShadow: {
        // Soft, brand-tinted shadows (not harsh black)
        card: "0 1px 2px rgba(28,39,64,0.04), 0 4px 16px rgba(28,39,64,0.06)",
        "card-hover": "0 2px 4px rgba(28,39,64,0.06), 0 8px 28px rgba(28,39,64,0.10)",
        pop: "0 8px 30px rgba(28,39,64,0.12)",
      },
      transitionTimingFunction: {
        apple: "cubic-bezier(0.32, 0.72, 0, 1)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
      spacing: {
        // 8-point grid helpers
        "4.5": "1.125rem",
        "18": "4.5rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
