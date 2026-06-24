import type { WalletUiTheme, WalletUiThemeMode, WalletUiThemeName } from "./types";

export type ResolvedTheme = Required<WalletUiTheme>;

export const defaultFontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const lightTheme: ResolvedTheme = {
  accent: "#0078ae",
  accentText: "#ffffff",
  background: "#ffffff",
  foreground: "#111827",
  error: "#b45309",
  success: "#059669",
  muted: "#64748b",
  border: "#e5e7eb",
  overlay: "rgba(15,23,42,.46)",
  overlayBlur: 0,
  surface: "#f8fafc",
  surfaceHover: "#f1f5f9",
  fallbackIconBackground: "rgba(15,23,42,.06)",
  fallbackIconColor: "#111827",
  shadow: "0 8px 40px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04)",
  radius: "14px",
  walletRadius: "10px",
  spinnerTrail: "rgba(0,0,0,.08)",
  headerBackground: "#ffffff",
  fontFamily: defaultFontFamily
};

export const darkTheme: ResolvedTheme = {
  accent: "#4aa3ff",
  accentText: "#ffffff",
  background: "#111827",
  foreground: "#f8fafc",
  error: "#fbbf24",
  success: "#34d399",
  muted: "#94a3b8",
  border: "#334155",
  overlay: "rgba(2,6,23,.72)",
  overlayBlur: 0,
  surface: "#1f2937",
  surfaceHover: "#263244",
  fallbackIconBackground: "rgba(255,255,255,.10)",
  fallbackIconColor: "#f8fafc",
  shadow: "none",
  radius: "14px",
  walletRadius: "10px",
  spinnerTrail: "rgba(255,255,255,.08)",
  headerBackground: "#111827",
  fontFamily: defaultFontFamily
};

export const xrplTheme: ResolvedTheme = {
  ...lightTheme,
  accent: "#0078ae",
  accentText: "#ffffff",
  radius: "12px",
  walletRadius: "10px"
};

export const minimalTheme: ResolvedTheme = {
  ...lightTheme,
  background: "#ffffff",
  headerBackground: "#ffffff",
  surface: "#ffffff",
  border: "#d7dee8",
  radius: "8px",
  walletRadius: "8px",
  shadow: "none"
};

export const midnightTheme: ResolvedTheme = {
  accent: "#3b82f6",
  accentText: "#ffffff",
  background: "#0f1629",
  foreground: "#e2e8f0",
  error: "#f87171",
  success: "#34d399",
  muted: "#64748b",
  border: "#1e2d4a",
  overlay: "rgba(2,6,23,.80)",
  overlayBlur: 12,
  surface: "#1a2540",
  surfaceHover: "#1e2d4a",
  fallbackIconBackground: "rgba(255,255,255,.10)",
  fallbackIconColor: "#e2e8f0",
  shadow: "0 8px 40px rgba(0,0,0,.40)",
  radius: "16px",
  walletRadius: "12px",
  spinnerTrail: "rgba(255,255,255,.08)",
  headerBackground: "#0f1629",
  fontFamily: defaultFontFamily
};

export const glassTheme: ResolvedTheme = {
  accent: "#6366f1",
  accentText: "#ffffff",
  background: "rgba(255,255,255,.72)",
  foreground: "#1e293b",
  error: "#ef4444",
  success: "#10b981",
  muted: "#64748b",
  border: "rgba(255,255,255,.50)",
  overlay: "rgba(15,23,42,.30)",
  overlayBlur: 20,
  surface: "rgba(255,255,255,.52)",
  surfaceHover: "rgba(255,255,255,.66)",
  fallbackIconBackground: "rgba(99,102,241,.15)",
  fallbackIconColor: "#6366f1",
  shadow: "0 8px 40px rgba(99,102,241,.15), 0 0 0 1px rgba(255,255,255,.30)",
  radius: "20px",
  walletRadius: "14px",
  spinnerTrail: "rgba(99,102,241,.15)",
  headerBackground: "rgba(255,255,255,.44)",
  fontFamily: defaultFontFamily
};

export const roundedTheme: ResolvedTheme = {
  ...lightTheme,
  accent: "#7c3aed",
  accentText: "#ffffff",
  success: "#059669",
  border: "#f3e8ff",
  surface: "#faf5ff",
  surfaceHover: "#f5f0ff",
  shadow: "0 12px 48px rgba(124,58,237,.14), 0 0 0 1px rgba(124,58,237,.08)",
  radius: "24px",
  walletRadius: "16px"
};

export const crispTheme: ResolvedTheme = {
  ...lightTheme,
  accent: "#111827",
  accentText: "#ffffff",
  success: "#16a34a",
  border: "#111827",
  surface: "#f9fafb",
  surfaceHover: "#f3f4f6",
  shadow: "none",
  radius: "4px",
  walletRadius: "4px",
  fontFamily: "'DM Mono', 'Courier New', monospace"
};

export const softTheme: ResolvedTheme = {
  ...lightTheme,
  accent: "#7c3aed",
  accentText: "#ffffff",
  success: "#059669",
  background: "#faf5ff",
  headerBackground: "#faf5ff",
  border: "#e9d5ff",
  surface: "#f3e8ff",
  surfaceHover: "#ede9fe",
  shadow: "0 4px 24px rgba(124,58,237,.08)",
  radius: "16px",
  walletRadius: "12px"
};

export const PRESET_THEMES: Record<string, ResolvedTheme> = {
  default: lightTheme,
  light: lightTheme,
  dark: darkTheme,
  xrpl: xrplTheme,
  minimal: minimalTheme,
  midnight: midnightTheme,
  glass: glassTheme,
  rounded: roundedTheme,
  crisp: crispTheme,
  soft: softTheme
};

export function resolveWalletTheme(options: {
  mode?: WalletUiThemeMode;
  themeName?: WalletUiThemeName;
  theme?: WalletUiTheme;
  customTheme?: WalletUiTheme;
} = {}): ResolvedTheme {
  const mode = options.mode ?? "light";
  const baseByMode = mode === "dark" ? darkTheme : lightTheme;
  const preset = options.themeName ? PRESET_THEMES[options.themeName] : undefined;
  return {
    ...(preset ?? baseByMode),
    ...(options.theme ?? {}),
    ...(options.customTheme ?? {})
  };
}

export const walletUiThemes = {
  light: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...lightTheme, ...overrides }),
  dark: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...darkTheme, ...overrides }),
  xrpl: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...xrplTheme, ...overrides }),
  minimal: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...minimalTheme, ...overrides }),
  midnight: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...midnightTheme, ...overrides }),
  glass: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...glassTheme, ...overrides }),
  rounded: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...roundedTheme, ...overrides }),
  crisp: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...crispTheme, ...overrides }),
  soft: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...softTheme, ...overrides })
};
