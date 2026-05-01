import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Sparkles, Skull, Activity, Zap } from "lucide-react";
import { RaidTimer } from "../components/RaidTimer";

import { SystemAPI } from "../services/SystemAPI";
import type { DashboardData } from "../services/SystemAPI";
import { AuraCard } from "../components/AuraCard";


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
  const [showReawakening, setShowReawakening] = useState(false);
  const [redGateId, setRedGateId] = useState<string | null>(localStorage.getItem("redGateId"));
  
  const [isAbsoluteAuthority, setIsAbsoluteAuthority] = useState(false);
  const [marketValue, setMarketValue] = useState(0);
  const [data, setData] = useState<DashboardData>({
    activeCount: 0,
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    totalXp: 0, level: 1,
    weeklyHistory: [],
    monthlyHistory: [],
    categoryDistribution: [],
    player_rank: "E",
    player_title: "Newcomer",
    activeTasks: [],
    completedTasks: [],
    clanMembers: [],
    shadows: [],
    dark_mana: 0,
  });

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const userId = user.id;
    (async () => {
      try {
        const dashboardData = await SystemAPI.fetchDashboardData(userId);
        
        // Status / Heartbeat sweep
        let currentStatus = dashboardData.status || 'ACTIVE';
        const lastHeartbeat = dashboardData.last_heartbeat;
        const now = new Date();
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const heartbeatDate = lastHeartbeat ? new Date(lastHeartbeat) : null;

        if (currentStatus === 'ACTIVE') {
          if (heartbeatDate && heartbeatDate < fourteenDaysAgo) {
            currentStatus = 'DECEASED';
            await supabase.from("user_profiles").update({ status: 'DECEASED' }).eq("user_id", userId);
          } else {
            await supabase.from("user_profiles").update({ last_heartbeat: now.toISOString() }).eq("user_id", userId);
          }
        }

        if (currentStatus === 'DECEASED') setShowReawakening(true);

        // Task system sweep: recurring reset + overdue → pending
        const todayStr = now.toISOString().split("T")[0];
        const { data: allUserTasks } = await supabase.from("tasks").select("*").eq("user_id", userId);
        if (allUserTasks) {
          const expiredRecur = allUserTasks.filter(t => (t.is_completed || t.is_failed) && t.is_recurring && t.deadline && t.deadline < todayStr);
          if (expiredRecur.length > 0) {
            const { findNextValidDeadline } = await import("../lib/taskUtils");
            for (const task of expiredRecur) {
              const nextDeadline = findNextValidDeadline(task);
              await supabase.from("tasks").update({ is_completed: false, is_failed: false, is_pending: false, completed_at: null, deadline: nextDeadline }).eq("id", task.id);
            }
          }

          const overdue = allUserTasks.filter(t => !t.is_completed && !t.is_failed && !t.is_pending && t.deadline && t.deadline < todayStr);
          if (overdue.length > 0) {
            await supabase.from("tasks").update({ is_pending: true, is_completed: false, is_active: false }).in("id", overdue.map(t => t.id));
          }
        }

        // Build affiliations from SystemAPI data
        const affils: AffiliationRow[] = dashboardData.clanMembers.map((cm: any) => ({
          id: cm.clan_id,
          name: cm.clans?.name || "Unknown Clan",
          role: cm.role,
          type: "clan" as const,
        }));
        if (dashboardData.guild) {
          affils.push({
            id: dashboardData.guild.id,
            name: dashboardData.guild.name,
            role: dashboardData.guild_title || "Member",
            type: "guild",
          });
        }

        // Commit all state
        setData(dashboardData);
        setTasks(dashboardData.activeTasks as TaskRow[]);
        setRecentActivity(dashboardData.completedTasks as RecentActivityRow[]);
        setAffiliations(affils);
        setShadows(dashboardData.shadows);

        // Red Gate Auto-Selection (B-Rank or higher: High, Super, Legendary)
        const today = new Date().toDateString();
        const storedDate = localStorage.getItem("redGateDate");
        if (storedDate !== today) {
          localStorage.removeItem("redGateId");
          setRedGateId(null);
        }

        if (!localStorage.getItem("redGateId")) {
          const bPlusTasks = (dashboardData.activeTasks as TaskRow[]).filter(t => 
            ['High', 'Super', 'Legendary'].includes(t.xp_tier || '')
          );
          if (bPlusTasks.length > 0) {
            const picked = bPlusTasks[0].id;
            localStorage.setItem("redGateId", picked);
            localStorage.setItem("redGateDate", today);
            setRedGateId(picked);
          }
        }
        // Market Value Logic (Bid System)
        const bid = (dashboardData.level * 1000000) + (dashboardData.total_points * 10000) + ((dashboardData.streak_count || 0) * 500000);
        setMarketValue(bid);

        // Absolute Authority (Flow State) check
        const lastCompletions = JSON.parse(localStorage.getItem("lastCompletions") || "[]");
        if (lastCompletions.length >= 3) {
          const nowTime = Date.now();
          const threeTasksAgo = lastCompletions[0];
          if (nowTime - threeTasksAgo < 2 * 60 * 60 * 1000) {
            setIsAbsoluteAuthority(true);
          } else {
            setIsAbsoluteAuthority(false);
          }
        }

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    })();
  }, [user]);


  const completionRate = useMemo(()=>{
    const total = data.activeCount + data.completedCount;
    return total ? `${Math.round((data.completedCount/total)*100)}%` : "0%";
  },[data.activeCount, data.completedCount]);

  const weeklyTotal = useMemo(()=>data.weeklyHistory.reduce((s,d)=>s+(d.daily_points || 0),0),[data.weeklyHistory]);

  const toggleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
    if (!supabase) return;
    if (!isCompleted) {
      const now = Date.now();
      const lastCompletions = JSON.parse(localStorage.getItem("lastCompletions") || "[]");
      const updated = [...lastCompletions, now].slice(-3);
      localStorage.setItem("lastCompletions", JSON.stringify(updated));
    }
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, is_completed: !isCompleted } : t));
    await supabase.from("tasks").update({ is_completed: !isCompleted, completed_at: !isCompleted ? new Date().toISOString() : null }).eq("id", taskId);
  };

  const designateRedGate = (id: string) => {
    const today = new Date().toDateString();
    localStorage.setItem("redGateId", id);
    localStorage.setItem("redGateDate", today);
    setRedGateId(id);
    alert("SYSTEM: Task designated as RED GATE. Fail at your own peril.");
  };

  const handleArise = async () => {
    if (!supabase || !user) return;
    setShowReawakening(false);
    await supabase.from("user_profiles").update({ 
      status: 'ACTIVE', 
      last_heartbeat: new Date().toISOString(),
      reawakened_at: new Date().toISOString()
    }).eq("user_id", user.id);
  };

  return (
    <section className="page dashboard-page">
      <div className="tactical-overlay" />
      {/* ── TOP LEVEL BAR ── */}
      <div className="dashboard-section-header" style={{ marginBottom: 40 }}>
        <div className="flex-col">
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
          <div className="market-bid-badge" title="Hunter Market Value (Projected Contract)">
            BID: ₩{marketValue.toLocaleString()}
          </div>
        </div>
      </div>

      {isAbsoluteAuthority && (
        <div className="absolute-authority-banner">
          <Activity size={14} className="animate-pulse" />
          ABSOLUTE AUTHORITY ACTIVE: 1.5x XP RESONANCE
        </div>
      )}

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

        <div className="db-quantum-card ds-glass q-aura-red">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Failed Today</span>
            <span className="q-card-val">{data.failedCount}</span>
            <div className="q-card-footer">
              <span className="q-card-trend" style={{ color: '#ff4444' }}>MANA DECAY</span>
            </div>
          </div>
          <Skull size={32} className="q-card-icon" />
        </div>

        <div className={`db-quantum-card ds-glass ${data.dark_mana > 0 ? 'q-aura-blood' : 'q-aura-dim'}`}>
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Dark Mana Debt</span>
            <span className="q-card-val" style={{ color: data.dark_mana > 0 ? '#ff4444' : 'inherit' }}>
              {data.dark_mana}
            </span>
            <div className="q-card-footer">
              <span className="q-card-trend">{data.dark_mana > 0 ? 'SYSTEM CORRUPTION DETECTED' : 'DISCIPLINE STABLE'}</span>
            </div>
          </div>
          <Zap size={32} className="q-card-icon" style={{ color: data.dark_mana > 0 ? '#ff4444' : 'inherit' }} />
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
          border-radius: var(--r-xl);
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

        .q-aura-red { border: 1px solid rgba(239,68,68,0.15); }
        .q-aura-red .q-card-glow { background: radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%); }
        .q-aura-red .q-card-footer { color: #ff4444; }

        .q-aura-blood { border: 2px solid #ff4444; background: rgba(255,68,68,0.05); }
        .q-aura-blood .q-card-glow { background: radial-gradient(circle, rgba(255,68,68,0.2) 0%, transparent 70%); }
        .q-aura-blood .q-card-footer { color: #ff4444; font-weight: 900; animation: flash 1s infinite alternate; }
        .q-aura-dim { opacity: 0.5; border: 1px solid rgba(255,255,255,0.05); }
        @keyframes flash { from { opacity: 0.5; } to { opacity: 1; } }
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
                    { category:"Work",        value: data.categoryDistribution.find(c=>c.category==="Work")?.points||0,    fullMark:100 },
                    { category:"Fitness",     value: data.categoryDistribution.find(c=>c.category==="Fitness")?.points||0,  fullMark:100 },
                    { category:"Learning",    value: data.categoryDistribution.find(c=>c.category==="Learning")?.points||0,fullMark:100 },
                    { category:"Mind",        value: data.categoryDistribution.find(c=>c.category==="Mindfulness")?.points||0,fullMark:100 },
                    { category:"Finance",     value: data.categoryDistribution.find(c=>c.category==="Finance")?.points||0,fullMark:100 },
                    { category:"Social",      value: data.categoryDistribution.find(c=>c.category==="Social")?.points||0,fullMark:100 },
                    { category:"Creative",    value: data.categoryDistribution.find(c=>c.category==="Creative")?.points||0,fullMark:100 },
                    { category:"Academics",   value: data.categoryDistribution.find(c=>c.category==="Academics")?.points||0,fullMark:100 },
                    { category:"Errands",     value: data.categoryDistribution.find(c=>c.category==="Errands")?.points||0,fullMark:100 },
                    { category:"General",     value: data.categoryDistribution.find(c=>c.category==="General")?.points||0,fullMark:100 },
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
          border-radius: var(--r-lg);
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
          border-radius: var(--r-lg);
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
                className={`db-quest-card ds-glass ${task.is_completed ? 'quest-done' : ''} ${redGateId === task.id ? 'red-gate-mission' : ''}`}
                onClick={() => toggleTaskCompletion(task.id, task.is_completed)}
              >
                <div className="db-quest-header">
                  <div className="db-quest-check">
                    <input type="checkbox" checked={task.is_completed} readOnly />
                    <div className="check-custom"></div>
                  </div>
                  <div className="db-quest-info">
                    <div className="db-quest-title">
                      {task.title}
                      {redGateId === task.id && <span className="red-gate-tag">RED GATE</span>}
                    </div>
                    <div className="db-quest-meta">
                      {task.category && <span className="q-tag">{task.category}</span>}
                      {task.xp_tier && <span className="q-tag xp-tag">{task.xp_tier} XP</span>}
                      {redGateId !== task.id && ['High', 'Super', 'Legendary'].includes(task.xp_tier || '') && (
                          <button 
                            className="q-tag red-gate-btn"
                            onClick={(e) => { e.stopPropagation(); designateRedGate(task.id); }}
                          >
                            SELECT RED GATE
                          </button>
                        )}
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

      {/* ── ARMY OF SHADOWS (Tactical Overview) ── */}
      {shadows.length > 0 && (
        <div className="page-section">
          <div className="section-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Skull size={14} color="var(--monarch-purple)" /> Tactical Shadow Deployment
            </div>
            <Link to="/collection" className="monarch-link">OVERSEE COMMAND →</Link>
          </div>
          
          <div className="shadow-tactical-grid">
            {shadows.sort((a,b) => b.bonus_value - a.bonus_value).slice(0, 4).map(s => {
              const rankLabel = s.rarity === 'Legendary' ? 'GRAND MARSHAL' : 
                                s.rarity === 'Epic' ? 'COMMANDER' : 
                                s.rarity === 'Rare' ? 'KNIGHT' : 'ELITE';
              
              const color = s.rarity === 'Legendary' ? '#ffa500' : 
                            s.rarity === 'Epic' ? '#a8a8ff' : 
                            s.rarity === 'Rare' ? '#c4b5fd' : '#888';

              const effect = s.rarity === 'Legendary' ? 'flame' : 
                             s.rarity === 'Epic' ? 'shadow' : 
                             s.rarity === 'Rare' ? 'smoke' : 'smoke';

              return (
                <AuraCard
                  key={s.id}
                  name={s.name}
                  rankLabel={rankLabel}
                  rarityColor={color}
                  isCollected={true}
                  effectType={effect as any}
                  bonus={Math.round(s.bonus_value * 100)}
                  sub="Tactical Deployment"
                  className="tactical-aura-card"
                />
              );
            })}
            
            {shadows.length > 4 && (
              <Link to="/collection" className="tactical-shadow-more ds-glass">
                <div className="more-count">+{shadows.length - 4}</div>
                <div className="more-label">ADDITIONAL UNITS</div>
              </Link>
            )}
          </div>
        </div>
      )}

      <style>{`
        .monarch-link { font-size: 0.65rem; color: var(--accent-primary); text-decoration: none; fontWeight: 900; letter-spacing: 1px; }
        .monarch-link:hover { text-decoration: underline; }
        
        .shadow-tactical-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; margin-top: 16px; }
        
        .tactical-shadow-more {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          border-radius: var(--r-xl); text-decoration: none; border: 1px dashed rgba(255,255,255,0.1);
          min-height: 240px; background: rgba(255,255,255,0.02); transition: 0.3s;
        }
        .tactical-shadow-more:hover { background: rgba(255,255,255,0.05); border-color: var(--accent-primary); }
        .more-count { font-size: 1.8rem; font-weight: 950; color: var(--accent-primary); text-shadow: 0 0 15px var(--accent-glow); }
        .more-label { font-size: 0.6rem; font-weight: 800; opacity: 0.4; letter-spacing: 2px; text-transform: uppercase; }
      `}</style>

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
          padding: 16px; border-radius: var(--r-md); position: relative; overflow: hidden;
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

        .battle-record-panel { padding: 12px; border-radius: var(--r-xl); }
        .battle-log-row {
          display: flex; align-items: center; gap: 20px; padding: 18px 24px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: all 0.2s ease;
        }
        .battle-log-row:hover { background: rgba(255,255,255,0.02); }
        .battle-log-row:last-child { border: none; }
        .log-marker { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-primary); }
        .log-body { flex: 1; }
        .log-title { font-size: 0.85rem; font-weight: 700; color: var(--t2); }
        .log-date { font-size: 0.65rem; color: var(--t4); margin-top: 2px; }
        .log-xp { font-size: 0.75rem; font-weight: 900; color: var(--accent-primary); }

        .diplomacy-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
        .diplomacy-card {
          display: flex; align-items: center; gap: 16px; padding: 18px; border-radius: var(--r-lg);
          border: 1px solid rgba(255,255,255,0.04); transition: transform 0.2s;
        }
        .diplomacy-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.06); }
        .dip-icon { font-size: 1.5rem; }
        .dip-info { flex: 1; }
        .dip-name { font-size: 0.9rem; font-weight: 800; color: var(--t1); }
        .dip-type { font-size: 0.6rem; text-transform: uppercase; letter-spacing: 1px; color: var(--t4); margin-top: 2px; }
        .dip-role { font-size: 0.55rem; padding: 3px 8px; border-radius: 6px; background: rgba(168,168,255,0.1); color: var(--accent-primary); border: 1px solid rgba(168,168,255,0.2); }
        
        /* ══ REAWAKENING ══ */
        .reawakening-overlay {
          position: fixed; inset: 0; z-index: 10000;
          background: #000; display: flex; align-items: center; justify-content: center;
          animation: reawakenFade 1s ease;
        }
        @keyframes reawakenFade { from { opacity: 0; } to { opacity: 1; } }
        
        .reawakening-content { text-align: center; max-width: 400px; padding: 40px; }
        .reawakening-glitch {
          font-size: 0.8rem; font-weight: 950; letter-spacing: 8px; color: var(--accent-primary);
          margin-bottom: 40px; animation: glitchText 0.2s infinite;
        }
        @keyframes glitchText { 
          0% { transform: translate(0); }
          20% { transform: translate(-2px, 1px); }
          40% { transform: translate(2px, -1px); }
          60% { transform: translate(-2px, -1px); }
          80% { transform: translate(2px, 1px); }
          100% { transform: translate(0); }
        }
        
        .reawakening-skull { margin-bottom: 24px; color: var(--accent-primary); filter: drop-shadow(0 0 20px var(--accent-glow)); }
        .reawakening-content h2 { font-size: 1.8rem; font-weight: 950; margin-bottom: 12px; letter-spacing: 2px; }
        .reawakening-content p { color: var(--t3); font-size: 0.9rem; margin-bottom: 8px; line-height: 1.5; }
        .reawakening-hint { font-size: 0.7rem !important; opacity: 0.5; font-style: italic; margin-top: 20px !important; }
        
        .reawakening-btn {
          margin-top: 40px; background: none; border: 1px solid var(--accent-primary);
          color: var(--accent-primary); padding: 12px 40px; border-radius: 4px;
          font-weight: 900; cursor: pointer; letter-spacing: 4px; transition: 0.3s;
        }
        .reawakening-btn:hover { background: var(--accent-primary); color: #000; box-shadow: 0 0 30px var(--accent-glow); }

        /* ── RED GATE STYLES ── */
        .red-gate-mission {
          border: 1px solid rgba(255, 68, 68, 0.4) !important;
          background: linear-gradient(90deg, rgba(255, 68, 68, 0.05) 0%, rgba(0,0,0,0) 100%) !important;
          box-shadow: 0 0 15px rgba(255, 68, 68, 0.1);
        }
        .red-gate-tag {
          font-size: 0.6rem;
          font-weight: 900;
          color: #ff4444;
          background: rgba(255, 68, 68, 0.1);
          padding: 2px 6px;
          border-radius: 4px;
          margin-left: 8px;
          letter-spacing: 1px;
          border: 1px solid rgba(255, 68, 68, 0.3);
        }
        .red-gate-btn {
          background: rgba(255, 68, 68, 0.1) !important;
          color: #ff4444 !important;
          border: 1px solid rgba(255, 68, 68, 0.3) !important;
          cursor: pointer;
          transition: all 0.2s;
        }
        .red-gate-btn:hover {
          background: #ff4444 !important;
          color: #fff !important;
          box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
        }

        /* -- MARKET VALUE & AUTHORITY -- */
        .market-bid-badge {
          background: linear-gradient(135deg, #111 0%, #222 100%);
          border: 1px solid var(--accent-primary);
          color: var(--accent-primary);
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 900;
          font-size: 0.75rem;
          letter-spacing: 1px;
          box-shadow: 0 0 15px rgba(168, 168, 255, 0.2);
        }
        .absolute-authority-banner {
          background: rgba(168, 168, 255, 0.1);
          border: 1px solid var(--accent-primary);
          color: var(--accent-primary);
          padding: 8px 24px;
          border-radius: var(--r-lg);
          margin-bottom: 24px;
          font-size: 0.75rem;
          font-weight: 900;
          letter-spacing: 2px;
          display: flex;
          align-items: center;
          gap: 12px;
          animation: authorityPulse 2s infinite;
        }
        @keyframes authorityPulse {
          0%, 100% { box-shadow: 0 0 5px var(--accent-primary); border-color: rgba(168,168,255,0.4); }
          50% { box-shadow: 0 0 20px var(--accent-primary); border-color: var(--accent-primary); }
        }
        .dark-mana-badge {
          background: #000;
          color: #ff4444;
          border: 1px solid #ff4444;
          font-weight: 900;
          font-size: 0.75rem;
          letter-spacing: 1px;
          text-transform: uppercase;
          animation: darkPulse 1.5s infinite;
          box-shadow: 0 0 10px rgba(255, 68, 68, 0.2);
        }
        @keyframes darkPulse {
          0%, 100% { box-shadow: 0 0 5px #ff4444; opacity: 0.8; }
          50% { box-shadow: 0 0 15px #ff4444; opacity: 1; }
        }
      `}</style>
    </section>
  );
}
