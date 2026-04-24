import { useEffect, useState, useMemo } from "react";
import { Modal }          from "../components/Modal";
import { Button }         from "../components/Button";
import type { DBTask }    from "../components/QuestItem";
import { NLPImportModal } from "../components/NLPImportModal";
import { Plus, Download, Shield, Zap, Skull, ChevronRight, Filter, Target, CalendarDays, Activity } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth }  from "../lib/authContext";
import { syncProgression, showProgressionToast, applyXpBoost } from "../lib/levelEngine";
import { RaidTimer } from "../components/RaidTimer";

const EMPTY_FORM = {
  title: "", category: "General", description: "",
  deadline: "", time: "", priority: "Normal", xp_tier: "Low", parentId: null as string | null,
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
  const [saving,       setSaving]       = useState(false);

  // Filters & Details
  const [catFilter,    setCatFilter]    = useState("All");
  const [prioFilter,   setPrioFilter]   = useState("All");
  const [selectedGate, setSelectedGate] = useState<DBTask | null>(null);

  const fetchQuests = async () => {
    if (!supabase || !user?.id) return;
    setLoading(true);
    const { data } = await supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (data) {
       setTasks(data.map(t => ({ ...t, subtasks: [] })));
    }
    setLoading(false);
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
      const payload = {
        user_id: user.id,
        assigned_to: user.id,
        title: formData.title,
        category: formData.category,
        points: getXpByTier(formData.xp_tier),
        description: formData.description,
        deadline: formData.deadline || null,
        time: formData.time || null,
        priority: formData.priority,
        xp_tier: formData.xp_tier,
        is_recurring: formData.is_recurring,
        is_active: false,
        is_completed: false
      };

      const { error } = await supabase.from("tasks").insert(payload);
      if (error) throw error;
      
      await fetchQuests();
      setShowModal(false);
      setFormData(EMPTY_FORM);
    } catch (err) {
      console.error("Error manifesting gate:", err);
    } finally {
      setSaving(false);
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

  const handleComplete = async (id: string) => {
    if (!supabase || !user) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;

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
      
      await fetchQuests();
      setSelectedGate(null);
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
           <Button variant="primary" onClick={() => setShowModal(true)}><Plus size={14} /> Found New Gate</Button>
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

              return (
                <div 
                  key={gate.id} 
                  className={`gate-card ds-glass ds-aura ${isActive ? 'gate-active' : ''}`} 
                  style={{ '--gate-color': color } as any}
                  onClick={() => setSelectedGate(gate)}
                >
                  <div className="gate-rank-badge" style={{ background: color, border: `1px solid ${color}88` }}>{rank}-RANK</div>
                  {isActive && (
                    <div className="gate-status-badge">
                      <Activity size={10} />
                      RAID IN PROGRESS
                      {gate.started_at && <RaidTimer startedAt={gate.started_at} />}
                    </div>
                  )}
                  <div className="gate-energy-pulse" style={{ boxShadow: `0 0 50px ${color}33` }} />
                  
                  <div className="gate-content">
                    <div className="gate-header-row">
                      <span className="gate-category" style={{ color }}>{gate.category}</span>
                      <span className="gate-id">ID: {gate.id.slice(0,6).toUpperCase()}</span>
                    </div>
                    <h3 className="gate-title-text">{gate.title}</h3>
                    <p className="gate-desc">{gate.description || "No mission brief provided by the System."}</p>
                    
                    <div className="gate-footer">
                       <div className="gate-reward">
                          <Zap size={14} style={{ color }} />
                          <span>+{gate.points} XP</span>
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
          <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setSelectedGate(null)} style={{ opacity: 0.7 }}>Abort Briefing</Button>
            {!selectedGate?.is_completed && (
              <Button 
                variant="primary" 
                disabled={saving}
                onClick={() => {
                  if (selectedGate?.is_active) handleComplete(selectedGate.id);
                  else if (selectedGate) handleStartRaid(selectedGate.id);
                }}
                style={{ 
                  minWidth: 160,
                  background: selectedGate?.is_active ? 'var(--destruction-red)' : getRankColor(selectedGate?.xp_tier || "Low"),
                  color: selectedGate?.is_active ? '#fff' : '#fff',
                  fontWeight: 900,
                  boxShadow: selectedGate?.is_active 
                    ? '0 0 25px rgba(239, 68, 68, 0.4)' 
                    : `0 0 25px ${getRankColor(selectedGate?.xp_tier || "Low")}44`
                }}
              >
                {saving ? 'PROCESSING...' : selectedGate?.is_active ? 'CONQUER GATE' : 'START RAID'}
              </Button>
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
                  <span className="stat-label-v3">DEADLINE</span>
                  <strong className="stat-val-v3">{selectedGate.deadline ? new Date(selectedGate.deadline).toLocaleDateString() : "ETERNAL"}</strong>
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
        title="Initialize New Dungeon Gate"
        onClose={() => { setShowModal(false); setFormData(EMPTY_FORM); }}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowModal(false); setFormData(EMPTY_FORM); }}>Abort</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>Manifest Gate</Button>
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
          position: relative; border-radius: 24px; overflow: hidden; height: 260px;
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
        .gate-title-text { font-size: 1.3rem; font-weight: 900; color: var(--t1); margin-bottom: 8px; line-height: 1.2; }
        .gate-desc { font-size: 0.8rem; color: var(--t3); line-height: 1.5; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .gate-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; }
        .gate-reward { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 800; color: var(--t2); }
        .gate-action-hint { font-size: 0.65rem; font-weight: 900; letter-spacing: 1.5px; display: flex; align-items: center; gap: 4px; }

        .gate-filters-container {
          margin-bottom: 32px; padding: 12px; border-radius: 20px;
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
           width: 80px; height: 80px; border-radius: 20px; border: 3px solid;
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           font-size: 2rem; font-weight: 900; background: rgba(0,0,0,0.4);
           line-height: 1;
        }
        .brief-rank-v3 span { font-size: 0.6rem; opacity: 0.5; letter-spacing: 2px; margin-top: 4px; }
        
        .brief-meta-v3 { flex: 1; }
        .brief-path { font-size: 0.65rem; font-weight: 900; opacity: 0.3; letter-spacing: 2px; margin-bottom: 6px; }
        .brief-title-v3 { font-size: 1.6rem; font-weight: 900; margin-bottom: 8px; line-height: 1.1; color: #fff; }
        .brief-urgency { font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 6px; letter-spacing: 1px; }

        .brief-desc-box-v3 { padding: 24px; border-radius: 20px; background: rgba(255,255,255,0.02); }
        .box-label { font-size: 0.6rem; font-weight: 900; opacity: 0.3; letter-spacing: 2px; margin-bottom: 12px; }
        .brief-desc-box-v3 p { font-size: 0.95rem; line-height: 1.6; color: var(--t2); }

        .brief-grid-v3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .brief-stat-card {
           padding: 18px; background: rgba(255,255,255,0.03); border-radius: 16px;
           display: flex; align-items: center; gap: 14px; border: 1px solid rgba(255,255,255,0.05);
        }
        .stat-icon-v3 { width: 40px; height: 40px; border-radius: 10px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .stat-meta-v3 { display: flex; flex-direction: column; }
        .stat-label-v3 { font-size: 0.55rem; font-weight: 900; opacity: 0.3; letter-spacing: 1px; margin-bottom: 2px; }
        .stat-val-v3 { font-size: 0.85rem; color: #fff; font-weight: 800; }
        
        @keyframes pulse {
          0% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0.6; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}
