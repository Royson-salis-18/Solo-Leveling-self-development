import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Award, Bell, ChevronDown, Home, LayoutDashboard, LogOut, Menu, ScrollText, Target, User, X } from "lucide-react";
import { useAuth } from "../../lib/authContext";
import { useNotifications } from "../../lib/notificationContext";
import { links } from "../Sidebar";
import { prefetchRoute } from "../../routes";
import "./mobile.css";

/** Home · War Room · [Gates] · Feats · Profile — the gate list is the app's primary action. */
const TABS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/war-room", label: "War Room", icon: Target },
  { to: "/dungeon-gate", label: "Gates", icon: ScrollText, primary: true },
  { to: "/achievements", label: "Feats", icon: Award },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { profile } = useAuth();
  const { notifications } = useNotifications();
  const navigate = useNavigate();
  const unread = notifications.filter((n) => !n.is_read).length;
  const mode = profile?.current_mode ?? "Normal";
  return (
    <header className="m-top">
      <button className="m-icon-btn" onClick={onMenu} aria-label="Open menu"><Menu size={20} /></button>
      <button className="m-chip" onClick={() => navigate("/mode-selection")} aria-label={`Difficulty: ${mode}. Change`}>
        <span>{mode}</span><em>MODE</em><ChevronDown size={14} />
      </button>
      <button className="m-icon-btn" onClick={() => navigate("/notifications")} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell size={20} />{unread > 0 && <i className="m-dot" />}
      </button>
    </header>
  );
}

function TabBar() {
  return (
    <nav className="m-tabs" aria-label="Primary">
      {TABS.map(({ to, label, icon: Icon, ...rest }) => (
        <NavLink
          key={to}
          to={to}
          end={"end" in rest}
          aria-label={label}
          className={({ isActive }) => `m-tab${isActive ? " is-active" : ""}${"primary" in rest ? " is-primary" : ""}`}
          onTouchStart={() => prefetchRoute(to)}
        >
          <Icon size={"primary" in rest ? 24 : 21} strokeWidth={1.8} />
        </NavLink>
      ))}
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
            <div className="m-sheet-sub">{profile?.player_rank ?? "E"}-Rank · Level {profile?.level ?? 1}</div>
          </div>
          <button className="m-icon-btn" onClick={onClose} aria-label="Close menu"><X size={20} /></button>
        </div>
        <div className="m-sheet-grid">
          <NavLink to="/overview" onClick={onClose} className={({ isActive }) => `m-sheet-item${isActive ? " is-active" : ""}`}><LayoutDashboard size={20} strokeWidth={1.7} /><span>Overview</span></NavLink>
          {links.filter((l) => l.to !== "/").map((l) => (
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
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => { setMenu(false); scroller.current?.scrollTo({ top: 0 }); }, [pathname]);
  return (
    <div className="m-shell">
      <TopBar onMenu={() => setMenu(true)} />
      <main className="m-content" ref={scroller}>{children}</main>
      <TabBar />
      <MenuSheet open={menu} onClose={() => setMenu(false)} />
    </div>
  );
}
