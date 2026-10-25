import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

/** Last-resort net so a render crash shows a recovery screen instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("UI crash:", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <h1 className="auth-title">SYSTEM FAULT</h1>
          <p className="auth-subtitle">Something broke on our side. Your progress is safe.</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { this.setState({ error: null }); window.location.assign("/"); }}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
