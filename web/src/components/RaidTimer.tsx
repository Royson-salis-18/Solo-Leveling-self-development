import { useState, useEffect } from "react";

interface RaidTimerProps {
  startedAt: string;
  /** When set the clock is frozen at this moment (the raid is paused). */
  pausedAt?: string | null;
  className?: string;
}

const fmt = (ms: number) => {
  const diff = Math.max(0, ms);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export function RaidTimer({ startedAt, pausedAt, className = "" }: RaidTimerProps) {
  const [elapsed, setElapsed] = useState(() => fmt((pausedAt ? new Date(pausedAt).getTime() : Date.now()) - new Date(startedAt).getTime()));

  useEffect(() => {
    const start = new Date(startedAt).getTime();
    if (pausedAt) {
      // Paused: show the frozen value and don't tick (this used to keep running while "paused").
      setElapsed(fmt(new Date(pausedAt).getTime() - start));
      return;
    }
    const update = () => setElapsed(fmt(Date.now() - start));
    update();
    const interval = setInterval(update, 1000);
    // Don't burn timers in a background tab.
    const onVis = () => { if (!document.hidden) update(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", onVis); };
  }, [startedAt, pausedAt]);

  return <span className={`raid-timer-val ${className}${pausedAt ? " paused" : ""}`}>{elapsed}</span>;
}
