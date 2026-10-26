import { useCallback, useEffect, useState } from "react";

export type ThemeId = "ashborn" | "ember" | "crimson" | "mint";
export const THEMES: Array<{ id: ThemeId; label: string; swatch: string; note: string }> = [
  { id: "ashborn", label: "Ashborn", swatch: "#a78bfa", note: "Shadow violet" },
  { id: "ember", label: "Ember", swatch: "#ff7a2f", note: "Warm fire" },
  { id: "crimson", label: "Crimson", swatch: "#ff5a7a", note: "Blood rose" },
  { id: "mint", label: "Mint", swatch: "#5eead4", note: "Cool focus" },
];
const KEY = "sl_m_theme";
const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);

export function storedTheme(): ThemeId {
  try { const v = localStorage.getItem(KEY); if (isTheme(v)) return v; } catch { /* storage blocked */ }
  return "ashborn";
}

/** Applies the theme to <html> while mounted; returns the current theme and a setter that persists. */
export function useMobileTheme() {
  const [theme, setThemeState] = useState<ThemeId>(storedTheme);
  useEffect(() => {
    document.documentElement.dataset.mTheme = theme;
    return () => { delete document.documentElement.dataset.mTheme; };
  }, [theme]);
  const setTheme = useCallback((t: ThemeId) => { setThemeState(t); try { localStorage.setItem(KEY, t); } catch { /* ignore */ } }, []);
  return { theme, setTheme };
}
