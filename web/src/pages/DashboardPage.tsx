import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Sparkles, Skull, Swords, Gem } from "lucide-react";
import { AuraCard } from "../components/AuraCard";

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
          guildMembRes,
          shadowsRes,
        ] = await Promise.all([
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_completed",false).eq("is_pending",false).eq("is_failed",false),
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_completed",true),
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_pending",true).eq("is_completed",false),
          supabase.from("user_profiles").select("total_points,level,player_rank,player_title").eq("user_id",userId).maybeSingle(),
          supabase.from("user_points").select("date,daily_points").eq("user_id",userId).order("date",{ascending:true}).limit(7),
          supabase.from("user_points").select("date,daily_points").eq("user_id",userId).order("date",{ascending:true}).limit(30),
          supabase.from("tasks").select("category,points").eq("user_id",userId),
          supabase.from("tasks").select("id, title, is_completed, is_pending, is_failed, priority, xp_tier, category").eq("user_id",userId).eq("is_completed",false).eq("is_pending",false).order("created_at",{ascending:false}).limit(10),
          supabase.from("tasks").select("id, title, points, completed_at").eq("user_id",userId).eq("is_completed",true).order("completed_at",{ascending:false}).limit(5),
          supabase.from("clan_members").select("clan_id, clans(name, id), role").eq("user_id",userId),
          supabase.from("guild_members").select("guild_id, guilds(name, id), role").eq("user_id",userId),
          supabase.from("shadows").select("*").eq("user_id", userId),
        ]);

        // Build affiliations
        const affils: AffiliationRow[] = [];
        if (clanMembRes.data?.length) {
          (clanMembRes.data as any[]).forEach((m:any) => {
            if (m.clans) affils.push({ id: m.clans.id, name: m.clans.name, role: m.role, type: "clan" });
          });
        }
        if (guildMembRes.data?.length) {
          (guildMembRes.data as any[]).forEach((m:any) => {
            if (m.guilds) affils.push({ id: m.guilds.id, name: m.guilds.name, role: m.role, type: "guild" });
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
      <div className="dashboard-section-header">
        <div>
          <div className="dashboard-section-title">
            Hunter Dashboard <span className="rank-tag">[{data.player_rank}-Rank]</span>
          </div>
          <div className="dashboard-section-subtitle text-accent">
            {data.player_title}
          </div>
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

      {/* ── STAT CARDS ── */}
      <div className="stats-grid stats-grid-dashboard">
        <StatCard label="Active Quests"    value={data.activeCount}   subtitle="In progress" />
        <StatCard label="Pending"          value={data.pendingCount}  subtitle="Needs resolve" />
        <StatCard label="Completed"        value={data.completedCount} subtitle="All time" />
        <StatCard label="Weekly XP"        value={weeklyTotal}        subtitle="Points earned" />
        <StatCard label="Completion Rate"  value={completionRate}     subtitle="Success ratio" />
      </div>

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
        <div className="section-label">Ongoing Quests</div>
        
        {tasks.filter(t => !t.is_pending && !t.is_failed).length > 0 ? (
          <div className="glass-panel panel-no-pad">
            <div className="task-list">
              {tasks.filter(t => !t.is_pending && !t.is_failed).map(task => (
                <div key={task.id} className="task-row" onClick={() => toggleTaskCompletion(task.id, task.is_completed)}>
                  <input type="checkbox" checked={task.is_completed} title="Mark task complete" readOnly onClick={e=>e.stopPropagation()} onChange={() => toggleTaskCompletion(task.id, task.is_completed)} />
                  <span className={`task-row-title ${task.is_completed ? "done" : ""}`}>{task.title}</span>
                  <div className="task-row-meta">
                    {task.priority && task.priority !== "Normal" && task.priority !== "Low" && <span className={`tag${task.priority==="URGENT"?" tag-urgent":""}`}>{task.priority}</span>}
                    {task.xp_tier && task.xp_tier !== "Low" && <span className="tag">{task.xp_tier} XP</span>}
                    {task.category && <span className="tag">{task.category}</span>}
                  </div>
                </div>
              ))}
            </div>
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
            <Link to="/collection" style={{ fontSize: "0.65rem", color: "#a8a8ff", textDecoration: "none" }}>View Army →</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
            {shadows.map(s => {
              const color = s.rarity === 'Legendary' ? '#ffa500' : 
                            s.rarity === 'Epic' ? '#a8a8ff' : 
                            s.rarity === 'Rare' ? '#c4b5fd' : '#888';
              const rankLabel = s.rarity === 'Legendary' ? 'MARSHAL' : 
                                s.rarity === 'Epic' ? 'COMMANDER' : 
                                s.rarity === 'Rare' ? 'KNIGHT' : 'SOLDIER';
              
              // Map rarity to effect types for dashboard variety
              const effType: 'shadow'|'flame'|'smoke'|'lightning' = 
                s.rarity === 'Legendary' ? 'flame' : 
                s.rarity === 'Epic' ? 'shadow' : 
                s.rarity === 'Rare' ? 'lightning' : 'smoke';

              return (
                <AuraCard 
                  key={s.id}
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
              );
            })}
          </div>
        </div>
      )}

      {/* ── AFFILIATIONS ── */}
      {affiliations.length > 0 && (
        <div className="page-section">
          <div className="section-label">Guild &amp; Clan Affiliations</div>

          <div className="glass-panel">
            <div className="flex-col gap-10">
              {affiliations.map(a => (
                <div key={a.id + a.type} className="item-row">
                  <div className="flex gap-10" style={{ alignItems: "center" }}>
                    <span style={{ fontSize: "1.1rem" }}>{a.type === "guild" ? "🏛️" : "🛡️"}</span>
                    <div>
                      <div className="text-sm font-700">{a.name}</div>
                      <div className="text-xs text-muted">{a.type === "guild" ? "Guild" : "Clan"}</div>
                    </div>
                  </div>
                  <span className="tag" style={{ fontSize: "0.6rem", textTransform: "uppercase" }}>{a.role}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── RECENT ACTIVITY ── */}
      {recentActivity.length > 0 && (
        <div className="page-section">
          <div className="section-label">Recent Activity</div>
          <div className="glass-panel panel-no-pad">
            {recentActivity.map(q => (
              <div key={q.id} className="activity-row">
                <span className="activity-title">✓ {q.title}</span>
                <span className="activity-date">
                  {q.completed_at ? new Date(q.completed_at).toLocaleDateString() : ""}
                </span>
                <span className="activity-xp-tag">+{q.points} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
