import { useEffect, useState } from "react";

/** Reactive CSS media query (SSR/test safe). */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** The mobile shell (bottom tab bar, single-column layout) kicks in at this width. */
export const MOBILE_QUERY = "(max-width: 820px)";
export const useIsMobile = () => useMediaQuery(MOBILE_QUERY);
