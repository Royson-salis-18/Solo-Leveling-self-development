import { useState } from "react";
import {
  BookOpen, Swords, Shield, ScrollText, Gift,
  Target, Zap, Star, ChevronDown, ChevronRight, Brain, Award,
  TrendingUp, Clock, AlertTriangle, CheckCircle
} from "lucide-react";

/* ─── Guide Sections ─── */
type Section = {
  id: string;
  icon: any;
  title: string;
  subtitle: string;
  color: string;
  content: React.ReactNode;
};

const SECTIONS: Section[] = [
  {
    id: "philosophy",
    icon: Brain,
    title: "The Philosophy",
    subtitle: "Why this system exists",
    color: "#a8a8ff",
    content: (
      <div className="guide-content">
        <p>
          <strong>Solo Leveling</strong> is a gamified self-development system built around one idea:
          <em> real growth requires consistent action, not motivation.</em>
        </p>
        <p>
          Most productivity tools track tasks. This one tracks <strong>you</strong> — your XP, rank,
          class, streaks, and standing among other hunters. Every task you complete earns XP.
          Every task you ignore costs you. There's no "neutral" — you're always moving up or down.
        </p>
        <div className="guide-callout">
          <AlertTriangle size={14} />
          <span>This system is designed for people who want to take their personal growth seriously.
          If you're looking for a simple to-do list, this isn't it.</span>
        </div>
        <h4>Core Principles</h4>
        <ul>
          <li><strong>Action over intention</strong> — Planned tasks must be completed or you take penalties</li>
          <li><strong>Holistic growth</strong> — Categories span Fitness, Mindfulness, Finance, Social, Creative, and more</li>
          <li><strong>Accountability</strong> — Overdue tasks don't vanish; they become Pending and demand resolution</li>
          <li><strong>Community</strong> — Clans and Guilds let you grow with others and compete</li>
        </ul>
      </div>
    ),
  },
  {
    id: "xp-ranks",
    icon: TrendingUp,
    title: "XP, Levels & Ranks",
    subtitle: "How progression works",
    color: "#ffcc00",
    content: (
      <div className="guide-content">
        <h4>XP (Mana Points)</h4>
        <p>
          Every completed quest earns XP based on its <strong>XP Tier</strong>:
        </p>
        <table className="guide-table">
          <thead><tr><th>Tier</th><th>XP</th><th>Use For</th></tr></thead>
          <tbody>
            <tr><td>Low</td><td className="text-muted">+10</td><td>Quick errands, routine chores</td></tr>
            <tr><td>Mid</td><td style={{color:"#34d399"}}>+25</td><td>Meaningful daily tasks</td></tr>
            <tr><td>High</td><td style={{color:"#60a5fa"}}>+50</td><td>Important milestones</td></tr>
            <tr><td>Super</td><td style={{color:"#a78bfa"}}>+100</td><td>Major achievements</td></tr>
            <tr><td>Legendary</td><td style={{color:"#ffcc00"}}>+250</td><td>Life-changing accomplishments</td></tr>
          </tbody>
        </table>

        <h4>Levels & Ranks</h4>
        <p>XP accumulates → your level increases → your military rank upgrades automatically:</p>
        <table className="guide-table">
          <thead><tr><th>Rank</th><th>Level Range</th><th>Title</th></tr></thead>
          <tbody>
            <tr><td>E</td><td>1 – 4</td><td>Newcomer → Initiate</td></tr>
            <tr><td>D</td><td>5 – 9</td><td>Apprentice → Scout</td></tr>
            <tr><td>C</td><td>10 – 19</td><td>Fighter → Sentinel</td></tr>
            <tr><td>B</td><td>20 – 34</td><td>Knight → Vanguard</td></tr>
            <tr><td>A</td><td>35 – 49</td><td>Champion → Warlord</td></tr>
            <tr><td>S</td><td>50+</td><td>Monarch → Shadow Sovereign</td></tr>
          </tbody>
        </table>

        <div className="guide-callout guide-callout-tip">
          <Star size={14} />
          <span>Your rank and title update automatically whenever your XP changes. No manual action needed.</span>
        </div>
      </div>
    ),
  },
  {
    id: "quests",
    icon: ScrollText,
    title: "Quests & Tasks",
    subtitle: "Creating, completing, and managing tasks",
    color: "#fff",
    content: (
      <div className="guide-content">
        <h4>Creating Quests</h4>
        <p>Every task is a <strong>Quest</strong>. When creating one, you set:</p>
        <ul>
          <li><strong>Category</strong> — What area of your life this covers (see Categories below)</li>
          <li><strong>Urgency</strong> — How time-sensitive it is (Low / Normal / High / URGENT)</li>
          <li><strong>XP Tier</strong> — How much it's worth (this is <em>separate</em> from urgency)</li>
          <li><strong>Deadline + Time</strong> — When it must be done by</li>
          <li><strong>Subtasks</strong> — Break big quests into unlimited-depth sub-quests</li>
        </ul>

        <h4>Quest Lifecycle</h4>
        <div className="guide-flow">
          <div className="guide-flow-step">
            <CheckCircle size={16} style={{color:"#34d399"}} />
            <div>
              <strong>Active</strong>
              <span>Your current to-do list</span>
            </div>
          </div>
          <ChevronRight size={14} className="guide-flow-arrow" />
          <div className="guide-flow-step">
            <Clock size={16} style={{color:"#ffa030"}} />
            <div>
              <strong>Pending</strong>
              <span>Overdue or manually deferred</span>
            </div>
          </div>
          <ChevronRight size={14} className="guide-flow-arrow" />
          <div className="guide-flow-step">
            <CheckCircle size={16} style={{color:"#60a5fa"}} />
            <div>
              <strong>Resolve / Fail</strong>
              <span>You choose the outcome</span>
            </div>
          </div>
        </div>

        <div className="guide-callout guide-callout-warn">
          <AlertTriangle size={14} />
          <span><strong>Failing</strong> a quest deducts XP equal to its tier value. <strong>Resolving</strong> a pending quest still grants full XP. Choose wisely.</span>
        </div>
      </div>
    ),
  },
  {
    id: "categories",
    icon: Target,
    title: "Categories & Growth Areas",
    subtitle: "Covering your whole life, not just work",
    color: "#34d399",
    content: (
      <div className="guide-content">
        <p>
          Categories ensure you're developing as a <em>whole person</em>, not just grinding one area.
          Your Skill Matrix radar chart on the Dashboard reflects balance across these:
        </p>
        <table className="guide-table">
          <thead><tr><th>Category</th><th>XP Weight</th><th>What It Covers</th></tr></thead>
          <tbody>
            <tr><td>🏋️ Fitness</td><td style={{color:"#34d399"}}>Full</td><td>Exercise, sports, physical health, diet tracking</td></tr>
            <tr><td>📚 Learning</td><td style={{color:"#34d399"}}>Full</td><td>Personal skill-building, reading, courses <em>you chose</em></td></tr>
            <tr><td>🧘 Mindfulness</td><td style={{color:"#34d399"}}>Full</td><td>Meditation, journaling, therapy, mental health</td></tr>
            <tr><td>💰 Finance</td><td style={{color:"#34d399"}}>Full</td><td>Budgeting, investing, saving goals, financial literacy</td></tr>
            <tr><td>👥 Social</td><td style={{color:"#34d399"}}>Full</td><td>Relationships, networking, community service</td></tr>
            <tr><td>🎨 Creative</td><td style={{color:"#34d399"}}>Full</td><td>Art, music, writing, design, side projects</td></tr>
            <tr><td>💼 Work</td><td style={{color:"#34d399"}}>Full</td><td>Professional tasks, career goals, deadlines</td></tr>
            <tr><td>🏠 Errands</td><td style={{color:"#34d399"}}>Full</td><td>Chores, appointments, logistics, everyday tasks</td></tr>
            <tr><td>🎓 Academics</td><td style={{color:"#ffa030"}}>Reduced</td><td>School/college assignments, exams, homework</td></tr>
            <tr><td>📋 General</td><td style={{color:"#ffa030"}}>Reduced</td><td>Anything that doesn't fit elsewhere</td></tr>
          </tbody>
        </table>

        <div className="guide-callout guide-callout-tip">
          <Star size={14} />
          <span>
            <strong>Why Academics has reduced XP weight:</strong> Institutional learning is
            mandatory and externally structured. Personal learning (the "Learning" category) is
            self-directed and represents genuine curiosity-driven growth — that's what this
            system rewards most.
          </span>
        </div>
      </div>
    ),
  },
  {
    id: "pending",
    icon: Clock,
    title: "Pending & Penalties",
    subtitle: "What happens when you miss deadlines",
    color: "#ffa030",
    content: (
      <div className="guide-content">
        <h4>How Tasks Become Pending</h4>
        <ul>
          <li><strong>Automatically</strong> — Any task past its deadline becomes Pending on next page load</li>
          <li><strong>Manually</strong> — Click the ⏰ <em>Pending</em> button to defer a task yourself</li>
        </ul>

        <h4>Resolving Pending Tasks</h4>
        <p>Once a task is Pending, you have two choices:</p>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
          <div className="guide-option guide-option-good">
            <CheckCircle size={18} />
            <strong>Resolve</strong>
            <p>Complete the task late. You still earn <em>full XP</em>.</p>
          </div>
          <div className="guide-option guide-option-bad">
            <AlertTriangle size={18} />
            <strong>Fail</strong>
            <p>Admit defeat. You <em>lose XP</em> equal to the task's tier value.</p>
          </div>
        </div>

        <div className="guide-callout guide-callout-warn">
          <AlertTriangle size={14} />
          <span>Pending tasks don't auto-penalize. You must explicitly choose. But don't let them pile up — it's a sign your planning needs adjustment.</span>
        </div>
      </div>
    ),
  },
  {
    id: "clans-guilds",
    icon: Shield,
    title: "Clans & Guilds",
    subtitle: "Team up for accountability",
    color: "#a78bfa",
    content: (
      <div className="guide-content">
        <h4>Clans (3–5 Hunters)</h4>
        <p>
          Clans are <strong>tight-knit strike teams</strong>. You can be in multiple clans simultaneously.
          Leaders can assign quests to members and organize events.
        </p>
        <ul>
          <li>Max <strong>5 members</strong> per clan</li>
          <li>Leaders/Officers can <strong>assign quests</strong> to members</li>
          <li>Organize <strong>Raids, Rallies, Training sessions</strong></li>
          <li>Declare <strong>Clan Wars</strong> against other clans</li>
        </ul>

        <h4>Guilds (5–20 Hunters)</h4>
        <p>
          Guilds are <strong>large organizations</strong> for broader community. They have minimum rank
          requirements and host larger-scale events.
        </p>

        <h4>Clan Wars ⚔️</h4>
        <p>
          When you create a <strong>War</strong> event, you pick an opponent clan/guild. Both sides race to
          earn XP during the event window. The side with more total XP earned wins, and every member
          of the winning team gets bonus XP.
        </p>
      </div>
    ),
  },
  {
    id: "duels",
    icon: Swords,
    title: "1v1 Duels",
    subtitle: "Personal rivalry",
    color: "#ff6b6b",
    content: (
      <div className="guide-content">
        <p>
          Challenge any hunter to a <strong>1v1 duel</strong>. Both players start at 0 and race to
          earn a target amount of XP within a time limit.
        </p>
        <h4>How It Works</h4>
        <ol>
          <li>Enter opponent's <strong>Hunter ID</strong> (the 8-char code from their profile)</li>
          <li>Set a <strong>target XP</strong> and <strong>duration</strong></li>
          <li>Both hunters earn XP from their normal quests</li>
          <li>First to hit the target — or whoever is ahead when time runs out — wins</li>
        </ol>
      </div>
    ),
  },
  {
    id: "rewards",
    icon: Gift,
    title: "Rewards & Inventory",
    subtitle: "What you earn along the way",
    color: "#f472b6",
    content: (
      <div className="guide-content">
        <p>
          As you level up and complete milestones, you unlock <strong>rewards</strong> in your inventory.
          These include:
        </p>
        <ul>
          <li><strong>Task Skips</strong> — Instantly complete a task without doing it (limited supply!)</li>
          <li><strong>XP Boosts</strong> — Temporarily multiply your XP earnings</li>
          <li><strong>Titles</strong> — Special titles displayed on your profile</li>
        </ul>
        <p>
          Check the <strong>Rewards</strong> page to see what's available and the <strong>Challenges</strong> page
          for daily/weekly objectives that grant bonus items.
        </p>
      </div>
    ),
  },
  {
    id: "dashboard",
    icon: Award,
    title: "Reading Your Dashboard",
    subtitle: "Understanding your stats",
    color: "#60a5fa",
    content: (
      <div className="guide-content">
        <h4>Key Metrics</h4>
        <ul>
          <li><strong>Active Quests</strong> — Tasks currently in progress</li>
          <li><strong>Pending</strong> — Overdue tasks awaiting your decision</li>
          <li><strong>Weekly XP</strong> — Points earned in the last 7 days (momentum indicator)</li>
          <li><strong>Completion Rate</strong> — Percentage of tasks you've actually finished</li>
        </ul>

        <h4>Charts</h4>
        <ul>
          <li><strong>Weekly XP</strong> — Bar chart showing daily XP over the past week</li>
          <li><strong>Category Breakdown</strong> — Donut chart showing where your effort goes</li>
          <li><strong>Skill Matrix</strong> — Radar chart revealing balance across life areas</li>
          <li><strong>XP Trend</strong> — Line chart tracking your momentum over time</li>
        </ul>

        <div className="guide-callout guide-callout-tip">
          <Star size={14} />
          <span>If your Skill Matrix is lopsided (e.g. all Work, no Fitness), that's a signal to diversify your quests.</span>
        </div>
      </div>
    ),
  },
  {
    id: "tips",
    icon: Zap,
    title: "Pro Tips",
    subtitle: "How to get the most out of the system",
    color: "#ffcc00",
    content: (
      <div className="guide-content">
        <div className="guide-tips-grid">
          <div className="guide-tip-card">
            <div className="guide-tip-num">01</div>
            <strong>Start small</strong>
            <p>Begin with 3–5 daily Low-tier quests. Build consistency before intensity.</p>
          </div>
          <div className="guide-tip-card">
            <div className="guide-tip-num">02</div>
            <strong>Set deadlines on everything</strong>
            <p>Tasks without deadlines never become Pending. Use deadlines as accountability.</p>
          </div>
          <div className="guide-tip-card">
            <div className="guide-tip-num">03</div>
            <strong>Use subtasks for big goals</strong>
            <p>"Get fit" is vague. "Run 2km → Run 3km → Run 5km" is trackable.</p>
          </div>
          <div className="guide-tip-card">
            <div className="guide-tip-num">04</div>
            <strong>Balance your categories</strong>
            <p>Check your Skill Matrix weekly. A well-rounded hunter is a strong hunter.</p>
          </div>
          <div className="guide-tip-card">
            <div className="guide-tip-num">05</div>
            <strong>Join a clan</strong>
            <p>Accountability partners make you 2x more likely to follow through.</p>
          </div>
          <div className="guide-tip-card">
            <div className="guide-tip-num">06</div>
            <strong>Don't fear Fail</strong>
            <p>Failing a quest is better than ignoring it. Own it, learn, move on.</p>
          </div>
        </div>
      </div>
    ),
  },
];

