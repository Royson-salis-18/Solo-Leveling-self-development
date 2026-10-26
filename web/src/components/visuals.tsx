import type { ReactNode } from "react";
import { arcPoint, buildHeatGrid, scoreLabel } from "../lib/visuals";
import type { ActivityDay } from "../lib/gameTypes";
import "./visuals.css";

/* ── Conquest heatmap ───────────────────────────────────────────────────────── */
export function ActivityHeatmap({ days, weeks = 20, todayDate }: { days: ActivityDay[]; weeks?: number; todayDate?: string }) {
  const { columns, months } = buildHeatGrid(days, weeks);
  const today = todayDate ?? days[days.length - 1]?.date;
  return (
    <div className="hm" role="img" aria-label="Conquests per day over the last weeks">
      <div className="hm-months" style={{ gridTemplateColumns: `22px repeat(${columns.length}, var(--hm-cell))` }}>
        <span />
        {columns.map((_, ci) => <span key={ci}>{months.find((m) => m.col === ci)?.label ?? ""}</span>)}
      </div>
      <div className="hm-body">
        <div className="hm-days"><span>M</span><span /><span>W</span><span /><span>F</span><span /><span>S</span></div>
        <div className="hm-grid" style={{ gridTemplateColumns: `repeat(${columns.length}, var(--hm-cell))` }}>
          {columns.map((col, ci) => (
            <div key={ci} className="hm-col">
              {col.map((c, ri) => c
                ? <i key={ri} className={`hm-cell l${c.level}${c.date === today ? " today" : ""}`} title={c.label} />
                : <i key={ri} className="hm-cell pad" />)}
            </div>
          ))}
        </div>
      </div>
      <div className="hm-legend"><span>Less</span>{[0, 1, 2, 3, 4].map((l) => <i key={l} className={`hm-cell l${l}`} />)}<span>More</span></div>
    </div>
  );
}

/* ── Arc gauge (score out of 100) ───────────────────────────────────────────── */
export function ArcGauge({ value, label = "Discipline score", delta }: { value: number; label?: string; delta?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const w = 220, h = 124, cx = 110, cy = 112, r = 92;
  const start = arcPoint(0, cx, cy, r), end = arcPoint(1, cx, cy, r), now = arcPoint(v / 100, cx, cy, r);
  const arc = (to: { x: number; y: number }, large: 0 | 1) => `M${start.x},${start.y} A${r},${r} 0 ${large} 1 ${to.x},${to.y}`;
  return (
    <figure className="ag" aria-label={`${label}: ${v} out of 100`}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img">
        <defs>
          <linearGradient id="agGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#5b3fd6" /><stop offset="1" stopColor="#c4b5ff" /></linearGradient>
          <filter id="agGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={arc(end, 0)} className="ag-track" />
        {v > 0 && <path d={arc(now, 0)} className="ag-fill" filter="url(#agGlow)" />}
        <circle cx={now.x} cy={now.y} r="9" className="ag-knob" />
        <circle cx={now.x} cy={now.y} r="3.5" className="ag-knob-core" />
      </svg>
      <figcaption><b>{v}<small>/100</small></b><span>{label}</span><em>{delta ?? scoreLabel(v)}</em></figcaption>
    </figure>
  );
}

/* ── Big-number stat tile ───────────────────────────────────────────────────── */
export function StatTile({ icon, label, value, foot, bar }: { icon?: ReactNode; label: string; value: ReactNode; foot?: ReactNode; bar?: number }) {
  return (
    <article className="st">
      <header>{icon}<span>{label}</span></header>
      <b>{value}</b>
      {bar !== undefined && <div className="st-bar"><i style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} /></div>}
      {foot && <footer>{foot}</footer>}
    </article>
  );
}
