import { useEffect, useMemo, useState } from "react";
import { Crown, Flame, Gift, Ghost, Skull, Star, Swords, Trophy as TrophyIcon, Users, Zap } from "lucide-react";
import type { ComponentType } from "react";
import { SystemAPI } from "../services/SystemAPI";
import { useToast } from "../lib/toast";
import { RARITY_COLOR, percent } from "../lib/engagement";
import type { Trophy } from "../lib/gameTypes";
import "../components/engagement.css";

// Explicit map (not `import * as icons`) so the bundle only carries the icons trophies use.
const ICONS: Record<string, ComponentType<{ size?: number }>> = {
  trophy: TrophyIcon, swords: Swords, flame: Flame, zap: Zap, ghost: Ghost, skull: Skull,
  gift: Gift, star: Star, users: Users, crown: Crown,
};

type Filter = "all" | "unlocked" | "locked";

export function AchievementsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Trophy[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    SystemAPI.getAchievements().then((r) => { if (alive) setRows(r); }).catch((e) => { toast.fail(e, "Could not load trophies"); if (alive) setRows([]); });
    return () => { alive = false; };
  }, [toast]);

  const unlocked = rows?.filter((r) => r.unlocked_at).length ?? 0;
  const shown = useMemo(() => (rows ?? []).filter((r) =>
    filter === "all" ? true : filter === "unlocked" ? !!r.unlocked_at : !r.unlocked_at), [rows, filter]);

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Trophies</h2>
          <p className="page-subtitle">{rows ? `${unlocked} of ${rows.length} unlocked` : "Loading…"} — each one pays XP the moment you earn it.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }} role="tablist" aria-label="Filter trophies">
          {(["all", "unlocked", "locked"] as Filter[]).map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} className="eng-btn" style={filter === f ? { background: "rgba(168,168,255,.28)" } : undefined} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>

      {rows && rows.length > 0 && (
        <div className="eng-bar" style={{ marginBottom: 20 }}><i style={{ width: `${percent(unlocked, rows.length)}%` }} /></div>
      )}

      <div className="trophy-grid">
        {!rows && Array.from({ length: 8 }, (_, i) => <div key={i} className="trophy-card" style={{ minHeight: 120, opacity: .4 }} />)}
        {shown.map((t) => {
          const Icon = ICONS[t.icon] ?? TrophyIcon;
          const on = !!t.unlocked_at;
          return (
            <div key={t.key} className={`trophy-card ${on ? "is-on" : "is-off"}`} style={{ ["--rc" as string]: RARITY_COLOR[t.rarity] }}>
              <div className="trophy-top">
                <div className="trophy-ico"><Icon size={22} /></div>
                <div><div className="trophy-name">{t.name}</div><div className="trophy-rar">{t.rarity}</div></div>
              </div>
              <div className="trophy-desc">{t.description}</div>
              {on ? (
                <div className="trophy-foot"><span>Unlocked {new Date(t.unlocked_at!).toLocaleDateString()}</span><span>+{t.xp_reward} XP</span></div>
              ) : (
                <>
                  <div className="eng-bar"><i style={{ width: `${percent(t.progress, t.threshold)}%` }} /></div>
                  <div className="trophy-foot"><span>{Number(t.progress).toLocaleString()} / {t.threshold.toLocaleString()}</span><span>+{t.xp_reward} XP</span></div>
                </>
              )}
            </div>
          );
        })}
      </div>
      {rows && shown.length === 0 && <p className="text-muted">Nothing here yet — go conquer a gate.</p>}
    </section>
  );
}
