import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Edit3 } from "lucide-react";
import { CLASS_TITLES, calcTitle, calcLevel, calcXpProgress, calcRank, nextRankInfo, RANKS } from "../lib/levelEngine";

type Profile = {
  user_id: string;
  name: string;
  bio: string;
  level: number;
  total_points: number;
  player_class: string;
  player_rank: string;
  player_title: string;
  guild_id: string | null;
  clan_id: string | null;
  is_boosted: boolean;
  age?: number;
  weapon_of_choice?: string;
  gear_style?: string;
};

const CLASSES = Object.keys(CLASS_TITLES);

export function ProfilePage() {
  const { user } = useAuth();
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({ 
    name: "", bio: "", player_class: "None", player_title: "Rookie",
    age: 0, weapon_of_choice: "None", gear_style: "Hybrid"
  });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  const fetchProfile = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data: prof } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
    
    if (prof) {
      setProfile(prof);
      setEditData({ 
        name: prof.name, bio: prof.bio, player_class: prof.player_class, player_title: prof.player_title,
        age: prof.age || 0, weapon_of_choice: prof.weapon_of_choice || "None", gear_style: prof.gear_style || "Hybrid"
      });
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);

  const handleCreateProfile = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    const { data } = await supabase.from("user_profiles").insert({
      user_id: user.id,
      name: user.email?.split("@")[0] || "Hunter",
      player_class: "Warrior",
      player_rank: "E",
      age: 18,
      weapon_of_choice: "Starter Blade",
      gear_style: "Modern"
    }).select().single();
    if (data) setProfile(data);
    setSaving(false);
  };

  const handleSave = async () => {
    if (!supabase || !user || !editData.name.trim()) return;
    setSaving(true);
    const newLevel = calcLevel(profile?.total_points || 0);
    const newRank  = calcRank(newLevel);
    const newTitle = calcTitle(editData.player_class, profile?.total_points || 0);
    const { data } = await supabase
      .from("user_profiles")
      .update({ 
        name: editData.name, 
        bio: editData.bio, 
        player_class: editData.player_class, 
        player_title: newTitle,
        player_rank: newRank,
        level: newLevel,
        age: editData.age,
        weapon_of_choice: editData.weapon_of_choice,
        gear_style: editData.gear_style
      })
      .eq("user_id", user.id)
      .select()
      .single();
    if (data) setProfile(data);
    setSaving(false);
    setShowEdit(false);
  };

  const navigate = useNavigate();

  if (loading) return <section className="page"><div className="panel panel-empty text-muted text-sm">Synchronizing with System…</div></section>;
  
  if (!profile) return (
    <section className="page">
      <article className="panel panel-empty">
        <h2>No Hunter Record Found</h2>
        <p className="text-muted text-sm mb-16">Your existence has not been registered in the system yet.</p>
        <Button variant="primary" onClick={handleCreateProfile} disabled={saving}>{saving ? "Registering…" : "Register Profile"}</Button>
      </article>
    </section>
  );

  const computedLevel = calcLevel(profile.total_points);
  const xpPct   = calcXpProgress(profile.total_points);
  const initial = profile.name.charAt(0).toUpperCase();
  const nextRank = nextRankInfo(profile.player_rank);

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Ranker Profile</h2>
        <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
          <Edit3 size={13} /> Update Status
        </Button>
      </div>

      <div className="profile-header rpg-card">
        <div className="profile-avatar">{initial}</div>
        <div className="profile-content-flex">
          <div className="profile-name">
            {profile.name} <span className="rank-tag" style={{ border: "1px solid var(--border-1)", padding: "2px 6px", borderRadius: 4 }}>{profile.player_rank}</span>
          </div>
          <div className="profile-title-tag" style={{ color: "var(--t1)", opacity: 0.8 }}>{profile.player_title}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <span className="level-badge">LVL {profile.level}</span>
            <span className="class-badge" style={{ background: "rgba(255,255,255,0.08)", color: "#fff" }}>{profile.player_class}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{
              fontFamily: "monospace", fontSize: "0.68rem", letterSpacing: "0.1em",
              color: "rgba(168,168,255,0.7)", background: "rgba(168,168,255,0.08)",
              border: "1px solid rgba(168,168,255,0.18)", padding: "2px 8px", borderRadius: 6,
            }}>
              Hunter ID: {profile.user_id.slice(0, 8).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="profile-stats-right">
          <div className="profile-stat-label">Total Mana</div>
          <div className="profile-stat-value">{profile.total_points.toLocaleString()}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <article className="panel">
          <h2>Clan / Guild</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 80, justifyContent: "center", alignItems: "center" }}>
             {profile.clan_id || profile.guild_id ? (
               <>
                 <p className="text-sm font-600">Active Duty in {profile.clan_id ? "Clan" : "Guild"}</p>
                 <Button variant="secondary" size="sm" onClick={() => navigate("/arena")}>Open Arena Hub</Button>
               </>
             ) : (
               <>
                 <p className="text-muted text-xs">Unbound Hunter Status</p>
                 <Button variant="secondary" size="sm" onClick={() => navigate("/arena")}>Join Arena</Button>
               </>
             )}
          </div>
        </article>
        <article className="panel">
          <h2>System Inventory</h2>
          <div className="inventory-grid">
            {[{type: 'TASK_SKIP', icon: '⚡', name: 'Skip'}, {type: 'XP_BOOST', icon: '🔥', name: 'Boost'}, {type: 'CHALLENGE_KEY', icon: '🔑', name: 'Key'}].map(item => (
              <div key={item.type} className="item-slot">
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span className="text-muted" style={{ fontSize: '0.6rem', marginTop: 4 }}>{item.name}</span>
                <span className="item-count">0</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <article className="panel">
        <h2>Rank Progression</h2>
        <div className="profile-level-header">
          <span>{profile.total_points.toLocaleString()} / {(computedLevel * 500).toLocaleString()} XP · Lv.{computedLevel}</span>
          <span className="text-muted">
            {nextRank ? `Rank Up: ${profile.player_rank} → ${nextRank.rank} (at Lv.${nextRank.minLevel})` : `${profile.player_rank}-Rank (MAX)`}
          </span>
        </div>
        <div className="progress-track progress-track-thick">
          <div className="progress-fill" style={{ width: `${xpPct}%` }} />
        </div>
      </article>

      <Modal
        isOpen={showEdit}
        title="Hunter Re-Evaluation"
        onClose={() => setShowEdit(false)}
        footer={<><Button variant="secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
                 <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Evaluating…" : "Update Record"}</Button></>}
      >
        <div className="form-group">
          <label className="form-label">Hunter Alias</label>
          <input className="form-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Age</label>
            <input type="number" className="form-input" value={editData.age} onChange={e => setEditData({ ...editData, age: parseInt(e.target.value) })} />
          </div>
          <div className="form-group">
            <label className="form-label">Chosen Class</label>
            <select className="form-select" value={editData.player_class} onChange={e => setEditData({ ...editData, player_class: e.target.value })}>
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Weapon of Choice</label>
            <input className="form-input" value={editData.weapon_of_choice} onChange={e => setEditData({ ...editData, weapon_of_choice: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Gear Style</label>
            <select className="form-select" value={editData.gear_style} onChange={e => setEditData({ ...editData, gear_style: e.target.value })}>
              <option>Modern</option>
              <option>Medieval</option>
              <option>Hybrid</option>
              <option>Cybernetic</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Personal Directive (Bio)</label>
          <textarea className="form-textarea" value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} />
        </div>
      </Modal>
    </section>
  );
}
