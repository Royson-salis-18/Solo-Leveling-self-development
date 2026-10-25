import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";

/** Promise-based replacement for the blocking, unstyleable `window.confirm()`. */
export type ConfirmOptions = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive. */
  danger?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve) => {
    resolver.current?.(false); // a newer prompt supersedes an unanswered one
    resolver.current = resolve;
    setOpts(o);
  }), []);

  useEffect(() => {
    if (!opts) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") settle(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opts, settle]);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        isOpen={!!opts}
        title={opts?.title ?? ""}
        onClose={() => settle(false)}
        maxWidth="440px"
        footer={
          <>
            <Button variant="secondary" onClick={() => settle(false)}>{opts?.cancelLabel ?? "Cancel"}</Button>
            <Button variant={opts?.danger ? "danger" : "primary"} onClick={() => settle(true)}>
              {opts?.confirmLabel ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div style={{ padding: "4px 0 8px", fontSize: "0.9rem", lineHeight: 1.55, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-line" }}>
          {opts?.message}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
