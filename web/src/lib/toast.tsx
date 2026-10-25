import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Bell, Check, Info, MessageSquare, Shield, Swords, X, Zap } from "lucide-react";
import { errorMessage } from "./rpc";

/**
 * One toast stack for the whole app. Replaces ~40 blocking `alert()` calls and is also what the
 * realtime notification stream renders into (so server events and client feedback share one UI).
 */
export type ToastType =
  | "success" | "error" | "info" | "system" | "achievement" | "friend" | "message" | "duel" | "invite" | "assignment";

export type ToastInput = { title: string; message?: string; type?: ToastType; duration?: number };
type ToastItem = ToastInput & { id: number; visible: boolean };

type ToastApi = {
  toast: (t: ToastInput) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
  /** Toast the human message of any thrown value. */
  fail: (err: unknown, title?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);
const MAX_VISIBLE = 4;

function Icon({ type }: { type: ToastType }) {
  switch (type) {
    case "success": return <Check size={18} />;
    case "error": return <AlertTriangle size={18} />;
    case "message": return <MessageSquare size={18} />;
    case "achievement": return <Zap size={18} />;
    case "friend": case "invite": return <Bell size={18} />;
    case "duel": return <Swords size={18} />;
    case "info": return <Info size={18} />;
    default: return <Shield size={18} />;
  }
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<number>());

  useEffect(() => {
    const live = timers.current;
    return () => { live.forEach((t) => window.clearTimeout(t)); live.clear(); };
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(() => { timers.current.delete(t); fn(); }, ms);
    timers.current.add(t);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, visible: false } : t)));
    later(() => setItems((prev) => prev.filter((t) => t.id !== id)), 450);
  }, [later]);

  const toast = useCallback((input: ToastInput) => {
    const id = ++seq.current;
    setItems((prev) => {
      // Collapse an identical toast that is still on screen instead of stacking duplicates.
      if (prev.some((t) => t.visible && t.title === input.title && t.message === input.message)) return prev;
      return [...prev.filter((t) => t.visible).slice(-(MAX_VISIBLE - 1)), { ...input, id, visible: true }];
    });
    later(() => dismiss(id), input.duration ?? (input.type === "error" ? 7000 : 5000));
  }, [dismiss, later]);

  const api = useMemo<ToastApi>(() => ({
    toast,
    success: (title, message) => toast({ title, message, type: "success" }),
    error: (title, message) => toast({ title, message, type: "error" }),
    info: (title, message) => toast({ title, message, type: "info" }),
    fail: (err, title = "System error") => toast({ title, message: errorMessage(err), type: "error" }),
  }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="system-toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className={`system-toast ${t.visible ? "visible" : "exit"} type-${t.type ?? "system"}`} role="status">
            <div className="toast-icon"><Icon type={t.type ?? "system"} /></div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              {t.message && <div className="toast-msg">{t.message}</div>}
            </div>
            <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
            <div className="toast-progress" style={{ animationDuration: `${(t.duration ?? (t.type === "error" ? 7000 : 5000)) / 1000}s` }} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
