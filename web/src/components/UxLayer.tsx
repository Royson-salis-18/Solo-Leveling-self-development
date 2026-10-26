import { useEffect, useRef, useState } from "react";
import { Check, WifiOff } from "lucide-react";
import { XP_GAIN_EVENT, prefersReducedMotion } from "../lib/feedback";
import type { FirstStep } from "../lib/feedback";
import "./ux.css";

/** "+15 XP" rises from the lower third of the screen after every conquest. */
export function XpFloat() {
  const [items, setItems] = useState<Array<{ id: number; xp: number }>>([]);
  const seq = useRef(0);
  useEffect(() => {
    const on = (e: Event) => {
      if (prefersReducedMotion()) return;
      const xp = (e as CustomEvent<{ xp: number }>).detail?.xp ?? 0;
      if (xp <= 0) return;
      const id = ++seq.current;
      setItems((p) => [...p.slice(-2), { id, xp }]);
      window.setTimeout(() => setItems((p) => p.filter((i) => i.id !== id)), 1500);
    };
    window.addEventListener(XP_GAIN_EVENT, on);
    return () => window.removeEventListener(XP_GAIN_EVENT, on);
  }, []);
  return (
    <div className="ux-xpfloat" aria-hidden="true">
      {items.map((i) => <span key={i.id}>+{i.xp} XP</span>)}
    </div>
  );
}

/** Honest connectivity feedback: tells people why actions are failing, and when it recovers. */
export function ConnectionBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [back, setBack] = useState(false);
  useEffect(() => {
    const off = () => { setOnline(false); setBack(false); };
    const on = () => { setOnline(true); setBack(true); window.setTimeout(() => setBack(false), 2200); };
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); };
  }, []);
  if (online && !back) return null;
  return (
    <div className={`ux-conn${online ? " ok" : ""}`} role="status" aria-live="polite">
      {online ? <><Check size={14} /> Back online</> : <><WifiOff size={14} /> You're offline. Changes won't save until you reconnect.</>}
    </div>
  );
}

/** Three-step starter checklist: progress already started (endowed progress), one clear next action. */
export function FirstSteps({ steps, onDismiss, mobile }: { steps: FirstStep[]; onDismiss: () => void; mobile?: boolean }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <section className={`ux-first${mobile ? " is-mobile" : ""}`} aria-label="Getting started">
      <header>
        <div><b>Getting started</b><span>{done} of {steps.length} done</span></div>
        <button onClick={onDismiss} aria-label="Dismiss getting started">Skip</button>
      </header>
      <div className="ux-first-bar"><i style={{ width: `${(done / steps.length) * 100}%` }} /></div>
      <ol>
        {steps.map((s) => (
          <li key={s.key} className={s.done ? "done" : s === next ? "next" : ""}>
            <i>{s.done ? <Check size={12} strokeWidth={3} /> : null}</i>
            <div><strong>{s.title}</strong>{s === next && <small>{s.hint}</small>}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
