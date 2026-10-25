import { useEffect, useMemo, useState } from "react";
import { Crown, Flame, Gift, Ghost, Inbox, Skull, Star, Swords, Trophy as TrophyIcon, Users, Zap } from "lucide-react";
import type { ComponentType } from "react";
import { SystemAPI } from "../services/SystemAPI";
import { useToast } from "../lib/toast";
import { RARITY_COLOR, percent } from "../lib/engagement";
import type { Trophy } from "../lib/gameTypes";
import "../components/engagement.css";

// Explicit map (not `import * as icons`) so the bundle only carries the icons records use.
const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  trophy: TrophyIcon, swords: Swords, flame: Flame, zap: Zap, ghost: Ghost, skull: Skull,
  gift: Gift, star: Star, users: Users, crown: Crown,
};

type Filter = "all" | "unlocked" | "locked";
const FILTERS: Record<Filter, string> = { all: "All", unlocked: "Earned", locked: "Locked" };

export function AchievementsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Trophy[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    SystemAPI.getAchievements().then((r) => { if (alive) setRows(r); }).catch((e) => { toast.fail(e, "Could not read the records"); if (alive) setRows([]); });
    return () => { alive = false; };
  }, [toast]);

  const unlocked = rows?.filter((r) => r.unlocked_at).length ?? 0;
  const shown = useMemo(() => (rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "unlocked" ? !!r.unlocked_at : !r.unlocked_at), [rows, filter]);

  return (
    <section className="page">
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <div className="hf-eyebrow">SYSTEM_RECORDS_v5.0.4</div>
          <h2 className="page-title" style={{ fontSize: "2.2rem", display: "flex", alignItems: "center", gap: 16 }}>
            <TrophyIcon size={32} className="hf-glow" /> Hall of Feats
          </h2>
          <p className="text-muted" style={{ opacity: 0.6, fontSize: "0.8rem", fontWeight: 600 }}>
            {rows ? `${unlocked} of ${rows.length}` : "…"} feats earned. Each one pays XP the moment you earn it.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }} role="tablist" aria-label="Filter records">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className="dd-btn" style={filter === f ? { background: "rgba(168,168,255,.14)", borderColor: "var(--accent-primary)" } : undefined} onClick={() => setFilter(f)}>
              {FILTERS[f]}
            </button>
          ))}
        </div>
      </div>

      {rows && rows.length > 0 && <div className="dd-bar" style={{ marginBottom: 28 }}><i style={{ width: `${percent(unlocked, rows.length)}%` }} /></div>}

      <div className="hf-grid">
        {!rows && Array.from({ length: 6 }, (_, i) => <div key={i} className="hf-card" style={{ minHeight: 130, opacity: 0.4 }} />)}
        {shown.map((t, idx) => {
          const Icon = ICONS[t.icon] ?? TrophyIcon;
          const c = RARITY_COLOR[t.rarity];
          const on = !!t.unlocked_at;
          return (
            <div key={t.key} className={`hf-card ${on ? "is-on" : "is-off"}`} style={{ ["--rc" as string]: c, animationDelay: `${Math.min(idx, 12) * 0.05}s` }}>
              <div className="hf-bar" />
              <div className="hf-main">
                <div className="hf-ico" style={{ color: on ? c : "rgba(255,255,255,.3)", background: on ? `${c}1a` : "rgba(255,255,255,.04)", borderColor: on ? `${c}55` : "rgba(255,255,255,.1)" }}>
                  <Icon size={24} />
                </div>
                <div className="hf-body">
                  <div className="hf-row">
                    <span className="hf-tag" style={{ color: c, background: `${c}1a` }}>{t.rarity}</span>
                    <span className="hf-time">{on ? new Date(t.unlocked_at!).toLocaleDateString() : `+${t.xp_reward} XP`}</span>
                  </div>
                  <h3 className="hf-title">{t.name}</h3>
                  <p className="hf-desc">{t.description}</p>
                  {on ? (
                    <div className="dd-foot"><span>Acquired</span><span>+{t.xp_reward} XP</span></div>
                  ) : (
                    <>
                      <div className="dd-bar"><i style={{ width: `${percent(t.progress, t.threshold)}%` }} /></div>
                      <div className="dd-foot dd-mono"><span>{Number(t.progress).toLocaleString()} / {t.threshold.toLocaleString()}</span><span>Sealed</span></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {rows && shown.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", opacity: 0.6 }}>
          <Inbox size={44} style={{ opacity: 0.3, color: "var(--accent-primary)" }} />
          <p className="text-muted" style={{ marginTop: 12, fontSize: ".85rem" }}>Nothing here yet. Conquer a gate.</p>
        </div>
      )}
    </section>
  );
}
