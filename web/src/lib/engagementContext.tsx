import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useEngagementState } from "./useEngagement";

type Value = ReturnType<typeof useEngagementState>;
const Ctx = createContext<Value | null>(null);

/** One engagement fetch/poll shared by the tab bar badges, the dashboard panel and the mobile home. */
export function EngagementProvider({ children }: { children: ReactNode }) {
  const value = useEngagementState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEngagement(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useEngagement must be used within EngagementProvider");
  return v;
}
