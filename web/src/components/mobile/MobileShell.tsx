import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronLeft, Flame, Home, Plus, ScrollText, Skull, User } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { useNotifications } from "../../lib/notificationContext";
import { prefetchRoute } from "../../routes";
import { useEngagement } from "../../lib/engagementContext";
import { haptic } from "../../lib/feedback";
import { MobileUiProvider, useMobileUi } from "./MobileUi";
import { useAura } from "../../lib/theme";
import { AuraCtx, useAuraState } from "./ThemeContext";
import "./theme.css";
import "./mobile.css";
import "./polish.css";

/** Home · Gates · [+ new gate] · Army · Me — the gate list and creating gates are the core loop. */
const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/dungeon-gate", label: "Gates", icon: ScrollText },
  { to: "__add", label: "New gate", icon: Plus, primary: true },
  { to: "/collection", label: "Army", icon: Skull },
  { to: "/me", label: "Me", icon: User },
] as const;

/** Tab roots show the streak; every other screen gets a back arrow (and an edge-swipe back). */
const ROOTS = new Set(["/", "/dungeon-gate", "/collection", "/me"]);

function goBack(navigate: ReturnType<typeof useNavigate>) {
  const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
  if (idx > 0) navigate(-1); else navigate("/me");
}

function TopBar() {
  const { notifications } = useNotifications();
  const { data: e, secondsLeft } = useEngagement();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const root = ROOTS.has(pathname);
  const unread = notifications.filter((n) => !n.is_read).length;
  const st = e?.streak;
  const risk = !!st?.at_risk;
  const hrs = Math.floor(secondsLeft / 3600), mins = Math.floor((secondsLeft % 3600) / 60);
  return (
    <header className="m-top">
      {root ? null : <button className="m-icon-btn m-back" onClick={() => { haptic("tap"); goBack(navigate); }} aria-label="Back"><ChevronLeft size={22} /></button>}
      {root && <button className={`m-streak${risk ? " risk" : ""}${st && st.count === 0 ? " cold" : ""}`} onClick={() => navigate("/")} aria-label={st ? `${st.count}-day streak${risk ? `, ends in ${hrs} hours` : ""}` : "Streak"}>
        <Flame size={16} />
        <b>{st?.count ?? "–"}</b>
        <span>{risk ? `${hrs > 0 ? `${hrs}h ` : ""}${mins}m left` : st?.done_today ? "held today" : "day streak"}</span>
      </button>}
      <span className="m-top-gap" />
      <button className="m-icon-btn" onClick={() => navigate("/notifications")} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell size={20} />{unread > 0 && <i className="m-dot" />}
      </button>
    </header>
  );
}

function TabBar() {
  const { data: e } = useEngagement();
  const { openAdd } = useMobileUi();
  const homeAlert = !!e && (e.streak.at_risk || (!e.chest.claimed && e.chest.unlockable));
  const { unseen } = useAuraState();
  return (
    <nav className="m-tabs" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon, ...rest }) => {
        const primary = "primary" in rest;
        if (to === "__add") {
          return <button key={to} className="m-tab is-primary" onClick={() => openAdd()} aria-label={label}><Icon size={22} strokeWidth={2.2} /></button>;
        }
        return (
          <NavLink key={to} to={to} end={"end" in rest} aria-label={label}
            className={({ isActive }) => `m-tab${isActive ? " is-active" : ""}${primary ? " is-primary" : ""}`}
            onTouchStart={() => prefetchRoute(to)} onClick={() => haptic("tap")}>
            <Icon size={20} strokeWidth={1.7} />
            <span>{label}</span>
            {to === "/" && homeAlert && <i className="m-badge" aria-label="Something is waiting" />}
            {to === "/me" && unseen.length > 0 && <i className="m-badge" aria-label="New aura unlocked" />}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  return <MobileUiProvider><ShellInner>{children}</ShellInner></MobileUiProvider>;
}

function ShellInner({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const auraState = useAura(profile?.player_rank ?? "E");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [pathname]);

  // Swipe right from the left edge to go back (sub-screens only).
  useEffect(() => {
    if (ROOTS.has(pathname)) return;
    let x0 = -1, y0 = 0;
    const start = (e: TouchEvent) => { const t = e.touches[0]; x0 = t.clientX <= 24 ? t.clientX : -1; y0 = t.clientY; };
    const end = (e: TouchEvent) => {
      if (x0 < 0) return;
      const t = e.changedTouches[0];
      if (t.clientX - x0 > 80 && Math.abs(t.clientY - y0) < 60) { haptic("tap"); goBack(navigate); }
      x0 = -1;
    };
    window.addEventListener("touchstart", start, { passive: true });
    window.addEventListener("touchend", end);
    return () => { window.removeEventListener("touchstart", start); window.removeEventListener("touchend", end); };
  }, [pathname, navigate]);
  return (
    <AuraCtx.Provider value={auraState}>
    <div className="m-shell">
      <TopBar />
      <main className="m-content" id="main" ref={scroller}>{children}</main>
      <TabBar />
    </div>
    </AuraCtx.Provider>
  );
}
