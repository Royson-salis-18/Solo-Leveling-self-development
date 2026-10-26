import { Suspense, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/authContext";
import { ToastProvider }     from "./lib/toast";
import { ConfirmProvider }   from "./lib/confirm";
import { NotificationProvider } from "./lib/notificationContext";
import { ProtectedRoute }    from "./lib/ProtectedRoute";
import { Sidebar }           from "./components/Sidebar";
import { PageSkeleton }      from "./components/PageSkeleton";
import { ErrorBoundary }     from "./components/ErrorBoundary";
import { SoloRainOverlay } from "./components/SoloRainOverlay";
import { OracleArchitect, Pages, prefetchCommonRoutes } from "./routes";
import { captureReferral } from "./lib/referral";
import { useIsMobile } from "./lib/useMedia";
import { MobileShell } from "./components/mobile/MobileShell";

/** New hunters must choose a difficulty before anything else (first pick is free). */
function ModeGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  if (profile && !profile.mode_selected_at && pathname !== "/mode-selection") {
    return <Navigate to="/mode-selection" replace />;
  }
  return <>{children}</>;
}

function AppContent() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const isMobile = useIsMobile();
  const [showLevelUpFx, setShowLevelUpFx] = useState(false);
  const [levelUpHud, setLevelUpHud] = useState("LEVEL UP // ARISE");

  useEffect(() => { prefetchCommonRoutes(); }, []);
  useEffect(() => { captureReferral(); }, []);

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

  const appRoutes = (
                  <Routes>
                    <Route path="/"            element={isMobile ? <Pages.MobileHome /> : <Pages.Dashboard />} />
                    <Route path="/overview"    element={<Pages.Dashboard />} />
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
                    <Route path="/achievements" element={<Pages.Achievements />} />
                    <Route path="/settings" element={<Pages.Settings />} />
                    <Route path="*"            element={<Navigate to="/" replace />} />
                  </Routes>
  );

  return (
    <Routes>
      {/* Auth */}
      <Route path="/welcome"  element={<Suspense fallback={<PageSkeleton />}><Pages.Landing /></Suspense>} />
      <Route path="/pricing"  element={<Suspense fallback={<PageSkeleton />}><Pages.Pricing /></Suspense>} />
      <Route path="/terms"    element={<Suspense fallback={<PageSkeleton />}><Pages.Terms /></Suspense>} />
      <Route path="/privacy"  element={<Suspense fallback={<PageSkeleton />}><Pages.Privacy /></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<PageSkeleton />}><Pages.Forgot /></Suspense>} />
      <Route path="/reset-password"  element={<Suspense fallback={<PageSkeleton />}><Pages.Reset /></Suspense>} />
      <Route path="/login"    element={<Suspense fallback={<PageSkeleton />}><Pages.Login /></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<PageSkeleton />}><Pages.Register /></Suspense>} />

      {/* Protected app shell */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            {isMobile ? (
              <>
                <MobileShell>
                  <Suspense fallback={<PageSkeleton />}>
                    <ModeGate>{appRoutes}</ModeGate>
                  </Suspense>
                </MobileShell>
                <Suspense fallback={null}><OracleArchitect /></Suspense>
                <SoloRainOverlay active={showLevelUpFx} hudText={levelUpHud} tone="levelup" className="solo-levelup-fx" />
              </>
            ) : (
            <div className={`layout ${isCollapsed ? 'sb-collapsed' : ''}`}>
              <div className="system-bg-overlay"></div>
              <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
              <main className="content">
                <Suspense fallback={<PageSkeleton />}>
                  <ModeGate>
                  {appRoutes}
                  </ModeGate>
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
            )}
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary><ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <NotificationProvider>
            <AppContent />
          </NotificationProvider>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider></ErrorBoundary>
  );
}
