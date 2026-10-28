/** Deterministic line-art for the phone backdrop: glowing contour rings and a plexus network. Pure, so it renders once. */
const lcg = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

/** Nested wobbly rings, like a topographic map or the wireframe ripples in the references. */
export function contourPaths(cx: number, cy: number, rings = 14, r0 = 26, step = 17): string[] {
  const out: string[] = [];
  for (let k = 0; k < rings; k++) {
    const r = r0 + k * step, n = 72;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * Math.PI * 2;
      const wob = 1 + 0.13 * Math.sin(3 * t + k * 0.35) + 0.07 * Math.sin(5 * t - k * 0.22) + 0.03 * Math.sin(9 * t + k);
      pts.push(`${(cx + Math.cos(t) * r * wob * 1.15).toFixed(1)},${(cy + Math.sin(t) * r * wob * 0.9).toFixed(1)}`);
    }
    out.push(`M${pts.join("L")}Z`);
  }
  return out;
}

export type Plexus = { nodes: Array<{ x: number; y: number; r: number; glow: boolean }>; edges: Array<[number, number, number]> };

/** Scattered nodes joined to their near neighbours. */
export function plexus(w: number, h: number, count = 30, reach = 96, seed = 7): Plexus {
  const rnd = lcg(seed);
  const nodes = Array.from({ length: count }, () => {
    const depth = rnd();
    return { x: rnd() * w, y: h * (0.55 + rnd() * 0.45), r: 1 + depth * 1.8, glow: depth > 0.82 };
  });
  const edges: Array<[number, number, number]> = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
    if (d < reach) edges.push([i, j, 1 - d / reach]);
  }
  return { nodes, edges };
}
