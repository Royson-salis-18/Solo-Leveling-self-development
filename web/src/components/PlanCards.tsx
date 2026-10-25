import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import "./engagement.css";

type Plan = { id: string; name: string; description: string; price_cents_monthly: number; price_cents_yearly: number | null; features: string[] };

// Fallback so the page renders before the DB is reachable. The plans table is the source of truth.
const FALLBACK: Plan[] = [
  { id: "free", name: "Free", description: "Everything you need to build the habit.", price_cents_monthly: 0, price_cents_yearly: 0, features: ["Up to 25 active gates", "All difficulty modes", "5 Oracle messages / day"] },
  { id: "pro", name: "Pro", description: "For hunters who want the full System.", price_cents_monthly: 700, price_cents_yearly: 6000, features: ["Unlimited active gates", "100 Oracle messages / day", "Create clans & guilds"] },
];
const money = (c: number) => (c === 0 ? "$0" : `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`);

export function PlanCards({ onChoose, current }: { onChoose?: (planId: string) => void; current?: string }) {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK);
  useEffect(() => {
    supabase?.from("plans").select("id,name,description,price_cents_monthly,price_cents_yearly,features").order("sort_order")
      .then(({ data }) => { if (data?.length) setPlans(data as Plan[]); });
  }, []);
  return (
    <div className="lp-plan-row">
      {plans.map((p) => (
        <article key={p.id} className={`lp-plan${p.id === "pro" ? " lp-plan--hi" : ""}`}>
          <h3>{p.name}</h3>
          <div className="lp-price">{money(p.price_cents_monthly)}<small>/MO</small></div>
          {p.price_cents_yearly ? <div className="lp-yearly">{`${money(p.price_cents_yearly)}/yr`}</div> : null}
          <p>{p.description}</p>
          <ul>{(p.features ?? []).map((f) => <li key={f}><Check size={14} /> {f}</li>)}</ul>
          {current === p.id ? <span className="dd-pill ok">CURRENT TIER</span>
            : onChoose && p.id !== "free" ? <button className="dd-btn hot" onClick={() => onChoose(p.id)}>Upgrade</button>
            : p.id === "free" ? <Link to="/register" className="dd-btn">Start free</Link>
            : <Link to="/register" className="dd-btn hot">Get Pro</Link>}
        </article>
      ))}
    </div>
  );
}
