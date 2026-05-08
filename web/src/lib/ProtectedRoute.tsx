import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { Brain } from "lucide-react";
import { hasSupabaseConfig } from "./supabase";
import { SoloRainOverlay } from "../components/SoloRainOverlay";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [bootPhase, setBootPhase] = useState<"loading" | "fading" | "done">(
    isLoading ? "loading" : "done"
  );
  const settledRef = useRef(false);

  useEffect(() => {
    let fadeTimer: number | null = null;
    let doneTimer: number | null = null;
    if (!hasSupabaseConfig) {
      setBootPhase("done");
      settledRef.current = true;
      return;
    }

    // Once we've settled into authenticated app, never re-show boot overlay
    // for transient loading changes.
    if (settledRef.current) {
      if (bootPhase !== "done") setBootPhase("done");
      return;
    }

    if (!isLoading && isAuthenticated) {
      // Small hold then smooth fade to content.
      fadeTimer = window.setTimeout(() => {
        setBootPhase("fading");
        doneTimer = window.setTimeout(() => {
          setBootPhase("done");
          settledRef.current = true;
        }, 760);
      }, 220);
    } else if (isLoading && bootPhase !== "loading") {
      setBootPhase("loading");
    }
    return () => {
      if (fadeTimer) window.clearTimeout(fadeTimer);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
  }, [isLoading, isAuthenticated, bootPhase]);

  const bootOverlay = (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#0c0c0e",
      position: "relative",
      overflow: "hidden",
      opacity: bootPhase === "fading" ? 0 : 1,
      transition: "opacity 760ms cubic-bezier(0.22, 1, 0.36, 1)",
    }}>
      <SoloRainOverlay active={bootPhase === "loading"} hudText="SYSTEM LINK [CONNECTING]" tone="entry" />
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

  // Loading state — acrylic spinner
  if (isLoading && hasSupabaseConfig && !settledRef.current) {
    return bootOverlay;
  }

  // No Supabase config → preview mode, always render
  if (!hasSupabaseConfig) {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (bootPhase !== "done") {
    return (
      <div style={{ position: "relative", minHeight: "100vh" }}>
        {children}
        <div style={{ position: "fixed", inset: 0, zIndex: 3000, pointerEvents: "none" }}>
          {bootOverlay}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
