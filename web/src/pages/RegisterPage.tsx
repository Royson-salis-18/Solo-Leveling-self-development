import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { Brain, Shield, Zap, Sword, Heart, Star, Target, Eye, Cpu, Crown } from "lucide-react";

const CLASSES: { name: string; icon: React.ReactNode; desc: string }[] = [
  { name: "Assassin",       icon: <Sword  size={14} />, desc: "Shadow strikes" },
  { name: "Warrior",        icon: <Shield size={14} />, desc: "Iron fortitude"  },
  { name: "Mage",           icon: <Zap    size={14} />, desc: "Arcane mastery"  },
  { name: "Healer",         icon: <Heart  size={14} />, desc: "Vital support"   },
  { name: "Tank",           icon: <Shield size={14} />, desc: "Unbreakable"     },
  { name: "Ranger",         icon: <Target size={14} />, desc: "Long-range"      },
  { name: "Tamer",          icon: <Star   size={14} />, desc: "Beast command"   },
  { name: "Necromancer",    icon: <Eye    size={14} />, desc: "Death arts"      },
  { name: "Engineer",       icon: <Cpu    size={14} />, desc: "Techcraft"       },
  { name: "Shadow Monarch", icon: <Crown  size={14} />, desc: "Apex dominance"  },
];

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim())                { setError("Hunter alias is required.");                  return; }
    if (!email)                      { setError("System email is required.");                  return; }
    if (password.length < 6)         { setError("Access key must be at least 6 characters.");  return; }
    if (password !== confirmPassword) { setError("Access keys do not match.");                  return; }
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
      <div className="reg-card">
        {/* Top shimmer line */}
        <div className="reg-shimmer" />

        {/* Header */}
        <div className="reg-header">
          <div className="reg-logo-icon">
            <Brain size={24} strokeWidth={1.4} />
          </div>
          <h1 className="reg-title">INITIALIZE HUNTER</h1>
          <p className="reg-subtitle">Configure your protocol before entering the gate</p>
        </div>

        <form onSubmit={handleRegister} className="reg-form">

          {/* Hunter Alias */}
          <div className="reg-field">
            <label className="reg-label" htmlFor="reg-name">Hunter Alias</label>
            <input
              id="reg-name"
              type="text"
              className="reg-input"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your alias"
              disabled={isLoading}
              autoComplete="name"
            />
          </div>

          {/* System Email */}
          <div className="reg-field">
            <label className="reg-label" htmlFor="reg-email">System Email</label>
            <input
              id="reg-email"
              type="email"
              className="reg-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="hunter@protocol.dev"
              disabled={isLoading}
              autoComplete="email"
            />
          </div>

          {/* Passwords — side by side */}
          <div className="reg-row">
            <div className="reg-field">
              <label className="reg-label" htmlFor="reg-password">Access Key</label>
              <input
                id="reg-password"
                type="password"
                className="reg-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 6 chars"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
            <div className="reg-field">
              <label className="reg-label" htmlFor="reg-confirm">Verify Key</label>
              <input
                id="reg-confirm"
                type="password"
                className="reg-input"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat key"
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Class Selector */}
          <div className="reg-field">
            <label className="reg-label">Hunter Class</label>
            <div className="reg-class-grid">
              {CLASSES.map(cls => (
                <button
                  key={cls.name}
                  type="button"
                  className={`reg-class-chip${selectedClass === cls.name ? " reg-class-chip--active" : ""}`}
                  onClick={() => setSelectedClass(cls.name)}
                  disabled={isLoading}
                  title={cls.desc}
                >
                  <span className="reg-class-icon">{cls.icon}</span>
                  <span className="reg-class-name">{cls.name}</span>
                </button>
              ))}
            </div>
            <p className="reg-class-hint">
              Selected: <strong>{selectedClass}</strong> — {CLASSES.find(c => c.name === selectedClass)?.desc}
            </p>
          </div>

          {/* Error */}
          {error && <div className="auth-error-msg">{error}</div>}

          {/* Submit */}
          <button
            id="reg-submit"
            type="submit"
            className="auth-btn"
            disabled={isLoading}
          >
            {isLoading ? "Synchronizing…" : "Initialize Hunter Protocol"}
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
