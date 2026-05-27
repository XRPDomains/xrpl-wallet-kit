import type { WalletUiTheme } from "./types";

export type ResolvedTheme = Required<WalletUiTheme>;
export const lightTheme: ResolvedTheme = {
  accent: "#0078ae",
  background: "#ffffff",
  foreground: "#111827",
  muted: "#64748b",
  border: "#e5e7eb",
  overlay: "rgba(15,23,42,.46)",
  surface: "#f8fafc",
  surfaceHover: "#f1f5f9",
  shadow: "0 8px 40px rgba(15,23,42,.12), 0 0 0 1px rgba(15,23,42,.04)",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: "Inter, system-ui, sans-serif"
};

export const darkTheme: ResolvedTheme = {
  accent: "#4aa3ff",
  background: "#111827",
  foreground: "#f8fafc",
  muted: "#94a3b8",
  border: "#334155",
  overlay: "rgba(2,6,23,.72)",
  surface: "#1f2937",
  surfaceHover: "#263244",
  shadow: "none",
  radius: "14px",
  walletRadius: "10px",
  fontFamily: "Inter, system-ui, sans-serif"
};

export const defaultFontFamily = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const walletUiThemes = {
  light: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...lightTheme, ...overrides }),
  dark: (overrides: WalletUiTheme = {}): WalletUiTheme => ({ ...darkTheme, ...overrides }),
  xrpl: (overrides: WalletUiTheme = {}): WalletUiTheme => ({
    ...lightTheme,
    accent: "#0078ae",
    radius: "12px",
    walletRadius: "10px",
    ...overrides
  }),
  minimal: (overrides: WalletUiTheme = {}): WalletUiTheme => ({
    ...lightTheme,
    background: "#ffffff",
    surface: "#ffffff",
    border: "#d7dee8",
    radius: "8px",
    walletRadius: "8px",
    shadow: "none",
    ...overrides
  })
};

