import { useEffect, useState } from "react";
import { CalendarDays, Flame, Swords, Zap } from "lucide-react";
import { SystemAPI } from "../services/SystemAPI";
import { ENGAGEMENT_REFRESH_EVENT } from "../lib/engagement";
import type { Activity } from "../lib/gameTypes";
import { ActivityHeatmap, ArcGauge, StatTile } from "./visuals";
import "./engagement.css";
import "./visuals.css";

/**
 * "Conquest record": heatmap of the last weeks, discipline score gauge and four headline numbers.
 * One component for web and mobile so both stay visually identical; `compact` only changes density.
 */
export function ConquestRecord({ score, streak, compact }: { score: number; streak: number; compact?: boolean }) {
  const [act, setAct] = useState<Activity | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => SystemAPI.getActivity(compact ? 98 : 240).then((a) => { if (alive) { setAct(a); setFailed(false); } }).catch(() => { if (alive) setFailed(true); });
    void load();
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, load);
    return () => { alive = false; window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, load); };
  }, [compact]);

  if (failed && !act) return null;                        // a bonus layer: never block the page
  const t = act?.totals;
  const weeks = compact ? 14 : 33;
  const thisWeek = (act?.days ?? []).slice(-7).reduce((n, d) => n + d.conquests, 0);

  return (
    <section className={`cr${compact ? " is-compact" : ""}`} aria-label="Conquest record">
      <div className="dd-label">Conquest Record{act && <b>{t?.conquests ?? 0} GATES</b>}</div>
      <div className="cr-top">
        <div className="dd-panel ds-glass cr-heat">
          <div className="dd-top">
            <div><h3 className="dd-h"><CalendarDays size={12} style={{ verticalAlign: -1 }} /> Last {weeks} weeks</h3>
              <div className="cr-sub">{thisWeek} gate{thisWeek === 1 ? "" : "s"} conquered this week</div></div>
          </div>
          {act ? <ActivityHeatmap days={act.days} weeks={weeks} /> : <div className="cr-skel" />}
        </div>
        <div className="dd-panel ds-glass cr-gauge">
          <h3 className="dd-h">Discipline</h3>
          <ArcGauge value={score} label="Discipline score" />
        </div>
      </div>
      <div className="cr-tiles">
        <StatTile icon={<Flame size={14} />} label="Streak" value={streak} foot={`Longest ${Math.max(streak, t?.best_streak ?? 0)}`} />
        <StatTile icon={<Swords size={14} />} label="Total gates" value={(t?.conquests ?? 0).toLocaleString()} foot={t?.since ? `Since ${new Date(`${t.since}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}` : undefined} />
        <StatTile icon={<Zap size={14} />} label="Avg XP / day" value={(t?.avg_xp_active_day ?? 0).toLocaleString()} foot="On active days" />
        <StatTile icon={<CalendarDays size={14} />} label="Active days" value={(t?.active_days ?? 0).toLocaleString()} foot="Days with a conquest" bar={t?.active_days && t?.since ? Math.min(100, (t.active_days / Math.max(1, Math.ceil((Date.now() - new Date(`${t.since}T12:00:00`).getTime()) / 86400000))) * 100) : 0} />
      </div>
    </section>
  );
}
