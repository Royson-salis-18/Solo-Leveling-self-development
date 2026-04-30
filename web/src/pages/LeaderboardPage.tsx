import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import {
  X, Shield, Swords, Trophy, Zap, MessageSquare, UserPlus,
  Skull, Medal,
} from "lucide-react";
import { Button } from "../components/Button";
import { AuraCard } from "../components/AuraCard";
import { useNavigate } from "react-router-dom";
import { PerformanceRadar } from "../components/PerformanceRadar";

type LBUser = {
  user_id: string; name: string; level: number; total_points: number;
  player_class: string; player_rank: string; player_title: string;
  guild_id: string | null;
  status?: string; last_heartbeat?: string;
  strength?: number; agility?: number; intelligence?: number; vitality?: number;
  guild_logo?: string; guild_title?: string; guild_aura_card?: string;
};
type GuildLB = { id: string; name: string; total_xp: number; member_count: number };
type ClanLB = { id: string; name: string; total_xp: number; member_count: number };
type Skill = { id: string; name: string; description: string; level: number; max_level: number; icon_type: string; rarity: string };
type LBTab = "Hunters" | "Guilds" | "Clans";

const MEDALLION = ["🥇", "🥈", "🥉"];
const RANK_COLOR: Record<number, string> = {
  0: "#ffcc00", // Gold
  1: "#e2e2e2", // Silver
  2: "#cd7f32", // Bronze
};
const RANK_AURA: Record<number, string> = {
  0: "rgba(255, 204, 0, 0.2)",
  1: "rgba(226, 226, 226, 0.15)",
  2: "rgba(205, 127, 50, 0.15)",
};

