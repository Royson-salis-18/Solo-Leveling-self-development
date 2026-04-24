import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { syncProgression, showProgressionToast } from "../lib/levelEngine";
import { Plus, Trash2, Gift, Zap } from "lucide-react";
import { ITEM_CATALOG, SHADOW_CATALOG } from "../lib/catalog";

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
  { key: "instant", label: "Instant" },
  { key: "medium",  label: "Medium" },
  { key: "major",   label: "Major" },
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

  useEffect(() => {
    if (!supabase || !user) return;
    (async () => {
      const [rRes, pRes, profRes] = await Promise.all([
        supabase.from("rewards").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("punishments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("user_profiles").select("total_points").eq("user_id", user.id).single(),
      ]);
      setRewards(rRes.data ?? []);
      setPunishments(pRes.data ?? []);
      setProfile(profRes.data);
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
    if (!supabase || !user || reward.is_claimed || (profile?.total_points ?? 0) < reward.xp_cost) return;
    
    // Check if reward matches an item or shadow
    const catalogItem = ITEM_CATALOG.find(i => i.name.toLowerCase() === reward.name.toLowerCase());
    const catalogShadow = SHADOW_CATALOG.find(s => s.name.toLowerCase() === reward.name.toLowerCase());

    if (catalogItem) {
      await supabase.from("inventory").insert({
        user_id: user.id,
        name: catalogItem.name,
        description: catalogItem.description,
        item_type: catalogItem.item_type,
        item_category: catalogItem.item_category,
        rarity: catalogItem.rarity,
        quantity: 1
      });
    } else if (catalogShadow) {
      await supabase.from("shadows").insert({
        user_id: user.id,
        name: catalogShadow.name,
        rarity: catalogShadow.rarity,
        bonus_type: "xp_boost",
        bonus_value: (catalogShadow as any).bonus || 0.05
      });
    }

    await supabase.from("rewards").update({ is_claimed: true, claimed_at: new Date().toISOString() }).eq("id", reward.id);
    await supabase.from("user_profiles").update({ total_points: (profile?.total_points ?? 0) - reward.xp_cost }).eq("user_id", user.id);
    setRewards(rs => rs.map(r => r.id === reward.id ? { ...r, is_claimed: true } : r));
    setProfile(p => p ? { ...p, total_points: p.total_points - reward.xp_cost } : p);
    // Auto-sync level / rank / title
    const progression = await syncProgression(supabase, user.id);
    showProgressionToast(progression);
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
    await supabase.from("punishments").update({ triggered: p.triggered + 1 }).eq("id", p.id);
    const newPoints = Math.max(0, (profile?.total_points ?? 0) - p.xp_penalty);
    await supabase.from("user_profiles").update({ total_points: newPoints }).eq("user_id", user.id);
    setPunishments(ps => ps.map(x => x.id === p.id ? { ...x, triggered: x.triggered + 1 } : x));
    setProfile(prof => prof ? { ...prof, total_points: newPoints } : prof);
    // Auto-sync level / rank / title
    const progression = await syncProgression(supabase, user.id);
    showProgressionToast(progression);
  };

  const handleDeletePunishment = async (id: string) => {
    if (!supabase || !user) return;
    await supabase.from("punishments").delete().eq("id", id);
    setPunishments(ps => ps.filter(p => p.id !== id));
  };

  const filteredRewards = rewards.filter(r => activeFilter === "all" || r.tier === activeFilter);
  const availableXP = profile?.total_points ?? 0;

  const tierColor = (tier: string) => {
    if (tier === "major")   return "rgba(255,220,100,0.70)";
    if (tier === "medium")  return "rgba(180,200,255,0.65)";
    return "rgba(200,255,200,0.60)";
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Rewards & Penalties</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: "0.76rem", color: "var(--t3)" }}>Available</div>
          <div className="badge" style={{ fontSize: "0.90rem", fontWeight: 700, padding: "5px 14px" }}>
            {availableXP.toLocaleString()} XP
          </div>
        </div>
      </div>

      {/* ── Main tabs ── */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab${tab === "rewards" ? " active" : ""}`} onClick={() => setTab("rewards")}>
          <Gift size={13} /> Rewards
          <span className="badge-counter">{rewards.length}</span>
        </div>
        <div className={`tab${tab === "punishments" ? " active" : ""}`} onClick={() => setTab("punishments")}>
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
              {(["all", "instant", "medium", "major"] as const).map(k => (
                <div key={k} className={`tab${activeFilter === k ? " active" : ""}`} onClick={() => setActiveFilter(k)}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </div>
              ))}
            </div>
            <Button variant="primary" size="sm" onClick={() => setShowRewardModal(true)}>
              <Plus size={13} /> Add Reward
            </Button>
          </div>

          {filteredRewards.length === 0 ? (
            <article className="panel panel-empty">
              <div style={{ fontSize: "2rem", opacity: 0.2, marginBottom: 12 }}>◎</div>
              <p className="text-muted text-sm">No rewards yet. Add one to motivate yourself!</p>
            </article>
          ) : (
            <article className="panel panel-no-pad">
              {filteredRewards.map((reward, i) => {
                const canAfford = availableXP >= reward.xp_cost && !reward.is_claimed;
                return (
                  <div
                    key={reward.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 20px",
                      borderBottom: i < filteredRewards.length - 1 ? "1px solid var(--border-0)" : "none",
                      opacity: reward.is_claimed ? 0.45 : 1,
                    }}
                  >
                    {/* Tier dot */}
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: tierColor(reward.tier), flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.90rem", fontWeight: 500, color: "var(--t1)", marginBottom: 3 }}>
                        {reward.name}
                      </div>
                      <div style={{ fontSize: "0.70rem", color: "var(--t3)", textTransform: "capitalize" }}>
                        {reward.tier}{reward.is_claimed ? " · Claimed" : ""}
                      </div>
                    </div>

                    <div style={{ fontSize: "0.92rem", fontWeight: 700, color: canAfford ? "var(--t1)" : "var(--t3)", marginRight: 12 }}>
                      {reward.xp_cost.toLocaleString()} XP
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      {!reward.is_claimed && (
                        <Button variant={canAfford ? "success" : "secondary"} size="sm" onClick={() => handleClaimReward(reward)} disabled={!canAfford}>
                          Claim
                        </Button>
                      )}
                      <button
                        onClick={() => handleDeleteReward(reward.id)}
                        style={{ background: "none", border: "none", color: "rgba(255,80,80,0.45)", cursor: "pointer", padding: "4px 6px", borderRadius: "var(--r-sm)", transition: "color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,80,80,0.85)")}
                        onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,80,80,0.45)")}
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
          {/* ── Punishments ── */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <Button variant="danger" size="sm" onClick={() => setShowPunishModal(true)}>
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
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,100,100,0.60)", flexShrink: 0 }} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.90rem", fontWeight: 500, color: "var(--t1)", marginBottom: 3 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: "0.70rem", color: "var(--t3)" }}>
                      Triggered {p.triggered} time{p.triggered !== 1 ? "s" : ""}
                    </div>
                  </div>

                  <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "rgba(255,130,130,0.85)", marginRight: 12 }}>
                    -{p.xp_penalty} XP
                  </div>

                  <div style={{ display: "flex", gap: 6 }}>
                    <Button variant="danger" size="sm" onClick={() => handleTriggerPunishment(p)}>
                      Apply
                    </Button>
                    <button
                      onClick={() => handleDeletePunishment(p.id)}
                      style={{ background: "none", border: "none", color: "rgba(255,80,80,0.45)", cursor: "pointer", padding: "4px 6px", borderRadius: "var(--r-sm)", transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,80,80,0.85)")}
                      onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,80,80,0.45)")}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
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
    </section>
  );
}
