import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";

import { Plus, Trash2, Gift, Zap } from "lucide-react";
import { SYSTEM_REWARDS, SYSTEM_PUNISHMENTS } from "../lib/catalog";

type Reward = {
  id: string;
  name: string;
  xp_cost: number;
  tier: "instant" | "medium" | "major";
  is_claimed: boolean;
  claimed_at: string | null;
};

type Punishment = {
  id: string;
  name: string;
  xp_penalty: number;
  triggered: number;
};

const TIER_OPTS = [
  { key: "1", label: "Tier 1: Indulgence", streak: 3,  rank: "E", xp: 25 },
  { key: "2", label: "Tier 2: Comfort",    streak: 7,  rank: "C", xp: 150 },
  { key: "3", label: "Tier 3: Leisure",    streak: 14, rank: "B", xp: 400 },
  { key: "4", label: "Tier 4: Splurge",    streak: 21, rank: "A", xp: 800 },
  { key: "5", label: "Tier 5: Legendary",  streak: 60, rank: "S", xp: 3000 },
];

const EMPTY_REWARD = { name: "", xp_cost: 100, tier: "instant" as const };
const EMPTY_PUNISH = { name: "", xp_penalty: 25 };

export function RewardsPage() {
  const { user } = useAuth();
  const [rewards,     setRewards]     = useState<Reward[]>([]);
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [profile,     setProfile]     = useState<{ total_points: number } | null>(null);
  const [tab,         setTab]         = useState<"rewards" | "punishments">("rewards");
  const [activeFilter, setActiveFilter] = useState<"all" | "instant" | "medium" | "major">("all");
  const [showRewardModal,  setShowRewardModal]  = useState(false);
  const [showPunishModal,  setShowPunishModal]  = useState(false);
  const [rewardForm,  setRewardForm]  = useState(EMPTY_REWARD);
  const [punishForm,  setPunishForm]  = useState(EMPTY_PUNISH);
  const [loading,     setLoading]     = useState(true);
  const [darkMana,    setDarkMana]    = useState(0);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [recentGates, setRecentGates] = useState<any[]>([]);
  const [selectedGate, setSelectedGate] = useState<string>("");

  const location = useLocation();

  useEffect(() => {
    if (location.hash === "#punishments") {
      setTab("punishments");
    } else if (location.hash === "#rewards") {
      setTab("rewards");
    }
  }, [location.hash]);

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [rRes, pRes, profRes, gateRes] = await Promise.all([
        supabase.from("rewards").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("punishments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("tasks").select("id, title, completed_at").eq("user_id", user.id).eq("is_completed", true).order("completed_at", { ascending: false }).limit(10),
      ]);
      setRewards([...SYSTEM_REWARDS, ...(rRes.data ?? [])] as any);
      setPunishments([...SYSTEM_PUNISHMENTS, ...(pRes.data ?? [])] as any);
      setProfile(profRes.data);
      setUserProfile(profRes.data);
      setDarkMana(profRes.data?.dark_mana || 0);
      setRecentGates(gateRes.data ?? []);
      setLoading(false);
    })();
  }, [user]);

  const handleAddReward = async () => {
    if (!supabase || !user || !rewardForm.name.trim()) return;
    const { data } = await supabase.from("rewards").insert({
      user_id: user.id,
      name: rewardForm.name,
      xp_cost: rewardForm.xp_cost,
      tier: rewardForm.tier,
    }).select().single();
    if (data) setRewards(r => [data, ...r]);
    setRewardForm(EMPTY_REWARD);
    setShowRewardModal(false);
  };

  const handleClaimReward = async (reward: Reward) => {
    if (!supabase || !user || reward.is_claimed) return;
    
    const tierRule = TIER_OPTS.find(t => t.key === reward.tier);
    if (tierRule && (parseInt(reward.tier) >= 2) && !selectedGate) {
      alert("⚠️ TRIGGER REQUIRED: Select a recently conquered gate to manifest this reward.");
      return;
    }

    try {
      const { SystemAPI } = await import("../services/SystemAPI");
      const res = await SystemAPI.claimReward(user.id, reward, selectedGate || undefined);
      
      setRewards(rs => rs.map(r => r.id === reward.id ? { ...r, is_claimed: true } : r));
      setProfile(p => p ? { ...p, total_points: p.total_points - reward.xp_cost } : p);
      alert(`✨ REWARD MANIFESTED! Claim window: 72 hours. Expires: ${new Date(res.expires_at).toLocaleString()}`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteReward = async (id: string) => {
    if (!supabase || !user) return;
    await supabase.from("rewards").delete().eq("id", id);
    setRewards(rs => rs.filter(r => r.id !== id));
  };

  const handleAddPunishment = async () => {
    if (!supabase || !user || !punishForm.name.trim()) return;
    const { data } = await supabase.from("punishments").insert({
      user_id: user.id,
      name: punishForm.name,
      xp_penalty: punishForm.xp_penalty,
    }).select().single();
    if (data) setPunishments(p => [data, ...p]);
    setPunishForm(EMPTY_PUNISH);
    setShowPunishModal(false);
  };

  const handleTriggerPunishment = async (p: Punishment) => {
    if (!supabase || !user) return;
    
    try {
      const { SystemAPI } = await import("../services/SystemAPI");
      await SystemAPI.redeemDarkMana(user.id, p.xp_penalty);
      
      setDarkMana(prev => Math.max(0, prev - p.xp_penalty));
      setPunishments(ps => ps.map(x => x.id === p.id ? { ...x, triggered: x.triggered + 1 } : x));
      
      const [rRes, profRes] = await Promise.all([
        supabase.from("rewards").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("total_points, dark_mana").eq("user_id", user.id).single(),
      ]);
      setRewards(rRes.data ?? []);
      setProfile(profRes.data);
      
      alert(`⚖️ SYSTEM: Punishment Accepted. Dark Mana reduced by ${p.xp_penalty}. Dual-cost applied (1.5x XP).`);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeletePunishment = async (id: string) => {
    if (!supabase || !user) return;
    await supabase.from("punishments").delete().eq("id", id);
    setPunishments(ps => ps.filter(p => p.id !== id));
  };

  const filteredRewards = rewards.filter(r => activeFilter === "all" || r.tier === activeFilter);
  const availableXP = profile?.total_points ?? 0;



  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Rewards & Penalties</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: "0.76rem", color: "var(--t3)" }}>Mana</div>
          <div className="badge" style={{ fontSize: "0.90rem", fontWeight: 700, padding: "5px 14px", border: '1px solid var(--accent-primary)' }}>
            {availableXP.toLocaleString()} XP
          </div>
          {darkMana > 0 && (
            <div className="badge dark-mana-badge" style={{ fontSize: "0.90rem", fontWeight: 700, padding: "5px 14px" }}>
              {darkMana.toLocaleString()} Dark Mana
            </div>
          )}
        </div>
      </div>

      {/* ── Rule of Reward Panel (V5) ── */}
      <div className="panel" style={{ background: "rgba(30,30,60,0.4)", border: "1px solid var(--border-1)", marginBottom: 24 }}>
        <h3 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-primary)", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: 12 }}>
          📜 THE RULE OF REWARD
        </h3>
        <p className="text-muted" style={{ fontSize: "0.78rem", lineHeight: 1.5, marginBottom: 10 }}>
          Rewards are not gifts; they are manifested from excess mana. To stabilize a reward, the System enforces strict requirements based on Tier. High-tier manifestations (Tier 2+) require a **Trigger Gate** — a mission completed in the last 48 hours to serve as an anchor.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: "0.72rem", color: "var(--t3)" }}>
          <div>• 72-Hour Claim Window: Manifestations expire in 3 days.</div>
          <div>• Expiration Penalty: -1 Day Streak if not claimed.</div>
          <div>• Mana Block: Tier 3+ locked if Dark Mana &gt; 0.</div>
          <div>• Integrity: Dual-cost applied to all redemptions.</div>
        </div>
      </div>

      {/* ── Main tabs ── */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab${tab === "rewards" ? " active" : ""}`} onClick={() => setTab("rewards")}>
          <Gift size={13} /> Rewards
          <span className="badge-counter">{rewards.length}</span>
        </div>
        <div className={`tab${tab === "punishments" ? " active" : ""} ${darkMana > 0 ? 'dark-mana-alert' : ''}`} onClick={() => setTab("punishments")}>
          <Zap size={13} /> Punishments
          <span className="badge-counter">{punishments.length}</span>
        </div>
      </div>

      {loading ? (
        <div className="panel panel-empty text-muted text-sm">Loading…</div>
      ) : tab === "rewards" ? (
        <>
          {/* ── Reward filters + add ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="tabs" style={{ marginBottom: 0 }}>
              {(["all", "1", "2", "3", "4", "5"] as const).map(k => (
                <div key={k} className={`tab${activeFilter === k ? " active" : ""}`} onClick={() => setActiveFilter(k as any)}>
                  {k === "all" ? "All" : `T${k}`}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {parseInt(activeFilter) >= 2 && (
                <select 
                  className="form-select" 
                  style={{ width: 200, height: 32, fontSize: '0.75rem', padding: '0 8px' }}
                  value={selectedGate}
                  onChange={(e) => setSelectedGate(e.target.value)}
                >
                  <option value="">Select Trigger Gate...</option>
                  {recentGates.map(g => (
                    <option key={g.id} value={g.id}>{g.title}</option>
                  ))}
                </select>
              )}
              <Button variant="primary" size="sm" onClick={() => setShowRewardModal(true)}>
                <Plus size={13} /> Add Reward
              </Button>
            </div>
          </div>

          {filteredRewards.length === 0 ? (
            <article className="panel panel-empty">
              <div style={{ fontSize: "2rem", opacity: 0.2, marginBottom: 12 }}>◎</div>
              <p className="text-muted text-sm">No rewards yet. Add one to motivate yourself!</p>
            </article>
          ) : (
            <article className="panel panel-no-pad">
              {filteredRewards.map((reward, i) => {
                return (
                  <div
                    key={reward.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                      borderBottom: i < filteredRewards.length - 1 ? "1px solid var(--border-0)" : "none",
                      opacity: reward.is_claimed ? 0.45 : 1,
                      position: 'relative'
                    }}
                  >
                    {/* Tier Indicator */}
                    <div className={`tier-tag tier-${reward.tier}`}>T{reward.tier}</div>
                    {reward.id?.toString().startsWith('sys-') && (
                      <div className="badge" style={{ fontSize: '0.6rem', padding: '1px 6px', background: 'rgba(255,255,255,0.1)', color: 'var(--accent-primary)', marginLeft: 8 }}>SYSTEM</div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.90rem", fontWeight: 500, color: "var(--t1)", marginBottom: 3 }}>
                        {reward.name}
                      </div>
                      <div style={{ fontSize: "0.70rem", color: "var(--t3)", display: 'flex', gap: 8 }}>
                        {(() => {
                          const rule = TIER_OPTS.find(t => t.key === reward.tier);
                          if (!rule) return null;
                          const streakMet = (userProfile?.streak_count || 0) >= rule.streak;
                          const rankOrder = ["E", "D", "C", "B", "A", "S", "SS"];
                          const rankMet = rankOrder.indexOf(userProfile?.player_rank || "E") >= rankOrder.indexOf(rule.rank);
                          return (
                            <>
                              <span style={{ color: streakMet ? 'var(--success)' : 'var(--error-low)' }}>Streak: {rule.streak}d</span>
                              <span style={{ color: rankMet ? 'var(--success)' : 'var(--error-low)' }}>Rank: {rule.rank}+</span>
                              {parseInt(reward.tier) >= 3 && (
                                <span style={{ color: (userProfile?.dark_mana || 0) === 0 ? 'var(--success)' : 'var(--error-low)' }}>Mana: Clear</span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ fontSize: "0.92rem", fontWeight: 700, color: availableXP >= reward.xp_cost ? "var(--t1)" : "var(--t3)", marginRight: 12 }}>
                      {reward.xp_cost.toLocaleString()} XP
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      {!reward.is_claimed && (
                        <Button variant={availableXP >= reward.xp_cost ? "success" : "secondary"} size="sm" onClick={() => handleClaimReward(reward)}>
                          Claim
                        </Button>
                      )}
                      <button
                        onClick={() => handleDeleteReward(reward.id)}
                        style={{ background: "none", border: "none", color: "rgba(255,80,80,0.45)", cursor: "pointer", padding: "4px 6px", borderRadius: "var(--r-sm)", transition: "color 0.15s" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </article>
          )}
        </>
      ) : (
        <>
          {/* ── Active Mana Debt Redemption ── */}
          {darkMana > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Zap size={16} color="#ff4444" />
                <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "#ff4444", margin: 0, textTransform: "uppercase", letterSpacing: "1px" }}>
                  Active Mana Debt Redemption
                </h3>
              </div>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                You are currently in debt. Claim a punishment below to cleanse Dark Mana. 
                <span style={{ color: "#ff4444", marginLeft: 5 }}>Note: Redemption also reduces your actual XP.</span>
              </p>

              {punishments.length === 0 ? (
                <article className="panel panel-empty">
                  <p className="text-muted text-sm">No punishment templates available. Add some in the Registry below.</p>
                </article>
              ) : (
                <article className="panel panel-no-pad" style={{ borderColor: "rgba(255, 68, 68, 0.3)", background: "rgba(20, 0, 0, 0.4)" }}>
                  {punishments.map((p, i) => (
                    <div
                      key={`active-${p.id}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                        borderBottom: i < punishments.length - 1 ? "1px solid rgba(255, 68, 68, 0.15)" : "none",
                      }}
                    >
                      <div className="dark-mana-pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "#ff4444", flexShrink: 0 }} />
                      {p.id?.toString().startsWith('sys-') && (
                        <div className="badge" style={{ fontSize: '0.55rem', padding: '1px 4px', background: '#ff4444', color: '#000', marginRight: 4 }}>SYSTEM</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "0.90rem", fontWeight: 500, color: "var(--t1)" }}>{p.name}</div>
                        <div style={{ fontSize: "0.70rem", color: "#ff4444", opacity: 0.8 }}>Redeem -{p.xp_penalty} Debt</div>
                      </div>
                      <Button variant="danger" size="sm" onClick={() => handleTriggerPunishment(p)} style={{ boxShadow: "0 0 10px rgba(255, 68, 68, 0.2)" }}>
                        Claim
                      </Button>
                    </div>
                  ))}
                </article>
              )}
            </div>
          )}

          {/* ── Punishment Registry ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--t2)", margin: 0 }}>Registry of Discipline</h3>
            <Button variant="secondary" size="sm" onClick={() => setShowPunishModal(true)}>
              <Plus size={13} /> Add Punishment
            </Button>
          </div>

          {punishments.length === 0 ? (
            <article className="panel panel-empty">
              <div style={{ fontSize: "2rem", opacity: 0.2, marginBottom: 12 }}>◎</div>
              <p className="text-muted text-sm">No punishments set. Add some to hold yourself accountable.</p>
            </article>
          ) : (
            <article className="panel panel-no-pad">
              {punishments.map((p, i) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                    borderBottom: i < punishments.length - 1 ? "1px solid var(--border-0)" : "none",
                  }}
                >
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,100,100,0.30)", flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.90rem", fontWeight: 500, color: "var(--t1)", marginBottom: 3 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: "0.70rem", color: "var(--t3)" }}>
                      Triggered {p.triggered} time{p.triggered !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--t3)", marginRight: 12 }}>
                    {p.xp_penalty} XP
                  </div>

                  <button
                    onClick={() => handleDeletePunishment(p.id)}
                    style={{ background: "none", border: "none", color: "rgba(255,80,80,0.45)", cursor: "pointer", padding: "4px 6px", borderRadius: "var(--r-sm)", transition: "color 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,80,80,0.85)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,80,80,0.45)")}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </article>
          )}
        </>
      )}

      {/* ── Add Reward Modal ── */}
      <Modal isOpen={showRewardModal} title="New Reward" onClose={() => setShowRewardModal(false)}
        footer={<><Button variant="secondary" onClick={() => setShowRewardModal(false)}>Cancel</Button><Button variant="primary" onClick={handleAddReward}>Add</Button></>}>
        <div className="form-group">
          <label className="form-label">Reward Name</label>
          <input className="form-input" placeholder="e.g. Gaming session (2 hrs)" value={rewardForm.name}
            onChange={e => setRewardForm({ ...rewardForm, name: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">XP Cost</label>
            <input type="number" min="1" className="form-input" value={rewardForm.xp_cost}
              onChange={e => setRewardForm({ ...rewardForm, xp_cost: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tier</label>
            <select className="form-select" value={rewardForm.tier}
              onChange={e => setRewardForm({ ...rewardForm, tier: e.target.value as any })}>
              {TIER_OPTS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* ── Add Punishment Modal ── */}
      <Modal isOpen={showPunishModal} title="New Punishment" onClose={() => setShowPunishModal(false)}
        footer={<><Button variant="secondary" onClick={() => setShowPunishModal(false)}>Cancel</Button><Button variant="danger" onClick={handleAddPunishment}>Add</Button></>}>
        <div className="form-group">
          <label className="form-label">Punishment</label>
          <input className="form-input" placeholder="e.g. Missed morning run" value={punishForm.name}
            onChange={e => setPunishForm({ ...punishForm, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">XP Penalty</label>
          <input type="number" min="1" className="form-input" value={punishForm.xp_penalty}
            onChange={e => setPunishForm({ ...punishForm, xp_penalty: parseInt(e.target.value) || 0 })} />
        </div>
      </Modal>
      
      <style>{`
        .dark-mana-badge {
          background: #000;
          color: #ff4444;
          border: 1px solid #ff4444;
          box-shadow: 0 0 15px rgba(255, 68, 68, 0.3);
          animation: darkPulse 2s infinite;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .dark-mana-alert {
          color: #ff4444 !important;
          border-bottom-color: #ff4444 !important;
          animation: darkPulse 2s infinite;
        }
        @keyframes darkPulse {
          0%, 100% { box-shadow: 0 0 5px #ff4444; border-color: rgba(255,68,68,0.4); }
          50% { box-shadow: 0 0 20px #ff4444; border-color: #ff4444; }
        }
        .dark-mana-pulse-dot {
          animation: dotPulse 1.5s infinite;
        }
        @keyframes dotPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .tier-tag {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .tier-1 { background: rgba(200,255,200,0.2); color: #8f8; border: 1px solid rgba(200,255,200,0.3); }
        .tier-2 { background: rgba(180,200,255,0.2); color: #8af; border: 1px solid rgba(180,200,255,0.3); }
        .tier-3 { background: rgba(255,220,100,0.2); color: #fb5; border: 1px solid rgba(255,220,100,0.3); }
        .tier-4 { background: rgba(255,100,100,0.2); color: #f88; border: 1px solid rgba(255,100,100,0.3); }
        .tier-5 { background: rgba(255,100,255,0.2); color: #f8f; border: 1px solid rgba(255,100,255,0.3); box-shadow: 0 0 10px rgba(255,100,255,0.2); }
      `}</style>
    </section>
  );
}