/* ═══════════════════════════════════════════════
   PROFILE POPUP
═══════════════════════════════════════════════ */
function PlayerProfilePopup({ user, onClose }: { user: LBUser; onClose: () => void }) {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [friendStatus, setFriendStatus] = useState<"none" | "pending" | "accepted" | "loading">("loading");
  const [actionLoading, setActionLoading] = useState(false);
  const [areaStats, setAreaStats] = useState([
    { category: "Work", value: 0, fullMark: 100 },
    { category: "Fitness", value: 0, fullMark: 100 },
    { category: "Learning", value: 0, fullMark: 100 },
    { category: "Mind", value: 0, fullMark: 100 },
    { category: "Social", value: 0, fullMark: 100 },
  ]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const isSelf = currentUser?.id === user.user_id;

  useEffect(() => {
    checkFriendship();
    fetchHunterPotential();
    fetchHunterSkills();
  }, [user.user_id]);

  const checkFriendship = async () => {
    if (!supabase || isSelf || !currentUser) return setFriendStatus("none");
    const { data } = await supabase
      .from("friendship").select("status")
      .or(`requester_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .or(`requester_id.eq.${user.user_id},receiver_id.eq.${user.user_id}`)
      .maybeSingle();
    setFriendStatus(data?.status || "none");
  };

  const handleWhisper = () => { navigate(`/social?whisper=${user.user_id}`); onClose(); };
  const handleAddFriend = async () => {
    if (!supabase || !currentUser || isSelf) return;
    setActionLoading(true);
    await supabase.from("friendship").insert({ requester_id: currentUser.id, receiver_id: user.user_id, status: "pending" });
    setFriendStatus("pending");
    setActionLoading(false);
  };

  const fetchHunterSkills = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("skills").select("*").eq("user_id", user.user_id);
    if (data) setSkills(data);
  };

  const fetchHunterPotential = async () => {
    if (!supabase) return;
    const { data: tasks, error } = await supabase
      .from("tasks").select("category")
      .or(`user_id.eq.${user.user_id},assigned_to.eq.${user.user_id}`)
      .eq("is_completed", true);
    if (error) { console.error(error); return; }
    if (tasks) {
      const counts: Record<string, number> = { Work: 0, Fitness: 0, Learning: 0, Mind: 0, Social: 0 };
      tasks.forEach(t => {
        if (counts[t.category] !== undefined) counts[t.category]++;
        if (t.category === "Academics") counts.Learning++;
        if (t.category === "Mindfulness") counts.Mind++;
      });
      const cls = user.player_class?.toLowerCase() || "";
      const w = { Work: 1.0, Fitness: 1.0, Learning: 1.0, Mind: 1.0, Social: 1.0 };
      if (cls.includes("warrior")) { w.Fitness = 1.2; w.Work = 1.1; }
      if (cls.includes("mage")) { w.Mind = 1.2; w.Learning = 1.1; }
      if (cls.includes("tank")) { w.Fitness = 1.3; w.Social = 1.1; }
      if (cls.includes("assassin")) { w.Fitness = 1.1; w.Mind = 1.2; }
      if (cls.includes("healer")) { w.Social = 1.2; w.Mind = 1.1; }
      setAreaStats([
        { category: "Work", value: Math.min(100, Math.floor((counts.Work * 5 + 10) * w.Work)), fullMark: 100 },
        { category: "Fitness", value: Math.min(100, Math.floor((counts.Fitness * 5 + 10) * w.Fitness)), fullMark: 100 },
        { category: "Learning", value: Math.min(100, Math.floor((counts.Learning * 5 + 10) * w.Learning)), fullMark: 100 },
        { category: "Mind", value: Math.min(100, Math.floor((counts.Mind * 5 + 10) * w.Mind)), fullMark: 100 },
        { category: "Social", value: Math.min(100, Math.floor((counts.Social * 5 + 10) * w.Social)), fullMark: 100 },
      ]);
    }
  };

  const statsList = [
    { label: "Strength", value: user.strength || 10, color: "#ff6b6b" },
    { label: "Agility", value: user.agility || 10, color: "var(--frost-blue)" },
    { label: "Intelligence", value: user.intelligence || 10, color: "var(--monarch-purple)" },
    { label: "Vitality", value: user.vitality || 10, color: "#34d399" },
  ];

  return (
    <div className="pp-overlay" onClick={onClose}>
      <div className="pp-modal ds-glass" onClick={e => e.stopPropagation()}>

        {/* HEADER */}
        <div className="pp-header">
          <div className="pp-header-left">
            <div className="pp-dot" />
            <span className="pp-header-label">Hunter Identity Verification</span>
          </div>
          <button className="pp-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="pp-body">
          {/* LEFT SIDEBAR */}
          <div className="pp-sidebar">
            {/* ID Card */}
            <div className="pp-id-card ds-glass ds-scanlines">
              <div className="pp-id-top">
                <div className="pp-id-chip" />
                <span className="pp-id-sys">SYSTEM ID CARD</span>
              </div>
              <div className="pp-id-middle">
                <div className={`pp-id-avatar ${user.status === 'DECEASED' ? 'pp-id-avatar--dead' : ''}`}>
                  {user.status === 'DECEASED' ? <Skull size={32} /> : user.name.charAt(0).toUpperCase()}
                </div>
                <div className="pp-id-info">
                  <div className="pp-field-label">NAME</div>
                  <div className="pp-field-val">{user.name}</div>
                  <div className="pp-field-label" style={{ marginTop: 10 }}>CLASS</div>
                  <div className="pp-field-val" style={{ color: "var(--accent-primary)", fontSize: "0.78rem" }}>
                    {user.player_class}
                  </div>
                  {user.status === 'DECEASED' && (
                    <div className="pp-deceased-badge">DECEASED</div>
                  )}
                </div>
              </div>
              <div className="pp-id-bottom">
                <div>
                  <div className="pp-field-label">RANK</div>
                  <div className="pp-big-val">{user.player_rank}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="pp-field-label">LEVEL</div>
                  <div className="pp-big-val" style={{ color: "var(--accent-primary)" }}>{user.level}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div>
              <div className="pp-section-label" style={{ marginBottom: 14 }}><Shield size={11} /> Combat Attributes</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {statsList.map(s => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span className="pp-field-label" style={{ marginBottom: 0 }}>{s.label}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 900, color: "#fff" }}>{s.value}</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, s.value)}%`, background: s.color, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            {!isSelf && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: "auto" }}>
                <Button variant="primary" style={{ height: 44, borderRadius: 12, fontSize: "0.82rem" }} onClick={handleWhisper}>
                  <MessageSquare size={14} /> Whisper
                </Button>
                <Button
                  variant="secondary"
                  style={{ height: 44, borderRadius: 12, fontSize: "0.82rem" }}
                  onClick={handleAddFriend}
                  disabled={friendStatus !== "none" || actionLoading}
                >
                  <UserPlus size={14} />
                  {friendStatus === "none" ? "Add Friend" : "Companion"}
                </Button>
              </div>
            )}
          </div>

          {/* RIGHT CONTENT */}
          <div className="pp-content">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
              {/* Radar */}
              <div>
                <div className="pp-section-label" style={{ marginBottom: 14 }}><Zap size={11} /> Resonance Potential</div>
                <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "16px 8px" }}>
                  {/* Extra padding so radar labels don't clip */}
                  <PerformanceRadar data={areaStats} height={230} />
                </div>
              </div>

              {/* Skills */}
              <div>
                <div className="pp-section-label" style={{ marginBottom: 14 }}><Swords size={11} /> Active Skills</div>
                {skills.length === 0 ? (
                  <div style={{
                    fontSize: "0.78rem", color: "rgba(255,255,255,0.25)",
                    border: "1px dashed rgba(255,255,255,0.08)", borderRadius: 14,
                    padding: 24, textAlign: "center", fontWeight: 600,
                  }}>
                    No skills detected.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {skills.slice(0, 4).map(skill => (
                      <AuraCard
                        key={skill.id} name={skill.name} rankLabel={`LV.${skill.level}`}
                        rarityColor="#a8a8ff" isCollected={true} effectType="shadow"
                        icon={<Skull size={13} />} sub={skill.description}
                        label="SKILL" style={{ height: 110 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Guild */}
            {user.guild_id && (
              <div style={{ marginTop: 24 }}>
                <div className="pp-section-label" style={{ marginBottom: 14 }}><Medal size={11} /> Guild Affiliation</div>
                <div style={{ maxWidth: 360 }}>
                  <AuraCard
                    name={user.guild_title || "Hunter"} rankLabel="GUILD"
                    rarityColor="#ffcc00" isCollected={true}
                    effectType={(user.guild_aura_card as any) || "shadow"}
                    icon={<div style={{ fontSize: "1.4rem" }}>{user.guild_logo || "⚜️"}</div>}
                    sub="Verified Association Member" label="GUILD"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   LEADERBOARD PAGE
═══════════════════════════════════════════════ */
export function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<LBTab>("Hunters");
  const [hunters, setHunters] = useState<LBUser[]>([]);
  const [guilds, setGuilds] = useState<GuildLB[]>([]);
  const [clans, setClans] = useState<ClanLB[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LBUser | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const [hRes, gRes, cRes] = await Promise.all([
          supabase.from("user_profiles")
            .select("user_id, name, level, total_points, player_class, player_rank, player_title, guild_id, strength, agility, intelligence, vitality, guild_logo, guild_title, guild_aura_card, status, last_heartbeat")
            .order("total_points", { ascending: false }).limit(100),
          supabase.from("guilds").select("id, name"),
          supabase.from("clans").select("id, name"),
        ]);

        if (hRes.error) console.error("Hunter Fetch Error:", hRes.error);
        setHunters(hRes.data ?? []);

        // System Sweep: Flag hunters as DECEASED after 14 days of inactivity
        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("user_profiles")
          .update({ status: 'DECEASED' })
          .lt("last_heartbeat", fourteenDaysAgo)
          .eq("status", "ACTIVE");

        const { data: allProfs, error: pErr } = await supabase
          .from("user_profiles").select("user_id, total_points, guild_id");
        if (pErr) console.error("Profile Fetch Error:", pErr);

        if (gRes.data?.length) {
          const gXP = new Map<string, { xp: number; count: number }>();
          (allProfs ?? []).forEach((p: any) => {
            if (p.guild_id) {
              const c = gXP.get(p.guild_id) ?? { xp: 0, count: 0 };
              gXP.set(p.guild_id, { xp: c.xp + (p.total_points ?? 0), count: c.count + 1 });
            }
          });
          setGuilds((gRes.data ?? []).map(g => ({
            id: g.id, name: g.name,
            total_xp: gXP.get(g.id)?.xp ?? 0,
            member_count: gXP.get(g.id)?.count ?? 0,
          })).sort((a, b) => b.total_xp - a.total_xp));
        }

        if (cRes.data?.length) {
          const { data: cms } = await supabase.from("clan_members").select("clan_id, user_id");
          const cXP = new Map<string, { xp: number; count: number }>();
          (cms ?? []).forEach((cm: any) => {
            const prof = allProfs?.find((p: any) => p.user_id === cm.user_id);
            const c = cXP.get(cm.clan_id) ?? { xp: 0, count: 0 };
            cXP.set(cm.clan_id, { xp: c.xp + (prof?.total_points ?? 0), count: c.count + 1 });
          });
          setClans((cRes.data ?? []).map(c => ({
            id: c.id, name: c.name,
            total_xp: cXP.get(c.id)?.xp ?? 0,
            member_count: cXP.get(c.id)?.count ?? 0,
          })).filter(c => c.member_count >= 1).sort((a, b) => b.total_xp - a.total_xp));
        }
      } catch (err) {
        console.error("Leaderboard Load Error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isMe = (id: string) => id === user?.id;
  
  const currentData: any[] = useMemo(() => {
    let base: any[] = tab === "Hunters" ? hunters : tab === "Guilds" ? guilds : clans;
    if (searchQuery.trim()) {
      base = base.filter((u: any) => u.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return base;
  }, [tab, hunters, guilds, clans, searchQuery]);

  const podiumOrder = useMemo(() => {
    if (currentData.length >= 3) return [currentData[1], currentData[0], currentData[2]];
    if (currentData.length === 2) return [currentData[1], currentData[0]];
    return currentData.slice(0, 1);
  }, [currentData]);

  const getRealIdx = (u: any) => {
    const uid = u.user_id || u.id;
    return currentData.findIndex((h: any) => (h.user_id || h.id) === uid);
  };

  const getPoints = (u: any): number =>
    tab === "Hunters" ? (u as LBUser).total_points : (u as GuildLB).total_xp;

  /* ── Podium card ── */
  const renderPodiumCard = (u: any) => {
    if (!u) return null;
    const ri = getRealIdx(u);
    const uid = u.user_id || u.id;
    const name = u.name as string;
    const pts = getPoints(u);
    const col = RANK_COLOR[ri] ?? "rgba(255,255,255,0.3)";
    const isFirst = ri === 0;

    return (
      <div
        key={uid}
        className={`pod-card${isFirst ? " pod-card--first" : ""}`}
        style={{ 
          borderTopColor: col, 
          boxShadow: isFirst ? `0 0 40px ${RANK_AURA[ri]}` : `0 0 20px ${RANK_AURA[ri]}`
        }}
        onClick={() => { if (tab === "Hunters") setSelectedUser(u as LBUser); }}
      >
        {isFirst && <div className="pod-crown">👑</div>}
        <div className="pod-avatar" style={{ borderColor: col }}>{name.charAt(0).toUpperCase()}</div>
        <div className="pod-medal">{MEDALLION[ri] ?? `#${ri + 1}`}</div>
        <div className="pod-name">{tab === "Hunters" && isMe(uid) ? "You" : name}</div>
        <div className="pod-sub" style={{ color: col }}>
          {tab === "Hunters" ? (u as LBUser).player_class : `${(u as GuildLB).member_count} members`}
        </div>
        <div className="pod-xp-wrap">
          <span className="pod-xp-val" style={{ color: col }}>{pts.toLocaleString()}</span>
          <span className="pod-xp-label">XP</span>
        </div>
        <div className="pod-base" style={{ background: `linear-gradient(180deg, ${col} 0%, transparent 100%)`, opacity: 0.15, height: 10, width: '100%', marginTop: 'auto' }} />
      </div>
    );
  };

  /* ── Card/Row ── */
  const renderRow = (u: any, i: number) => {
    const realIdx = i + podiumOrder.length;
    const uid = u.user_id || u.id;
    const name = u.name as string;
    const pts = getPoints(u);

    return (
      <div
        key={uid}
        className={`lb-row${isMe(uid) ? " lb-row--me" : ""}${tab === "Hunters" ? " lb-row--click" : ""}`}
        onClick={() => { if (tab === "Hunters") setSelectedUser(u as LBUser); }}
      >
        <div className="lb-rank">
          {realIdx < 3
            ? <span style={{ fontSize: "1.2rem" }}>{MEDALLION[realIdx]}</span>
            : <span className="lb-num">#{realIdx + 1}</span>}
        </div>

        <div className="lb-row-header">
          <div className="lb-avatar">
            {tab === "Hunters" ? name.charAt(0).toUpperCase() : <Shield size={18} />}
          </div>
          <div className="lb-info">
            <div className="lb-name">
              {isMe(uid) ? "You" : name}
              {tab === "Hunters" && (
                <span className="lb-rank-pill">{(u as LBUser).player_rank}</span>
              )}
            </div>
            <div className="lb-sub">
              {(u as any).status === 'DECEASED' ? (
                <span style={{ color: 'var(--destruction-red)', fontWeight: 900 }}>[ DECEASED ]</span>
              ) : (
                `${(u as LBUser).player_class} · LV.${(u as LBUser).level}`
              )}
              {tab !== "Hunters" && `${(u as GuildLB).member_count} members`}
            </div>
          </div>
        </div>

        <div className="lb-xp">
          <span className="lb-xp-val">{pts.toLocaleString()}</span>
          <span className="lb-xp-label">SYSTEM XP</span>
        </div>
      </div>
    );
  };

  return (
    <section className="page leaderboard-page">
      <div style={{ marginBottom: 36 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Hall of Monarchs</h2>
        <p style={{ fontSize: "0.72rem", letterSpacing: "0.18em", opacity: 0.45, textTransform: "uppercase", marginTop: 6, fontWeight: 700 }}>
          {hunters.length} Hunters Synchronized with System
        </p>
      </div>

      {/* Tabs & Search */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, marginBottom: 36, flexWrap: "wrap" }}>
        <div className="lb-tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
          {(["Hunters", "Guilds", "Clans"] as LBTab[]).map(t => (
            <button key={t} className={`lb-tab${tab === t ? " lb-tab--active" : ""}`} onClick={() => setTab(t)}>
              {t === "Hunters" ? <Swords size={13} /> : t === "Guilds" ? <Shield size={13} /> : <Trophy size={13} />}
              {t}
            </button>
          ))}
        </div>

        <div className="lb-search-wrap">
          <input 
            type="text" 
            className="lb-search-input" 
            placeholder={`Search ${tab.toLowerCase()}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="panel panel-empty text-muted text-sm">Querying ranked data…</div>
      ) : (
        <>
          {currentData.length > 0 && (
            <div className="lb-podium-wrap">
              <div className="lb-podium">
                {podiumOrder.map(u => renderPodiumCard(u))}
              </div>
            </div>
          )}

          {currentData.length > podiumOrder.length && (
            <div className="lb-list-card">
              {currentData.slice(podiumOrder.length).map((u, i) => renderRow(u, i))}
            </div>
          )}

          {currentData.length === 0 && (
            <div className="panel panel-empty text-muted text-sm">No data available.</div>
          )}
        </>
      )}

      {selectedUser && (
        <PlayerProfilePopup user={selectedUser} onClose={() => setSelectedUser(null)} />
      )}

      <style>{`
        /* TABS */
        .lb-tabs {
          display: flex; gap: 8px; margin-bottom: 36px;
          border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 14px;
        }
        .lb-tab {
          display: flex; align-items: center; gap: 7px;
          background: transparent; border: 1px solid transparent;
          color: rgba(255,255,255,0.38); font-size: 0.82rem; font-weight: 700;
          padding: 8px 18px; border-radius: var(--r-md); cursor: pointer; transition: all 0.18s;
          letter-spacing: 0.05em;
        }
        .lb-tab:hover { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.65); }
        .lb-tab--active {
          background: rgba(168,168,255,0.09);
          border-color: rgba(168,168,255,0.22);
          color: var(--accent-primary);
        }

        /* SEARCH */
        .lb-search-wrap {
          flex: 1; min-width: 240px; max-width: 400px;
        }
        .lb-search-input {
          width: 100%; padding: 12px 20px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: var(--r-md); color: #fff; font-size: 0.82rem;
          transition: all 0.2s;
        }
        .lb-search-input:focus {
          outline: none; background: rgba(255,255,255,0.05);
          border-color: var(--accent-primary);
          box-shadow: 0 0 15px rgba(168,168,255,0.1);
        }

        /* PODIUM */
        .lb-podium-wrap {
          display: flex; justify-content: center;
          margin-bottom: 40px; padding-top: 50px;
        }
        .lb-podium { display: flex; align-items: flex-end; gap: 16px; }

        .pod-card {
          position: relative; width: 170px;
          background: rgba(10,10,18,0.4);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.05);
          border-top-width: 3px; border-radius: var(--r-xl);
          padding: 32px 12px 0; cursor: pointer;
          display: flex; flex-direction: column; align-items: center;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .pod-card:hover { transform: translateY(-10px); border-color: rgba(255,255,255,0.15); box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        .pod-card--first { width: 220px; z-index: 2; transform: scale(1.05); border-top-width: 4px; }
        .pod-card--first:hover { transform: scale(1.05) translateY(-10px); }

        .pod-crown {
          position: absolute; top: -16px; left: 50%; transform: translateX(-50%);
          font-size: 2.2rem; filter: drop-shadow(0 0 15px rgba(255,215,0,0.7));
          pointer-events: none; z-index: 3;
          animation: crownPulse 2s infinite ease-in-out;
        }
        @keyframes crownPulse { 0%, 100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.1); } }

        .pod-avatar {
          width: 60px; height: 60px; border-radius: var(--r-md);
          background: rgba(255,255,255,0.03); border: 2px solid;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem; font-weight: 900; color: #fff;
          margin-bottom: 12px; margin-top: 8px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        }
        .pod-card--first .pod-avatar { width: 80px; height: 80px; font-size: 2.2rem; border-width: 3px; }

        .pod-medal  { font-size: 1.4rem; margin-bottom: 6px; }
        .pod-name   { font-size: 1rem; font-weight: 800; color: #fff; text-align: center; }
        .pod-sub    { font-size: 0.65rem; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 4px; text-align: center; opacity: 0.6; }
        .pod-xp-wrap { margin: 16px 0 20px; text-align: center; }
        .pod-xp-val  { font-size: 1.3rem; font-weight: 900; text-shadow: 0 0 10px rgba(255,255,255,0.1); }
        .pod-card--first .pod-xp-val { font-size: 1.6rem; }
        .pod-xp-label { display: block; font-size: 0.55rem; font-weight: 800; letter-spacing: 2px; color: rgba(255,255,255,0.3); margin-top: 1px; }
        .pod-base { width: 100%; height: 6px; }

        /* LIST GRID */
        .lb-list-card {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 100px;
          padding: 10px;
        }
        .lb-row {
          background: rgba(255,255,255,0.03);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: var(--r-lg);
          display: flex;
          flex-direction: column;
          padding: 24px;
          gap: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .lb-row--click { cursor: pointer; }
        .lb-row--click:hover { 
          background: rgba(168,168,255,0.08); 
          border-color: rgba(168,168,255,0.3);
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        .lb-row--me { 
          background: rgba(168,168,255,0.12); 
          border-color: var(--accent-primary);
          box-shadow: 0 0 20px rgba(168,168,255,0.15);
        }

        .lb-row-header {
          display: flex;
          align-items: center;
          gap: 16px;
          width: 100%;
        }

        .lb-rank { 
          position: absolute;
          top: 16px;
          right: 20px;
          width: auto;
          opacity: 0.5;
        }
        .lb-num { font-size: 0.8rem; font-weight: 900; color: var(--accent-primary); }

        .lb-avatar {
          width: 54px; height: 54px; border-radius: var(--r-md);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem; font-weight: 900; color: #fff;
          flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }

        .lb-info { flex: 1; min-width: 0; }
        .lb-name {
          font-size: 1.1rem; font-weight: 900; color: #fff;
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 4px;
        }
        .lb-rank-pill {
          font-size: 0.6rem; font-weight: 900; letter-spacing: 0.8px;
          padding: 2px 8px; border-radius: 8px;
          background: var(--accent-primary);
          color: #000;
        }
        .lb-sub { font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

        .lb-xp { 
          width: 100%;
          display: flex;
          align-items: baseline;
          gap: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .lb-xp-val { font-size: 1.4rem; font-weight: 900; color: var(--accent-primary); }
        .lb-xp-label { font-size: 0.6rem; font-weight: 900; letter-spacing: 2px; color: rgba(255,255,255,0.2); }

        /* ══ PROFILE POPUP ══ */
        .pp-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.9); backdrop-filter: blur(25px);
          display: flex; align-items: center; justify-content: center;
          z-index: 999999; animation: ppFade 0.3s ease;
        }
        @keyframes ppFade { from { opacity: 0; } to { opacity: 1; } }

        .pp-modal {
          width: min(960px, 94vw); height: min(680px, 88vh);
          display: flex; flex-direction: column;
          border-radius: 24px; overflow: hidden;
          border: 1px solid rgba(168,168,255,0.14);
          box-shadow: 0 40px 100px rgba(0,0,0,0.75);
          animation: ppSlide 0.28s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes ppSlide { from { transform: translateY(18px); opacity: 0; } to { transform: none; opacity: 1; } }

        .pp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 28px; height: 60px; flex-shrink: 0;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.015);
        }
        .pp-header-left { display: flex; align-items: center; gap: 11px; }
        .pp-dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: var(--accent-primary); box-shadow: 0 0 10px var(--accent-primary);
        }
        .pp-header-label {
          font-size: 0.62rem; font-weight: 900;
          letter-spacing: 4px; text-transform: uppercase; color: rgba(255,255,255,0.45);
        }
        .pp-close {
          background: none; border: none; color: rgba(255,255,255,0.22);
          cursor: pointer; padding: 6px; border-radius: 8px; transition: 0.15s;
          display: flex; align-items: center;
        }
        .pp-close:hover { color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.06); }

        .pp-body { display: flex; flex: 1; overflow: hidden; }

        .pp-sidebar {
          width: 300px; flex-shrink: 0;
          background: rgba(4,4,10,0.75);
          border-right: 1px solid rgba(255,255,255,0.06);
          padding: 24px 22px;
          display: flex; flex-direction: column; gap: 22px;
          overflow-y: auto;
        }

        .pp-id-card {
          border-radius: var(--r-lg); padding: 22px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .pp-id-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .pp-id-chip {
          width: 26px; height: 20px;
          background: linear-gradient(135deg, #ffd700, #b8860b); border-radius: 4px;
        }
        .pp-id-sys { font-size: 0.42rem; opacity: 0.38; font-weight: 900; letter-spacing: 1.5px; }

        .pp-id-middle { display: flex; gap: 12px; margin-bottom: 16px; }
        .pp-id-avatar {
          width: 68px; height: 84px; flex-shrink: 0;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09); border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.9rem; font-weight: 900; color: rgba(168,168,255,0.3);
        }
        .pp-id-info { flex: 1; min-width: 0; }

        .pp-field-label {
          font-size: 0.42rem; font-weight: 900;
          letter-spacing: 1.5px; color: rgba(255,255,255,0.28);
          text-transform: uppercase; margin-bottom: 3px; display: block;
        }
        .pp-field-val {
          font-size: 0.85rem; font-weight: 900; color: #fff;
          text-transform: uppercase; word-break: break-word;
        }

        .pp-id-bottom {
          display: flex; justify-content: space-between; align-items: flex-end;
          padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.06);
        }
        .pp-big-val { font-size: 1.55rem; font-weight: 900; color: #fff; line-height: 1; }

        .pp-section-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 0.6rem; font-weight: 900;
          letter-spacing: 2px; text-transform: uppercase;
          color: rgba(255,255,255,0.32);
        }

        .pp-content {
          flex: 1; overflow-y: auto;
          padding: 24px 26px;
          display: flex; flex-direction: column; gap: 0;
        }
        
        .pp-id-avatar--dead {
          color: var(--destruction-red) !important;
          border-color: var(--destruction-red) !important;
          background: rgba(239, 68, 68, 0.05) !important;
          opacity: 0.6;
        }
        
        .pp-deceased-badge {
          margin-top: 6px;
          background: var(--destruction-red);
          color: #fff;
          font-size: 0.5rem;
          font-weight: 900;
          padding: 2px 6px;
          border-radius: 4px;
          width: fit-content;
          letter-spacing: 1px;
        }
      `}</style>
    </section>
  );
}