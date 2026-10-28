import { useState } from "react";
import { ChevronDown, Flag, Link2 } from "lucide-react";
import type { GatePlan } from "../../lib/gameTypes";
import { CUE_PRESETS, OBSTACLE_PRESETS, PLEDGE_STAKES, TREAT_PRESETS, pledgeDividend, planDepth } from "../../lib/psyche";
import { haptic } from "../../lib/feedback";

/** Collapsible "Plan it": when it starts, what could stop it, what happens then, an optional treat and an optional pledge. */
export function PlanFields({ defaultOpen = false, tier, hasDeadline, plan, onPlan, stake, onStake, stakeBlocked, planHint }: {
  defaultOpen?: boolean; tier: string; hasDeadline: boolean; plan: GatePlan; onPlan: (p: GatePlan) => void;
  stake: number; onStake: (n: number) => void; stakeBlocked: string | null; planHint: string | null;
}) {
  const depth = planDepth(tier, hasDeadline);
  const [toggled, setToggled] = useState<boolean | null>(null);
  // harder gates open it by default (and it follows the rank as you change it); a tap overrides that
  const open = toggled ?? (defaultOpen || depth === "woop");
  const set = (patch: Partial<GatePlan>) => onPlan({ ...plan, ...patch });
  const filled = !!(plan.cue || plan.then || plan.pair);
  const showObstacle = depth === "woop" || !!plan.obstacle;

  return (
    <div className="pln">
      <button type="button" className="pln-head" aria-expanded={open} onClick={() => { setToggled(!open); haptic("tap"); }}>
        <span className="pln-title"><Link2 size={14} /> Plan it{filled && <i className="pln-dot" aria-label="plan added" />}</span>
        <span className="pln-sub">{filled ? "When it starts is set" : depth === "woop" ? "Harder gates stick with a plan" : "Optional · helps it stick"}</span>
        <ChevronDown size={16} className={open ? "up" : ""} />
      </button>

      {open && (
        <div className="pln-body">
          {planHint && <p className="pln-hint">{planHint}</p>}

          <label className="pln-label" htmlFor="pln-cue">When will you start?</label>
          <div className="sh-chips scroll" role="radiogroup" aria-label="Start cue">
            {CUE_PRESETS.map((c) => <button key={c} type="button" role="radio" aria-checked={plan.cue === c} className={plan.cue === c ? "on" : ""} onClick={() => set({ cue: plan.cue === c ? undefined : c })}>{c}</button>)}
          </div>
          <input id="pln-cue" className="pln-input" value={plan.cue ?? ""} onChange={(e) => set({ cue: e.target.value || undefined })} placeholder="Or your own: after the 3pm meeting, at the kitchen table" maxLength={120} />

          {!showObstacle && <button type="button" className="pln-link" onClick={() => set({ obstacle: "" })}>+ What could get in the way?</button>}
          {showObstacle && (
            <>
              <div className="pln-label">What is most likely to stop you?</div>
              <div className="sh-chips scroll" role="radiogroup" aria-label="Likely obstacle">
                {OBSTACLE_PRESETS.map((o) => <button key={o.obstacle} type="button" role="radio" aria-checked={plan.obstacle === o.obstacle} className={plan.obstacle === o.obstacle ? "on" : ""} onClick={() => set({ obstacle: o.obstacle, then: o.then })}>{o.obstacle}</button>)}
              </div>
              <label className="pln-label" htmlFor="pln-then">If that happens, then…</label>
              <input id="pln-then" className="pln-input" value={plan.then ?? ""} onChange={(e) => set({ then: e.target.value || undefined })} placeholder="I do only the first 2 minutes" maxLength={160} />
            </>
          )}

          <div className="pln-label">Treat only during this gate <em>optional</em></div>
          <div className="sh-chips scroll" role="radiogroup" aria-label="Treat">
            {TREAT_PRESETS.map((t) => <button key={t} type="button" role="radio" aria-checked={plan.pair === t} className={plan.pair === t ? "on" : ""} onClick={() => set({ pair: plan.pair === t ? undefined : t })}>{t}</button>)}
          </div>

          <div className="pln-label"><Flag size={13} /> Pledge XP <em>optional</em></div>
          <div className="sh-seg pln-stake" role="radiogroup" aria-label="Pledge">
            {[0, ...PLEDGE_STAKES].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stake === n} disabled={n > 0 && !!stakeBlocked} className={stake === n ? "on" : ""} onClick={() => { onStake(n); haptic("tap"); }}>{n === 0 ? "None" : n}</button>
            ))}
          </div>
          <p className="pln-hint">{stakeBlocked ?? (stake > 0 ? `Keep it and ${stake} XP comes back with +${pledgeDividend(stake)}. Miss it and the stake is gone.` : "Put XP on your word. It comes back if you keep it.")}</p>
        </div>
      )}
    </div>
  );
}
