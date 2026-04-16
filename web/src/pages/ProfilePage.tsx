import { useState } from "react";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { mockCurrentUser } from "../lib/mockData";

const CATS = [
  { name:"Work",     points:820 },
  { name:"Health",   points:440 },
  { name:"Learning", points:320 },
  { name:"Personal", points:260 },
];

export function ProfilePage() {
  const [user, setUser] = useState(mockCurrentUser);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ name: user.name, bio: user.bio });

  const stats = { totalQuests:45, completionRate:87, currentStreak:12, longestStreak:34 };
  const levelProgress  = (user.total_points % 500) / 500;
  const nextLevelXP    = Math.ceil(user.total_points / 500) * 500;

  const handleSave = () => {
    setUser({ ...user, name: editData.name, bio: editData.bio });
    setShowEditModal(false);
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Profile</h2>
        <Button variant="primary" onClick={()=>setShowEditModal(true)}>Edit Profile</Button>
      </div>

      {/* Header card */}
      <div className="profile-header">
        <div className="profile-avatar">{user.name.charAt(0).toUpperCase()}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:"1rem", fontWeight:600, color:"var(--text-primary)", marginBottom:"4px" }}>{user.name}</div>
          <div style={{ fontSize:"0.76rem", color:"var(--text-tertiary)", marginBottom:"4px" }}>{user.email}</div>
          <div style={{ fontSize:"0.78rem", color:"var(--text-secondary)" }}>{user.bio}</div>
          <div style={{ marginTop:"10px" }}>
            <span className="level-badge">⭐ Level {user.level}</span>
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"0.68rem", color:"var(--text-tertiary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>Total XP</div>
          <div style={{ fontSize:"1.6rem", fontWeight:700, color:"var(--text-primary)", letterSpacing:"-0.02em" }}>{user.total_points.toLocaleString()}</div>
        </div>
      </div>

      {/* Level progress */}
      <article className="panel">
        <h2>Level Progress</h2>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.76rem", color:"var(--text-tertiary)", marginBottom:"8px" }}>
          <span>{user.total_points.toLocaleString()} XP</span>
          <span>{nextLevelXP.toLocaleString()} XP (Level {user.level + 1})</span>
        </div>
        <div className="progress-track" style={{ height:"5px" }}>
          <div className="progress-fill" style={{ width:`${levelProgress * 100}%` }}/>
        </div>
      </article>

      {/* Stats */}
      <article className="panel">
        <h2>Statistics</h2>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:"12px" }}>
          {[
            { label:"Total Quests",     value: stats.totalQuests },
            { label:"Completion Rate",  value: `${stats.completionRate}%` },
            { label:"Current Streak",   value: `🔥 ${stats.currentStreak}` },
            { label:"Longest Streak",   value: `🏆 ${stats.longestStreak}` },
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <p className="stat-label">{s.label}</p>
              <h3 className="stat-value" style={{ fontSize:"1.4rem" }}>{s.value}</h3>
            </div>
          ))}
        </div>
      </article>

      {/* Category breakdown */}
      <article className="panel">
        <h2>XP by Category</h2>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {CATS.map(c=>(
            <div key={c.name}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px", fontSize:"0.80rem" }}>
                <span style={{ color:"var(--text-secondary)" }}>{c.name}</span>
                <span style={{ color:"var(--text-primary)", fontWeight:600 }}>{c.points} XP</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width:`${(c.points/820)*100}%`, opacity: 0.9 - CATS.indexOf(c)*0.15 }}/>
              </div>
            </div>
          ))}
        </div>
      </article>

      <PerformanceRadar
        title="Performance Matrix"
        data={[
          { category:"Productivity", value:85, fullMark:100 },
          { category:"Health",       value:72, fullMark:100 },
          { category:"Learning",     value:68, fullMark:100 },
          { category:"Consistency",  value:92, fullMark:100 },
          { category:"Engagement",   value:78, fullMark:100 },
          { category:"Growth",       value:81, fullMark:100 },
        ]}
        height={300}
      />

      <Modal
        isOpen={showEditModal}
        title="Edit Profile"
        onClose={()=>setShowEditModal(false)}
        footer={
          <>
            <Button variant="secondary" onClick={()=>setShowEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>Save Changes</Button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Display Name</label>
          <input className="form-input" value={editData.name} onChange={e=>setEditData({...editData,name:e.target.value})}/>
        </div>
        <div className="form-group">
          <label className="form-label">Bio</label>
          <textarea className="form-textarea" value={editData.bio} onChange={e=>setEditData({...editData,bio:e.target.value})}/>
        </div>
      </Modal>
    </section>
  );
}
