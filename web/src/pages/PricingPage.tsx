import { Link } from "react-router-dom";
import { Brain } from "lucide-react";
import { PlanCards } from "../components/PlanCards";
import { BRAND } from "../lib/brand";
import "../components/engagement.css";

export function PricingPage() {
  return (
    <div className="lp">
      <header className="lp-nav">
        <Link to="/welcome" className="lp-brand"><div className="lp-brand-ico"><Brain size={20} strokeWidth={1.4} /></div><strong>{BRAND.name}</strong></Link>
        <nav><Link to="/login">Sign in</Link><Link to="/register" className="dd-btn hot">Begin</Link></nav>
      </header>
      <div className="lp-label" style={{ marginTop: 32 }}>Access Tiers</div>
      <section className="lp-plans"><PlanCards /></section>
    </div>
  );
}
