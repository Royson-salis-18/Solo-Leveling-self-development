import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";

/* ─── types ─────────────────────────────────────────────────────── */
type DashboardData = {
  activeCount: number;
  completedCount: number;
  totalXp: number;
  level: number;
  weeklyHistory: Array<{ date: string; daily_points: number }>;
  categoryDistribution: Array<{ category: string; points: number }>;
};

type TaskRow = {
  id: string;
  title: string;
  is_completed: boolean;
  priority: string;
  category: string;
  time?: string;
};

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
  
  const [data, setData] = useState<DashboardData & { player_rank?: string, player_title?: string }>({
    activeCount: 0,
    completedCount: 0,
    totalXp: 0, level: 1,
    weeklyHistory: [],
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
          uRes, 
          pRes, 
          tRes,
          activeTasksRes,
          completedTasksRes
        ] = await Promise.all([
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_completed",false),
          supabase.from("tasks").select("*",{count:"exact",head:true}).eq("user_id",userId).eq("is_completed",true),
          supabase.from("user_profiles").select("total_points,level,player_rank,player_title").eq("user_id",userId).maybeSingle(),
          supabase.from("user_points").select("date,daily_points").eq("user_id",userId).order("date",{ascending:true}).limit(7),
          supabase.from("tasks").select("category,points").eq("user_id",userId),
          supabase.from("tasks").select("id, title, is_completed, priority, category").eq("user_id",userId).eq("is_completed",false).order("created_at",{ascending:false}).limit(10),
          supabase.from("tasks").select("id, title, points, completed_at").eq("user_id",userId).eq("is_completed",true).order("completed_at",{ascending:false}).limit(5),
        ]);

        const catMap = new Map<string,number>();
        (tRes.data??[]).forEach((t:any) => catMap.set(t.category??"General",(catMap.get(t.category??"General")??0)+Number(t.points??0)));
        const catDist = [...catMap.entries()].map(([category,points])=>({category,points}));

        setData({
          activeCount: ac ?? 0, 
          completedCount: cc ?? 0,
          totalXp: Number(uRes.data?.total_points ?? 0),
          level: Number(uRes.data?.level ?? 1),
          player_rank: uRes.data?.player_rank ?? "E",
          player_title: uRes.data?.player_title ?? "Newcomer",
          weeklyHistory: (pRes.data??[]).map((d:any)=>({ date:String(d.date).slice(5), daily_points:Number(d.daily_points??0) })),
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

      {/* ── STAT CARDS ── */}
      <div className="stats-grid stats-grid-dashboard">
        <StatCard label="Active Quests"    value={data.activeCount}   subtitle="In progress" />
        <StatCard label="Completed"        value={data.completedCount} subtitle="All time" />
        <StatCard label="Completion Rate"  value={completionRate}     subtitle="of all quests" />
        <StatCard label="Weekly XP"        value={weeklyTotal}        subtitle="Points earned" />
      </div>

      {/* ── PROGRESS / CHARTS ── */}
      {(data.weeklyHistory.length > 0 || data.categoryDistribution.length > 0) && (
        <div className="page-section">
          <div className="section-label">Your Analytics</div>
          <div className="dashboard-panels-row">
            
            <div className="panel dashboard-panel-flex">
              <div className="dashboard-panels-row">
                {data.weeklyHistory.length > 0 && (
                  <div>
                    <div className="chart-label-wrapper">
                      <span className="chart-label-text">Weekly XP</span>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={data.weeklyHistory} barSize={12}>
                        <XAxis dataKey="date" stroke="rgba(255,255,255,0.18)" tick={{ fontSize:10, fill:"rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false}/>
                        <YAxis hide />
                        <Tooltip {...TOOLTIP_STYLE} />
                        <Bar dataKey="daily_points" fill="rgba(255,255,255,0.55)" radius={[4,4,0,0]}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {data.categoryDistribution.length > 0 && (
                  <div>
                    <div className="chart-label-wrapper">
                      <span className="chart-label-text">By Category</span>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={data.categoryDistribution} dataKey="points" nameKey="category" outerRadius={50} innerRadius={30}>
                          {data.categoryDistribution.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {data.categoryDistribution.length > 0 && (
              <div className="panel dashboard-panel-flex">
                <div className="chart-label-wrapper">
                  <span className="chart-label-text">Skill Matrix</span>
                </div>
                <PerformanceRadar
                  title=""
                  data={[
                    { category:"Work",        value: Math.round((data.categoryDistribution.find(c=>c.category==="Work")?.points||0)/8.2),    fullMark:100 },
                    { category:"Health",      value: Math.round((data.categoryDistribution.find(c=>c.category==="Health")?.points||0)/4.4),  fullMark:100 },
                    { category:"Learning",    value: Math.round((data.categoryDistribution.find(c=>c.category==="Learning")?.points||0)/3.2),fullMark:100 },
                    { category:"Personal",    value: Math.round((data.categoryDistribution.find(c=>c.category==="Personal")?.points||0)/2.6),fullMark:100 },
                    { category:"Consistency", value: Math.round(Number(completionRate.slice(0,-1))),                                          fullMark:100 },
                    { category:"Momentum",    value: Math.min(weeklyTotal/20, 100),                                                           fullMark:100 },
                  ]}
                  height={180}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ONGOING TASKS ── */}
      <div className="page-section">
        <div className="section-label">Ongoing Quests</div>
        
        {tasks.length > 0 ? (
          <div className="panel panel-no-pad">
            <div className="task-list">
              {tasks.map(task => (
                <div key={task.id} className="task-row" onClick={() => toggleTaskCompletion(task.id, task.is_completed)}>
                  <input type="checkbox" checked={task.is_completed} title="Mark task complete" readOnly onClick={e=>e.stopPropagation()} onChange={() => toggleTaskCompletion(task.id, task.is_completed)} />
                  <span className={`task-row-title ${task.is_completed ? "done" : ""}`}>{task.title}</span>
                  <div className="task-row-meta">
                    {task.priority && task.priority !== "Normal" && <span className={`tag${task.priority==="URGENT"?" tag-urgent":""}`}>{task.priority}</span>}
                    {task.category && <span className="tag">{task.category}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="panel panel-empty text-sm text-muted">
            No active quests. Head to the Quests lab to add some!
          </div>
        )}
      </div>

      {/* ── RECENT ACTIVITY ── */}
      {recentActivity.length > 0 && (
        <div className="page-section">
          <div className="section-label">Recent Activity</div>
          <div className="panel panel-no-pad">
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
