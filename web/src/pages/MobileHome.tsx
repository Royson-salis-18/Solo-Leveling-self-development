import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Crown, Gift, Plus, Sparkles, Trophy } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useGameActions } from "../lib/gameActions";
import { SystemAPI } from "../services/SystemAPI";
import type { DashboardData } from "../lib/gameTypes";
import { useEngagement } from "../lib/useEngagement";
import { ENGAGEMENT_REFRESH_EVENT, bountyPercent, chestHint, clock, nextBestAction, percent } from "../lib/engagement";
import { Reveal } from "../components/EngagementPanel";
import { XP_PER_LEVEL } from "../lib/levelEngine";
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

  const loadDash = useCallback(async () => {
    try { setDash(await SystemAPI.fetchDashboardData()); } catch { /* skeleton stays; engagement is independent */ }
  }, []);
  useEffect(() => {
    void loadDash();
    const on = () => void loadDash();
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, on);
    return () => window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, on);
  }, [loadDash]);

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
      toast.success("Gate opened", `${t} · ${RANK_OF[tier]}-rank`);
      void loadDash();
    } catch (err) { toast.fail(err, "Could not open gate"); } finally { setAdding(false); }
  };

  const conquer = async (id: string) => {
    if (completing) return;
    setCompleting(id);
    try { await actions.complete(id); void loadDash(); } finally { setCompleting(null); }
  };

  const tasks = (dash?.activeTasks ?? []).filter((t: { is_pending?: boolean }) => !t.is_pending).slice(0, 4);
  const action = e ? nextBestAction(e) : null;
  const cacheReady = !!e && !e.chest.claimed && e.chest.unlockable;
  const b = e?.boss;

  return (
    <div className="mh">
      <section className="mh-hero">
        <div className="mh-hi"><Sparkles size={12} /> {greeting()}, {name}</div>
        <h1 className="mh-title">{headline}</h1>
      </section>

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

      <div className="mh-sec"><h2>Your activity</h2><button onClick={() => navigate("/profile")} aria-label="Open profile"><ChevronRight size={18} /></button></div>
      <div className="mh-rail">
        <article className="mh-card mh-stat" onClick={() => navigate("/profile")}>
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

      <div className="mh-sec"><h2>Up next</h2><button onClick={() => navigate("/dungeon-gate")} aria-label="All gates"><ChevronRight size={18} /></button></div>
      <div className="mh-list">
        {dash && tasks.length === 0 && <p className="mh-dim mh-note" style={{ padding: "6px 4px" }}>No open gates. Add one above and start.</p>}
        {!dash && [0, 1, 2].map((i) => <div key={i} className="mh-row-item mh-skel" />)}
        {tasks.map((t: { id: string; title: string; xp_tier?: string; category: string; points: number }) => (
          <div key={t.id} className="mh-row-item">
            <button className="mh-tick" disabled={completing === t.id} onClick={() => conquer(t.id)} aria-label={`Conquer ${t.title}`}>
              {completing === t.id ? <i className="mh-spin" /> : <Check size={15} strokeWidth={3} />}
            </button>
            <div className="mh-row-main"><span>{t.title}</span><small>{RANK_OF[t.xp_tier ?? "Low"] ?? "E"}-rank · {t.category} · {t.points} XP</small></div>
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
