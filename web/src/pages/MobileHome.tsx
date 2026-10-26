import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Crown, Gem, Gift, Plus, Skull, Sparkles, Swords, Trophy, Undo2, Zap } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { useGameActions } from "../lib/gameActions";
import { SystemAPI } from "../services/SystemAPI";
import { supabase } from "../lib/supabase";
import type { DashboardData } from "../lib/gameTypes";
import { useEngagement } from "../lib/engagementContext";
import { ENGAGEMENT_REFRESH_EVENT, bountyPercent, chestHint, clock, nextBestAction, percent } from "../lib/engagement";
import { Reveal } from "../components/EngagementPanel";
import { ConquestRecord } from "../components/ConquestRecord";
import { FirstSteps } from "../components/UxLayer";
import { PowerOrb } from "../components/visuals";
import { ITEM_CATALOG, RARITY_COLORS, SHADOW_CATALOG } from "../lib/catalog";
import { XP_PER_LEVEL } from "../lib/levelEngine";
import { firstSteps, haptic } from "../lib/feedback";
import { RANK_OF } from "../lib/gateRules";
import { useArmed } from "../lib/useArmed";
import { useMobileUi } from "../components/mobile/MobileUi";
import "../components/mobile/mobile.css";
import "./mobile-home.css";

type View = "today" | "progress" | "rewards";
const VIEWS: Array<[View, string]> = [["today", "Today"], ["progress", "Progress"], ["rewards", "Rewards"]];

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

