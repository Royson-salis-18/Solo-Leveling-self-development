import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Sparkles, Skull, Activity, CheckCircle } from "lucide-react";
import { RaidTimer } from "../components/RaidTimer";
import { AuraCard } from "../components/AuraCard";
import { Modal } from "../components/Modal";
import { SeasonHUD } from "../components/SeasonHUD";
import { ZoneOverlay } from "../components/ZoneOverlay";
import { PlaymakerCard } from "../components/PlaymakerCard";

import { SystemAPI, type DashboardData } from "../services/SystemAPI";
import { calculatePlaymakerRating, evaluateWeeklySelection } from "../lib/levelEngine";


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
  points: number;
};

type AffiliationRow = { id: string; name: string; role: string; type: "clan" | "guild" };

type RecentActivityRow = {
  id: string;
  title: string;
  points: number;
  completed_at: string;
};



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
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);
  const [shadows, setShadows] = useState<any[]>([]);
  const [showReawakening, setShowReawakening] = useState(false);
  const [redGateId, setRedGateId] = useState<string | null>(localStorage.getItem("redGateId"));
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  
  const [isZoneActive, setIsZoneActive] = useState(false);
  const [marketValue, setMarketValue] = useState(0);
  const [weeklySelection, setWeeklySelection] = useState<any[]>([]);
  const [data, setData] = useState<DashboardData>({
    activeCount: 0,
    pendingCount: 0,
    completedCount: 0,
    failedCount: 0,
    totalXp: 0, level: 1,
    total_points: 0,
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
    current_mode: "Normal",
    ego_score: 0
  });

  useEffect(() => {
    if (!supabase || !user?.id) return;
    const userId = user.id;
    (async () => {
      try {
        await SystemAPI.manifestWeeklyTrial(userId);
        const dashboardData = await SystemAPI.fetchDashboardData(userId);
        
        // Mode Check (m1)
        if (!dashboardData.current_mode) {
          navigate('/mode-selection');
          return;
        }
        
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

        // Weekly Selection Calculation (bl4)
        const weeklyTop = evaluateWeeklySelection(dashboardData.completedTasks);
        setWeeklySelection(weeklyTop);

        // Playmaker Rating On-the-fly (bl6)
        if (dashboardData.playmaker_rating === 0 && dashboardData.completedCount > 0) {
          const avgXp = weeklyTop.reduce((acc, t) => acc + (t.points || 0), 0) / (weeklyTop.length || 1);
          const rating = calculatePlaymakerRating(dashboardData.completedCount, dashboardData.activeCount + dashboardData.completedCount, avgXp, dashboardData.streak_count || 0, dashboardData.ego_score || 0);
          setData(prev => ({ ...prev, playmaker_rating: rating }));
        }

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

        // Zone State (Flow State) check: 5 tasks in 90 min (bl2)
        const lastCompletions = JSON.parse(localStorage.getItem("lastCompletions") || "[]");
        if (lastCompletions.length >= 5) {
          const nowTime = Date.now();
          const fiveTasksAgo = lastCompletions[0];
          if (nowTime - fiveTasksAgo < 90 * 60 * 1000) {
            setIsZoneActive(true);
          } else {
            setIsZoneActive(false);
          }
        }

      } catch (err) {
        console.error("Dashboard fetch error:", err);
      }
    })();
  }, [user]);


  const completionRate = useMemo(() => {
    const total = data.activeCount + data.completedCount;
    if (total > 0) {
      return `${Math.round((data.completedCount / total) * 100)}%`;
    }

    // Fallback: when daily task counters are empty, infer "sync" from profile/category data.
    const totalCategoryPoints = data.categoryDistribution.reduce((sum, cat) => sum + (cat.points || 0), 0);
    if (totalCategoryPoints > 0) {
      const engagedCategories = data.categoryDistribution.filter((cat) => (cat.points || 0) > 0).length;
      const inferredSync = Math.min(100, Math.round((engagedCategories / 10) * 100));
      return `${inferredSync}%`;
    }

    return "0%";
  }, [data.activeCount, data.completedCount, data.categoryDistribution]);

  const weeklyTotal = useMemo(() => {
    const weekly = data.weeklyHistory.reduce((sum, day) => sum + (day.daily_points || 0), 0);
    return weekly > 0 ? weekly : data.totalXp;
  }, [data.weeklyHistory, data.totalXp]);

  const toggleTaskCompletion = async (taskId: string, isCompleted: boolean) => {
    if (!supabase) return;
    if (!isCompleted) {
      const now = Date.now();
      const lastCompletions = JSON.parse(localStorage.getItem("lastCompletions") || "[]");
      const updated = [...lastCompletions, now].slice(-5);
      localStorage.setItem("lastCompletions", JSON.stringify(updated));
    }
    setTasks(ts => ts.map(t => t.id === taskId ? { ...t, is_completed: !isCompleted } : t));
    await supabase.from("tasks").update({ is_completed: !isCompleted, completed_at: !isCompleted ? new Date().toISOString() : null }).eq("id", taskId);
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
      <SeasonHUD mode={data.current_mode || 'Normal'} darkMana={data.dark_mana} endDate={data.season_end_date || null} />
      <ZoneOverlay isActive={isZoneActive} onExit={() => setIsZoneActive(false)} />
      <div className="tactical-overlay" />
      {/* ── TOP LEVEL BAR ── */}
      <div className="page-header" style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 className="page-title" style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Hunter Dashboard</h2>
            <span style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>[{data.player_rank}-Rank]</span>
            <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginLeft: 8 }}>{data.current_mode?.toUpperCase()} MODE</span>
          </div>
          <p className="page-subtitle" style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '4px', marginTop: 8, opacity: 0.8 }}>{data.player_title}</p>
        </div>
        
        <div className="dashboard-action-group" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {data.status === 'PENALTY' && (
            <div className="penalty-mini-badge ds-glass" style={{ height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, border: '1px solid #ef4444', color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer' }} onClick={() => navigate('/dungeon-gate')}>
               <Skull size={14} className="animate-pulse" /> PENALTY ACTIVE
            </div>
          )}
          <div className="badge" style={{ height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '1px', opacity: 0.6 }}>
            LVL {data.level}
          </div>
          <div className="badge" style={{ height: 32, padding: '0 12px', display: 'flex', alignItems: 'center', borderRadius: 6, border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', background: 'rgba(168,168,255,0.05)', fontSize: '0.65rem', fontWeight: 800 }}>
            {data.totalXp.toLocaleString()} MANA
          </div>
        </div>
      </div>

      {/* ── MONARCH TRANSMISSION (QUOTE) ── */}
      {(() => {
        const messages = [
          { tag: "RAGNAROK", title: "Divine Bloodline: Su-ho's Era", text: "The power of the Monarch flows through his son. The new age has arrived." },
          { tag: "SYSTEM", title: "Absolute Authority", text: "Survival is the only law. Your strength is the only currency." },
          { tag: "ASHBORN", title: "Eternal Rest", text: "The shadows do not fear death. They are death. Arise." },
          { tag: "MONARCH", title: "The World is a Game", text: "Play it by your own rules. Every level gained is a reality conquered." },
          { tag: "SYSTEM", title: "Absolute Will", text: "A Monarch's will is absolute. Let your discipline be the hammer that shapes it." },
          { tag: "ASHBORN", title: "Limitless Potential", text: "The only limit is the one you set yourself. Break the chains of mediocrity." },
          { tag: "SYSTEM", title: "The Hunt Evolved", text: "The hunt never ends. It only evolves. Your shadows are waiting for your command." },
          { tag: "MONARCH", title: "Taken, Not Given", text: "Strength is not granted. It is taken through the cold fire of daily discipline." },
          { tag: "SYSTEM", title: "The Sovereign's Path", text: "The system chose you for a reason. Every task completed proves it right." },
          { tag: "ASHBORN", title: "Shadow Birth", text: "Shadows are born from the intense light of your focus. Shine brighter." },
          { tag: "MONARCH", title: "Evolution or Extinction", text: "Stagnation is death. Each dawn is a mission to surpass the version of you that slept." },
          { tag: "SYSTEM", title: "Critical Resonance", text: "Your momentum is creating a rift in the mundane. Maintain absolute focus." },
          { tag: "ASHBORN", title: "Kingdom of Shadows", text: "You do not build a kingdom with wishes. You build it with the souls of conquered fears." }
        ];
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const msg = messages[dayOfYear % messages.length];

        return (
          <div className="monarch-transmission ds-glass" style={{ 
            marginBottom: 32, 
            padding: '18px 48px', 
            borderRadius: 100, 
            border: '1px solid rgba(168,168,255,0.25)', 
            background: 'linear-gradient(90deg, rgba(26,26,46,0.95) 0%, rgba(0,0,0,1) 100%)', 
            position: 'relative', 
            overflow: 'hidden', 
            boxShadow: '0 15px 50px rgba(0,0,0,0.8), 0 0 35px rgba(168,168,255,0.18), inset 0 1px 2px rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: 24
          }}>
            <div style={{ 
              width: 52, 
              height: 52, 
              borderRadius: 16, 
              background: 'rgba(168,168,255,0.03)', 
              border: '1px solid rgba(168,168,255,0.1)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Sparkles size={24} color="var(--accent-primary)" style={{ opacity: 0.6 }} />
            </div>

            <div className="monarch-quote__meta" style={{ flex: 1, position: 'relative', zIndex: 2 }}>
              <div className="monarch-quote__label" style={{ fontSize: '0.55rem', fontWeight: 950, color: 'var(--accent-primary)', letterSpacing: '3px', marginBottom: 2, opacity: 0.7, textTransform: 'uppercase' }}>
                {msg.tag} TRANSMISSION
              </div>
              <div className="monarch-quote__title" style={{ fontSize: '1.4rem', fontWeight: 950, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>{msg.title}</div>
              <div className="monarch-quote__sub" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80%' }}>
                {msg.text}
              </div>
            </div>
            
            {/* ── AURACARD-STYLE WATERMARK SKULL ── */}
            <div className="monarch-quote__skull" style={{ 
              position: 'absolute', 
              right: 12, 
              top: -24, 
              transform: 'rotate(20deg)', 
              opacity: 0.38, 
              pointerEvents: 'none',
              filter: 'drop-shadow(0 0 16px rgba(168,168,255,0.35))'
            }}>
              <Skull size={110} color="var(--accent-primary)" strokeWidth={1.8} />
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
        {/* ── Weekly Activity Threshold (V5 Premium) ── */}
        <div className="panel ds-glass sovereign-panel" style={{ background: "linear-gradient(135deg, rgba(30,30,60,0.2) 0%, rgba(10,10,25,0.2) 100%)", border: "1px solid rgba(168,168,255,0.12)", padding: '24px 32px', borderRadius: 24, boxShadow: '0 16px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
             <div>
               <h3 style={{ fontSize: "0.7rem", fontWeight: 950, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "3px", margin: '0 0 4px 0', opacity: 0.8 }}>
                 🛡️ Weekly Activity Threshold
               </h3>
               <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
                 {weeklyTotal} <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>/ 300 XP</span>
               </div>
             </div>
             <span style={{ fontSize: '0.75rem', fontWeight: 900, color: weeklyTotal >= 300 ? '#34d399' : '#fbbf24', background: weeklyTotal >= 300 ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', padding: '4px 10px', borderRadius: 6, border: `1px solid ${weeklyTotal >= 300 ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
               {weeklyTotal >= 300 ? 'STABLE' : 'STAGNATION RISK'}
             </span>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
             <div className="sovereign-progress-fill" style={{ 
               height: '100%', 
               width: `${Math.min(100, (weeklyTotal / 300) * 100)}%`, 
               background: weeklyTotal >= 300 ? 'linear-gradient(90deg, #34d399, #10b981)' : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
               boxShadow: weeklyTotal >= 300 ? '0 0 15px rgba(52,211,153,0.5)' : '0 0 15px rgba(251,191,36,0.5)',
               transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
             }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="text-muted" style={{ fontSize: "0.6rem", fontWeight: 700, opacity: 0.5, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              V5 Rule: C-Rank+ Only
            </p>
            {weeklyTotal < 300 && (
              <span className="animate-pulse" style={{ fontSize: '0.6rem', color: '#fbbf24', fontWeight: 800 }}>+{(300 - weeklyTotal)} XP REQUIRED</span>
            )}
          </div>
        </div>

        {/* ── System Log Panel (V5 Terminal) ── */}
        <div className="panel ds-glass terminal-log" style={{ background: "rgba(10,10,20,0.4)", border: "1px solid rgba(255,255,255,0.08)", padding: '24px', borderRadius: 24, fontFamily: "'JetBrains Mono', monospace", position: 'relative', overflow: 'hidden' }}>
          <div className="terminal-header" style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f' }} />
            <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', marginLeft: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>System_Core_V5.0</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: "0.7rem", color: "rgba(168,168,255,0.7)" }}>
            <div className="log-line"><span style={{ color: 'var(--accent-primary)' }}>&gt;</span> Manifestations: Permanent.</div>
            <div className="log-line"><span style={{ color: 'var(--accent-primary)' }}>&gt;</span> Mode: {data.current_mode} Activated.</div>
            <div className="log-line"><span style={{ color: 'var(--accent-primary)' }}>&gt;</span> Arise: B-Rank+ Protocol.</div>
            <div className="log-line"><span style={{ color: 'var(--accent-primary)' }}>&gt;</span> Penalty: Dark Mana decay.</div>
          </div>
          <div className="terminal-scanline" />
        </div>
      </div>

      {isZoneActive && (
        <div className="absolute-authority-banner">
          <Activity size={14} className="animate-pulse" />
          ZONE STATE ACTIVE: 2.5x XP RESONANCE
        </div>
      )}



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

        <div className="db-quantum-card ds-glass q-aura-blue">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Contract Valuation</span>
            <span className="q-card-val">₩{(marketValue / 1000000).toFixed(1)}M</span>
            <div className="q-card-footer">
              <span className="q-card-trend">MARKET CAP RISING</span>
            </div>
          </div>
          <Skull size={32} className="q-card-icon" />
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

        {data.failedCount > 0 && (
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
        )}

        <div className="db-quantum-card ds-glass q-aura-blue">
          <div className="q-card-glow" />
          <div className="q-card-content">
            <span className="q-card-lbl">Ego Score</span>
            <span className="q-card-val">{data.ego_score}</span>
            <div className="q-card-footer">
              <span className="q-card-trend">STRENGTHENING EGO...</span>
            </div>
          </div>
          <Activity size={32} className="q-card-icon" />
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
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }
        .db-quantum-card:hover { 
          transform: translateY(-8px) scale(1.05); 
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
          z-index: 10;
        }
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
        
        .q-aura-blue { border: 1px solid rgba(59,130,246,0.15); }
        .q-aura-blue .q-card-glow { background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%); }
        .q-aura-blue .q-card-footer { color: #3b82f6; }

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
          <div className="section-label">Strategic Analytics</div>
          <div className="dashboard-panels-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 20, alignItems: "stretch" }}>
            
            {/* 30-Day XP Trend */}
            {data.monthlyHistory.length > 0 && (
              <div className="glass-panel ds-glass" style={{ padding: 32, background: 'rgba(255,255,255,0.01)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="chart-label-wrapper" style={{ marginBottom: 24 }}>
                  <span className="chart-label-text" style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>30-Day Momentum</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--accent-primary)", marginLeft: 16 }}>{data.monthlyHistory.length} DAYS SCANNED</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={data.monthlyHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="rgba(168,168,255,0.3)" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="rgba(168,168,255,0.05)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} interval={Math.floor(data.monthlyHistory.length/6)} />
                    <YAxis stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Area type="monotone" dataKey="daily_points" stroke="var(--accent-primary)" strokeWidth={2} fill="url(#xpGrad)" dot={false} activeDot={{ r: 5, fill: "var(--accent-primary)" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Category XP Bar */}
            {data.categoryDistribution.length > 0 && (
              <div className="glass-panel ds-glass" style={{ padding: 32, background: 'rgba(255,255,255,0.01)', borderRadius: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="chart-label-wrapper" style={{ marginBottom: 24 }}>
                  <span className="chart-label-text" style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Resource Allocation</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={data.categoryDistribution
                      .map(c => ({ ...c, weighted: c.points }))
                      .sort((a,b) => b.weighted - a.weighted)
                    }
                    margin={{ top: 4, right: 4, bottom: 20, left: -20 }}
                    barSize={24}
                  >
                    <XAxis dataKey="category" stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.3)" }} tickLine={false} axisLine={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="weighted" radius={[6,6,0,0]}>
                      {data.categoryDistribution.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Playmaker Card (u1) */}
            <PlaymakerCard 
              rating={data.playmaker_rating || 0} 
              topTasks={weeklySelection} 
              streak={data.streak_count || 0} 
              onViewAnalytics={() => setShowAnalyticsModal(true)}
            />
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
          <div className="dashboard-quest-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
            {tasks.filter(t => !t.is_pending && !t.is_failed).map(task => (
              <div 
                key={task.id} 
                className={`db-quest-card-v5 ds-glass ${task.is_completed ? 'quest-done' : ''} ${redGateId === task.id ? 'red-gate-active' : ''}`}
                style={{ 
                  padding: '24px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)',
                  display: 'flex', flexDirection: 'column', gap: 16, transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', position: 'relative', overflow: 'hidden'
                }}
                onClick={() => toggleTaskCompletion(task.id, task.is_completed)}
              >
                <div className="db-quest-glow" />
                <div className="db-quest-header" style={{ display: 'flex', gap: 16, alignItems: 'flex-start', position: 'relative', zIndex: 2 }}>
                  <div className="db-quest-check-v5">
                    <input type="checkbox" checked={task.is_completed} readOnly />
                    <div className="check-v5-box">
                      {task.is_completed && <CheckCircle size={14} color="#fff" />}
                    </div>
                  </div>
                  <div className="db-quest-info" style={{ flex: 1 }}>
                    <div className="db-quest-title-v5" style={{ fontSize: '1.05rem', fontWeight: 850, marginBottom: 6, color: task.is_completed ? 'rgba(255,255,255,0.3)' : '#fff', letterSpacing: '-0.2px' }}>
                      {task.title}
                    </div>
                    <div className="db-quest-meta-v5" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                      <span className="q-tag-v5" style={{ fontSize: '0.6rem', padding: '3px 8px', background: 'rgba(255,255,255,0.04)', borderRadius: 6, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>{task.category}</span>
                      <span className="q-tag-v5 xp-aura" style={{ fontSize: '0.65rem', padding: '3px 10px', background: 'rgba(168,168,255,0.08)', color: 'var(--accent-primary)', borderRadius: 6, fontWeight: 900, border: '1px solid rgba(168,168,255,0.2)' }}>+{task.points} XP</span>
                      {redGateId === task.id && <span className="red-tag-v5" style={{ fontSize: '0.6rem', fontWeight: 950, padding: '3px 10px', background: 'rgba(255,68,68,0.15)', color: '#ff4444', borderRadius: 6, border: '1px solid rgba(255,68,68,0.3)', letterSpacing: '1px' }}>RED GATE</span>}
                    </div>
                  </div>
                </div>
                
                {task.is_active && task.started_at && (
                  <div className="db-quest-footer-v5" style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 2 }}>
                    <div className="active-raid-badge" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)', fontWeight: 900 }}>
                      <Activity size={14} className="animate-pulse" />
                      <RaidTimer startedAt={task.started_at} />
                    </div>
                    <span style={{ fontSize: '0.6rem', opacity: 0.3, fontWeight: 800 }}>RAID_IN_PROGRESS</span>
                  </div>
                )}
                
                <div className="db-quest-priority-v5" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: task.priority === 'URGENT' ? '#ff4d4d' : 'transparent', boxShadow: task.priority === 'URGENT' ? '0 0 10px #ff4d4d' : 'none' }} />
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

      {showReawakening && (
        <div className="reawakening-overlay">
          <div className="reawakening-content">
            <div className="reawakening-glitch">CRITICAL_SYSTEM_FAILURE</div>
            <Skull size={80} className="reawakening-skull" />
            <h2>YOU HAVE DIED</h2>
            <p>Your heartbeat ceased to resonate with the System.</p>
            <p className="reawakening-hint">The Monarch does not permit such a pathetic end.</p>
            
            <button className="reawakening-btn" onClick={handleArise}>
              ARISE
            </button>
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

        /* ── V5 PREMIUM STYLES ── */
        .sovereign-panel {
          position: relative;
          overflow: hidden;
        }
        .sovereign-panel::after {
          content: ''; position: absolute; top: -50%; right: -50%; width: 100%; height: 100%;
          background: radial-gradient(circle, rgba(168,168,255,0.05) 0%, transparent 70%);
          pointer-events: none;
        }
        .sovereign-progress-fill {
          position: relative;
        }
        .sovereign-progress-fill::after {
          content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: barShimmer 2s infinite;
        }
        @keyframes barShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        .db-quest-card-v5 {
          cursor: pointer;
          position: relative;
        }
        .db-quest-card-v5:hover {
          background: rgba(255,255,255,0.04) !important;
          border-color: rgba(168,168,255,0.2) !important;
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        .db-quest-glow {
          position: absolute; inset: 0; 
          background: radial-gradient(circle at var(--x, 50%) var(--y, 50%), rgba(168,168,255,0.05) 0%, transparent 60%);
          opacity: 0; transition: opacity 0.3s;
        }
        .db-quest-card-v5:hover .db-quest-glow { opacity: 1; }
        
        .db-quest-check-v5 {
          position: relative; width: 22px; height: 22px;
        }
        .db-quest-check-v5 input { position: absolute; opacity: 0; cursor: pointer; width: 100%; height: 100%; z-index: 2; }
        .check-v5-box {
          width: 22px; height: 22px; border: 2px solid rgba(255,255,255,0.1); border-radius: 8px;
          display: flex; align-items: center; justify-content: center; transition: all 0.2s;
        }
        .db-quest-check-v5 input:checked ~ .check-v5-box {
          background: var(--accent-primary); border-color: var(--accent-primary);
          box-shadow: 0 0 10px var(--accent-glow);
        }
        
        .red-gate-active {
          border: 1px solid rgba(255, 68, 68, 0.3) !important;
          background: linear-gradient(135deg, rgba(255, 68, 68, 0.08) 0%, rgba(10,10,10,0.1) 100%) !important;
          box-shadow: 0 0 20px rgba(255, 68, 68, 0.15);
        }
        .red-gate-active::before {
          content: 'CRITICAL'; position: absolute; top: 12px; right: -25px;
          background: #ff4444; color: #fff; font-size: 0.5rem; font-weight: 900;
          padding: 2px 30px; transform: rotate(45deg); letter-spacing: 1px;
        }

        .xp-aura {
          box-shadow: 0 0 10px rgba(168,168,255,0.1);
          transition: 0.3s;
        }
        .db-quest-card-v5:hover .xp-aura {
          box-shadow: 0 0 20px rgba(168,168,255,0.3);
          border-color: var(--accent-primary);
        }

        .terminal-log {
          box-shadow: inset 0 0 20px rgba(0,0,0,0.5);
        }
        .log-line {
          position: relative;
          z-index: 2;
        }
        .terminal-scanline {
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, transparent, rgba(168,168,255,0.03) 50%, transparent);
          background-size: 100% 4px;
          pointer-events: none;
          animation: terminalScan 4s linear infinite;
        }
        @keyframes terminalScan {
          from { transform: translateY(-100%); }
          to { transform: translateY(100%); }
        }
      `}</style>
      {showAnalyticsModal && (
        <Modal
          isOpen={showAnalyticsModal}
          onClose={() => setShowAnalyticsModal(false)}
          title="DEEP DIVE: SYSTEM ANALYTICS"
        >
          <div className="analytics-deep-dive">
            <div className="analytics-grid-detailed">
              {/* Left Column: Factor Breakdown */}
              <div className="analytics-factor-column">
                <div className="section-label" style={{ marginBottom: 12 }}>Performance Decomposition</div>
                <div className="radar-container-detailed ds-glass">
                   <PerformanceRadar 
                     data={[
                       { category: "Consistency", value: Math.min(100, (data.streak_count || 0) * 5), fullMark: 100 },
                       { category: "Complexity", value: Math.min(100, (data.total_points / 500) * 10), fullMark: 100 },
                       { category: "Ego Sync", value: data.ego_score || 0, fullMark: 100 },
                       { category: "Lethality", value: (data.completedCount / (data.activeCount + data.completedCount || 1)) * 100, fullMark: 100 },
                       { category: "Volume", value: Math.min(100, data.completedCount * 10), fullMark: 100 }
                     ]}
                     height={250}
                   />
                </div>
                
                <div className="analytics-factor-list">
                   <div className="factor-item">
                     <span>Streak Multiplier</span>
                     <strong>x{(1 + (data.streak_count || 0) * 0.05).toFixed(2)}</strong>
                   </div>
                   <div className="factor-item">
                     <span>Market Credibility</span>
                     <strong>{(data.playmaker_rating || 0) > 80 ? 'HIGH' : 'STABLE'}</strong>
                   </div>
                </div>
              </div>

              {/* Right Column: Growth & Projections */}
              <div className="analytics-projection-column">
                <div className="section-label" style={{ marginBottom: 12 }}>Growth Projections</div>
                <div className="projection-card ds-glass">
                   <h3>Contract Valuation</h3>
                   <div className="valuation-val">₩{marketValue.toLocaleString()}</div>
                   <p className="valuation-hint">Projected annual contract value based on current mana density and streak stability.</p>
                </div>

                <div className="milestone-tracker">
                   <div className="section-label">Next Rank Evaluation</div>
                   <div className="milestone-progress-bar">
                      <div className="milestone-fill" style={{ width: `${(data.total_points % 500) / 5}%` }} />
                   </div>
                   <div className="milestone-meta">
                      <span>{500 - (data.total_points % 500)} XP to Next Level</span>
                      <span>{Math.round((data.total_points % 500) / 5)}%</span>
                   </div>
                </div>
              </div>
            </div>

            <div className="system-recommendation ds-glass">
               <div className="rec-header">
                 <Sparkles size={16} color="var(--accent-primary)" />
                 <span>SYSTEM_RECOMMENDATION</span>
               </div>
               <p>
                 {(data.playmaker_rating || 0) < 50 ? 
                   "Your performance is inconsistent. Prioritize low-rank gates to rebuild your streak and stabilize your mana flow." :
                   data.pendingCount > 0 ?
                   "Awaiting resolution on overdue gates. Stagnation detected. Resolve pending missions to prevent further mana decay." :
                   "Peak performance detected. Consider challenging a RED GATE to accelerate your growth and unlock advanced extractions."
                 }
               </p>
            </div>
          </div>
          
          <style>{`
            .analytics-deep-dive { display: flex; flex-direction: column; gap: 24px; padding: 10px; }
            .analytics-grid-detailed { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }
            .radar-container-detailed { padding: 20px; border-radius: 12px; display: flex; justify-content: center; background: rgba(0,0,0,0.2); }
            .analytics-factor-list { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
            .factor-item { display: flex; justify-content: space-between; font-size: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; }
            .factor-item span { opacity: 0.6; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
            .factor-item strong { color: var(--accent-primary); font-weight: 900; }
            
            .projection-card { padding: 24px; border-radius: 12px; text-align: center; background: linear-gradient(135deg, rgba(168,168,255,0.05) 0%, transparent 100%); }
            .projection-card h3 { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 2px; opacity: 0.5; margin-bottom: 12px; }
            .valuation-val { font-size: 2.4rem; font-weight: 950; color: #fff; margin-bottom: 8px; letter-spacing: -1px; }
            .valuation-hint { font-size: 0.65rem; opacity: 0.4; line-height: 1.4; }
            
            .milestone-tracker { margin-top: 24px; }
            .milestone-progress-bar { height: 6px; background: rgba(255,255,255,0.05); border-radius: 99px; overflow: hidden; margin: 12px 0 8px; }
            .milestone-fill { height: 100%; background: var(--accent-primary); box-shadow: 0 0 10px var(--accent-glow); transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }
            .milestone-meta { display: flex; justify-content: space-between; font-size: 0.65rem; font-weight: 700; opacity: 0.5; }
            
            .system-recommendation { padding: 20px; border-radius: 12px; border-left: 3px solid var(--accent-primary); background: rgba(168,168,255,0.02); }
            .rec-header { display: flex; align-items: center; gap: 10px; font-size: 0.7rem; font-weight: 900; letter-spacing: 2px; margin-bottom: 10px; opacity: 0.8; }
            .system-recommendation p { font-size: 0.85rem; line-height: 1.6; opacity: 0.7; font-style: italic; }
            
            @media (max-width: 768px) {
              .analytics-grid-detailed { grid-template-columns: 1fr; }
            }
          `}</style>
        </Modal>
      )}
    </section>
  );
}
