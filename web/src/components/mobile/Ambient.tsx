import { useMemo } from "react";
import { contourPaths, plexus } from "../../lib/ambient";
import "./ambient.css";

/** The shell's backdrop: soft contour rings top-right, a faint plexus network bottom-left. Decorative and static. */
export function Ambient() {
  const art = useMemo(() => ({ rings: contourPaths(330, 150), net: plexus(390, 844) }), []);
  return (
    <svg className="m-ambient" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="ambFadeTop" cx="85%" cy="14%" r="62%"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <mask id="ambMaskTop"><rect width="390" height="844" fill="url(#ambFadeTop)" /></mask>
        <radialGradient id="ambFadeBot" cx="12%" cy="92%" r="70%"><stop offset="0" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <mask id="ambMaskBot"><rect width="390" height="844" fill="url(#ambFadeBot)" /></mask>
        <filter id="ambGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" /></filter>
      </defs>
      <g mask="url(#ambMaskTop)" className="m-amb-rings">
        <g filter="url(#ambGlow)" opacity=".7">{art.rings.map((d, i) => <path key={i} d={d} />)}</g>
        <g>{art.rings.map((d, i) => <path key={i} d={d} />)}</g>
      </g>
      <g mask="url(#ambMaskBot)" className="m-amb-net">
        {art.net.edges.map(([a, b, o], i) => <line key={i} x1={art.net.nodes[a].x} y1={art.net.nodes[a].y} x2={art.net.nodes[b].x} y2={art.net.nodes[b].y} strokeOpacity={0.18 + o * 0.5} />)}
        {art.net.nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={n.r} className={n.glow ? "glow" : ""} />)}
      </g>
    </svg>
  );
}
