import { useEffect, useState, useMemo } from "react";
import { Modal }          from "../components/Modal";
import { Button }         from "../components/Button";
import { QuestItem }      from "../components/QuestItem";
import type { DBTask }    from "../components/QuestItem";
import { NLPImportModal } from "../components/NLPImportModal";
import { Calendar }       from "../components/Calendar";
import { Plus, Download, CalendarDays, Users } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth }  from "../lib/authContext";
import { syncProgression, showProgressionToast, applyXpBoost } from "../lib/levelEngine";

const EMPTY_FORM = {
  title: "", category: "General", description: "",
  deadline: "", time: "", priority: "Normal", xp_tier: "Low", parentId: null as string | null,
  assignTo: "" as string,   // user_id to assign to (empty = self)
};

export function QuestsPage() {
  const { user } = useAuth();
  const [tasks,        setTasks]        = useState<DBTask[]>([]);
  const [assignedTasks,setAssignedTasks]= useState<DBTask[]>([]);  // tasks assigned TO me by a leader
  const [loading,      setLoading]      = useState(true);
  const [inventory,    setInventory]    = useState<any[]>([]);
  const [clanMembers,  setClanMembers]  = useState<{ user_id: string; name: string }[]>([]);
  const [isLeader,     setIsLeader]     = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [showNLP,      setShowNLP]      = useState(false);
  const [showCal,      setShowCal]      = useState(false);
  const [activeTab,    setActiveTab]    = useState<"active" | "pending" | "completed" | "assigned">("active");
  const [editQuest,    setEditQuest]    = useState<DBTask | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formData,     setFormData]     = useState(EMPTY_FORM);

  /* ─── fetch ─── */
  const fetchQuests = async () => {
    if (!supabase || !user?.id) return;
    setLoading(true);

    const [
      { data: qRes },
      { data: iRes },
      { data: aRes },           // tasks assigned TO me
      { data: membership },
    ] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("inventory").select("*").eq("user_id", user.id).eq("item_type", "TASK_SKIP").gt("quantity", 0),
      supabase.from("tasks").select("*").eq("assigned_to", user.id).neq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("clan_members").select("clan_id, role").eq("user_id", user.id),
    ]);

    // Build recursive unlimited-depth tree
    const buildTree = (flat: DBTask[], parentId: string | null): DBTask[] =>
      flat
        .filter(t => t.parent_id === parentId)
        .map(t => ({ ...t, subtasks: buildTree(flat, t.id) }));
    // Check for overdue tasks to automatically mark pending
    const today = new Date().toISOString().split("T")[0];
    const flat: DBTask[] = (qRes ?? []).map(t => ({ ...t, subtasks: [] }));
    const overdueTasks = flat.filter(t => !t.is_completed && !t.is_failed && !t.is_pending && t.deadline && t.deadline < today);

    if (overdueTasks.length > 0) {
      const overdueIds = overdueTasks.map(t => t.id);
      // Only mark pending — no XP penalty yet. Penalty fires on explicit "Fail" click.
      await supabase.from("tasks").update({ is_pending: true }).in("id", overdueIds);
      // Re-fetch to reflect new pending state
      return fetchQuests();
    }

    setTasks(buildTree(flat, null));

    // assigned-to-me tasks (flat, no subtask nesting needed)
    setAssignedTasks((aRes ?? []).map(t => ({ ...t, subtasks: [] })));
    setInventory(iRes ?? []);

    // if user is a clan leader in ANY clan, load clan members for assignment dropdown
    const memberships = membership || [];
    const leaderRoles = memberships.filter((m: any) => m.role === "leader" || m.role === "officer");
    
    if (leaderRoles.length > 0) {
      setIsLeader(true);
      const clanIds = leaderRoles.map((m: any) => m.clan_id);
      const { data: members } = await supabase
        .from("clan_members").select("user_id").in("clan_id", clanIds);
      if (members) {
        const uids = Array.from(new Set(members.map((m: any) => m.user_id).filter((id: string) => id !== user.id)));
        const { data: profs } = await supabase.from("user_profiles").select("user_id, name").in("user_id", uids);
        setClanMembers(profs ?? []);
      }
    } else {
      setIsLeader(false);
      setClanMembers([]);
    }

    setLoading(false);
  };

  useEffect(() => { fetchQuests(); }, [user]);

  /* ─── derived ─── */
  const taskDates = useMemo(() => {
    const dates = new Set<string>();
    const scan = (ts: DBTask[]) => ts.forEach(t => {
      if (t.deadline) dates.add(t.deadline);
      scan(t.subtasks);
    });
    scan(tasks);
    return dates;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      let matchStatus = false;
      if (activeTab === "completed") matchStatus = !!(t.is_completed || t.is_failed);
      else if (activeTab === "pending") matchStatus = !t.is_completed && !t.is_failed && !!t.is_pending;
      else if (activeTab === "active") matchStatus = !t.is_completed && !t.is_failed && !t.is_pending;

      const matchDate = !selectedDate || t.deadline === selectedDate;
      return matchStatus && matchDate;
    });
  }, [tasks, activeTab, selectedDate]);

  /* ─── handlers ─── */
  const handleOpenAdd = (parentId: string | null = null) => {
    setEditQuest(null);
    setFormData({ ...EMPTY_FORM, parentId, assignTo: "" });
    setShowModal(true);
  };

  const handleOpenEdit = (task: DBTask) => {
    setEditQuest(task);
    setFormData({
      title:    task.title,
      category: task.category,
      description: task.description,
      deadline: task.deadline ?? "",
      time: task.time ?? "",
      priority: task.priority,
      xp_tier: task.xp_tier || "Low",
      parentId: task.parent_id,
      assignTo: task.assigned_to ?? "",
    });
    setShowModal(true);
  };

  const getXpByTier = (tier: string) => {
    switch (tier) {
      case "Legendary": return 250;
      case "Super": return 100;
      case "High": return 50;
      case "Mid": return 25;
      case "Low": return 10;
      default: return 10;
    }
  };

  const handleSave = async () => {
    if (!supabase || !user || !formData.title.trim()) return;
    const targetUser = formData.assignTo || user.id;

    const payload: any = {
      user_id:     targetUser === user.id ? user.id : user.id, // creator is always self
      title:       formData.title,
      category:    formData.category,
      points:      getXpByTier(formData.xp_tier),
      description: formData.description,
      deadline:    formData.deadline || null,
      time:        formData.time || null,
      priority:    formData.priority,
      xp_tier:     formData.xp_tier,
      parent_id:   formData.parentId,
      assigned_to: formData.assignTo || null,
    };

    if (editQuest) {
      await supabase.from("tasks").update(payload).eq("id", editQuest.id);
    } else {
      await supabase.from("tasks").insert(payload);
    }
    fetchQuests();
    setShowModal(false);
    setEditQuest(null);
    setFormData(EMPTY_FORM);
  };

  // Recursively search the full task tree (unlimited depth)
  const findTaskById = (nodes: DBTask[], id: string): DBTask | undefined => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findTaskById(node.subtasks, id);
      if (found) return found;
    }
    return undefined;
  };

  const handleComplete = async (id: string, isDone: boolean) => {
    if (!supabase || !user) return;
    const completed_at = !isDone ? new Date().toISOString() : null;
    await supabase.from("tasks").update({ is_completed: !isDone, is_failed: false, completed_at }).eq("id", id);

    if (!isDone) {
      // Search full tree recursively so nested subtasks are found at any depth
      const task = findTaskById(tasks, id) ?? assignedTasks.find(t => t.id === id);
      if (task) {
        const basePts = task.points;
        // Apply XP_BOOST if available (2x multiplier)
        const pts = await applyXpBoost(supabase, user.id, basePts);

        // Credit XP to the completing user (me)
        const { data: prof } = await supabase.from("user_profiles").select("total_points").eq("user_id", user.id).single();
        await supabase.from("user_profiles").update({ total_points: (prof?.total_points ?? 0) + pts }).eq("user_id", user.id);

        const today = new Date().toISOString().split("T")[0];
        const { data: log } = await supabase.from("user_points").select("daily_points").eq("user_id", user.id).eq("date", today).maybeSingle();
        if (log) {
          await supabase.from("user_points").update({ daily_points: log.daily_points + pts }).eq("user_id", user.id).eq("date", today);
        } else {
          await supabase.from("user_points").insert({ user_id: user.id, date: today, daily_points: pts });
        }

        // Auto-sync level / rank / title after XP gain
        const progression = await syncProgression(supabase, user.id);
        showProgressionToast(progression);
      }
    }
    fetchQuests();
  };

  /** User explicitly marks a pending task as FAILED → deduct XP penalty */
  const handleFail = async (id: string) => {
    if (!supabase || !user) return;
    const task = findTaskById(tasks, id);
    if (!task) return;
    const penalty = task.points || 10;

    await supabase.from("tasks").update({ is_failed: true, is_pending: false, is_completed: true }).eq("id", id);

    // Log punishment
    await supabase.from("punishments").insert({
      user_id: user.id,
      name: `Failed Quest: ${task.title}`,
      xp_penalty: penalty,
      triggered: 1,
    });

    // Deduct XP
    const { data: prof } = await supabase.from("user_profiles").select("total_points").eq("user_id", user.id).single();
    const newPoints = Math.max(0, (prof?.total_points ?? 0) - penalty);
    await supabase.from("user_profiles").update({ total_points: newPoints }).eq("user_id", user.id);

    // Deduct from daily log too
    const today = new Date().toISOString().split("T")[0];
    const { data: log } = await supabase.from("user_points").select("daily_points").eq("user_id", user.id).eq("date", today).maybeSingle();
    if (log) {
      await supabase.from("user_points").update({ daily_points: Math.max(0, log.daily_points - penalty) }).eq("user_id", user.id).eq("date", today);
    }

    const progression = await syncProgression(supabase, user.id);
    showProgressionToast(progression);
    fetchQuests();
  };

  /** Manually mark an active task as pending (deferred) */
  const handlePending = async (id: string) => {
    if (!supabase) return;
    await supabase.from("tasks").update({ is_pending: true }).eq("id", id);
    fetchQuests();
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    await supabase.from("tasks").delete().eq("id", id);
    fetchQuests();
  };

  const handleSkip = async (id: string) => {
    if (!supabase || !user || inventory.length === 0) return;
    const item = inventory[0];
    await supabase.from("inventory").update({ quantity: item.quantity - 1 }).eq("id", item.id);
    await handleComplete(id, false);
  };

  const handleNLP = async (parsed: any[]) => {
    if (!supabase || !user) return;
    const items = parsed.map((t: any) => ({
      user_id:     user.id,
      title:       t.title,
      category:    t.category   || "General",
      points:      t.points || getXpByTier(t.xp_tier || "Low"),
      description: t.description || "",
      deadline:    t.deadline   || null,
      priority:    t.priority   || "Normal",
      xp_tier:     t.xp_tier    || "Low",
    }));
    await supabase.from("tasks").insert(items);
    fetchQuests();
    setShowNLP(false);
  };

  const hasSkipItem = inventory.length > 0;

  /* ─── render ─── */
  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Quests</h2>
        <div className="flex gap-8">
          <Button variant="secondary" size="sm" onClick={() => setShowCal(p => !p)}>
            <CalendarDays size={13} /> {showCal ? "Hide" : "Calendar"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowNLP(true)}>
            <Download size={13} /> Import
          </Button>
          <Button variant="primary" size="sm" onClick={() => handleOpenAdd()}>
            <Plus size={13} /> Add Quest
          </Button>
        </div>
      </div>

      {showCal && (
        <div style={{ marginBottom: 24 }}>
          <Calendar selectedDate={selectedDate} onSelectDate={setSelectedDate} taskDates={taskDates} />
          {selectedDate && (
            <div style={{ marginTop: 10, fontSize: "0.76rem", color: "var(--t3)" }}>
              Showing quests for {selectedDate} —{" "}
              <span style={{ color: "var(--t2)", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setSelectedDate(null)}>clear filter</span>
            </div>
          )}
        </div>
      )}

      <div className="tabs">
        <div className={`tab${activeTab === "active" ? " active" : ""}`} onClick={() => setActiveTab("active")}>
          Active <span className="badge-counter">{tasks.filter(t => !t.is_completed && !t.is_pending && !t.is_failed).length}</span>
        </div>
        <div className={`tab${activeTab === "pending" ? " active" : ""}`} onClick={() => setActiveTab("pending")}>
          Pending <span className="badge-counter">{tasks.filter(t => t.is_pending && !t.is_completed).length}</span>
        </div>
        <div className={`tab${activeTab === "completed" ? " active" : ""}`} onClick={() => setActiveTab("completed")}>
          Completed <span className="badge-counter">{tasks.filter(t => t.is_completed || t.is_failed).length}</span>
        </div>
        {assignedTasks.length > 0 && (
          <div className={`tab${activeTab === "assigned" ? " active" : ""}`} onClick={() => setActiveTab("assigned")}>
            <Users size={12} /> Assigned <span className="badge-counter">{assignedTasks.filter(t => !t.is_completed).length}</span>
          </div>
        )}
      </div>

      {/* Quest list */}
      {loading ? (
        <article className="panel panel-empty text-muted text-sm">Loading quests…</article>
      ) : activeTab === "assigned" ? (
        assignedTasks.filter(t => !t.is_completed).length > 0 ? (
          <article className="panel panel-no-pad">
            {assignedTasks.filter(t => !t.is_completed).map(q => (
              <QuestItem key={q.id} quest={q} readOnly
                onComplete={(id) => handleComplete(id, q.is_completed)} />
            ))}
          </article>
        ) : (
          <article className="panel panel-empty">
            <p className="text-muted text-sm">No assigned quests pending.</p>
          </article>
        )
      ) : filteredTasks.length > 0 ? (
        <article className="panel panel-no-pad">
          {filteredTasks.map(q => (
            <QuestItem
              key={q.id}
              quest={q}
              onComplete={(id) => handleComplete(id, q.is_completed)}
              onPending={handlePending}
              onFail={handleFail}
              onSkip={hasSkipItem ? handleSkip : undefined}
              onDelete={handleDelete}
              onEdit={handleOpenEdit}
              onAddSubtask={handleOpenAdd}
            />
          ))}
        </article>
      ) : (
        <article className="panel panel-empty">
          <div style={{ fontSize: "2.5rem", marginBottom: 14, opacity: 0.2 }}>✓</div>
          <p className="text-muted text-sm">
            {selectedDate ? `No quests for ${selectedDate}.` : "No quests found. Time to level up!"}
          </p>
        </article>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        title={editQuest ? "Edit Quest" : formData.parentId ? "Add Subtask" : "New Quest"}
        onClose={() => { setShowModal(false); setEditQuest(null); setFormData(EMPTY_FORM); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditQuest(null); setFormData(EMPTY_FORM); }}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>{editQuest ? "Save Changes" : "Create"}</Button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" placeholder="e.g. Run 5km" value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              {["General", "Work", "Fitness", "Learning", "Academics", "Mindfulness", "Finance", "Social", "Creative", "Errands"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Urgency</label>
            <select className="form-select" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
              <option value="Low">Low</option>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="URGENT">URGENT</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">XP Tier</label>
            <select className="form-select" value={formData.xp_tier} onChange={e => setFormData({ ...formData, xp_tier: e.target.value })}>
              <option value="Low">Low (+10 XP)</option>
              <option value="Mid">Mid (+25 XP)</option>
              <option value="High">High (+50 XP)</option>
              <option value="Super">Super (+100 XP)</option>
              <option value="Legendary">Legendary (+250 XP)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Deadline</label>
            <input type="date" className="form-input" value={formData.deadline}
              onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Time</label>
            <input type="time" className="form-input" value={formData.time}
              onChange={e => setFormData({ ...formData, time: e.target.value })} />
          </div>
        </div>

        {/* Leader-only: assign to clan member */}
        {isLeader && clanMembers.length > 0 && (
          <div className="form-group">
            <label className="form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={12} /> Assign To (Clan Member)
            </label>
            <select className="form-select" value={formData.assignTo}
              onChange={e => setFormData({ ...formData, assignTo: e.target.value })}>
              <option value="">— Myself —</option>
              {clanMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Description (optional)</label>
          <textarea className="form-textarea" rows={2} value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })} />
        </div>
      </Modal>

      <NLPImportModal isOpen={showNLP} onClose={() => setShowNLP(false)} onTasksCreate={handleNLP} />
    </section>
  );
}
