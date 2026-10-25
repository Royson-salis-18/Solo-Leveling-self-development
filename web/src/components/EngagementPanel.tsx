import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Crown, Flame, Gift, Snowflake, Sparkles, Swords, Target, Trophy as TrophyIcon, Users } from "lucide-react";
import { SystemAPI } from "../services/SystemAPI";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useGameActions } from "../lib/gameActions";
import {
  ENGAGEMENT_REFRESH_EVENT, RARITY_COLOR, bountyPercent, chestHint, formatCountdown, nextBestAction, percent,
} from "../lib/engagement";
import type { ChestResult, Engagement, BossLootResult } from "../lib/gameTypes";
import "./engagement.css";

const DIFF_LABEL = { 1: "EASY", 2: "MEDIUM", 3: "HARD" } as const;

/** Shared "you got loot" reveal for the Bounty Chest and the World Boss. */
function Reveal({ title, rarity, xp, item, perfect, trophies, onClose }: {
  title: string; rarity: string; xp: number; item: string | null; perfect?: boolean;
  trophies: Array<{ name: string; xp: number }>; onClose: () => void;
}) {
  const color = RARITY_COLOR[rarity as keyof typeof RARITY_COLOR] ?? "#a8a8ff";
  return (
    <div className="eng-reveal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="eng-reveal" style={{ ["--rc" as string]: color }} onClick={(e) => e.stopPropagation()}>
        <div className="eng-reveal-icon"><Gift size={42} /></div>
        <div className="trophy-rar" style={{ ["--rc" as string]: color }}>{rarity}</div>
        <h3>{title}</h3>
        <div className="eng-xp">+{xp} XP</div>
        <div className="eng-chips">
          {item && <span className="eng-chip">+ {item}</span>}
          {perfect && <span className="eng-chip">PERFECT DAY</span>}
          {trophies.map((t) => <span key={t.name} className="eng-chip">🏆 {t.name}{t.xp ? ` +${t.xp}` : ""}</span>)}
        </div>
        <button className="eng-btn is-hot" onClick={onClose} autoFocus>Claim</button>
      </div>
    </div>
  );
}

