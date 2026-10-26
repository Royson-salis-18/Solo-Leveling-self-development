import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, Clock, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { useGameActions } from "../lib/gameActions";
import { SystemAPI } from "../services/SystemAPI";
import { ENGAGEMENT_REFRESH_EVENT, requestEngagementRefresh } from "../lib/engagement";
import { RANK_OF, addDays, isoDay } from "../lib/gateRules";
import { haptic } from "../lib/feedback";
import { useArmed } from "../lib/useArmed";
import { useMobileUi } from "../components/mobile/MobileUi";
import { DOMAINS, domainOfCategory } from "../lib/domains";
import type { EditableGate } from "../components/mobile/MobileUi";
import "../components/mobile/mobile.css";
import "../components/mobile/sheets.css";
import "./mobile-gates.css";

type Gate = EditableGate & {
  points: number; is_completed: boolean; is_failed?: boolean; is_pending?: boolean; completed_at?: string | null;
  parent_id?: string | null; created_at: string; xp_awarded?: number; recurrence_interval?: number | null; recurrence_days?: unknown;
};
type Seg = "active" | "pending" | "done";

const rankColor: Record<string, string> = { E: "#34d399", C: "#8b9cff", B: "#a894ff", A: "#f0abfc", S: "#fbbf24" };

