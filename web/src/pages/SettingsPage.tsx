import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { SystemAPI } from "../services/SystemAPI";
import { supabase } from "../lib/supabase";
import { PlanCards } from "../components/PlanCards";
import type { Entitlements } from "../lib/gameTypes";

async function callFn<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase!.functions.invoke<T>(name, { body });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? (await ctx.json().catch(() => null))?.error : null;
    throw new Error(msg ?? error.message);
  }
  return data as T;
}

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const toast = useToast(); const confirm = useConfirm(); const nav = useNavigate();
  const [params] = useSearchParams();
  const [ent, setEnt] = useState<Entitlements | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { SystemAPI.entitlements().then(setEnt).catch(() => undefined); }, []);
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
      <div className="page-header"><h2 className="page-title">Settings</h2></div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>Account</h3><p className="text-muted text-sm">{user?.email}</p>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>Plan: {ent?.plan.name ?? "…"}</h3>
        {ent && <p className="text-muted text-sm">
          {ent.usage.active_gates} active gates{ent.limits.max_active_gates ? ` of ${ent.limits.max_active_gates}` : ""} · {ent.usage.ai_messages_today} of {ent.limits.ai_messages_per_day ?? "∞"} Oracle messages today
          {ent.cancel_at_period_end && ent.current_period_end ? ` · ends ${new Date(ent.current_period_end).toLocaleDateString()}` : ""}
        </p>}
        {isPro ? <button className="btn btn-secondary" disabled={busy} onClick={portal}>Manage billing</button> : <PlanCards current={ent?.plan.id} onChoose={() => void upgrade()} />}
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h3>Your data</h3>
        <p className="text-muted text-sm">Download everything we store about you.</p>
        <button className="btn btn-secondary" disabled={busy} onClick={exportData}>Export my data</button>
      </div>
      <div className="panel" style={{ borderColor: "rgba(239,68,68,.4)" }}>
        <h3>Danger zone</h3>
        <button className="btn btn-danger" disabled={busy} onClick={del}>Delete my account</button>
      </div>
    </section>
  );
}
