import { Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider }      from "./lib/authContext";
import { NotificationProvider } from "./lib/notificationContext";
import { ProtectedRoute }    from "./lib/ProtectedRoute";
import { Sidebar }           from "./components/Sidebar";
import { PageSkeleton }      from "./components/PageSkeleton";
import { SoloRainOverlay } from "./components/SoloRainOverlay";
import { OracleArchitect, Pages, prefetchCommonRoutes } from "./routes";

function AppContent() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLevelUpFx, setShowLevelUpFx] = useState(false);
  const [levelUpHud, setLevelUpHud] = useState("LEVEL UP // ARISE");

  useEffect(() => { prefetchCommonRoutes(); }, []);

  useEffect(() => {
    let timer: number | null = null;
    const onLevelUp = (evt: Event) => {
      const detail = (evt as CustomEvent<{ level?: number; rank?: string }>).detail;
      const nextHud = detail?.level
        ? `LEVEL ${detail.level} UNLOCKED${detail.rank ? ` // ${detail.rank}-RANK` : ""}`
        : "LEVEL UP // ARISE";
      setLevelUpHud(nextHud);
      setShowLevelUpFx(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowLevelUpFx(false), 2200);
    };
    window.addEventListener("solo-leveling:level-up", onLevelUp);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("solo-leveling:level-up", onLevelUp);
    };
  }, []);

  return (
    <Routes>
      {/* Auth */}
      <Route path="/login"    element={<Suspense fallback={<PageSkeleton />}><Pages.Login /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<PageSkeleton />}><Pages.Register /></Suspense>} />

      {/* Protected app shell */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className={`layout ${isCollapsed ? 'sb-collapsed' : ''}`}>
              <div className="system-bg-overlay"></div>
              <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
              <main className="content">
                <Suspense fallback={<PageSkeleton />}>
                  <Routes>
                    <Route path="/"            element={<Pages.Dashboard />} />
                    <Route path="/war-room"    element={<Pages.WarRoom />} />
                    <Route path="/dungeon-gate" element={<Pages.DungeonGate />} />
                    <Route path="/collection"  element={<Pages.Collection />} />
                    <Route path="/rewards"     element={<Pages.Rewards />} />
                    <Route path="/arena"       element={<Pages.Arena />} />
                    <Route path="/social"      element={<Pages.Social />} />
                    <Route path="/challenges"  element={<Pages.Challenges />} />
                    <Route path="/leaderboard" element={<Pages.Leaderboard />} />
                    <Route path="/profile"     element={<Pages.Profile />} />
                    <Route path="/guide"       element={<Pages.Guide />} />
                    <Route path="/mode-selection" element={<Pages.ModeSelection />} />
                    <Route path="/notifications" element={<Pages.Notifications />} />
                    <Route path="*"            element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </main>
              <Suspense fallback={null}><OracleArchitect /></Suspense>
              <SoloRainOverlay
                active={showLevelUpFx}
                hudText={levelUpHud}
                tone="levelup"
                className="solo-levelup-fx"
              />
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
