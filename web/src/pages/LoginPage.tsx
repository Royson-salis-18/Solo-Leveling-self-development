import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/authContext";

export function LoginPage() {
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState("");
  const { signIn } = useAuth();
  const navigate   = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        {/* Brand mark */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.14)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
          }}>
            <Brain size={20} color="rgba(255,255,255,0.70)" />
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "rgba(255,255,255,0.90)", marginBottom: 4 }}>
            Second Brain
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.36)", letterSpacing: "0.04em" }}>
            Sign in to continue
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPass ? "text" : "password"}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{ width: "100%", paddingRight: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 0 }}
              >
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ padding: "9px 12px", background: "rgba(255,70,70,0.08)", border: "1px solid rgba(255,70,70,0.20)", borderRadius: 8, fontSize: "0.76rem", color: "rgba(255,120,120,0.90)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: "100%", padding: "10px", marginTop: 4, justifyContent: "center" }}
          >
            {isLoading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.36)" }}>No account? </span>
          <button
            onClick={() => navigate("/register")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.74rem", color: "rgba(255,255,255,0.65)", textDecoration: "underline", fontFamily: "inherit" }}
          >
            Create one
          </button>
        </div>
      </div>
    </div>
  );
}
