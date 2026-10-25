import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Brain, Crown, Flame, Gift, Shield, Swords, Zap, LineChart } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { BRAND } from "../lib/brand";
import { PlanCards } from "../components/PlanCards";
import "../components/engagement.css";

type Aura = "" | "aura-orange" | "aura-red" | "aura-green";
const FEATURES: { icon: typeof Swords; title: string; text: string; aura: Aura }[] = [
  { icon: Swords, title: "Gates, not to-dos", text: "Every task is a gate with a rank, E to S. Bigger gates pay more XP and cost more when you abandon them.", aura: "" },
  { icon: Flame, title: "Chain of Resolve", text: "Streaks, decay and Dark Mana debt keep you honest. Earn Freeze charges so one bad day never erases weeks of work.", aura: "aura-orange" },
  { icon: Gift, title: "Daily Quests", text: "Three quests a day, E to B rank. Clear two to unseal the cache. Luck is real, and it is capped by a pity guarantee.", aura: "" },
  { icon: Crown, title: "Calamity Raids", text: "A weekly boss every hunter chips at. Your conquests are the damage. The spoils are shared.", aura: "aura-red" },
  { icon: Shield, title: "The server decides", text: "XP is awarded by the System, never the browser. No console tricks. Leaderboards you can trust.", aura: "aura-green" },
  { icon: Zap, title: "Rewards you design", text: "Spend XP on treats you choose. Spending never lowers your level.", aura: "" },
  { icon: LineChart, title: "Strategic analytics", text: "Domains, weekly threshold and history show where you are strong and where you are slipping.", aura: "" },
  { icon: Brain, title: "The Oracle", text: "An advisor that reads your real record, not guesses.", aura: "" },
];

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => { document.title = `${BRAND.name} — ${BRAND.tagline}`; setReady(true); }, []);
  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="lp">
      <header className="lp-nav">
        <div className="lp-brand"><div className="lp-brand-ico"><Brain size={20} strokeWidth={1.4} /></div><strong>{BRAND.name}</strong></div>
        <nav>
          <Link to="/pricing">Plans</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/register" className="dd-btn hot">Begin</Link>
        </nav>
      </header>

      <section className="lp-hero">
        <div className="lp-eyebrow">[SYSTEM] PLAYER REGISTRATION OPEN</div>
        <h1>Level up your <em>real</em> life.</h1>
        <p>{BRAND.tagline} Clear gates, hold your chain, raid calamities with other hunters. The System keeps the score.</p>
        <div className="lp-cta">
          <Link to="/register" className="dd-btn hot">Create your hunter</Link>
          <Link to="/pricing" className="dd-btn">View plans</Link>
        </div>
      </section>

      <div className="lp-stats">
        <div className="lp-stat"><b>4</b><span>Difficulty modes</span></div>
        <div className="lp-stat"><b>E → S</b><span>Gate ranks</span></div>
        <div className="lp-stat"><b>100%</b><span>Server-side XP</span></div>
      </div>

      <div className="lp-label">System Features</div>
      <section className="lp-grid">
        {FEATURES.map(({ icon: I, title, text, aura }) => (
          <article key={title} className={`lp-card ${aura}`}><I size={22} /><h3>{title}</h3><p>{text}</p></article>
        ))}
      </section>

      <div className="lp-label" id="pricing">Access Tiers</div>
      {ready && <section className="lp-plans"><h2>Plans</h2><PlanCards /></section>}

      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} {BRAND.company}</span>
        <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link>
        <a href={`mailto:${BRAND.supportEmail}`}>Support</a>
      </footer>
    </div>
  );
}
