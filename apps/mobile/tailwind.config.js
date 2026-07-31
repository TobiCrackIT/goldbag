/** @type {import('tailwindcss').Config} */
// Monochrome only. Colours resolve from CSS variables defined in
// src/global.css, which flip between light and dark — so `bg-bg` and
// `text-primary` are correct in both modes without `dark:` variants.
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Tailwind's `gray` is cool-tinted and leaks into preflight
        // (::placeholder). `neutral` is a true grey — remap it so every
        // grey in the system is hueless.
        gray: require("tailwindcss/colors").neutral,
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        elevated: "rgb(var(--color-elevated) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        secondary: "rgb(var(--color-secondary) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "on-accent": "rgb(var(--color-on-accent) / <alpha-value>)",
      },
      fontSize: {
        display: ["40px", { lineHeight: "44px", fontWeight: "700" }],
        title: ["24px", { lineHeight: "30px", fontWeight: "600" }],
      },
      // Tailwind's preflight defaults the ring to blue; point it at our
      // monochrome vars instead. (Rings don't render on React Native —
      // this only matters for the web target and keeps the palette pure.)
      ringColor: { DEFAULT: "rgb(var(--color-primary))" },
      ringOffsetColor: { DEFAULT: "rgb(var(--color-bg))" },
      // Tailwind's default border/placeholder greys are cool-tinted
      // (#e5e7eb, #9ca3af). Ours are true neutrals.
      borderColor: { DEFAULT: "rgb(var(--color-border))" },
      placeholderColor: { DEFAULT: "rgb(var(--color-muted))" },
    },
  },
  plugins: [],
};
