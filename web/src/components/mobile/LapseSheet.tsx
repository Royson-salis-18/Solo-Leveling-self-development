import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SystemAPI } from "../../services/SystemAPI";
import { useAuth } from "../../lib/authContext";
import { useBehavior } from "../../lib/behaviorContext";
import { useToast } from "../../lib/toast";
import { requestEngagementRefresh } from "../../lib/engagement";
import { addDays, isoDay } from "../../lib/gateRules";
import { haptic } from "../../lib/feedback";
import { LAPSE_REASONS, TINY_SUFFIX, afterLapseLine, lapseRemedy, powerWindow, type Remedy } from "../../lib/psyche";
import type { LapseReason } from "../../lib/gameTypes";
import type { AddPreset } from "./MobileUi";
import "./sheets.css";

export type LapseTarget = { id: string; title: string; tier?: string; category?: string };

/**
 * After a miss: one question, one fix. A miss is information about the plan, not a verdict on the person,
 * so the answer is a smaller or better-anchored next gate rather than a lecture. Spoken in the third person.
 */
export function LapseSheet({ gate, onClose, openAdd }: { gate: LapseTarget; onClose: () => void; openAdd: (g: undefined, p: AddPreset) => void }) {
  const toast = useToast();
  const { profile } = useAuth();
  const { data, reload } = useBehavior();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reason: LapseReason; remedy: Remedy } | null>(null);
  const power = useMemo(() => (data ? powerWindow(data.hours) : null), [data]);
  const name = profile?.name ?? "";

  const choose = async (reason: LapseReason) => {
    if (busy) return;
    setBusy(true); haptic("tap");
    try {
      await SystemAPI.logLapse(gate.id, reason);
      setDone({ reason, remedy: lapseRemedy(reason, name, power) });
      void reload();
    } catch (e) { toast.fail(e, "Couldn't save that"); } finally { setBusy(false); }
  };

  const act = async () => {
    if (!done) return;
    const { action } = done.remedy;
    if (action === "shrink" || action === "reschedule") {
      setBusy(true);
      try {
        const base = gate.title.replace(/\s*\((2|10)-minute[^)]*\)\s*$/i, "").replace(/\s*\(small start\)\s*$/i, "");
        await SystemAPI.saveGate({ title: `${base}${TINY_SUFFIX[done.reason] ?? " (small start)"}`, category: gate.category ?? "General", xp_tier: "Low", priority: "Normal", deadline: isoDay(addDays(new Date(), 1)) } as never, null);
        haptic("success"); toast.success("Smaller gate opened", "Due tomorrow. Finish this one and the chain stays intact.");
        requestEngagementRefresh(); onClose();
      } catch (e) { toast.fail(e, "Couldn't open it"); } finally { setBusy(false); }
      return;
    }
    onClose();
    if (action === "cue" || action === "treat") window.setTimeout(() => openAdd(undefined, { title: gate.title, category: gate.category, planOpen: true }), 80);
    else if (action === "rewrite") window.setTimeout(() => openAdd(undefined, { title: gate.title, category: gate.category }), 80);
  };

  return createPortal(
    <div className="sh-bg" onClick={onClose}>
      <div className="sh lsh" role="dialog" aria-modal="true" aria-label="What got in the way?" onClick={(e) => e.stopPropagation()}>
        <div className="sh-grab" />
        <header className="sh-head"><h2>{done ? "Here's the fix" : "What got in the way?"}</h2><button className="m-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
        <p className="lsh-gate">“{gate.title}”</p>

        {!done ? (
          <>
            <p className="lsh-lede">No penalty for answering. This is how the System learns what to change.</p>
            <div className="lsh-reasons" role="group" aria-label="Reason">
              {LAPSE_REASONS.map((r) => <button key={r.id} type="button" disabled={busy} onClick={() => choose(r.id)}>{r.label}</button>)}
            </div>
            <button className="lsh-skip" onClick={onClose}>Not now</button>
          </>
        ) : (
          <div className="lsh-fix">
            <h3>{done.remedy.headline}</h3>
            <p>{done.remedy.fix}</p>
            <p className="lsh-never">{afterLapseLine(name)}</p>
            {done.remedy.actionLabel && <button className="sh-go" disabled={busy} onClick={act}>{busy ? "Working…" : done.remedy.actionLabel}</button>}
            <button className="lsh-skip" onClick={onClose}>{done.remedy.actionLabel ? "Maybe later" : "Done"}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