function dueLabel(g: Gate, today: Date): { text: string; tone: "late" | "soon" | "calm" } {
  if (!g.deadline) return { text: "No deadline", tone: "calm" };
  const t0 = isoDay(today), t1 = isoDay(addDays(today, 1));
  if (g.deadline < t0) return { text: "Overdue", tone: "late" };
  if (g.deadline === t0) return { text: "Today", tone: "soon" };
  if (g.deadline === t1) return { text: "Tomorrow", tone: "calm" };
  return { text: new Date(`${g.deadline}T12:00:00`).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" }), tone: "calm" };
}

export function MobileGates() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const actions = useGameActions();
  const { openAdd } = useMobileUi();

  const [rows, setRows] = useState<Gate[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [seg, setSeg] = useState<Seg>("active");
  const [open, setOpen] = useState<Gate | null>(null);
  const [dom, setDom] = useState<string>("All");
  const [busy, setBusy] = useState(false);
  const today = useMemo(() => new Date(), []);

  const load = useCallback(async () => {
    if (!user) return;
    try { setRows((await SystemAPI.fetchGates(user.id)) as Gate[]); setFailed(false); } catch { setFailed(true); }
  }, [user]);
  useEffect(() => {
    void load();
    window.addEventListener(ENGAGEMENT_REFRESH_EVENT, load);
    return () => window.removeEventListener(ENGAGEMENT_REFRESH_EVENT, load);
  }, [load]);

  const { armed, running, arm, undo } = useArmed(async (id) => { await actions.complete(id); await load(); });

  const kids = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    (rows ?? []).forEach((r) => { if (r.parent_id) { const c = m.get(r.parent_id) ?? { done: 0, total: 0 }; c.total++; if (r.is_completed) c.done++; m.set(r.parent_id, c); } });
    return m;
  }, [rows]);

  const lists = useMemo(() => {
    const top = (rows ?? []).filter((r) => !r.parent_id && (dom === "All" || domainOfCategory(r.category) === dom));
    const active = top.filter((r) => !r.is_completed && !r.is_failed && !r.is_pending)
      .sort((a, b) => (a.deadline ?? "9999") < (b.deadline ?? "9999") ? -1 : 1);
    const pending = top.filter((r) => r.is_pending && !r.is_completed && !r.is_failed);
    const done = top.filter((r) => r.is_completed).sort((a, b) => ((a.completed_at ?? "") < (b.completed_at ?? "") ? 1 : -1)).slice(0, 40);
    return { active, pending, done };
  }, [rows, dom]);

  const shown = lists[seg];
  const groups = useMemo(() => {
    if (seg !== "active") return [{ title: "", items: shown }];
    const t0 = isoDay(today), t1 = isoDay(addDays(today, 1));
    const g: Record<string, Gate[]> = { Today: [], Tomorrow: [], Later: [], "No deadline": [] };
    shown.forEach((r) => { (!r.deadline ? g["No deadline"] : r.deadline <= t0 ? g.Today : r.deadline === t1 ? g.Tomorrow : g.Later).push(r); });
    return Object.entries(g).filter(([, v]) => v.length).map(([title, items]) => ({ title, items }));
  }, [seg, shown, today]);

  const payloadOf = (g: Gate, deadline: string | null) => ({
    title: g.title, category: g.category ?? "General", priority: g.priority ?? "Normal", xp_tier: g.xp_tier ?? "Low", deadline,
    description: g.description ?? "", start_time: g.start_time ?? null, end_time: g.end_time ?? null,
    is_recurring: !!g.is_recurring, recurrence_type: g.recurrence_type ?? "none", recurrence_interval: g.recurrence_interval ?? 1, recurrence_days: g.recurrence_days ?? [],
  });

  const postpone = async (g: Gate) => {
    const ok = await confirm({ title: "Postpone by a day?", message: "Postponing costs 5 XP and adds 5 Dark Mana. It isn't allowed in Hard or Hell mode.", confirmLabel: "Postpone" });
    if (!ok) return;
    setBusy(true);
    try { await SystemAPI.saveGate(payloadOf(g, isoDay(addDays(new Date(), 1))) as never, g.id); haptic("warn"); toast.success("Postponed", "New deadline: tomorrow."); setOpen(null); requestEngagementRefresh(); void load(); }
    catch (e) { toast.fail(e, "Couldn't postpone"); } finally { setBusy(false); }
  };
  const abandon = async (g: Gate) => {
    const ok = await confirm({ title: "Abandon this gate?", message: "You'll lose XP and gain Dark Mana based on your difficulty mode. This can't be undone.", confirmLabel: "Abandon", danger: true });
    if (!ok) return;
    setBusy(true);
    try { await actions.fail(g.id); setOpen(null); void load(); requestEngagementRefresh(); } finally { setBusy(false); }
  };
  const remove = async (g: Gate) => {
    const ok = await confirm({ title: "Delete this gate?", message: "It disappears with no XP change.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    setBusy(true);
    try { await SystemAPI.deleteGate(g.id); toast.success("Deleted"); setOpen(null); void load(); } catch (e) { toast.fail(e, "Couldn't delete"); } finally { setBusy(false); }
  };

  const counts = { active: lists.active.length, pending: lists.pending.length, done: lists.done.length };
  const empty = rows && shown.length === 0;

  return (
    <div className="mg">
      <header className="mg-head">
        <h1>Gates</h1>
      </header>

      <div className="mg-seg" role="tablist" aria-label="Gate status">
        {(["active", "pending", "done"] as Seg[]).map((s) => (
          <button key={s} role="tab" aria-selected={seg === s} className={seg === s ? "on" : ""} onClick={() => { setSeg(s); haptic("tap"); }}>
            {s === "active" ? "Active" : s === "pending" ? "Overdue" : "Done"}<i className={s === "pending" && counts.pending ? "warn" : ""}>{counts[s]}</i>
          </button>
        ))}
      </div>

      <div className="mg-pills" role="radiogroup" aria-label="Filter by domain">
        {["All", ...DOMAINS.map((d) => d.name)].map((n) => <button key={n} role="radio" aria-checked={dom === n} className={dom === n ? "on" : ""} onClick={() => { setDom(n); haptic("tap"); }}>{n}</button>)}
      </div>

      {failed && !rows && <div className="ux-retry"><span>Couldn’t load your gates.</span><button onClick={() => void load()}>Retry</button></div>}
      {!rows && !failed && [0, 1, 2, 3].map((i) => <div key={i} className="mg-row mg-skel" />)}

      {empty && (
        <div className="mg-empty">
          <div className="mg-empty-ico"><Check size={26} /></div>
          <h3>{seg === "active" ? "Nothing open" : seg === "pending" ? "Nothing overdue" : "No conquests yet"}</h3>
          <p>{seg === "active" ? "Open a gate and give it a rank." : seg === "pending" ? "You're on top of everything." : "Conquered gates show up here."}</p>
          {seg === "active" && <button className="mg-add" onClick={() => openAdd()}><Plus size={18} /> New gate</button>}
        </div>
      )}

      {seg === "pending" && lists.pending.length > 0 && <p className="mg-note">These passed their deadline. Conquer, postpone or abandon each one.</p>}

      {groups.map((grp) => (
        <section key={grp.title || "all"} className="mg-group">
          {grp.title && <h2>{grp.title}<em>{grp.items.length}</em></h2>}
          <div className="mg-list">
          {grp.items.map((g) => {
            const rank = RANK_OF[g.xp_tier ?? "Low"] ?? "E";
            const due = dueLabel(g, today);
            const sub = kids.get(g.id);
            const isArmed = armed === g.id;
            return (
              <div key={g.id} id={`gate-${g.id}`} className={`mg-row${isArmed ? " is-armed" : ""}${g.is_completed ? " is-done" : ""}`}>
                {seg !== "done" ? (
                  <button className="mg-tick" disabled={running === g.id || (!!armed && !isArmed)} onClick={() => (isArmed ? undo() : arm(g.id))} aria-label={isArmed ? `Undo conquering ${g.title}` : `Conquer ${g.title}`}>
                    {running === g.id ? <i className="mh-spin" /> : isArmed ? <Undo2 size={15} /> : <Check size={15} strokeWidth={3} />}
                  </button>
                ) : <span className="mg-tick done"><Check size={15} strokeWidth={3} /></span>}
                <button className="mg-main" onClick={() => setOpen(g)} aria-label={`Open ${g.title}`}>
                  <span className="mg-title">{g.title}</span>
                  <span className="mg-sub">
                    <b style={{ color: rankColor[rank] }}>{rank}</b>
                    <span className="dom" style={{ ["--dc" as string]: DOMAINS.find((d) => d.name === domainOfCategory(g.category))?.color }}>{g.category ?? "General"}</span>
                    {seg !== "done" && <span className={`due ${due.tone}`}><Clock size={11} /> {due.text}</span>}
                    {sub && <span>{sub.done}/{sub.total} stages</span>}
                    {g.is_recurring && <span>↻</span>}
                  </span>
                </button>
                {isArmed ? <><button className="mh-undo" onClick={undo}>Undo</button><i className="mh-countdown" aria-hidden="true" /></>
                  : <span className="mg-xp">{seg === "done" ? `+${g.xp_awarded ?? g.points}` : `+${g.points}`}<small>XP</small></span>}
                {!isArmed && <ChevronRight size={16} className="mg-chev" />}
              </div>
            );
          })}
          </div>
        </section>
      ))}

      {open && createPortal(
        <div className="sh-bg" onClick={() => setOpen(null)}>
          <div className="sh" role="dialog" aria-modal="true" aria-label={open.title} onClick={(e) => e.stopPropagation()}>
            <div className="sh-grab" />
            <header className="sh-head"><h2 style={{ fontSize: "1.15rem", paddingRight: 8 }}>{open.title}</h2><button className="m-icon-btn" onClick={() => setOpen(null)} aria-label="Close"><X size={20} /></button></header>
            <div className="sh-meta">
              <span>{RANK_OF[open.xp_tier ?? "Low"]}-rank · +{open.points} XP</span>
              <span>{open.category ?? "General"}</span>
              <span>{open.deadline ? `Due ${dueLabel(open, today).text}` : "No deadline"}</span>
              {open.is_recurring && <span>Repeats {open.recurrence_type}</span>}
            </div>
            {open.description && <p className="mg-desc">{open.description}</p>}
            <div className="sh-actions">
              {!open.is_completed && <button className="sh-act hot" disabled={busy} onClick={() => { setOpen(null); arm(open.id); }}><Check size={18} /> Conquer</button>}
              {!open.is_completed && <button className="sh-act" disabled={busy} onClick={() => { const g = open; setOpen(null); window.setTimeout(() => openAdd(g), 60); }}><Pencil size={18} /> Edit</button>}
              {!open.is_completed && open.deadline && <button className="sh-act" disabled={busy} onClick={() => postpone(open)}><Clock size={18} /> Postpone a day</button>}
              {!open.is_completed && <button className="sh-act danger" disabled={busy} onClick={() => abandon(open)}><X size={18} /> Abandon</button>}
              <button className="sh-act danger" disabled={busy} onClick={() => remove(open)}><Trash2 size={18} /> Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
