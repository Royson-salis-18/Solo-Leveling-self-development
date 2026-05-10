import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Radar, Tooltip, ResponsiveContainer,
} from "recharts";
import { Zap, Activity } from "lucide-react";

interface RadarDataPoint {
  category: string;
  value: number;       // Actual mastery (stat_* from DB)
  pending?: number;    // Active task load (dotted overlay)
  fullMark: number;
}

interface Props {
  data: RadarDataPoint[];
  title?: string;
  height?: number;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as RadarDataPoint;
  return (
    <div style={{
      background: "rgba(8,8,18,0.97)",
      border: "1px solid rgba(168,168,255,0.35)",
      borderRadius: 10,
      padding: "10px 14px",
      backdropFilter: "blur(20px)",
      fontSize: 12,
      color: "#fff",
      boxShadow: "0 0 24px rgba(168,168,255,0.15)",
      minWidth: 160,
    }}>
      <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 6, color: "var(--accent-primary)", letterSpacing: "1px", textTransform: "uppercase" }}>
        {d?.category}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} color="var(--accent-primary)" /> Mastery
          </span>
          <span style={{ fontWeight: 800, color: "var(--accent-primary)" }}>{d?.value ?? 0} pts</span>
        </div>
        {(d?.pending ?? 0) > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <span style={{ opacity: 0.6, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Activity size={12} color="rgba(100,160,255,0.9)" /> Active Training
            </span>
            <span style={{ fontWeight: 700, color: "rgba(100,160,255,0.9)" }}>{d?.pending ?? 0} pts</span>
          </div>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 10, opacity: 0.4, fontStyle: "italic" }}>
        Earn tasks → Mastery grows. Inactive → Mastery decays.
      </div>
    </div>
  );
};

export function PerformanceRadar({ data, title, height = 320 }: Props) {
  const maxVal = Math.max(...data.map(d => Math.max(d.value, d.pending ?? 0)), 20);
  const domain = [0, Math.ceil(maxVal * 1.15)];

  const hasPending = data.some(d => (d.pending ?? 0) > 0);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {title && (
        <div style={{ fontSize: "0.7rem", fontWeight: 800, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
          {title}
        </div>
      )}

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginBottom: 4, justifyContent: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent-primary)", opacity: 0.8 }} />
          MASTERY
        </div>
        {hasPending && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
            <div style={{ width: 10, height: 3, borderTop: "2px dashed rgba(100,160,255,0.7)" }} />
            ACTIVE TRAINING
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={data} margin={{ top: 20, right: 30, bottom: 20, left: 30 }} outerRadius="65%">
          <defs>
            <linearGradient id="statRadarFill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="pendingRadarFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(100,160,255,0.15)" stopOpacity={0.15} />
              <stop offset="100%" stopColor="rgba(100,160,255,0)" stopOpacity={0} />
            </linearGradient>
          </defs>



          <PolarAngleAxis
            dataKey="category"
            tick={({ x, y, payload }) => {
              return (
                <g transform={`translate(${x},${y})`} style={{ cursor: 'help' }}>
                  <title>{payload.value}</title>
                  <circle cx={0} cy={0} r={3} fill="var(--accent-primary)" opacity={0.7} />
                  <circle cx={0} cy={0} r={10} fill="var(--accent-primary)" opacity={0.1} />
                  <text
                    x={0} y={14}
                    textAnchor="middle"
                    fill="rgba(168, 168, 255, 0.6)"
                    style={{ fontSize: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}
                  >
                    {(payload?.value || "???").substring(0, 3)}
                  </text>
                </g>
              );
            }}
          />

          <PolarRadiusAxis
            angle={90}
            domain={domain}
            tickCount={6}
            tickFormatter={() => ""}
            axisLine={false}
          />

          {/* Dotted pending/training load layer */}
          {hasPending && (
            <Radar
              name="Active Training"
              dataKey="pending"
              stroke="rgba(100,160,255,0.65)"
              strokeWidth={1.5}
              strokeDasharray="5 3"
              fill="url(#pendingRadarFill)"
              fillOpacity={0.2}
              dot={false}
            />
          )}

          <Radar
            name="Mastery"
            dataKey="value"
            stroke="#6366f1"
            strokeWidth={2.5}
            fill="url(#statRadarFill)"
            fillOpacity={0.6}
            dot={{ fill: "#6366f1", r: 3, stroke: "rgba(0,0,0,0.6)", strokeWidth: 1.5 }}
            activeDot={{ r: 6, fill: "white", stroke: "var(--accent-primary)", strokeWidth: 2 }}
          />

          <PolarGrid stroke="rgba(168,168,255,0.35)" gridType="polygon" />

          <Tooltip content={<CustomTooltip />} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
