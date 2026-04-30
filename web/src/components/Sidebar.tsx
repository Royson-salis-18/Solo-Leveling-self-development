import { Home, ScrollText, Gift, User, LogOut, Brain, Swords, Users, Target, BookOpen, Flame, Backpack, Trophy } from "lucide-react";
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
  { to: "/leaderboard", label: "Leaderboard",  icon: Trophy },
  { to: "/profile",     label: "Profile",        icon: User },
  { to: "/guide",       label: "Guide",        icon: BookOpen },
];

import { useNotifications } from "../lib/notificationContext";

export function Sidebar({ isCollapsed, onToggle }: { isCollapsed: boolean, onToggle: () => void }) {
  const { signOut, profile, user } = useAuth();
  useNotifications(); // keep context subscription alive
  const navigate = useNavigate();

  const displayName = profile?.name ?? user?.email?.split("@")[0] ?? "Hunter";
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
        <button 
          onClick={onToggle} 
          className="sb-brand-btn" 
          aria-label="Toggle Sidebar"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <div className="sb-brand-icon">
            <Brain size={isCollapsed ? 20 : 24} strokeWidth={1.5} />
          </div>
        </button>
        
        {!isCollapsed && (
          <div className="sb-brand-meta" onClick={onToggle} style={{ cursor: 'pointer' }}>
            <div className="sb-brand-title">SOLO LEVELING</div>
            <div className="sb-brand-sub">Shadow System v2.1</div>
          </div>
        )}
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
            title={isCollapsed ? link.label : undefined}
          >
            <link.icon size={isCollapsed ? 16 : 18} strokeWidth={1.8} />
            {!isCollapsed && <span>{link.label}</span>}
          </NavLink>
        ))}
      </nav>



      {/* ── User info ── */}
      <div style={{ padding: "0 4px 4px", marginTop: 'auto' }}>
        <div className="sb-user-panel">
          <div className="sb-user-top">
            {/* Avatar */}
            <div className="sb-avatar-box">
               <User size={isCollapsed ? 14 : 16} />
            </div>
            {!isCollapsed && (
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
            )}
          </div>

          {/* XP bar */}
          {!isCollapsed && (
            <div className="sb-xp">
              <div className="sb-xp-track" aria-hidden="true">
                <div className="sb-xp-fill" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="sb-xp-text">
                {xp.toLocaleString()} / {xpToNext.toLocaleString()} XP · Lv.{level}
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <button
          className="sb-logout"
          onClick={handleLogout}
          style={{ width: "100%" }}
          title={isCollapsed ? "Sign Out" : undefined}
        >
          <LogOut size={isCollapsed ? 14 : 16} strokeWidth={1.8} />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}
