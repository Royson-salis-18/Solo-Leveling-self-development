import { useMemo, useState } from "react";
import { Compass, Flag, LifeBuoy, PenLine, StickyNote, Sunrise, TrendingUp, X } from "lucide-react";
import { SystemAPI } from "../../services/SystemAPI";
import { useAuth } from "../../lib/authContext";
import { useBehavior } from "../../lib/behaviorContext";
import { useToast } from "../../lib/toast";
import { haptic } from "../../lib/feedback";
import { calibrate, coachOrder, freshStart, reflectionDue, reflectionNote, reflectionPrompts, type CoachKind } from "../../lib/psyche";
import { useMobileUi } from "./MobileUi";
import "./coach.css";

const KEY = (day: string) => `sl_coach_off_${day}`;
const readOff = (day: string): CoachKind[] => { try { return JSON.parse(localStorage.getItem(KEY(day)) ?? "[]"); } catch { return []; } };

/**
 * The Coach: at most two prompts, chosen by `coachOrder`. Each one is a technique with a source (see
 * GAME_RULES.md) and each can be dismissed for the day. When there is nothing worth saying it renders nothing.
 */
export function Coach({ weeklyTarget, conqueredToday }: { weeklyTarget: number | null; conqueredToday: number }) {
  const { data: b, reload } = useBehavior();
  const { profile } = useAuth();
  const toast = useToast();
  const { openAdd, openLapse } = useMobileUi();
  const [off, setOff] = useState<CoachKind[]>(() => (b ? readOff(b.today) : []));
  const [worked, setWorked] = useState("");
  const [change, setChange] = useState("");
  const [saving, setSaving] = useState(false);
  const name = profile?.name ?? "";

  const plan = useMemo(() => {
    if (!b) return null;
    const fresh = freshStart(b, weeklyTarget);
    const calibration = calibrate(b);
    const now = new Date();
    const kinds = coachOrder({ b, fresh, calibration, reflectDue: reflectionDue(now, conqueredToday, b.reflection.today), hour: now.getHours(), limit: 4 })
      .filter((k) => !readOff(b.today).includes(k) && !off.includes(k)).slice(0, 2);
    return { fresh, calibration, kinds };
  }, [b, weeklyTarget, conqueredToday, off]);

  if (!b || !plan || plan.kinds.length === 0) return null;
  const dismiss = (k: CoachKind) => {
    const next = [...new Set([...off, k])];
    setOff(next);
    try { localStorage.setItem(KEY(b.today), JSON.stringify(next)); } catch { /* private mode */ }
  };

  const saveReflection = async () => {
    if (saving || (!worked.trim() && !change.trim())) return;
    setSaving(true);
    try {
      const r = await SystemAPI.saveReflection(worked, change);
      haptic("success");
      toast.info("Reflection saved", reflectionNote(r.days_14, r.first_today));
      setWorked(""); setChange("");
      await reload();
    } catch (e) { toast.fail(e, "Couldn't save that"); } finally { setSaving(false); }
  };

  const q = reflectionPrompts(name);
  const gate = b.unexamined[0];
  const pledge = b.pledges.open[0];

  return (
    <section className="co" aria-label="Coach">
      <div className="co-eyebrow"><Compass size={12} /> Coach</div>
      {plan.kinds.map((k) => {
        if (k === "lapse" && gate) return (
          <article key={k} className="co-card">
            <span className="co-ico"><LifeBuoy size={17} /></span>
            <div className="co-main"><h3>What got in the way?</h3><p>“{gate.title}” didn't happen. Look at it, don't punish it. One tap tells the System what to change.</p>
              <button className="co-btn" onClick={() => openLapse({ id: gate.id, title: gate.title, tier: gate.tier, category: gate.category })}>Take a look</button></div>
          </article>
        );
        if (k === "fresh" && plan.fresh) return (
          <article key={k} className={`co-card${plan.fresh.kind === "momentum" ? " calm" : ""}`}>
            <span className="co-ico"><Sunrise size={17} /></span>
            <div className="co-main"><h3>{plan.fresh.title}</h3><p>{plan.fresh.body}</p>
              {plan.fresh.cta && <button className="co-btn" onClick={() => { openAdd(undefined, { planOpen: true }); dismiss("fresh"); }}>{plan.fresh.cta}</button>}</div>
            <button className="co-x" onClick={() => dismiss("fresh")} aria-label="Dismiss"><X size={16} /></button>
          </article>
        );
        if (k === "reflect") return (
          <article key={k} className="co-card co-form">
            <span className="co-ico"><PenLine size={17} /></span>
            <div className="co-main"><h3>One minute for tonight</h3>
              <label htmlFor="co-worked">{q.worked}</label>
              <textarea id="co-worked" rows={2} maxLength={400} value={worked} onChange={(e) => setWorked(e.target.value)} placeholder="Started before I felt ready" />
              <label htmlFor="co-change">{q.change}</label>
              <textarea id="co-change" rows={2} maxLength={400} value={change} onChange={(e) => setChange(e.target.value)} placeholder="Plan the first gate the night before" />
              <div className="co-row"><button className="co-btn" disabled={saving || (!worked.trim() && !change.trim())} onClick={saveReflection}>{saving ? "Saving…" : "Save"}</button><small>No XP for this. It's yours.</small></div></div>
            <button className="co-x" onClick={() => dismiss("reflect")} aria-label="Skip tonight"><X size={16} /></button>
          </article>
        );
        if (k === "note" && b.reflection.last?.change) return (
          <article key={k} className="co-card">
            <span className="co-ico"><StickyNote size={17} /></span>
            <div className="co-main"><h3>Your note from last night</h3><p className="co-quote">“{b.reflection.last.change}”</p>
              <button className="co-btn" onClick={() => { openAdd(undefined, { planOpen: true }); dismiss("note"); }}>Turn it into a plan</button></div>
            <button className="co-x" onClick={() => dismiss("note")} aria-label="Dismiss"><X size={16} /></button>
          </article>
        );
        if (k === "pledge" && pledge) return (
          <article key={k} className="co-card">
            <span className="co-ico"><Flag size={17} /></span>
            <div className="co-main"><h3>You gave your word</h3><p>“{pledge.title}”: <b className="co-gold">{pledge.stake} XP</b> on it{pledge.deadline ? `, due ${new Date(`${pledge.deadline}T12:00:00`).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" })}` : ""}. Keep it and +{pledge.dividend} comes with the stake.</p></div>
            <button className="co-x" onClick={() => dismiss("pledge")} aria-label="Dismiss"><X size={16} /></button>
          </article>
        );
        if (k === "calibrate") return (
          <article key={k} className="co-card">
            <span className="co-ico"><TrendingUp size={17} /></span>
            <div className="co-main"><h3>{plan.calibration.title}</h3><p>{plan.calibration.text}</p>
              <button className="co-btn" onClick={() => { openAdd(undefined, plan.calibration.kind === "stretch" ? { tier: "High", planOpen: true } : { tier: "Low" }); dismiss("calibrate"); }}>{plan.calibration.kind === "stretch" ? "Open a harder gate" : "Open a small one"}</button></div>
            <button className="co-x" onClick={() => dismiss("calibrate")} aria-label="Dismiss"><X size={16} /></button>
          </article>
        );
        return null;
      })}
    </section>
  );
}
