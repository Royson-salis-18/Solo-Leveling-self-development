import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { errorMessage } from "../lib/rpc";

import "./auth-glass.css";

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(""); const [sent, setSent] = useState(false); const [err, setErr] = useState("");
  const go = async (e: FormEvent) => { e.preventDefault(); setErr(""); try { await resetPassword(email); setSent(true); } catch (x) { setErr(errorMessage(x)); } };
  return (
    <div className="auth-wrap"><div className="auth-card">
      <h1 className="auth-title">RESET ACCESS KEY</h1>
      {sent ? <p className="auth-subtitle">If that email has an account, a reset link is on its way.</p> : (
        <form onSubmit={go} className="auth-form">
          <div className="auth-field"><label className="auth-label">Email</label>
            <input className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></div>
          {err && <div className="auth-error">{err}</div>}
          <button className="btn btn-primary" type="submit">Send reset link</button>
        </form>)}
      <p style={{ marginTop: 16 }}><Link to="/login">Back to sign in</Link></p>
    </div></div>
  );
}

export function ResetPasswordPage() {
  const { updatePassword, isRecovering, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  const go = async (e: FormEvent) => { e.preventDefault(); setErr(""); try { await updatePassword(pw); nav("/"); } catch (x) { setErr(errorMessage(x)); } };
  if (!isRecovering && !isAuthenticated) return <div className="auth-wrap"><div className="auth-card"><p className="auth-subtitle">This reset link is invalid or expired.</p><Link to="/forgot-password">Request a new one</Link></div></div>;
  return (
    <div className="auth-wrap"><div className="auth-card"><h1 className="auth-title">NEW ACCESS KEY</h1>
      <form onSubmit={go} className="auth-form">
        <div className="auth-field"><label className="auth-label">New password</label>
          <input className="auth-input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={6} /></div>
        {err && <div className="auth-error">{err}</div>}
        <button className="btn btn-primary" type="submit">Update password</button>
      </form></div></div>
  );
}
