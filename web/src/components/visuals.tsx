import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { arcPoint, buildHeatGrid, scoreLabel } from "../lib/visuals";
import type { ActivityDay } from "../lib/gameTypes";
import { prefersReducedMotion } from "../lib/feedback";
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

/* ── Quick actions row ──────────────────────────────────────────────────────── */
export function QuickActions({ items }: { items: Array<{ icon: ReactNode; label: string; onClick: () => void; primary?: boolean; dot?: boolean }> }) {
  return (
    <nav className="qa" aria-label="Quick actions">
      {items.map((it) => (
        <button key={it.label} className={`qa-btn${it.primary ? " primary" : ""}`} onClick={it.onClick}>
          <span>{it.icon}{it.dot && <i className="qa-dot" />}</span>
          <em>{it.label}</em>
        </button>
      ))}
    </nav>
  );
}

/* ── Power orb: dotted particle ring around a press target ──────────────────── */
export function PowerOrb({ progress, title, caption, sub, onPress, size = 232 }: {
  progress: number; title: ReactNode; caption: string; sub?: string; onPress: () => void; size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr; canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const N = 520, cx = size / 2, cy = size / 2, base = size * 0.36;
    const dots = Array.from({ length: N }, (_, i) => ({ a: (i / N) * Math.PI * 2, j: Math.random(), k: Math.random() }));
    const still = prefersReducedMotion();
    let raf = 0, t = 0;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      for (const d of dots) {
        const wave = Math.sin(d.a * 3 + t) * 0.06 + Math.sin(d.a * 5 - t * 1.3) * 0.04 + Math.cos(d.a * 2 + t * 0.7) * 0.05;
        const spread = (d.j - 0.5) * size * 0.1 * (0.6 + Math.sin(t + d.a * 2) * 0.4);
        const r = base * (1 + wave) + spread;
        const x = cx + Math.cos(d.a) * r, y = cy + Math.sin(d.a) * r;
        const alpha = 0.25 + d.k * 0.6;
        ctx.fillStyle = d.k > 0.82 ? `rgba(235,228,255,${alpha})` : `rgba(168,148,255,${alpha})`;
        ctx.beginPath(); ctx.arc(x, y, 0.7 + d.k * 1.1, 0, Math.PI * 2); ctx.fill();
      }
      if (!still && document.visibilityState === "visible") { t += 0.012; raf = requestAnimationFrame(draw); }
      else if (!still) raf = window.setTimeout(() => { raf = requestAnimationFrame(draw); }, 400) as unknown as number;
    };
    draw();
    return () => { cancelAnimationFrame(raf); clearTimeout(raf); };
  }, [size]);

  const p = Math.max(0, Math.min(1, progress));
  const R = size * 0.235, C = 2 * Math.PI * R;
  return (
    <div className="po" style={{ width: size, height: size }}>
      <canvas ref={ref} style={{ width: size, height: size }} aria-hidden="true" />
      <svg className="po-ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={R} className="po-track" />
        <circle cx={size / 2} cy={size / 2} r={R} className="po-prog" strokeDasharray={`${C * p} ${C}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <button className="po-btn" onClick={onPress} aria-label={`${caption}. ${sub ?? ""}`}>
        <strong>{title}</strong>
        <span>{caption}</span>
        {sub && <small>{sub}</small>}
      </button>
    </div>
  );
}
