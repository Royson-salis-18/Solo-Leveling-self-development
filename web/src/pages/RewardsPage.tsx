import { useState } from "react";
import { RewardItem } from "../components/RewardItem";
import { mockRewards } from "../lib/mockData";

export function RewardsPage() {
  const [userPoints,     setUserPoints]     = useState(2840);
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<"all"|"instant"|"medium"|"major">("all");

  const handleClaim = (id: string) => {
    const r = mockRewards.find(x => x.id === id);
    if (!r || claimedRewards.includes(id) || userPoints < r.xp_cost) return;
    setClaimedRewards([...claimedRewards, id]);
    setUserPoints(p => p - r.xp_cost);
  };

  const filtered = mockRewards.filter(r => activeCategory === "all" ? true : r.type === activeCategory);

  const CATS: { key: "all" | "instant" | "medium" | "major"; label: string }[] = [
    { key:"all",     label:"All" },
    { key:"instant", label:"⚡ Instant" },
    { key:"medium",  label:"💫 Medium" },
    { key:"major",   label:"🏆 Major" },
  ];

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Rewards</h2>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ fontSize:"0.72rem", color:"var(--text-tertiary)" }}>Available</div>
          <div className="badge" style={{ fontWeight:700, fontSize:"0.82rem", color:"var(--text-primary)" }}>
            {userPoints.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="tabs">
        {CATS.map(c => (
          <div key={c.key} className={`tab${activeCategory===c.key?" active":""}`}
               onClick={()=>setActiveCategory(c.key)}>
            {c.label}
          </div>
        ))}
      </div>

      {/* Rewards list */}
      {filtered.length > 0 ? (
        <article className="panel" style={{ padding:0 }}>
          {filtered.map((reward, i) => (
            <div key={reward.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
              <RewardItem reward={reward} userPoints={userPoints} onClaim={handleClaim} />
            </div>
          ))}
        </article>
      ) : (
        <article className="panel" style={{ textAlign:"center", padding:"40px 20px" }}>
          <p style={{ color:"var(--text-tertiary)", fontSize:"0.82rem" }}>No rewards in this category.</p>
        </article>
      )}

      {/* Claimed summary */}
      {claimedRewards.length > 0 && (
        <article className="panel" style={{ marginTop:4 }}>
          <h2>Claimed Today — {claimedRewards.length}</h2>
          <p style={{ color:"var(--text-tertiary)", fontSize:"0.80rem" }}>
            Nice work! Come back tomorrow for more rewards.
          </p>
        </article>
      )}
    </section>
  );
}
