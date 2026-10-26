import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Snowflake, Sparkles, Trophy as TrophyIcon } from "lucide-react";
import { useEngagement } from "../lib/engagementContext";
import type { RevealData } from "../lib/useEngagement";
import {
  RARITY_COLOR, bountyPercent, chestHint, clock, nextBestAction, percent,
} from "../lib/engagement";
import { firstSteps } from "../lib/feedback";
import { FirstSteps } from "./UxLayer";
import "./engagement.css";

/** Quest difficulty is shown as a gate rank, like everything else in the System. */
const RANK = { 1: "E", 2: "C", 3: "B" } as const;

export function Reveal({ d, onClose }: { d: RevealData; onClose: () => void }) {
  const color = RARITY_COLOR[d.rarity as keyof typeof RARITY_COLOR] ?? "#a8a8ff";
  return (
    <div className="dd-reveal-bg" onClick={onClose} role="dialog" aria-modal="true" aria-label={d.title}>
      <div className="dd-reveal" style={{ ["--rc" as string]: color }} onClick={(e) => e.stopPropagation()}>
        <div className="dd-tag">[SYSTEM] {d.tag}</div>
        <div className="dd-reveal-ico"><Gift size={34} /></div>
        <h3>{d.title}</h3>
        <div className="dd-tag">{d.rarity} grade</div>
        <div className="dd-val">+{d.xp}<small>XP</small></div>
        <div className="dd-chips">
          {d.item && <span className="dd-chip">+ {d.item}</span>}
          {d.perfect && <span className="dd-chip">Full clear</span>}
          {d.trophies.map((t) => <span key={t.name} className="dd-chip">Record: {t.name}{t.xp ? ` +${t.xp}` : ""}</span>)}
        </div>
        <button className="dd-btn hot" onClick={onClose} autoFocus>Acquire</button>
      </div>
    </div>
  );
}

