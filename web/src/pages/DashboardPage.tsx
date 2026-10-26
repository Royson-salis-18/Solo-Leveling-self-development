import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngagementPanel } from "../components/EngagementPanel";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, AreaChart, Area, CartesianGrid,
} from "recharts";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useGameActions } from "../lib/gameActions";
import { Sparkles, Skull, Activity, CheckCircle, Brain, Dumbbell, Zap, Hammer } from "lucide-react";
import { RaidTimer } from "../components/RaidTimer";
import { AuraCard } from "../components/AuraCard";
import { Modal } from "../components/Modal";
import { SeasonHUD } from "../components/SeasonHUD";
import { ZoneOverlay } from "../components/ZoneOverlay";
import { PlaymakerCard } from "../components/PlaymakerCard";
import { PageSkeleton } from "../components/PageSkeleton";
import { hasSupabaseConfig } from "../lib/supabase";

import { SystemAPI, type DashboardData } from "../services/SystemAPI";
import { evaluateWeeklySelection, TIER_POINTS } from "../lib/levelEngine";

/** What each tier is actually worth (the server derives XP from the tier, never from the client). */
const TIER_XP: Record<string, number> = TIER_POINTS;


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
const EMPTY_DASHBOARD: DashboardData = {
  activeCount: 0, pendingCount: 0, completedCount: 0, failedCount: 0,
  totalXp: 0, total_points: 0, spent_xp: 0, standing_xp: 0, level: 1, streak_count: 0,
  weeklyHistory: [], monthlyHistory: [], categoryDistribution: [],
  player_rank: "E", player_title: "Newcomer", status: "ACTIVE",
  activeTasks: [], completedTasks: [], clanMembers: [], shadows: [],
  dark_mana: 0, current_mode: "Normal", ego_score: 0, playmaker_rating: 0,
  timezone: "UTC", needs_mode_selection: false, weekly_xp: 0, weekly_target: null,
  flow: { count: 0, active: false },
  domain_physical: 10, domain_mind: 14, domain_soul: 10, domain_execution: 12, domain_builder: 13,
};

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const game = useGameActions();

  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityRow[]>([]);
  const [affiliations, setAffiliations] = useState<AffiliationRow[]>([]);
  const [shadows, setShadows] = useState<any[]>([]);
  const [redGateId, setRedGateId] = useState<string | null>(localStorage.getItem("redGateId"));
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [zoneDismissed, setZoneDismissed] = useState(false);
  const [weeklySelection, setWeeklySelection] = useState<any[]>([]);
  const [data, setData] = useState<DashboardData>(EMPTY_DASHBOARD);
  const [loaded, setLoaded] = useState(false);
  const busyIds = useRef(new Set<string>());

  const isZoneActive = data.flow.active && !zoneDismissed;
  const showReawakening = data.status === "DECEASED";

  /**
   * One round trip. The server runs the daily tick (decay, streak, overdue/recurring sweeps,
   * status) and returns the whole snapshot — this used to be ~25 sequential requests plus a
   * `select *` over every task the user had ever created, re-run after every click.
   */
  const loadData = useCallback(async () => {
    if (!user?.id) { if (!hasSupabaseConfig) setLoaded(true); return; }   // no backend: preview shell
    try {
      const d = await SystemAPI.fetchDashboardData();
      if (d.profile_missing) return;
      if (d.needs_mode_selection) { navigate("/mode-selection", { replace: true }); return; }

      const affils: AffiliationRow[] = d.clanMembers.map((cm: any) => ({
        id: cm.clan_id, name: cm.clans?.name || "Unknown Clan", role: cm.role, type: "clan" as const,
      }));
      if (d.guild) affils.push({ id: d.guild.id, name: d.guild.name, role: d.guild_title || "Member", type: "guild" });

      setData(d);
      setTasks(d.activeTasks as TaskRow[]);
      setRecentActivity(d.completedTasks as RecentActivityRow[]);
      setAffiliations(affils);
      setShadows(d.shadows);
      setWeeklySelection(evaluateWeeklySelection(d.completedTasks));
      if (!d.flow.active) setZoneDismissed(false);

      // "Red Gate of the day": a B-rank+ gate picked once per calendar day (cosmetic, stays local).
      const today = new Date().toDateString();
      if (localStorage.getItem("redGateDate") !== today) {
        localStorage.removeItem("redGateId");
        setRedGateId(null);
      }
      if (!localStorage.getItem("redGateId")) {
        const pick = (d.activeTasks as TaskRow[]).find((t) => ["High", "Super", "Legendary"].includes(t.xp_tier || ""));
        if (pick) {
          localStorage.setItem("redGateId", pick.id);
          localStorage.setItem("redGateDate", today);
          setRedGateId(pick.id);
        }
      }
    } catch (err) {
      toast.fail(err, "Could not load your dashboard");
    } finally {
      setLoaded(true);
    }
  }, [user?.id, navigate, toast]);

  useEffect(() => { void loadData(); }, [loadData]);

  // Rigid market value (beginners start at 0). Pure display maths on public numbers.
  const marketValue = useMemo(() => {
    const base = ({ S: 500_000_000, A: 100_000_000, B: 25_000_000, C: 5_000_000, D: 500_000 } as Record<string, number>)[data.player_rank] ?? 0;
    return base + Math.max(0, data.level - 1) * 100_000 + data.standing_xp * 1_000 + data.streak_count * 50_000;
  }, [data.player_rank, data.level, data.standing_xp, data.streak_count]);

  const [ariseLoadingId, setAriseLoadingId] = useState<string | null>(null);

  const systemDirectives = useMemo(() => {
    return {
      Physical: [
        {
          title: "🏋️ Gravity Chamber: High-Intensity Interval Training",
          category: "Fitness",
          xp_tier: "Mid",
          points: 15,
          priority: "High",
          description: "Perform a 20-minute bodyweight circuit (pushups, squats, planks) to forge your vessel's strength."
        },
        {
          title: "🥗 Elixir of Life: Metabolic Restoration",
          category: "Health",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Prep a nutrient-dense, high-protein meal and hydrate with 1L of water. Stabilize your cellular integrity."
        },
        {
          title: "❄️ Monarch's Vigil: Awakening Habit",
          category: "Personal Development",
          xp_tier: "Mid",
          points: 20,
          priority: "High",
          description: "Commit to a cold exposure challenge or complete a crucial difficult task early tomorrow."
        }
      ],
      Mind: [
        {
          title: "📖 Arcane Archives: Deep Study Phase",
          category: "Learning",
          xp_tier: "Mid",
          points: 20,
          priority: "High",
          description: "Dedicate 45 minutes of uninterrupted focus to learning a complex skill, programming concept, or research paper."
        },
        {
          title: "💰 Tactical Assessment: Financial Ledger Audit",
          category: "Finance",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Map out your monthly budget, audit recent expenses, and check long-term investment resonance."
        },
        {
          title: "💼 Monarch's Strategy: High-Priority Sprint",
          category: "Work",
          xp_tier: "Mid",
          points: 15,
          priority: "High",
          description: "Execute a 60-minute deep-work session focusing solely on your highest-impact professional task."
        }
      ],
      Soul: [
        {
          title: "🧘 Cartenon Meditation: Inner Mana Stabilization",
          category: "Mindfulness",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Unplug from all devices for 15 minutes. Practice deep rhythmic breathing and write in your journal."
        },
        {
          title: "🤝 Diplomatic Alliance: Connection Protocol",
          category: "Social",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Initiate a meaningful conversation or call a key ally, friend, or mentor to align your frequencies."
        },
        {
          title: "🏠 Monarch's Hearth: Kinship Ritual",
          category: "Family",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Spend 30 minutes of fully present, screen-free quality time with family or a loved one."
        }
      ],
      Execution: [
        {
          title: "🧹 Clearing the Perimeter: Environmental Cleanse",
          category: "General",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Declutter and sanitize your immediate workspace or room. A clear environment accelerates execution speed."
        },
        {
          title: "📨 Settle the Ledger: Administrative Strike",
          category: "Errands",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Clear 3 overdue micro-tasks, respond to outstanding emails, or pay pending utility bills immediately."
        },
        {
          title: "⚡ Monarch's Quick-Step: Task Blitz",
          category: "General",
          xp_tier: "Low",
          points: 10,
          priority: "Normal",
          description: "Complete one annoying chore you've been putting off for more than 48 hours."
        }
      ],
      Builder: [
        {
          title: "🚀 Construct Chimera: Side Project Sprint",
          category: "Side Projects",
          xp_tier: "Mid",
          points: 20,
          priority: "High",
          description: "Code a new feature, draft a system design, or ship a crucial update for your independent product/business."
        },
        {
          title: "🎨 Forge Soul-Weapon: Creative Outpouring",
          category: "Creative",
          xp_tier: "Mid",
          points: 15,
          priority: "Normal",
          description: "Spend 45 minutes on creative output (writing, design, UI prototyping, music, drawing) with zero constraints."
        },
        {
          title: "📐 Monarch's Blueprint: Launch Architecture",
          category: "Side Projects",
          xp_tier: "Mid",
          points: 15,
          priority: "High",
          description: "Outline the launch strategy, draft copy, or detail the MVP features of your next great venture."
        }
      ]
    };
  }, []);

  const laggingDomainInfo = useMemo(() => {
    if (!data) return null;
    const stats = [
      { name: "Physical" as const, value: data.domain_physical ?? 10, label: "Physical (Strength & Vitality)", icon: "⚔️", color: "#ff6b6b", categories: ["Fitness", "Health", "Wellness", "Personal Development"] },
      { name: "Mind" as const, value: data.domain_mind ?? 10, label: "Mind (Intelligence)", icon: "🧠", color: "#a78bfa", categories: ["Work", "Learning", "Academics", "Finance"] },
      { name: "Soul" as const, value: data.domain_soul ?? 10, label: "Soul (Sense)", icon: "🌊", color: "#60a5fa", categories: ["Mindfulness", "Spirituality", "Social", "Family"] },
      { name: "Execution" as const, value: data.domain_execution ?? 10, label: "Execution (Agility)", icon: "⚡", color: "#38bdf8", categories: ["Errands", "General"] },
      { name: "Builder" as const, value: data.domain_builder ?? 10, label: "Builder (Intelligence & Agility)", icon: "🏗️", color: "#ffd700", categories: ["Side Projects", "Creative"] },
    ];
    
    const sorted = [...stats].sort((a, b) => a.value - b.value);
    const lowest = sorted[0];
    const highest = [...stats].sort((a, b) => b.value - a.value)[0];
    const gap = highest.value - lowest.value;

    return {
      lowest,
      highest,
      gap,
      allStats: stats
    };
  }, [data]);

  const handleAriseSuggestedGate = async (directive: any) => {
    if (!user?.id || !laggingDomainInfo) return;
    setAriseLoadingId(directive.title);
    
    try {
      const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const payload = {
        title: `[DIRECTIVE] ${directive.title.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g, "").trim()}`,
        category: directive.category,
        xp_tier: directive.xp_tier,
        priority: directive.priority,
        deadline: tomorrowStr,
        description: `SYSTEM INSTRUCTION: ${directive.description}. Complete this directive to align your ${laggingDomainInfo.lowest.name} domain standing.`
      };
      
      await SystemAPI.saveGate(payload, null);
      toast.success("Directive manifested", `"${directive.title}" is now an active gate. Clear it by tomorrow to stabilize your standing.`);
      await loadData();
    } catch (err) {
      toast.fail(err, "Could not manifest the directive");
    } finally {
      setAriseLoadingId(null);
    }
  };


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

  // This week's XP from C-rank+ gates (E-rank doesn't count) and the target for the current mode.
  // The old panel hard-coded 300 and fell back to LIFETIME XP when the week was empty.
  const weeklyTotal = data.weekly_xp;
  const weeklyTarget = data.weekly_target;
  const weeklyMet = weeklyTarget === null || weeklyTotal >= weeklyTarget;
  const weeklyChartTotal = useMemo(
    () => data.weeklyHistory.reduce((sum, day) => sum + (day.daily_points || 0), 0),
    [data.weeklyHistory],
  );

  /** Conquer from the dashboard — through the engine, so it actually pays XP (it used to just flip a flag). */
  const conquer = async (taskId: string) => {
    if (busyIds.current.has(taskId)) return;
    busyIds.current.add(taskId);
    setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, is_completed: true } : t)));   // optimistic
    try {
      const result = await game.complete(taskId);
      if (!result) setTasks((ts) => ts.map((t) => (t.id === taskId ? { ...t, is_completed: false } : t)));
      await loadData();
    } finally {
      busyIds.current.delete(taskId);
    }
  };

  /** Dying has a price: begin the ARISE ritual (a B-rank gate) instead of a free "revive" button. */
  const handleArise = async () => {
    try {
      await SystemAPI.beginArise();
      toast.info("The ritual begins", "Conquer any B-rank or higher gate to rise again.");
      navigate("/dungeon-gate");
    } catch (err) {
      toast.fail(err, "Could not begin the ritual");
    }
  };

  if (!loaded) return <PageSkeleton />;

  return (
    <section className="page dashboard-page">
      <SeasonHUD mode={data.current_mode || 'Normal'} darkMana={data.dark_mana} endDate={data.season_end_date || null} />
      <ZoneOverlay isActive={isZoneActive} onExit={() => setZoneDismissed(true)} />
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
            {data.totalXp.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* ── ENGAGEMENT: streak, bounties, world boss, next trophy ── */}
      <EngagementPanel openGates={data.activeCount} conquestsToday={data.completedCount} />

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
        {/* ── Weekly Activity Threshold (target comes from the player's difficulty mode) ── */}
        <div className="panel ds-glass sovereign-panel" style={{ background: "linear-gradient(135deg, rgba(30,30,60,0.2) 0%, rgba(10,10,25,0.2) 100%)", border: "1px solid rgba(168,168,255,0.12)", padding: '24px 32px', borderRadius: 24, boxShadow: '0 16px 32px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
             <div>
               <h3 style={{ fontSize: "0.7rem", fontWeight: 950, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "3px", margin: '0 0 4px 0', opacity: 0.8 }}>
                 🛡️ Weekly Activity Threshold
               </h3>
               <div style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
                 {weeklyTotal} <span style={{ fontSize: '0.7rem', opacity: 0.4 }}>{weeklyTarget === null ? 'XP this week' : `/ ${weeklyTarget} XP`}</span>
               </div>
             </div>
             <span style={{ fontSize: '0.75rem', fontWeight: 900, color: weeklyMet ? '#34d399' : '#fbbf24', background: weeklyMet ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)', padding: '4px 10px', borderRadius: 6, border: `1px solid ${weeklyMet ? 'rgba(52,211,153,0.3)' : 'rgba(251,191,36,0.3)'}` }}>
               {weeklyTarget === null ? 'NO WEEKLY TARGET' : weeklyMet ? 'STABLE' : 'STAGNATION RISK'}
             </span>
          </div>
          <div style={{ height: 8, background: 'rgba(0,0,0,0.5)', borderRadius: 12, overflow: 'hidden', marginBottom: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
             <div className="sovereign-progress-fill" style={{ 
               height: '100%', 
               width: `${weeklyTarget ? Math.min(100, (weeklyTotal / weeklyTarget) * 100) : 100}%`, 
               background: weeklyMet ? 'linear-gradient(90deg, #34d399, #10b981)' : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
               boxShadow: weeklyMet ? '0 0 15px rgba(52,211,153,0.5)' : '0 0 15px rgba(251,191,36,0.5)',
               transition: 'width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
             }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="text-muted" style={{ fontSize: "0.6rem", fontWeight: 700, opacity: 0.5, margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {data.current_mode} mode · C-Rank+ only
            </p>
            {!weeklyMet && weeklyTarget !== null && (
              <span className="animate-pulse" style={{ fontSize: '0.6rem', color: '#fbbf24', fontWeight: 800 }}>+{weeklyTarget - weeklyTotal} XP REQUIRED</span>
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
                <span className="q-card-trend" style={{ color: '#ff4444' }}>XP LOSS</span>
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

      {/* ── SYSTEM DIRECTIVE: CORE CALIBRATION (RECOMMENDER) ── */}
      {laggingDomainInfo && (
        <div className="page-section" style={{ marginBottom: 40 }}>
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)' }}>
            <span>🌀 System Directive • Core Calibration</span>
            <span style={{ fontSize: '0.6rem', background: 'rgba(168,168,255,0.1)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 4, letterSpacing: '1px' }}>IMBALANCE DETECTED</span>
          </div>
          
          <div className="ds-glass core-calibration-panel" style={{
            background: 'linear-gradient(135deg, rgba(20, 20, 35, 0.95) 0%, rgba(5, 5, 10, 0.98) 100%)',
            border: '1px solid rgba(168, 168, 255, 0.2)',
            borderRadius: 24,
            padding: '32px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(168, 168, 255, 0.05)',
            display: 'grid',
            gridTemplateColumns: '1.2fr 2fr',
            gap: 32,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Watermark Aura */}
            <div style={{
              position: 'absolute',
              top: '-30%',
              left: '-20%',
              width: '60%',
              height: '160%',
              background: `radial-gradient(circle, ${laggingDomainInfo.lowest.color}15 0%, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: 0
            }} />

            {/* Left Column: Lagging Domain Status */}
            <div style={{ position: 'relative', zIndex: 1, borderRight: '1px dashed rgba(255,255,255,0.08)', paddingRight: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: `rgba(${laggingDomainInfo.lowest.name === 'Physical' ? '255,107,107' : laggingDomainInfo.lowest.name === 'Mind' ? '167,139,250' : laggingDomainInfo.lowest.name === 'Soul' ? '96,165,250' : laggingDomainInfo.lowest.name === 'Execution' ? '56,189,248' : '255,215,0'}, 0.1)`,
                  border: `1px solid ${laggingDomainInfo.lowest.color}40`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  boxShadow: `0 0 20px ${laggingDomainInfo.lowest.color}20`
                }}>
                  {laggingDomainInfo.lowest.name === 'Physical' && <Dumbbell size={32} color={laggingDomainInfo.lowest.color} />}
                  {laggingDomainInfo.lowest.name === 'Mind' && <Brain size={32} color={laggingDomainInfo.lowest.color} />}
                  {laggingDomainInfo.lowest.name === 'Soul' && <Sparkles size={32} color={laggingDomainInfo.lowest.color} />}
                  {laggingDomainInfo.lowest.name === 'Execution' && <Zap size={32} color={laggingDomainInfo.lowest.color} />}
                  {laggingDomainInfo.lowest.name === 'Builder' && <Hammer size={32} color={laggingDomainInfo.lowest.color} />}
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 900, color: laggingDomainInfo.lowest.color, letterSpacing: '2px', textTransform: 'uppercase' }}>LAGGING DOMAIN</div>
                  <h4 style={{ fontSize: '1.8rem', fontWeight: 950, color: '#fff', margin: '4px 0 0 0', letterSpacing: '-0.5px' }}>{laggingDomainInfo.lowest.name}</h4>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: '0 0 24px 0' }}>
                The System detects a resonance disparity. Your <strong>{laggingDomainInfo.lowest.name}</strong> standing is lagging behind your highest domain by <strong>{laggingDomainInfo.gap} levels</strong>. Execute targeted quests to restore absolute calibration.
              </p>

              {/* Stats Gauge */}
              <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 16, padding: '16px 20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, marginBottom: 8 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>RESONANCE SCORE</span>
                  <span style={{ color: laggingDomainInfo.lowest.color }}>{laggingDomainInfo.lowest.value} Proficiency</span>
                </div>
                <div style={{ height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(5, Math.min(100, (laggingDomainInfo.lowest.value / 100) * 100))}%`,
                    background: `linear-gradient(90deg, ${laggingDomainInfo.lowest.color}dd, ${laggingDomainInfo.lowest.color})`,
                    boxShadow: `0 0 10px ${laggingDomainInfo.lowest.color}50`,
                    transition: 'width 1s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', marginTop: 6, fontWeight: 700 }}>
                  <span>MIN: 0</span>
                  <span>TARGET: {Math.max(50, laggingDomainInfo.highest.value)} (HIGHEST)</span>
                </div>
              </div>
            </div>

            {/* Right Column: Recommendations */}
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: -8 }}>
                🔥 PRESCRIBED INSTRUCTIONS
              </div>

              {/* 1. Active Quest Recommendations if any already exist */}
              {tasks.filter(t => !t.is_completed && !t.is_pending && !t.is_failed && laggingDomainInfo.lowest.categories.includes(t.category)).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ fontSize: '0.65rem', color: '#ffb020', fontWeight: 800, letterSpacing: '0.5px' }}>ACTIVE GATES IN CUE:</div>
                  {tasks.filter(t => !t.is_completed && !t.is_pending && !t.is_failed && laggingDomainInfo.lowest.categories.includes(t.category)).slice(0, 2).map(task => (
                    <div key={task.id} style={{
                      background: 'rgba(255, 176, 32, 0.04)',
                      border: '1px solid rgba(255, 176, 32, 0.15)',
                      borderRadius: 12,
                      padding: '12px 16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{task.title}</div>
                        <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'flex', gap: 8 }}>
                          <span>Category: {task.category}</span>
                          <span>XP Rank: {task.xp_tier}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => conquer(task.id)}
                        style={{
                          background: 'rgba(255, 176, 32, 0.1)',
                          border: '1px solid rgba(255, 176, 32, 0.3)',
                          color: '#ffb020',
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                      >
                        CONQUER
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 2. Directives Recommendations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--accent-primary)', fontWeight: 800, letterSpacing: '0.5px' }}>MANIFEST NEW DIRECTIVES:</div>
                {systemDirectives[laggingDomainInfo.lowest.name as keyof typeof systemDirectives]?.map((directive, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: 16,
                    padding: '14px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    transition: 'all 0.3s',
                    position: 'relative'
                  }} className="recommender-row-v5">
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 850, color: '#fff' }}>{directive.title}</span>
                        <span style={{ fontSize: '0.55rem', background: 'rgba(168,168,255,0.1)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>+{TIER_XP[directive.xp_tier] ?? 5} XP</span>
                        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>({directive.category})</span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                        {directive.description}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => handleAriseSuggestedGate(directive)}
                      disabled={ariseLoadingId === directive.title}
                      style={{
                        background: 'linear-gradient(135deg, var(--accent-primary) 0%, #7c3aed 100%)',
                        border: 'none',
                        color: '#fff',
                        padding: '8px 18px',
                        borderRadius: 10,
                        fontSize: '0.7rem',
                        fontWeight: 950,
                        letterSpacing: '1px',
                        cursor: ariseLoadingId === directive.title ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        boxShadow: '0 4px 12px rgba(168,168,255,0.25)',
                        whiteSpace: 'nowrap'
                      }}
                      className="arise-suggested-btn"
                    >
                      {ariseLoadingId === directive.title ? 'MANIFESTING...' : 'ARISE'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROGRESS / CHARTS ── */}
      {(data.weeklyHistory.length > 0 || data.categoryDistribution.length > 0) && (
        <div className="page-section">
          <div className="section-label">System Analytics</div>
          <div className="dashboard-analytics-grid">
            
            {/* Weekly XP: High-Fidelity Wave */}
            <div className="glass-panel purple-aura analytic-card" style={{ minHeight: 320 }}>
              <div className="chart-header">
                <div className="chart-title">Weekly XP Tide</div>
                <div className="chart-val">{weeklyChartTotal} Total XP</div>
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
                    { category: "Physical",  value: data.domain_physical,  pending: data.categoryDistribution.find(c => c.category === "Fitness")?.points    || 0, fullMark: 100 },
                    { category: "Mind",      value: data.domain_mind,      pending: data.categoryDistribution.find(c => c.category === "Learning")?.points   || 0, fullMark: 100 },
                    { category: "Soul",      value: data.domain_soul,      pending: data.categoryDistribution.find(c => c.category === "Mindfulness")?.points || 0, fullMark: 100 },
                    { category: "Execution", value: data.domain_execution, pending: data.categoryDistribution.find(c => c.category === "Errands")?.points    || 0, fullMark: 100 },
                    { category: "Builder",   value: data.domain_builder,   pending: data.categoryDistribution.find(c => c.category === "Side Projects")?.points || 0, fullMark: 100 },
                  ]}
                  height={240}
                />
              </div>
              <div style={{ 
                marginTop: '15px', 
                padding: '12px 16px', 
                background: 'rgba(var(--accent-primary-rgb), 0.1)', 
                borderLeft: '4px solid var(--accent-primary)',
                borderRadius: '4px',
                fontSize: '0.8rem',
                color: 'var(--t2)'
              }}>
                {laggingDomainInfo && (
                  <div>
                    <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '4px', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                      🌀 System Suggestion • Imbalance Detected
                    </strong>
                    Your <strong>{laggingDomainInfo.lowest.name}</strong> domain is currently your weakest link. Check out the <strong>Core Calibration</strong> directive panel above for tailored recommendations to align your resonance.
                  </div>
                )}
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
                  {(() => {
                    const dataMax = Math.max(...data.monthlyHistory.map(d => d.daily_points), 0);
                    const dataMin = Math.min(...data.monthlyHistory.map(d => d.daily_points), 0);
                    const off = dataMax === dataMin ? 1 : dataMax / (dataMax - dataMin);
                    
                    return (
                      <AreaChart data={data.monthlyHistory} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                            <stop offset={0} stopColor="var(--accent-primary)" stopOpacity={0.8} />
                            <stop offset={off} stopColor="var(--accent-primary)" stopOpacity={0.05} />
                            <stop offset={off} stopColor="#ef4444" stopOpacity={0.05} />
                            <stop offset={1} stopColor="#ef4444" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} interval={Math.floor(data.monthlyHistory.length/6)} />
                        <YAxis stroke="rgba(255,255,255,0.05)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.2)" }} tickLine={false} axisLine={false} />
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Area type="monotone" dataKey="daily_points" stroke="url(#splitColor)" strokeWidth={2} fill="url(#splitColor)" dot={false} activeDot={{ r: 5, fill: "var(--accent-primary)" }} />
                      </AreaChart>
                    );
                  })()}
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
              Head to <strong>Dungeon Gate → Pending</strong> to either <em>Resolve</em> them (keep XP) or <em>Fail</em> them (take the penalty). Ignoring them won't make them disappear.
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
                onClick={() => { if (!task.is_completed) void conquer(task.id); }}
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
            <p>You went too long without conquering a gate.</p>
            <p className="reawakening-hint">Conquer any B-rank or higher gate to rise again — half of your decayed XP returns with you.</p>
            
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
          maxWidth="900px"
        >
          <div className="analytics-deep-dive">
            <div className="analytics-grid-detailed">
              {/* Left Column: Factor Breakdown */}
              <div className="analytics-factor-column ds-glass">
                 <div className="section-label" style={{ marginBottom: 20, color: 'var(--accent-primary)', fontSize: '0.75rem' }}>Performance Decomposition</div>
                 <div className="radar-container-detailed">
                   <PerformanceRadar 
                     data={[
                       { category: "Consistency", value: Math.min(100, (data.streak_count || 0) * 5), fullMark: 100 },
                       { category: "Complexity", value: Math.min(100, (data.total_points / 500) * 10), fullMark: 100 },
                       { category: "Ego Sync", value: data.ego_score || 0, fullMark: 100 },
                       { category: "Lethality", value: (data.completedCount / (data.activeCount + data.completedCount || 1)) * 100, fullMark: 100 },
                       { category: "Volume", value: Math.min(100, data.completedCount * 10), fullMark: 100 }
                     ]}
                     height={260}
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
                <div className="section-label" style={{ marginBottom: 20, color: 'var(--accent-primary)', fontSize: '0.75rem' }}>Growth Projections</div>
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
            .analytics-deep-dive { display: flex; flex-direction: column; gap: 16px; padding: 0 10px; height: 100%; justify-content: center; }
            .analytics-grid-detailed { display: grid; grid-template-columns: 1.1fr 1fr; gap: 16px; }
            .analytics-factor-column { padding: 20px 24px; border-radius: 16px; background: rgba(5,5,12,0.6); border: 1px solid rgba(168,168,255,0.1); }
            .radar-container-detailed { padding: 0; display: flex; justify-content: center; margin-bottom: 20px; }
            .analytics-factor-list { display: flex; flex-direction: column; gap: 8px; }
            .factor-item { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); }
            .factor-item span { opacity: 0.6; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
            .factor-item strong { color: var(--accent-primary); font-size: 1.1rem; font-weight: 900; text-shadow: 0 0 10px rgba(168,168,255,0.3); }
            
            .analytics-projection-column { display: flex; flex-direction: column; gap: 16px; }
            .projection-card { padding: 24px; border-radius: 16px; text-align: center; background: linear-gradient(135deg, rgba(168,168,255,0.08) 0%, rgba(0,0,0,0.4) 100%); border: 1px solid rgba(168,168,255,0.15); box-shadow: inset 0 0 30px rgba(168,168,255,0.05); flex: 1; display: flex; flex-direction: column; justify-content: center; }
            .projection-card h3 { font-size: 0.7rem; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: var(--accent-primary); margin-bottom: 12px; }
            .valuation-val { font-size: 2.8rem; font-weight: 900; color: #fff; margin-bottom: 12px; letter-spacing: -2px; text-shadow: 0 0 20px rgba(255,255,255,0.2); }
            .valuation-hint { font-size: 0.7rem; opacity: 0.5; line-height: 1.5; max-width: 280px; margin: 0 auto; }
            
            .milestone-tracker { padding: 20px 24px; border-radius: 16px; background: rgba(5,5,12,0.6); border: 1px solid rgba(255,255,255,0.05); }
            .milestone-progress-bar { height: 8px; background: rgba(0,0,0,0.5); border-radius: 99px; overflow: hidden; margin: 12px 0 8px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.5); }
            .milestone-fill { height: 100%; background: linear-gradient(90deg, var(--frost-blue), var(--accent-primary)); box-shadow: 0 0 15px var(--accent-glow); transition: width 1s cubic-bezier(0.4, 0, 0.2, 1); }
            .milestone-meta { display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; color: rgba(255,255,255,0.6); }
            
            .system-recommendation { padding: 16px 24px; border-radius: 16px; border-left: 4px solid var(--accent-primary); background: linear-gradient(90deg, rgba(168,168,255,0.08) 0%, rgba(0,0,0,0.2) 100%); }
            .rec-header { display: flex; align-items: center; gap: 12px; font-size: 0.8rem; font-weight: 900; letter-spacing: 2px; margin-bottom: 8px; color: var(--accent-primary); }
            .system-recommendation p { font-size: 0.85rem; line-height: 1.5; color: rgba(255,255,255,0.8); font-style: italic; margin: 0; }
            
            @media (max-width: 768px) {
              .analytics-grid-detailed { grid-template-columns: 1fr; }
            }
          `}</style>
        </Modal>
      )}
    </section>
  );
}
