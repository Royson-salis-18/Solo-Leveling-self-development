import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Flame, Lock, Plus, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { SystemAPI } from "../services/SystemAPI";
import { SYSTEM_PUNISHMENTS, SYSTEM_REWARDS } from "../lib/catalog";
import { REWARD_TIERS, hoursLeft, nextGoal, rewardChecks, tierRule } from "../lib/rewardRules";
import { requestEngagementRefresh } from "../lib/engagement";
import { haptic } from "../lib/feedback";
import "../components/mobile/mobile.css";
import "../components/mobile/sheets.css";
import "./mobile-rewards.css";

type Reward = { id: string; name: string; xp_cost: number; tier: string; is_claimed: boolean; claimed_at?: string | null; system_key?: string };
type Punishment = { id: string; name: string; xp_penalty: number; triggered: number };
type Claim = { id: string; system_key: string | null; reward_id: string | null; name: string; claimed_at: string; expires_at: string };
type Gate = { id: string; title: string };
type Tab = "rewards" | "debt";

const isSystem = (id: string) => id.startsWith("sys-");
const DESC = new Map<string, string>(SYSTEM_REWARDS.map((r) => [r.id, r.description]));
const PUNISH_DESC = new Map<string, string>(SYSTEM_PUNISHMENTS.map((p) => [p.id, p.description]));
const asSystem = (r: { id: string; name: string; xp_cost: number; tier: string }): Reward => ({ id: r.id, system_key: r.id, name: r.name, xp_cost: r.xp_cost, tier: r.tier, is_claimed: false });

