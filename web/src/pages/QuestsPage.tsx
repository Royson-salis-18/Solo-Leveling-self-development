import { useState } from "react";
import type { Quest } from "../lib/mockData";
import type { ParsedTask } from "../lib/nlpParser";
import { Modal }          from "../components/Modal";
import { Button }         from "../components/Button";
import { QuestItem }      from "../components/QuestItem";
import { NLPImportModal } from "../components/NLPImportModal";
import { mockQuests, mockCompletedQuests } from "../lib/mockData";
import { Plus, Download } from "lucide-react";

export function QuestsPage() {
  const [quests,      setQuests]      = useState<Quest[]>(mockQuests);
  const [completed,   setCompleted]   = useState<Quest[]>(mockCompletedQuests);
  const [showModal,   setShowModal]   = useState(false);
  const [showNLP,     setShowNLP]     = useState(false);
  const [activeTab,   setActiveTab]   = useState<"active" | "completed">("active");
  const [formData,    setFormData]    = useState({ title:"", category:"General", points:50, description:"" });

  const handleAdd = () => {
    if (!formData.title.trim()) return;
    const q: Quest = {
      id: `q${Date.now()}`,
      title: formData.title,
      category: formData.category,
      points: formData.points,
      description: formData.description,
      deadline: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    };
    setQuests([q, ...quests]);
    setFormData({ title:"", category:"General", points:50, description:"" });
    setShowModal(false);
  };

  const handleComplete = (id: string) => {
    const q = quests.find(x => x.id === id);
    if (!q) return;
    setQuests(quests.filter(x => x.id !== id));
    setCompleted([{ ...q, completed_at: new Date().toISOString() }, ...completed]);
  };

  const handleDelete = (id: string) => setQuests(quests.filter(x => x.id !== id));

  const handleNLP = (tasks: ParsedTask[]) => {
    const newQ: Quest[] = tasks.map(t => ({
      id: `q${Date.now()}-${Math.random()}`,
      title: t.title, category: t.category,
      points: t.points, description: t.description, deadline: t.deadline,
    }));
    setQuests([...newQ, ...quests]);
  };

  const display = activeTab === "active" ? quests : completed;

  return (
    <section className="page">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Quests</h2>
        <div style={{ display:"flex", gap:8 }}>
          <Button variant="secondary" size="sm" onClick={() => setShowNLP(true)}>
            <Download size={13} /> Import Schedule
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
            <Plus size={13} /> Add Quest
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab${activeTab==="active"?" active":""}`}      onClick={()=>setActiveTab("active")}>
          Active
          <span style={{ marginLeft:5, fontSize:"0.68rem", background:"rgba(255,255,255,0.08)", padding:"1px 6px", borderRadius:99 }}>
            {quests.length}
          </span>
        </div>
        <div className={`tab${activeTab==="completed"?" active":""}`}   onClick={()=>setActiveTab("completed")}>
          Completed
          <span style={{ marginLeft:5, fontSize:"0.68rem", background:"rgba(255,255,255,0.08)", padding:"1px 6px", borderRadius:99 }}>
            {completed.length}
          </span>
        </div>
      </div>

      {/* List */}
      {display.length > 0 ? (
        <article className="panel" style={{ padding:0 }}>
          <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
            {display.map((q, i) => (
              <div key={q.id} style={{ borderBottom: i < display.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <QuestItem
                  quest={q}
                  isCompleted={activeTab === "completed"}
                  onComplete={activeTab === "active" ? handleComplete : undefined}
                  onDelete={activeTab === "active" ? handleDelete : undefined}
                />
              </div>
            ))}
          </div>
        </article>
      ) : (
        <article className="panel" style={{ textAlign:"center", padding:"40px 20px" }}>
          <div style={{ fontSize:"2rem", marginBottom:10, opacity:0.3 }}>✓</div>
          <p style={{ color:"var(--text-tertiary)", fontSize:"0.82rem" }}>
            {activeTab === "active" ? "No active quests. Add one to get started." : "Nothing completed yet. Keep going!"}
          </p>
        </article>
      )}

      {/* Add Quest Modal */}
      <Modal
        isOpen={showModal}
        title="New Quest"
        onClose={() => setShowModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary"   onClick={handleAdd}>Create</Button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" placeholder="e.g. Finish project report" value={formData.title}
            onChange={e => setFormData({...formData, title:e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="form-select" value={formData.category}
            onChange={e => setFormData({...formData, category:e.target.value})}>
            {["General","Work","Health","Learning","Personal"].map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">XP Reward</label>
          <input type="number" min="10" className="form-input" value={formData.points}
            onChange={e => setFormData({...formData, points:parseInt(e.target.value)})} />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" placeholder="Optional details…" value={formData.description}
            onChange={e => setFormData({...formData, description:e.target.value})} />
        </div>
      </Modal>

      <NLPImportModal isOpen={showNLP} onClose={() => setShowNLP(false)} onTasksCreate={handleNLP} />
    </section>
  );
}
