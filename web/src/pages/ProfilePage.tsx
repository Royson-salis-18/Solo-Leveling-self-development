import { useEffect, useState } from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Edit3, Shield, Swords, Zap, Brain, Activity, Medal, Fingerprint, RefreshCw, QrCode, Crosshair, Wind, Flame, Droplet, Skull, Sparkles, Star } from "lucide-react";
import { calcTitle, calcLevel, calcXpProgress, calcRank, nextRankInfo } from "../lib/levelEngine";
import { AuraCard } from "../components/AuraCard";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { PLAYER_CLASSES, PLAYER_JOBS, MONARCHS, SKILL_CATALOG, ITEM_CATALOG } from "../lib/catalog";

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
  strength: number;
  agility: number;
  intelligence: number;
  vitality: number;
  guild_aura_card?: string;
  guild_title?: string;
  guild_logo?: string;
  player_job?: string;
  monarch_allegiance?: string;
};



const getSkillIcon = (type: string, isS: boolean, color: string) => {
  const t = type.toLowerCase();
  if (t.includes('stealth') || t.includes('assassin') || t.includes('shadow')) return <Skull size={16} color={color} />;
  if (t.includes('magic') || t.includes('mana')) return <Sparkles size={16} color={color} />;
  if (t.includes('defense') || t.includes('tank')) return <Shield size={16} color={color} />;
  if (t.includes('lightning') || t.includes('speed') || t.includes('dash')) return <Zap size={16} color={color} />;
  if (t.includes('fire') || t.includes('flame')) return <Flame size={16} color={color} />;
  if (t.includes('wind') || t.includes('air')) return <Wind size={16} color={color} />;
  if (t.includes('water') || t.includes('ice') || t.includes('heal')) return <Droplet size={16} color={color} />;
  if (t.includes('combat') || t.includes('strike')) return <Crosshair size={16} color={color} />;
  return <Star size={16} fill={isS ? "#ffd700" : "transparent"} color={color} />;
};

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    name: "", bio: "", player_class: "Warrior", player_title: "Rookie",
    age: 0, weapon_of_choice: "Starter Blade", gear_style: "Modern",
    strength: 10, agility: 10, intelligence: 10, vitality: 10,
    guild_aura_card: "shadow", guild_title: "", guild_logo: "",
    player_job: "Berserker", monarch_allegiance: "None"
  });
  const [areaStats, setAreaStats] = useState([
    { category: "Work", value: 0, fullMark: 100 },
    { category: "Fitness", value: 0, fullMark: 100 },
    { category: "Learning", value: 0, fullMark: 100 },
    { category: "Mind", value: 0, fullMark: 100 },
    { category: "Social", value: 0, fullMark: 100 },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const fetchProfile = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const [profRes, taskRes] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("tasks").select("category").eq("assigned_to", user.id).eq("is_completed", true)
    ]);

    if (profRes.data) {
      const prof = profRes.data;
      setProfile(prof);
      setEditData({
        name: prof.name, bio: prof.bio,
        player_class: prof.player_class, player_title: prof.player_title,
        age: prof.age || 18,
        weapon_of_choice: prof.weapon_of_choice || "Starter Blade",
        gear_style: prof.gear_style || "Modern",
        strength: prof.strength || 10,
        agility: prof.agility || 10,
        intelligence: prof.intelligence || 10,
        vitality: prof.vitality || 10,
        guild_aura_card: prof.guild_aura_card || "shadow",
        guild_title: prof.guild_title || "",
        guild_logo: prof.guild_logo || "",
        player_job: prof.player_job || (PLAYER_JOBS[prof.player_class]?.[0] || ""),
        monarch_allegiance: prof.monarch_allegiance || "None"
      });

      const tasks = taskRes.data || [];
      const counts: Record<string, number> = { Work: 0, Fitness: 0, Learning: 0, Mind: 0, Social: 0 };
      tasks.forEach(t => {
        if (counts[t.category] !== undefined) counts[t.category] += 1;
        if (t.category === "Academics") counts.Learning += 1;
        if (t.category === "Mindfulness") counts.Mind += 1;
      });

      const cls = prof.player_class?.toLowerCase() || "";
      const weights = { Work: 1.0, Fitness: 1.0, Learning: 1.0, Mind: 1.0, Social: 1.0 };
      if (cls.includes("warrior")) { weights.Fitness = 1.2; weights.Work = 1.1; }
      if (cls.includes("mage")) { weights.Mind = 1.2; weights.Learning = 1.1; }
      if (cls.includes("tank")) { weights.Fitness = 1.3; weights.Social = 1.1; }
      if (cls.includes("assassin")) { weights.Fitness = 1.1; weights.Mind = 1.2; }
      if (cls.includes("healer")) { weights.Social = 1.2; weights.Mind = 1.1; }

      setAreaStats([
        { category: "Work", value: Math.min(100, Math.floor((counts.Work * 5 + 10) * weights.Work)), fullMark: 100 },
        { category: "Fitness", value: Math.min(100, Math.floor((counts.Fitness * 5 + 10) * weights.Fitness)), fullMark: 100 },
        { category: "Learning", value: Math.min(100, Math.floor((counts.Learning * 5 + 10) * weights.Learning)), fullMark: 100 },
        { category: "Mind", value: Math.min(100, Math.floor((counts.Mind * 5 + 10) * weights.Mind)), fullMark: 100 },
        { category: "Social", value: Math.min(100, Math.floor((counts.Social * 5 + 10) * weights.Social)), fullMark: 100 },
      ]);
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
    const newRank = calcRank(newLevel);
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
        gear_style: editData.gear_style,
        strength: editData.strength,
        agility: editData.agility,
        intelligence: editData.intelligence,
        vitality: editData.vitality,
        guild_aura_card: editData.guild_aura_card,
        guild_title: editData.guild_title,
        guild_logo: editData.guild_logo,
        player_job: editData.player_job,
        monarch_allegiance: editData.monarch_allegiance
      })
      .eq("user_id", user.id)
      .select()
      .single();
    if (data) setProfile(data);
    setSaving(false);
    setShowEdit(false);
  };

  if (loading) return (
    <section className="page">
      <div className="panel panel-empty text-muted text-sm">Synchronizing with System…</div>
    </section>
  );

  if (!profile) return (
    <section className="page">
      <article className="panel panel-empty">
        <h2>No Hunter Record Found</h2>
        <p className="text-muted text-sm mb-16">Your existence has not been registered in the system yet.</p>
        <Button variant="primary" onClick={handleCreateProfile} disabled={saving}>
          {saving ? "Registering…" : "Register Profile"}
        </Button>
      </article>
    </section>
  );

  const xpPct = calcXpProgress(profile.total_points);
  const initial = profile.name.charAt(0).toUpperCase();
  const nextRank = nextRankInfo(profile.player_rank);

  const roleClass =
    profile.player_class?.toLowerCase().includes("assassin") ? "role-assassin" :
      profile.player_class?.toLowerCase().includes("mage") ? "role-mage" :
        profile.player_class?.toLowerCase().includes("tank") ? "role-tank" :
          profile.player_class?.toLowerCase().includes("archer") ? "role-archer" :
            profile.player_class?.toLowerCase().includes("warrior") ? "role-warrior" :
              "role-default";

  const stats = [
    { label: "Strength", icon: Swords, value: profile.strength, color: "#ff6b6b" },
    { label: "Agility", icon: Zap, value: profile.agility, color: "var(--frost-blue)" },
    { label: "Intelligence", icon: Brain, value: profile.intelligence, color: "var(--monarch-purple)" },
    { label: "Vitality", icon: Activity, value: profile.vitality, color: "#34d399" },
  ];

  const WEAPONS = ITEM_CATALOG.filter(i => i.item_type === "WEAPON").map(i => ({
    name: i.name,
    rank: i.rarity.replace("-Rank", ""),
    color: (i as any).rarityColor || "#94a3b8",
    type: (i as any).effectType || "shadow"
  }));

  const currentWeapon = WEAPONS.find(w => w.name === profile.weapon_of_choice) || WEAPONS[0];

  const userSkills = SKILL_CATALOG.filter(s => 
    s.required_class === profile.player_class || 
    s.required_monarch === profile.monarch_allegiance ||
    (!s.required_class && !s.required_monarch)
  );

  return (
    <section className={`page profile-page ${roleClass}`}>

      {/* ── PAGE HEADER ── */}
      <div className="pf-page-header">
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Hunter Identity</h2>
          <p className="pf-subtitle">Official System Record • Status: Active</p>
        </div>
        <Button variant="secondary" onClick={() => setShowEdit(true)} style={{ height: 44, borderRadius: 12 }}>
          <Edit3 size={16} /> Re-Evaluate
        </Button>
      </div>

      {/* ── TIER 1: LICENSE + ARMAMENT ── */}
      <div className="pf-tier1">

        {/* LEFT: FLIPPABLE LICENSE CARD */}
        <div className="pf-license-col">
          <div
            className="pf-flip-container"
            onClick={() => setFlipped(!flipped)}
          >
            <div className={`pf-flipper ${flipped ? "is-flipped" : ""}`}>

              {/* FRONT */}
              <div className="pf-face pf-front">
                <AuraCard
                  name="" rankLabel="" rarityColor="#ffd700" isCollected={true}
                  effectType={(profile.guild_aura_card as any) || "shadow"}
                  className="hero-aura-wrapper"
                  style={{ width: "100%", height: "100%", padding: 0, margin: 0, borderRadius: 28, border: "2.5px solid rgba(168,168,255,0.4)" }}
                >
                  <div className="pf-front-inner">
                    <div className="pf-card-header">
                      <div className="pf-chip" />
                      <span className="pf-issuer">GLOBAL HUNTERS ASSOCIATION</span>
                    </div>

                    <div className="pf-card-body">
                      <div className="pf-photo-box">
                        <span className="pf-photo-initial">{initial}</span>
                        <div className="pf-rank-badge">{profile.player_rank}</div>
                      </div>
                      <div className="pf-card-details">
                        <div className="pf-field">
                          <span className="pf-lbl">MONARCH IDENTITY</span>
                          <div className="pf-val pf-val-name">{profile.name}</div>
                        </div>
                         <div className="pf-field">
                          <span className="pf-lbl">CLASS & JOB</span>
                          <div className="pf-val" style={{ color: "var(--accent-primary)", fontSize: "0.9rem" }}>
                            {profile.player_class} • {profile.player_job || "None"}
                          </div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">MONARCH ALLEGIANCE</span>
                          <div className="pf-val" style={{ fontSize: "0.8rem", color: "#ffd700" }}>{profile.monarch_allegiance || "None"}</div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">TITLE</span>
                          <div className="pf-val" style={{ fontSize: "0.8rem", opacity: 0.7 }}>{profile.player_title}</div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">MANA TOTAL</span>
                          <div className="pf-val" style={{ fontSize: "0.85rem" }}>{profile.total_points.toLocaleString()} XP</div>
                        </div>
                      </div>
                    </div>

                    <div className="pf-card-footer">
                      <div className="pf-barcode" />
                      <Fingerprint size={26} style={{ color: "var(--accent-primary)", opacity: 0.4 }} />
                    </div>
                  </div>
                </AuraCard>
              </div>

              {/* BACK */}
              <div className="pf-face pf-back ds-glass">
                <div className="pf-back-inner">
                  <div className="pf-mag-stripe" />
                  <p className="pf-terms">
                    Official System Record. This Hunter is authorized for all S-Rank Dungeon clearance.{"\n"}
                    Sync Serial: SRN-{profile.user_id.slice(0, 10).toUpperCase()}
                  </p>
                  <div className="pf-back-stats">
                    <div className="pf-bs"><span>STR</span>{profile.strength}</div>
                    <div className="pf-bs"><span>AGI</span>{profile.agility}</div>
                    <div className="pf-bs"><span>INT</span>{profile.intelligence}</div>
                    <div className="pf-bs"><span>VIT</span>{profile.vitality}</div>
                  </div>
                  <div className="pf-qr-row">
                    <QrCode size={44} strokeWidth={1.2} color="#fff" style={{ opacity: 0.35 }} />
                    <div className="pf-sig-block">
                      <div className="pf-sig-line" />
                      <span className="pf-sig-label">AUTHORIZED SIGNATURE</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="pf-flip-hint">
            <RefreshCw size={13} /> CLICK TO TOGGLE SYSTEM VIEW
          </div>
        </div>

        {/* RIGHT: PRIMARY ARMAMENT */}
        <div className="pf-armament-col">
          <div className="pf-section-label">
            <Swords size={15} style={{ color: "var(--accent-primary)" }} />
            <span>PRIMARY ARMAMENT</span>
          </div>
          <AuraCard
            name={currentWeapon.name}
            rankLabel={`${currentWeapon.rank}-RANK EQUIPPED`}
            rarityColor={currentWeapon.color}
            isCollected={true}
            effectType={currentWeapon.type as any}
            style={{ flex: 1, width: "100%", minHeight: 0 }}
          />
        </div>
      </div>

      {/* ── TIER 2: ANALYTICS ROW ── */}
      <div className="pf-tier2">

        {/* COMBAT ATTRIBUTES */}
        <div className="panel ds-glass pf-panel">
          <h3 className="pf-panel-title"><Shield size={14} /> Combat Attributes</h3>
          <div className="pf-stat-list">
            {stats.map(s => (
              <div key={s.label} className="pf-stat-row">
                <div className="pf-stat-icon" style={{ background: `${s.color}18`, color: s.color }}>
                   <s.icon size={17} />
                </div>
                <div className="pf-stat-body">
                  <div className="pf-stat-meta">
                    <span className="pf-stat-lbl">{s.label}</span>
                    <span className="pf-stat-val">{s.value}</span>
                  </div>
                  <div className="pf-track">
                    <div className="pf-fill" style={{ width: `${Math.min(100, s.value)}%`, background: s.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RESONANCE RADAR + SYNC */}
        <div className="panel ds-glass pf-panel pf-panel-center">
          <h3 className="pf-panel-title" style={{ alignSelf: "flex-start" }}>Resonance Matrix</h3>
          <PerformanceRadar data={areaStats} height={240} />
          <div className="pf-sync-row">
            <div className="pf-lvl-circle">
              <div className="orbit-energy orbit-1" />
              <span className="pf-lvl-val">{profile.level}</span>
              <span className="pf-lvl-lbl">LVL</span>
            </div>
            <div className="pf-sync-bar-wrap">
              <div className="pf-sync-header">
                <span>Sync Rate</span>
                <span style={{ color: "var(--accent-primary)", fontWeight: 900 }}>94.2%</span>
              </div>
              <div className="pf-mana-track">
                <div className="pf-mana-fill" style={{ width: "94.2%" }} />
              </div>
              <div className="pf-xp-header">
                <span>XP Progress</span>
                <span style={{ opacity: 0.6, fontWeight: 700 }}>{xpPct}%</span>
              </div>
              <div className="pf-mana-track">
                <div className="pf-mana-fill" style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #34d399, #ffd700)" }} />
              </div>
            </div>
          </div>
        </div>

        {/* SYSTEM RECORDS */}
        <div className="panel ds-glass pf-panel">
          <h3 className="pf-panel-title"><Zap size={14} /> System Records</h3>
          <div className="pf-records">
            <div className="pf-record-item">
              <span>GLOBAL RANK</span>
              <strong style={{ color: "var(--accent-primary)", fontSize: "1.15rem" }}>#1,242</strong>
            </div>
            <div className="pf-record-item">
              <span>MANA TOTAL</span>
              <strong>{profile.total_points.toLocaleString()}</strong>
            </div>
            <div className="pf-record-item">
              <span>HUNTER TITLE</span>
              <strong style={{ color: "var(--accent-primary)" }}>{profile.player_title}</strong>
            </div>
            <div className="pf-record-item">
              <span>PLAYER RANK</span>
              <strong style={{ fontSize: "1.4rem", color: "#ffd700" }}>{profile.player_rank}</strong>
            </div>
            <div className="pf-record-item">
              <span>NEXT RANK</span>
              <strong style={{ opacity: 0.5, fontSize: "0.8rem" }}>{nextRank?.rank ?? "MAX"}</strong>
            </div>
            <div className="pf-record-item" style={{ borderBottom: "none" }}>
              <span>SERIAL NO.</span>
              <strong style={{ fontSize: "0.7rem", fontFamily: "monospace" }}>
                SRN-{profile.user_id.slice(0, 8).toUpperCase()}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* ── SKILLS SECTION ── */}
      <div className="pf-collection" style={{ marginTop: 60 }}>
        <div className="pf-collection-header">
          <div className="pf-divider-line" />
          <Sparkles size={18} style={{ color: "#ffd700" }} />
          <h2 className="pf-collection-title">Awakened Skills</h2>
          <div className="pf-divider-line pf-divider-long" />
        </div>
        <div className="skills-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {userSkills.map(s => {
            const isS = s.rank === 'S';
            const color = isS ? "#ffd700" : s.rank === 'A' ? "#ff4040" : s.rank === 'B' ? "#ff69b4" : "var(--accent-primary)";
            const effect = s.type.toLowerCase().includes('shadow') ? 'shadow' :
                           s.type.toLowerCase().includes('flame') || s.type.toLowerCase().includes('fire') ? 'flame' :
                           s.type.toLowerCase().includes('lightning') ? 'lightning' : 'smoke';
            return (
              <AuraCard
                key={s.name}
                name={s.name}
                rankLabel={`${s.rank}-RANK SKILL`}
                rarityColor={color}
                isCollected={true}
                effectType={effect}
                label={s.type}
                sub={s.description + (s.required_monarch ? ` (Req: ${s.required_monarch})` : "")}
                icon={getSkillIcon(s.type, isS, color)}
                style={{ width: "100%", minHeight: "260px" }}
              />
            );
          })}
          {userSkills.length === 0 && (
            <div className="panel panel-empty" style={{ gridColumn: '1/-1' }}>
              <p className="text-muted">No skills awakened yet for this class configuration.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      <Modal
        isOpen={showEdit}
        title="Hunter Re-Evaluation"
        onClose={() => setShowEdit(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Evaluating…" : "Update Record"}
            </Button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Hunter Alias</label>
          <input className="form-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Hunter Class</label>
            <select className="form-select" value={editData.player_class} 
              onChange={e => {
                const cls = e.target.value;
                setEditData({ ...editData, player_class: cls, player_job: PLAYER_JOBS[cls]?.[0] || "" });
              }}>
              {PLAYER_CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Specialization (Job)</label>
            <select className="form-select" value={editData.player_job} 
              onChange={e => setEditData({ ...editData, player_job: e.target.value })}>
              {(PLAYER_JOBS[editData.player_class] || []).map(j => <option key={j}>{j}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Monarch Allegiance</label>
          <select className="form-select" value={editData.monarch_allegiance} 
            onChange={e => setEditData({ ...editData, monarch_allegiance: e.target.value })}>
            {MONARCHS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Primary Armament</label>
            <select className="form-select" value={editData.weapon_of_choice} onChange={e => setEditData({ ...editData, weapon_of_choice: e.target.value })}>
              {ITEM_CATALOG.filter(i => i.item_category === "Weapon").map(w => <option key={w.name}>{w.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Gear Style</label>
            <select className="form-select" value={editData.gear_style} onChange={e => setEditData({ ...editData, gear_style: e.target.value })}>
              {["Modern", "Heavy", "Light", "Stealth", "Magic-Enhanced"].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Strength</label>
            <input type="number" className="form-input" value={editData.strength} onChange={e => setEditData({ ...editData, strength: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="form-label">Agility</label>
            <input type="number" className="form-input" value={editData.agility} onChange={e => setEditData({ ...editData, agility: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Intelligence</label>
            <input type="number" className="form-input" value={editData.intelligence} onChange={e => setEditData({ ...editData, intelligence: parseInt(e.target.value) || 0 })} />
          </div>
          <div className="form-group">
            <label className="form-label">Vitality</label>
            <input type="number" className="form-input" value={editData.vitality} onChange={e => setEditData({ ...editData, vitality: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div className="form-group mt-16">
          <label className="form-label">Personal Directive (Bio)</label>
          <textarea className="form-textarea" rows={3} value={editData.bio} onChange={e => setEditData({ ...editData, bio: e.target.value })} />
        </div>
      </Modal>

      <style>{`
        /* ── PAGE HEADER ── */
        .pf-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 36px;
          padding: 0 4px;
        }
        .pf-subtitle {
          font-size: 0.72rem;
          letter-spacing: 0.18em;
          opacity: 0.5;
          text-transform: uppercase;
          margin-top: 5px;
        }

        /* ── TIER 1: LICENSE + ARMAMENT ── */
        .pf-tier1 {
          display: grid;
          grid-template-columns: minmax(480px, 1fr) 1fr;
          gap: 40px;
          margin-bottom: 48px;
          align-items: start;
          max-width: 1200px;
          margin-left: auto;
          margin-right: auto;
        }

        /* LICENSE COL */
        .pf-license-col {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }
        .pf-flip-container {
          perspective: 2000px;
          width: 540px;
          height: 340px; /* Credit card aspect ratio ~1.58 */
          cursor: pointer;
        }
        .pf-flipper {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        .pf-flipper.is-flipped { transform: rotateY(180deg); }
        .pf-face {
          position: absolute;
          inset: 0;
          backface-visibility: hidden;
          border-radius: var(--r-lg); /* Sleeker corner for CC size */
          overflow: hidden;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .pf-front { background: transparent; }
        .pf-back  { transform: rotateY(180deg); background: rgba(10,10,18,0.98); border: 2px solid rgba(255,255,255,0.08); }

        /* FRONT INNER */
        .pf-front-inner {
          position: relative;
          z-index: 10;
          padding: 24px 28px;
          height: 100%;
          display: flex;
          flex-direction: column;
          pointer-events: none;
          box-sizing: border-box;
        }
        .pf-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .pf-chip {
          width: 50px; height: 38px;
          background: linear-gradient(135deg, #ffd700, #b8860b);
          border-radius: 6px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
          position: relative;
        }
        .pf-chip::after {
          content: ''; position: absolute; inset: 6px;
          border: 1px solid rgba(0,0,0,0.1); border-radius: 2px;
        }
        .pf-issuer {
          font-size: 0.55rem;
          font-weight: 900;
          letter-spacing: 2px;
          color: rgba(255,255,255,0.4);
          text-transform: uppercase;
        }
        .pf-card-body {
          display: flex;
          gap: 24px;
          flex: 1;
          align-items: center;
        }
        .pf-photo-box {
          width: 100px;
          height: 125px;
          border-radius: var(--r-md);
          background: rgba(0,0,0,0.6);
          border: 1.5px solid rgba(255,255,255,0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          flex-shrink: 0;
        }
        .pf-photo-initial {
          font-size: 3.5rem;
          font-weight: 900;
          color: var(--accent-primary);
          opacity: 0.8;
        }
        .pf-rank-badge {
          position: absolute;
          bottom: -8px; right: -8px;
          width: 36px; height: 36px;
          border-radius: 50%;
          background: var(--accent-primary);
          border: 2px solid #000;
          color: #000;
          font-size: 1rem;
          font-weight: 900;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .pf-card-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pf-field { display: flex; flex-direction: column; gap: 1px; }
        .pf-lbl {
          font-size: 0.5rem;
          font-weight: 900;
          letter-spacing: 1.5px;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
        }
        .pf-val { font-weight: 900; color: #fff; text-transform: uppercase; font-size: 0.8rem; }
        .pf-val-name { font-size: 1.5rem; letter-spacing: -0.5px; }
        .pf-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-top: 12px;
        }
        .pf-barcode {
          width: 110px; height: 24px;
          opacity: 0.4;
          background: repeating-linear-gradient(90deg, #fff, #fff 1.5px, transparent 1.5px, transparent 5px);
        }

        /* BACK INNER */
        .pf-back-inner {
          padding: 20px 28px;
          height: 100%;
          display: flex; flex-direction: column;
          box-sizing: border-box;
        }
        .pf-mag-stripe {
          height: 44px;
          background: #000;
          margin: 4px -28px 0;
        }
        .pf-terms {
          font-size: 0.55rem;
          color: rgba(255,255,255,0.25);
          line-height: 1.7;
          font-family: monospace;
          margin-top: 16px;
          white-space: pre-line;
        }
        .pf-back-stats {
          display: flex;
          justify-content: space-between;
          background: rgba(168,168,255,0.04);
          margin: 14px 0;
          padding: 12px 16px;
          border-radius: var(--r-sm);
        }
        .pf-bs {
          font-size: 0.8rem;
          font-weight: 900;
          color: #fff;
          display: flex; flex-direction: column; align-items: center;
        }
        .pf-bs span {
          color: rgba(255,255,255,0.2);
          font-size: 0.55rem;
          margin-bottom: 2px;
        }
        .pf-qr-row {
          display: flex;
          gap: 20px;
          align-items: flex-end;
          margin-top: auto;
        }
        .pf-sig-block { flex: 1; }
        .pf-sig-line { border-bottom: 1.2px solid rgba(255,255,255,0.1); height: 28px; margin-bottom: 4px; }
        .pf-sig-label { font-size: 0.5rem; color: rgba(255,255,255,0.2); font-weight: 800; letter-spacing: 1.5px; }

        /* FLIP HINT */
        .pf-flip-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-size: 0.6rem;
          color: rgba(255,255,255,0.2);
          font-weight: 800;
          letter-spacing: 2px;
        }

        /* ARMAMENT COL */
        .pf-armament-col {
          display: flex;
          flex-direction: column;
          gap: 14px;
          height: 340px; /* Match License Height */
        }
        .pf-section-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          opacity: 0.5;
          padding-left: 4px;
        }

        /* ── TIER 2 ── */
        .pf-tier2 {
          display: grid;
          grid-template-columns: 1fr 1.4fr 1fr;
          gap: 28px;
          margin-bottom: 56px;
          align-items: start;
        }
        .pf-panel {
          padding: 26px;
          border-radius: var(--r-xl);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .pf-panel-center {
          align-items: center;
        }
        .pf-panel-title {
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          opacity: 0.55;
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 8px;
        }

        /* STAT LIST */
        .pf-stat-list { display: flex; flex-direction: column; gap: 16px; }
        .pf-stat-row { display: flex; align-items: center; gap: 14px; }
        .pf-stat-icon {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .pf-stat-body { flex: 1; }
        .pf-stat-meta {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .pf-stat-lbl { font-size: 0.63rem; font-weight: 900; text-transform: uppercase; opacity: 0.45; letter-spacing: 1px; }

        .skills-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }


        .pf-stat-val { font-size: 1rem; font-weight: 900; }
        .pf-track { height: 5px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden; }
        .pf-fill  { height: 100%; border-radius: 3px; transition: width 1s ease-out; }

        /* SYNC */
        .pf-sync-row {
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(0,0,0,0.2);
          padding: 16px;
          border-radius: 16px;
          width: 100%;
          box-sizing: border-box;
        }
        .pf-lvl-circle {
          width: 60px; height: 60px;
          border-radius: 50%;
          border: 2.5px solid rgba(168,168,255,0.15);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          position: relative;
          background: rgba(0,0,0,0.3);
          flex-shrink: 0;
        }
        .pf-lvl-val { font-size: 1.5rem; font-weight: 900; line-height: 1; z-index: 2; }
        .pf-lvl-lbl { font-size: 0.55rem; font-weight: 900; color: var(--accent-primary); z-index: 2; letter-spacing: 1px; }
        .pf-sync-bar-wrap { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .pf-sync-header, .pf-xp-header {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          font-weight: 700;
          opacity: 0.65;
        }
        .pf-mana-track { height: 7px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
        .pf-mana-fill  { height: 100%; background: linear-gradient(90deg, var(--accent-primary), #ffd700); border-radius: 4px; transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1); }

        /* RECORDS */
        .pf-records { display: flex; flex-direction: column; }
        .pf-record-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .pf-record-item span { font-size: 0.65rem; color: rgba(255,255,255,0.4); font-weight: 700; letter-spacing: 0.5px; }
        .pf-record-item strong { color: #fff; font-weight: 900; }

        /* ── COLLECTION ── */
        .pf-collection {
          margin-bottom: 80px;
        }
        .pf-collection-header {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 28px;
        }
        .pf-divider-line { width: 36px; height: 2px; background: var(--accent-primary); opacity: 0.3; flex-shrink: 0; }
        .pf-divider-long { flex: 1; height: 1px; background: rgba(255,255,255,0.05); }
        .pf-collection-title {
          font-size: 1.1rem;
          font-weight: 800;
          letter-spacing: 3px;
          text-transform: uppercase;
          margin: 0;
          flex-shrink: 0;
        }
        .pf-collection-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }

        /* ── ORBIT SPINNER ── */
        .orbit-energy {
          position: absolute;
          border-radius: 50%;
          border: 2.5px solid transparent;
          pointer-events: none;
        }
        .orbit-1 {
          inset: -7px;
          border-top-color: var(--accent-primary);
          animation: orbit-spin 2.5s linear infinite;
          opacity: 0.7;
          filter: drop-shadow(0 0 7px var(--accent-primary));
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}