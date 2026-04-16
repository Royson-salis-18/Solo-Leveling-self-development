import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell,
} from "recharts";
import { StatCard } from "../components/StatCard";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { hasSupabaseConfig, supabase } from "../lib/supabase";
import { mockHistory, mockQuests, mockCompletedQuests } from "../lib/mockData";
import {
  CheckSquare, Heart, Target, CreditCard, Users, BookOpen, Image,
  Crosshair, Plus, ArrowRight, Play, Book, Briefcase,
} from "lucide-react";

/* ─── types ─────────────────────────────────────────────────────── */
type DashboardData = {
  activeCount: number;
  completedCount: number;
  totalXp: number;
  level: number;
  weeklyHistory: Array<{ date: string; daily_points: number }>;
  categoryDistribution: Array<{ category: string; points: number }>;
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

/* ─── AREAS data ─────────────────────────────────────────────────── */
const AREAS = [
  { icon: Heart,     name: "Health & Fitness",  goals: 1, projects: 5 },
  { icon: Target,    name: "Self-Improvement",  goals: 2, projects: 7 },
  { icon: CreditCard,name: "Finance",           goals: 1, projects: 3 },
  { icon: Briefcase, name: "Business",          goals: 1, projects: 3 },
  { icon: Crosshair, name: "Mental Health",     goals: 1, projects: 2 },
  { icon: Users,     name: "Family & Friends",  goals: 1, projects: 2 },
  { icon: Book,      name: "Study",             goals: 0, projects: 0 },
  { icon: Image,     name: "Social Media",      goals: 0, projects: 0 },
  { icon: Heart,     name: "Relationship",      goals: 0, projects: 0 },
];

const BOOKS = [
  { id:1, title:"How to Not Die Alone",           author:"Anna Sive",       date:"Mar 2, 2024" },
  { id:2, title:"The Secret",                      author:"Emily",           date:"Oct 25, 2023" },
  { id:3, title:"Frankenstein",                    author:"Mary Shelley",    date:"Jan 10, 2024" },
  { id:4, title:"Meditations",                     author:"Marcus Aurelius", date:"Jun 17, 2023" },
  { id:5, title:"The Almanac of Naval Ravikant",   author:"Eric Jorgenson",  date:"Oct 14, 2024" },
];

const WEEK_DAYS = [
  { day: "19 Mon", tasks: [] },
  { day: "20 Tue", tasks: [] },
  { day: "21 Wed", tasks: [] },
  { day: "22 Thu", tasks: [] },
  { day: "23 Fri", tasks: ["Make YouTube Videos · Done"] },
  { day: "24 Sat", tasks: ['Watch "The Creator" · Done', "Read article · Done"] },
  { day: "25 Sun", tasks: ["Status check · Pending", "Film daily shots · Done", "Plan my day · Pending", "Study German · Pending"], isToday: true },
];

/* ─── COMPONENT ─────────────────────────────────────────────────── */
export function DashboardPage() {
  const [todayTab,   setTodayTab]   = useState("Task & Delay");
  const [reviewTab,  setReviewTab]  = useState("Books");
  const [weekTab,    setWeekTab]    = useState("Tasks");
  const [areaView,   setAreaView]   = useState("Areas");
  const [tasks, setTasks] = useState([
    { id:1, time:"10:30am", title:"Status check",       done:false, priority:"URGENT",        area:"Health & Fitness" },
    { id:2, time:"12:00",   title:"Film the daily shots",done:true,  priority:"Not Important", area:"Business" },
    { id:3, time:"16:00",   title:"Plan my day",         done:false, priority:"Low",           area:"" },
    { id:4, time:"18:00",   title:"Study German",        done:false, priority:"Medium",        area:"Self-Improvement" },
  ]);

  const [data, setData] = useState<DashboardData>({
    activeCount: mockQuests.length,
    completedCount: mockCompletedQuests.length,
    totalXp: 1840, level: 16,
    weeklyHistory: mockHistory,
    categoryDistribution: [
      { category:"Work",     points:820 },
      { category:"Health",   points:440 },
      { category:"Learning", points:320 },
      { category:"Personal", points:260 },
    ],
  });

  useEffect(() => {
    if (!supabase) return;
    const email = localStorage.getItem("user_email");
    if (!email) return;
    (async () => {
      const [{ count: ac }, { count: cc }, uRes, pRes, tRes] = await Promise.all([
        supabase.from("tasks").select("*",{count:"exact",head:true}).eq("email",email).eq("is_completed",false),
        supabase.from("tasks").select("*",{count:"exact",head:true}).eq("email",email).eq("is_completed",true),
        supabase.from("users").select("total_points,level").eq("email",email).maybeSingle(),
        supabase.from("user_points").select("date,daily_points").eq("email",email).order("date",{ascending:true}).limit(7),
        supabase.from("tasks").select("category,points").eq("email",email),
      ]);
      const catMap = new Map<string,number>();
      (tRes.data??[]).forEach((t:any) => catMap.set(t.category??"General",(catMap.get(t.category??"General")??0)+Number(t.points??0)));
      const catDist = [...catMap.entries()].map(([category,points])=>({category,points}));
      setData({
        activeCount: ac??0, completedCount: cc??0,
        totalXp: Number(uRes.data?.total_points??0),
        level: Number(uRes.data?.level??1),
        weeklyHistory: (pRes.data??[]).map((d:any)=>({ date:String(d.date).slice(5), daily_points:Number(d.daily_points??0) })),
        categoryDistribution: catDist.length ? catDist : [{ category:"No Data", points:1 }],
      });
    })();
  }, []);

  const completionRate = useMemo(()=>{
    const total = data.activeCount + data.completedCount;
    return total ? `${Math.round((data.completedCount/total)*100)}%` : "0%";
  },[data.activeCount, data.completedCount]);

  const weeklyTotal = useMemo(()=>data.weeklyHistory.reduce((s,d)=>s+d.daily_points,0),[data.weeklyHistory]);
  const doneCount   = tasks.filter(t=>t.done).length;
  const todoPct     = tasks.length ? Math.round((doneCount/tasks.length)*100) : 0;

  const TODAY_TABS   = ["Task & Delay","My Tasks","Low Tasks","Donut/Done","Tomorrow"];
  const REVIEW_TABS  = ["Books","Bookmark","YouTube","Words"];
  const WEEK_TABS    = ["Tasks","Schedule","Upcoming","Weekly Habits","Income","Expense"];
  const AREA_TABS    = ["Areas","Topics"];

  return (
    <div className="content-inner">

      {/* ── TOP LEVEL BAR ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"28px" }}>
        <div>
          <div style={{ fontSize:"1.1rem", fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.01em" }}>
            Second Brain 5.0
          </div>
          <div style={{ fontSize:"0.72rem", color:"var(--text-tertiary)", marginTop:"2px" }}>
            {!hasSupabaseConfig ? "Preview mode — local data" : new Date().toLocaleDateString("en-GB",{ weekday:"long", day:"numeric", month:"long", year:"numeric" })}
          </div>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          <div className="badge">⭐ Level {data.level}</div>
          <div className="badge">{data.totalXp.toLocaleString()} XP</div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="stats-grid" style={{ marginBottom:"28px" }}>
        <StatCard label="Active Quests"    value={data.activeCount}   subtitle="In progress" />
        <StatCard label="Completed"        value={data.completedCount} subtitle="All time" />
        <StatCard label="Completion Rate"  value={completionRate}     subtitle="of all quests" />
        <StatCard label="Weekly XP"        value={weeklyTotal}        subtitle="Points earned" />
      </div>

      {/* ── TODAY TASKS ── */}
      <div className="page-section">
        <div className="section-label">Today Tasks</div>

        {/* Tabs */}
        <div className="tabs-wide">
          {TODAY_TABS.map(t => (
            <div key={t} className={`tab-wide${todayTab===t?" active":""}`} onClick={()=>setTodayTab(t)}>
              {t === "Task & Delay" && <CheckSquare size={12}/>} {t}
            </div>
          ))}
        </div>

        {/* Task rows */}
        <div className="panel" style={{ padding:0 }}>
          <div className="task-list">
            {tasks.map(task => (
              <div key={task.id} className="task-row" onClick={()=>setTasks(ts=>ts.map(t=>t.id===task.id?{...t,done:!t.done}:t))}>
                <input type="checkbox" checked={task.done} readOnly onClick={e=>e.stopPropagation()} onChange={()=>setTasks(ts=>ts.map(t=>t.id===task.id?{...t,done:!t.done}:t))} />
                <span className="task-row-time">{task.time}</span>
                <span className={`task-row-title${task.done?" done":""}`}>{task.title}</span>
                <div className="task-row-meta">
                  {task.priority && <span className={`tag${task.priority==="URGENT"?" tag-urgent":""}`}>{task.priority}</span>}
                  {task.area     && <span className="tag">{task.area}</span>}
                </div>
                <span style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", marginLeft:"8px" }}>Archive ›</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── PROGRESS ── */}
      <div className="page-section">
        <div className="section-label">Today's Progress</div>
        <div style={{ display:"flex", gap:"14px" }}>
          <div className="panel" style={{ flex:1 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
              <span style={{ fontSize:"0.78rem", color:"var(--text-secondary)", display:"flex", gap:"6px", alignItems:"center" }}>
                <CheckSquare size={13}/> Today Tasks
              </span>
              <span style={{ fontSize:"1.4rem", fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>{todoPct}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width:`${todoPct}%` }}/>
            </div>
            <div style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", marginTop:"8px" }}>
              {doneCount} of {tasks.length} tasks done
            </div>
          </div>

          <div className="panel" style={{ flex:1 }}>
            <div className="charts-grid" style={{ gridTemplateColumns:"3fr 2fr", gap:"12px" }}>
              <div>
                <p className="panel" style={{ background:"none", border:"none", boxShadow:"none", padding:0, marginBottom:6 }}>
                  <span style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Weekly XP</span>
                </p>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={data.weeklyHistory} barSize={8}>
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.18)" tick={{ fontSize:9, fill:"rgba(255,255,255,0.35)" }} tickLine={false} axisLine={false}/>
                    <YAxis hide />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="daily_points" fill="rgba(255,255,255,0.55)" radius={[3,3,0,0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>By Category</p>
                <ResponsiveContainer width="100%" height={90}>
                  <PieChart>
                    <Pie data={data.categoryDistribution} dataKey="points" nameKey="category" outerRadius={38} innerRadius={22}>
                      {data.categoryDistribution.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── DAILY INBOX ── */}
      <div className="page-section">
        <div className="section-label">Daily Inbox</div>
        <div className="panel" style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          {["Today Journal","Tasking Habits","Recent Notes","Recent Resources","Weekly Review"].map((item,i) => (
            <div key={item} className="tag" style={i===0?{background:"rgba(255,255,255,0.10)",borderColor:"rgba(255,255,255,0.20)",color:"var(--text-primary)"}:{}}>
              <CheckSquare size={10} style={{ marginRight:4 }}/>{item}
            </div>
          ))}
          <div className="tag" style={{ borderStyle:"dashed", cursor:"pointer" }}>
            <Plus size={10} style={{ marginRight:3 }}/>New
          </div>
        </div>
      </div>

      {/* ── AREAS & TOPICS ── */}
      <div className="page-section">
        <div className="section-label">Areas & Topics</div>
        <div className="tabs">
          {AREA_TABS.map(t=>(
            <div key={t} className={`tab${areaView===t?" active":""}`} onClick={()=>setAreaView(t)}>
              {t==="Areas" && <Crosshair size={11}/>} {t==="Topics" && <BookOpen size={11}/>} {t}
            </div>
          ))}
        </div>
        <div className="area-grid">
          {AREAS.map(({ icon: Icon, name, goals, projects }) => (
            <div key={name} className="area-card">
              <div className="area-icon"><Icon size={22}/></div>
              <div className="area-name">{name}</div>
              <div className="area-meta">{goals} Goal · {projects} Projects</div>
            </div>
          ))}
          <div className="area-card area-card-dashed" style={{ color:"var(--text-tertiary)", minHeight:120 }}>
            <Plus size={20} style={{ marginBottom:8, opacity:.5 }}/>
            <div style={{ fontSize:"0.75rem" }}>New Area</div>
          </div>
        </div>
      </div>

      {/* ── REVIEW SECTION ── */}
      <div className="page-section">
        <div className="section-label">Review Section</div>
        <div className="tabs">
          {REVIEW_TABS.map(t=>(
            <div key={t} className={`tab${reviewTab===t?" active":""}`} onClick={()=>setReviewTab(t)}>{t}</div>
          ))}
        </div>
        <div style={{ display:"flex", gap:"16px" }}>
          <div className="panel" style={{ flex:2, padding:0, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"80px 1fr 120px 105px 72px 90px", gap:"8px", padding:"8px 14px", borderBottom:"1px solid var(--border-subtle)" }}>
              {["Status","Title","Author","Date","Label",""].map(h=>(
                <div key={h} style={{ fontSize:"0.65rem", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", color:"var(--text-tertiary)" }}>{h}</div>
              ))}
            </div>
            {BOOKS.map(b=>(
              <div key={b.id} className="review-row">
                <span className="tag">Not Read</span>
                <div className="review-row-title"><BookOpen size={12} style={{ opacity:.5 }}/>{b.title}</div>
                <div className="review-row-author">{b.author}</div>
                <div className="review-row-date">{b.date}</div>
                <span className="tag">Inbox</span>
                <div style={{ textAlign:"right", fontSize:"0.70rem", color:"var(--text-tertiary)" }}>Open ›</div>
              </div>
            ))}
          </div>

          {/* Mini player */}
          <div style={{ flex:"0 0 180px" }}>
            <div className="mini-player">
              <div className="mini-player-thumb">
                <Play size={20} style={{ opacity:.4 }}/>
              </div>
              {[{title:"Symphony",dur:"2:11"},{title:"Calma",dur:"1:27"},{title:"Breathe",dur:"3:52"}].map(s=>(
                <div key={s.title} className="mini-player-track">
                  <span>{s.title}</span>
                  <span style={{ color:"var(--text-tertiary)" }}>{s.dur}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── THIS WEEK ── */}
      <div className="page-section">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
          <div className="section-label" style={{ marginBottom:0 }}>This Week</div>
          <div style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", cursor:"pointer" }}>Open in Calendar ›</div>
        </div>
        <div className="tabs-wide">
          {WEEK_TABS.map(t=>(
            <div key={t} className={`tab-wide${weekTab===t?" active":""}`} onClick={()=>setWeekTab(t)}>{t}</div>
          ))}
        </div>
        <div style={{ fontSize:"0.80rem", fontWeight:600, color:"var(--text-secondary)", marginBottom:"10px" }}>
          August 19 – 25, 2024
        </div>
        <div className="calendar-week">
          {WEEK_DAYS.map(d=>(
            <div key={d.day} className={`cal-day${d.isToday?" today":""}`}>
              <span className="cal-date">{d.day}</span>
              {d.tasks.map((t,i)=>(
                <div key={i} className={`cal-task${d.isToday?" today-task":""}`}>{t}</div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── SKILL RADAR ── */}
      <div className="page-section">
        <div className="section-label">Skill Matrix</div>
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
          height={320}
        />
      </div>

      {/* ── RECENT ACTIVITY ── */}
      <div className="page-section">
        <div className="section-label">Recent Activity</div>
        <div className="panel" style={{ padding:0 }}>
          {mockCompletedQuests.slice(0,4).map(q=>(
            <div key={q.id} className="task-row">
              <span style={{ fontSize:"0.80rem", flex:1 }}>✓ {q.title}</span>
              <span style={{ fontSize:"0.72rem", color:"var(--text-tertiary)" }}>
                {q.completed_at && new Date(q.completed_at).toLocaleDateString()}
              </span>
              <span className="tag" style={{ marginLeft:8 }}>+{q.points} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
