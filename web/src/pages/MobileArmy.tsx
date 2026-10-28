import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Gem, Gift, Hammer, Skull, Swords, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { SystemAPI } from "../services/SystemAPI";
import { ITEM_GRADES, RESONANCE_CAP, SHADOW_TIERS, fetchCollection, itemFx, resonance, shadowBonus, shadowRankLabel, tierOf, type CatalogItem, type CatalogShadow } from "../lib/collection";
import { AuraCard } from "../components/AuraCard";
import { SegBar } from "../components/visuals";
import { RARITY_COLORS } from "../lib/catalog";
import { haptic } from "../lib/feedback";
import "../components/mobile/mobile.css";
import "../components/mobile/sheets.css";
import "./mobile-army.css";

type Tab = "Army" | "Arsenal" | "Vault";
const TAB_META: Record<Tab, { title: string; lede: string; icon: ReactNode }> = {
  Army: { title: "Shadow Army", lede: "Every shadow you extract adds passive XP to all conquests.", icon: <Skull size={16} /> },
  Arsenal: { title: "Arsenal", lede: "Weapons won in battle. They lose mana each day, so use them.", icon: <Swords size={16} /> },
  Vault: { title: "Vault", lede: "Artifacts and tools that never fade.", icon: <Gem size={16} /> },
};

/* Readable on dark surfaces: one hue per grade, brighter than the web catalog's swatches. */
const GRADE_COLOR: Record<string, string> = {
  Mythic: "#f87171", Legendary: "#f5c451", Epic: "#a78bfa", Rare: "#60a5fa", Common: "#94a3b8",
  "S-Rank": "#f5c451", "A-Rank": "#f87171", "B-Rank": "#a78bfa", "C-Rank": "#60a5fa", "D-Rank": "#94a3b8", "E-Rank": "#94a3b8",
};
const colorOf = (grade: string) => GRADE_COLOR[grade] ?? "#94a3b8";
function ItemGlyph({ i, size = 24 }: { i: CatalogItem; size?: number }) {
  if (i.item_category === "Weapon") return <Swords size={size} />;
  if (i.item_category === "Tool") return i.item_type === "TASK_SKIP" ? <Zap size={size} /> : <Hammer size={size} />;
  return <Gem size={size} />;
}

const SHORT_TIER: Record<string, string> = { Mythic: "Sovereign", Legendary: "Marshal", Epic: "Commander", Rare: "Knight", Common: "Infantry" };
const cardColor = (rarity: string) => RARITY_COLORS[rarity.toUpperCase()] ?? "#475569";

function ShadowCard({ s, big }: { s: CatalogShadow; big?: boolean }) {
  return (
    <AuraCard name={s.name} rankLabel={shadowRankLabel(s.rarity)} rarityColor={cardColor(s.rarity)} isCollected={s.collected} isCorrupted={!!s.is_corrupted}
      effectType={s.effectType} col={s.col} glow={s.glow} icon={s.icon} sub={s.sub} bonus={shadowBonus(s.rarity)} label="SHADOW" interactive={!!big}
      style={big ? { width: 260, height: 366 } : { width: "100%", height: 228 }} />
  );
}
function ItemCard({ i, big }: { i: CatalogItem; big?: boolean }) {
  const fx = itemFx(i);
  return (
    <AuraCard name={i.name} rankLabel={i.rarity} rarityColor={cardColor(i.rarity)} isCollected={i.collected} {...fx}
      icon={<ItemGlyph i={i} size={24} />} label={i.item_category.toUpperCase()} interactive={!!big}
      sub={i.collected && i.item_category === "Weapon" ? `${i.durability}% mana` : i.item_category}
      style={big ? { width: 260, height: 366 } : { width: "100%", height: 228 }} />
  );
}

const giftWindowOpen = () => { const h = new Date().getHours(); return h >= 6 && h < 22; };

