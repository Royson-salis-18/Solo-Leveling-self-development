import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { SystemAPI } from "../services/SystemAPI";
import { ENGAGEMENT_REFRESH_EVENT } from "./engagement";
import type { Behavior } from "./gameTypes";

type Value = { data: Behavior | null; failed: boolean; reload: () => Promise<void> };
const Ctx = createContext<Value | null>(null);

/**
 * What the player's own history says (plan follow-through, power hours, pledges, gates awaiting a
 * diagnosis). One fetch shared by Home, Gates and Me; refreshed after conquests and on focus.
 * A bonus layer: if it fails the screens simply omit it.
 */
export function BehaviorProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Behavior | null>(null);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      const b = await SystemAPI.getBehavior(60);
      if ((b as { profile_missing?: boolean }).profile_missing) return;
      setData(b);
      setFailed(false);
      // Pledges settle on the server, which also posts the notification, so there is no toast here.
    } catch { setFailed(true); }
  }, []);

  useEffect(() => {
    void reload();
    const on = () => void reload();
    const vis = () => { if (document.visibilityState === "visible") void reload(); };
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, on);
    document.addEventListener("visibilitychange", vis);
    return () => { window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, on); document.removeEventListener("visibilitychange", vis); };
  }, [reload]);

  return <Ctx.Provider value={{ data, failed, reload }}>{children}</Ctx.Provider>;
}

export function useBehavior(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useBehavior must be used within BehaviorProvider");
  return v;
}