/* ─── Component ─── */
export function GuidePage() {
  const [openSection, setOpenSection] = useState<string>("philosophy");

  const toggle = (id: string) => {
    setOpenSection(prev => prev === id ? "" : id);
  };

  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title"><BookOpen size={22} style={{display:"inline",marginRight:8,verticalAlign:"middle"}} /> Hunter's Guide</h2>
          <p className="text-xs text-muted">Everything you need to know — from zero to Shadow Sovereign</p>
        </div>
      </div>

      {/* Quick-start banner */}
      <div className="guide-hero">
        <div className="guide-hero-inner">
          <div className="guide-hero-icon"><Brain size={32} /></div>
          <div>
            <h3 style={{margin:0,fontSize:"1rem",fontWeight:800}}>Welcome, Hunter.</h3>
            <p style={{margin:"6px 0 0",fontSize:"0.78rem",color:"var(--t2)",lineHeight:1.5}}>
              This isn't a to-do app. It's a <strong>self-development engine</strong> disguised as an RPG.
              Every action has consequences — XP gained, XP lost, rank shifts. Read this guide to
              understand the rules of the game you've chosen to play.
            </p>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <div className="guide-sections">
        {SECTIONS.map((s, i) => {
          const isOpen = openSection === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} className={`guide-section${isOpen ? " guide-section--open" : ""}`}>
              <button className="guide-section-header" onClick={() => toggle(s.id)}>
                <div className="guide-section-left">
                  <span className="guide-section-num">{String(i + 1).padStart(2, "0")}</span>
                  <div className="guide-section-icon" style={{ color: s.color }}>
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="guide-section-title">{s.title}</div>
                    <div className="guide-section-subtitle">{s.subtitle}</div>
                  </div>
                </div>
                <ChevronDown
                  size={16}
                  className={`guide-chevron${isOpen ? " guide-chevron--open" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="guide-section-body">
                  {s.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
