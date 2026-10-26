import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Crown, Gem, Gift, Plus, Skull, Sparkles, Swords, Trophy } from "lucide-react";
import { ConquestRecord } from "../components/ConquestRecord";
import { PowerOrb, QuickActions } from "../components/visuals";
import { supabase } from "../lib/supabase";
import { ITEM_CATALOG, RARITY_COLORS, SHADOW_CATALOG } from "../lib/catalog";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useGameActions } from "../lib/gameActions";
import { SystemAPI } from "../services/SystemAPI";
import type { DashboardData } from "../lib/gameTypes";
import { useEngagement } from "../lib/engagementContext";
import { ENGAGEMENT_REFRESH_EVENT, bountyPercent, chestHint, clock, nextBestAction, percent } from "../lib/engagement";
import { Reveal } from "../components/EngagementPanel";
import { XP_PER_LEVEL } from "../lib/levelEngine";
import { firstSteps, haptic } from "../lib/feedback";
import { FirstSteps } from "../components/UxLayer";
import "../components/mobile/mobile.css";
import "./mobile-home.css";

const TIERS = [
  { id: "Low", label: "E", xp: 5 }, { id: "Mid", label: "C", xp: 15 }, { id: "High", label: "B", xp: 25 },
  { id: "Super", label: "A", xp: 35 }, { id: "Legendary", label: "S", xp: 50 },
] as const;
const RANK_OF: Record<string, string> = { Low: "E", Mid: "C", High: "B", Super: "A", Legendary: "S" };

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** Area sparkline: pure SVG, no chart library on the home screen. */
function Spark({ values }: { values: number[] }) {
  const w = 120, h = 48, pad = 3;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1), h - pad - (v / max) * (h - pad * 2)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mh-spark" aria-hidden="true">
      <defs><linearGradient id="mhg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#a894ff" stopOpacity=".55" /><stop offset="1" stopColor="#7c5cff" stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${last[0]},${h} L${pts[0][0]},${h} Z`} fill="url(#mhg)" />
      <path d={line} fill="none" stroke="#c4b5ff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#fff" />
    </svg>
  );
}

/** Dotted column chart (7 days × 6 dots) — the daily-activity texture from the design. */
function DotBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="mh-dots" aria-hidden="true">
      {values.map((v, i) => {
        const lit = v <= 0 ? 0 : Math.max(1, Math.round((v / max) * 6));
        return <div key={i} className="mh-dotcol">{Array.from({ length: 6 }, (_, k) => <i key={k} className={6 - k <= lit ? "on" : ""} />)}</div>;
      })}
    </div>
  );
}

export function MobileHome() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const actions = useGameActions();
  const eng = useEngagement();
  const e = eng.data;

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [title, setTitle] = useState("");
  const [tier, setTier] = useState<(typeof TIERS)[number]["id"]>("Mid");
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);          // conquest waiting out its undo window
  const armTimer = useRef<number | undefined>(undefined);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem("sl_first_steps") === "1"; } catch { return false; } });
  const [gear, setGear] = useState<Array<{ name: string; rarity: string; item_category: string }>>([]);

  const loadDash = useCallback(async () => {
    try { setDash(await SystemAPI.fetchDashboardData()); } catch { /* skeleton stays; engagement is independent */ }
  }, []);
  useEffect(() => {
    void loadDash();
    const on = () => void loadDash();
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, on);
    return () => window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, on);
  }, [loadDash]);

  useEffect(() => {
    if (!supabase || !profile?.user_id) return;
    supabase.from("inventory").select("name,rarity,item_category").eq("user_id", profile.user_id)
      .then(({ data }) => { if (data) setGear(data); });
  }, [profile?.user_id]);

  const name = (profile?.name ?? "Hunter").split(" ")[0];
  const standing = dash?.standing_xp ?? profile?.standing_xp ?? 0;
  const level = dash?.level ?? profile?.level ?? 1;
  const toNext = XP_PER_LEVEL - (Math.max(standing, 0) % XP_PER_LEVEL);
  const week = dash?.weeklyHistory ?? [];
  const weekPts = week.map((d) => d.daily_points);
  const streak = e?.streak.count ?? dash?.streak_count ?? 0;

  const headline = useMemo(() => {
    if (e?.streak.at_risk) return <>Hold your <b>{streak}-day</b> streak today.</>;
    if (streak > 0) return <>You’re on a <b>{streak}-day</b> streak.</>;
    return <>Start your streak <b>today</b>.</>;
  }, [e?.streak.at_risk, streak]);

  const addGate = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      await SystemAPI.saveGate({ title: t, category: "General", priority: "MEDIUM", xp_tier: tier }, null);
      setTitle("");
      haptic("success");
      toast.success("Gate opened", `${t} · ${RANK_OF[tier]}-rank`);
      void loadDash();
    } catch (err) { toast.fail(err, "Could not open gate"); } finally { setAdding(false); }
  };

  const conquer = async (id: string) => {
    if (completing) return;
    setCompleting(id);
    try { await actions.complete(id); void loadDash(); } finally { setCompleting(null); }
  };

  // A tap starts a short undo window instead of committing instantly: conquests can't be reversed
  // server-side, and a stray tap while scrolling is the most common mobile mistake.
  const arm = (id: string) => {
    if (armed || completing) return;
    haptic("tap");
    setArmed(id);
    window.setTimeout(() => document.getElementById(`gate-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
    armTimer.current = window.setTimeout(() => { setArmed(null); void conquer(id); }, 2600);
  };
  const undo = () => { window.clearTimeout(armTimer.current); setArmed(null); haptic("tap"); };
  useEffect(() => () => window.clearTimeout(armTimer.current), []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDash(), eng.reload()]);
    setRefreshing(false);
  }, [loadDash, eng]);

  // Pull down from the top to refresh.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".m-content");
    if (!el) return;
    let y0 = 0, active = false, last = 0;
    const start = (ev: TouchEvent) => { if (el.scrollTop <= 0) { y0 = ev.touches[0].clientY; active = true; last = 0; } };
    const move = (ev: TouchEvent) => { if (!active) return; const dy = ev.touches[0].clientY - y0; last = Math.max(0, Math.min(dy * 0.5, 90)); setPull(last); };
    const end = () => { if (active && last >= 60) { haptic("tap"); void refreshAll(); } active = false; setPull(0); };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); };
  }, [refreshAll]);

  const tasks = (dash?.activeTasks ?? []).filter((t: { is_pending?: boolean }) => !t.is_pending).slice(0, 4);
  const army = (dash?.shadows ?? []) as Array<{ name: string; rarity: string; bonus_value?: number }>;
  const owned = gear.filter((g) => ITEM_CATALOG.some((c) => c.name === g.name));
  const badgeColor = (rarity: string) => RARITY_COLORS[rarity.toUpperCase()] ?? "#7c5cff";
  const action = e ? nextBestAction(e) : null;
  const cacheReady = !!e && !e.chest.claimed && e.chest.unlockable;
  const b = e?.boss;

  return (
    <div className="mh">
      {(pull > 0 || refreshing) && <div className="mh-ptr" style={{ height: refreshing ? 44 : pull }} aria-live="polite">{refreshing ? "Refreshing…" : pull >= 60 ? "Release to refresh" : "Pull to refresh"}</div>}
      <section className="mh-hero">
        <div className="mh-hi"><Sparkles size={12} /> {greeting()}, {name}</div>
        <h1 className="mh-title">{headline}</h1>
      </section>

      <PowerOrb
        progress={1 - toNext / XP_PER_LEVEL}
        title={level}
        caption="Level"
        sub={`${toNext.toLocaleString()} XP to next`}
        onPress={() => navigate("/dungeon-gate")}
      />
      <QuickActions items={[
        { icon: <Plus size={22} />, label: "New gate", primary: true, onClick: () => { const el = document.querySelector<HTMLInputElement>(".mh-add input"); el?.scrollIntoView({ block: "center", behavior: "smooth" }); window.setTimeout(() => el?.focus(), 250); } },
        { icon: <Gift size={20} />, label: "Quests", dot: !!e && !e.chest.claimed && e.chest.unlockable, onClick: () => document.querySelector('[aria-label="Daily quests"]')?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        { icon: <Crown size={20} />, label: "Raid", dot: !!e && e.boss.claimable.length > 0, onClick: () => document.querySelector('[aria-label="World boss"]')?.scrollIntoView({ behavior: "smooth", block: "start" }) },
        { icon: <Skull size={20} />, label: "Army", onClick: () => navigate("/collection") },
      ]} />

      <form className="mh-add" onSubmit={addGate}>
        <input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="Open a new gate…" maxLength={120} aria-label="New gate title" enterKeyHint="done" />
        <button type="submit" disabled={!title.trim() || adding} aria-label="Add gate"><Plus size={18} /></button>
      </form>
      <div className="mh-chips" role="radiogroup" aria-label="Gate rank">
        {TIERS.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={tier === t.id} className={tier === t.id ? "on" : ""} onClick={() => setTier(t.id)}>
            <b>{t.label}</b> rank · {t.xp} XP
          </button>
        ))}
      </div>

      {e && !dismissed && (() => {
        const fs = firstSteps({ openGates: dash?.activeCount ?? 0, trophiesUnlocked: e.achievements.unlocked, chestClaimed: e.chest.claimed, conquestsToday: dash?.completedCount ?? 0 });
        return fs.complete ? null : <FirstSteps mobile steps={fs.steps} onDismiss={() => { setDismissed(true); try { localStorage.setItem("sl_first_steps", "1"); } catch { /* ignore */ } }} />;
      })()}
      {!e && eng.failed && <div className="ux-retry"><span>Couldn’t load today’s directives.</span><button onClick={() => void eng.reload()}>Retry</button></div>}

      <div className="mh-sec"><h2>Your activity</h2><button onClick={() => navigate("/overview")} aria-label="Open full overview"><ChevronRight size={18} /></button></div>
      <div className="mh-rail">
        <article className="mh-card mh-stat" onClick={() => navigate("/overview")}>
          <header><span>Experience</span><ChevronRight size={14} /></header>
          <small>This week</small>
          <Spark values={weekPts.length ? weekPts : [0, 0, 0, 0, 0, 0, 0]} />
          <footer><b>{(dash?.totalXp ?? profile?.total_points ?? 0).toLocaleString()}</b><em>XP</em></footer>
        </article>
        <article className="mh-card mh-stat" onClick={() => navigate("/profile")}>
          <header><span>Level</span><ChevronRight size={14} /></header>
          <small>{toNext.toLocaleString()} XP to next</small>
          <div className="mh-ring" style={{ ["--p" as string]: `${100 - percent(toNext, XP_PER_LEVEL)}%` }} aria-hidden="true" />
          <footer><b>{level}</b><em>{dash?.player_rank ?? profile?.player_rank ?? "E"}-RANK</em></footer>
        </article>
        <article className="mh-card mh-stat" onClick={() => navigate("/war-room")}>
          <header><span>Streak</span><ChevronRight size={14} /></header>
          <small>{e ? `${e.streak.freezes}/${e.streak.freeze_cap} freezes` : "—"}</small>
          <DotBars values={weekPts.length ? weekPts : [0, 0, 0, 0, 0, 0, 0]} />
          <footer><b>{streak}</b><em>DAYS</em></footer>
        </article>
      </div>

      {e && (
        <section className="mh-card mh-streak" aria-label="Daily streak">
          <h3>Daily streak</h3>
          <div className="mh-days">
            {week.map((d, i) => {
              const done = d.daily_points > 0;
              const today = i === week.length - 1;
              const lbl = new Date(`${d.date}T12:00:00`).toLocaleDateString("en", { weekday: "narrow" });
              return (
                <div key={d.date} className={`mh-day${done ? " done" : ""}${today ? " today" : ""}`}>
                  <span>{lbl}</span>
                  <i>{done ? <Check size={14} strokeWidth={3} /> : null}</i>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <ConquestRecord compact score={dash?.playmaker_rating ?? 0} streak={streak} />

      {action && (
        <section className={`mh-card mh-insight${action.kind === "streak" ? " warn" : ""}`}>
          <div className="mh-insight-ico"><Sparkles size={18} /></div>
          <div><h4>System insight</h4><p>{action.text}</p></div>
        </section>
      )}

      {e && (
        <section className="mh-card" aria-label="Daily quests">
          <div className="mh-row"><h3>Daily quests</h3><span className="mh-dim mh-mono">{clock(eng.secondsLeft)}</span></div>
          {e.bounties.map((q) => (
            <div key={q.key} className="mh-prog">
              <div className="mh-prog-top"><span>{q.title}</span><em>{q.done ? "Done" : `${bountyPercent(q)}%`}</em></div>
              <div className={`mh-bar${q.done ? " done" : ""}`}><i style={{ width: `${q.done ? 100 : bountyPercent(q)}%` }} /></div>
              <small>{q.description}</small>
            </div>
          ))}
          {e.chest.claimed ? (
            <p className="mh-dim mh-note">{e.chest.rarity} cache · +{e.chest.xp} XP{e.chest.item ? ` · ${e.chest.item}` : ""}</p>
          ) : (
            <>
              <button className={`mh-cta${cacheReady ? " hot" : ""}`} disabled={!cacheReady || eng.busy} onClick={eng.openChest}>
                <Gift size={16} /> {cacheReady ? "Open quest cache" : "Clear 2 quests to unseal"}
              </button>
              <p className="mh-dim mh-note">{chestHint(e.bounties_done)}</p>
            </>
          )}
        </section>
      )}

      <div className="mh-sec"><h2>Spoils of war</h2><button onClick={() => navigate("/collection")} aria-label="Open collection"><ChevronRight size={18} /></button></div>
      <div className="mh-spoils">
        <button className="mh-card mh-spoil" onClick={() => navigate("/collection")}>
          <header><span><Skull size={15} /> Army</span><b>{army.length}<em>/{SHADOW_CATALOG.length}</em></b></header>
          <div className="mh-badges">
            {army.slice(0, 5).map((a) => <i key={a.name} className="mh-badge" style={{ ["--bc" as string]: badgeColor(a.rarity) }} title={`${a.name} · ${a.rarity}`}>{a.name.slice(0, 3).toUpperCase()}</i>)}
            {army.length === 0 && <small className="mh-dim">Win gates to extract shadows.</small>}
          </div>
        </button>
        <button className="mh-card mh-spoil" onClick={() => navigate("/collection")}>
          <header><span><Swords size={15} /> Arsenal</span><b>{owned.length}<em>/{ITEM_CATALOG.length}</em></b></header>
          <div className="mh-badges">
            {owned.slice(0, 5).map((g) => <i key={g.name} className="mh-badge" style={{ ["--bc" as string]: badgeColor(g.rarity) }} title={`${g.name} · ${g.rarity}`}>{g.item_category === "Weapon" ? <Swords size={15} /> : <Gem size={15} />}</i>)}
            {owned.length === 0 && <small className="mh-dim">Claim the daily gift to start.</small>}
          </div>
        </button>
      </div>

      <div className="mh-sec"><h2>Up next</h2><button onClick={() => navigate("/dungeon-gate")} aria-label="All gates"><ChevronRight size={18} /></button></div>
      <div className="mh-list">
        {dash && tasks.length === 0 && <p className="mh-dim mh-note" style={{ padding: "6px 4px" }}>No open gates. Add one above and start.</p>}
        {!dash && [0, 1, 2].map((i) => <div key={i} className="mh-row-item mh-skel" />)}
        {tasks.map((t: { id: string; title: string; xp_tier?: string; category: string; points: number }) => (
          <div key={t.id} id={`gate-${t.id}`} className={`mh-row-item${armed === t.id ? " is-armed" : ""}`}>
            <button className="mh-tick" disabled={completing === t.id || (!!armed && armed !== t.id)} onClick={() => (armed === t.id ? undo() : arm(t.id))} aria-label={armed === t.id ? `Undo conquering ${t.title}` : `Conquer ${t.title}`}>
              {completing === t.id ? <i className="mh-spin" /> : <Check size={15} strokeWidth={3} />}
            </button>
            <div className="mh-row-main"><span>{t.title}</span><small>{armed === t.id ? "Conquering… tap to undo" : `${RANK_OF[t.xp_tier ?? "Low"] ?? "E"}-rank · ${t.category} · ${t.points} XP`}</small></div>
            {armed === t.id && <><button className="mh-undo" onClick={undo}>Undo</button><i className="mh-countdown" aria-hidden="true" /></>}
          </div>
        ))}
      </div>

      {b && (
        <section className="mh-card mh-raid" aria-label="World boss">
          <div className="mh-row"><h3><Crown size={15} /> {b.name}</h3><span className="mh-dim mh-mono">{Math.floor(eng.bossSeconds / 3600)}h left</span></div>
          {b.hp ? (
            <>
              <div className="mh-bar red"><i style={{ width: `${b.defeated ? 100 : 100 - percent(b.damage, b.hp)}%` }} /></div>
              <div className="mh-prog-top"><small>{b.defeated ? "Defeated" : `${Math.max(0, b.hp - b.damage).toLocaleString()} HP left`}</small><small>{b.players} hunters</small></div>
            </>
          ) : <small className="mh-dim">Land the first strike of the week.</small>}
          <small className="mh-dim">Your damage {b.my_damage.toLocaleString()}</small>
          {b.claimable.map((c) => (
            <button key={c.week} className="mh-cta hot" disabled={eng.busy} onClick={() => eng.claimBoss(c.week)}><Trophy size={16} /> Claim spoils · +{c.reward_xp} XP</button>
          ))}
        </section>
      )}

      {e?.achievements.next && (
        <button className="mh-card mh-next" onClick={() => navigate("/achievements")}>
          <div className="mh-prog-top"><span>{e.achievements.next.name}</span><em>{e.achievements.next.progress}/{e.achievements.next.threshold}</em></div>
          <div className="mh-bar"><i style={{ width: `${percent(e.achievements.next.progress, e.achievements.next.threshold)}%` }} /></div>
          <small>{e.achievements.unlocked}/{e.achievements.total} feats earned</small>
        </button>
      )}

      {eng.reveal && <Reveal d={eng.reveal} onClose={() => eng.setReveal(null)} />}
    </div>
  );
}
