import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Modal } from "../components/Modal";
import { Button } from "../components/Button";
import { Edit3, Shield, Swords, Zap, Brain, Activity, Fingerprint, RefreshCw, QrCode, Crosshair, Wind, Flame, Droplet, Skull, Sparkles, Star, Sword, Hammer } from "lucide-react";
import { calcTitle, calcLevel, calcXpProgress, calcRank, nextRankInfo } from "../lib/levelEngine";
import { AuraCard } from "../components/AuraCard";
import { PerformanceRadar } from "../components/PerformanceRadar";
import { DomainRadar } from "../components/DomainRadar";
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
  domain_physical: number;
  domain_mind: number;
  domain_soul: number;
  domain_execution: number;
  domain_builder: number;
  ego_score: number;
  guild_aura_card?: string;
  guild_title?: string;
  guild_logo?: string;
  player_job?: string;
  monarch_allegiance?: string;
  status?: string;
  dark_mana?: number;
  avatar_url?: string;
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
    age: 0, weapon: "Starter Blade", style: "Hybrid",
    guild_aura_card: "shadow", guild_title: "", guild_logo: "",
    player_job: "Berserker", monarch_allegiance: "None",
    avatar_url: ""
  });
  const [hunterStats, setHunterStats] = useState<{category: string; value: number; fullMark: number}[]>([]);

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
      const rankRes = await supabase.from("user_profiles").select("user_id", { count: "exact", head: true }).gt("total_points", prof.total_points || 0);

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
        weapon: prof.weapon_of_choice || "Starter Blade",
        style: prof.gear_style || "Hybrid",
        guild_aura_card: prof.guild_aura_card || "shadow",
        guild_title: prof.guild_title || "",
        guild_logo: prof.guild_logo || "",
        player_job: prof.player_job || (PLAYER_JOBS[prof.player_class]?.[0] || ""),
        monarch_allegiance: prof.monarch_allegiance || "None",
        avatar_url: prof.avatar_url || ""
      });

      // Domain Mastery: Derived from physical stats and mental proficiency
      setHunterStats([
        { category: "Physical",  value: prof.domain_physical || 10,  fullMark: 100 },
        { category: "Mind",      value: prof.domain_mind     || 10,  fullMark: 100 },
        { category: "Soul",      value: prof.domain_soul     || 10,  fullMark: 100 },
        { category: "Execution", value: prof.domain_execution || 10, fullMark: 100 },
        { category: "Builder",   value: prof.domain_builder   || 10, fullMark: 100 },
      ]);


      // (areaStats removed — hunterStats from stat_* is the single source of truth)

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
        avatar_url: editData.avatar_url,
        age: editData.age,
        weapon_of_choice: editData.weapon,
        gear_style: editData.style,
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
    typeKey.includes("lightning") ? profile.domain_execution :
    typeKey.includes("flame") || typeKey.includes("fire") ? profile.domain_physical :
    typeKey.includes("smoke") ? profile.domain_soul :
    profile.domain_mind;
  const armDps = Math.round(weaponScore * 8 + profile.level * 2.5 + affinityStat * 0.8);
  const armCrit = Math.min(75, Math.round(8 + profile.domain_execution * 0.35));
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
    const duration = 1100;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      
      const el = licenseTiltRef.current;
      if (el) {
        el.style.setProperty("--scanPct", `${(p * 100).toFixed(2)}%`);
      }

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
              if (licenseRevealed) {
                el.style.setProperty("--scanPct", "100%");
              } else if (!licenseScanning) {
                const px = (e.clientX - rect.left) / rect.width;
                el.style.setProperty("--scanPct", `${(px * 100).toFixed(2)}%`);
              }

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
                          <span className="pf-lbl">XP</span>
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
                    <div className="pf-bs"><span>PHY</span>{profile.domain_physical}</div>
                    <div className="pf-bs"><span>MND</span>{profile.domain_mind}</div>
                    <div className="pf-bs"><span>SOL</span>{profile.domain_soul}</div>
                    <div className="pf-bs"><span>EXE</span>{profile.domain_execution}</div>
                    <div className="pf-bs"><span>BLD</span>{profile.domain_builder}</div>
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


        {/* SOVEREIGN DOMAIN MASTERY — Derived from core attributes */}
        <div className="panel ds-glass pf-panel pf-panel-center">
          <h3 className="pf-panel-title" style={{ alignSelf: "flex-start" }}>
            <Activity size={14} /> Sovereign Domain Mastery
          </h3>


          {/* Radar + Legend side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, width: '100%', alignItems: 'center' }}>
            {/* Radar */}
            <PerformanceRadar data={hunterStats} height={220} title="" />

            {/* Domain detail list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {([
                { key: 'Physical',  label: 'Physical',  icon: Sword, color: '#ff6b6b', desc: 'Fitness & Vitality',    tip: 'Strength / Recovery balance' },
                { key: 'Mind',      label: 'Mind',      icon: Brain, color: '#a78bfa', desc: 'Work & Learning',      tip: 'Intellectual throughput' },
                { key: 'Soul',      label: 'Soul',      icon: Sparkles, color: '#60a5fa', desc: 'Social & Spirit',      tip: 'Emotional intelligence' },
                { key: 'Execution', label: 'Execution', icon: Zap, color: '#38bdf8', desc: 'Practical Output',      tip: 'Daily task agility' },
                { key: 'Builder',   label: 'Builder',   icon: Hammer, color: '#ffd700', desc: 'Projects & Wealth',    tip: 'System creation capacity' },
              ] as const).map(({ key, label, icon: Icon, color, desc, tip }) => {
                const statObj = hunterStats.find(s => s.category === key);
                const val = statObj?.value ?? 10;
                const pct = Math.min(100, val);
                const tier = val >= 80 ? 'SOVEREIGN' : val >= 55 ? 'AWAKENED' : val >= 30 ? 'INITIATED' : 'DORMANT';
                const tierColor = val >= 80 ? '#ffd700' : val >= 55 ? color : val >= 30 ? '#34d399' : '#64748b';
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon size={12} /> {label}
                      </span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.58rem', fontWeight: 700, color: tierColor, opacity: 0.8 }}>{tier}</span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 900, color }}>{val}</span>
                      </div>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.8s cubic-bezier(0.34,1.56,0.64,1)', opacity: 0.85 }} />
                    </div>
                    <span style={{ fontSize: '0.58rem', opacity: 0.4, letterSpacing: '0.05em' }}>{desc} · {tip}</span>
                  </div>
                );
              })}
            </div>

          </div>

          {/* Development Balance + XP Progress */}
          {(() => {
            const domainVals = hunterStats.map(s => s.value);
            const avg = domainVals.length ? domainVals.reduce((a, b) => a + b, 0) / domainVals.length : 10;
            const maxDev = Math.max(...domainVals, 1);
            // Balance score: how close each domain is to the average
            const variance = domainVals.reduce((sum, v) => sum + Math.abs(v - avg), 0) / Math.max(1, domainVals.length);
            const balanceScore = Math.max(0, Math.round(100 - (variance / Math.max(avg, 1)) * 50));
            const balanceLabel = balanceScore >= 85 ? 'SOVEREIGN SYNC' : balanceScore >= 65 ? 'BALANCED' : balanceScore >= 40 ? 'LOPSIDED' : 'CRITICAL IMBALANCE';
            const balanceColor = balanceScore >= 85 ? '#ffd700' : balanceScore >= 65 ? 'var(--accent-primary)' : balanceScore >= 40 ? '#fb923c' : '#ff4444';
            const weakestDomain = hunterStats[domainVals.indexOf(Math.min(...domainVals))]?.category || 'None';

            return (
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Development Balance</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: balanceColor }}>{balanceLabel}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${balanceScore}%`, height: '100%', background: balanceColor, borderRadius: 99, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>Weakest: {weakestDomain} — focus here to improve sync</div>

                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.65rem', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>XP to Next Level</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--accent-primary)' }}>{xpPct}%</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${xpPct}%`, height: '100%', background: 'linear-gradient(90deg, #34d399, #ffd700)', borderRadius: 99, transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.6rem', opacity: 0.4 }}>Avg stat: {Math.round(avg)} · Peak: {maxDev}</div>
                </div>
              </div>
            );
          })()}

          {/* Level orb */}
          <div className="pf-sync-row" style={{ marginTop: 16, justifyContent: 'center', background: 'none', padding: 0 }}>
            <div className="pf-lvl-circle">
              <div className="pf-lvl-glow" />
              <div className="orbit-energy orbit-1" />
              <div className="orbit-energy orbit-2" />
              <div className="orbit-energy orbit-3" />
              <div className="pf-lvl-val-wrap">
                <span className="pf-lvl-val">{profile.level}</span>
                <span className="pf-lvl-lbl">LEVEL</span>
              </div>
            </div>
          </div>
        </div>

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
              <span>TOTAL XP</span>
              <strong>{profile.total_points.toLocaleString()} XP</strong>
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
              <strong style={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>
                SRN-{profile.user_id.slice(0, 8).toUpperCase()}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="panel ds-glass" style={{ margin: '0 0 24px', padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.9, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} /> System Category Proficiency
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.62rem', opacity: 0.4, maxWidth: 500 }}>
              Individual proficiency across all system categories. Scores represent consistency and 
              completion rates for gates in each specific field. Higher scores indicate mastery in that discipline.
            </p>

          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {(['Physical','Mind','Soul','Execution','Builder'] as const).map(d => (
              <div key={d} title={d} style={{
                width: 8, height: 8, borderRadius: 99,
                background: d === 'Physical' ? '#ff6b6b' : d === 'Mind' ? '#a78bfa' : d === 'Soul' ? '#60a5fa' : d === 'Execution' ? '#38bdf8' : '#ffd700',
                opacity: 0.7,
              }} />
            ))}
          </div>
        </div>
        <DomainRadar />
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
            const color = isS ? "#ffd700" : s.rank === 'A' ? "#6d28d9" : s.rank === 'B' ? "#4c1d95" : "#020617";
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
                glow={!isS ? '50,15,100' : undefined}
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
            <select className="form-select" value={editData.weapon} onChange={e => setEditData({ ...editData, weapon: e.target.value })}>
              {ITEM_CATALOG.filter(i => i.item_category === "Weapon").map(w => <option key={w.name}>{w.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Gear Style</label>
            <select className="form-select" value={editData.style} onChange={e => setEditData({ ...editData, style: e.target.value })}>
              {["Modern", "Heavy", "Light", "Stealth", "Magic-Enhanced"].map(s => <option key={s}>{s}</option>)}
            </select>
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
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
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
          width: 80px; height: 80px;
          border-radius: 50%;
          border: 1px solid rgba(168,168,255,0.1);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          position: relative;
          background: radial-gradient(circle at 30% 30%, rgba(30, 30, 40, 0.9), rgba(10, 10, 15, 0.95));
          flex-shrink: 0;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 15px rgba(168,168,255,0.05);
          animation: pf-mana-pulse 4s ease-in-out infinite;
        }
        .pf-lvl-glow {
          position: absolute; inset: -2px; border-radius: 50%;
          background: radial-gradient(circle at center, var(--accent-primary) 0%, transparent 70%);
          opacity: 0.15; z-index: 0;
          filter: blur(8px);
        }
        .pf-lvl-val-wrap {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          z-index: 5;
        }
        .pf-lvl-val { 
          font-size: 2.2rem; font-weight: 950; line-height: 0.9; 
          background: linear-gradient(to bottom, #fff, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          text-shadow: 0 4px 12px rgba(0,0,0,0.5);
          font-family: "Outfit", sans-serif;
        }
        .pf-lvl-lbl { 
          font-size: 0.5rem; font-weight: 900; color: var(--accent-primary); 
          letter-spacing: 3px; margin-top: 2px; opacity: 0.8;
          text-transform: uppercase;
        }
        @keyframes pf-mana-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
          50% { transform: scale(1.03); box-shadow: 0 15px 45px rgba(124, 58, 237, 0.2); }
        }
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
          border: 2px solid transparent;
          pointer-events: none;
          z-index: 1;
        }
        .orbit-1 {
          inset: -10px;
          border-top-color: var(--accent-primary);
          animation: orbit-spin 3s linear infinite;
          opacity: 0.6;
          filter: drop-shadow(0 0 10px var(--accent-primary));
        }
        .orbit-2 {
          inset: -6px;
          border-right-color: #ffd700;
          animation: orbit-spin 4.5s linear infinite reverse;
          opacity: 0.4;
          filter: drop-shadow(0 0 8px #ffd700);
        }
        .orbit-3 {
          inset: -14px;
          border-bottom-color: #a78bfa;
          animation: orbit-spin 6s linear infinite;
          opacity: 0.3;
          filter: drop-shadow(0 0 12px #a78bfa);
        }
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </section>
  );
}