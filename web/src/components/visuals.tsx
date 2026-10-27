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
      <div className="hm-body">
        <div className="hm-days"><span>M</span><span /><span>W</span><span /><span>F</span><span /><span>S</span></div>
        <div className="hm-main">
          <div className="hm-months" style={{ gridTemplateColumns: `repeat(${columns.length}, var(--hm-cell))` }}>
            {columns.map((_, ci) => <span key={ci}>{months.find((m) => m.col === ci)?.label ?? ""}</span>)}
          </div>
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

/* ── Weekly XP bars (best day highlighted) ──────────────────────────────────── */
export function WeekBars({ days }: { days: Array<{ date: string; daily_points: number }> }) {
  const max = Math.max(1, ...days.map((d) => d.daily_points));
  const best = days.reduce((bi, d, i, arr) => (d.daily_points > arr[bi].daily_points ? i : bi), 0);
  return (
    <div className="wb" role="img" aria-label="XP earned per day this week">
      {days.map((d, i) => {
        const h = Math.max(4, Math.round((Math.max(0, d.daily_points) / max) * 100));
        const lbl = new Date(`${d.date}T12:00:00`).toLocaleDateString("en", { weekday: "short" }).slice(0, 2);
        return (
          <div key={d.date} className={`wb-col${i === best && d.daily_points > 0 ? " best" : ""}${i === days.length - 1 ? " today" : ""}`}>
            <em>{i === best && d.daily_points > 0 ? d.daily_points : ""}</em>
            <div className="wb-track"><i style={{ height: `${h}%` }} /></div>
            <span>{lbl}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── 7-day XP area chart (today's point emphasised, optional daily pace line) ── */
export function XpArea({ days, pace }: { days: Array<{ date: string; daily_points: number }>; pace?: number }) {
  const w = 320, h = 120, top = 18, bottom = 22, left = 6, right = 6;
  const vals = days.map((d) => Math.max(0, d.daily_points));
  const max = Math.max(1, pace ?? 0, ...vals) * 1.12;
  const x = (i: number) => left + (i * (w - left - right)) / Math.max(1, days.length - 1);
  const y = (v: number) => top + (1 - v / max) * (h - top - bottom);
  const pts = vals.map((v, i) => [x(i), y(v)] as const);
  // Monotone-ish smoothing: horizontal control points keep the curve from overshooting below zero.
  const line = pts.reduce((p, [px, py], i) => {
    if (i === 0) return `M${px},${py}`;
    const [qx, qy] = pts[i - 1]; const mx = (qx + px) / 2;
    return `${p} C${mx},${qy} ${mx},${py} ${px},${py}`;
  }, "");
  const base = h - bottom;
  const last = pts[pts.length - 1];
  return (
    <svg className="xa" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`XP per day for the last ${days.length} days`}>
      <defs>
        <linearGradient id="xaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--m-accent, #a78bfa)" stopOpacity=".32" />
          <stop offset="1" stopColor="var(--m-accent, #a78bfa)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.5, 1].map((f) => <line key={f} className="xa-grid" x1={left} x2={w - right} y1={top + (1 - f) * (base - top)} y2={top + (1 - f) * (base - top)} />)}
      <line className="xa-base" x1={left} x2={w - right} y1={base} y2={base} />
      {pace ? <><line className="xa-pace" x1={left} x2={w - right} y1={y(pace)} y2={y(pace)} /><text className="xa-pace-t" x={left} y={y(pace) - 5}>daily pace {pace}</text></> : null}
      {pts.length > 1 && <path d={`${line} L${last[0]},${base} L${pts[0][0]},${base} Z`} fill="url(#xaFill)" />}
      {pts.length > 1 && <path d={line} className="xa-line" />}
      {last && <><circle cx={last[0]} cy={last[1]} r="6" className="xa-halo" /><circle cx={last[0]} cy={last[1]} r="3.5" className="xa-dot" /></>}
      {last && <text className="xa-val" x={Math.min(last[0], w - right)} y={Math.max(11, last[1] - 10)} textAnchor="end">{vals[vals.length - 1]}</text>}
      {days.map((d, i) => (
        <text key={d.date} className={`xa-day${i === days.length - 1 ? " today" : ""}`} x={x(i)} y={h - 5} textAnchor={i === 0 ? "start" : i === days.length - 1 ? "end" : "middle"}>
          {i === days.length - 1 ? "Today" : new Date(`${d.date}T12:00:00`).toLocaleDateString("en", { weekday: "short" }).slice(0, 2)}
        </text>
      ))}
    </svg>
  );
}

/* ── Domain radar (0–100 per axis) ──────────────────────────────────────────── */
export function DomainRadar({ axes, size = 220 }: { axes: Array<{ name: string; value: number; color: string; low?: boolean }>; size?: number }) {
  const padX = 50, padY = 22, w = size + padX * 2, h = size + padY * 2, cx = w / 2, cy = h / 2, r = size / 2 - 6, n = axes.length;
  const at = (i: number, f: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r * f, cy + Math.sin(a) * r * f] as const;
  };
  const poly = (f: (i: number) => number) => axes.map((_, i) => at(i, f(i)).join(",")).join(" ");
  const v = (i: number) => Math.max(0.04, Math.min(100, axes[i].value) / 100);
  return (
    <svg className="dr" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Domain balance: ${axes.map((a) => `${a.name} ${a.value}`).join(", ")}`}>
      {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} className="dr-ring" points={poly(() => f)} />)}
      {axes.map((_, i) => { const [ex, ey] = at(i, 1); return <line key={i} className="dr-spoke" x1={cx} y1={cy} x2={ex} y2={ey} />; })}
      <polygon className="dr-shape" points={poly(v)} />
      {axes.map((a, i) => { const [px, py] = at(i, v(i)); return <circle key={a.name} cx={px} cy={py} r={a.low ? 4.5 : 3.2} fill={a.color} className={a.low ? "dr-pt low" : "dr-pt"} />; })}
      {axes.map((a, i) => {
        const [lx, ly] = at(i, 1.2);
        const anchor = Math.abs(lx - cx) < 6 ? "middle" : lx > cx ? "start" : "end";
        return (
          <text key={a.name} className={`dr-label${a.low ? " low" : ""}`} x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle">
            {a.name}<tspan className="dr-num" dx="4">{a.value}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
