import { useCallback, useMemo } from "react";
import { useAuth } from "./authContext";
import { useToast } from "./toast";
import { SystemAPI } from "../services/SystemAPI";
import { describeCompletion, describeFailure } from "./gameFormat";
import { requestEngagementRefresh } from "./engagement";
import { announceXp, haptic } from "./feedback";
import type { CompleteResult, FailResult, ProfileSnapshot, Progression } from "./gameTypes";

/** Window event the app shell listens to for the level-up rain effect. */
export const LEVEL_UP_EVENT = "solo-leveling:level-up";

/**
 * The one place that turns an engine result into UI effects:
 *   • merges the returned profile snapshot into the cached profile (sidebar updates instantly)
 *   • fires the level-up effect
 *   • shows a concise toast (level/rank/shadow/burst/ARISE toasts arrive from the server's
 *     notification stream, so they are intentionally not duplicated here)
 *   • turns any failure into a readable toast and a `null` result
 */
export function useGameActions() {
  const { applyProfilePatch } = useAuth();
  const toast = useToast();

  const apply = useCallback((snap?: ProfileSnapshot) => { if (snap) applyProfilePatch(snap); }, [applyProfilePatch]);

  const announce = useCallback((p?: Progression) => {
    if (p?.leveled_up && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(LEVEL_UP_EVENT, { detail: { level: p.level, prevLevel: p.prev_level, rank: p.rank } }));
    }
  }, []);

  const complete = useCallback(async (taskId: string): Promise<CompleteResult | null> => {
    try {
      const r = await SystemAPI.completeGate(taskId);
      apply(r.profile);
      announce(r.progression);
      requestEngagementRefresh();
      haptic(r.progression?.leveled_up ? "reward" : "success");
      if (!r.already) announceXp(r.xp?.applied ?? 0);
      const f = describeCompletion(r);
      toast.toast({ title: f.title, message: f.message, type: f.kind });
      return r;
    } catch (e) {
      toast.fail(e, "Conquest failed");
      return null;
    }
  }, [apply, announce, toast]);

  const fail = useCallback(async (taskId: string): Promise<FailResult | null> => {
    try {
      const r = await SystemAPI.failGate(taskId);
      apply(r.profile);
      const f = describeFailure(r);
      toast.toast({ title: f.title, message: f.message, type: f.kind });
      return r;
    } catch (e) {
      toast.fail(e, "Could not abandon gate");
      return null;
    }
  }, [apply, toast]);

  return useMemo(() => ({ complete, fail, apply, announce }), [complete, fail, apply, announce]);
}
