import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Crown, Flame, Gem, Gift, Hammer, Lock, Skull, Sparkles, Swords, X, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { SystemAPI } from "../services/SystemAPI";
import { ITEM_GRADES, RESONANCE_CAP, SHADOW_TIERS, fetchCollection, resonance, shadowBonus, tierOf, type CatalogItem, type CatalogShadow } from "../lib/collection";
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
const glowOf = (s: CatalogShadow) => (s.glow ? `rgb(${s.glow})` : colorOf(tierOf(s.rarity)));

function ShadowGlyph({ s, size = 26 }: { s: CatalogShadow; size?: number }) {
  if (s.icon === "👑") return <Crown size={size} />;
  if (s.icon === "🔥") return <Flame size={size} />;
  if (s.icon === "✨") return <Sparkles size={size} />;
  return <span className="ma-glyph" style={{ fontSize: size }}>{s.icon ?? "◆"}</span>;
}
function ItemGlyph({ i, size = 24 }: { i: CatalogItem; size?: number }) {
  if (i.item_category === "Weapon") return <Swords size={size} />;
  if (i.item_category === "Tool") return i.item_type === "TASK_SKIP" ? <Zap size={size} /> : <Hammer size={size} />;
  return <Gem size={size} />;
}

function Ring({ value, total, color }: { value: number; total: number; color?: string }) {
  const r = 30, c = 2 * Math.PI * r, f = total ? value / total : 0;
  return (
    <svg className="ma-ring" viewBox="0 0 76 76" role="img" aria-label={`${value} of ${total} collected`}>
      <circle cx="38" cy="38" r={r} className="ma-ring-track" />
      <circle cx="38" cy="38" r={r} className="ma-ring-fill" style={color ? { stroke: color } : undefined} strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 38 38)" />
      <text x="38" y="36" textAnchor="middle" className="ma-ring-num">{Math.round(f * 100)}%</text>
      <text x="38" y="50" textAnchor="middle" className="ma-ring-sub">found</text>
    </svg>
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
        <Ring value={have} total={all} />
        {tab === "Army" ? (
          <div className="ma-sum-body">
            <div className="ma-sum-line"><b>{owned.length}</b><span>of {all} shadows</span></div>
            <div className="ma-res">
              <div className="ma-res-top"><span>Resonance</span><em>+{res}% XP{res >= RESONANCE_CAP ? " · max" : ""}</em></div>
              <div className="ma-bar"><i style={{ width: `${(res / RESONANCE_CAP) * 100}%` }} /></div>
            </div>
            <small>{strongest ? <>Strongest: <b style={{ color: colorOf(tierOf(strongest.rarity)) }}>{strongest.name}</b></> : "Conquer B-rank+ gates to extract your first shadow."}</small>
          </div>
        ) : (
          <div className="ma-sum-body">
            <div className="ma-sum-line"><b>{have}</b><span>of {all} {tab === "Arsenal" ? "weapons" : "items"}</span></div>
            <button className="ma-gift" disabled={gifting || !giftWindowOpen()} onClick={claimGift}>
              <Gift size={16} /> {gifting ? "Opening…" : giftWindowOpen() ? "Claim daily gift" : "Gift opens at 06:00"}
            </button>
            <small>One free item a day, between 06:00 and 22:00.</small>
          </div>
        )}
      </section>

      <div className="ma-filter" role="radiogroup" aria-label="Show">
        {[["All", false], ["Owned", true]].map(([label, v]) => (
          <button key={String(label)} role="radio" aria-checked={ownedOnly === v} className={ownedOnly === v ? "on" : ""} onClick={() => setOwnedOnly(v as boolean)}>{label as string}</button>
        ))}
      </div>

      {failed && <div className="ux-retry"><span>Couldn’t load your collection.</span><button onClick={() => void load()}>Retry</button></div>}
      {!shadows && !failed && <div className="ma-grid">{Array.from({ length: 9 }, (_, k) => <div key={k} className="ma-tile ma-skel" />)}</div>}

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
                <button key={s.name} className={`ma-tile${s.collected ? " owned" : " locked"}`} style={{ ["--gc" as string]: glowOf(s) }} onClick={() => pick({ kind: "shadow", s })} aria-label={`${s.name}, ${s.rarity}${s.collected ? `, owned, +${shadowBonus(s.rarity)}% XP` : ", not yet extracted"}`}>
                  {s.collected ? <em className="ma-chip">+{shadowBonus(s.rarity)}%</em> : <Lock size={12} className="ma-lock" />}
                  <span className="ma-art"><ShadowGlyph s={s} /></span>
                  <b>{s.name}</b>
                  <small>{s.sub}</small>
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
                <button key={i.name} className={`ma-tile${i.collected ? " owned" : " locked"}`} style={{ ["--gc" as string]: colorOf(grade) }} onClick={() => pick({ kind: "item", i })} aria-label={`${i.name}, ${grade}${i.collected ? ", owned" : ", not yet found"}`}>
                  {!i.collected && <Lock size={12} className="ma-lock" />}
                  <span className="ma-art"><ItemGlyph i={i} /></span>
                  <b>{i.name}</b>
                  {i.collected && i.item_category === "Weapon"
                    ? <span className={`ma-dur${i.durability <= 40 ? " low" : ""}`} aria-label={`${i.durability}% durability`}><i style={{ width: `${i.durability}%` }} /></span>
                    : <small>{i.item_category}</small>}
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
              const s = open.s; const col = colorOf(tierOf(s.rarity));
              return (
                <div className={`ma-detail${s.collected ? "" : " locked"}`} style={{ ["--gc" as string]: glowOf(s), ["--tc" as string]: col }}>
                  <span className="ma-detail-art"><ShadowGlyph s={s} size={48} /></span>
                  <span className="ma-grade">{s.rarity}</span>
                  <h2>{s.name}</h2>
                  <p>{s.sub}</p>
                  <dl className="ma-facts">
                    <div><dt>Passive XP</dt><dd>+{shadowBonus(s.rarity)}%</dd></div>
                    <div><dt>Status</dt><dd>{s.collected ? "In your army" : "Not extracted"}</dd></div>
                  </dl>
                  <small className="ma-how">{s.collected ? `Counts toward resonance (capped at +${RESONANCE_CAP}% XP).` : "Conquer B-rank or higher gates. Rarer shadows answer to harder gates."}</small>
                </div>
              );
            })() : (() => {
              const i = open.i;
              return (
                <div className={`ma-detail${i.collected ? "" : " locked"}`} style={{ ["--gc" as string]: colorOf(i.rarity), ["--tc" as string]: colorOf(i.rarity) }}>
                  <span className="ma-detail-art"><ItemGlyph i={i} size={44} /></span>
                  <span className="ma-grade">{i.rarity} · {i.item_category}</span>
                  <h2>{i.name}</h2>
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
