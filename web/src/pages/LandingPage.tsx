import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Brain, Crown, Flame, Gift, Shield, Swords, Zap, LineChart } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { BRAND } from "../lib/brand";
import { PlanCards } from "../components/PlanCards";

const FEATURES = [
  { icon: Swords, title: "Gates, not to-dos", text: "Every task is a gate with a rank. Bigger gates pay more XP — and cost more when you abandon them." },
  { icon: Flame, title: "Real stakes", text: "Streaks, decay, Dark Mana debt and four difficulty modes keep you honest without burning you out." },
  { icon: Shield, title: "Cheat-proof", text: "XP is awarded by the server. No console tricks, no double-clicks — leaderboards you can trust." },
  { icon: Zap, title: "Rewards you design", text: "Spend XP on treats you choose. Spending never lowers your level." },
  { icon: LineChart, title: "See your growth", text: "Domains, weekly threshold and history charts show where you're strong and where you're slipping." },
  { icon: Gift, title: "Something new every day", text: "Three daily bounties, a loot chest with real odds, and Streak Freezes that cover a bad day — so one slip never erases weeks of work." },
  { icon: Crown, title: "Raid a boss together", text: "A weekly World Boss that every hunter chips away at. Your conquests are the damage; the loot is shared." },
  { icon: Brain, title: "An AI that knows your record", text: "Ask the Oracle for a plan; it reads your real stats, not guesses." },
];

export function LandingPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => { document.title = `${BRAND.name} — ${BRAND.tagline}`; setReady(true); }, []);
  if (!isLoading && isAuthenticated) return <Navigate to="/" replace />;

  return (
    <div className="lp">
      <header className="lp-nav">
        <strong>{BRAND.name}</strong>
        <nav>
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Start free</Link>
        </nav>
      </header>
      <section className="lp-hero">
        <h1>{BRAND.tagline}</h1>
        <p>Rank up by finishing what matters. Lose ground when you don't. A productivity system that actually bites back.</p>
        <div className="lp-cta">
          <Link to="/register" className="btn btn-primary">Create your hunter</Link>
          <Link to="/pricing" className="btn btn-secondary">See plans</Link>
        </div>
      </section>
      <section className="lp-grid">
        {FEATURES.map(({ icon: I, title, text }) => (
          <article key={title} className="lp-card"><I size={22} /><h3>{title}</h3><p>{text}</p></article>
        ))}
      </section>
      {ready && <section className="lp-plans" id="pricing"><h2>Simple pricing</h2><PlanCards /></section>}
      <footer className="lp-foot">
        <span>© {new Date().getFullYear()} {BRAND.company}</span>
        <Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link>
        <a href={`mailto:${BRAND.supportEmail}`}>Support</a>
      </footer>
    </div>
  );
}
