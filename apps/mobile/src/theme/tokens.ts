import { useColorScheme } from "nativewind";

/**
 * Monochrome tokens for TypeScript consumers — native components, Skia
 * charts, navigator options — anywhere a Tailwind class can't reach.
 * Mirrors the CSS variables in src/global.css; change both together.
 *
 * There is deliberately no hue in this system: no gold, no red/green.
 * Price direction is conveyed by sign, arrow glyph and weight, never by
 * colour, so gains and losses read identically to colour-blind users and
 * in greyscale screenshots.
 */
export interface Palette {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  primary: string;
  secondary: string;
  muted: string;
  accent: string;
  onAccent: string;
}

const light: Palette = {
  bg: "#FFFFFF",
  surface: "#F7F7F7",
  elevated: "#EDEDED",
  border: "#D6D6D6",
  primary: "#000000",
  secondary: "#525252",
  muted: "#8A8A8A",
  accent: "#000000",
  onAccent: "#FFFFFF",
} as const;

const dark: Palette = {
  bg: "#000000",
  surface: "#0D0D0D",
  elevated: "#1A1A1A",
  border: "#2E2E2E",
  primary: "#FFFFFF",
  secondary: "#A3A3A3",
  muted: "#6E6E6E",
  accent: "#FFFFFF",
  onAccent: "#000000",
} as const;

export const palettes = { light, dark } as const;
export type ColorToken = keyof Palette;

/** Current palette, following the device appearance setting. */
export function useColors(): Palette {
  const { colorScheme } = useColorScheme();
  return colorScheme === "dark" ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radii = { sm: 8, md: 12, lg: 20, pill: 999 } as const;
