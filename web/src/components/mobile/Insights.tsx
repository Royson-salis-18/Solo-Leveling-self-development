import { useMemo } from "react";
import { HatchBars, Kpis, Panel, SegBar } from "../visuals";
import { useBehavior } from "../../lib/behaviorContext";
import { LAPSE_REASONS, bestWeekday, calibrate, planInsight, powerWindow } from "../../lib/psyche";
import "./coach.css";

const LAPSE_COLOR: Record<string, string> = { too_big: "#f87171", forgot: "#fbbf24", low_energy: "#60a5fa", distracted: "#a78bfa", unclear: "#38bdf8", no_time: "#fb923c", other: "#94a3b8" };
const BUCKETS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

/** What the player's own history says works for them. Claims only appear once there is enough data to mean something. */
export function Insights() {
  const { data: b, failed } = useBehavior();
  const view = useMemo(() => {
    if (!b) return null;
    const plan = planInsight(b);
    const win = powerWindow(b.hours);
    const day = bestWeekday(b.weekdays);
    const cal = calibrate(b);
    const buckets = BUCKETS.map((label, i) => ({ label, value: b.hours.slice(i * 3, i * 3 + 3).reduce((a, c) => a + c, 0) }));
    const total = buckets.reduce((a, c) => a + c.value, 0);
    return { plan, win, day, cal, buckets, total };
  }, [b]);

  if (!b || !view) return failed ? null : <div className="in-skel" aria-hidden="true" />;
  const { plan, win, day, cal, buckets, total } = view;

  return (
    <div className="in">
      <Panel title="Do plans work for you?">
        {plan.ready
          ? <Kpis items={[{ label: "With a plan", value: `${plan.planned}%`, note: `${b.plan_effect.planned.n} gates` }, { label: "Without", value: `${plan.unplanned}%`, note: `${b.plan_effect.unplanned.n} gates` }, { label: "Difference", value: `${plan.lift! > 0 ? "+" : ""}${plan.lift}`, delta: plan.lift }]} />
          : null}
        <p className={`in-text ${plan.tone}`}>{plan.text}</p>
      </Panel>

      <Panel title="Your power hours" right={win ? <span>{win.label}</span> : undefined}>
        {total >= 6 ? <HatchBars data={buckets} /> : null}
        <p className="in-text">{win ? `${win.share}% of your conquests land between ${win.label}${day ? `, and ${day.label} is your strongest day` : ""}. Put the hard gates there.` : "Finish about six gates and the System will find the hours you do your best work."}</p>
      </Panel>

      <Panel title="Difficulty" right={cal.rate !== null ? <span>{cal.rate}% finished</span> : undefined}>
        <p className="in-head">{cal.title}</p>
        <p className="in-text">{cal.text}</p>
      </Panel>

      {b.lapses.length > 0 && (
        <Panel title="Why gates slip">
          <SegBar parts={b.lapses.map((l) => ({ name: LAPSE_REASONS.find((r) => r.id === l.reason)?.label ?? l.reason, value: l.n, color: LAPSE_COLOR[l.reason] ?? "#94a3b8" }))} />
          <p className="in-text">Each miss you name teaches the System what to change. Fix the biggest slice first.</p>
        </Panel>
      )}
    </div>
  );
}