export function EngagementPanel({ openGates = 0, conquestsToday = 0 }: { openGates?: number; conquestsToday?: number }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem("sl_first_steps") === "1"; } catch { return false; } });
  const { data: e, failed, busy, reveal, setReveal, secondsLeft, bossSeconds, openChest, claimBoss, reload } = useEngagement();

  // A quiet cue in the tab title while something real is waiting.
  useEffect(() => {
    if (!e) return;
    const base = document.title.replace(/^\(!\)\s*/, "");
    const hot = e.streak.at_risk || (!e.chest.claimed && e.chest.unlockable);
    document.title = hot ? `(!) ${base}` : base;
    return () => { document.title = base; };
  }, [e]);

  if (failed && !e) return <div className="ux-retry"><span>Couldn’t load today’s directives.</span><button onClick={() => void reload()}>Retry</button></div>;
  if (!e) {
    return <div className="dd" aria-busy="true"><div className="dd-grid">{[0, 1, 2].map((i) => (
      <div key={i} className="dd-panel ds-glass" style={{ minHeight: 230, opacity: .4 }} />))}</div></div>;
  }

  const action = nextBestAction(e);
  const s = e.streak;
  const b = e.boss;
  const hpLeft = b.hp ? Math.max(0, b.hp - b.damage) : null;
  const nextT = e.achievements.next;
  const cacheReady = !e.chest.claimed && e.chest.unlockable;

  return (
    <div className="dd">
      {!dismissed && (() => {
        const fs = firstSteps({ openGates, trophiesUnlocked: e.achievements.unlocked, chestClaimed: e.chest.claimed, conquestsToday });
        return fs.complete ? null : <FirstSteps steps={fs.steps} onDismiss={() => { setDismissed(true); try { localStorage.setItem("sl_first_steps", "1"); } catch { /* ignore */ } }} />;
      })()}
      <div className="dd-label">Daily Directives <b>RESET {clock(secondsLeft)}</b></div>

      <div className={`dd-directive ds-glass${action.kind === "streak" ? " is-urgent" : ""}`} role="status">
        <Sparkles size={20} color={action.kind === "streak" ? "#ffa030" : "var(--accent-primary)"} style={{ opacity: .7, flexShrink: 0 }} />
        <div>
          <div className="dd-tag">System Directive</div>
          <div className="dd-text">{action.text}</div>
        </div>
        {action.kind !== "chest" && action.kind !== "start" && (
          <button className="dd-btn" style={{ marginLeft: "auto" }} onClick={() => navigate("/dungeon-gate")}>Enter gates</button>
        )}
      </div>

      <div className="dd-grid">
        {/* ── Chain of Resolve (streak) ── */}
        <div className={`dd-panel ds-glass aura-orange${s.at_risk ? " is-live" : ""}`}>
          <div className="dd-top">
            <div>
              <h3 className="dd-h">🔥 Chain of Resolve</h3>
              <div className="dd-val">{s.count}<small>DAY{s.count === 1 ? "" : "S"}</small></div>
            </div>
            <span className={`dd-pill ${s.done_today ? "ok" : s.count === 0 ? "cold" : "hot"}`}>
              {s.done_today ? "HELD TODAY" : s.count === 0 ? "DORMANT" : `SEVERS ${clock(secondsLeft)}`}
            </span>
          </div>
          <div>
            <div className="dd-foot" style={{ marginBottom: 8 }}>
              <span><Snowflake size={10} style={{ verticalAlign: -1 }} /> Freeze charges</span>
              <span>{s.freezes}/{s.freeze_cap}</span>
            </div>
            <div className="dd-pips">
              {Array.from({ length: s.freeze_cap }, (_, i) => (
                <span key={i} className={`dd-pip${i < s.freezes ? " on" : ""}`}><Snowflake size={14} /></span>))}
            </div>
          </div>
          <div className="dd-foot">
            <span>Best {s.best}</span>
            <span>Next charge in {s.next_freeze_in} day{s.next_freeze_in === 1 ? "" : "s"}</span>
          </div>
        </div>

        {/* ── Daily Quests ── */}
        <div className="dd-panel ds-glass">
          <div className="dd-top">
            <div>
              <h3 className="dd-h">📜 Daily Quests</h3>
              <div className="dd-val">{e.bounties_done}<small>/ 3 CLEARED</small></div>
            </div>
            <span className={`dd-pill ${e.chest.claimed ? "cold" : cacheReady ? "ok" : "warn"}`}>
              {e.chest.claimed ? "CACHE TAKEN" : cacheReady ? "CACHE UNSEALED" : "CACHE SEALED"}
            </span>
          </div>
          {e.bounties.map((q) => (
            <div key={q.key} className={`dd-quest${q.done ? " is-done" : ""}`}>
              <div className="dd-quest-row">
                <span className="dd-quest-name"><span className="dd-rank">{RANK[q.difficulty]}</span>{q.title}</span>
                <span className="dd-foot dd-mono">{q.progress}/{q.target}</span>
              </div>
              <div className={`dd-bar${q.done ? " ok" : ""}`}><i style={{ width: `${q.done ? 100 : bountyPercent(q)}%` }} /></div>
              <span className="dd-quest-desc">{q.description}</span>
            </div>
          ))}
          {e.chest.claimed ? (
            <div className="dd-foot">
              <span>{e.chest.rarity} cache · +{e.chest.xp} XP{e.chest.item ? ` · ${e.chest.item}` : ""}</span>
            </div>
          ) : (
            <>
              <button className={`dd-btn${cacheReady ? " hot" : ""}`} disabled={!cacheReady || busy} onClick={openChest}>
                <Gift size={14} /> {cacheReady ? "Open quest cache" : "Clear 2 quests to unseal"}
              </button>
              <div className="dd-foot"><span>{chestHint(e.bounties_done)}</span>{e.chest.pity >= 3 && <em>Luck building {e.chest.pity}/5</em>}</div>
            </>
          )}
        </div>

        {/* ── Calamity raid (world boss) ── */}
        <div className="dd-panel ds-glass aura-red">
          <div className="dd-top">
            <div>
              <h3 className="dd-h">👑 Calamity Raid</h3>
              <div style={{ fontSize: "1.15rem", fontWeight: 900, color: "#fff" }}>{b.name}</div>
            </div>
            <span className={`dd-pill ${b.defeated ? "ok" : "red"}`}>{b.defeated ? "SLAIN" : `${Math.floor(bossSeconds / 3600)}H LEFT`}</span>
          </div>
          {b.hp ? (
            <>
              <div className={`dd-bar big ${b.defeated ? "ok" : "red"}`}><i style={{ width: `${b.defeated ? 100 : 100 - percent(b.damage, b.hp)}%` }} /></div>
              <div className="dd-foot">
                <span>{b.defeated ? "Calamity defeated" : `${hpLeft?.toLocaleString()} HP remaining`}</span>
                <span>{b.players} hunter{b.players === 1 ? "" : "s"} engaged</span>
              </div>
            </>
          ) : (
            <div className="dd-foot"><span>The raid is unopened. Land the first strike.</span></div>
          )}
          <div className="dd-foot">
            <span>Your damage <b style={{ color: "#fff" }}>{b.my_damage.toLocaleString()}</b></span>
            {b.min_damage && b.hp && b.my_damage < b.min_damage ? <em>{b.min_damage - b.my_damage} more to qualify</em> : null}
          </div>
          {b.top.length > 0 && (
            <div className="dd-log">
              {b.top.map((t, i) => (<div key={i} className={t.me ? "me" : ""}><span>{i + 1}. {t.name}</span><span>{t.damage.toLocaleString()}</span></div>))}
            </div>
          )}
          {b.claimable.map((c) => (
            <button key={c.week} className="dd-btn hot" disabled={busy} onClick={() => claimBoss(c.week)}>
              <TrophyIcon size={14} /> Claim spoils · +{c.reward_xp} XP
            </button>
          ))}
        </div>
      </div>

      {nextT && (
        <button className="dd-record" onClick={() => navigate("/achievements")} aria-label="Open the Hall of Feats">
          <span className="dd-record-ico" style={{ color: RARITY_COLOR[nextT.rarity], borderColor: `${RARITY_COLOR[nextT.rarity]}55`, background: `${RARITY_COLOR[nextT.rarity]}14` }}>
            <TrophyIcon size={20} />
          </span>
          <span className="dd-record-body">
            <span className="dd-tag">Next record</span>
            <span className="dd-record-name">{nextT.name}<span>{nextT.description}</span></span>
            <span className="dd-bar"><i style={{ width: `${percent(nextT.progress, nextT.threshold)}%` }} /></span>
          </span>
          <span className="dd-foot dd-mono" style={{ flexDirection: "column", alignItems: "flex-end" }}>
            <span>{nextT.progress}/{nextT.threshold}</span><span>{e.achievements.unlocked}/{e.achievements.total} RECORDS</span>
          </span>
        </button>
      )}

      {reveal && <Reveal d={reveal} onClose={() => setReveal(null)} />}
    </div>
  );
}
