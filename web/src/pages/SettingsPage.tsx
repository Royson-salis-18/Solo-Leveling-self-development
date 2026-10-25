import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { SystemAPI } from "../services/SystemAPI";
import { supabase } from "../lib/supabase";
import { PlanCards } from "../components/PlanCards";
import type { Engagement, Entitlements } from "../lib/gameTypes";
import { referralLink } from "../lib/referral";
import "../components/engagement.css";

async function callFn<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.functions.invoke<T>(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

function P(props: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`dd-panel ds-glass${props.danger ? " aura-red" : ""}`} style={{ marginBottom: 24 }}>
      <h3 className="dd-h">{props.title}</h3>
      {props.children}
    </div>
  );
}

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const toast = useToast(); const confirm = useConfirm(); const nav = useNavigate();
  const [params] = useSearchParams();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<Engagement["referral"] | null>(null);

  useEffect(() => { SystemAPI.entitlements().then(setEnt).catch(() => undefined); }, []);
  useEffect(() => { SystemAPI.getEngagement().then((e) => setRef(e.referral)).catch(() => undefined); }, []);

  const copyInvite = async () => {
    if (!ref) return;
    try { await navigator.clipboard.writeText(referralLink(ref.code)); toast.success("Invite link copied", "Send it to a friend."); }
    catch { toast.info("Copy this link", referralLink(ref.code)); }
  };
  useEffect(() => { if (params.get("billing") === "success") toast.success("Welcome to Pro", "It can take a few seconds for your plan to update."); }, [params, toast]);

  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } catch (e) { toast.fail(e); } finally { setBusy(false); } };

  const upgrade = () => run(async () => { const r = await callFn<{ url: string }>("billing-checkout", { interval: "month" }); window.location.assign(r.url); });
  const portal = () => run(async () => { const r = await callFn<{ url: string }>("billing-portal"); window.location.assign(r.url); });
  const exportData = () => run(async () => {
    const data = await SystemAPI.exportMyData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "my-data.json"; a.click(); URL.revokeObjectURL(url);
  });
  const del = async () => {
    const ok = await confirm({ title: "Delete your account?", message: "This permanently deletes your profile, gates, XP, messages and cancels any subscription. It cannot be undone.", confirmLabel: "Delete forever", danger: true });
    if (!ok) return;
    await run(async () => { await callFn("delete-account"); await signOut().catch(() => undefined); nav("/welcome"); });
  };

  const isPro = ent?.plan.id !== "free" && !!ent;
  return (
    <section className="page">
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <div className="hf-eyebrow">SYSTEM_CONFIG_v5.0.4</div>
          <h2 className="page-title" style={{ fontSize: "2.2rem" }}>Settings</h2>
        </div>
      </div>
      <P title="Account"><div className="dd-mono" style={{ fontSize: ".85rem" }}>{user?.email}</div></P>
      {ref && (
        <P title="Recruit a hunter">
          <div className="dd-foot" style={{ textTransform: "none", letterSpacing: 0, fontSize: ".8rem", lineHeight: 1.6 }}>
            When a hunter you recruit conquers their first gate, you receive 2 Surge Crystals (double XP on a conquest) and they receive 1.
            {ref.recruited > 0 && <> {ref.active} of {ref.recruited} recruit{ref.recruited === 1 ? "" : "s"} active.</>}
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <code className="dd-mono" style={{ padding: "10px 14px", borderRadius: 12, background: "rgba(0,0,0,.4)", border: "1px solid rgba(255,255,255,.08)", fontSize: ".72rem", overflowWrap: "anywhere" }}>{referralLink(ref.code)}</code>
            <button className="dd-btn" onClick={copyInvite}>Copy link</button>
          </div>
        </P>
      )}
      <P title={`Access tier: ${ent?.plan.name ?? "…"}`}>
        {ent && <div className="dd-foot" style={{ textTransform: "none", letterSpacing: 0, fontSize: ".8rem" }}>
          {ent.usage.active_gates} active gates{ent.limits.max_active_gates ? ` of ${ent.limits.max_active_gates}` : ""} · {ent.usage.ai_messages_today} of {ent.limits.ai_messages_per_day ?? "∞"} Oracle messages today
          {ent.cancel_at_period_end && ent.current_period_end ? ` · ends ${new Date(ent.current_period_end).toLocaleDateString()}` : ""}
        </div>}
        {isPro ? <button className="dd-btn" disabled={busy} onClick={portal}>Manage billing</button> : <PlanCards current={ent?.plan.id} onChoose={() => void upgrade()} />}
      </P>
      <P title="Your data">
        <div className="dd-foot" style={{ textTransform: "none", letterSpacing: 0, fontSize: ".8rem" }}>Download everything the System stores about you.</div>
        <button className="dd-btn" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={exportData}>Export my data</button>
      </P>
      <P title="Danger zone" danger>
        <button className="dd-btn" style={{ alignSelf: "flex-start", color: "#ff6b6b", borderColor: "rgba(239,68,68,.4)" }} disabled={busy} onClick={del}>Delete my account</button>
      </P>
    </section>
  );
}
