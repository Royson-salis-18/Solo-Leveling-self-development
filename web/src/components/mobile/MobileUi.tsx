import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, Repeat, X } from "lucide-react";
import { SystemAPI } from "../../services/SystemAPI";
import { useToast } from "../../lib/toast";
import { haptic } from "../../lib/feedback";
import { requestEngagementRefresh } from "../../lib/engagement";
import { TIER_INFO, addDays, clampTier, isoDay, repeatPayload, tierStates } from "../../lib/gateRules";
import type { RepeatKind, TierId } from "../../lib/gateRules";
import "./sheets.css";

export type EditableGate = { id: string; title: string; xp_tier?: string; category?: string; deadline?: string | null; is_recurring?: boolean; recurrence_type?: string; description?: string | null; priority?: string | null; start_time?: string | null; end_time?: string | null };

export type AddPreset = { category?: string };
type Ui = { openAdd: (gate?: EditableGate, preset?: AddPreset) => void };
const Ctx = createContext<Ui>({ openAdd: () => undefined });
export const useMobileUi = () => useContext(Ctx);

const CATEGORIES = ["General", "Work", "Fitness", "Health", "Learning", "Finance", "Creative", "Side Projects", "Social", "Family", "Mindfulness", "Errands", "Academics", "Wellness", "Spirituality", "Personal Development"];
type When = "none" | "today" | "tomorrow" | "plus3" | "pick";

function AddGateSheet({ gate, preset, onClose }: { gate: EditableGate | null; preset?: AddPreset; onClose: () => void }) {
  const toast = useToast();
  const editing = !!gate;
  const [title, setTitle] = useState(gate?.title ?? "");
  const [category, setCategory] = useState(gate?.category ?? preset?.category ?? "General");
  const now = useMemo(() => new Date(), []);
  const initialWhen: When = !gate ? "today" : gate.deadline ? "pick" : "none";
  const [when, setWhen] = useState<When>(initialWhen);
  const [picked, setPicked] = useState(gate?.deadline ?? isoDay(now));
  const [tier, setTier] = useState<TierId>((gate?.xp_tier as TierId) ?? "Mid");
  const [repeat, setRepeat] = useState<RepeatKind>(gate?.is_recurring ? (gate.recurrence_type === "weekly" ? "weekly" : "daily") : "none");
  const [busy, setBusy] = useState(false);

  const deadline = when === "none" ? null : when === "today" ? isoDay(now) : when === "tomorrow" ? isoDay(addDays(now, 1)) : when === "plus3" ? isoDay(addDays(now, 3)) : picked;
  const states = tierStates(deadline, now);
  const effective = clampTier(tier, deadline, now);
  const info = TIER_INFO.find((t) => t.id === effective)!;
  const blocked = states.find((s) => !s.ok && TIER_INFO.findIndex((t) => t.id === s.id) > 0);
  const canRepeat = deadline !== null;

  useEffect(() => { if (!canRepeat && repeat !== "none") setRepeat("none"); }, [canRepeat, repeat]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [onClose]);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await SystemAPI.saveGate({
        title: t, category, priority: gate?.priority ?? "Normal", xp_tier: effective, deadline,
        // an edit must not wipe what was set on the web (notes, times)
        ...(gate ? { description: gate.description ?? "", start_time: gate.start_time ?? null, end_time: gate.end_time ?? null } : {}),
        ...repeatPayload(repeat, deadline),
      } as never, gate?.id ?? null);
      haptic("success");
      toast.success(editing ? "Gate updated" : "Gate opened", `${t} · ${info.rank}-rank · +${info.xp} XP`);
      requestEngagementRefresh();
      onClose();
    } catch (err) { haptic("warn"); toast.fail(err, "Couldn't save the gate"); } finally { setBusy(false); }
  };

  const whenChips: Array<[When, string]> = [["today", "Today"], ["tomorrow", "Tomorrow"], ["plus3", "In 3 days"], ["pick", "Pick date"], ["none", "No deadline"]];
  return (
    <div className="sh-bg" onClick={onClose}>
      <form className="sh" role="dialog" aria-modal="true" aria-label={editing ? "Edit gate" : "New gate"} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="sh-grab" />
        <header className="sh-head"><h2>{editing ? "Edit gate" : "New gate"}</h2><button type="button" className="m-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></header>

        <input className="sh-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs conquering?" maxLength={200} autoFocus aria-label="Gate title" enterKeyHint="done" />

        <div className="sh-label"><CalendarDays size={13} /> When</div>
        <div className="sh-chips" role="radiogroup" aria-label="Deadline">
          {whenChips.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={when === k} className={when === k ? "on" : ""} onClick={() => { setWhen(k); haptic("tap"); }}>{l}</button>)}
        </div>
        {when === "pick" && <input className="sh-date" type="date" min={isoDay(now)} value={picked} onChange={(e) => setPicked(e.target.value || isoDay(now))} aria-label="Deadline date" />}

        <div className="sh-label">Rank <em>{info.rank}-rank · +{info.xp} XP</em></div>
        <div className="sh-ranks" role="radiogroup" aria-label="Rank">
          {states.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={effective === s.id} disabled={!s.ok} className={effective === s.id ? "on" : ""} onClick={() => { setTier(s.id); haptic("tap"); }} title={s.reason}>
              <b>{s.rank}</b><span>{s.xp}</span>
            </button>
          ))}
        </div>
        {blocked && <p className="sh-hint">{blocked.reason}.</p>}

        <div className="sh-label">Category</div>
        <div className="sh-chips scroll" role="radiogroup" aria-label="Category">
          {[category, ...CATEGORIES.filter((c) => c !== category)].map((c) => <button key={c} type="button" role="radio" aria-checked={category === c} className={category === c ? "on" : ""} onClick={() => setCategory(c)}>{c}</button>)}
        </div>

        <div className="sh-label"><Repeat size={13} /> Repeat</div>
        <div className="sh-seg" role="radiogroup" aria-label="Repeat">
          {(["none", "daily", "weekly"] as RepeatKind[]).map((r) => <button key={r} type="button" role="radio" aria-checked={repeat === r} disabled={r !== "none" && !canRepeat} className={repeat === r ? "on" : ""} onClick={() => setRepeat(r)}>{r === "none" ? "Off" : r === "daily" ? "Daily" : "Weekly"}</button>)}
        </div>
        {!canRepeat && <p className="sh-hint">Repeating gates need a deadline.</p>}

        <button className="sh-go" type="submit" disabled={!title.trim() || busy}>{busy ? "Saving…" : editing ? "Save changes" : `Open gate · +${info.xp} XP`}</button>
      </form>
    </div>
  );
}

export function MobileUiProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<{ gate: EditableGate | null; preset?: AddPreset } | null>(null);
  const openAdd = useCallback((gate?: EditableGate, preset?: AddPreset) => { haptic("tap"); setSheet({ gate: gate ?? null, preset }); }, []);
  const value = useMemo(() => ({ openAdd }), [openAdd]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {sheet && <AddGateSheet key={sheet.gate?.id ?? `new-${sheet.preset?.category ?? ""}`} gate={sheet.gate} preset={sheet.preset} onClose={() => setSheet(null)} />}
    </Ctx.Provider>
  );
}
