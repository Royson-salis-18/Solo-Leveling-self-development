import type { ActivityDay } from "./gameTypes";

/** 0–4 intensity for a heatmap cell from the number of conquests that day. */
export function heatLevel(conquests: number): 0 | 1 | 2 | 3 | 4 {
  if (conquests <= 0) return 0;
  if (conquests === 1) return 1;
  if (conquests === 2) return 2;
  if (conquests <= 4) return 3;
  return 4;
}

export type HeatCell = { date: string; level: 0 | 1 | 2 | 3 | 4; conquests: number; points: number; future?: boolean; label: string };

/**
 * Lay days out as week columns (Monday first) for a GitHub-style grid. The first column is padded
 * so every row is the same weekday; returns columns of 7 cells (null = padding) plus month labels.
 */
export function buildHeatGrid(days: ActivityDay[], weeks: number): { columns: Array<Array<HeatCell | null>>; months: Array<{ col: number; label: string }> } {
  const take = days.slice(-weeks * 7);
  if (take.length === 0) return { columns: [], months: [] };
  const first = new Date(`${take[0].date}T12:00:00`);
  const lead = (first.getDay() + 6) % 7;                                   // Mon = 0
  const cells: Array<HeatCell | null> = [...Array(lead).fill(null), ...take.map((d) => ({
    date: d.date, level: heatLevel(d.conquests), conquests: d.conquests, points: d.points,
    label: `${new Date(`${d.date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })} · ${d.conquests} gate${d.conquests === 1 ? "" : "s"} · ${d.points} XP`,
  }))];
  while (cells.length % 7) cells.push(null);
  const columns: Array<Array<HeatCell | null>> = [];
  for (let i = 0; i < cells.length; i += 7) columns.push(cells.slice(i, i + 7));

  const months: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  columns.forEach((col, ci) => {
    const c = col.find(Boolean);
    if (!c) return;
    const m = new Date(`${c.date}T12:00:00`).getMonth();
    if (m !== lastMonth) { months.push({ col: ci, label: new Date(`${c.date}T12:00:00`).toLocaleDateString("en", { month: "short" }) }); lastMonth = m; }
  });
  return { columns, months };
}

/** Point on a semicircle arc (0 = left end, 1 = right end) for the gauge knob. */
export function arcPoint(t: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const a = Math.PI * (1 - Math.max(0, Math.min(1, t)));
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
}

/** Plain-language read of a 0–100 discipline score. */
export function scoreLabel(score: number): string {
  if (score >= 85) return "Elite consistency";
  if (score >= 65) return "Strong";
  if (score >= 40) return "Building";
  if (score > 0) return "Getting started";
  return "No data yet";
}
