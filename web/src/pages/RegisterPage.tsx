import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { Brain } from "lucide-react";

export function RegisterPage() {
  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedClass,   setSelectedClass]   = useState("Warrior");
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState("");

  const { signUp, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate("/");
  }, [isAuthenticated, navigate]);

  const CLASSES = ["Assassin", "Warrior", "Mage", "Tamer", "Healer", "Tank", "Ranger", "Necromancer", "Engineer", "Shadow Monarch"];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim())               { setError("Name is required."); return; }
    if (!email)                     { setError("Email is required."); return; }
    if (password.length < 6)        { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword){ setError("Passwords do not match."); return; }
    setIsLoading(true);
    try {
      await signUp(email, password, name.trim(), selectedClass);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card auth-card--tall" style={{ maxWidth: 440 }}>
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon"><Brain size={22} strokeWidth={1.4} /></div>
          <h1 className="auth-title">CHOOSE YOUR PATH</h1>
          <p className="auth-subtitle">Initialize your hunter protocol</p>
        </div>

        <form onSubmit={handleRegister} className="auth-form">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="auth-field">
              <label className="auth-label">Hunter Alias</label>
              <input
                id="reg-name"
                type="text"
                className="auth-input"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Alias"
                disabled={isLoading}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Hunter Class</label>
              <select 
                className="auth-input" 
                value={selectedClass} 
                onChange={e => setSelectedClass(e.target.value)}
                disabled={isLoading}
              >
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="auth-field">
            <label className="auth-label">System Email</label>
            <input
              id="reg-email"
              type="email"
              className="auth-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@protocol.com"
              disabled={isLoading}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="auth-field">
              <label className="auth-label">Access Key</label>
              <input
                id="reg-password"
                type="password"
                className="auth-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                disabled={isLoading}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Verify Key</label>
              <input
                id="reg-confirm"
                type="password"
                className="auth-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••"
                disabled={isLoading}
              />
            </div>
          </div>

          {error && <div className="auth-error-msg">{error}</div>}

          <button
            id="reg-submit"
            type="submit"
            className="auth-btn"
            disabled={isLoading}
          >
            {isLoading ? "Synchronizing…" : "Initialize System"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account?{" "}
          <button className="auth-link" onClick={() => navigate("/login")}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
