import { Home, ScrollText, Gift, Trophy, User, LogOut, Brain, Swords, Users, Target, BookOpen } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { calcLevel, calcXpProgress, xpForLevel } from "../lib/levelEngine";

const links = [
  { to: "/",            label: "Dashboard",   icon: Home },
  { to: "/quests",      label: "Quests",      icon: ScrollText },
  { to: "/rewards",     label: "Rewards",     icon: Gift },
  { to: "/arena",       label: "Arena",       icon: Swords },
  { to: "/social",      label: "Social",      icon: Users },
  { to: "/challenges",  label: "Challenges",  icon: Target },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/guide",       label: "Guide",       icon: BookOpen },
  { to: "/profile",     label: "Profile",     icon: User },
];

export function Sidebar() {
  const { signOut, profile, user } = useAuth();
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
        <div>
          <div className="sb-brand-title">SOLO LEVELING</div>
          <div className="sb-brand-sub">Second Brain 5.0</div>
        </div>
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
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 14,
          padding: "14px 16px",
          marginBottom: 8,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            {/* Avatar */}
            <div style={{
              width: 38, height: 38,
              borderRadius: 10,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem", fontWeight: 700, color: "var(--t1)",
              flexShrink: 0,
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: "0.86rem", fontWeight: 600, color: "var(--t1)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {displayName}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.6rem", color: "#a8a8ff", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", background: "rgba(168,168,255,0.1)", padding: "1px 5px", borderRadius: 4 }}>{playerClass}</span>
                <span style={{ fontSize: "0.6rem", color: "var(--t3)", fontWeight: 700, background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: 4 }}>{playerRank}-Rank</span>
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${xpPct}%`,
                background: "rgba(255,255,255,0.50)",
                borderRadius: 99,
                transition: "width 0.5s ease",
              }} />
            </div>
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.22)", marginTop: 5 }}>
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
