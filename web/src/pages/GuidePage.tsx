import { useState } from "react";
import { 
  Brain, Zap, Scroll, Skull, 
  Swords, Target, Clock, AlertTriangle, Book,
  ChevronRight, Activity, Flame, ShieldAlert, Cpu
} from "lucide-react";
import { ArchitectChamber } from "../components/ArchitectChamber";

/* ─── The Commandments ─── */
type Commandment = {
  num: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

const COMMANDMENTS: Commandment[] = [
  {
    num: "I",
    title: "Evolve or Perish",
    subtitle: "The Philosophy of the System",
    icon: <Flame size={120} strokeWidth={1} />,
    content: (
      <>
        <p>This is not a mere tool for organization. It is a <strong style={{ color: "var(--accent-primary)" }}>self-development engine</strong> designed to transcend your current limits.</p>
        <p>In this world, there is no stagnation. Every action you take—or fail to take—manifests as growth or decay. XP is your lifeblood; Mana is your momentum.</p>
        <div className="lore-callout">
          <AlertTriangle size={20} color="#ffcc00" />
          <span>If you seek comfort, look elsewhere. If you seek power, follow the System.</span>
        </div>
      </>
    )
  },
  {
    num: "II",
    title: "Ascend the Tiers",
    subtitle: "XP, Levels & Military Ranks",
    icon: <Activity size={120} strokeWidth={1} />,
    content: (
      <>
        <p>Your worth is measured by your progression. Accumulate Mana through Quests to elevate your status.</p>
        <div className="lore-stat-grid">
           <div className="lore-stat"><span style={{ color: "#ffcc00" }}>S-Rank</span><strong>50+ LVL</strong></div>
           <div className="lore-stat"><span style={{ color: "#e2e2e2" }}>A-Rank</span><strong>35-49 LVL</strong></div>
           <div className="lore-stat"><span style={{ color: "#cd7f32" }}>B-Rank</span><strong>20-34 LVL</strong></div>
           <div className="lore-stat"><span style={{ color: "var(--t3)" }}>C-Rank</span><strong>10-19 LVL</strong></div>
        </div>
        <p>Your Title will shift as you reach new plateaus of power. Do not settle for E-Rank existence.</p>
      </>
    )
  },
  {
    num: "III",
    title: "Accept the Mission",
    subtitle: "Quest Lifecycle & Execution",
    icon: <Target size={120} strokeWidth={1} />,
    content: (
      <>
        <p>Every objective is a Quest. Once accepted, it must be conquered. Failure results in immediate Mana deduction.</p>
        <ul className="lore-list">
          <li><strong>Active</strong> — Missions currently in the field.</li>
          <li><strong>Pending</strong> — Missions that have breached their window.</li>
          <li><strong style={{ color: "rgba(255,100,100,0.8)" }}>Failed</strong> — Missions that have cost you your essence.</li>
        </ul>
      </>
    )
  },
  {
    num: "IV",
    title: "Maintain the Balance",
    subtitle: "The Skill Matrix",
    icon: <Brain size={120} strokeWidth={1} />,
    content: (
      <>
        <p>A true Monarch is balanced. Neglecting one area creates a vulnerability that will be exploited.</p>
        <div className="category-matrix ds-glass">
           <div className="matrix-item">Fitness</div>
           <div className="matrix-dot">•</div>
           <div className="matrix-item">Mind</div>
           <div className="matrix-dot">•</div>
           <div className="matrix-item">Learning</div>
           <div className="matrix-dot">•</div>
           <div className="matrix-item">Social</div>
           <div className="matrix-dot">•</div>
           <div className="matrix-item">Work</div>
        </div>
        <p>Monitor your <strong>Resonance Radar</strong> on the Dashboard. If the matrix becomes lopsided, the System will warn you.</p>
      </>
    )
  },
  {
    num: "V",
    title: "Honor the Deadline",
    subtitle: "Pending Penalties",
    icon: <Clock size={120} strokeWidth={1} />,
    content: (
      <>
        <p>Time is a finite resource. When a Quest exceeds its allocated window, it enters the <strong style={{ color: "#ffcc00" }}>Pending</strong> state.</p>
        <p>You must then choose: <strong>Resolve</strong> it late for full XP, or <strong>Fail</strong> it and suffer the XP penalty. The System does not forget.</p>
      </>
    )
  },
  {
    num: "VI",
    title: "Extract the Shadows",
    subtitle: "The Army of the Dead",
    icon: <Skull size={120} strokeWidth={1} />,
    content: (
      <>
        <p>When a powerful foe is defeated (High-Tier Quests), you may attempt <strong style={{ color: "var(--accent-primary)" }}>Shadow Extraction</strong>.</p>
        <p>Commands: <em>"Arise"</em>. Your extracted shadows provide passive Mana boosts and permanent stat enhancements.</p>
        <div className="lore-callout tip">
          <Zap size={20} color="var(--accent-primary)" />
          <span>Marshall grade shadows offer the highest resonance. Seek them out in the Collection.</span>
        </div>
      </>
    )
  },
  {
    num: "VII",
    title: "Equip the Divine",
    subtitle: "Arsenal & Vault",
    icon: <Swords size={120} strokeWidth={1} />,
    content: (
      <>
        <p>Your progress grants you access to the System's <strong>Arsenal</strong>. Discover legendary daggers, longswords, and ancient artifacts like the <em>Rulers' Authority</em>.</p>
        <p>Each item has a rank (E to S). The more you complete, the more likely the System is to grant you a Gift.</p>
      </>
    )
  },
  {
    num: "VIII",
    title: "Survive the Anomalies",
    subtitle: "Double Dungeons & Red Gates",
    icon: <ShieldAlert size={120} strokeWidth={1} />,
    content: (
      <>
        <p>The System is not always predictable. Occasionally, spatial distortions create <strong style={{ color: "var(--accent-primary)" }}>Double Dungeons</strong>—hidden objectives nested within a primary mission.</p>
        <p>Even more dangerous are <strong style={{ color: "#ff4444" }}>Red Gates</strong>. These are high-stakes legendary distortions that lock until the objective is cleared. Rewards are immense, but failure is catastrophic.</p>
        <div className="lore-callout danger" style={{ borderLeftColor: '#ff4444', background: 'rgba(255,68,68,0.05)' }}>
          <Skull size={20} color="#ff4444" />
          <span style={{ color: '#ffbaba' }}>If you encounter a Red Gate, prepare for total war. There is no escape.</span>
        </div>
      </>
    )
  }
];

export function GuidePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);

  return (
    <section className="cartenon-guide">
      {/* Full Screen Architect Overlay */}
      {isArchitectOpen && (
        <ArchitectChamber onClose={() => setIsArchitectOpen(false)} />
      )}

      {/* Floating Architect Trigger */}
      <div className="kinetic-container">
        <button 
          className="floating-architect-btn ds-glass"
          onClick={() => setIsArchitectOpen(true)}
        >
          <Cpu size={20} />
          <span>CONSULT ARCHITECT</span>
          <div className="btn-glow" />
        </button>
      </div>

      {/* Immersive Background */}
      <div className="temple-bg" />
      <div className="temple-overlay" />

      <div className="temple-container">
        <div className="temple-header">
           <div className="ancient-script">תמשחלאמרי</div>
           <h2 className="temple-title">RULES OF THE SYSTEM</h2>
           <p className="temple-subtitle">Cartenon Temple • Hunter's Manual v4.2</p>
        </div>

        <div className="tablet-layout">
          {/* Left Sidebar: Commandment List */}
          <div className="tablet-sidebar ds-glass">
            {COMMANDMENTS.map((cmd, idx) => (
              <button 
                key={idx} 
                className={`cmd-btn ${activeTab === idx ? 'active' : ''}`}
                onClick={() => setActiveTab(idx)}
              >
                <div className="cmd-num">{cmd.num}</div>
                <div className="cmd-meta">
                   <div className="cmd-title">{cmd.title}</div>
                   <div className="cmd-sub">{cmd.subtitle}</div>
                </div>
                <ChevronRight size={14} className="cmd-arrow" />
              </button>
            ))}
          </div>

          {/* Right Panel: Content */}
          <div className="tablet-content ds-glass">
             <div className="content-bg-icon">
               {COMMANDMENTS[activeTab].icon}
             </div>
             <div className="content-inner">
                <div className="tablet-header-decor">
                   <Scroll size={16} />
                   <span>SYSTEM COMMANDMENT // {COMMANDMENTS[activeTab].num}</span>
                </div>
                
                <h1 className="content-title">{COMMANDMENTS[activeTab].title}</h1>
                <div className="content-subtitle-line" />
                
                <div className="content-body">
                   {COMMANDMENTS[activeTab].content}
                </div>

                <div className="content-footer">
                   <Book size={16} />
                   <span>STUDY THE RULES. SURVIVE THE SYSTEM.</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      <style>{`
        .cartenon-guide {
          position: relative;
          height: 100vh;
          overflow: hidden;
          background: #0a0a0f;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px;
          box-sizing: border-box;
        }

        .temple-bg {
          position: absolute;
          inset: 0;
          background-image: url('/assets/cartenon_tablet.png');
          background-size: cover;
          background-position: center;
          opacity: 0.6;
          filter: saturate(0.5) contrast(1.2) brightness(0.7);
          z-index: 0;
        }

        .temple-overlay {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at center, transparent, rgba(0,0,0,0.8));
          z-index: 1;
        }

        .temple-container {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1440px;
          padding: 0 20px;
          margin: 0 auto;
          height: calc(100vh - 120px);
          display: flex;
          flex-direction: column;
        }

        .temple-header {
          text-align: center;
          margin-bottom: 40px;
          animation: fadeInDown 1s ease-out;
        }

        .ancient-script {
          font-size: 3rem;
          color: var(--accent-primary);
          letter-spacing: 18px;
          margin-bottom: 12px;
          font-family: serif;
          opacity: 0.4;
          text-shadow: 0 0 15px var(--accent-primary), 0 0 30px var(--accent-primary);
          animation: aura-pulse 4s infinite alternate ease-in-out;
          user-select: none;
          filter: blur(0.5px);
        }

        .temple-title {
          font-size: 2.2rem;
          font-weight: 900;
          letter-spacing: 6px;
          color: #fff;
          margin: 0;
          text-shadow: 0 0 20px rgba(168,168,255,0.4);
        }

        .temple-subtitle {
          font-size: 0.65rem;
          color: var(--accent-primary);
          letter-spacing: 3px;
          text-transform: uppercase;
          margin-top: 8px;
          opacity: 0.7;
        }

        .tablet-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 24px;
          flex: 1;
          min-height: 0;
        }

        .tablet-sidebar {
          background: rgba(15, 15, 20, 0.7);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: var(--r-xl);
          padding: 20px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .tablet-sidebar::-webkit-scrollbar { display: none; }

        .cmd-btn {
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
          padding: 16px;
          border-radius: var(--r-lg);
          display: flex;
          align-items: center;
          gap: 16px;
          text-align: left;
          cursor: pointer;
          transition: all 0.3s;
          color: #fff;
        }

        .cmd-btn:hover {
          background: rgba(255,255,255,0.05);
          border-color: rgba(168,168,255,0.2);
        }

        .cmd-btn.active {
          background: rgba(168,168,255,0.1);
          border-color: var(--accent-primary);
          box-shadow: 0 0 20px rgba(168,168,255,0.15);
        }

        .cmd-num {
          font-size: 1.2rem;
          font-weight: 900;
          color: var(--accent-primary);
          width: 30px;
          text-align: center;
        }

        .cmd-meta { flex: 1; }
        .cmd-title { font-size: 0.85rem; font-weight: 800; margin-bottom: 2px; }
        .cmd-sub { font-size: 0.58rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; }
        .cmd-arrow { opacity: 0; transition: 0.3s; transform: translateX(-10px); }
        .cmd-btn.active .cmd-arrow { opacity: 1; transform: translateX(0); color: var(--accent-primary); }

        .tablet-content {
          background: rgba(20, 20, 25, 0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: var(--r-xl);
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.02);
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(30px);
        }

        .tablet-content::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 80% 20%, rgba(168,168,255,0.1) 0%, transparent 50%);
          pointer-events: none;
        }

        .content-bg-icon {
          position: absolute;
          right: -20px;
          bottom: -20px;
          opacity: 0.05;
          transform: scale(3.5);
          color: #fff;
          pointer-events: none;
          z-index: 0;
          transition: all 0.5s ease;
        }

        .content-inner {
          padding: 60px;
          height: 100%;
          overflow-y: auto;
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .content-inner::-webkit-scrollbar { display: none; }

        .tablet-header-decor {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.65rem;
          font-weight: 900;
          color: var(--accent-primary);
          letter-spacing: 3px;
          margin-bottom: 16px;
          opacity: 0.9;
        }

        .content-title {
          font-size: 2rem;
          font-weight: 900;
          color: #fff;
          margin: 0 0 16px;
          line-height: 1.1;
          text-transform: uppercase;
          letter-spacing: -0.5px;
          text-shadow: 0 0 20px rgba(168,168,255,0.2);
        }

        .content-subtitle-line {
          width: 60px;
          height: 3px;
          background: linear-gradient(90deg, var(--accent-primary), transparent);
          margin-bottom: 24px;
          border-radius: 2px;
        }

        .content-body {
          font-size: 0.88rem;
          line-height: 1.6;
          color: rgba(255,255,255,0.85);
          flex: 1;
        }

        .content-body.architect-mode {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          height: 100%;
          padding: 0;
        }

        .content-body p { margin-bottom: 16px; }

        .lore-callout {
          background: rgba(168,168,255,0.05);
          border-left: 3px solid var(--accent-primary);
          padding: 16px 20px;
          border-radius: 0 12px 12px 0;
          margin: 24px 0;
          display: flex;
          gap: 16px;
          align-items: center;
          font-style: italic;
          color: #fff;
          box-shadow: inset 0 0 20px rgba(168,168,255,0.02);
        }

        .lore-callout span {
          font-size: 0.82rem;
          line-height: 1.5;
        }

        .lore-stat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin: 24px 0;
        }

        .lore-stat {
          background: rgba(255,255,255,0.02);
          padding: 16px 20px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255,255,255,0.06);
          box-shadow: 0 6px 15px rgba(0,0,0,0.2);
          transition: transform 0.2s;
        }

        .lore-stat:hover {
          transform: translateY(-3px);
          background: rgba(255,255,255,0.04);
          border-color: rgba(168,168,255,0.2);
        }

        .lore-stat span { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; }
        .lore-stat strong { font-size: 1.25rem; margin-top: 4px; color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.1); }

        .lore-list {
          list-style: none;
          padding: 0;
          margin: 24px 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .lore-list li {
          padding-left: 24px;
          position: relative;
          font-size: 0.88rem;
        }

        .lore-list li::before {
          content: '◇';
          position: absolute;
          left: 0;
          top: 0px;
          color: var(--accent-primary);
          font-size: 1rem;
        }

        .category-matrix {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin: 24px 0;
          padding: 20px;
          border-radius: 14px;
          align-items: center;
          justify-content: center;
        }
        
        .matrix-item {
          color: #fff;
          font-weight: 800;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 6px 10px;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        
        .matrix-dot {
          color: var(--accent-primary);
          opacity: 0.5;
        }

        .content-footer {
          margin-top: auto;
          padding-top: 24px;
          border-top: 1px solid rgba(255,255,255,0.08);
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.65rem;
          font-weight: 900;
          color: rgba(255,255,255,0.4);
          letter-spacing: 2px;
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes aura-pulse {
          0% { opacity: 0.2; transform: scale(0.98); filter: blur(1px) brightness(0.8); }
          50% { opacity: 0.5; transform: scale(1); filter: blur(0px) brightness(1.2); text-shadow: 0 0 20px var(--accent-primary), 0 0 40px var(--accent-primary); }
          100% { opacity: 0.2; transform: scale(1.02); filter: blur(1px) brightness(0.8); }
        }

        /* Scrollbar Styling */
        .tablet-sidebar::-webkit-scrollbar,
        .content-inner::-webkit-scrollbar {
          width: 6px;
        }
        .tablet-sidebar::-webkit-scrollbar-thumb,
        .content-inner::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        /* Floating Architect Button with Kinetic Motion */
        .kinetic-container {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 999;
          animation: floatAround 25s infinite ease-in-out;
          will-change: transform;
          pointer-events: none; /* Let clicks pass through to button */
        }

        .kinetic-container:hover {
          animation-play-state: paused;
        }

        .floating-architect-btn {
          pointer-events: auto; /* Enable clicks on button */
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          background: rgba(88, 80, 236, 0.1);
          border: 1px solid rgba(88, 80, 236, 0.3);
          border-radius: 16px;
          color: #fff;
          font-weight: 900;
          font-size: 0.7rem;
          letter-spacing: 2px;
          cursor: pointer;
          backdrop-filter: blur(20px);
          box-shadow: 0 0 20px rgba(88, 80, 236, 0.1);
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s, background 0.3s;
        }

        .floating-architect-btn:hover {
          background: rgba(88, 80, 236, 0.3);
          border-color: #5850ec;
          box-shadow: 0 0 40px rgba(88, 80, 236, 0.5);
          transform: scale(1.1);
        }

        @keyframes floatAround {
          0% { transform: translate(10vw, 10vh); }
          25% { transform: translate(60vw, 20vh); }
          50% { transform: translate(50vw, 70vh); }
          75% { transform: translate(20vw, 60vh); }
          100% { transform: translate(10vw, 10vh); }
        }

        .floating-architect-btn span {
          opacity: 0.8;
          transition: 0.3s;
        }

        .floating-architect-btn:hover span {
          opacity: 1;
        }

        .btn-glow {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          box-shadow: inset 0 0 15px rgba(88, 80, 236, 0.2);
          pointer-events: none;
        }

        @keyframes overlayFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </section>
  );
}
