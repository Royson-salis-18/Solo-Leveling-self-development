import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { Brain } from "lucide-react";
import { hasSupabaseConfig } from "./supabase";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If Supabase is not configured, allow pass-through (preview mode)
    if (!hasSupabaseConfig) return;
    if (!isLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Loading state — acrylic spinner
  if (isLoading && hasSupabaseConfig) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0c0c0e",
      }}>
        <div style={{ textAlign: "center" }}>
          {/* Animated brain icon */}
          <div style={{
            width: 52, height: 52,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 18px",
            animation: "pulse 1.8s ease-in-out infinite",
          }}>
            <Brain size={22} color="rgba(255,255,255,0.55)" />
          </div>
          <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.06em" }}>
            Connecting…
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.10); }
              50%       { box-shadow: 0 0 0 12px rgba(255,255,255,0.00); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // No Supabase config → preview mode, always render
  if (!hasSupabaseConfig) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
