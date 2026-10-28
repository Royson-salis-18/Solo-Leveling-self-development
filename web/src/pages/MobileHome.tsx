import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Crown, Flame, Gem, Gift, Plus, Skull, Snowflake, Sparkles, Swords, Trophy, Undo2 } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { useGameActions } from "../lib/gameActions";
import { SystemAPI } from "../services/SystemAPI";
import { supabase } from "../lib/supabase";
import type { DashboardData } from "../lib/gameTypes";
import { useEngagement } from "../lib/engagementContext";
import { ENGAGEMENT_REFRESH_EVENT, bountyPercent, chestHint, clock, nextBestAction, percent, requestEngagementRefresh } from "../lib/engagement";
import { Reveal } from "../components/EngagementPanel";
import { ConquestRecord } from "../components/ConquestRecord";
import { Transmission } from "../components/Transmission";
import { Coach } from "../components/mobile/Coach";
import { Insights } from "../components/mobile/Insights";
import { HatchBars, Kpis, Panel, RangeChips, Waffle, XpArea } from "../components/visuals";
import { FirstSteps } from "../components/UxLayer";
import { ITEM_CATALOG, RARITY_COLORS, SHADOW_CATALOG } from "../lib/catalog";
import { XP_PER_LEVEL, nextRankInfo } from "../lib/levelEngine";
import { directiveOfTheDay, directivePayload, domainStandings, stripEmoji } from "../lib/domains";
import { addDays, isoDay } from "../lib/gateRules";
import { useToast } from "../lib/toast";
import { firstSteps, haptic } from "../lib/feedback";
import { RANK_OF } from "../lib/gateRules";
import { useArmed } from "../lib/useArmed";
import { useMobileUi } from "../components/mobile/MobileUi";
import "../components/mobile/mobile.css";
import "./mobile-home.css";

type View = "today" | "progress" | "rewards";
const VIEWS: Array<[View, string]> = [["today", "Today"], ["progress", "Progress"], ["rewards", "Rewards"]];