export function EngagementPanel() {
  const navigate = useNavigate();
  const toast = useToast();
  const { apply, announce } = useGameActions();
  const { refreshProfile } = useAuth();

  const [e, setE] = useState<Engagement | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const fetchedAt = useRef(Date.now());
  const [reveal, setReveal] = useState<null | { title: string; rarity: string; xp: number; item: string | null; perfect?: boolean; trophies: Array<{ name: string; xp: number }> }>(null);

  const load = useCallback(async () => {
    try {
      const r = await SystemAPI.getEngagement();
      if (r.profile_missing) return;
      fetchedAt.current = Date.now();
      setE(r);
      setFailed(false);
    } catch {
      setFailed(true);               // the panel is a bonus layer: never block the dashboard on it
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => {
      window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [load]);

  // A quiet "come back" cue in the tab title while there is something real to do.
  useEffect(() => {
    if (!e) return;
    const base = document.title.replace(/^\(!\)\s*/, "");
    const hot = e.streak.at_risk || (!e.chest.claimed && e.chest.unlockable);
    document.title = hot ? `(!) ${base}` : base;
    return () => { document.title = base; };
  }, [e]);

  const secondsLeft = useMemo(
    () => (e ? Math.max(0, e.seconds_left - Math.floor((now - fetchedAt.current) / 1000)) : 0),
    [e, now],
  );
  const bossSeconds = useMemo(() => (e ? Math.max(0, Math.floor((new Date(e.boss.ends_at).getTime() - now) / 1000)) : 0), [e, now]);

  const afterLoot = useCallback((r: ChestResult | BossLootResult) => {
    apply(r.profile);
    announce(r.progression);
    void refreshProfile();
    void load();
  }, [apply, announce, refreshProfile, load]);

  const openChest = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await SystemAPI.claimBountyChest();
      afterLoot(r);
      setReveal({ title: "Bounty Chest", rarity: r.rarity, xp: r.xp, item: r.item, perfect: r.perfect, trophies: r.achievements });
    } catch (err) { toast.fail(err, "Chest locked"); void load(); } finally { setBusy(false); }
  };

  const claimBoss = async (week: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await SystemAPI.claimBossReward(week);
      afterLoot(r);
      setReveal({ title: "Boss Loot", rarity: "Epic", xp: r.xp, item: r.item, trophies: r.achievements });
    } catch (err) { toast.fail(err, "Could not claim loot"); void load(); } finally { setBusy(false); }
  };

  if (failed && !e) return null;
  if (!e) {
    return <div className="eng" aria-busy="true"><div className="eng-grid">{[0, 1, 2].map((i) => (
      <div key={i} className="eng-card ds-glass" style={{ minHeight: 190, opacity: .5 }} />))}</div></div>;
  }

  const action = nextBestAction(e);
  const s = e.streak;
  const b = e.boss;
  const freezePips = Array.from({ length: s.freeze_cap }, (_, i) => i < s.freezes);
  const hpLeft = b.hp ? Math.max(0, b.hp - b.damage) : null;
  const nextT = e.achievements.next;

  return (
    <div className="eng">
      <div className={`eng-next${action.kind === "streak" ? " is-urgent" : ""}`} role="status">
        <Sparkles size={16} />
        <span><b>Next:</b> {action.text}</span>
        {action.kind === "chest" || action.kind === "start" ? null : (
          <button className="eng-btn" style={{ marginLeft: "auto" }} onClick={() => navigate("/dungeon-gate")}>Open gates</button>
        )}
      </div>

      <div className="eng-grid">
        {/* ── Streak ── */}
        <div className="eng-card ds-glass">
          <div className="eng-head">
            <span className="eng-title"><Flame size={14} /> Streak</span>
            <span className="eng-sub">best {s.best}</span>
          </div>
          <div className={`eng-flame${s.count === 0 ? " is-cold" : ""}${s.at_risk ? " is-risk" : ""}`}>
            <Flame size={34} color="#fb923c" />
            <span className="eng-flame-num">{s.count}</span>
            <span className="eng-flame-unit">DAY{s.count === 1 ? "" : "S"}</span>
          </div>
          <div className="eng-note">
            {s.done_today
              ? <>Locked in for today. Come back tomorrow to make it <b>{s.count + 1}</b>.</>
              : s.count > 0
                ? <><span className="eng-warn">Ends in {formatCountdown(secondsLeft)}.</span> One conquest keeps it alive.</>
                : <>Conquer a gate today to start your streak.</>}
          </div>
          <div>
            <div className="eng-sub" style={{ marginBottom: 6 }}>
              <Snowflake size={11} style={{ verticalAlign: -1 }} /> STREAK FREEZES · {s.freezes}/{s.freeze_cap}
            </div>
            <div className="eng-pips">
              {freezePips.map((on, i) => <span key={i} className={`eng-pip${on ? " is-on" : ""}`}><Snowflake size={14} /></span>)}
            </div>
            <div className="eng-note" style={{ marginTop: 8 }}>
              A Freeze automatically covers a missed day. Next one in <b>{s.next_freeze_in}</b> day{s.next_freeze_in === 1 ? "" : "s"} of streak.
            </div>
          </div>
        </div>

        {/* ── Daily bounties ── */}
        <div className="eng-card ds-glass">
          <div className="eng-head">
            <span className="eng-title"><Target size={14} /> Daily Bounties</span>
            <span className="eng-sub">resets in {formatCountdown(secondsLeft)}</span>
          </div>
          {e.bounties.map((q) => (
            <div key={q.key} className={`eng-bounty${q.done ? " is-done" : ""}`}>
              <div className="eng-bounty-row">
                <b><span className="eng-bounty-d">{DIFF_LABEL[q.difficulty]}</span>{q.title}</b>
                <span className="eng-sub">{q.progress}/{q.target}</span>
              </div>
              <div className={`eng-bar${q.done ? " is-done" : ""}`}><i style={{ width: `${q.done ? 100 : bountyPercent(q)}%` }} /></div>
              <span className="eng-sub">{q.description}</span>
            </div>
          ))}
          {e.chest.claimed ? (
            <div className="eng-note">
              <Gift size={13} style={{ verticalAlign: -2 }} /> Today’s chest: <b style={{ color: RARITY_COLOR[e.chest.rarity] }}>{e.chest.rarity}</b> · +{e.chest.xp} XP
              {e.chest.item ? ` · ${e.chest.item}` : ""}. New bounties at midnight.
            </div>
          ) : (
            <>
              <button className={`eng-btn${e.chest.unlockable ? " is-hot" : ""}`} disabled={!e.chest.unlockable || busy} onClick={openChest}>
                <Gift size={14} /> {e.chest.unlockable ? "Open Bounty Chest" : `Chest unlocks at 2/3 (${e.bounties_done}/3)`}
              </button>
              <span className="eng-sub">{chestHint(e.bounties_done)}{e.chest.pity >= 3 ? ` · luck is building (${e.chest.pity}/5)` : ""}</span>
            </>
          )}
        </div>

        {/* ── World boss ── */}
        <div className="eng-card ds-glass">
          <div className="eng-head">
            <span className="eng-title"><Crown size={14} /> World Boss</span>
            <span className="eng-sub">{formatCountdown(bossSeconds)} left</span>
          </div>
          <div className="eng-boss-name">{b.name}</div>
          {b.hp ? (
            <>
              <div className={`eng-bar is-boss${b.defeated ? " is-down" : ""}`}><i style={{ width: `${b.defeated ? 100 : 100 - percent(b.damage, b.hp)}%` }} /></div>
              <div className="eng-boss-stats">
                <span>{b.defeated ? "DEFEATED" : `${hpLeft?.toLocaleString()} HP left`}</span>
                <span><Users size={11} style={{ verticalAlign: -1 }} /> {b.players} hunter{b.players === 1 ? "" : "s"}</span>
              </div>
            </>
          ) : (
            <div className="eng-note">Land the first hit of the week — every conquest deals XP as damage.</div>
          )}
          <div className="eng-note"><Swords size={12} style={{ verticalAlign: -2 }} /> You dealt <b>{b.my_damage.toLocaleString()}</b> damage{b.min_damage && b.my_damage < b.min_damage && b.hp ? ` · ${b.min_damage - b.my_damage} more to qualify for loot` : ""}.</div>
          {b.top.length > 0 && (
            <div className="eng-top">
              {b.top.map((t, i) => (<div key={i} className={t.me ? "is-me" : ""}><span>{i + 1}. {t.name}</span><span>{t.damage.toLocaleString()}</span></div>))}
            </div>
          )}
          {b.claimable.map((c) => (
            <button key={c.week} className="eng-btn is-hot" disabled={busy} onClick={() => claimBoss(c.week)}>
              <Crown size={14} /> Claim loot · {c.name} (+{c.reward_xp} XP)
            </button>
          ))}
        </div>
      </div>

      {nextT && (
        <button className="eng-trophy ds-glass" onClick={() => navigate("/achievements")} aria-label="Open trophies">
          <span className="eng-trophy-icon" style={{ color: RARITY_COLOR[nextT.rarity], background: "rgba(255,255,255,.05)" }}><TrophyIcon size={20} /></span>
          <span className="eng-trophy-body">
            <span className="eng-trophy-name"><span>{nextT.name} <span className="eng-sub">· {nextT.description}</span></span>
              <span className="eng-sub">{nextT.progress}/{nextT.threshold}</span></span>
            <span className="eng-bar"><i style={{ width: `${percent(nextT.progress, nextT.threshold)}%` }} /></span>
          </span>
          <span className="eng-sub">{e.achievements.unlocked}/{e.achievements.total} trophies</span>
        </button>
      )}

      {reveal && <Reveal {...reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}
