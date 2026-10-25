import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SystemAPI } from "../services/SystemAPI";
import { useAuth } from "./authContext";
import { useToast } from "./toast";
import { useGameActions } from "./gameActions";
import { ENGAGEMENT_REFRESH_EVENT } from "./engagement";
import type { BossLootResult, ChestResult, Engagement } from "./gameTypes";

export type RevealData = {
  tag: string; title: string; rarity: string; xp: number; item: string | null; perfect?: boolean;
  trophies: Array<{ name: string; xp: number }>;
};

/**
 * Engagement state shared by the desktop panel and the mobile home: one RPC, refreshed on
 * focus / after conquests / every minute, with a local ticking countdown and loot actions.
 */
export function useEngagement() {
  const toast = useToast();
  const { apply, announce } = useGameActions();
  const { refreshProfile } = useAuth();

  const [data, setData] = useState<Engagement | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<RevealData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const fetchedAt = useRef(Date.now());

  const load = useCallback(async () => {
    try {
      const r = await SystemAPI.getEngagement();
      if (r.profile_missing) return;
      fetchedAt.current = Date.now();
      setData(r);
      setFailed(false);
    } catch {
      setFailed(true);                 // a bonus layer: never block the screen on it
    }
  }, []);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => {
      window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [load]);

  const secondsLeft = useMemo(
    () => (data ? Math.max(0, data.seconds_left - Math.floor((now - fetchedAt.current) / 1000)) : 0),
    [data, now],
  );
  const bossSeconds = useMemo(
    () => (data ? Math.max(0, Math.floor((new Date(data.boss.ends_at).getTime() - now) / 1000)) : 0),
    [data, now],
  );

  const afterLoot = useCallback((r: ChestResult | BossLootResult) => {
    apply(r.profile);
    announce(r.progression);
    void refreshProfile();
    void load();
  }, [apply, announce, refreshProfile, load]);

  const openChest = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await SystemAPI.claimBountyChest();
      afterLoot(r);
      setReveal({ tag: "QUEST CACHE OPENED", title: "Quest Cache", rarity: r.rarity, xp: r.xp, item: r.item, perfect: r.perfect, trophies: r.achievements });
    } catch (err) { toast.fail(err, "Cache sealed"); void load(); } finally { setBusy(false); }
  }, [busy, afterLoot, toast, load]);

  const claimBoss = useCallback(async (week: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await SystemAPI.claimBossReward(week);
      afterLoot(r);
      setReveal({ tag: "CALAMITY SLAIN", title: "Raid Spoils", rarity: "Epic", xp: r.xp, item: r.item, trophies: r.achievements });
    } catch (err) { toast.fail(err, "Could not claim spoils"); void load(); } finally { setBusy(false); }
  }, [busy, afterLoot, toast, load]);

  return { data, failed, busy, reveal, setReveal, secondsLeft, bossSeconds, reload: load, openChest, claimBoss };
}
