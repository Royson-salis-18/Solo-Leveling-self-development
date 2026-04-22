import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Edit3, Shield, Swords, Zap, Brain, Activity, Calendar, Hash, Sparkles, Medal } from "lucide-react";
import { CLASS_TITLES, calcTitle, calcLevel, calcXpProgress, calcRank, nextRankInfo } from "../lib/levelEngine";

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
  created_at?: string;
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

  // Derived Combat Stats
  const stats = [
    { label: "Strength", icon: Swords, value: computedLevel * 2 + 10, color: "#f87171" },
    { label: "Agility", icon: Zap, value: Math.floor(computedLevel * 1.5) + 8, color: "#60a5fa" },
    { label: "Intelligence", icon: Brain, value: Math.floor(computedLevel * 1.2) + 5, color: "#a78bfa" },
    { label: "Vitality", icon: Activity, value: computedLevel * 2 + 15, color: "#34d399" },
  ];

  return (
    <section className="page" style={{ position: "relative" }}>
      
      {/* ── PROFILE HEADER ── */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="header-icon-ring">
            <Medal size={20} color="var(--accent-primary)" />
          </div>
          <div>
            <h2 className="page-title">Hunter License</h2>
            <p className="text-xs text-muted">Official Association Record</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
          <Edit3 size={13} /> Update Status
        </Button>
      </div>

      <div className="profile-hero panel shadow-aura" style={{ 
        padding: "40px", display: "flex", gap: 40, alignItems: "center",
        background: "rgba(15, 15, 15, 0.7)",
        border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 32, borderRadius: "var(--r-xl)", position: "relative", overflow: "hidden",
        '--rarity-color': 'var(--accent-secondary)'
      } as any}>
        <div className="hero-decor-hex" />
        
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div className="profile-avatar-large" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(10px)" }}>{initial}</div>
          <div className="rank-badge-hero">{profile.player_rank}</div>
        </div>

        <div style={{ flex: 1, zIndex: 1 }}>
          <div className="monarch-label-hero" style={{ color: "var(--accent-secondary)" }}>{profile.player_title}</div>
          <h1 className="profile-hero-name-v2">{profile.name}</h1>
          <div className="hero-tags">
            <span className="hero-tag" style={{ background: "rgba(255,255,255,0.05)" }}>LVL {profile.level}</span>
            <span className="hero-tag-separator">•</span>
            <span className="hero-tag" style={{ background: "rgba(255,255,255,0.05)" }}>{profile.player_class}</span>
            <span className="hero-tag-separator">•</span>
            <span className="hero-tag" style={{ background: "rgba(255,255,255,0.05)" }}>{profile.gear_style} Gear</span>
          </div>
          <p className="profile-bio-v2">
            {profile.bio || "The system is silent. The Monarch's path is yet to be fully revealed."}
          </p>
        </div>

        <div className="hunter-license-card-v2" style={{ background: "rgba(10,10,10,0.8)", borderColor: "rgba(255,255,255,0.1)", borderRadius: "var(--r-lg)" }}>
           <div className="license-id">#{profile.user_id.slice(0,8).toUpperCase()}</div>
           <div className="license-items">
             <div className="lic-item"><Calendar size={11} /> <span>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "2026"}</span></div>
             <div className="lic-item"><Sparkles size={11} /> <span>Sync: {profile.player_rank}-Rank</span></div>
             <div className="lic-item"><Swords size={11} /> <span>{profile.weapon_of_choice}</span></div>
           </div>
        </div>
      </div>

      <div className="profile-grid-main">
        <div className="profile-left-col">
          <article className="panel" style={{ height: "auto", borderRadius: "var(--r-lg)", background: "rgba(15,15,15,0.6)", border: "1px solid rgba(255,255,255,0.05)", backgroundImage: "var(--bg-noise)" }}>
            <h2 className="section-title-alt"><Shield size={14} /> Combat Attributes</h2>
            <div className="stats-combat-grid-v2">
              {stats.map(s => {
                const Icon = s.icon;
                const color = s.label === 'Strength' ? 'var(--accent-red-orc)' : 
                              s.label === 'Agility' ? 'var(--accent-primary)' : 
                              s.label === 'Intelligence' ? 'var(--accent-secondary)' : 
                              '#94a3b8';
                return (
                  <div key={s.label} className="stat-combat-card-v2" style={{ background: "rgba(255, 255, 255, 0.02)", borderRadius: "var(--r-md)", border: "1px solid rgba(255,255,255,0.03)" }}>
                    <div className="stat-icon-wrap" style={{ background: `${color}15`, color: color }}>
                      <Icon size={18} />
                    </div>
                    <div className="stat-details">
                      <div className="stat-label-row">
                        <span className="stat-name">{s.label}</span>
                        <span className="stat-val">{s.value}</span>
                      </div>
                      <div className="stat-energy-track" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div className="stat-energy-fill" style={{ width: `${Math.min(100, s.value)}%`, background: color }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="section-title-alt" style={{ marginTop: 32 }}><Zap size={14} /> Active Skills</h2>
            <div className="skills-grid-v2">
              <div className="skill-chip-v2" style={{ '--skill-color': 'var(--accent-primary)' } as any}>
                <span className="skill-name">Mutilation</span>
                <span className="skill-lv">LV. 4</span>
              </div>
              <div className="skill-chip-v2" style={{ '--skill-color': 'var(--accent-secondary)' } as any}>
                <span className="skill-name">Shadow Extraction</span>
                <span className="skill-lv">MAX</span>
              </div>
              <div className="skill-chip-v2" style={{ '--skill-color': 'var(--accent-red-orc)' } as any}>
                <span className="skill-name">Bloodlust</span>
                <span className="skill-lv">LV. 2</span>
              </div>
            </div>
          </article>
        </div>

        {/* ── RIGHT: SYSTEM STATUS ── */}
        <div className="profile-right-col">
          <article className="panel shadow-aura system-status-panel" style={{ 
            borderRadius: "var(--r-lg)", 
            background: "var(--slate-900)", 
            border: "1px solid var(--border-1)",
            '--rarity-color': 'var(--accent-primary)'
          } as any}>
            <h2 className="section-title-alt"><Zap size={14} /> System Status</h2>
            
            <div className="energy-core-wrap">
              <div className="energy-core" style={{ background: "var(--slate-800)", borderRadius: "50%" }}>
                <div className="energy-ring" style={{ borderTopColor: "var(--accent-primary)" }} />
                <div className="energy-ring energy-ring-slow" style={{ borderTopColor: "var(--accent-secondary)", opacity: 0.5 }} />
                <div className="energy-center">
                  <div className="energy-val">{profile.level}</div>
                  <div className="energy-unit">LEVEL</div>
                </div>
              </div>
              <div className="energy-info">
                 <div className="mana-header">
                   <span>Mana Saturation</span>
                   <span className="mana-pct">{xpPct}%</span>
                 </div>
                 <div className="mana-bar-v2" style={{ background: "var(--slate-800)" }}>
                   <div className="mana-fill-v2" style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, var(--accent-secondary), var(--accent-primary))" }}>
                     <div className="mana-glow-v2" />
                   </div>
                 </div>
                 <div className="mana-footer">
                   {nextRank ? `Next Rank Re-evaluation: Lv.${nextRank.minLevel}` : "Maximum Capacity Reached"}
                 </div>
              </div>
            </div>

            <div className="standing-summary">
              <div className="standing-stat" style={{ borderColor: "var(--border-0)" }}>
                <span className="standing-stat-label">Global Rank</span>
                <span className="standing-stat-val">#1,242</span>
              </div>
              <div className="standing-stat" style={{ borderColor: "var(--border-0)" }}>
                <span className="standing-stat-label">Mana Total</span>
                <span className="standing-stat-val">{profile.total_points.toLocaleString()}</span>
              </div>
              <div className="standing-stat" style={{ borderColor: "var(--border-0)" }}>
                <span className="standing-stat-label">Sync Rate</span>
                <span className="standing-stat-val">94.2%</span>
              </div>
            </div>
          </article>

          <article className="panel" style={{ marginTop: 20, background: "rgba(168,168,255,0.02)" }}>
            <h2 className="section-title-alt"><Hash size={14} /> Active Directive</h2>
            <div className="active-directive-card">
              <div className="directive-tag">PRIORITY: ALPHA</div>
              <p className="directive-text">Continue daily mana accumulation. Hidden gate coordinates will be revealed upon Level 5 saturation.</p>
            </div>
          </article>
        </div>

      </div>

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

      <style>{`
        .monarch-label-hero {
          font-size: 0.7rem; color: var(--accent-primary); font-weight: 800; 
          text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 8px;
        }
        .profile-hero-name-v2 { fontSize: 2.5rem; fontWeight: 900; color: var(--t1); marginBottom: 8px; letterSpacing: -0.02em; }
        .hero-tags { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
        .hero-tag { font-size: 0.75rem; font-weight: 700; color: var(--t2); background: rgba(255,255,255,0.04); padding: 2px 10px; border-radius: 6px; }
        .hero-tag-separator { color: var(--accent-primary); font-size: 0.8rem; opacity: 0.5; }
        .profile-bio-v2 { fontSize: 0.85rem; color: var(--t3); maxWidth: 500px; lineHeight: 1.6; opacity: 0.9; }

        .rank-badge-hero {
          position: absolute; bottom: -6px; right: -6px;
          width: 36px; height: 36px; border-radius: 50%;
          background: #fff; color: #000; font-weight: 900; font-size: 1.1rem;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 15px rgba(255,255,255,0.4); border: 2px solid #000;
        }

        .hunter-license-card-v2 {
          width: 220px; padding: 24px; border-radius: 16px;
          background: rgba(0,0,0,0.6); border: 1px solid rgba(168,168,255,0.15);
          backdrop-filter: blur(10px); display: flex; flex-direction: column; gap: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        .license-id { font-size: 0.85rem; font-weight: 900; color: var(--t1); font-family: monospace; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; }
        .license-items { display: flex; flex-direction: column; gap: 8px; }
        .lic-item { display: flex; align-items: center; gap: 10px; font-size: 0.7rem; color: var(--t3); }
        .lic-item span { font-weight: 600; color: var(--t2); }

        .hero-decor-hex {
          position: absolute; top: -50px; right: -50px; width: 200px; height: 200px;
          background: radial-gradient(circle, var(--accent-primary) 0%, transparent 70%);
          opacity: 0.05; pointer-events: none;
        }

        .profile-avatar-large {
          width: 110px; height: 110px; border-radius: 24px;
          background: var(--glass-3); border: 2px solid var(--accent-primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 3rem; font-weight: 900; color: var(--t1);
          box-shadow: 0 0 40px rgba(168,168,255,0.15);
        }

        .profile-grid-main { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 24px; }
        .section-title-alt { 
          display: flex; align-items: center; gap: 10px; font-size: 0.75rem; 
          font-weight: 800; color: var(--t1); text-transform: uppercase; 
          letter-spacing: 0.05em; margin-bottom: 20px; opacity: 0.9;
        }

        /* Stats Grid v2 */
        .stats-combat-grid-v2 { display: flex; flex-direction: column; gap: 14px; }
        .stat-combat-card-v2 {
          display: flex; align-items: center; gap: 16px; padding: 14px;
          background: rgba(255,255,255,0.02); border: 1px solid var(--border-0); border-radius: 14px;
        }
        .stat-icon-wrap {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
        }
        .stat-details { flex: 1; }
        .stat-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .stat-name { font-size: 0.68rem; font-weight: 800; color: var(--t3); text-transform: uppercase; }
        .stat-val { font-size: 1.2rem; font-weight: 900; color: var(--t1); font-family: 'Inter', monospace; }
        .stat-energy-track { height: 4px; background: rgba(255,255,255,0.04); border-radius: 2px; overflow: hidden; }
        .stat-energy-fill { height: 100%; border-radius: 2px; transition: width 1.2s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* Achievement Badges v2 */
        .badge-grid-horizontal-v2 { display: flex; gap: 14px; flex-wrap: wrap; }
        .achievement-badge-v2 {
          width: 54px; height: 54px; border-radius: 14px;
          background: var(--glass-1); border: 1px solid var(--border-0);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .achievement-badge-v2:not(.locked):hover {
          transform: translateY(-6px) scale(1.1); background: var(--glass-3);
          border-color: var(--accent-primary); box-shadow: 0 10px 25px var(--accent-glow);
        }
        .achievement-badge-v2.locked { opacity: 0.2; filter: grayscale(1); }

        /* System Status v2 */
        .system-status-panel { display: flex; flex-direction: column; gap: 24px; padding: 28px; }
        .energy-core-wrap { display: flex; align-items: center; gap: 24px; }
        .energy-core {
          width: 90px; height: 90px; border-radius: 50%; position: relative;
          background: var(--glass-1); border: 1px solid var(--border-0);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .energy-ring {
          position: absolute; inset: -4px; border-radius: 50%;
          border: 2px solid transparent; animation: spinRing 3s linear infinite;
        }
        .energy-ring-slow { animation: spinRing 6s linear infinite reverse; }
        @keyframes spinRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .energy-center { text-align: center; }
        .energy-val { font-size: 2rem; font-weight: 900; color: var(--t1); line-height: 1; }
        .energy-unit { font-size: 0.55rem; font-weight: 800; color: var(--accent-primary); margin-top: 2px; }

        .energy-info { flex: 1; }
        .mana-header { display: flex; justify-content: space-between; font-size: 0.72rem; font-weight: 700; color: var(--t2); margin-bottom: 10px; }
        .mana-pct { color: var(--accent-primary); }
        .mana-bar-v2 { height: 8px; background: rgba(255,255,255,0.04); border-radius: 4px; overflow: hidden; position: relative; }
        .mana-fill-v2 { 
          height: 100%; background: linear-gradient(90deg, var(--accent-secondary), var(--accent-primary)); 
          border-radius: 4px; position: relative; transition: width 1.5s ease;
        }
        .mana-glow-v2 {
          position: absolute; right: 0; top: 0; bottom: 0; width: 20px;
          background: white; filter: blur(8px); opacity: 0.4;
        }
        .mana-footer { font-size: 0.65rem; color: var(--t4); margin-top: 10px; font-weight: 500; }

        .standing-summary { display: flex; flex-direction: column; gap: 12px; }
        .standing-stat { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-0); }
        .standing-stat:last-child { border: none; }
        .standing-stat-label { font-size: 0.78rem; color: var(--t3); font-weight: 500; }
        .standing-stat-val { font-size: 0.9rem; font-weight: 700; color: var(--t1); font-family: monospace; }

        .directive-tag { font-size: 0.55rem; font-weight: 900; color: #ff6b6b; margin-bottom: 6px; }
        .directive-text { font-size: 0.76rem; color: var(--t2); line-height: 1.5; font-style: italic; }
      `}</style>
    </section>
  );
}

