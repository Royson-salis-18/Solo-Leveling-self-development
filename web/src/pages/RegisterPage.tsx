import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../lib/authContext";

export function RegisterPage() {
  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass,        setShowPass]        = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState("");
  const { signUp } = useAuth();
  const navigate   = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!name.trim())                 { setError("Name is required"); return; }
    setIsLoading(true);
    try {
      await signUp(email, password, name);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setIsLoading(false);
    }
  };

  const inputRow = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options?: { type?: string; placeholder?: string; toggleShowPass?: boolean }
  ) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      <div style={{ position: "relative" }}>
        <input
          type={options?.toggleShowPass ? (showPass ? "text" : "password") : (options?.type ?? "text")}
          className="form-input"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={options?.placeholder ?? ""}
          style={{ width: "100%", paddingRight: options?.toggleShowPass ? 38 : undefined }}
          required
        />
        {options?.toggleShowPass && (
          <button
            type="button"
            onClick={() => setShowPass(p => !p)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", padding: 0 }}
          >
            {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card">
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
            Create Account
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.36)", letterSpacing: "0.04em" }}>
            Start building your second brain
          </div>
        </div>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {inputRow("Display Name", name, setName, { placeholder: "Your name" })}
          {inputRow("Email",        email, setEmail, { type: "email", placeholder: "you@example.com" })}
          {inputRow("Password",     password, setPassword, { toggleShowPass: true, placeholder: "Min. 8 characters" })}
          {inputRow("Confirm Password", confirmPassword, setConfirmPassword, { type: "password", placeholder: "Repeat password" })}

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
            {isLoading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 22, paddingTop: 18, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: "0.74rem", color: "rgba(255,255,255,0.36)" }}>Already have an account? </span>
          <button
            onClick={() => navigate("/login")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.74rem", color: "rgba(255,255,255,0.65)", textDecoration: "underline", fontFamily: "inherit" }}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
