import { createContext, useContext } from "react";
import type { ThemeId } from "../../lib/theme";

/** Lets the Me screen change the theme owned by the shell. */
export const ThemeCtx = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>({ theme: "ashborn", setTheme: () => undefined });
export const useThemeState = () => useContext(ThemeCtx);
