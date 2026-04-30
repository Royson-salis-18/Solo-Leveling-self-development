import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider }      from "./lib/authContext";
import { NotificationProvider } from "./lib/notificationContext";
import { ProtectedRoute }    from "./lib/ProtectedRoute";
import { Sidebar }           from "./components/Sidebar";
import { DashboardPage }     from "./pages/DashboardPage";
import { DungeonGatePage }   from "./pages/DungeonGatePage";
import { WarRoomPage }       from "./pages/WarRoomPage";
import { RewardsPage }       from "./pages/RewardsPage";
import { LeaderboardPage }   from "./pages/LeaderboardPage";
import { ProfilePage }       from "./pages/ProfilePage";
import { ArenaPage }         from "./pages/ArenaPage";
import { SocialPage }        from "./pages/SocialPage";
import { ChallengesPage }    from "./pages/ChallengesPage";
import { LoginPage }         from "./pages/LoginPage";
import { RegisterPage }      from "./pages/RegisterPage";
import { GuidePage }         from "./pages/GuidePage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { CollectionPage }    from "./pages/CollectionPage";
import "./app.css";

function AppContent() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected app shell */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className={`layout ${isCollapsed ? 'sb-collapsed' : ''}`}>
              <div className="system-bg-overlay"></div>
              <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
              <main className="content">
                <Routes>
                  <Route path="/"            element={<DashboardPage />} />
                  <Route path="/war-room"    element={<WarRoomPage />} />
                  <Route path="/dungeon-gate" element={<DungeonGatePage />} />
                  <Route path="/collection"  element={<CollectionPage />} />
                  <Route path="/rewards"     element={<RewardsPage />} />
                  <Route path="/arena"       element={<ArenaPage />} />
                  <Route path="/social"      element={<SocialPage />} />
                  <Route path="/challenges"  element={<ChallengesPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/profile"     element={<ProfilePage />} />
                  <Route path="/guide"       element={<GuidePage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="*"            element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}
