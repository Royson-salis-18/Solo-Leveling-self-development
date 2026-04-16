import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/authContext";
import { ProtectedRoute } from "./lib/ProtectedRoute";
import { Sidebar } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { QuestsPage } from "./pages/QuestsPage";
import { RewardsPage } from "./pages/RewardsPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import "./app.css";

function AppContent() {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected Routes */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <div className="layout">
              <Sidebar />
              <main className="content">
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/quests" element={<QuestsPage />} />
                  <Route path="/rewards" element={<RewardsPage />} />
                  <Route path="/leaderboard" element={<LeaderboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
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
      <AppContent />
    </AuthProvider>
  );
}
