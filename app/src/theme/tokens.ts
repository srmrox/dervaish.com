// Dervaish design tokens (master plan §14). Calm, dark, low-glare default.
// Semantic — never hard-code colors in components; reference these.

export const colors = {
  bg: "#0e1113",
  nav: "#12161a",
  surface: "#171c21",
  surface2: "#1d242b",
  surface3: "#252e36",
  line: "#2c353d",
  text: "#eef2f4",
  muted: "#a7b1ba",
  soft: "#7b8893",
  green: "#3fae6b", // primary / play
  greenSoft: "#1d3a2a",
  gold: "#d6a64a", // archive / provenance
  blue: "#5aa6e8", // info / links
  danger: "#e2574c",
  warning: "#d8a23b",
  success: "#3fae6b",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { control: 8, panel: 12, pill: 999 } as const;

export const font = {
  display: 28,
  title: 20,
  body: 15,
  small: 13,
  tiny: 11,
} as const;
