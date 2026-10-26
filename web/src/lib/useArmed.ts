import { useCallback, useEffect, useRef, useState } from "react";
import { haptic } from "./feedback";

/**
 * Undo window for irreversible actions (conquering a gate): the first tap "arms" the action and
 * shows an Undo for `ms`; if nothing cancels it, `commit` runs. Only one action can be armed.
 */
export function useArmed(commit: (id: string) => Promise<void> | void, ms = 2600) {
  const [armed, setArmed] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const arm = useCallback((id: string) => {
    if (armed || running) return;
    haptic("tap");
    setArmed(id);
    window.setTimeout(() => document.getElementById(`gate-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 30);
    timer.current = window.setTimeout(async () => {
      setArmed(null);
      setRunning(id);
      try { await commit(id); } finally { setRunning(null); }
    }, ms);
  }, [armed, running, commit, ms]);

  const undo = useCallback(() => { window.clearTimeout(timer.current); setArmed(null); haptic("tap"); }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { armed, running, arm, undo };
}
