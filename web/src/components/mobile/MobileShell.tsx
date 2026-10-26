import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, Bot, Flame, Home, LayoutDashboard, LogOut, Menu, Plus, ScrollText, Skull, User, X } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { useNotifications } from "../../lib/notificationContext";
import { links } from "../Sidebar";
import { prefetchRoute } from "../../routes";
import { useEngagement } from "../../lib/engagementContext";
import { haptic } from "../../lib/feedback";
import { MobileUiProvider, useMobileUi } from "./MobileUi";
import "./theme.css";
import "./mobile.css";

/** Home · Gates · [+ new gate] · Army · Me — the gate list and creating gates are the core loop. */
const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/dungeon-gate", label: "Gates", icon: ScrollText },
  { to: "__add", label: "New gate", icon: Plus, primary: true },
  { to: "/collection", label: "Army", icon: Skull },
  { to: "/me", label: "Me", icon: User },
] as const;

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { notifications } = useNotifications();
  const { data: e, secondsLeft } = useEngagement();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.is_read).length;
  const st = e?.streak;
  const risk = !!st?.at_risk;
  const hrs = Math.floor(secondsLeft / 3600), mins = Math.floor((secondsLeft % 3600) / 60);
  return (
    <header className="m-top">
      <button className="m-icon-btn" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <button className={`m-streak${risk ? " risk" : ""}${st && st.count === 0 ? " cold" : ""}`} onClick={() => navigate("/")} aria-label={st ? `${st.count}-day streak${risk ? `, ends in ${hrs} hours` : ""}` : "Streak"}>
        <Flame size={16} />
        <b>{st?.count ?? "–"}</b>
        <span>{risk ? `${hrs > 0 ? `${hrs}h ` : ""}${mins}m left` : st?.done_today ? "held today" : "day streak"}</span>
      </button>
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
          </NavLink>
        );
      })}
    </nav>
  );
}

function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut, profile } = useAuth();
  if (!open) return null;
  return (
    <div className="m-sheet-bg" onClick={onClose}>
      <div className="m-sheet" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="m-sheet-head">
          <div>
            <div className="m-sheet-name">{profile?.name ?? "Hunter"}</div>
            <div className="m-sheet-sub">{profile?.player_rank ?? "E"}-Rank · Level {profile?.level ?? 1} · <NavLink to="/mode-selection" onClick={onClose} className="m-sheet-mode">{profile?.current_mode ?? "Normal"} mode</NavLink></div>
          </div>
          <button className="m-icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="m-sheet-grid">
          <NavLink to="/overview" onClick={onClose} className={({ isActive }) => `m-sheet-item${isActive ? " is-active" : ""}`}><LayoutDashboard size={20} strokeWidth={1.7} /><span>Overview</span></NavLink>
          <button className="m-sheet-item" onClick={() => { onClose(); window.setTimeout(() => document.querySelector<HTMLButtonElement>(".oracle-trigger")?.click(), 150); }}><Bot size={20} strokeWidth={1.7} /><span>Oracle</span></button>
          {links.filter((l) => l.to !== "/" && l.to !== "/dungeon-gate" && l.to !== "/collection" && l.to !== "/profile").map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"} onClick={onClose} className={({ isActive }) => `m-sheet-item${isActive ? " is-active" : ""}`}>
              <l.icon size={20} strokeWidth={1.7} /><span>{l.label}</span>
            </NavLink>
          ))}
        </div>
        <button className="m-sheet-out" onClick={() => { onClose(); void signOut(); }}><LogOut size={16} /> Sign out</button>
      </div>
    </div>
  );
}

export function MobileShell({ children }: { children: ReactNode }) {
  return <MobileUiProvider><ShellInner>{children}</ShellInner></MobileUiProvider>;
}

function ShellInner({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.mTheme = "ashborn";
    return () => { delete document.documentElement.dataset.mTheme; };
  }, []);
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => { setMenu(false); scroller.current?.scrollTo({ top: 0 }); }, [pathname]);
  return (
    <div className="m-shell">
      <TopBar onMenu={() => setMenu(true)} />
      <main className="m-content" id="main" ref={scroller}>{children}</main>
      <TabBar />
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