export function MobileHome() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const actions = useGameActions();
  const toast = useToast();
  const eng = useEngagement();
  const { openAdd } = useMobileUi();
  const e = eng.data;

  const [view, setView] = useState<View>("today");
  const [range, setRange] = useState<"7D" | "28D">("7D");
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

  const [arising, setArising] = useState(false);
  const { armed, running, arm, undo } = useArmed(async (id) => {
    const cat = (dash?.activeTasks ?? []).find((t: { id: string; category?: string }) => t.id === id)?.category;
    await actions.complete(id, { category: cat });
    await loadDash();
  });

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

  const standing = dash?.standing_xp ?? profile?.standing_xp ?? 0;
  const level = dash?.level ?? profile?.level ?? 1;
  const toNext = XP_PER_LEVEL - (Math.max(standing, 0) % XP_PER_LEVEL);
  const week = dash?.weeklyHistory ?? [];
  const streak = e?.streak.count ?? dash?.streak_count ?? 0;

  const stand = domainStandings({ domain_physical: dash?.domain_physical, domain_mind: dash?.domain_mind, domain_soul: dash?.domain_soul, domain_execution: dash?.domain_execution, domain_builder: dash?.domain_builder });
  const directive = directiveOfTheDay(stand.lowest.name);
  const rank = dash?.player_rank ?? profile?.player_rank ?? "E";
  const nr = nextRankInfo(rank);
  const weeklyTarget = dash?.weekly_target ?? null;
  const weeklyXp = dash?.weekly_xp ?? 0;
  const pts = (d: { daily_points: number }) => Math.max(0, d.daily_points);
  const weekTotal = week.reduce((n, d) => n + pts(d), 0);
  const month = dash?.monthlyHistory ?? [];
  const sum = (a: Array<{ daily_points: number }>) => a.reduce((n, d) => n + pts(d), 0);
  const todayXp = month.length ? pts(month[month.length - 1]) : week.length ? pts(week[week.length - 1]) : 0;
  const yesterdayXp = month.length > 1 ? pts(month[month.length - 2]) : null;
  const prevWeek = month.length >= 14 ? sum(month.slice(-14, -7)) : null;
  const weekDelta = prevWeek === null ? null : weekTotal - prevWeek;
  const monthTotal = sum(month);
  // 28D is shown as four weekly totals so the bars stay readable.
  const bars = range === "7D"
    ? week.map((d) => ({ label: new Date(`${d.date}T12:00:00`).toLocaleDateString("en", { weekday: "short" }).slice(0, 2), value: pts(d) }))
    : [0, 1, 2, 3].map((i) => ({ label: `W${i + 1}`, value: sum(month.slice(i * 7, i * 7 + 7)) }));
  const dateLine = new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" });

  const arise = async () => {
    if (arising) return;
    setArising(true);
    try {
      await SystemAPI.saveGate(directivePayload(directive, stand.lowest.name, isoDay(addDays(new Date(), 1))) as never, null);
      haptic("success");
      toast.success("Directive added", "Clear it by tomorrow to lift your " + stand.lowest.name + ".");
      requestEngagementRefresh();
    } catch (err) { toast.fail(err, "Couldn't add the directive"); } finally { setArising(false); }
  };

  const tasks = (dash?.activeTasks ?? []).filter((t: { is_pending?: boolean }) => !t.is_pending).slice(0, 4);
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
          <Transmission compact />

          <header className="mh-win" aria-label="Status window">
            <Skull className="mh-skull" size={150} strokeWidth={1.4} aria-hidden="true" />
            <div className="mh-win-top"><span>{dateLine}</span><span>Level {level}</span></div>
            <div className="mh-win-body">
              <div className="mh-win-main"><h1>{profile?.player_title ?? dash?.player_title ?? "Newcomer"}</h1><p>{rank}-Rank hunter{profile?.player_class ? `, ${profile.player_class}` : ""}</p></div>
              <span className="mh-hex" role="img" aria-label={`${rank}-Rank`}>
                <svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 92,27 92,73 50,96 8,73 8,27" /></svg><b>{rank}</b>
              </span>
            </div>
            <div className="mh-seg" role="progressbar" aria-label={`Progress to level ${level + 1}`} aria-valuenow={Math.round((1 - toNext / XP_PER_LEVEL) * 100)} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${(1 - toNext / XP_PER_LEVEL) * 100}%` }} /></div>
            <small>{toNext.toLocaleString()} XP to level {level + 1}{nr ? `. ${nr.rank}-Rank opens at level ${nr.minLevel}` : ""}</small>
          </header>

          <div className="mh-today" aria-label="Today at a glance">
            <button onClick={() => setView("rewards")}><b>{e ? `${e.bounties_done}/3` : "–"}</b><span>Quests</span></button>
            <button onClick={() => setView("progress")}><b>{weeklyXp}{weeklyTarget ? <i>/{weeklyTarget}</i> : null}</b><span>Week XP</span></button>
            <button onClick={() => setView("progress")}><b>{streak}</b><span>Streak</span></button>
          </div>

          <Coach weeklyTarget={weeklyTarget} conqueredToday={dash?.completedCount ?? 0} />

          {e && (() => {
            const act = nextBestAction(e);
            const to = act.kind === "chest" || act.kind === "bounty" ? () => setView("rewards") : act.kind === "boss" ? () => setView("rewards") : () => navigate("/dungeon-gate");
            return (
              <section className={`mh-sysdir${act.kind === "streak" ? " urgent" : ""}`} aria-label="System directive">
                <span className="mh-sysdir-ico">{act.kind === "streak" ? <Flame size={18} /> : <Sparkles size={18} />}</span>
                <div><small>System directive</small><p>{act.text}</p></div>
                <button onClick={to} aria-label={act.kind === "chest" || act.kind === "bounty" || act.kind === "boss" ? "Open rewards" : "Enter gates"}><ChevronRight size={18} /></button>
              </section>
            );
          })()}

          {e && (
            <section className="mh-card mh-chain" aria-label="Chain of resolve">
              <div className="mh-row">
                <div className="mh-eyebrow mh-flame"><Flame size={13} /> Chain of resolve</div>
                <span className={`mh-chip${e.streak.at_risk ? " warn" : " ok"}`}>{e.streak.at_risk ? `${Math.floor(eng.secondsLeft / 3600)}h left` : e.streak.done_today ? "Held today" : "Open"}</span>
              </div>
              <div className="mh-big">{e.streak.count}<small>days</small></div>
              <div className="mh-chain-foot">
                <span className="mh-freezes" aria-label={`${e.streak.freezes} of ${e.streak.freeze_cap} freeze charges`}>
                  {Array.from({ length: e.streak.freeze_cap }, (_, i) => <i key={i} className={i < e.streak.freezes ? "on" : ""}><Snowflake size={13} /></i>)}
                  <em>Freeze charges</em>
                </span>
                <span className="mh-dim">Best {e.streak.best}{e.streak.next_freeze_in ? ` · next charge ${e.streak.next_freeze_in}d` : ""}</span>
              </div>
            </section>
          )}

          <Panel title="XP" right={<RangeChips label="Range" options={["7D", "28D"] as const} value={range} onChange={setRange} />}>
            <Kpis items={[
              { label: "Today", value: todayXp.toLocaleString(), delta: yesterdayXp === null ? null : todayXp - yesterdayXp, note: "vs yday" },
              { label: "7 days", value: weekTotal.toLocaleString(), delta: weekDelta, note: "vs last wk" },
              { label: "28 days", value: monthTotal.toLocaleString(), note: "total" },
            ]} />
            {bars.length > 1 ? <HatchBars data={bars} /> : <div className="mh-chart-skel" />}
          </Panel>

          <div className="mh-sec"><h2>Up next</h2><button onClick={() => navigate("/dungeon-gate")}>All gates<ChevronRight size={15} /></button></div>
          <div className="mh-list mh-group">
            {dash && tasks.length === 0 && (
              <div className="mh-empty"><p>No open gates.</p><button className="mh-btn" onClick={() => openAdd()}><Plus size={16} /> New gate</button></div>
            )}
            {!dash && [0, 1, 2].map((i) => <div key={i} className="mh-row-item mh-skel" />)}
            {tasks.map((t: { id: string; title: string; xp_tier?: string; category: string; points: number }) => (
              <div key={t.id} id={`gate-${t.id}`} className={`mh-row-item${armed === t.id ? " is-armed" : ""}`}>
                <button className="mh-tick" disabled={running === t.id || (!!armed && armed !== t.id)} onClick={() => (armed === t.id ? undo() : arm(t.id))} aria-label={armed === t.id ? `Undo conquering ${t.title}` : `Conquer ${t.title}`}>
                  {running === t.id ? <i className="mh-spin" /> : armed === t.id ? <Undo2 size={15} /> : <Check size={15} strokeWidth={2.5} />}
                </button>
                <div className="mh-row-main"><span>{t.title}</span><small>{armed === t.id ? "Conquering… tap to undo" : t.category}</small></div>
                {armed === t.id ? <><button className="mh-undo" onClick={undo}>Undo</button><i className="mh-countdown" aria-hidden="true" /></> : <div className="mh-row-val"><b>+{t.points}</b><small>{RANK_OF[t.xp_tier ?? "Low"] ?? "E"}-rank</small></div>}
              </div>
            ))}
          </div>

          <section className="mh-cal" aria-label="Core calibration">
            <div className="mh-sec"><h2>Today’s directive</h2><button onClick={() => navigate("/overview")}>More<ChevronRight size={15} /></button></div>
            <h3>{stripEmoji(directive.title).replace(/^[^:]*:\s*/, "")}</h3>
            <p>{directive.description}</p>
            <div className="mh-cal-foot">
              <span>Lifts <b>{stand.lowest.name}</b> · {stand.lowest.value} → your weakest · <em>+{directive.points} XP</em></span>
              <button className="mh-btn" onClick={arise} disabled={arising}>{arising ? "…" : "Arise"}</button>
            </div>
          </section>

          <div className="mh-sec"><h2>Domains</h2><span className="mh-dim mh-hint">Tap to add a gate</span></div>
          <div className="mh-group" aria-label="Domains">
            <div className="mh-radar"><Waffle parts={stand.all.map((d) => ({ name: d.name, value: d.value, color: d.color }))} /></div>
            {stand.all.map((d) => {
              const low = d.name === stand.lowest.name;
              return (
                <button key={d.name} className={`mh-dom${low ? " low" : ""}`} style={{ ["--dc" as string]: d.color }} onClick={() => openAdd(undefined, { category: d.categories[0] })} aria-label={`Add a ${d.name} gate. ${d.name} is ${d.value}${low ? ", your weakest domain" : ""}`}>
                  <span className="mh-dom-name"><i />{d.name}</span>
                  <span className="mh-dom-bar"><u style={{ width: `${Math.max(2, Math.min(100, d.value))}%` }} /></span>
                  <b>{d.value}</b>
                </button>
              );
            })}
          </div>

          {e && !dismissed && (() => {
            const fs = firstSteps({ openGates: dash?.activeCount ?? 0, trophiesUnlocked: e.achievements.unlocked, chestClaimed: e.chest.claimed, conquestsToday: dash?.completedCount ?? 0 });
            return fs.complete ? null : <FirstSteps mobile steps={fs.steps} onDismiss={() => { setDismissed(true); try { localStorage.setItem("sl_first_steps", "1"); } catch { /* ignore */ } }} />;
          })()}
          {!e && eng.failed && <div className="ux-retry"><span>Couldn’t load today’s directives.</span><button onClick={() => void eng.reload()}>Retry</button></div>}
        </div>
      )}

      {view === "progress" && (
        <div className="mh-pane" key="progress">
          <section className="mh-card" aria-label="Weekly threshold">
            <div className="mh-eyebrow">Weekly activity</div>
            <div className="mh-prog-top"><span>{weeklyXp} XP{weeklyTarget ? ` of ${weeklyTarget}` : " this week"}</span><em>{weeklyTarget === null ? "No target" : weeklyXp >= weeklyTarget ? "On track" : `${weeklyTarget - weeklyXp} to go`}</em></div>
            <div className={`mh-bar${weeklyTarget !== null && weeklyXp >= weeklyTarget ? " done" : ""}`}><i style={{ width: `${weeklyTarget ? Math.min(100, (weeklyXp / weeklyTarget) * 100) : 100}%` }} /></div>
            <small className="mh-dim">{dash?.current_mode ?? "Normal"} mode · C-rank or higher counts</small>
          </section>

          <section className="mh-card mh-week" aria-label="XP this week">
            <div className="mh-row"><div><div className="mh-eyebrow">This week</div><div className="mh-big">{weekTotal.toLocaleString()}<small>XP</small></div></div>{e && <span className="mh-dim mh-hint">{e.streak.freezes}/{e.streak.freeze_cap} freezes</span>}</div>
            <XpArea days={week} pace={weeklyTarget ? Math.round(weeklyTarget / 7) : undefined} />
          </section>

          <ConquestRecord compact score={dash?.playmaker_rating ?? 0} streak={streak} />

          <div className="mh-sec"><h2>Patterns</h2></div>
          <Insights />

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
