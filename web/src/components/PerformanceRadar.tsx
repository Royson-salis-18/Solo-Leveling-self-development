import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip, ResponsiveContainer,
} from "recharts";

interface Props {
  data: Array<{ category: string; value: number; fullMark: number }>;
  title?: string;
  height?: number;
}

export function PerformanceRadar({ data, title, height = 320 }: Props) {
  return (
    <article className="panel">
      {title && (
        <p className="panel" style={{ background:"none", border:"none", boxShadow:"none", padding:0, marginBottom:14 }}>
          <span style={{ fontSize:"0.70rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", color:"var(--text-tertiary)" }}>{title}</span>
        </p>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top:16, right:24, bottom:16, left:24 }}>
          <defs>
            <radialGradient id="acrylicFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(255,255,255,0.18)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
            </radialGradient>
          </defs>
          <PolarGrid stroke="rgba(255,255,255,0.08)" gridType="polygon" />
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill:"rgba(255,255,255,0.40)", fontSize:11, fontFamily:"Inter, sans-serif", fontWeight:500 }}
          />
          <PolarRadiusAxis
            angle={90} domain={[0, 100]}
            tick={{ fill:"rgba(255,255,255,0.22)", fontSize:9 }}
            stroke="rgba(255,255,255,0.05)"
          />
          <Radar
            name="Performance"
            dataKey="value"
            stroke="rgba(255,255,255,0.55)"
            fill="url(#acrylicFill)"
            fillOpacity={1}
            strokeWidth={1.5}
            dot={{ fill:"rgba(255,255,255,0.7)", r:3, strokeWidth:0 }}
            activeDot={{ r:5, fill:"rgba(255,255,255,0.95)", strokeWidth:0 }}
          />
          <Tooltip
            contentStyle={{
              background:"rgba(14,14,16,0.92)",
              border:"1px solid rgba(255,255,255,0.12)",
              borderRadius:"8px",
              backdropFilter:"blur(16px)",
              fontSize:"12px",
              color:"rgba(255,255,255,0.80)",
              boxShadow:"0 16px 40px rgba(0,0,0,0.5)",
            }}
            formatter={(v: any) => [`${v}%`, "Score"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </article>
  );
}