export function MobileRewards() {
  const { user, profile, applyProfilePatch } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<Tab>("rewards");
  const [filter, setFilter] = useState<string>("all");
  const [builtIn, setBuiltIn] = useState<Reward[]>(SYSTEM_REWARDS.map(asSystem));
  const [custom, setCustom] = useState<Reward[]>([]);
  const [punishments, setPunishments] = useState<Punishment[]>(SYSTEM_PUNISHMENTS.map((p) => ({ id: p.id, name: p.name, xp_penalty: p.xp_penalty, triggered: 0 })));
  const [claims, setClaims] = useState<Claim[]>([]);
  const [gates, setGates] = useState<Gate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<Reward | null>(null);
  const [trigger, setTrigger] = useState("");
  const [adding, setAdding] = useState<"reward" | "punishment" | null>(null);
  const [form, setForm] = useState({ name: "", cost: "100", tier: "1", penalty: "25" });

  const xp = profile?.total_points ?? 0;
  const darkMana = profile?.dark_mana ?? 0;
  const standing = { streak: profile?.streak_count ?? 0, rank: profile?.player_rank ?? "E", darkMana, xp };

  const load = useCallback(async () => {
    if (!supabase || !user) { setLoading(false); return; }
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const [sys, rw, pn, cl, gt] = await Promise.all([
      supabase.from("system_rewards").select("key, name, xp_cost, tier").order("xp_cost", { ascending: true }),
      supabase.from("rewards").select("id, name, xp_cost, tier, is_claimed, claimed_at").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("punishments").select("id, name, xp_penalty, triggered").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("reward_claims").select("id, system_key, reward_id, name, trigger_gate_id, claimed_at, expires_at").eq("user_id", user.id).order("claimed_at", { ascending: false }).limit(30),
      supabase.from("tasks").select("id, title").eq("user_id", user.id).eq("is_completed", true).eq("is_failed", false).gte("completed_at", since).order("completed_at", { ascending: false }).limit(15),
    ]);
    if (sys.data?.length) setBuiltIn(sys.data.map((r) => asSystem({ id: r.key, name: r.name, xp_cost: r.xp_cost, tier: r.tier })));
    setCustom((rw.data ?? []) as Reward[]);
    setPunishments([
      ...SYSTEM_PUNISHMENTS.map((p) => ({ id: p.id, name: p.name, xp_penalty: p.xp_penalty, triggered: 0 })),
      ...((pn.data ?? []) as Punishment[]),
    ]);
    const used = new Set((cl.data ?? []).map((c: { trigger_gate_id?: string }) => c.trigger_gate_id).filter(Boolean));
    setClaims((cl.data ?? []) as Claim[]);
    setGates(((gt.data ?? []) as Gate[]).filter((g) => !used.has(g.id)));
    setLoading(false);
  }, [user]);
  useEffect(() => { void load(); }, [load]);

  const rewards = useMemo(() => [...builtIn, ...custom].filter((r) => !r.is_claimed || !r.system_key).sort((a, b) => a.xp_cost - b.xp_cost), [builtIn, custom]);
  const shown = rewards.filter((r) => filter === "all" || r.tier === filter);
  const goal = nextGoal(rewards, xp);
  const activeOf = (r: Reward) => claims.find((c) => (r.system_key ? c.system_key === r.system_key : c.reward_id === r.id) && new Date(c.expires_at).getTime() > Date.now());
  const activeClaims = rewards.map((r) => ({ r, c: activeOf(r) })).filter((x) => x.c);

  const claim = async (r: Reward) => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await SystemAPI.claimReward({ rewardId: r.system_key ? undefined : r.id, systemKey: r.system_key, triggerGateId: trigger || null });
      applyProfilePatch(res.profile);
      haptic("success");
      toast.success("Reward manifested", `${res.name}. Enjoy it within 72 hours.`);
      setOpen(null); setTrigger("");
      requestEngagementRefresh();
      await load();
    } catch (e) { haptic("warn"); toast.fail(e, "Could not claim the reward"); } finally { setBusy(false); }
  };

  const addReward = async () => {
    const cost = Math.max(1, parseInt(form.cost, 10) || 0);
    if (!supabase || !user || !form.name.trim() || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("rewards").insert({ user_id: user.id, name: form.name.trim(), xp_cost: cost, tier: form.tier })
      .select("id, name, xp_cost, tier, is_claimed, claimed_at").single();
    setBusy(false);
    if (error) { toast.fail(error, "Could not add the reward"); return; }
    if (data) setCustom((c) => [data as Reward, ...c]);
    setForm({ ...form, name: "" }); setAdding(null); haptic("success");
  };
  const deleteReward = async (r: Reward) => {
    if (!supabase || isSystem(r.id)) return;
    const ok = await confirm({ title: "Delete this reward?", message: `“${r.name}” will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const { error } = await supabase.from("rewards").delete().eq("id", r.id);
    if (error) { toast.fail(error, "Could not delete"); return; }
    setCustom((c) => c.filter((x) => x.id !== r.id)); setOpen(null);
  };

  const addPunishment = async () => {
    const pen = Math.max(1, parseInt(form.penalty, 10) || 0);
    if (!supabase || !user || !form.name.trim() || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("punishments").insert({ user_id: user.id, name: form.name.trim(), xp_penalty: pen }).select("id, name, xp_penalty, triggered").single();
    setBusy(false);
    if (error) { toast.fail(error, "Could not add it"); return; }
    if (data) setPunishments((p) => [...p, data as Punishment]);
    setForm({ ...form, name: "" }); setAdding(null); haptic("success");
  };
  const deletePunishment = async (p: Punishment) => {
    if (!supabase || isSystem(p.id)) return;
    const { error } = await supabase.from("punishments").delete().eq("id", p.id);
    if (error) { toast.fail(error, "Could not delete"); return; }
    setPunishments((ps) => ps.filter((x) => x.id !== p.id));
  };
  const redeem = async (p: Punishment) => {
    if (busy) return;
    const cleared = Math.min(p.xp_penalty, darkMana);
    const ok = await confirm({
      title: "Accept this punishment?",
      message: `Clears ${cleared} Dark Mana and costs ${Math.floor(cleared * 1.5)} XP.\n\nOnly accept it once you have actually done it: “${p.name}”.`,
      confirmLabel: "I did it, redeem", danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await SystemAPI.redeemDarkMana(p.xp_penalty, isSystem(p.id) ? null : p.id);
      applyProfilePatch(res.profile);
      haptic("success");
      toast.success("Debt cleansed", `−${res.dark_mana_cleared} Dark Mana · −${res.xp_cost} XP`);
      requestEngagementRefresh(); await load();
    } catch (e) { toast.fail(e, "Could not redeem"); } finally { setBusy(false); }
  };

  const sel = open ? rewardChecks(open.tier, open.xp_cost, standing, !!trigger) : null;
  const needsGate = open ? tierRule(open.tier).needsTrigger : false;

  return (
    <div className="mr">
      <header className="mr-head"><h1>Rewards</h1></header>

      <section className="mr-bal" aria-label="Balance">
        <div className="mr-bal-top">
          <div><small>XP to spend</small><b>{xp.toLocaleString()}</b></div>
          {darkMana > 0 && <button className="mr-debt" onClick={() => setTab("debt")} aria-label={`${darkMana} Dark Mana. Open debt.`}><Flame size={13} /> {darkMana} Dark Mana</button>}
        </div>
        {goal ? (
          <div className="mr-goal"><div className="mr-goal-top"><span>Next: {goal.name}</span><em>{goal.remaining.toLocaleString()} XP away</em></div><div className="mr-bar"><i style={{ width: `${goal.pct}%` }} /></div></div>
        ) : <p className="mr-note">You can afford every reward. Earn something worth celebrating.</p>}
      </section>

      <div className="mr-seg" role="tablist" aria-label="Rewards or debt">
        <button role="tab" aria-selected={tab === "rewards"} className={tab === "rewards" ? "on" : ""} onClick={() => setTab("rewards")}>Rewards<i>{rewards.length}</i></button>
        <button role="tab" aria-selected={tab === "debt"} className={tab === "debt" ? "on" : ""} onClick={() => setTab("debt")}>Debt{darkMana > 0 && <i className="warn">{darkMana}</i>}</button>
      </div>

      {loading && <div className="mr-skel" aria-hidden="true" />}

      {!loading && tab === "rewards" && (
        <>
          {activeClaims.length > 0 && (
            <section className="mr-active" aria-label="Active rewards">
              <h2>Active now</h2>
              {activeClaims.map(({ r, c }) => <div key={r.id} className="mr-active-row"><Check size={15} /><span>{r.name}</span><em>{hoursLeft(c!.expires_at)}h left</em></div>)}
            </section>
          )}

          <div className="mr-filter" role="radiogroup" aria-label="Tier">
            {["all", ...REWARD_TIERS.map((t) => t.tier)].map((k) => (
              <button key={k} role="radio" aria-checked={filter === k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{k === "all" ? "All" : `T${k}`}</button>
            ))}
          </div>

          <div className="mr-list">
            {shown.length === 0 && <p className="mr-empty">Nothing in this tier yet.</p>}
            {shown.map((r) => {
              const c = activeOf(r);
              const st = rewardChecks(r.tier, r.xp_cost, standing, gates.length > 0);
              const affordable = xp >= r.xp_cost;
              return (
                <button key={r.id} className={`mr-row${r.is_claimed ? " done" : ""}`} onClick={() => { setOpen(r); setTrigger(""); haptic("tap"); }} aria-label={`${r.name}, tier ${r.tier}, ${r.xp_cost} XP`}>
                  <span className={`mr-tier t${r.tier}`}>T{r.tier}</span>
                  <span className="mr-main">
                    <span className="mr-name">{r.name}</span>
                    <small className={c ? "ok" : st.ready ? "ok" : "lock"}>{c ? `Active · ${hoursLeft(c.expires_at)}h left` : r.is_claimed ? "Claimed" : st.ready ? (tierRule(r.tier).needsTrigger ? "Ready · pick an anchor gate" : "Ready") : <><Lock size={10} /> {st.short}</>}</small>
                  </span>
                  <span className={`mr-cost${affordable ? " can" : ""}`}>{r.xp_cost.toLocaleString()}<small>XP</small></span>
                  <ChevronRight size={15} className="mr-chev" />
                </button>
              );
            })}
          </div>
          <button className="mr-add" onClick={() => { setAdding("reward"); setForm({ ...form, name: "" }); }}><Plus size={16} /> Add your own reward</button>

          <details className="mr-rules">
            <summary>How rewards work</summary>
            <ul>
              <li>Rewards are paid from XP you have earned. Higher tiers need a longer streak and a higher rank.</li>
              <li>Tier 2 to 4 need an anchor: a gate you conquered in the last 48 hours.</li>
              <li>Tier 3 and up stay locked while you carry Dark Mana.</li>
              <li>A claimed reward is yours for 72 hours. Spending XP never lowers your level or rank.</li>
            </ul>
          </details>
        </>
      )}

      {!loading && tab === "debt" && (
        <>
          {darkMana > 0 ? (
            <section className="mr-danger" aria-label="Dark Mana debt">
              <div className="mr-danger-top"><Flame size={16} /><h2>{darkMana} Dark Mana</h2></div>
              <p>You are in debt. Do a punishment for real, then redeem it here. Redeeming costs 1.5× its Dark Mana in XP, so a debt is cheaper to avoid than to clear.</p>
              <div className="mr-list">
                {punishments.map((p) => (
                  <div key={p.id} className="mr-prow">
                    <span className="mr-pdot" />
                    <span className="mr-main"><span className="mr-name">{p.name}</span><small>{PUNISH_DESC.get(p.id) ?? `Clears up to ${p.xp_penalty} Dark Mana`}</small></span>
                    <button className="mr-redeem" disabled={busy} onClick={() => redeem(p)}>Redeem<small>−{p.xp_penalty}</small></button>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="mr-clear"><div className="mr-clear-ico"><Check size={24} /></div><h3>No debt</h3><p>Your Dark Mana is at zero, so every tier is open to you. Miss a gate and it starts to build.</p></div>
          )}

          <div className="mr-sec"><h2>Your registry</h2><button onClick={() => { setAdding("punishment"); setForm({ ...form, name: "" }); }}><Plus size={14} /> Add</button></div>
          <div className="mr-list">
            {punishments.filter((p) => !isSystem(p.id)).length === 0 && <p className="mr-empty">Add a penalty you'll actually do, like “10 minutes of cleaning”.</p>}
            {punishments.filter((p) => !isSystem(p.id)).map((p) => (
              <div key={p.id} className="mr-prow">
                <span className="mr-pdot dim" />
                <span className="mr-main"><span className="mr-name">{p.name}</span><small>Used {p.triggered} time{p.triggered === 1 ? "" : "s"}</small></span>
                <span className="mr-cost">{p.xp_penalty}<small>XP</small></span>
                <button className="mr-del" onClick={() => deletePunishment(p)} aria-label={`Delete ${p.name}`}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </>
      )}

      {open && sel && createPortal(
        <div className="sh-bg" onClick={() => setOpen(null)}>
          <div className="sh" role="dialog" aria-modal="true" aria-label={open.name} onClick={(e) => e.stopPropagation()}>
            <div className="sh-grab" />
            <header className="sh-head"><h2 style={{ fontSize: "1.2rem" }}>{open.name}</h2><button className="m-icon-btn" onClick={() => setOpen(null)} aria-label="Close"><X size={20} /></button></header>
            <div className="sh-meta"><span>Tier {open.tier} · {tierRule(open.tier).name}</span><span>{open.xp_cost.toLocaleString()} XP</span><span>72 hours to enjoy</span></div>
            {DESC.get(open.id) && <p className="mr-desc">{DESC.get(open.id)}</p>}

            <ul className="mr-checks" aria-label="Requirements">
              {sel.checks.map((c) => <li key={c.key} className={c.ok ? "ok" : "no"}>{c.ok ? <Check size={14} /> : <X size={14} />}{c.label}</li>)}
            </ul>

            {needsGate && (
              <div className="mr-gates">
                <div className="mr-gates-h">Anchor gate <em>conquered in the last 48h</em></div>
                {gates.length === 0 ? <p className="mr-note">Conquer a gate first. It anchors the reward.</p> : (
                  <div className="sh-chips" role="radiogroup" aria-label="Anchor gate">
                    {gates.map((g) => <button key={g.id} type="button" role="radio" aria-checked={trigger === g.id} className={trigger === g.id ? "on" : ""} onClick={() => setTrigger(trigger === g.id ? "" : g.id)}>{g.title}</button>)}
                  </div>
                )}
              </div>
            )}

            <button className="sh-go" disabled={busy || !sel.ready || open.is_claimed} onClick={() => claim(open)}>
              {busy ? "Claiming…" : open.is_claimed ? "Already claimed" : sel.ready ? `Claim for ${open.xp_cost.toLocaleString()} XP` : sel.blocker}
            </button>
            {!isSystem(open.id) && <button className="mr-link-danger" onClick={() => deleteReward(open)}><Trash2 size={14} /> Delete this reward</button>}
          </div>
        </div>,
        document.body
      )}

      {adding && createPortal(
        <div className="sh-bg" onClick={() => setAdding(null)}>
          <form className="sh" role="dialog" aria-modal="true" aria-label={adding === "reward" ? "New reward" : "New penalty"} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void (adding === "reward" ? addReward() : addPunishment()); }}>
            <div className="sh-grab" />
            <header className="sh-head"><h2>{adding === "reward" ? "New reward" : "New penalty"}</h2><button type="button" className="m-icon-btn" onClick={() => setAdding(null)} aria-label="Close"><X size={20} /></button></header>
            <input className="sh-title" autoFocus maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={adding === "reward" ? "Gaming session (2 hrs)" : "10 minutes of cleaning"} aria-label="Name" />
            {adding === "reward" ? (
              <>
                <div className="sh-label">Cost in XP</div>
                <input className="sh-date" inputMode="numeric" pattern="[0-9]*" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value.replace(/\D/g, "") })} aria-label="XP cost" />
                <div className="sh-label">Tier <em>{tierRule(form.tier).name}</em></div>
                <div className="sh-chips" role="radiogroup" aria-label="Tier">
                  {REWARD_TIERS.map((t) => <button key={t.tier} type="button" role="radio" aria-checked={form.tier === t.tier} className={form.tier === t.tier ? "on" : ""} onClick={() => setForm({ ...form, tier: t.tier })}>T{t.tier}</button>)}
                </div>
              </>
            ) : (
              <>
                <div className="sh-label">Dark Mana it clears</div>
                <input className="sh-date" inputMode="numeric" pattern="[0-9]*" value={form.penalty} onChange={(e) => setForm({ ...form, penalty: e.target.value.replace(/\D/g, "") })} aria-label="Penalty" />
              </>
            )}
            <button className="sh-go" type="submit" disabled={busy || !form.name.trim()}>{busy ? "Saving…" : "Add"}</button>
          </form>
        </div>,
        document.body
      )}
    </div>
  );
}
