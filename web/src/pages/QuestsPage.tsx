import { useEffect, useState, useMemo } from "react";
import { Modal }          from "../components/Modal";
import { Button }         from "../components/Button";
import { QuestItem }      from "../components/QuestItem";
import type { DBTask }    from "../components/QuestItem";
import { NLPImportModal } from "../components/NLPImportModal";
import { Calendar }       from "../components/Calendar";
import { Plus, Download, CalendarDays, Users, Skull } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth }  from "../lib/authContext";
import { syncProgression, showProgressionToast, applyXpBoost, calculateEffectiveXp, getRandomPunishment, CATEGORY_STAT_MAP } from "../lib/levelEngine";
import { SHADOW_CATALOG } from "../lib/catalog";
import { calculateNextDeadline, findNextValidDeadline } from "../lib/taskUtils";

const EMPTY_FORM = {
  title: "", category: "General", description: "",
  deadline: "", start_time: "", end_time: "", priority: "Normal", xp_tier: "Low", parentId: null as string | null,
  assignTo: "" as string,   // user_id to assign to (empty = self)
  is_recurring: false,
  recurrence_type: "none" as "none" | "daily" | "interval" | "weekly" | "monthly" | "custom",
  recurrence_interval: 1,
  recurrence_days: [] as number[],
  recurrence_day_of_month: 1,
  recurrence_custom_label: "",
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
  const [userStatus,   setUserStatus]   = useState<string>("ACTIVE");
  const [totalXp,      setTotalXp]      = useState<number>(0);

  /* ─── utils ─── */
  const buildTaskTree = (flatTasks: any[]) => {
    const taskMap: Record<string, any> = {};
    // First pass: create map
    flatTasks.forEach(t => {
      taskMap[t.id] = { ...t, subtasks: [] };
    });
    
    const tree: any[] = [];
    // Second pass: build tree
    flatTasks.forEach(t => {
      const task = taskMap[t.id];
      if (t.parent_id && taskMap[t.parent_id] && t.parent_id !== t.id) {
        // Prevent obvious cycles (id === parent_id)
        taskMap[t.parent_id].subtasks.push(task);
      } else {
        tree.push(task);
      }
    });
    return tree;
  };

  const findTaskById = (list: DBTask[], id: string, maxDepth = 10): DBTask | undefined => {
    if (maxDepth <= 0) return undefined;
    for (const t of list) {
      if (t.id === id) return t;
      if (t.subtasks && t.subtasks.length > 0) {
        const found = findTaskById(t.subtasks, id, maxDepth - 1);
        if (found) return found;
      }
    }
    return undefined;
  };

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

    // Check for overdue tasks to automatically mark as FAILED
    const today = new Date().toISOString().split("T")[0];
    const flat: DBTask[] = (qRes ?? []).map(t => ({ ...t, subtasks: [] }));

    // Catch-up Sweep: Reset completed/failed recurring tasks whose deadline is in the past
    const expiredRecurring = flat.filter(t => (t.is_completed || t.is_failed) && t.is_recurring && t.deadline && t.deadline < today);
    if (expiredRecurring.length > 0) {
      for (const task of expiredRecurring) {
        const nextDeadline = findNextValidDeadline(task);
        await supabase.from("tasks").update({
          is_completed: false,
          is_failed: false,
          is_pending: false,
          completed_at: null,
          deadline: nextDeadline
        }).eq("id", task.id);
      }
      return fetchQuests();
    }

    const overdueTasks = flat.filter(t => !t.is_completed && !t.is_failed && !t.is_pending && t.deadline && t.deadline < today);

    if (overdueTasks.length > 0) {
      const overdueIds = overdueTasks.map(t => t.id);
      await supabase.from("tasks").update({ 
        is_pending: true, is_completed: false
      }).in("id", overdueIds);
      return fetchQuests();
    }

    if (qRes) {
      const tree = buildTaskTree(qRes);
      setTasks(tree);
    }
    
    const { data: profile } = await supabase.from("user_profiles").select("status, total_points").eq("user_id", user.id).single();
    if (profile) {
      setUserStatus(profile.status || "ACTIVE");
      setTotalXp(profile.total_points || 0);
    }

    // assigned-to-me tasks (flat, no subtask nesting needed)
    setAssignedTasks(aRes ? buildTaskTree(aRes) : []);
    setInventory(iRes || []);

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
      start_time: task.start_time ?? "",
      end_time: task.end_time ?? "",
      priority: task.priority,
      xp_tier: task.xp_tier || "Low",
      parentId: task.parent_id,
      assignTo: task.assigned_to ?? "",
      is_recurring: task.is_recurring ?? false,
      recurrence_type: (task as any).recurrence_type || (task.is_recurring ? "daily" : "none"),
      recurrence_interval: (task as any).recurrence_interval || 1,
      recurrence_days: (task as any).recurrence_days ? JSON.parse((task as any).recurrence_days) : [],
      recurrence_day_of_month: (task as any).recurrence_day_of_month || 1,
      recurrence_custom_label: (task as any).recurrence_custom_label || "",
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

    const payload: any = {
      user_id:     user.id, // creator is always current user
      title:       formData.title,
      category:    formData.category,
      points:      getXpByTier(formData.xp_tier),
      description: formData.description,
      deadline:    formData.deadline || null,
      start_time:  formData.start_time || null,
      end_time:    formData.end_time || null,
      priority:    formData.priority,
      xp_tier:     formData.xp_tier,
      parent_id:   formData.parentId,
      assigned_to: formData.assignTo || null,
      is_recurring: formData.recurrence_type !== "none",
      recurrence_type: formData.recurrence_type !== "none" ? formData.recurrence_type : null,
      recurrence_interval: formData.recurrence_type === "interval" ? formData.recurrence_interval : (formData.recurrence_type === "daily" ? 1 : null),
      recurrence_days: formData.recurrence_type === "weekly" ? JSON.stringify(formData.recurrence_days) : null,
      recurrence_day_of_month: formData.recurrence_type === "monthly" ? formData.recurrence_day_of_month : null,
      recurrence_custom_label: formData.recurrence_type === "custom" ? formData.recurrence_custom_label : null,
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

  const handleComplete = async (id: string, isDone: boolean) => {
    if (!supabase || !user) return;
    const completed_at = !isDone ? new Date().toISOString() : null;
    await supabase.from("tasks").update({ is_completed: !isDone, is_failed: false, completed_at }).eq("id", id);

    if (!isDone) {
      // Search full tree recursively so nested subtasks are found at any depth
      const task = findTaskById(tasks, id) || findTaskById(assignedTasks, id);
      if (task) {
        const basePts = task.points;
        // Normalize XP for learning tasks and apply category weights
        const normalizedPts = calculateEffectiveXp(basePts, task.category, totalXp);
        
        // Apply XP_BOOST if available (2x multiplier)
        const pts = await applyXpBoost(supabase, user.id, normalizedPts);

        // Credit XP to the completing user (me)
        const { data: prof } = await supabase.from("user_profiles").select("total_points, stat_strength, stat_agility, stat_intelligence, stat_vitality, stat_sense").eq("user_id", user.id).single();
        
        // --- Stat Progression ---
        const statColumn = CATEGORY_STAT_MAP[task.category];
        const updatePayload: any = { total_points: (prof?.total_points ?? 0) + pts };
        if (statColumn && prof) {
          updatePayload[statColumn] = (prof as any)[statColumn] + 1; // +1 to the mapped stat
        }
        await supabase.from("user_profiles").update(updatePayload).eq("user_id", user.id);

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

        // --- NEW: Randomized Shadow Extraction (Arise!) ---
        const tier = task.xp_tier || "Low";
        const chances: Record<string, number> = { Legendary: 1.0, Super: 0.4, High: 0.15, Mid: 0.05, Low: 0.02 };
        const roll = Math.random();

        if (roll <= chances[tier]) {
          const pool = SHADOW_CATALOG.filter(s => {
            if (tier === "Legendary") return s.rarity === "Legendary" || s.rarity === "Mythic";
            if (tier === "Super") return s.rarity === "Epic";
            if (tier === "High") return s.rarity === "Rare";
            return s.rarity === "Common";
          });
          const shadow = pool[Math.floor(Math.random() * pool.length)];
          
          const { error } = await supabase.from("shadows").insert({
            user_id: user.id,
            name: shadow.name,
            rarity: shadow.rarity,
            bonus_type: "xp_boost",
            bonus_value: (shadow as any).bonus || (shadow.rarity === "Legendary" ? 0.1 : 0.05)
          });

          if (!error) {
            alert(`✨ ARISE! You have extracted a [${shadow.rarity}] grade shadow: ${shadow.name}! Check your army on the Dashboard.`);
          } else {
            console.error("Shadow extraction error:", error);
          }
        } else if (tier === "Super" || tier === "Legendary") {
          alert("⚠️ Shadow Extraction Failed: The shadow has dissipated into the void...");
        }

        // --- Recurring Logic (Clever Alternative: Update Existing Row) ---
        if (task.is_recurring) {
          const nextDeadline = calculateNextDeadline(task);

          await supabase.from("tasks").update({ 
            is_completed: false, 
            is_active: false,
            completed_at: null,
            deadline: nextDeadline
          }).eq("id", id);
        }
      }
    }
    fetchQuests();
  };

  /** User explicitly marks a task as FAILED → deduct XP penalty */
  const handleFail = async (id: string) => {
    if (!supabase || !user) return;
    const task = findTaskById(tasks, id) || findTaskById(assignedTasks, id);
    if (!task) return;
    const penalty = task.points || 10;

    const confirmed = window.confirm(
      `☠️ MISSION FAILURE CONFIRMED\n\n"${task.title}"\n\nPenalty: -${penalty} XP will be deducted from your total.\n\nProceed?`
    );
    if (!confirmed) return;

    // Mark task as failed
    await supabase.from("tasks").update({
      is_failed: true,
      is_pending: false,
      is_completed: true,
      is_active: false,
      completed_at: new Date().toISOString(),
    }).eq("id", id);

    // Log punishment record
    await supabase.from("punishments").insert({
      user_id: user.id,
      name: `Failed Quest: ${task.title}`,
      xp_penalty: penalty,
      triggered: 1,
    });

    // Deduct XP from total
    const { data: prof } = await supabase.from("user_profiles").select("total_points").eq("user_id", user.id).single();
    const newPoints = Math.max(0, (prof?.total_points ?? 0) - penalty);
    await supabase.from("user_profiles").update({ total_points: newPoints }).eq("user_id", user.id);

    // Deduct from daily log
    const today = new Date().toISOString().split("T")[0];
    const { data: log } = await supabase.from("user_points").select("daily_points").eq("user_id", user.id).eq("date", today).maybeSingle();
    if (log) {
      await supabase.from("user_points").update({ daily_points: Math.max(0, log.daily_points - penalty) }).eq("user_id", user.id).eq("date", today);
    }

    // Re-sync rank/level/title (may drop on heavy XP loss)
    const progression = await syncProgression(supabase, user.id);
    
    // GENERATE MANDATORY PUNISHMENT QUEST
    const punishment = getRandomPunishment();
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: `🚨 PENALTY: ${punishment.title}`,
      description: punishment.desc,
      points: punishment.points,
      category: 'PUNISHMENT',
      priority: 'URGENT',
      is_active: true, // Auto-start the penalty
      deadline: new Date().toISOString().split('T')[0], // Must be done today
      xp_tier: 'High'
    });

    if (progression) {
      // Show penalty toast
      const msgs: string[] = [
        `💀 MISSION FAILED — ${penalty} XP DEDUCTED`,
        `🚨 SYSTEM ALERT: Penalty Quest Manifested! Check your active missions. Failure to comply will result in further mana decay.`
      ];
      if (progression.level < progression.prevLevel) msgs.push(`⬇️ LEVEL DOWN: ${progression.prevLevel} → ${progression.level}`);
      if (progression.rank !== progression.prevRank) msgs.push(`⬇️ RANK DROPPED: ${progression.prevRank} → ${progression.rank}`);
      setTimeout(() => alert(msgs.join("\n")), 100);
    }

    // --- Recurring Logic: Even if failed, reset for next occurrence ---
    if (task.is_recurring) {
      const nextDeadline = calculateNextDeadline(task);
      await supabase.from("tasks").update({ 
        is_completed: false, 
        is_failed: false,
        is_pending: false,
        completed_at: null,
        deadline: nextDeadline
      }).eq("id", task.id);
    }

    fetchQuests();
  };

  const handlePause = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("tasks").update({ is_paused: true, paused_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
      await fetchQuests();
    } catch (err) { console.error("Error pausing quest:", err); }
  };

  const handleResume = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from("tasks").update({ is_paused: false, paused_at: null }).eq("id", id);
      if (error) throw error;
      await fetchQuests();
    } catch (err) { console.error("Error resuming quest:", err); }
  };

  const handleReset = async (id: string) => {
    if (!supabase || !confirm("⚠️ RESTART RAID? Quest will return to an INACTIVE state.")) return;
    const { error } = await supabase.from("tasks").update({ 
      is_active: false, 
      started_at: null, 
      is_paused: false, 
      paused_at: null 
    }).eq("id", id);
    if (error) throw error;
    await fetchQuests();
  };

  const handleStart = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ is_active: true, started_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
    await fetchQuests();
  };

  const handleReactivate = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("tasks").update({ 
      is_completed: false, 
      is_failed: false, 
      is_active: false,
      completed_at: null,
      started_at: null,
      is_paused: false,
      paused_at: null
    }).eq("id", id);
    if (error) throw error;
    await fetchQuests();
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
      
      {userStatus === 'PENALTY' && (
        <div className="panel" style={{ 
          background: 'rgba(239, 68, 68, 0.15)', 
          border: '1px solid rgba(239, 68, 68, 0.3)', 
          marginBottom: 20, 
          padding: '12px 20px',
          borderRadius: 'var(--r-md)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#ff4444'
        }}>
          <Skull size={20} className="animate-pulse" />
          <div>
            <strong style={{ display: 'block', fontSize: '0.85rem', letterSpacing: '1px' }}>SYSTEM PENALTY ACTIVE</strong>
            <p style={{ fontSize: '0.75rem', opacity: 0.8, margin: '2px 0 0 0' }}>
              Your Mana (XP) is negative. High-tier rewards are locked until debt is repaid. 
              Earn {Math.abs(totalXp)} XP to stabilize your soul.
            </p>
          </div>
        </div>
      )}

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
                onComplete={(id) => handleComplete(id, q.is_completed)}
                onAddSubtask={handleOpenAdd} />
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
              onPause={handlePause}
              onResume={handleResume}
              onReset={handleReset}
              onStart={handleStart}
              onReactivate={handleReactivate}
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
        title={
          editQuest 
            ? "Edit Quest" 
            : formData.parentId 
              ? `New Objective for: ${findTaskById(tasks, formData.parentId)?.title || "Quest"}` 
              : "New Quest"
        }
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

        <div className="form-group">
          <label className="form-label">
            Deadline {editQuest && <span style={{ color: '#ff4444', fontSize: '0.6rem' }}>(IMMUTABLE)</span>}
          </label>
          <input 
            type="date" 
            className="form-input" 
            value={formData.deadline} 
            disabled={!!editQuest}
            style={editQuest ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} 
          />
        </div>

        <div className="form-group" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label className="form-label">Start Time</label>
            <input type="time" className="form-input" value={formData.start_time}
              onChange={e => setFormData({ ...formData, start_time: e.target.value })} />
          </div>
          <div>
            <label className="form-label">End Time</label>
            <input type="time" className="form-input" value={formData.end_time}
              onChange={e => setFormData({ ...formData, end_time: e.target.value })} />
          </div>
        </div>

        {/* ── RECURRENCE SYSTEM ── */}
        <div className="form-group" style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: formData.is_recurring ? 12 : 0 }}>
            <input 
              type="checkbox" 
              id="is_recurring" 
              checked={formData.is_recurring} 
              onChange={e => setFormData({ ...formData, is_recurring: e.target.checked, recurrence_type: e.target.checked ? 'daily' : 'none' })}
              style={{ width: 16, height: 16, accentColor: 'var(--accent-primary)' }}
            />
            <label htmlFor="is_recurring" className="form-label" style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <RotateCcw size={14} /> Recurring Protocol (Quest will auto-reset)
            </label>
          </div>

          {formData.is_recurring && (
            <div style={{ paddingLeft: 26 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(["daily","interval","weekly","monthly","custom"] as const).map(rt => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setFormData({ ...formData, recurrence_type: rt })}
                    style={{
                      padding: '6px 0',
                      fontSize: '0.65rem',
                      fontWeight: 900,
                      letterSpacing: '1px',
                      textTransform: 'uppercase',
                      borderRadius: '8px',
                      border: `1px solid ${formData.recurrence_type === rt ? 'rgba(168,168,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
                      background: formData.recurrence_type === rt ? 'rgba(168,168,255,0.15)' : 'rgba(255,255,255,0.03)',
                      color: formData.recurrence_type === rt ? 'var(--accent-primary)' : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {rt === 'daily' ? '📅 Daily' : rt === 'interval' ? '🔢 Every N' : rt === 'weekly' ? '📆 Weekly' : rt === 'monthly' ? '🗓 Monthly' : '⚙️ Custom'}
                  </button>
                ))}
              </div>

              {/* Sub-options for each type (Interval, Weekly, etc.) */}
              {formData.recurrence_type === 'interval' && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Every</span>
                  <input type="number" min={2} max={365} className="form-input" value={formData.recurrence_interval}
                    onChange={e => setFormData({ ...formData, recurrence_interval: Math.max(2, parseInt(e.target.value) || 2) })} style={{ width: 70 }} />
                  <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>days</span>
                </div>
              )}
              {formData.recurrence_type === 'weekly' && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {["S","M","T","W","T","F","S"].map((day, idx) => {
                      const active = formData.recurrence_days.includes(idx);
                      return (
                        <button key={idx} type="button" onClick={() => {
                          const newDays = active ? formData.recurrence_days.filter(d => d !== idx) : [...formData.recurrence_days, idx].sort();
                          setFormData({ ...formData, recurrence_days: newDays });
                        }} style={{
                          flex: 1, padding: '4px 0', fontSize: '0.6rem', fontWeight: 900, borderRadius: '6px',
                          border: `1px solid ${active ? 'rgba(168,168,255,0.5)' : 'rgba(255,255,255,0.07)'}`,
                          background: active ? 'rgba(168,168,255,0.18)' : 'rgba(255,255,255,0.03)',
                          color: active ? 'var(--accent-primary)' : 'rgba(255,255,255,0.35)',
                        }}>{day}</button>
                      );
                    })}
                  </div>
                </div>
              )}
              {formData.recurrence_type === 'monthly' && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--t2)' }}>Day of month</span>
                  <input type="number" min={1} max={31} className="form-input" value={formData.recurrence_day_of_month}
                    onChange={e => setFormData({ ...formData, recurrence_day_of_month: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)) })} style={{ width: 70 }} />
                </div>
              )}
              {formData.recurrence_type === 'custom' && (
                <div style={{ marginTop: 10 }}>
                  <input className="form-input" placeholder="e.g. Every Mon & Wed" value={formData.recurrence_custom_label}
                    onChange={e => setFormData({ ...formData, recurrence_custom_label: e.target.value })} />
                </div>
              )}
            </div>
          )}
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
