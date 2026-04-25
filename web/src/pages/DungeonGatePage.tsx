import { useEffect, useState, useMemo } from "react";
import { Modal }          from "../components/Modal";
import { Button }         from "../components/Button";
import type { DBTask }    from "../components/QuestItem";
import { NLPImportModal } from "../components/NLPImportModal";
import { Plus, Download, Shield, Zap, Skull, ChevronRight, Filter, Target, CalendarDays, Activity, Edit3, Trash2, Clock, RotateCcw, RefreshCw, Layers } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth }  from "../lib/authContext";
import { syncProgression, showProgressionToast, applyXpBoost } from "../lib/levelEngine";
import { RaidTimer } from "../components/RaidTimer";

const EMPTY_FORM = {
  title: "", category: "General", description: "",
  deadline: "", start_time: "", end_time: "", priority: "Normal", xp_tier: "Low", parentId: null as string | null,
  assignTo: "" as string,
  is_recurring: false,
};


export function DungeonGatePage() {
  const { user } = useAuth();
  const [tasks,        setTasks]        = useState<DBTask[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeTab,    setActiveTab]    = useState<"active" | "completed" | "pending">("active");
  const [showModal,    setShowModal]    = useState(false);
  const [showNLP,      setShowNLP]      = useState(false);
   const [formData,     setFormData]     = useState(EMPTY_FORM);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  // Filters & Details
  const [catFilter,    setCatFilter]    = useState("All");
  const [prioFilter,   setPrioFilter]   = useState("All");
  const [selectedGate, setSelectedGate] = useState<DBTask | null>(null);

  const buildTaskTree = (flatTasks: any[]) => {
    const taskMap: Record<string, any> = {};
    flatTasks.forEach(t => {
      taskMap[t.id] = { ...t, subtasks: [] };
    });
    
    const tree: any[] = [];
    flatTasks.forEach(t => {
      const task = taskMap[t.id];
      if (t.parent_id && taskMap[t.parent_id] && t.parent_id !== t.id) {
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

  const fetchQuests = async () => {
    if (!supabase || !user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      if (data) {
        const tree = buildTaskTree(data);
        setTasks(tree);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuests(); }, [user]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      // Tab Filter
      let matchTab = false;
      if (activeTab === "completed") matchTab = !!t.is_completed || !!t.is_failed;
      else if (activeTab === "pending") matchTab = !!t.is_pending && !t.is_completed;
      else matchTab = !t.is_completed && !t.is_failed && !t.is_pending;

      if (!matchTab) return false;

      // Category Filter
      if (catFilter !== "All" && t.category !== catFilter) return false;

      // Urgency Filter
      if (prioFilter !== "All" && t.priority !== prioFilter) return false;

      return true;
    });
  }, [tasks, activeTab, catFilter, prioFilter]);

  const getRankColor = (tier: string) => {
    switch (tier) {
      case "Legendary": return "#ffcc00";
      case "Super": return "#f87171";
      case "High": return "#a8a8ff";
      case "Mid": return "#6366f1";
      case "Low": return "#34d399";
      default: return "#94a3b8";
    }
  };

  const getRankLetter = (tier: string) => {
    switch (tier) {
      case "Legendary": return "S";
      case "Super": return "A";
      case "High": return "B";
      case "Mid": return "C";
      case "Low": return "E";
      default: return "E";
    }
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
    setSaving(true);
    try {
      const payload: any = {
        user_id: user.id,
        assigned_to: user.id,
        title: formData.title,
        category: formData.category,
        points: getXpByTier(formData.xp_tier),
        description: formData.description,
        deadline: formData.deadline || null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        priority: formData.priority,
        xp_tier: formData.xp_tier,
        is_recurring: formData.is_recurring,
        parent_id: formData.parentId,
        gate_type: formData.parentId 
          ? (findTaskById(tasks, formData.parentId)?.parent_id ? "Double Dungeon Objective" : "Hidden Dungeon")
          : "Gate",
      };

      if (editingId) {
        const { error } = await supabase.from("tasks").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.is_active = false;
        payload.is_completed = false;
        const { error } = await supabase.from("tasks").insert(payload);
        if (error) throw error;
      }
      
      await fetchQuests();
      setShowModal(false);
      setEditingId(null);
      setFormData(EMPTY_FORM);
    } catch (err) {
      console.error("Error manifesting gate:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenAdd = (parentId: string | null = null) => {
    setEditingId(null);
    setFormData({ ...EMPTY_FORM, parentId });
    setShowModal(true);
  };

  const handleEdit = (gate: DBTask) => {
    setEditingId(gate.id);
    setFormData({
      title: gate.title,
      category: gate.category,
      description: gate.description || "",
      deadline: gate.deadline || "",
      start_time: gate.start_time || "",
      end_time: gate.end_time || "",
      priority: gate.priority,
      xp_tier: gate.xp_tier || "Low",
      parentId: gate.parent_id,
      assignTo: gate.assigned_to || "",
      is_recurring: gate.is_recurring || false,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!supabase || !confirm("Are you sure you want to dismantle this gate?")) return;
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
      await fetchQuests();
    } catch (err) {
      console.error("Error dismantling gate:", err);
    }
  };

  const handleStartRaid = async (id: string) => {
    if (!supabase || !user) return;
    try {
      setSaving(true);
      console.log("--- RAID START INITIATED ---");
      console.log("Target ID:", id);
      const started_at = new Date().toISOString();
      
      // Attempt 1: Full update with timeline support
      console.log("Attempting full update (is_active + started_at)...");
      const { error: fullError } = await supabase.from("tasks").update({ 
        is_active: true,
        started_at
      }).eq("id", id);
      
      if (fullError) {
        console.warn("Full update failed, attempting fallback (is_active only)...", fullError);
        
        // Attempt 2: Fallback to basic active status if started_at is missing from schema
        const { error: fallbackError } = await supabase.from("tasks").update({ 
          is_active: true
        }).eq("id", id);
        
        if (fallbackError) {
          console.error("Critical: All update attempts failed.", fallbackError);
          alert(`CRITICAL ERROR: ${fallbackError.message}\n\nThe 'tasks' table appears to be missing the 'is_active' column. Please run the migration SQL provided in the system console.`);
          throw fallbackError;
        }
        
        console.log("Raid started successfully (Fallback Mode: No timeline)");
        alert("Raid started successfully, but the Timeline feature requires a database migration. Please contact the System Administrator.");
      } else {
        console.log("Raid started successfully (Full Mode)");
      }
      
      await fetchQuests();
      setSelectedGate(prev => prev ? { ...prev, is_active: true, started_at } : null);
    } catch (err: any) {
      console.error("Evaluation Error:", err);
    } finally {
      setSaving(false);
    }
  };

  const handlePauseRaid = async (id: string) => {
    if (!supabase) return;
    try {
      console.log("--- ATTEMPTING RAID PAUSE ---", id);
      setSaving(true);
      const paused_at = new Date().toISOString();
      const { error } = await supabase.from("tasks").update({ is_paused: true, paused_at }).eq("id", id);
      if (error) throw error;
      
      await fetchQuests();
      setSelectedGate(prev => prev ? { ...prev, is_paused: true, paused_at } : null);
      console.log("PAUSE SUCCESS");
    } catch (err: any) { 
      console.error("PAUSE CRITICAL FAILURE:", err); 
      alert(`⚠️ SYSTEM ERROR: ${err.message || 'Check database columns'}`);
    } finally { setSaving(false); }
  };

  const handleResumeRaid = async (id: string) => {
    if (!supabase) return;
    try {
      console.log("--- ATTEMPTING RAID RESUME ---", id);
      setSaving(true);
      const { error } = await supabase.from("tasks").update({ is_paused: false, paused_at: null }).eq("id", id);
      if (error) throw error;
      
      await fetchQuests();
      setSelectedGate(prev => prev ? { ...prev, is_paused: false, paused_at: null } : null);
      console.log("RESUME SUCCESS");
    } catch (err: any) { 
      console.error("RESUME CRITICAL FAILURE:", err); 
      alert(`⚠️ SYSTEM ERROR: ${err.message || 'Check database columns'}`);
    } finally { setSaving(false); }
  };

  const handleResetRaid = async (id: string) => {
    if (!supabase || !confirm("⚠️ RESTART RAID? Progress will be lost and the gate will return to an INACTIVE state.")) return;
    try {
      console.log("--- ATTEMPTING RAID RESET ---", id);
      setSaving(true);
      const { error } = await supabase.from("tasks").update({ 
        is_active: false, 
        started_at: null, 
        is_paused: false, 
        paused_at: null 
      }).eq("id", id);
      if (error) throw error;
      
      await fetchQuests();
      setSelectedGate(prev => prev ? { ...prev, is_active: false, started_at: null, is_paused: false, paused_at: null } : null);
      console.log("RESET SUCCESS");
      alert("RAID RESET COMPLETE. Gate is now inactive.");
    } catch (err: any) { 
      console.error("RESET CRITICAL FAILURE:", err);
      alert(`⚠️ SYSTEM ERROR: ${err.message}`);
    } finally { setSaving(false); }
  };

  const handleReactivate = async (id: string) => {
    if (!supabase) return;
    try {
      setSaving(true);
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
      if (selectedGate?.id === id) {
        setSelectedGate(null);
        alert("GATE RE-MANIFESTED. Mission has returned to pending sector.");
      } else {
        setSelectedGate(prev => {
          if (!prev) return null;
          const resetRecursive = (t: any, d = 0): any => {
            if (d > 10) return t;
            if (t.id === id) return { ...t, is_completed: false, is_failed: false, is_active: false, completed_at: null, started_at: null, is_paused: false, paused_at: null };
            if (t.subtasks) return { ...t, subtasks: t.subtasks.map((s: any) => resetRecursive(s, d + 1)) };
            return t;
          };
          return resetRecursive(prev);
        });
      }
    } catch (err: any) { 
      console.error("RE-ACTIVATE FAILED:", err);
      alert(`⚠️ SYSTEM ERROR: ${err.message}`);
    } finally { setSaving(false); }
  };

  const handleComplete = async (id: string) => {
    if (!supabase || !user) return;
    const task = tasks.find(t => t.id === id) || findTaskById(tasks, id);
    if (!task) return;

    const completedSubtasks = task.subtasks.filter(s => s.is_completed).length;
    if (task.subtasks.length > 0 && completedSubtasks < task.subtasks.length) {
      alert("⚠️ CRITICAL FAILURE: Internal dungeons are still active. Clear all sub-objectives to unlock Gate Conquest!");
      return;
    }

    try {
      setSaving(true);
      const completed_at = new Date().toISOString();
      const { error: updateErr } = await supabase.from("tasks").update({ 
        is_completed: true, 
        is_failed: false, 
        is_active: false, 
        completed_at 
      }).eq("id", id);
      
      if (updateErr) throw updateErr;

      const pts = await applyXpBoost(supabase, user.id, task.points);
      const { data: prof } = await supabase.from("user_profiles").select("total_points").eq("user_id", user.id).single();
      await supabase.from("user_profiles").update({ total_points: (prof?.total_points ?? 0) + pts }).eq("user_id", user.id);
      
      const progression = await syncProgression(supabase, user.id);
      showProgressionToast(progression);

      // --- NEW: Randomized Shadow Extraction (Arise!) ---
      const { SHADOW_CATALOG } = await import("../lib/catalog");
      const tier = task.xp_tier || "Low";
      const chances: Record<string, number> = { Legendary: 1.0, Super: 0.4, High: 0.15, Mid: 0.05, Low: 0.02 };
      const roll = Math.random();

      if (roll <= (chances[tier] || 0.02)) {
        const pool = SHADOW_CATALOG.filter(s => {
          if (tier === "Legendary") return s.rarity === "Legendary" || s.rarity === "Mythic";
          if (tier === "Super") return s.rarity === "Epic";
          if (tier === "High") return s.rarity === "Rare";
          return s.rarity === "Common";
        });
        
        if (pool.length > 0) {
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
          }
        }
      } else if (tier === "Super" || tier === "Legendary") {
        alert("⚠️ Shadow Extraction Failed: The shadow has dissipated into the void...");
      }
      
      await fetchQuests();
      if (selectedGate?.id === id) {
        setSelectedGate(null);
      } else {
        setSelectedGate(prev => {
          if (!prev) return null;
          const updateRecursive = (t: any, d = 0): any => {
            if (d > 10) return t;
            if (t.id === id) return { ...t, is_completed: true, is_active: false, completed_at };
            if (t.subtasks) return { ...t, subtasks: t.subtasks.map((s: any) => updateRecursive(s, d + 1)) };
            return t;
          };
          return updateRecursive(prev);
        });
      }
    } catch (err) {
      console.error("Error conquering gate:", err);
    } finally {
      setSaving(false);
    }
  };

  const categories = ["All", "General", "Work", "Fitness", "Learning", "Academics", "Mindfulness", "Finance", "Social", "Creative", "Errands"];
  const priorities = ["All", "Low", "Normal", "High", "URGENT"];

  return (
    <section className="page dungeon-gate-page">
      <div className="page-header" style={{ marginBottom: 40 }}>
        <div>
          <h2 className="page-title">Dungeon Gates</h2>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '2px' }}>System Portal: Select your next challenge</p>
        </div>
        <div className="flex gap-12">
           <Button variant="secondary" onClick={() => setShowNLP(true)}><Download size={14} /> Import Data</Button>
           <Button variant="primary" onClick={() => { setEditingId(null); setFormData(EMPTY_FORM); setShowModal(true); }}><Plus size={14} /> Found New Gate</Button>
        </div>
      </div>

      <div className="gate-filters-container ds-glass">
         <div className="gate-tab-row">
            {(["active", "pending", "completed"] as const).map(tab => (
              <button 
                key={tab} 
                className={`gate-filter-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.toUpperCase()}
              </button>
            ))}
         </div>
         <div className="gate-select-row">
            <div className="gate-select-group">
               <Filter size={14} />
               <span>CATEGORY</span>
               <select value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                 {categories.map(c => <option key={c} value={c}>{c}</option>)}
               </select>
            </div>
            <div className="gate-select-group">
               <Target size={14} />
               <span>URGENCY</span>
               <select value={prioFilter} onChange={e => setPrioFilter(e.target.value)}>
                 {priorities.map(p => <option key={p} value={p}>{p}</option>)}
               </select>
            </div>
         </div>
      </div>

      {loading ? (
        <div className="panel panel-empty text-muted">Synchronizing with System...</div>
      ) : (
        <div className="gate-grid">
          {filteredTasks.length === 0 ? (
            <div className="panel panel-empty" style={{ gridColumn: '1 / -1' }}>
              <Skull size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
              <p className="text-muted">No gates detected in this sector.</p>
            </div>
          ) : (
            filteredTasks.map(gate => {
              const color = getRankColor(gate.xp_tier || "Low");
              const rank = getRankLetter(gate.xp_tier || "Low");
              const isActive = gate.is_active;
              const isPaused = gate.is_paused;
              
              const getDepth = (gate: any, maxDepth = 5): number => {
                if (maxDepth <= 0 || !gate.subtasks || gate.subtasks.length === 0) return 0;
                return 1 + Math.max(0, ...gate.subtasks.map((s: any) => getDepth(s, maxDepth - 1)));
              };
              const gateDepth = getDepth(gate);
              const isDoubleDungeon = gateDepth >= 2;
              const isRedGate = (gate.xp_tier === "Legendary" || gate.xp_tier === "Super") && gateDepth >= 1;

              return (
                <div 
                  key={gate.id} 
                  className={`gate-card ds-glass ds-aura ${isActive ? 'gate-active' : ''} ${isPaused ? 'gate-paused' : ''} ${isRedGate ? 'gate-red-gate' : ''} ${isDoubleDungeon ? 'gate-double-dungeon' : ''}`} 
                  style={{ '--gate-color': color } as any}
                  onClick={() => setSelectedGate(gate)}
                >
                  <div className="gate-rank-badge" style={{ background: isRedGate ? '#ff4444' : color, border: `1px solid ${isRedGate ? '#ff4444' : color}88` }}>
                    {isRedGate ? 'RED' : gateDepth === 2 ? 'DOUBLE' : gateDepth === 3 ? 'TRIPLE' : gateDepth >= 4 ? 'GOD' : rank}-RANK
                  </div>
                  {isActive && (
                    <div className={`gate-status-badge ${isPaused ? 'paused' : ''}`}>
                      <Activity size={10} className={isPaused ? "" : "animate-pulse"} />
                      {isPaused ? 'RAID PAUSED' : 'RAID IN PROGRESS'}
                      {gate.started_at && !isPaused && <RaidTimer startedAt={gate.started_at} />}
                    </div>
                  )}
                  <div className="gate-energy-pulse" style={{ boxShadow: `0 0 50px ${color}33` }} />
                  
                  <div className="gate-content">
                    <div className="gate-header-row">
                      <span className="gate-category" style={{ color }}>{gate.category}</span>
                      <div className="gate-actions-row">
                        <span className="gate-id">ID: {gate.id.slice(0,6).toUpperCase()}</span>
                        <div className="gate-mini-btn-group">
                          <button className="gate-mini-btn" onClick={(e) => { e.stopPropagation(); handleOpenAdd(gate.id); }} title="Manifest Subtask">
                            <Plus size={12} />
                          </button>
                          <button className="gate-mini-btn" onClick={(e) => { e.stopPropagation(); handleEdit(gate); }} title="Edit Gate">
                            <Edit3 size={12} />
                          </button>
                          <button className="gate-mini-btn delete" onClick={(e) => { e.stopPropagation(); handleDelete(gate.id); }} title="Dismantle Gate">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="gate-title-row">
                      <h3 className="gate-title-text">{gate.title}</h3>
                      {gate.subtasks && gate.subtasks.length > 0 && (
                        <div className="gate-subtask-counter">
                          <Layers size={10} />
                          <span>{gate.subtasks.filter(s => s.is_completed).length}/{gate.subtasks.length}</span>
                        </div>
                      )}
                    </div>
                    <p className="gate-desc">{gate.description || "No mission brief provided by the System."}</p>
                    
                    <div className="gate-footer">
                       <div className="gate-meta-info">
                          <div className="gate-reward">
                             <Zap size={14} style={{ color }} />
                             <span>+{gate.points} XP</span>
                          </div>
                          {(gate.deadline || gate.start_time) && (
                            <div className="gate-time-info">
                               <Clock size={12} />
                               <span>
                                 {gate.deadline ? new Date(gate.deadline).toLocaleDateString() : ""}
                                 {gate.start_time ? ` @ ${gate.start_time}` : ""}
                               </span>
                            </div>
                          )}
                       </div>
                       <div className="gate-action-hint" style={{ color }}>
                          SCAN BRIEF <ChevronRight size={14} />
                       </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Briefing Modal */}
      <Modal
        isOpen={!!selectedGate}
        title="Mission Briefing"
        onClose={() => setSelectedGate(null)}
        footer={
          <div className="brief-actions-v3" style={{ display: 'flex', gap: 12, width: '100%' }}>
            {selectedGate?.is_active ? (
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                {(() => {
                  const hasSubtasks = selectedGate.subtasks && selectedGate.subtasks.length > 0;
                  const allDone = hasSubtasks && selectedGate.subtasks.every((s: any) => s.is_completed);
                  const isLocked = hasSubtasks && !allDone;

                  return (
                    <Button 
                      variant={isLocked ? "secondary" : "primary"} 
                      disabled={saving || isLocked}
                      className="brief-btn-v3 conquer" 
                      onClick={() => handleComplete(selectedGate.id)}
                      style={{ 
                        flex: 2, 
                        background: isLocked ? 'rgba(255,204,0,0.1)' : 'var(--destruction-red)',
                        color: isLocked ? '#ffcc00' : '#fff',
                        border: isLocked ? '1px solid #ffcc0044' : 'none',
                        opacity: isLocked ? 0.7 : 1
                      }}
                    >
                      {saving ? 'PROCESSING...' : isLocked ? 'BOSS SHIELD ACTIVE' : 'ELIMINATE BOSS'}
                    </Button>
                  );
                })()}
                {selectedGate.is_paused ? (
                  <Button 
                    variant="primary" 
                    className="brief-btn-v3" 
                    onClick={() => handleResumeRaid(selectedGate.id)}
                    style={{ flex: 1 }}
                  >
                    RESUME RAID
                  </Button>
                ) : (
                  <Button 
                    variant="secondary" 
                    className="brief-btn-v3" 
                    onClick={() => handlePauseRaid(selectedGate.id)}
                    style={{ flex: 1 }}
                  >
                    PAUSE RAID
                  </Button>
                )}
                <Button 
                  variant="secondary" 
                  className="brief-btn-v3" 
                  onClick={() => handleResetRaid(selectedGate.id)}
                  style={{ flex: 0.5, minWidth: 50 }}
                  title="Restart Timer"
                >
                  RESTART
                </Button>
              </div>
            ) : !selectedGate?.is_completed ? (
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <Button variant="secondary" onClick={() => setSelectedGate(null)} style={{ flex: 1, opacity: 0.7 }}>
                  ABORT BRIEFING
                </Button>
                <Button 
                  variant="primary" 
                  disabled={saving}
                  onClick={() => handleStartRaid(selectedGate!.id)}
                  style={{ 
                    flex: 2,
                    background: getRankColor(selectedGate?.xp_tier || "Low"),
                    fontWeight: 900,
                    boxShadow: `0 0 25px ${getRankColor(selectedGate?.xp_tier || "Low")}44`,
                    color: '#fff'
                  }}
                >
                  {saving ? 'INITIALIZING...' : 'INITIALIZE RAID'}
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <Button variant="secondary" onClick={() => setSelectedGate(null)} style={{ flex: 1, opacity: 0.7 }}>
                  CLOSE BRIEFING
                </Button>
                <Button variant="secondary" onClick={() => handleReactivate(selectedGate!.id)} style={{ flex: 1, gap: 8 }}>
                  <RefreshCw size={14} /> RE-MANIFEST GATE
                </Button>
              </div>
            )}
          </div>
        }
      >
        {selectedGate && (
          <div className="gate-details-v3">
            <div className="brief-header-v3">
               <div className="brief-rank-v3" style={{ 
                 borderColor: getRankColor(selectedGate.xp_tier || "Low"),
                 boxShadow: `0 0 30px ${getRankColor(selectedGate.xp_tier || "Low")}44`
               }}>
                 {getRankLetter(selectedGate.xp_tier || "Low")}
                 <span>RANK</span>
               </div>
               <div className="brief-meta-v3">
                 <div className="brief-path">{selectedGate.category} // SYSTEM MISSION</div>
                 <h3 className="brief-title-v3">{selectedGate.title}</h3>
                 <div className="brief-urgency" style={{ 
                   color: selectedGate.priority === 'URGENT' ? 'var(--destruction-red)' : 'var(--accent-primary)' 
                 }}>
                   <Target size={12} /> {selectedGate.priority} URGENCY DETECTED
                 </div>
               </div>
            </div>
            
            <div className="brief-desc-box-v3 ds-glass">
              <div className="box-label">MISSION OBJECTIVE</div>
              <p>{selectedGate.description || "No specific instructions provided. Hunter intuition and tactical execution required for survival."}</p>
            </div>

            {(() => {
              const hasSubtasks = selectedGate.subtasks && selectedGate.subtasks.length > 0;
              const allDone = hasSubtasks && selectedGate.subtasks.every((s: any) => s.is_completed);
              if (hasSubtasks && !allDone) {
                return (
                  <div className="boss-warning-v3 ds-glass animate-pulse">
                    <Skull size={20} />
                    <div>
                      <strong>BOSS MONSTER DETECTED</strong>
                      <p>Shield is active. Eradicate all nested objectives to expose the dungeon core.</p>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            <div className="brief-subtasks-v3 ds-glass">
              <div className="box-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>NESTED OBJECTIVES (HIDDEN DUNGEONS)</span>
                <Button variant="secondary" size="sm" onClick={() => handleOpenAdd(selectedGate.id)} style={{ padding: '2px 8px', fontSize: '0.6rem' }}>
                  <Plus size={10} /> MANIFEST
                </Button>
              </div>
              {selectedGate.subtasks && selectedGate.subtasks.length > 0 ? (
                <div className="subtask-list-v3">
                  {selectedGate.subtasks?.map((sub: any) => (
                    <div key={sub.id} className="subtask-item-v3">
                      <div className={`subtask-status-v3 ${sub.is_completed ? 'completed' : ''}`} />
                      <div className="subtask-info-v3">
                        <span className="subtask-title-v3">{sub.title}</span>
                        {sub.subtasks && sub.subtasks.length > 0 && (
                          <span className="subtask-double-badge">DOUBLE DUNGEON DETECTED</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="subtask-xp-v3">+{sub.points} XP</span>
                        {!sub.is_completed && (
                          <div className="flex gap-4">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => handleOpenAdd(sub.id)}
                              style={{ padding: '4px 8px' }}
                              title="Manifest Nested Objective"
                            >
                              <Plus size={12} />
                            </Button>
                            <Button 
                              variant="success" 
                              size="sm" 
                              onClick={() => handleComplete(sub.id)}
                              style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 900 }}
                            >
                              ERADICATE
                            </Button>
                          </div>
                        )}
                        {sub.is_completed && (
                          <div className="flex items-center gap-2">
                            <span style={{ color: '#34d399', fontSize: '0.65rem', fontWeight: 900 }}>CLEARED</span>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => handleReactivate(sub.id)}
                              style={{ padding: '2px 8px', fontSize: '0.55rem', fontWeight: 700, opacity: 0.6 }}
                              title="Undo Eradication"
                            >
                              <RotateCcw size={10} /> UNDO
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '0.7rem', opacity: 0.5 }}>
                  No sub-objectives detected for this gate.
                </div>
              )}
            </div>

            <div className="brief-grid-v3">
              <div className="brief-stat-card">
                <div className="stat-icon-v3" style={{ color: getRankColor(selectedGate.xp_tier || "Low") }}><Zap size={18} /></div>
                <div className="stat-meta-v3">
                  <span className="stat-label-v3">MANA REWARD</span>
                  <strong className="stat-val-v3">+{selectedGate.points} XP</strong>
                </div>
              </div>
              <div className="brief-stat-card">
                <div className="stat-icon-v3" style={{ color: "#a8a8ff" }}><CalendarDays size={18} /></div>
                <div className="stat-meta-v3">
                  <span className="stat-label-v3">WINDOW / DEADLINE</span>
                  <strong className="stat-val-v3">
                    {selectedGate.start_time ? `${selectedGate.start_time} - ${selectedGate.end_time || '??'}` : (selectedGate.deadline ? new Date(selectedGate.deadline).toLocaleDateString() : "ETERNAL")}
                  </strong>
                </div>
              </div>
              <div className="brief-stat-card">
                <div className="stat-icon-v3" style={{ color: selectedGate.is_active ? "var(--destruction-red)" : "#34d399" }}>
                   {selectedGate.is_active ? <Activity size={18} className="animate-pulse" /> : <Shield size={18} />}
                </div>
                <div className="stat-meta-v3">
                  <span className="stat-label-v3">{selectedGate.is_active ? "TIME ELAPSED" : "STATUS"}</span>
                  <strong className="stat-val-v3">
                    {selectedGate.is_active && selectedGate.started_at ? <RaidTimer startedAt={selectedGate.started_at} /> : "READY"}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Creation Modal */}
      <Modal
        isOpen={showModal}
        title={
          editingId 
            ? "Reconfigure Dungeon Gate" 
            : formData.parentId 
              ? `Manifest Sub-Objective for: ${findTaskById(tasks, formData.parentId)?.title || "Gate"}`
              : "Initialize New Dungeon Gate"
        }
        onClose={() => { setShowModal(false); setEditingId(null); setFormData(EMPTY_FORM); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowModal(false); setEditingId(null); setFormData(EMPTY_FORM); }}>Abort</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>{editingId ? "Update Gate" : "Manifest Gate"}</Button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Gate Mission (Title)</label>
          <input className="form-input" placeholder="e.g. Conquer the 5km Run" value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              {categories.filter(c => c !== "All").map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mana Rank (XP Tier)</label>
            <select className="form-select" value={formData.xp_tier} onChange={e => setFormData({ ...formData, xp_tier: e.target.value })}>
              <option value="Low">E-Rank (+10 XP)</option>
              <option value="Mid">C-Rank (+25 XP)</option>
              <option value="High">B-Rank (+50 XP)</option>
              <option value="Super">A-Rank (+100 XP)</option>
              <option value="Legendary">S-Rank (+250 XP)</option>
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Expiration Date</label>
            <input type="date" className="form-input" value={formData.deadline}
              onChange={e => setFormData({ ...formData, deadline: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Urgency</label>
            <select className="form-select" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
              {priorities.filter(p => p !== "All").map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Start Time</label>
            <input type="time" className="form-input" value={formData.start_time}
              onChange={e => setFormData({ ...formData, start_time: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">End Time</label>
            <input type="time" className="form-input" value={formData.end_time}
              onChange={e => setFormData({ ...formData, end_time: e.target.value })} />
          </div>
        </div>

        <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, marginTop: 4 }}>
          <input 
            type="checkbox" 
            id="recurring_gate" 
            checked={formData.is_recurring} 
            onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })}
            style={{ width: 16, height: 16, accentColor: "#a8a8ff" }}
          />
          <label htmlFor="recurring_gate" className="form-label" style={{ margin: 0, cursor: "pointer" }}>
            Daily Routine (Auto-reset every day)
          </label>
        </div>

        <div className="form-group">
          <label className="form-label">Mission Brief (Description)</label>
          <textarea className="form-textarea" rows={3} value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })} />
        </div>
      </Modal>

      <NLPImportModal isOpen={showNLP} onClose={() => setShowNLP(false)} onTasksCreate={() => fetchQuests()} />

      <style>{`
        .gate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 24px; }
        .gate-card {
          position: relative; border-radius: var(--r-xl); overflow: hidden; height: 260px;
          background: rgba(10, 10, 15, 0.6); border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          cursor: pointer;
        }
        .gate-card:hover { transform: translateY(-8px) scale(1.01); border-color: var(--gate-color); }
        .gate-active { border-color: var(--destruction-red) !important; box-shadow: 0 0 30px var(--destruction-red-glow); }
        
        .gate-rank-badge {
          position: absolute; top: 20px; left: 20px; padding: 4px 12px;
          font-size: 0.65rem; font-weight: 900; border-radius: 6px; color: #000;
          z-index: 2; letter-spacing: 1px;
        }
        .gate-status-badge {
          position: absolute; top: 20px; right: 20px; padding: 6px 12px;
          font-size: 0.6rem; font-weight: 900; border-radius: 6px; color: #fff;
          background: var(--destruction-red); z-index: 2; letter-spacing: 1px;
          display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
          box-shadow: 0 0 15px var(--destruction-red-glow);
        }
        .raid-timer-val { font-family: monospace; font-size: 0.75rem; opacity: 0.9; }
        .gate-energy-pulse {
          position: absolute; top: -50px; right: -50px; width: 200px; height: 200px;
          border-radius: 50%; opacity: 0.1; transition: 0.4s;
        }
        .gate-card:hover .gate-energy-pulse { opacity: 0.3; transform: scale(1.2); }
        
        .gate-content { position: relative; z-index: 2; padding: 60px 24px 24px; height: 100%; display: flex; flex-direction: column; }
        .gate-header-row { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .gate-category { font-size: 0.65rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.8; }
        .gate-id { font-size: 0.55rem; color: var(--t4); font-family: monospace; opacity: 0.5; }
        
        .gate-title-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .gate-title-text { font-size: 1.3rem; font-weight: 900; color: var(--t1); margin: 0; line-height: 1.2; flex: 1; }
        .gate-subtask-counter {
          display: flex; align-items: center; gap: 4px; font-size: 0.65rem; font-weight: 900;
          color: var(--accent-primary); background: rgba(168,168,255,0.1);
          padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(168,168,255,0.2);
          white-space: nowrap; margin-left: 10px;
        }
        
        .gate-desc { font-size: 0.8rem; color: var(--t3); line-height: 1.5; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .gate-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
        .gate-meta-info { display: flex; flex-direction: column; gap: 4px; }
        .gate-reward { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 800; color: var(--t2); }
        .stat-val-v3 { font-size: 0.85rem; color: #fff; font-weight: 800; }
        .stat-label-v3 { font-size: 0.55rem; font-weight: 900; opacity: 0.3; letter-spacing: 1px; margin-bottom: 2px; }
        
        .gate-actions-row { display: flex; align-items: center; gap: 10px; }
        .gate-mini-btn-group { display: flex; gap: 6px; align-items: center; }
        .gate-mini-btn {
          background: rgba(168,168,255,0.08); border: 1px solid rgba(168,168,255,0.15);
          color: var(--accent-primary); padding: 5px; border-radius: 6px; cursor: pointer;
          transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center;
        }
        .gate-mini-btn:hover { background: var(--accent-primary); color: #000; transform: scale(1.1); box-shadow: 0 0 15px var(--accent-glow); }
        .gate-mini-btn.delete:hover { background: #ef4444; color: #fff; border-color: #ef4444; box-shadow: 0 0 15px rgba(239, 68, 68, 0.4); }

        .gate-filters-container {
          margin-bottom: 32px; padding: 12px; border-radius: var(--r-lg);
          display: flex; flex-direction: column; gap: 12px;
        }
        .gate-tab-row { display: flex; gap: 8px; }
        .gate-select-row { display: flex; gap: 24px; padding: 0 12px; }
        .gate-select-group { display: flex; align-items: center; gap: 10px; }
        .gate-select-group span { font-size: 0.6rem; font-weight: 900; opacity: 0.4; letter-spacing: 1px; }
        .gate-select-group select {
           background: transparent; border: none; color: #fff; font-size: 0.75rem; font-weight: 800; cursor: pointer;
           outline: none;
        }

        /* Double Dungeon & Red Gate Effects */
        .gate-double-dungeon {
          border-left: 3px solid var(--accent-primary) !important;
        }
        
        .gate-red-gate {
          border-color: #ff4444 !important;
          animation: red-glitch-gate 4s infinite;
        }
        
        .gate-red-gate::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,68,68,0.1) 0%, transparent 50%);
          z-index: 1;
          pointer-events: none;
        }

        @keyframes red-glitch-gate {
          0%, 100% { box-shadow: 0 0 20px rgba(255,68,68,0.1); }
          50% { box-shadow: 0 0 40px rgba(255,68,68,0.3); }
        }

        .brief-subtasks-v3 {
          padding: 20px;
          background: rgba(168,168,255,0.03);
          border-radius: var(--r-lg);
          border: 1px solid rgba(168,168,255,0.08);
        }
        
        .subtask-list-v3 {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 8px;
        }
        
        .subtask-item-v3 {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px;
          background: rgba(255,255,255,0.02);
          border-radius: 8px;
        }
        
        .subtask-status-v3 {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .subtask-status-v3.completed {
          background: var(--accent-primary);
          box-shadow: 0 0 8px var(--accent-primary);
        }
        
        .subtask-info-v3 {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .subtask-title-v3 {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--t2);
        }
        
        .subtask-double-badge {
          font-size: 0.55rem;
          font-weight: 900;
          color: var(--accent-primary);
          letter-spacing: 1px;
        }
        
        .subtask-xp-v3 {
          font-size: 0.75rem;
          font-weight: 800;
          color: var(--t3);
          opacity: 0.8;
        }

        .gate-filter-btn {
          background: transparent; border: none; color: var(--t3);
          font-size: 0.65rem; font-weight: 800; letter-spacing: 1px;
          padding: 8px 16px; border-radius: 10px; transition: 0.2s;
        }
        .gate-filter-btn.active { background: rgba(255,255,255,0.06); color: var(--accent-primary); }

        /* DETAILS MODAL V3 */
        .gate-details-v3 { display: flex; flex-direction: column; gap: 28px; padding-bottom: 12px; }
        .brief-header-v3 { display: flex; align-items: center; gap: 24px; }
        .brief-rank-v3 {
           width: 80px; height: 80px; border-radius: var(--r-md); border: 3px solid;
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           font-size: 2rem; font-weight: 900; background: rgba(0,0,0,0.4);
           line-height: 1;
        }
        .brief-rank-v3 span { font-size: 0.6rem; opacity: 0.5; letter-spacing: 2px; margin-top: 4px; }
        
        .brief-meta-v3 { flex: 1; }
        .brief-path { font-size: 0.65rem; font-weight: 900; opacity: 0.3; letter-spacing: 2px; margin-bottom: 6px; }
        .brief-title-v3 { font-size: 1.6rem; font-weight: 900; margin-bottom: 8px; line-height: 1.1; color: #fff; }
        .brief-urgency { font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 6px; letter-spacing: 1px; }

        .brief-desc-box-v3 { padding: 24px; border-radius: var(--r-lg); background: rgba(255,255,255,0.02); }
        .box-label { font-size: 0.6rem; font-weight: 900; opacity: 0.3; letter-spacing: 2px; margin-bottom: 12px; }
        .brief-desc-box-v3 p { font-size: 0.95rem; line-height: 1.6; color: var(--t2); }

        .brief-grid-v3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .brief-stat-card {
           padding: 18px; background: rgba(255,255,255,0.03); border-radius: var(--r-md);
           display: flex; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,0.05);
        }
        .stat-icon-v3 { width: 40px; height: 40px; border-radius: 10px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-meta-v3 { display: flex; flex-direction: column; }
        .stat-label-v3 { font-size: 0.55rem; font-weight: 900; opacity: 0.3; letter-spacing: 1px; margin-bottom: 2px; }
        .stat-val-v3 { font-size: 0.85rem; color: #fff; font-weight: 800; }
        
        .boss-warning-v3 {
          margin: 16px 0; padding: 16px; border-left: 4px solid var(--destruction-red);
          display: flex; gap: 16px; align-items: center; color: var(--destruction-red);
          background: rgba(239, 68, 68, 0.08); border-radius: var(--r-md);
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .boss-warning-v3 strong { display: block; font-size: 0.85rem; letter-spacing: 1.5px; font-weight: 900; }
        .boss-warning-v3 p { font-size: 0.75rem; opacity: 0.8; margin: 4px 0 0 0; line-height: 1.3; }
        
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.6; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}
