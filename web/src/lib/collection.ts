import { supabase } from "./supabase";
import { ITEM_CATALOG, SHADOW_CATALOG, type InventoryItem, type Shadow } from "./catalog";

export type CatalogShadow = (typeof SHADOW_CATALOG)[number] & { collected: boolean };
export type CatalogItem = InventoryItem & { collected: boolean; durability: number };

/** Passive XP each shadow adds to the army's resonance (the total is capped at RESONANCE_CAP). */
export const SHADOW_BONUS: Record<string, number> = { Mythic: 20, Legendary: 10, Epic: 5, Rare: 3 };
export const RESONANCE_CAP = 25;
export const shadowBonus = (rarity: string) => SHADOW_BONUS[rarity] ?? 1;
export const resonance = (owned: Array<Pick<Shadow, "rarity">>) => Math.min(RESONANCE_CAP, owned.reduce((n, s) => n + shadowBonus(s.rarity), 0));

/** Army tiers, strongest first, with their in-world titles. */
export const SHADOW_TIERS: Array<{ rarity: string; title: string }> = [
  { rarity: "Mythic", title: "The Sovereigns" },
  { rarity: "Legendary", title: "Grand Marshals" },
  { rarity: "Epic", title: "Shadow Commanders" },
  { rarity: "Rare", title: "Elite Knights" },
  { rarity: "Common", title: "Shadow Infantry" },
];
export const tierOf = (rarity: string) => (SHADOW_TIERS.some((t) => t.rarity === rarity) ? rarity : "Common");

/** Item grades, strongest first. Weapons use letter ranks, artifacts and tools use rarity names. */
export const ITEM_GRADES = ["Mythic", "S-Rank", "Legendary", "A-Rank", "Epic", "B-Rank", "C-Rank", "Rare", "D-Rank", "E-Rank", "Common"];

const DAY_MS = 86_400_000;

/** Weapons lose 20% mana durability per day and leave the arsenal at 0; other items are stable. */
export function durabilityOf(item: { item_category: string; acquired_at?: string; created_at?: string; metadata?: { durability?: number } }, now = Date.now()) {
  if (item.item_category !== "Weapon") return item.metadata?.durability ?? 100;
  const at = new Date(item.acquired_at ?? item.created_at ?? now).getTime();
  return Math.max(0, 100 - Math.floor(((now - at) / DAY_MS) * 20));
}

/** The full catalog merged with what this hunter owns. */
export async function fetchCollection(userId: string): Promise<{ shadows: CatalogShadow[]; items: CatalogItem[] }> {
  if (!supabase) return { shadows: SHADOW_CATALOG.map((s) => ({ ...s, collected: false })), items: ITEM_CATALOG.map((i) => ({ ...i, collected: false, durability: 0 })) };
  const [sRes, iRes] = await Promise.all([
    supabase.from("shadows").select("*").eq("user_id", userId),
    supabase.from("inventory").select("*").eq("user_id", userId),
  ]);
  if (sRes.error) throw sRes.error;
  if (iRes.error) throw iRes.error;
  const shadows = SHADOW_CATALOG.map((cat) => {
    const found = sRes.data?.find((s) => s.name === cat.name);
    return found ? { ...cat, ...found, collected: true } : { ...cat, collected: false };
  });
  const live = (iRes.data ?? []).map((i) => ({ ...i, durability: durabilityOf(i) })).filter((i) => i.durability > 0);
  const items = ITEM_CATALOG.map((cat) => {
    const found = live.find((i) => i.name === cat.name);
    return found ? { ...cat, ...found, collected: true } : { ...cat, collected: false, durability: 0 };
  });
  return { shadows, items };
}
