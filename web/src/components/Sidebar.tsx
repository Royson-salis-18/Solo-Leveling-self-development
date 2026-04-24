import { Home, ScrollText, Gift, User, LogOut, Brain, Swords, Users, Target, BookOpen, Bell, Flame, Backpack } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { calcLevel, calcXpProgress, xpForLevel } from "../lib/levelEngine";

const links = [
  { to: "/",            label: "Dashboard",    icon: Home },
  { to: "/war-room",    label: "War Room",      icon: Target },
  { to: "/dungeon-gate", label: "Dungeon Gate",  icon: ScrollText },
  { to: "/collection",  label: "Collection",   icon: Backpack },
  { to: "/rewards",     label: "Rewards",      icon: Gift },
  { to: "/arena",       label: "Arena",        icon: Swords },
  { to: "/social",      label: "Social",       icon: Users },
  { to: "/profile",     label: "Profile",        icon: User },
  { to: "/guide",       label: "Guide",        icon: BookOpen },
];

import { useNotifications } from "../lib/notificationContext";

export function Sidebar() {
  const { signOut, profile, user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();

  const displayName = profile?.name ?? user?.email?.split("@")[0] ?? "Hunter";
  const initial     = displayName.charAt(0).toUpperCase();
  const xp          = (profile as any)?.total_points ?? 0;
  const playerClass = (profile as any)?.player_class ?? "None";
  const playerRank  = (profile as any)?.player_rank  ?? "E";
  const level       = calcLevel(xp);
  const xpToNext    = xpForLevel(level);
  const xpPct       = calcXpProgress(xp);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="sidebar">

      {/* ── Brand ── */}
      <div className="sb-brand">
        <div className="sb-brand-icon">
          <Brain size={20} strokeWidth={1.5} />
        </div>
        <div className="sb-brand-meta">
          <div className="sb-brand-title">SOLO LEVELING</div>
          <div className="sb-brand-sub">Second Brain 5.0</div>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => navigate("/notifications")}
          className={`sb-icon-btn${unreadCount > 0 ? " sb-icon-btn--unread" : ""}`}
          aria-label="Notifications"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="sb-unread-dot" />
          )}
        </button>
      </div>

      {/* ── Nav ── */}
      <nav className="sb-nav">
        <div className="sb-section-label">Navigation</div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) => `sb-item${isActive ? " sb-item--active" : ""}${link.to === "/arena" ? " sb-item--arena" : ""}`}
          >
            <link.icon size={16} strokeWidth={1.8} />
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── User info ── */}
      <div style={{ padding: "0 4px 4px" }}>
        <div className="sb-user-panel">
          <div className="sb-user-top">
            {/* Avatar */}
            <div className="sb-avatar-box">
              {initial}
            </div>
            <div className="sb-user-meta">
              <div className="sb-user-title">
                {displayName}
              </div>
              <div className="sb-user-tags">
                <span className="sb-tag sb-tag--class">{playerClass}</span>
                <span className="sb-tag">{playerRank}-Rank</span>
                {(profile as any)?.streak_count > 0 && (
                  <span className="sb-tag sb-tag--streak">
                    <Flame size={10} /> {(profile as any).streak_count}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="sb-xp">
            <div className="sb-xp-track" aria-hidden="true">
              <div className="sb-xp-fill" style={{ width: `${xpPct}%` }} />
            </div>
            <div className="sb-xp-text">
              {xp.toLocaleString()} / {xpToNext.toLocaleString()} XP · Lv.{level}
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          className="sb-logout"
          onClick={handleLogout}
          style={{ width: "100%" }}
        >
          <LogOut size={14} strokeWidth={1.8} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
