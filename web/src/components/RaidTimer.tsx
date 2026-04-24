import { useState, useEffect } from "react";

interface RaidTimerProps {
  startedAt: string;
  className?: string;
}

export function RaidTimer({ startedAt, className = "" }: RaidTimerProps) {
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const update = () => {
      const start = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const diff = Math.max(0, now - start);
      
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      
      setElapsed(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return <span className={`raid-timer-val ${className}`}>{elapsed}</span>;
}