export function MobileArmy() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("Army");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [shadows, setShadows] = useState<CatalogShadow[] | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [gifting, setGifting] = useState(false);
  const [open, setOpen] = useState<{ kind: "shadow"; s: CatalogShadow } | { kind: "item"; i: CatalogItem } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try { const c = await fetchCollection(user.id); setShadows(c.shadows); setItems(c.items); setFailed(false); }
    catch { setFailed(true); }
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const owned = useMemo(() => (shadows ?? []).filter((s) => s.collected), [shadows]);
  const res = resonance(owned);
  const strongest = useMemo(() => [...owned].sort((a, b) => shadowBonus(b.rarity) - shadowBonus(a.rarity))[0], [owned]);
  const tabItems = items.filter((i) => (tab === "Arsenal" ? i.item_category === "Weapon" : i.item_category !== "Weapon"));
  const counts: Record<Tab, [number, number]> = {
    Army: [owned.length, shadows?.length ?? 0],
    Arsenal: [items.filter((i) => i.collected && i.item_category === "Weapon").length, items.filter((i) => i.item_category === "Weapon").length],
    Vault: [items.filter((i) => i.collected && i.item_category !== "Weapon").length, items.filter((i) => i.item_category !== "Weapon").length],
  };

  const claimGift = async () => {
    if (gifting) return;
    setGifting(true);
    try {
      const g = await SystemAPI.claimDailyGift();
      haptic("success");
      toast.success("Daily gift claimed", `${g.name} · ${g.rarity}`);
      await load();
    } catch (err) { toast.fail(err, "Couldn't claim the gift"); } finally { setGifting(false); }
  };

  const pick = (o: NonNullable<typeof open>) => { haptic("tap"); setOpen(o); };
  const meta = TAB_META[tab];
  const [have, all] = counts[tab];

  return (
    <div className="ma">
      <header className="ma-head">
        <h1>{meta.title}</h1>
        <p>{meta.lede}</p>
      </header>

      <div className="ma-seg" role="tablist" aria-label="Collection">
        {(Object.keys(TAB_META) as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); haptic("tap"); }}>
            {TAB_META[t].icon}<span>{t}</span><em>{counts[t][0]}</em>
          </button>
        ))}
      </div>

      <section className="ma-sum" aria-label="Collection summary">
        <div className="ma-sum-line"><b>{have}</b><span>of {all} {tab === "Army" ? "shadows" : tab === "Arsenal" ? "weapons" : "items"}</span>
          {tab !== "Army" && <button className="ma-gift" disabled={gifting || !giftWindowOpen()} onClick={claimGift}><Gift size={15} /> {gifting ? "Opening…" : giftWindowOpen() ? "Daily gift" : "Opens 06:00"}</button>}
        </div>
        <div className="ma-bar"><i className="cool" style={{ width: `${all ? (have / all) * 100 : 0}%` }} /></div>
        {tab === "Army" && (
          <SegBar parts={SHADOW_TIERS.map((t) => ({ name: SHORT_TIER[t.rarity], value: owned.filter((x) => tierOf(x.rarity) === t.rarity).length, color: colorOf(t.rarity) }))} />
        )}
        {tab === "Army" && (
          <div className="ma-res">
            <div className="ma-res-top"><span>Resonance{strongest ? <> · strongest <b style={{ color: colorOf(tierOf(strongest.rarity)) }}>{strongest.name}</b></> : null}</span><em>+{res}% XP{res >= RESONANCE_CAP ? " · max" : ""}</em></div>
          </div>
        )}
      </section>

      <div className="ma-filter" role="radiogroup" aria-label="Show">
        {[["All", false], ["Owned", true]].map(([label, v]) => (
          <button key={String(label)} role="radio" aria-checked={ownedOnly === v} className={ownedOnly === v ? "on" : ""} onClick={() => setOwnedOnly(v as boolean)}>{label as string}</button>
        ))}
      </div>

      {failed && <div className="ux-retry"><span>Couldn’t load your collection.</span><button onClick={() => void load()}>Retry</button></div>}
      {!shadows && !failed && <div className="ma-grid">{Array.from({ length: 4 }, (_, k) => <div key={k} className="ma-card ma-skel" />)}</div>}

      {shadows && tab === "Army" && SHADOW_TIERS.map(({ rarity, title }) => {
        const tier = shadows.filter((s) => tierOf(s.rarity) === rarity);
        const shown = ownedOnly ? tier.filter((s) => s.collected) : tier;
        if (!shown.length) return null;
        const got = tier.filter((s) => s.collected).length;
        const col = colorOf(rarity);
        return (
          <section key={rarity} className="ma-tier" style={{ ["--tc" as string]: col }}>
            <div className="ma-tier-head"><h2>{title}</h2><span>{got}/{tier.length}</span></div>
            <div className="ma-tier-bar"><i style={{ width: `${(got / tier.length) * 100}%` }} /></div>
            <div className="ma-grid">
              {shown.map((s) => (
                <button key={s.name} className="ma-card" onClick={() => pick({ kind: "shadow", s })} aria-label={`${s.name}, ${s.rarity}${s.collected ? `, owned, +${shadowBonus(s.rarity)}% XP` : ", not yet extracted"}`}>
                  <ShadowCard s={s} />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {shadows && tab !== "Army" && ITEM_GRADES.map((grade) => {
        const group = tabItems.filter((i) => i.rarity === grade);
        const shown = ownedOnly ? group.filter((i) => i.collected) : group;
        if (!shown.length) return null;
        const got = group.filter((i) => i.collected).length;
        return (
          <section key={grade} className="ma-tier" style={{ ["--tc" as string]: colorOf(grade) }}>
            <div className="ma-tier-head"><h2>{grade}</h2><span>{got}/{group.length}</span></div>
            <div className="ma-tier-bar"><i style={{ width: `${(got / group.length) * 100}%` }} /></div>
            <div className="ma-grid">
              {shown.map((i) => (
                <button key={i.name} className="ma-card" onClick={() => pick({ kind: "item", i })} aria-label={`${i.name}, ${grade}${i.collected ? ", owned" : ", not yet found"}`}>
                  <ItemCard i={i} />
                </button>
              ))}
            </div>
          </section>
        );
      })}

      {shadows && ownedOnly && have === 0 && (
        <div className="ma-empty"><p>{tab === "Army" ? "No shadows yet. Conquer B-rank or higher gates for a chance to extract one." : "Nothing here yet. Claim the daily gift or open quest caches."}</p></div>
      )}

      {open && createPortal(
        <div className="sh-bg" onClick={() => setOpen(null)}>
          <div className="sh ma-sheet" role="dialog" aria-modal="true" aria-label={open.kind === "shadow" ? open.s.name : open.i.name} onClick={(e) => e.stopPropagation()}>
            <div className="sh-grab" />
            <header className="sh-head"><span /><button className="m-icon-btn" onClick={() => setOpen(null)} aria-label="Close"><X size={20} /></button></header>
            {open.kind === "shadow" ? (() => {
              const s = open.s;
              return (
                <div className="ma-detail" style={{ ["--tc" as string]: colorOf(tierOf(s.rarity)) }}>
                  <div className="ma-bigcard"><ShadowCard s={s} big /></div>
                  <dl className="ma-facts">
                    <div><dt>Passive XP</dt><dd>+{shadowBonus(s.rarity)}%</dd></div>
                    <div><dt>Status</dt><dd>{s.collected ? "In your army" : "Not extracted"}</dd></div>
                  </dl>
                  <small className="ma-how">{s.collected ? `Counts toward resonance, capped at +${RESONANCE_CAP}% XP. Double-tap the card to flip it.` : "Conquer B-rank or higher gates. Rarer shadows answer to harder gates."}</small>
                </div>
              );
            })() : (() => {
              const i = open.i;
              return (
                <div className="ma-detail" style={{ ["--tc" as string]: colorOf(i.rarity) }}>
                  <div className="ma-bigcard"><ItemCard i={i} big /></div>
                  <p>{i.description}</p>
                  {i.collected && i.item_category === "Weapon" && (
                    <div className="ma-res">
                      <div className="ma-res-top"><span>Mana durability</span><em>{i.durability}% · {Math.ceil(i.durability / 20)} day{Math.ceil(i.durability / 20) === 1 ? "" : "s"} left</em></div>
                      <div className={`ma-bar${i.durability <= 40 ? " low" : ""}`}><i style={{ width: `${i.durability}%` }} /></div>
                    </div>
                  )}
                  <small className="ma-how">{i.collected ? (i.item_category === "Weapon" ? "Weapons fade 20% a day. Win more to keep your arsenal full." : "Kept forever.") : "Found in the daily gift, quest caches and raid spoils."}</small>
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
