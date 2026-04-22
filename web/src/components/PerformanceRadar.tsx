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
  // Calculate relative max for "Relative Visualization"
  const maxVal = Math.max(...data.map(d => d.value), 20); // Fallback to 20 if zero
  const relativeDomain = [0, Math.ceil(maxVal * 1.1)];

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {title && (
        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>
          {title}
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 10 }} outerRadius="80%">
          <defs>
            <linearGradient id="purpleRadarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="var(--accent-secondary)" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          
          <PolarGrid 
            stroke="rgba(168,168,255,0.15)" 
            gridType="polygon" 
          />
          
          <PolarAngleAxis
            dataKey="category"
            tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 700, letterSpacing: "0.05em" }}
          />
          
          <PolarRadiusAxis
            angle={90} 
            domain={relativeDomain}
            tick={false}
            axisLine={false}
          />
          
          <Radar
            name="Hunter Stats"
            dataKey="value"
            stroke="var(--accent-primary)"
            strokeWidth={2}
            fill="url(#purpleRadarFill)"
            fillOpacity={1}
            dot={{ fill: "var(--accent-primary)", r: 3, stroke: "white", strokeWidth: 1 }}
            activeDot={{ r: 5, fill: "white", stroke: "var(--accent-primary)", strokeWidth: 2 }}
          />
          
          <Tooltip
            contentStyle={{
              background: "rgba(10,10,15,0.95)",
              border: "1px solid var(--accent-primary)",
              borderRadius: "8px",
              backdropFilter: "blur(20px)",
              fontSize: "12px",
              color: "#fff",
              boxShadow: "0 0 20px rgba(168,168,255,0.2)",
            }}
            formatter={(v: any) => [`${v} Points`, "Value"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

