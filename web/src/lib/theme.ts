import { useCallback, useEffect, useState } from "react";
import { RANKS } from "./levelEngine";

/**
 * Monarch auras: the mobile colour palettes, each named after a faction from the lore and unlocked
 * by rank (a cosmetic reward for progression — the server's rank is the source of truth).
 */
export type AuraId = "shadow" | "system" | "frost" | "whiteflame" | "beast" | "destruction";

export const AURAS: Array<{ id: AuraId; name: string; lore: string; rank: (typeof RANKS)[number]; swatch: [string, string] }> = [
  { id: "shadow", name: "Shadow Monarch", lore: "Arise. The army answers.", rank: "E", swatch: ["#a78bfa", "#15121f"] },
  { id: "system", name: "The System", lore: "The status window never lies.", rank: "D", swatch: ["#4fb3ff", "#0f1622"] },
  { id: "frost", name: "Frost Monarch", lore: "Still as ice, sharp as winter.", rank: "C", swatch: ["#9be3ff", "#101820"] },
  { id: "whiteflame", name: "Monarch of White Flames", lore: "A fire that burns white-hot.", rank: "B", swatch: ["#ffd9a0", "#191510"] },
  { id: "beast", name: "Beast Monarch", lore: "Instinct, fang and fury.", rank: "A", swatch: ["#ff5a5a", "#1a1010"] },
  { id: "destruction", name: "Monarch of Destruction", lore: "The dragon's wrath.", rank: "S", swatch: ["#ff6a2b", "#1c110c"] },
];

const rankIndex = (r: string) => Math.max(0, (RANKS as readonly string[]).indexOf(r));
export const isUnlocked = (aura: (typeof AURAS)[number], playerRank: string) => rankIndex(playerRank) >= rankIndex(aura.rank);
const isAura = (v: unknown): v is AuraId => AURAS.some((a) => a.id === v);

const KEY = "sl_m_aura", SEEN = "sl_m_aura_seen";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };

/** The aura to show: the chosen one if still unlocked, otherwise the Shadow Monarch. */
export function resolveAura(chosen: string | null, playerRank: string): AuraId {
  const a = AURAS.find((x) => x.id === chosen);
  return a && isUnlocked(a, playerRank) ? a.id : "shadow";
}

/** Auras unlocked but never looked at — shown with a "New" mark. */
export function unseenAuras(playerRank: string, seen: string[]): AuraId[] {
  return AURAS.filter((a) => a.id !== "shadow" && isUnlocked(a, playerRank) && !seen.includes(a.id)).map((a) => a.id);
}

export function useAura(playerRank: string) {
  const [chosen, setChosen] = useState<string | null>(() => read(KEY));
  const [seen, setSeen] = useState<string[]>(() => (read(SEEN) ?? "").split(",").filter(Boolean));
  const aura = resolveAura(chosen, playerRank);

  useEffect(() => {
    document.documentElement.dataset.mTheme = aura;
    return () => { delete document.documentElement.dataset.mTheme; };
  }, [aura]);

  const choose = useCallback((id: AuraId) => {
    if (!isAura(id)) return;
    setChosen(id); write(KEY, id);
  }, []);
  const markSeen = useCallback(() => {
    const all = AURAS.filter((a) => isUnlocked(a, playerRank)).map((a) => a.id);
    setSeen(all); write(SEEN, all.join(","));
  }, [playerRank]);

  return { aura, choose, unseen: unseenAuras(playerRank, seen), markSeen };
}
