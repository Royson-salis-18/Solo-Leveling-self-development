import { Link } from "react-router-dom";
import { PlanCards } from "../components/PlanCards";
import { BRAND } from "../lib/brand";

export function PricingPage() {
  return (
    <div className="lp"><header className="lp-nav"><Link to="/welcome"><strong>{BRAND.name}</strong></Link><nav><Link to="/login">Sign in</Link></nav></header>
      <section className="lp-plans"><h2>Plans</h2><PlanCards /></section></div>
  );
}
