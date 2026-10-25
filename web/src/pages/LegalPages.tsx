import { Link } from "react-router-dom";
import { BRAND } from "../lib/brand";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lp"><header className="lp-nav"><Link to="/welcome"><strong>{BRAND.name}</strong></Link></header>
      <article className="lp-legal"><h1>{title}</h1>
        <p><em>Template text — have a lawyer review and complete it before launch. Last updated {new Date().toISOString().slice(0, 10)}.</em></p>
        {children}</article></div>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of Service">
      <h2>1. The service</h2><p>{BRAND.company} ("we") provides {BRAND.name}, a gamified productivity app. By creating an account you agree to these terms.</p>
      <h2>2. Accounts</h2><p>You are responsible for your credentials and for activity under your account. You must be old enough to form a binding contract where you live.</p>
      <h2>3. Acceptable use</h2><p>No cheating the game engine, scraping, harassment, or attempts to access other users' data.</p>
      <h2>4. Subscriptions</h2><p>Paid plans renew until cancelled. You can cancel any time in Settings; access continues to the end of the paid period. Refunds follow applicable law.</p>
      <h2>5. Virtual items</h2><p>XP, shadows and rewards have no cash value and may be rebalanced.</p>
      <h2>6. Termination</h2><p>You can delete your account in Settings. We may suspend accounts that breach these terms.</p>
      <h2>7. Liability</h2><p>The service is provided "as is". The in-app rewards and punishments are self-chosen; do not undertake anything unsafe. Contact: {BRAND.supportEmail}.</p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy Policy">
      <h2>What we collect</h2><p>Account email, the name and profile details you enter, and the tasks, rewards, messages and activity you create in the app.</p>
      <h2>How we use it</h2><p>To run the service, show leaderboards to other signed-in users (name, rank, level, XP — never your email), send in-app notifications, and process payments via our payment provider.</p>
      <h2>AI features</h2><p>Oracle questions and a summary of your game stats are sent to our AI provider to produce a reply.</p>
      <h2>Your rights</h2><p>Export all your data and permanently delete your account from Settings at any time.</p>
      <h2>Contact</h2><p>{BRAND.supportEmail}</p>
    </Shell>
  );
}
