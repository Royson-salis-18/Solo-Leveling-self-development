import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Sparkles, Skull, Activity } from "lucide-react";
import { AuraCard } from "../components/AuraCard";
import { RaidTimer } from "../components/RaidTimer";

/* ─── types ─────────────────────────────────────────────────────── */
type DashboardData = {
  activeCount: number;
  pendingCount: number;
  completedCount: number;
  totalXp: number;
  level: number;
  weeklyHistory: Array<{ date: string; daily_points: number }>;
  monthlyHistory: Array<{ date: string; daily_points: number }>;
  categoryDistribution: Array<{ category: string; points: number }>;
};

type TaskRow = {
  id: string;
  title: string;
  is_completed: boolean;
  is_pending?: boolean;
  is_failed?: boolean;
  is_active?: boolean;
  started_at?: string;
  priority: string;
  xp_tier?: string;
  category: string;
  time?: string;
};

type AffiliationRow = { id: string; name: string; role: string; type: "clan" | "guild" };

type RecentActivityRow = {
  id: string;
  title: string;
  points: number;
  completed_at: string;
};

const CHART_COLORS = [
  "rgba(255,255,255,0.60)",
  "rgba(255,255,255,0.42)",
  "rgba(255,255,255,0.30)",
  "rgba(255,255,255,0.20)",
  "rgba(255,255,255,0.14)",
];

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "rgba(18,18,20,0.92)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: "8px",
    backdropFilter: "blur(12px)",
    fontSize: "12px",
    color: "rgba(255,255,255,0.8)",
    boxShadow: "0 16px 40px rgba(0,0,0,0.5)",
  },
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

