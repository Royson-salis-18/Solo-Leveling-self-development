import {
  Brain, CheckSquare, Edit3, PlusCircle, LayoutGrid, Smartphone,
  FolderOpen, Star, Archive, Crosshair, TrendingUp, DollarSign,
  BookOpen, Smile, Headphones, Play, BarChart2, Home, ScrollText,
  Gift, Trophy, User, LogOut,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";

function SidebarSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="nav-section">
      <p className="nav-section-label">{label}</p>
      {children}
    </div>
  );
}

function NavBtn({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="nav-item">
      <Icon size={13} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
    </div>
  );
}

const mainLinks = [
  { to: "/",            label: "Dashboard",   icon: Home },
  { to: "/quests",      label: "Quests",      icon: ScrollText },
  { to: "/rewards",     label: "Rewards",     icon: Gift },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/profile",     label: "Profile",     icon: User },
];

export function Sidebar() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      {/* Header image / wave area */}
      <div className="sidebar-header-img" />

      {/* Brand */}
      <div className="brand-wrap">
        <div className="brain-badge">
          <Brain size={16} color="rgba(255,255,255,0.75)" />
        </div>
        <p className="brand-title">Second Brain 5.0</p>
        <p className="brand-sub">Monochrome · Minimal · Focused</p>
      </div>

      {/* Quick Actions grid */}
      <SidebarSection label="Quick Actions">
        <div className="nav-actions-grid">
          <NavBtn icon={CheckSquare}  label="New Task" />
          <NavBtn icon={PlusCircle}   label="Add Resource" />
          <NavBtn icon={Edit3}        label="New Note" />
          <NavBtn icon={DollarSign}   label="Transaction" />
          <NavBtn icon={PlusCircle}   label="New Item" />
          <NavBtn icon={Edit3}        label="New Record" />
        </div>
      </SidebarSection>

      {/* Main Navigation */}
      <SidebarSection label="Navigation">
        {mainLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/"}
            className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
          >
            <link.icon size={13} />
            <span>{link.label}</span>
          </NavLink>
        ))}
        <NavBtn icon={Smartphone}   label="Mobile Access" />
        <NavBtn icon={FolderOpen}   label="Projects" />
        <NavBtn icon={Star}         label="Life Areas" />
        <NavBtn icon={Archive}      label="Archive" />
      </SidebarSection>

      {/* Work */}
      <SidebarSection label="Work">
        <NavBtn icon={Crosshair}    label="Focus Mode" />
        <NavBtn icon={TrendingUp}   label="SEO Dashboard" />
        <NavBtn icon={BarChart2}    label="Goals Tracker" />
        <NavBtn icon={DollarSign}   label="Finance Minimal" />
      </SidebarSection>

      {/* Life */}
      <SidebarSection label="Life">
        <NavBtn icon={CheckSquare}  label="Tasks" />
        <NavBtn icon={Edit3}        label="Journaling" />
        <NavBtn icon={Smile}        label="Habits Tracker" />
        <NavBtn icon={BookOpen}     label="Books Tracker" />
      </SidebarSection>

      {/* Gifts */}
      <SidebarSection label="Gifts">
        <NavBtn icon={Play}         label="Video Tutorial" />
        <NavBtn icon={Headphones}   label="Podcast" />
      </SidebarSection>

      {/* Monthly Finance */}
      <SidebarSection label="Monthly Finance">
        <NavBtn icon={TrendingUp}   label="Month Analysis" />
      </SidebarSection>

      {/* Spacer + Logout */}
      <div style={{ flex: 1 }} />
      <div className="nav-section" style={{ marginTop: 16, paddingBottom: 16 }}>
        <button
          onClick={handleLogout}
          className="nav-item"
          style={{ color: "rgba(255, 100, 100, 0.75)", width: "100%", background: "none", border: "none", cursor: "pointer" }}
        >
          <LogOut size={13} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
