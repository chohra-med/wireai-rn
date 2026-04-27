/**
 * WireAI Design Tokens — React Native
 *
 * Aligned with the WireAI website design system (getwireai.com).
 * Uses the violet + ink palette for brand consistency across web and mobile.
 */

// ─── Violet palette ─────────────────────────────────────────────────────────
export const violet = {
  50: "#F5F2FF",
  100: "#EDE8FF",
  200: "#D8CFFE",
  300: "#B9A3F8",
  400: "#9B80F5",
  500: "#7A5AED",
  600: "#5E42C8",
  700: "#4A31A0",
  800: "#352278",
  900: "#221550",
  950: "#110A2A",
} as const;

// ─── Ink palette (neutral grays) ────────────────────────────────────────────
export const ink = {
  50: "#F4F5F7",
  100: "#E4E7EC",
  200: "#C4CAD3",
  300: "#98A1AE",
  400: "#6B7484",
  500: "#4A5260",
  600: "#353B47",
  700: "#232830",
  800: "#15181F",
  900: "#0B0D12",
  950: "#050609",
} as const;

// ─── Semantic colors (light mode — SDK default) ─────────────────────────────
export const colors = {
  // Backgrounds
  background: "#FFFFFF",
  backgroundSecondary: ink[50],
  backgroundElevated: ink[50],

  // Brand / accent
  primary: violet[500],
  primaryBackground: `${violet[500]}1A`, // 10% opacity
  primaryHover: violet[600],

  // Semantic
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  // Borders
  border: ink[200],
  borderStrong: ink[300],

  // Text
  text: ink[900],
  textSecondary: ink[500],
  textTertiary: ink[400],
  textInverse: "#FFFFFF",

  // States
  disabled: ink[100],
} as const;

// ─── Dark mode colors ───────────────────────────────────────────────────────
export const darkColors = {
  background: ink[900],
  backgroundSecondary: ink[800],
  backgroundElevated: ink[700],

  primary: violet[500],
  primaryBackground: `${violet[500]}33`, // 20% opacity
  primaryHover: violet[400],

  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  border: ink[700],
  borderStrong: ink[600],

  text: ink[50],
  textSecondary: ink[300],
  textTertiary: ink[400],
  textInverse: "#FFFFFF",

  disabled: ink[700],
} as const;

// ─── Spacing ────────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// ─── Border radii ───────────────────────────────────────────────────────────
export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 24,
  full: 9999,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────
export const textStyles = {
  h1: { fontSize: 36, fontWeight: "700" as const, lineHeight: 44, letterSpacing: -0.03 * 36 },
  h2: { fontSize: 28, fontWeight: "700" as const, lineHeight: 36, letterSpacing: -0.02 * 28 },
  h3: { fontSize: 22, fontWeight: "600" as const, lineHeight: 30, letterSpacing: -0.01 * 22 },
  h4: { fontSize: 18, fontWeight: "600" as const, lineHeight: 26 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySmall: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  code: { fontSize: 13, lineHeight: 20 },
} as const;

// ─── Sizing helpers ─────────────────────────────────────────────────────────
export const iconSizes = {
  6: 16,   // selection indicator dot
  10: 24,  // step circle
  22: 44,  // touch target (HIG minimum)
} as const;

export const widths = {
  6: 80,   // stepper value min-width
} as const;