/* ─── COMPONENT ─────────────────────────────────────────────────── */
export function DashboardPage() {
  const { user } = useAuth();
  
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);
  const [shadows, setShadows] = useState<any[]>([]);
  
  const [data, setData] = useState<DashboardData & { player_rank?: string, player_title?: string }>({
    activeCount: 0,
    pendingCount: 0,
    completedCount: 0,
    totalXp: 0, level: 1,
    weeklyHistory: [],
    monthlyHistory: [],
    categoryDistribution: [],
    player_rank: "E",
    player_title: "Newcomer"
  });

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const userId = user.id;
    (async () => {
      try {
        const [
          { count: ac }, 
          { count: cc },
          { count: pc },
          uRes, 
          pRes,
          mRes,
          tRes,
          activeTasksRes,
          completedTasksRes,
          clanMembRes,
          shadowsRes,
        ] = await Promise.all([
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_completed",false).eq("is_pending",false).eq("is_failed",false),
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_completed",true),
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_pending",true).eq("is_completed",false),
          supabase.from("user_profiles").select("total_points,level,player_rank,player_title,guild_id, guilds(name, id), guild_title").eq("user_id",userId).maybeSingle(),
          supabase.from("user_points").select("date,daily_points").eq("user_id",userId).order("date",{ascending:true}).limit(7),
          supabase.from("user_points").select("date,daily_points").eq("user_id",userId).order("date",{ascending:true}).limit(30),
          supabase.from("tasks").select("category,points").eq("user_id",userId),
          supabase.from("tasks").select("id, title, is_completed, is_pending, is_failed, is_active, started_at, priority, xp_tier, category").eq("user_id",userId).eq("is_completed",false).eq("is_pending",false).order("created_at",{ascending:false}).limit(10),
          supabase.from("tasks").select("id, title, points, completed_at").eq("user_id",userId).eq("is_completed",true).order("completed_at",{ascending:false}).limit(5),
          supabase.from("clan_members").select("clan_id, clans(name, id), role").eq("user_id",userId),
          supabase.from("shadows").select("*").eq("user_id", userId),
        ]);

        // Build affiliations
        const affils: AffiliationRow[] = [];
        if (clanMembRes.data?.length) {
          (clanMembRes.data as any[]).forEach((m:any) => {
            if (m.clans) affils.push({ id: m.clans.id, name: m.clans.name, role: m.role, type: "clan" });
          });
        }
        
        // Guild affiliation from user_profiles
        if (uRes.data?.guild_id && uRes.data.guilds) {
          affils.push({ 
            id: (uRes.data.guilds as any).id, 
            name: (uRes.data.guilds as any).name, 
            role: uRes.data.guild_title || "Member", 
            type: "guild" 
          });
        }

        setAffiliations(affils);
        setShadows(shadowsRes.data ?? []);

        const catMap = new Map<string,number>();
        (tRes.data??[]).forEach((t:any) => catMap.set(t.category??"General",(catMap.get(t.category??"General")??0)+Number(t.points??0)));
        const catDist = [...catMap.entries()].map(([category,points])=>({category,points}));

        setData({
          activeCount: ac ?? 0, 
          pendingCount: pc ?? 0,
          completedCount: cc ?? 0,
          totalXp: Number(uRes.data?.total_points ?? 0),
          level: Number(uRes.data?.level ?? 1),
          player_rank: uRes.data?.player_rank ?? "E",
          player_title: uRes.data?.player_title ?? "Newcomer",
          weeklyHistory: (pRes.data??[]).map((d:any)=>({ date:String(d.date).slice(5), daily_points:Number(d.daily_points??0) })),
          monthlyHistory: (mRes.data??[]).map((d:any)=>({ date:String(d.date).slice(5), daily_points:Number(d.daily_points??0) })),
          categoryDistribution: catDist,
        });

        if (activeTasksRes.data) setTasks(activeTasksRes.data as TaskRow[]);
        if (completedTasksRes.data) setRecentActivity(completedTasksRes.data as RecentActivityRow[]);

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    })();
  }, [user]);

  const completionRate = useMemo(()=>{
    const total = data.activeCount + data.completedCount;
    return total ? `${Math.round((data.completedCount/total)*100)}%` : "0%";
  },[data.activeCount, data.completedCount]);

  const weeklyTotal = useMemo(()=>data.weeklyHistory.reduce((s,d)=>s+d.daily_points,0),[data.weeklyHistory]);

  const toggleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
    if (!supabase) return;
    // Optimistic UI
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, is_completed: !isCompleted } : t));
    await supabase.from("tasks").update({ is_completed: !isCompleted, completed_at: !isCompleted ? new Date().toISOString() : null }).eq("id", taskId);
  };

  return (
    <div className="content-inner">

      {/* ── TOP LEVEL BAR ── */}
      <div className="dashboard-section-header" style={{ marginBottom: 40 }}>
        <div>
          <h1 className="page-title" style={{ margin: 0, lineHeight: 1.1 }}>
            Hunter Dashboard <span style={{ color: 'var(--accent-primary)', fontSize: '1rem', verticalAlign: 'middle', marginLeft: 12, fontWeight: 800 }}>[{data.player_rank}-Rank]</span>
          </h1>
          <p className="page-subtitle" style={{ fontSize: '1rem', color: 'var(--accent-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '4px 0 0' }}>
            {data.player_title}
          </p>
        </div>
        <div className="dashboard-action-group">
          <div className="badge">Level {data.level}</div>
          <div className="badge">{data.totalXp.toLocaleString()} Mana</div>
        </div>
      </div>

      {/* ── DYNAMIC SYSTEM MESSAGE BANNER ── */}
      {(() => {
        const messages = [
          { tag: "SYSTEM", title: "Arise. The Hunt Begins.", text: "The shadows are waiting for your command. Complete your daily quests to grow stronger." },
          { tag: "MONARCH", title: "The Sovereign's Decree", text: "A true Monarch doesn't wait for opportunity. They create it through consistency." },
          { tag: "RAGNAROK", title: "Divine Bloodline: Su-ho's Era", text: "The power of the Monarch flows through his son. The new age has arrived." },
          { tag: "ALERT", title: "Hidden Quest Triggered", text: "Quest: 'Unstoppable Momentum'. Complete 5 tasks today for a bonus XP multiplier." },
          { tag: "STATUS", title: "System Analysis Complete", text: "Your mana levels are stabilizing. Current rank: " + data.player_rank + ". Next rank evaluation soon." },
          { tag: "QUOTE", title: "Jin-Woo's Resolve", text: "\"I'm the only one who can level up. That is my strength and my curse.\"" },
          { tag: "HINT", title: "Shadow Tactician", text: "Did you know? Epic shadows like Igris provide a permanent +7% passive XP boost." }
        ];
        // Use date-based index for "Message of the Day"
        const dayOfYear = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const msg = messages[dayOfYear % messages.length];

        return (
          <div className="monarch-quote" style={{ marginBottom: 24 }}>
            <div className="monarch-quote__icon">
              <Sparkles size={26} color="rgba(168,168,255,0.9)" />
            </div>
            <div className="monarch-quote__meta">
              <div className="monarch-quote__label">
                {msg.tag} MESSAGE
              </div>
              <div className="monarch-quote__title">{msg.title}</div>
              <div className="monarch-quote__sub">{msg.text}</div>
            </div>
            <div className="monarch-quote__skull" aria-hidden="true">
              <Skull size={132} />
            </div>
          </div>
        );
      })()}

      {/* ── QUANTUM STAT ROW ── */}
      <div className="stats-grid dashboard-premium-stats">
        <div className="db-quantum-card ds-glass q-aura-purple">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Active Quests</span>
            <span className="q-card-val">{data.activeCount}</span>
            <div className="q-card-footer">
              <span className="q-card-trend">CONQUERING GATES...</span>
            </div>
          </div>
          <Activity size={32} className="q-card-icon" />
        </div>

        <div className="db-quantum-card ds-glass q-aura-orange">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Pending Eval</span>
            <span className="q-card-val">{data.pendingCount}</span>
            <div className="q-card-footer">
              <span className="q-card-trend">DECISION REQUIRED</span>
            </div>
          </div>
          <Sparkles size={32} className="q-card-icon" />
        </div>

        <div className="db-quantum-card ds-glass q-aura-green">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Completed Today</span>
            <span className="q-card-val">{data.completedCount}</span>
            <div className="q-card-footer">
              <span className="q-card-trend">XP HARVESTED</span>
            </div>
          </div>
          <Activity size={32} className="q-card-icon" />
        </div>

        <div className="db-quantum-card ds-glass q-aura-purple">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Weekly Mana</span>
            <span className="q-card-val">{weeklyTotal.toLocaleString()}</span>
            <div className="q-card-footer">
              <span className="q-card-trend">STRENGTHENING...</span>
            </div>
          </div>
          <Sparkles size={32} className="q-card-icon" />
        </div>
      </div>

      <style>{`
        .dashboard-premium-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }
        .db-quantum-card {
          position: relative;
          padding: 24px;
          border-radius: 20px;
          overflow: hidden;
          min-height: 140px;
          display: flex;
          align-items: center;
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .db-quantum-card:hover { transform: translateY(-4px); }
        .q-card-glow {
          position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(168,168,255,0.08) 0%, transparent 70%);
          pointer-events: none; animation: qPulse 6s infinite;
        }
        @keyframes qPulse { 0%, 100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
        
        .q-card-content { position: relative; z-index: 2; flex: 1; }
        .q-card-lbl { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; opacity: 0.4; margin-bottom: 6px; display: block; }
        .q-card-val { font-size: 2.2rem; font-weight: 950; font-family: 'Outfit', sans-serif; line-height: 1; margin-bottom: 8px; display: block; }
        .q-card-footer { font-size: 0.55rem; font-weight: 900; letter-spacing: 1px; color: var(--accent-primary); opacity: 0.8; }
        .q-card-icon { position: absolute; top: 20px; right: 20px; opacity: 0.1; transition: opacity 0.3s; }
        .db-quantum-card:hover .q-card-icon { opacity: 0.3; }

        .q-aura-purple { border: 1px solid rgba(168,168,255,0.15); }
        .q-aura-orange { border: 1px solid rgba(255,160,48,0.15); }
        .q-aura-orange .q-card-glow { background: radial-gradient(circle, rgba(255,160,48,0.08) 0%, transparent 70%); }
        .q-aura-orange .q-card-footer { color: #ffa030; }
        
        .q-aura-green { border: 1px solid rgba(34,136,85,0.15); }
        .q-aura-green .q-card-glow { background: radial-gradient(circle, rgba(34,136,85,0.08) 0%, transparent 70%); }
        .q-aura-green .q-card-footer { color: #228855; }
      `}</style>

      {/* ── PROGRESS / CHARTS ── */}
      {(data.weeklyHistory.length > 0 || data.categoryDistribution.length > 0) && (
        <div className="page-section">
          <div className="section-label">System Analytics</div>
          <div className="dashboard-analytics-grid">
            
            {/* Weekly XP: High-Fidelity Wave */}
            <div className="glass-panel purple-aura analytic-card" style={{ minHeight: 320 }}>
              <div className="chart-header">
                <div className="chart-title">Weekly Mana Tide</div>
                <div className="chart-val">{weeklyTotal} Total XP</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.weeklyHistory} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0.05}/>
                    </linearGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(168,168,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="rgba(168,168,255,0.3)" 
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                    axisLine={{ stroke: "rgba(168,168,255,0.2)" }}
                    tickLine={false}
                  />
                  <YAxis 
                    stroke="rgba(168,168,255,0.3)" 
                    tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                    axisLine={{ stroke: "rgba(168,168,255,0.2)" }}
                    tickLine={false}
                    domain={[0, 'dataMax + 100']}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Area 
                    type="monotone" 
                    dataKey="daily_points" 
                    stroke="var(--accent-primary)" 
                    strokeWidth={4} 
                    fill="url(#waveGrad)" 
                    animationDuration={2000}
                    filter="url(#glow)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Skill Matrix: Monarch Radar */}
            <div className="glass-panel analytic-card" style={{ minHeight: 320 }}>
              <div className="chart-header">
                <div className="chart-title">Sovereign Skill Matrix</div>
                <div className="chart-val">{completionRate} Sync</div>
              </div>
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <PerformanceRadar
                  title=""
                  data={[
                    { category:"Work",        value: Math.round((data.categoryDistribution.find(c=>c.category==="Work")?.points||0)/8.2),    fullMark:100 },
                    { category:"Fitness",     value: Math.round((data.categoryDistribution.find(c=>c.category==="Fitness")?.points||0)/4.4),  fullMark:100 },
                    { category:"Learning",    value: Math.round((data.categoryDistribution.find(c=>c.category==="Learning")?.points||0)/3.2),fullMark:100 },
                    { category:"Mind",        value: Math.round((data.categoryDistribution.find(c=>c.category==="Mindfulness")?.points||0)/2.6),fullMark:100 },
                    { category:"Finance",     value: Math.round((data.categoryDistribution.find(c=>c.category==="Finance")?.points||0)/2.6),fullMark:100 },
                    { category:"Social",      value: Math.round((data.categoryDistribution.find(c=>c.category==="Social")?.points||0)/2.6),fullMark:100 },
                  ]}
                  height={240}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      <style>{`
        .dashboard-analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .analytic-card { padding: 24px; display: flex; flex-direction: column; overflow: hidden; }
        .chart-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
        .chart-title { font-size: 0.7rem; font-weight: 800; color: var(--t3); text-transform: uppercase; letter-spacing: 0.1em; }
        .chart-val { font-size: 1.1rem; font-weight: 900; color: var(--t1); }
        .chart-footer { display: flex; justify-content: space-between; margin-top: 10px; padding: 0 4px; }
        .day-tick { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1; }
        .tick-bar { width: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; min-height: 4px; transition: height 1s; }
        .day-tick span { font-size: 0.55rem; color: var(--t4); font-weight: 700; }
        
        .analytic-card:hover .tick-bar { background: var(--accent-primary); opacity: 0.4; }
        
        .glass-panel {
          border-radius: 18px;
          padding: 22px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 16px 44px rgba(0,0,0,0.55);
          transition: transform .3s ease, box-shadow .3s ease;
        }
        .glass-panel:hover {
          transform: translateY(-2px);
        }
        .glass-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 60%);
          pointer-events: none;
          z-index: 0;
        }
        .glass-panel > * {
          position: relative;
          z-index: 1;
        }
        
        .glass-panel.panel-no-pad { padding: 0; }
        .glass-panel.panel-empty { display: flex; align-items: center; justify-content: center; padding: 40px; }
      `}</style>

      {/* ── EXPANDED ANALYTICS (30-day & Category XP) ── */}
      {(data.monthlyHistory.length > 0 || data.categoryDistribution.length > 0) && (
        <div className="page-section">
          <div className="section-label">Extended Analytics</div>
          <div className="dashboard-panels-row" style={{ alignItems: "stretch" }}>
            
            {/* 30-Day XP Trend */}
            {data.monthlyHistory.length > 0 && (
              <div className="glass-panel dashboard-panel-flex">
                <div className="chart-label-wrapper">
                  <span className="chart-label-text">30-Day Momentum</span>
                  <span style={{ fontSize: "0.66rem", color: "var(--t3)" }}>{data.monthlyHistory.length} days tracked</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={data.monthlyHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="rgba(168,168,255,0.5)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="rgba(168,168,255,0.1)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.12)" tick={{ fontSize:9, fill:"rgba(255,255,255,0.30)" }} tickLine={false} axisLine={false} interval={Math.floor(data.monthlyHistory.length/6)} />
                    <YAxis stroke="rgba(255,255,255,0.12)" tick={{ fontSize:9, fill:"rgba(255,255,255,0.30)" }} tickLine={false} axisLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="daily_points" stroke="#a8a8ff" strokeWidth={1.5} fill="url(#xpGrad)" dot={false} activeDot={{ r: 4, fill: "#a8a8ff" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category XP Bar */}
            {data.categoryDistribution.length > 0 && (
              <div className="glass-panel dashboard-panel-flex">
                <div className="chart-label-wrapper">
                  <span className="chart-label-text">XP By Life Area</span>
                  <span style={{ fontSize: "0.66rem", color: "rgba(255,160,0,0.6)" }}>Academics weighted ×0.5</span>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={data.categoryDistribution
                      .map(c => ({ ...c, weighted: c.category === "Academics" ? Math.round(c.points * 0.5) : c.points }))
                      .sort((a,b) => b.weighted - a.weighted)
                    }
                    margin={{ top: 4, right: 4, bottom: 20, left: -20 }}
                    barSize={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="category" stroke="rgba(255,255,255,0.12)" tick={{ fontSize:9, fill:"rgba(255,255,255,0.40)" }} tickLine={false} axisLine={false} />
                    <YAxis stroke="rgba(255,255,255,0.12)" tick={{ fontSize:9, fill:"rgba(255,255,255,0.30)" }} tickLine={false} axisLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="weighted" radius={[4,4,0,0]}>
                      {data.categoryDistribution.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PENDING WARNING SECTION ── */}
      {data.pendingCount > 0 && (
        <div className="page-section">
          <div className="section-label" style={{ color: "#ffa030" }}>⚠ Overdue — Pending Resolution</div>
          <div className="glass-panel" style={{ border: "1px solid rgba(255,160,0,0.25)", background: "rgba(255,140,0,0.04)" }}>
            <p className="text-sm" style={{ color: "#ffa030", marginBottom: 8 }}>
              You have <strong>{data.pendingCount}</strong> overdue quest{data.pendingCount > 1 ? "s" : ""} awaiting resolution.
            </p>
            <p className="text-xs text-muted">
              Head to the <strong>Quests → Pending</strong> tab to either <em>Resolve</em> them (keep XP) or <em>Fail</em> them (take the penalty). Ignoring them won't make them disappear.
            </p>
          </div>
        </div>
      )}

      {/* ── ONGOING TASKS ── */}
      <div className="page-section">
        <div className="section-label" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Ongoing Quests</span>
          <span style={{ fontSize: "0.55rem", opacity: 0.4, letterSpacing: "2px" }}>Neural_Link: ACTIVE</span>
        </div>
        
        {tasks.filter(t => !t.is_pending && !t.is_failed).length > 0 ? (
          <div className="dashboard-quest-grid">
            {tasks.filter(t => !t.is_pending && !t.is_failed).map(task => (
              <div 
                key={task.id} 
                className={`db-quest-card ds-glass ${task.is_completed ? 'quest-done' : ''}`}
                onClick={() => toggleTaskCompletion(task.id, task.is_completed)}
              >
                <div className="db-quest-header">
                  <div className="db-quest-check">
                    <input type="checkbox" checked={task.is_completed} readOnly />
                    <div className="check-custom"></div>
                  </div>
                  <div className="db-quest-info">
                    <div className="db-quest-title">{task.title}</div>
                    <div className="db-quest-meta">
                      {task.category && <span className="q-tag">{task.category}</span>}
                      {task.xp_tier && <span className="q-tag xp-tag">{task.xp_tier} XP</span>}
                    </div>
                  </div>
                </div>
                
                {task.is_active && task.started_at && (
                  <div className="db-quest-timer ds-aura">
                    <Activity size={10} className="animate-pulse" />
                    <RaidTimer startedAt={task.started_at} />
                  </div>
                )}
                
                <div className="db-quest-priority" style={{ background: task.priority === 'URGENT' ? '#ff4d4d' : 'var(--accent-primary)' }} />
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel panel-empty text-sm text-muted">
            No active quests. Head to the Quests lab to add some!
          </div>
        )}
      </div>

      {/* ── ARMY OF SHADOWS ── */}
      {shadows.length > 0 && (
        <div className="page-section">
          <div className="section-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} color="#a8a8ff" /> Army of Shadows (Passive Buffs)
            </div>
            <Link to="/collection" style={{ fontSize: "0.65rem", color: "#a8a8ff", textDecoration: "none", fontWeight: 800 }}>VIEW ARMY →</Link>
          </div>
          <div className="shadow-army-scroll">
            {shadows.map(s => {
              const color = s.rarity === 'Legendary' ? '#ffa500' : 
                            s.rarity === 'Epic' ? '#a8a8ff' : 
                            s.rarity === 'Rare' ? '#c4b5fd' : '#888';
              const rankLabel = s.rarity === 'Legendary' ? 'MARSHAL' : 
                                s.rarity === 'Epic' ? 'COMMANDER' : 
                                s.rarity === 'Rare' ? 'KNIGHT' : 'SOLDIER';
              
              const effType: 'shadow'|'flame'|'smoke'|'lightning' = 
                s.rarity === 'Legendary' ? 'flame' : 
                s.rarity === 'Epic' ? 'shadow' : 
                s.rarity === 'Rare' ? 'lightning' : 'smoke';

              return (
                <div key={s.id} style={{ width: 220, flexShrink: 0 }}>
                  <AuraCard 
                    name={s.name}
                    rankLabel={rankLabel}
                    rarityColor={color}
                    isCollected={true}
                    effectType={effType}
                    bonus={Math.round(s.bonus_value * 100)}
                    label="SHADOW"
                    icon={<Skull size={24} />}
                    sub={rankLabel}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AFFILIATIONS (Diplomatic Ties) ── */}
      {affiliations.length > 0 && (
        <div className="page-section">
          <div className="section-label">Guild & Clan • Diplomatic Ties</div>
          <div className="diplomacy-grid">
            {affiliations.map(a => (
              <div key={a.id + a.type} className="ds-glass diplomacy-card">
                <div className="dip-icon">{a.type === "guild" ? "🏛️" : "🛡️"}</div>
                <div className="dip-info">
                  <div className="dip-name">{a.name}</div>
                  <div className="dip-type">{a.type === "guild" ? "S-Rank Organization" : "Tactical Clan"}</div>
                </div>
                <div className="dip-role tag">{a.role}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── RECENT ACTIVITY ── */}
      {recentActivity.length > 0 && (
        <div className="page-section">
          <div className="section-label">System Logs • Battle Records</div>
          <div className="ds-glass battle-record-panel">
            {recentActivity.map(q => (
              <div key={q.id} className="battle-log-row">
                <div className="log-marker" />
                <div className="log-body">
                  <div className="log-title">{q.title}</div>
                  <div className="log-date">{q.completed_at ? new Date(q.completed_at).toLocaleDateString() : ""}</div>
                </div>
                <div className="log-xp">+{q.points} XP</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .dashboard-quest-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
        .db-quest-card {
          padding: 16px; border-radius: 14px; position: relative; overflow: hidden;
          cursor: pointer; transition: all 0.2s;
        }
        .db-quest-card:hover { background: rgba(255,255,255,0.06); transform: scale(1.01); }
        .db-quest-header { display: flex; gap: 14px; align-items: flex-start; }
        .db-quest-check { position: relative; width: 20px; height: 20px; margin-top: 2px; }
        .db-quest-check input { position: absolute; opacity: 0; cursor: pointer; }
        .check-custom { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.15); border-radius: 6px; }
        .db-quest-check input:checked ~ .check-custom { background: var(--accent-primary); border-color: var(--accent-primary); }
        
        .db-quest-info { flex: 1; }
        .db-quest-title { font-size: 0.9rem; font-weight: 800; color: var(--t1); margin-bottom: 6px; }
        .db-quest-meta { display: flex; gap: 8px; }
        .q-tag { font-size: 0.55rem; font-weight: 900; padding: 2px 6px; background: rgba(255,255,255,0.06); border-radius: 4px; text-transform: uppercase; color: var(--t3); }
        .xp-tag { color: var(--accent-primary); border: 1px solid rgba(168,168,255,0.15); }
        
        .db-quest-timer {
          margin-top: 12px; display: flex; align-items: center; gap: 6px;
          font-size: 0.65rem; font-weight: 800; color: #ff4d4d;
          background: rgba(255,77,77,0.08); padding: 4px 10px; border-radius: 8px; width: fit-content;
        }
        .db-quest-priority { position: absolute; top: 0; left: 0; width: 4px; bottom: 0; opacity: 0.6; }

        .shadow-army-scroll { display: flex; gap: 16px; overflow-x: auto; padding-bottom: 10px; scroll-snap-type: x mandatory; }
        .shadow-army-scroll > * { scroll-snap-align: start; }

        .battle-record-panel { padding: 8px; }
        .battle-log-row {
          display: flex; align-items: center; gap: 16px; padding: 14px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .battle-log-row:last-child { border: none; }
        .log-marker { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-primary); }
        .log-body { flex: 1; }
        .log-title { font-size: 0.85rem; font-weight: 700; color: var(--t2); }
        .log-date { font-size: 0.65rem; color: var(--t4); margin-top: 2px; }
        .log-xp { font-size: 0.75rem; font-weight: 900; color: var(--accent-primary); }

        .diplomacy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .diplomacy-card {
          display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: 16px;
          border: 1px solid rgba(255,255,255,0.04); transition: transform 0.2s;
        }
        .diplomacy-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.06); }
        .dip-icon { font-size: 1.5rem; }
        .dip-info { flex: 1; }
        .dip-name { font-size: 0.9rem; font-weight: 800; color: var(--t1); }
        .dip-type { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: var(--t4); margin-top: 2px; }
        .dip-role { font-size: 0.55rem; padding: 3px 8px; border-radius: 6px; background: rgba(168,168,255,0.1); color: var(--accent-primary); border: 1px solid rgba(168,168,255,0.2); }
      `}</style>
    </div>
  );
}
