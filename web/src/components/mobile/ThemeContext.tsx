import { createContext, useContext } from "react";
import type { AuraId } from "../../lib/theme";

/** Lets the Me screen read and change the aura owned by the shell. */
export const AuraCtx = createContext<{ aura: AuraId; choose: (id: AuraId) => void; unseen: AuraId[]; markSeen: () => void }>({
  aura: "shadow", choose: () => undefined, unseen: [], markSeen: () => undefined,
});
export const useAuraState = () => useContext(AuraCtx);