export function MobileHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const actions = useGameActions();
  const eng = useEngagement();
  const { openAdd } = useMobileUi();
  const e = eng.data;

  const [view, setView] = useState<View>("today");
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [gear, setGear] = useState<Array<{ name: string; rarity: string; item_category: string }>>([]);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem("sl_first_steps") === "1"; } catch { return false; } });

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
    supabase.from("inventory").select("name,rarity,item_category").eq("user_id", profile.user_id).then(({ data }) => { if (data) setGear(data); });
  }, [profile?.user_id]);

  const { armed, running, arm, undo } = useArmed(async (id) => { await actions.complete(id); await loadDash(); });

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadDash(), eng.reload()]);
    setRefreshing(false);
  }, [loadDash, eng]);

  // Gestures on the scroller: pull-to-refresh at the top, horizontal swipe between views.
  const viewRef = useRef(view); viewRef.current = view;
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".m-content");
    if (!el) return;
    let x0 = 0, y0 = 0, pulling = false, last = 0, dx = 0, dy = 0;
    const start = (ev: TouchEvent) => { x0 = ev.touches[0].clientX; y0 = ev.touches[0].clientY; dx = dy = 0; pulling = el.scrollTop <= 0; last = 0; };
    const move = (ev: TouchEvent) => {
      dx = ev.touches[0].clientX - x0; dy = ev.touches[0].clientY - y0;
      if (pulling && dy > 0 && Math.abs(dy) > Math.abs(dx)) { last = Math.min(dy * 0.5, 90); setPull(last); }
    };
    const end = () => {
      if (pulling && last >= 60) { haptic("tap"); void refreshAll(); }
      else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        const i = VIEWS.findIndex(([k]) => k === viewRef.current);
        const n = dx < 0 ? Math.min(VIEWS.length - 1, i + 1) : Math.max(0, i - 1);
        if (n !== i) { setView(VIEWS[n][0]); haptic("tap"); el.scrollTo({ top: 0 }); }
      }
      pulling = false; setPull(0);
    };
    el.addEventListener("touchstart", start, { passive: true });
    el.addEventListener("touchmove", move, { passive: true });
    el.addEventListener("touchend", end);
    return () => { el.removeEventListener("touchstart", start); el.removeEventListener("touchmove", move); el.removeEventListener("touchend", end); };
  }, [refreshAll]);

  const name = (profile?.name ?? "Hunter").split(" ")[0];
  const standing = dash?.standing_xp ?? profile?.standing_xp ?? 0;
  const level = dash?.level ?? profile?.level ?? 1;
  const toNext = XP_PER_LEVEL - (Math.max(standing, 0) % XP_PER_LEVEL);
  const week = dash?.weeklyHistory ?? [];
  const weekPts = week.map((d) => d.daily_points);
  const streak = e?.streak.count ?? dash?.streak_count ?? 0;
  const flow = dash?.flow ?? { count: 0, active: false };

  const headline = useMemo(() => {
    if (e?.streak.at_risk) return <>Hold your <b>{streak}-day</b> streak today.</>;
    if (streak > 0) return <>You’re on a <b>{streak}-day</b> streak.</>;
    return <>Start your streak <b>today</b>.</>;
  }, [e?.streak.at_risk, streak]);

  const tasks = (dash?.activeTasks ?? []).filter((t: { is_pending?: boolean }) => !t.is_pending).slice(0, 4);
  const action = e ? nextBestAction(e) : null;
  const cacheReady = !!e && !e.chest.claimed && e.chest.unlockable;
  const raidReady = !!e && e.boss.claimable.length > 0;
  const b = e?.boss;
  const army = (dash?.shadows ?? []) as Array<{ name: string; rarity: string; bonus_value?: number }>;
  const owned = gear.filter((g) => ITEM_CATALOG.some((c) => c.name === g.name));
  const badgeColor = (rarity: string) => RARITY_COLORS[rarity.toUpperCase()] ?? "#7c5cff";

  return (
    <div className="mh">
      {(pull > 0 || refreshing) && <div className="mh-ptr" style={{ height: refreshing ? 44 : pull }} aria-live="polite">{refreshing ? "Refreshing…" : pull >= 60 ? "Release to refresh" : "Pull to refresh"}</div>}

      <div className="mh-views" role="tablist" aria-label="Home sections">
        {VIEWS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={view === k} className={view === k ? "on" : ""} onClick={() => { setView(k); haptic("tap"); }}>
            {label}{k === "rewards" && (cacheReady || raidReady) && <i aria-label="Reward ready" />}
          </button>
        ))}
      </div>

      {view === "today" && (
        <div className="mh-pane" key="today">
          <section className="mh-hero">
            <div className="mh-hi"><Sparkles size={12} /> {greeting()}, {name}</div>
            <h1 className="mh-title">{headline}</h1>
          </section>

          <PowerOrb progress={1 - toNext / XP_PER_LEVEL} title={level} caption="Level" sub={`${toNext.toLocaleString()} XP to next`} onPress={() => navigate("/dungeon-gate")} size={188} />

          {e && !dismissed && (() => {
            const fs = firstSteps({ openGates: dash?.activeCount ?? 0, trophiesUnlocked: e.achievements.unlocked, chestClaimed: e.chest.claimed, conquestsToday: dash?.completedCount ?? 0 });
            return fs.complete ? null : <FirstSteps mobile steps={fs.steps} onDismiss={() => { setDismissed(true); try { localStorage.setItem("sl_first_steps", "1"); } catch { /* ignore */ } }} />;
          })()}
          {!e && eng.failed && <div className="ux-retry"><span>Couldn’t load today’s directives.</span><button onClick={() => void eng.reload()}>Retry</button></div>}

          {action && action.kind !== "start" && (
            <section className={`mh-card mh-insight${action.kind === "streak" ? " warn" : ""}`}>
              <div className="mh-insight-ico"><Sparkles size={18} /></div>
              <div><h4>{action.kind === "streak" ? "Streak at risk" : action.kind === "chest" ? "Reward ready" : "Next up"}</h4><p>{action.text}</p></div>
            </section>
          )}

          <div className="mh-sec"><h2>Up next</h2><button onClick={() => navigate("/dungeon-gate")} aria-label="All gates"><ChevronRight size={18} /></button></div>
          <div className="mh-list">
            {dash && tasks.length === 0 && (
              <div className="mh-empty"><p>No open gates.</p><button className="mh-cta hot" onClick={() => openAdd()}><Plus size={16} /> Open a gate</button></div>
            )}
            {!dash && [0, 1, 2].map((i) => <div key={i} className="mh-row-item mh-skel" />)}
            {tasks.map((t: { id: string; title: string; xp_tier?: string; category: string; points: number }) => (
              <div key={t.id} id={`gate-${t.id}`} className={`mh-row-item${armed === t.id ? " is-armed" : ""}`}>
                <button className="mh-tick" disabled={running === t.id || (!!armed && armed !== t.id)} onClick={() => (armed === t.id ? undo() : arm(t.id))} aria-label={armed === t.id ? `Undo conquering ${t.title}` : `Conquer ${t.title}`}>
                  {running === t.id ? <i className="mh-spin" /> : armed === t.id ? <Undo2 size={15} /> : <Check size={15} strokeWidth={3} />}
                </button>
                <div className="mh-row-main"><span>{t.title}</span><small>{armed === t.id ? "Conquering… tap to undo" : `${RANK_OF[t.xp_tier ?? "Low"] ?? "E"}-rank · ${t.category} · ${t.points} XP`}</small></div>
                {armed === t.id && <><button className="mh-undo" onClick={undo}>Undo</button><i className="mh-countdown" aria-hidden="true" /></>}
              </div>
            ))}
          </div>

          <section className="mh-card mh-momentum" aria-label="Momentum">
            <div className="mh-prog-top"><span><Zap size={14} style={{ verticalAlign: -2, color: "#c4b5ff" }} /> Momentum</span><em>{flow.active ? "×2.5 XP active" : `${Math.min(flow.count, 5)}/5`}</em></div>
            <div className="mh-pips">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i < flow.count || flow.active ? "on" : ""} />)}</div>
            <small>{flow.active ? "Keep going — every C-rank+ gate now pays 2.5×." : flow.count > 0 ? `${5 - flow.count} more C-rank+ gate${5 - flow.count === 1 ? "" : "s"} within the hour unlock ×2.5 XP.` : "Conquer 5 gates of C-rank or higher in 90 minutes for ×2.5 XP."}</small>
          </section>

        </div>
      )}

      {view === "progress" && (
        <div className="mh-pane" key="progress">
          <div className="mh-rail">
            <article className="mh-card mh-stat" onClick={() => navigate("/overview")}>
              <header><span>Experience</span><ChevronRight size={14} /></header>
              <small>This week</small>
              <Spark values={weekPts.length ? weekPts : [0, 0, 0, 0, 0, 0, 0]} />
              <footer><b>{(dash?.totalXp ?? profile?.total_points ?? 0).toLocaleString()}</b><em>XP</em></footer>
            </article>
            <article className="mh-card mh-stat" onClick={() => navigate("/me")}>
              <header><span>Level</span><ChevronRight size={14} /></header>
              <small>{toNext.toLocaleString()} XP to next</small>
              <div className="mh-ring" style={{ ["--p" as string]: `${100 - percent(toNext, XP_PER_LEVEL)}%` }} aria-hidden="true" />
              <footer><b>{level}</b><em>{dash?.player_rank ?? profile?.player_rank ?? "E"}-RANK</em></footer>
            </article>
          </div>

          {e && (
            <section className="mh-card mh-streak" aria-label="Daily streak">
              <div className="mh-row"><h3>This week</h3><span className="mh-dim">{e.streak.freezes}/{e.streak.freeze_cap} freezes</span></div>
              <div className="mh-days">
                {week.map((d, i) => {
                  const done = d.daily_points > 0;
                  const lbl = new Date(`${d.date}T12:00:00`).toLocaleDateString("en", { weekday: "narrow" });
                  return <div key={d.date} className={`mh-day${done ? " done" : ""}${i === week.length - 1 ? " today" : ""}`}><span>{lbl}</span><i>{done ? <Check size={14} strokeWidth={3} /> : null}</i></div>;
                })}
              </div>
            </section>
          )}

          <ConquestRecord compact score={dash?.playmaker_rating ?? 0} streak={streak} />

          {e?.achievements.next && (
            <button className="mh-card mh-next" onClick={() => navigate("/achievements")}>
              <div className="mh-prog-top"><span>{e.achievements.next.name}</span><em>{e.achievements.next.progress}/{e.achievements.next.threshold}</em></div>
              <div className="mh-bar"><i style={{ width: `${percent(e.achievements.next.progress, e.achievements.next.threshold)}%` }} /></div>
              <small>Next feat · {e.achievements.unlocked}/{e.achievements.total} earned</small>
            </button>
          )}
        </div>
      )}

      {view === "rewards" && (
        <div className="mh-pane" key="rewards">
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
                  <button className={`mh-cta${cacheReady ? " hot" : ""}`} disabled={!cacheReady || eng.busy} onClick={eng.openChest}><Gift size={16} /> {cacheReady ? "Open quest cache" : "Clear 2 quests to unseal"}</button>
                  <p className="mh-dim mh-note">{chestHint(e.bounties_done)}</p>
                </>
              )}
            </section>
          )}

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
              {b.claimable.map((c) => <button key={c.week} className="mh-cta hot" disabled={eng.busy} onClick={() => eng.claimBoss(c.week)}><Trophy size={16} /> Claim spoils · +{c.reward_xp} XP</button>)}
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
        </div>
      )}

      {eng.reveal && <Reveal d={eng.reveal} onClose={() => eng.setReveal(null)} />}
    </div>
  );
}
