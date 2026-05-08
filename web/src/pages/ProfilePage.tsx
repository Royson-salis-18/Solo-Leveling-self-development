import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Edit3, Shield, Swords, Zap, Brain, Activity, Fingerprint, RefreshCw, QrCode, Crosshair, Wind, Flame, Droplet, Skull, Sparkles, Star } from "lucide-react";
import { calcTitle, calcLevel, calcXpProgress, calcRank, nextRankInfo } from "../lib/levelEngine";
import { AuraCard } from "../components/AuraCard";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { PLAYER_CLASSES, PLAYER_JOBS, MONARCHS, SKILL_CATALOG, ITEM_CATALOG } from "../lib/catalog";

const STREAM_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789[]{}()<>|/\\:;.,-_+=*#@$%";

function makeDataStreamText(width = 250, rows = 60) {
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < width; c++) {
      line += STREAM_CHARS[Math.floor(Math.random() * STREAM_CHARS.length)];
    }
    lines.push(line);
  }
  return lines.join("\n");
}

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
  stat_strength: number;
  stat_agility: number;
  stat_intelligence: number;
  stat_vitality: number;
  stat_sense: number;
  guild_aura_card?: string;
  guild_title?: string;
  guild_logo?: string;
  player_job?: string;
  monarch_allegiance?: string;
  status?: string;
  dark_mana?: number;
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
    strength: 10, agility: 10, intelligence: 10, vitality: 10, sense: 10,
    guild_aura_card: "shadow", guild_title: "", guild_logo: "",
    player_job: "Berserker", monarch_allegiance: "None"
  });
  const [hunterStats, setHunterStats] = useState([
    { category: "Strength", value: 10, fullMark: 100 },
    { category: "Agility", value: 10, fullMark: 100 },
    { category: "Sense", value: 10, fullMark: 100 },
    { category: "Intelligence", value: 10, fullMark: 100 },
    { category: "Vitality", value: 10, fullMark: 100 },
  ]);
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
  const [globalRank, setGlobalRank] = useState<number | string>("...");
  const licenseTiltRef = useRef<HTMLDivElement | null>(null);
  const tiltRafRef = useRef<number | null>(null);
  const tiltTargetRef = useRef({ x: 0, y: 0 });
  const tiltCurrentRef = useRef({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const [licenseRevealed, setLicenseRevealed] = useState(false);
  const [licenseScanning, setLicenseScanning] = useState(false);
  const [isHoveringLicense, setIsHoveringLicense] = useState(false);
  const [streamText] = useState(() => makeDataStreamText(300, 80)); // Generate once, larger

  // Removed frequent stream text interval to eliminate lag

  const fetchProfile = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const profRes = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
    
    if (profRes.data) {
      const prof = profRes.data;
      const [taskRes, rankRes] = await Promise.all([
        supabase.from("tasks").select("category").eq("assigned_to", user.id).eq("is_completed", true),
        supabase.from("user_profiles").select("user_id", { count: "exact", head: true }).gt("total_points", prof.total_points || 0)
      ]);
      
      // Local System Sweep: Check if this profile should be DECEASED (7 Days Inactivity)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const heartbeat = prof.last_heartbeat ? new Date(prof.last_heartbeat) : null;
      
      if (prof.status === 'ACTIVE' && (!heartbeat || heartbeat < sevenDaysAgo)) {
        prof.status = 'DECEASED';
        // Background update
        supabase.from("user_profiles").update({ status: 'DECEASED' }).eq("user_id", user.id).then();
      }

      setProfile(prof);
      setEditData({
        name: prof.name, bio: prof.bio,
        player_class: prof.player_class, player_title: prof.player_title,
        age: prof.age || 18,
        weapon_of_choice: prof.weapon_of_choice || "Starter Blade",
        gear_style: prof.gear_style || "Modern",
        strength: prof.stat_strength || 10,
        agility: prof.stat_agility || 10,
        intelligence: prof.stat_intelligence || 10,
        vitality: prof.stat_vitality || 10,
        sense: prof.stat_sense || 10,
        guild_aura_card: prof.guild_aura_card || "shadow",
        guild_title: prof.guild_title || "",
        guild_logo: prof.guild_logo || "",
        player_job: prof.player_job || (PLAYER_JOBS[prof.player_class]?.[0] || ""),
        monarch_allegiance: prof.monarch_allegiance || "None"
      });

      setHunterStats([
        { category: "Strength", value: prof.stat_strength || 10, fullMark: 100 },
        { category: "Agility", value: prof.stat_agility || 10, fullMark: 100 },
        { category: "Sense", value: prof.stat_sense || 10, fullMark: 100 },
        { category: "Intelligence", value: prof.stat_intelligence || 10, fullMark: 100 },
        { category: "Vitality", value: prof.stat_vitality || 10, fullMark: 100 },
      ]);

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

      // Calculate Real Global Rank using count of users with more points
      setGlobalRank((rankRes.count ?? 0) + 1);
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

  const handleRevive = async () => {
    if (!supabase || !user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("user_profiles").update({ 
        status: 'ACTIVE', 
        last_heartbeat: new Date().toISOString(),
        last_active_date: new Date().toISOString().split('T')[0]
      }).eq("user_id", user.id);
      
      if (error) throw error;
      
      await fetchProfile();
      alert("✨ SYSTEM: YOUR SHADOW HAS RE-AWAKENED. WELCOME BACK, MONARCH.");
    } catch (err) {
      console.error("Revival Error:", err);
    } finally {
      setSaving(false);
    }
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
        stat_strength: editData.strength,
        stat_agility: editData.agility,
        stat_intelligence: editData.intelligence,
        stat_vitality: editData.vitality,
        stat_sense: (editData as any).sense || 10,
        guild_aura_card: editData.guild_aura_card,
        guild_title: editData.guild_title,
        guild_logo: editData.guild_logo,
        player_job: editData.player_job,
        monarch_allegiance: editData.monarch_allegiance
      })
      .eq("user_id", user.id)
      .select()
      .single();
    if (data) {
      setProfile(data);
      await fetchProfile();
    }
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

  const stats = [
    { label: "Strength", icon: Swords, value: profile.stat_strength, color: "#ff6b6b" },
    { label: "Agility", icon: Zap, value: profile.stat_agility, color: "var(--frost-blue)" },
    { label: "Intelligence", icon: Brain, value: profile.stat_intelligence, color: "var(--monarch-purple)" },
    { label: "Vitality", icon: Activity, value: profile.stat_vitality, color: "#34d399" },
    { label: "Sense", icon: Crosshair, value: profile.stat_sense, color: "#ffd700" },
  ];

  const WEAPONS = ITEM_CATALOG.filter(i => i.item_type === "WEAPON").map(i => ({
    name: i.name,
    rank: i.rarity.replace("-Rank", ""),
    color: (i as any).rarityColor || "#94a3b8",
    type: (i as any).effectType || "shadow"
  }));

  const currentWeapon = WEAPONS.find(w => w.name === profile.weapon_of_choice) || WEAPONS[0];
  const weaponRankScore: Record<string, number> = { S: 95, A: 82, B: 68, C: 54, D: 38, E: 24 };
  const weaponScore = weaponRankScore[String(currentWeapon.rank || "").toUpperCase()] ?? 55;
  const typeKey = String(currentWeapon.type || "shadow").toLowerCase();
  const affinityStat =
    typeKey.includes("lightning") ? profile.stat_agility :
    typeKey.includes("flame") || typeKey.includes("fire") ? profile.stat_strength :
    typeKey.includes("smoke") ? profile.stat_sense :
    profile.stat_intelligence;
  const armDps = Math.round(weaponScore * 8 + profile.level * 2.5 + affinityStat * 0.8);
  const armCrit = Math.min(75, Math.round(8 + profile.stat_agility * 0.35));
  const armSync = Math.min(100, Math.round(40 + affinityStat * 0.6));

  const userSkills = SKILL_CATALOG.filter(s => 
    s.required_class === profile.player_class || 
    s.required_monarch === profile.monarch_allegiance ||
    (!s.required_class && !s.required_monarch)
  );

  const runLicenseScan = () => {
    if (licenseScanning || licenseRevealed) return;
    setLicenseScanning(true);
    const start = performance.now();
    const duration = 1050;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        setLicenseScanning(false);
        setLicenseRevealed(true);
      }
    };
    requestAnimationFrame(tick);
  };

  return (
    <section className="page profile-page">

      {/* ── PAGE HEADER ── */}
      <div className="pf-page-header">
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Hunter Identity</h2>
          <p className="pf-subtitle">
            Official System Record • Status: <span style={{ color: profile.status === 'DECEASED' ? 'var(--destruction-red)' : 'var(--accent-primary)', fontWeight: 900 }}>{profile.status || 'ACTIVE'}</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {profile.status === 'DECEASED' && (
            <Button 
              variant="primary" 
              onClick={handleRevive} 
              disabled={saving}
              className="animate-pulse"
              style={{ 
                background: 'linear-gradient(135deg, var(--monarch-purple), #ff00ff)', 
                borderColor: '#ff00ff',
                boxShadow: '0 0 20px rgba(255, 0, 255, 0.4)',
                fontWeight: 900,
                letterSpacing: '2px'
              }}
            >
              <Zap size={16} /> ARISE
            </Button>
          )}
          <Link to="/mode-selection" className="ds-glass" style={{ height: 44, display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px', borderRadius: 12, fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 800, textDecoration: 'none', border: '1px solid rgba(168,168,255,0.3)', background: 'rgba(168,168,255,0.05)', transition: 'all 0.2s' }}>
            <Activity size={16} /> Change Difficulty
          </Link>
          <Button variant="secondary" onClick={() => setShowEdit(true)} style={{ height: 44, borderRadius: 12 }}>
            <Edit3 size={16} /> Re-Evaluate
          </Button>
        </div>
      </div>

      {/* ── TIER 1: LICENSE + ARMAMENT ── */}
      <div className="pf-tier1">

        {/* LEFT: FLIPPABLE HUNTER LICENCE (true licence look) */}
        <div className="pf-license-col">
          <div className="pf-section-label">
            <Fingerprint size={15} style={{ color: "var(--accent-primary)" }} />
            <span>HUNTER LICENCE</span>
          </div>
          <div
            ref={licenseTiltRef}
            className="pf-flip-container pf-tilt"
            onMouseDown={() => { draggingRef.current = false; }}
            onMouseMove={(e) => {
              const el = licenseTiltRef.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const dx = (e.clientX - rect.left) / rect.width - 0.5;
              const dy = (e.clientY - rect.top) / rect.height - 0.5;
              
              // Direct DOM update for CSS variables (Buttery Smooth, No React Lag)
              const percent = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
              el.style.setProperty("--scanPct", `${percent}%`);
              
              if (!licenseRevealed && !flipped) {
                if (percent > 99.5) {
                  setLicenseRevealed(true);
                  el.style.setProperty("--scanPct", "100%");
                }
              }

              draggingRef.current = true;
              tiltTargetRef.current = { x: dy * -14, y: dx * 18 };
              if (tiltRafRef.current != null) return;
              tiltRafRef.current = window.requestAnimationFrame(() => {
                tiltRafRef.current = null;
                const cur = tiltCurrentRef.current;
                const tgt = tiltTargetRef.current;
                cur.x += (tgt.x - cur.x) * 0.14;
                cur.y += (tgt.y - cur.y) * 0.14;
                el.style.setProperty("--tiltX", `${cur.x.toFixed(2)}deg`);
                el.style.setProperty("--tiltY", `${cur.y.toFixed(2)}deg`);
              });
            }}
            onMouseEnter={() => setIsHoveringLicense(true)}
            onMouseLeave={() => {
              setIsHoveringLicense(false);
              const el = licenseTiltRef.current;
              if (!el) return;
              tiltTargetRef.current = { x: 0, y: 0 };
              const cur = tiltCurrentRef.current;
              cur.x *= 0.5;
              cur.y *= 0.5;
              el.style.setProperty("--tiltX", `0deg`);
              el.style.setProperty("--tiltY", `0deg`);
            }}
            onClick={() => {
              if (draggingRef.current) return;
              if (!flipped && !licenseRevealed) {
                runLicenseScan();
                return;
              }
              setFlipped(!flipped);
            }}
          >
            <div className={`pf-flipper ${flipped ? "is-flipped" : ""}`}>
              {/* FRONT */}
              <div className="pf-face pf-front ds-glass pf-lic">
                <div className="pf-lic-holo" />
                <div className="pf-lic-inner" style={{ pointerEvents: "none" }}>
                  <div
                    className="pf-lic-real"
                    style={{ clipPath: licenseRevealed ? "none" : `inset(0 calc(100% - var(--scanPct, 0%)) 0 0)` }}
                  >
                    <div className="pf-card-header">
                      <div className="pf-chip" />
                      <span className="pf-issuer">GLOBAL HUNTERS ASSOCIATION</span>
                    </div>

                    <div className="pf-card-body" style={{ alignItems: "flex-start" }}>
                      <div className="pf-photo-box">
                        <span className="pf-photo-initial">{initial}</span>
                        <div className="pf-rank-badge">{profile.player_rank}</div>
                      </div>

                      <div className="pf-card-details">
                        <div className="pf-field">
                          <span className="pf-lbl">NAME</span>
                          <div className="pf-val pf-val-name">{profile.name}</div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">LEVEL</span>
                          <div className="pf-val" style={{ color: "var(--accent-primary)" }}>{profile.level}</div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">CLASS / JOB</span>
                          <div className="pf-val" style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                            {profile.player_class}{profile.player_job ? ` • ${profile.player_job}` : ""}
                          </div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">TITLE</span>
                          <div className="pf-val" style={{ fontSize: "0.78rem", opacity: 0.75 }}>{profile.player_title}</div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">MANA</span>
                          <div className="pf-val" style={{ fontSize: "0.8rem" }}>{profile.total_points.toLocaleString()} XP</div>
                        </div>
                        <div className="pf-field">
                          <span className="pf-lbl">ID</span>
                          <div className="pf-val" style={{ fontSize: "0.7rem", fontFamily: "monospace", opacity: 0.75 }}>
                            {profile.user_id.slice(0, 12).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pf-lic-footer">
                      <div className="pf-lic-qr">
                        <QrCode size={44} strokeWidth={1.2} />
                      </div>
                      <div className="pf-lic-barcode" />
                      <Fingerprint size={24} style={{ color: "var(--accent-primary)", opacity: 0.35 }} />
                    </div>
                  </div>

                  <div
                    className="pf-lic-ascii"
                    style={{ clipPath: licenseRevealed ? "inset(0 0 0 100%)" : `inset(0 0 0 var(--scanPct, 0%))` }}
                  >
                    <pre>{streamText}</pre>
                    <div className="pf-lic-ascii-vignette" />
                  </div>
                  {(licenseScanning || (isHoveringLicense && !licenseRevealed)) && (
                    <div
                      className="pf-lic-scan-line"
                      style={{ left: `var(--scanPct, 0%)` }}
                    >
                      <div className="pf-lic-scan-core" />
                      <div className="pf-lic-scan-glow" />
                    </div>
                  )}
                </div>
              </div>

              {/* BACK (keep official system back) */}
              <div className="pf-face pf-back ds-glass">
                <div className="pf-back-inner">
                  <div className="pf-mag-stripe" />
                  <p className="pf-terms">
                    Official System Record. This Hunter is authorized for all S-Rank Dungeon clearance.{"\n"}
                    Sync Serial: SRN-{profile.user_id.slice(0, 10).toUpperCase()}
                  </p>
                  <div className="pf-back-stats">
                    <div className="pf-bs"><span>STR</span>{profile.stat_strength}</div>
                    <div className="pf-bs"><span>AGI</span>{profile.stat_agility}</div>
                    <div className="pf-bs"><span>INT</span>{profile.stat_intelligence}</div>
                    <div className="pf-bs"><span>VIT</span>{profile.stat_vitality}</div>
                    <div className="pf-bs"><span>SNS</span>{profile.stat_sense}</div>
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
            <RefreshCw size={13} /> {!licenseRevealed ? "CLICK TO SCAN & REVEAL" : "CLICK TO TOGGLE SYSTEM VIEW"}
          </div>
        </div>

        {/* RIGHT: PRIMARY ARMAMENT (weapon card look, no licence elements) */}
        <div className="pf-armament-col">
          <div className="pf-section-label">
            <Swords size={15} style={{ color: "var(--accent-primary)" }} />
            <span>PRIMARY ARMAMENT</span>
          </div>

          <AuraCard
            name={currentWeapon.name}
            rankLabel={`${currentWeapon.rank}-RANK`}
            rarityColor={currentWeapon.color}
            isCollected={true}
            effectType={currentWeapon.type as any}
            label="WEAPON"
            icon={<Swords size={22} />}
            interactive={false}
            sub={
              <div className="pf-arm-mini">
                <div className="pf-arm-pill"><span>DPS</span>{armDps.toLocaleString()}</div>
                <div className="pf-arm-pill"><span>SYNC</span>{armSync}%</div>
                <div className="pf-arm-pill"><span>CRIT</span>{armCrit}%</div>
                <div className="pf-arm-pill"><span>STYLE</span>{(profile.gear_style || "Modern").toUpperCase()}</div>
              </div>
            }
            style={{ width: "100%", minHeight: 360 }}
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
        <div className="panel ds-glass pf-panel pf-panel-center" style={{ minWidth: 400 }}>
          <h3 className="pf-panel-title" style={{ alignSelf: "flex-start" }}>Resonance Matrix</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 32, width: '100%' }}>
            <PerformanceRadar data={areaStats} height={200} title="MISSION RESONANCE" />
            <PerformanceRadar data={hunterStats} height={200} title="HUNTER POTENTIAL" />
          </div>
          <div className="pf-sync-row" style={{ marginTop: 24 }}>
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
              <strong style={{ color: "var(--accent-primary)", fontSize: "1.15rem" }}>
                #{typeof globalRank === 'number' ? globalRank.toLocaleString() : globalRank}
              </strong>
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
            <div className="pf-record-item">
              <span>DARK MANA DEBT</span>
              <strong style={{ color: (profile as any).dark_mana > 0 ? "#ff4444" : "inherit" }}>
                {(profile as any).dark_mana || 0}
              </strong>
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
        <div className="form-group">
          <label className="form-label">Sense (Perception)</label>
          <input type="number" className="form-input" value={(editData as any).sense} onChange={e => setEditData({ ...editData, sense: parseInt(e.target.value) || 0 } as any)} />
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
          grid-template-columns: repeat(auto-fit, minmax(440px, 1fr));
          gap: 32px;
          margin-bottom: 48px;
          align-items: start;
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
          width: 580px;
          max-width: 100%;
          height: 360px;
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
          height: 360px; /* Match License Height */
        }
        .pf-armament-col--license {
          height: auto;
          align-items: center;
        }

        /* Licence face (keep it stable + smooth) */
        .pf-lic {
          background: rgba(12, 12, 18, 0.78);
          border: 1px solid rgba(255,255,255,0.10);
        }
        .pf-lic-holo {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(135deg, transparent 42%, rgba(168,168,255,0.10) 52%, transparent 62%);
          background-size: 220% 220%;
          animation: pfHolo 7s ease-in-out infinite;
          opacity: 0.85;
        }
        @keyframes pfHolo {
          0% { background-position: 120% 120%; }
          50% { background-position: 40% 40%; }
          100% { background-position: -20% -20%; }
        }
        .pf-lic-inner {
          position: relative;
          z-index: 2;
          height: 100%;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          pointer-events: none; /* prevents jittery hover/click focus */
        }
        .pf-lic-real {
          position: absolute;
          inset: 0;
          z-index: 2;
          padding: 24px 28px;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          will-change: clip-path;
          border-radius: inherit;
        }
        .pf-lic-ascii {
          position: absolute;
          inset: 0;
          z-index: 1;
          overflow: hidden;
          border-radius: inherit;
          background:
            radial-gradient(circle at 20% 30%, rgba(167,139,250,0.14) 0%, transparent 35%),
            radial-gradient(circle at 70% 70%, rgba(6,182,212,0.08) 0%, transparent 38%),
            rgba(6, 8, 16, 0.92);
          will-change: clip-path;
        }
        .pf-lic-ascii pre {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 400%;
          white-space: pre;
          overflow: hidden;
          font-family: "Courier New", monospace;
          font-size: 7px;
          line-height: 0.9;
          letter-spacing: 0.15em;
          color: rgba(196,181,253,0.3);
          text-shadow: 0 0 8px rgba(139,92,246,0.1);
          animation: pfAsciiScroll 30s linear infinite;
        }
        @keyframes pfAsciiScroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .pf-lic-ascii-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(to right, rgba(0,0,0,0.2), transparent 22%, transparent 78%, rgba(0,0,0,0.25));
        }
        .pf-lic-scan-line {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 0;
          z-index: 3;
          pointer-events: none;
        }
        .pf-lic-scan-core {
          position: absolute;
          top: 7%;
          bottom: 7%;
          left: -1px;
          width: 2px;
          border-radius: 4px;
          background: rgba(238, 228, 255, 0.95);
        }
        .pf-lic-scan-glow {
          position: absolute;
          top: 4%;
          bottom: 4%;
          left: -14px;
          width: 28px;
          background: linear-gradient(
            to right,
            rgba(139,92,246,0),
            rgba(196,181,253,0.35) 35%,
            rgba(255,255,255,0.5) 50%,
            rgba(196,181,253,0.35) 65%,
            rgba(139,92,246,0)
          );
          filter: blur(1px);
        }

        /* Tilt wrapper (independent of flip) */
        .pf-tilt {
          transform-style: preserve-3d;
          transform: perspective(1400px) rotateX(var(--tiltX, 0deg)) rotateY(var(--tiltY, 0deg));
          will-change: transform;
        }
        .pf-lic-footer {
          display: flex;
          align-items: flex-end;
          gap: 14px;
          margin-top: auto;
        }
        .pf-lic-qr {
          padding: 8px;
          border-radius: 12px;
          background: rgba(255,255,255,0.92);
          color: #000;
          border: 1px solid rgba(0,0,0,0.10);
          box-shadow: 0 10px 22px rgba(0,0,0,0.35);
        }
        .pf-lic-barcode {
          flex: 1;
          height: 26px;
          opacity: 0.55;
          border-radius: 10px;
          background: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,0.75),
            rgba(255,255,255,0.75) 1.6px,
            transparent 1.6px,
            transparent 5px
          );
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

        /* Armament stats strip (calmer, compact) */
        .pf-arm-mini {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px 10px;
          margin-top: 8px;
        }
        .pf-arm-pill {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding: 7px 10px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          color: rgba(255,255,255,0.85);
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.02em;
        }
        .pf-arm-pill span {
          font-size: 0.55rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          font-weight: 900;
        }

        /* ── TIER 2 ── */
        .pf-tier2 {
          display: grid;
          grid-template-columns: 320px 1fr 320px;
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