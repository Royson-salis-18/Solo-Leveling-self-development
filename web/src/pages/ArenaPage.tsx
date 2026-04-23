import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import {
  Shield, Swords, Crown, Plus, Mail,
  LogOut, Trophy, Zap, Target, Timer, Star
} from "lucide-react";

/* ─────────────────────── types ─────────────────────── */
type Guild = { id: string; name: string; description: string; leader_id: string; member_count: number; min_rank: string };
type Clan  = { id: string; name: string; description: string; leader_id: string };
type Member = { user_id: string; name: string; role: string; level: number; total_points: number; player_class: string; player_rank: string };
type Challenge = {
  id: string; creator_id: string; opponent_id: string;
  target_points: number; creator_start_pts: number; opponent_start_pts: number;
  expires_at: string; status: string;
  creator_name: string; opponent_name: string;
  creator_pts: number; opponent_pts: number;
};
type GroupEvent = {
  id: string; title: string; description: string; event_type: string;
  xp_reward: number; start_time: string; end_time: string; status: string;
};

const TABS = ["1v1 Duels", "Clan", "Guild"] as const;
type Tab = typeof TABS[number];

/* ─────────────────────── component ─────────────────────── */
export function ArenaPage() {
  const { user, profile } = useAuth();
  const [tab, setTab]           = useState<Tab>("1v1 Duels");
  const [clan, setClan]         = useState<Clan | null>(null);
  const [guild, setGuild]       = useState<Guild | null>(null);
  const [clanMembers, setClanMembers]   = useState<Member[]>([]);
  const [guildMembers, setGuildMembers] = useState<Member[]>([]);
  const [challenges, setChallenges]     = useState<Challenge[]>([]);
  const [clanEvents, setClanEvents]     = useState<GroupEvent[]>([]);
  const [guildEvents, setGuildEvents]   = useState<GroupEvent[]>([]);
  const [isLeader,  setIsLeader]  = useState(false);
  const [loading, setLoading]   = useState(true);

  // modals
  const [showCreateClan,    setShowCreateClan]    = useState(false);
  const [showCreateGuild,   setShowCreateGuild]   = useState(false);
  const [showInviteClan,    setShowInviteClan]    = useState(false);
  const [showInviteGuild,   setShowInviteGuild]   = useState(false);
  const [showNewChallenge,  setShowNewChallenge]  = useState(false);
  const [showNewClanEvent,  setShowNewClanEvent]  = useState(false);
  const [showNewGuildEvent, setShowNewGuildEvent] = useState(false);
  const [showAssignQuest,   setShowAssignQuest]   = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const [form, setForm] = useState({
    name: "", desc: "", hunterId: "", minRank: "E",
    targetPts: 50, days: 2
  });

  // assign quest form
  const [aq, setAq] = useState({
    assignTo: "", title: "", category: "General",
    points: 10, priority: "Normal", deadline: "", description: ""
  });

  const [eventForm, setEventForm] = useState({
    title: "", description: "", type: "Rally", reward: 50, days: 3, opponentId: ""
  });

  /* ── fetch everything ── */
  const fetchAll = async () => {
    if (!supabase || !user) return;
    setLoading(true);

    // Clan membership
    const { data: clanMembership } = await supabase
      .from("clan_members").select("clan_id").eq("user_id", user.id).maybeSingle();

    if (clanMembership) {
      const [{ data: clanData }, { data: clanMR }, { data: cEvents }] = await Promise.all([
        supabase.from("clans").select("*").eq("id", clanMembership.clan_id).single(),
        supabase.from("clan_members").select("user_id, role").eq("clan_id", clanMembership.clan_id),
        supabase.from("clan_events").select("*").eq("clan_id", clanMembership.clan_id).eq("status", "active"),
      ]);
      setClan(clanData);
      setClanEvents(cEvents ?? []);
      if (clanMR) {
        const uids = clanMR.map((m: any) => m.user_id);
        const { data: profs } = await supabase.from("user_profiles").select("*").in("user_id", uids);
        const enriched = clanMR.map((m: any) => {
          const p = profs?.find((p: any) => p.user_id === m.user_id);
          return { ...m, ...p } as Member;
        }).sort((a: Member, b: Member) => (b.total_points || 0) - (a.total_points || 0));
        setClanMembers(enriched);
        // determine leadership
        const myRole = clanMR.find((m: any) => m.user_id === user?.id)?.role;
        setIsLeader(myRole === "leader" || myRole === "officer");
      }
    } else { setClan(null); setIsLeader(false); setClanEvents([]); }

    // Guild membership
    const { data: guildMembership } = await supabase
      .from("user_profiles").select("guild_id").eq("user_id", user.id).maybeSingle();

    if (guildMembership?.guild_id) {
      const [{ data: guildData }, { data: guildProfs }, { data: gEvents }] = await Promise.all([
        supabase.from("guilds").select("*").eq("id", guildMembership.guild_id).single(),
        supabase.from("user_profiles").select("*").eq("guild_id", guildMembership.guild_id),
        supabase.from("guild_events").select("*").eq("guild_id", guildMembership.guild_id).eq("status", "active")
      ]);
      setGuild(guildData);
      setGuildMembers((guildProfs ?? []).sort((a: any, b: any) => b.total_points - a.total_points));
      setGuildEvents(gEvents ?? []);
    } else { setGuild(null); setGuildEvents([]); }

    // Challenges
    const { data: chals } = await supabase.from("challenges")
      .select("*")
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq("status", "active");

    if (chals?.length) {
      const uids = Array.from(new Set(chals.flatMap((c: any) => [c.creator_id, c.opponent_id])));
      const { data: profs } = await supabase.from("user_profiles").select("user_id, name, total_points").in("user_id", uids);
      setChallenges(chals.map((c: any) => {
        const cr = profs?.find((p: any) => p.user_id === c.creator_id);
        const op = profs?.find((p: any) => p.user_id === c.opponent_id);
        return {
          ...c,
          creator_name: cr?.name || "Unknown",
          opponent_name: op?.name || "Unknown",
          creator_pts: Math.max(0, (cr?.total_points || 0) - c.creator_start_pts),
          opponent_pts: Math.max(0, (op?.total_points || 0) - c.opponent_start_pts),
        };
      }));
    } else { setChallenges([]); }

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [user]);

  /* ── actions ── */
  const createClan = async () => {
    if (!supabase || !user || !form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("clans")
      .insert({ name: form.name, description: form.desc, leader_id: user.id })
      .select().single();
    if (error) { alert("Failed to create clan: " + error.message); setSaving(false); return; }
    if (data) {
      // Add creator as leader in clan_members
      await supabase.from("clan_members").insert({ clan_id: data.id, user_id: user.id, role: "leader" });
      // Link clan to creator's profile
      await supabase.from("user_profiles").update({ clan_id: data.id }).eq("user_id", user.id);
    }
    setSaving(false); setShowCreateClan(false); setForm({ ...form, name: "", desc: "" }); fetchAll();
  };

  const createGuild = async () => {
    if (!supabase || !user || !form.name.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("guilds").insert({
      name: form.name, description: form.desc,
      leader_id: user.id, member_count: 1, min_rank: form.minRank
    }).select().single();
    if (error) { alert("Failed to create guild: " + error.message); setSaving(false); return; }
    // Link guild to creator's profile (guild master)
    if (data) await supabase.from("user_profiles").update({ guild_id: data.id }).eq("user_id", user.id);
    setSaving(false); setShowCreateGuild(false); setForm({ ...form, name: "", desc: "" }); fetchAll();
  };

  const inviteByHunterId = async (type: "clan" | "guild") => {
    if (!supabase || !user || !form.hunterId.trim()) return;
    setSaving(true);
    const code = form.hunterId.trim();
    // Support both short 8-char code and full UUID
    const isFullUUID = code.length === 36 && code.includes("-");
    let targetId: string | null = null;
    if (isFullUUID) {
      const { data: prof } = await supabase.from("user_profiles").select("user_id").eq("user_id", code).maybeSingle();
      targetId = prof?.user_id ?? null;
    } else {
      const { data: results } = await supabase.from("user_profiles").select("user_id").eq("hunter_code", code.toUpperCase()).limit(1);
      targetId = results?.[0]?.user_id ?? null;
    }
    if (!targetId) { alert("Hunter not found in system."); setSaving(false); return; }
    if (targetId === user.id) { alert("You can't invite yourself."); setSaving(false); return; }

    if (type === "clan" && clan) {
      if (clanMembers.length >= 5) { alert("Clan is full (max 5)."); setSaving(false); return; }
      const { error } = await supabase.from("clan_members").insert({ clan_id: clan.id, user_id: targetId, role: "member" });
      if (error) { alert("Invite failed: " + error.message); setSaving(false); return; }
      await supabase.from("user_profiles").update({ clan_id: clan.id }).eq("user_id", targetId);
      await supabase.from("clan_invites").insert({ clan_id: clan.id, inviter_id: user.id, invitee_id: targetId, status: "accepted" });
      setShowInviteClan(false);
    } else if (type === "guild" && guild) {
      if (guildMembers.length >= 20) { alert("Guild is full (max 20)."); setSaving(false); return; }
      await supabase.from("user_profiles").update({ guild_id: guild.id }).eq("user_id", targetId);
      setShowInviteGuild(false);
    }
    setSaving(false); setForm({ ...form, hunterId: "" }); fetchAll();
  };

  const createChallenge = async () => {
    if (!supabase || !user || !form.hunterId.trim()) return;
    setSaving(true);
    const code = form.hunterId.trim();
    const isFullUUID = code.length === 36 && code.includes("-");
    let opponentId: string | null = null;
    if (isFullUUID) {
      const { data: prof } = await supabase.from("user_profiles").select("user_id").eq("user_id", code).maybeSingle();
      opponentId = prof?.user_id ?? null;
    } else {
      const { data: results } = await supabase.from("user_profiles").select("user_id").eq("hunter_code", code.toUpperCase()).limit(1);
      opponentId = results?.[0]?.user_id ?? null;
    }
    if (!opponentId) { alert("Opponent not found."); setSaving(false); return; }
    if (opponentId === user.id) { alert("You can't challenge yourself."); setSaving(false); return; }
    const { data: myProf } = await supabase.from("user_profiles").select("total_points").eq("user_id", user.id).single();
    const { data: opProf } = await supabase.from("user_profiles").select("total_points").eq("user_id", opponentId).single();
    const expires = new Date(Date.now() + form.days * 86400000).toISOString();
    await supabase.from("challenges").insert({
      creator_id: user.id,
      opponent_id: opponentId,
      target_points: form.targetPts,
      creator_start_pts: myProf?.total_points || 0,
      opponent_start_pts: opProf?.total_points || 0,
      expires_at: expires,
      status: "active",
    });

    // Notify opponent
    await supabase.from("notifications").insert({
      user_id: opponentId,
      title: "New Challenge Issued!",
      message: `${profile?.name || "A hunter"} has challenged you to a 1v1 Duel!`,
      type: "duel",
      link: "/challenges"
    });

    setSaving(false); setShowNewChallenge(false); setForm({ ...form, hunterId: "" }); fetchAll();
  };

  const leaveClan = async () => {
    if (!supabase || !user || !clan) return;
    if (!confirm(`Leave ${clan.name}?`)) return;
    await supabase.from("clan_members").delete().eq("clan_id", clan.id).eq("user_id", user.id);
    fetchAll();
  };

  const assignQuest = async () => {
    if (!supabase || !user || !aq.assignTo || !aq.title.trim()) return;
    setSaving(true);
    await supabase.from("tasks").insert({
      user_id:     user.id,
      assigned_to: aq.assignTo,
      title:       aq.title,
      category:    aq.category,
      points:      Math.max(1, aq.points),
      priority:    aq.priority,
      deadline:    aq.deadline || null,
      description: aq.description,
    });

    // Notify member
    await supabase.from("notifications").insert({
      user_id: aq.assignTo,
      title: "New Mission Assigned",
      message: `Leader ${profile?.name || "of your clan"} has assigned you a new quest: ${aq.title}`,
      type: "assignment",
      link: "/quests"
    });

    setSaving(false);
    setShowAssignQuest(false);
    setAq({ assignTo: "", title: "", category: "General", points: 10, priority: "Normal", deadline: "", description: "" });
  };

  const createEvent = async (group: "clan" | "guild") => {
    if (!supabase || !user) return;
    setSaving(true);
    const table = group === "clan" ? "clan_events" : "guild_events";
    const groupId = group === "clan" ? clan?.id : guild?.id;
    if (!groupId || !eventForm.title.trim()) { setSaving(false); return; }

    const start = new Date().toISOString();
    const end = new Date(Date.now() + eventForm.days * 86400000).toISOString();

    const payload = {
      creator_id: user.id,
      title: eventForm.title,
      description: eventForm.description,
      event_type: eventForm.type,
      xp_reward: eventForm.reward,
      start_time: start,
      end_time: end,
      status: "active"
    };

    if (group === "clan") {
      (payload as any).clan_id = groupId;
      if (eventForm.type === "War" && eventForm.opponentId.trim()) (payload as any).opponent_clan_id = eventForm.opponentId.trim();
    } else {
      (payload as any).guild_id = groupId;
      if (eventForm.type === "War" && eventForm.opponentId.trim()) (payload as any).opponent_guild_id = eventForm.opponentId.trim();
    }

    await supabase.from(table).insert(payload);
    
    setSaving(false);
    if (group === "clan") setShowNewClanEvent(false);
    else setShowNewGuildEvent(false);
    setEventForm({ title: "", description: "", type: "Rally", reward: 50, days: 3, opponentId: "" });
    fetchAll();
  };

  /* ── helpers ── */
  const timeLeft = (iso: string) => {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms < 0) return "Expired";
    const h = Math.floor(ms / 3600000);
    return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`;
  };

  const ClanSection = () => (
    <div className="arena-section">
      {!clan ? (
        <div className="arena-empty-state">
          <Shield size={48} className="arena-empty-icon" />
          <h3>No Clan</h3>
          <p className="text-muted text-sm">Form a strike team (3–5 hunters) to take on targets together.</p>
          <Button variant="primary" onClick={() => setShowCreateClan(true)}><Plus size={14} /> Establish Clan</Button>
        </div>
      ) : (
        <>
          <div className="arena-group-header">
            <div>
              <div className="arena-group-name">{clan.name}</div>
              <div className="text-xs text-muted">{clan.description}</div>
            </div>
            <div className="flex gap-8">
              {clanMembers.length < 5 && (
                <Button variant="secondary" size="sm" onClick={() => setShowInviteClan(true)}><Mail size={12} /> Recruit</Button>
              )}
              {isLeader && clanMembers.length > 1 && (
                <Button variant="secondary" size="sm" onClick={() => setShowAssignQuest(true)}><Plus size={12} /> Assign Quest</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setShowNewClanEvent(true)}><Zap size={12} /> Event</Button>
              <Button variant="danger" size="sm" onClick={leaveClan}><LogOut size={12} /></Button>
            </div>
          </div>

          <div className="arena-capacity-bar">
            <div style={{ flex: 1 }}>
              <div className="flex-between mb-4">
                <span className="text-xs text-muted">Roster</span>
                <span className="text-xs font-700">{clanMembers.length} / 5 <span className={clanMembers.length < 3 ? "text-danger" : ""}>{clanMembers.length < 3 ? "(need 3 min)" : ""}</span></span>
              </div>
              <div className="capacity-track">
                <div className="capacity-fill" style={{ width: `${(clanMembers.length / 5) * 100}%`, background: clanMembers.length < 3 ? "#ff4444" : "rgba(255,255,255,0.5)" }} />
              </div>
            </div>
          </div>

          <div className="arena-roster">
            {clanMembers.map((m, i) => (
              <div key={m.user_id} className={`arena-member-row ${m.user_id === user?.id ? "arena-member-me" : ""}`}>
                <span className="arena-rank-num">#{i + 1}</span>
                <div className="arena-avatar">{m.name?.[0]?.toUpperCase()}</div>
                <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex gap-6">
                    <span className="text-sm font-700 truncate">{m.user_id === user?.id ? "You" : m.name}</span>
                    {m.role === "leader" && <Crown size={11} style={{ color: "#ffcc00", flexShrink: 0 }} />}
                  </div>
                  <span className="text-xs text-muted">{m.player_class} · {m.player_rank}-Rank · <span style={{ fontFamily: 'monospace', color: 'rgba(168,168,255,0.5)', fontSize: '0.58rem' }}>#{m.user_id.slice(0,8).toUpperCase()}</span></span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-800" style={{ color: "#fff" }}>{(m.total_points || 0).toLocaleString()}</div>
                  <div className="text-xs text-muted">XP</div>
                </div>
              </div>
            ))}
          </div>

          {/* Active Events */}
          {clanEvents.length > 0 && (
            <div className="mt-16">
              <div className="text-xs text-muted uppercase tracking-widest mb-8">Active Events</div>
              <div className="flex-col gap-8">
                {clanEvents.map(e => (
                  <div key={e.id} className="glass-panel panel-no-pad" style={{ padding: 12, borderLeft: "3px solid #ffcc00", background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex-between">
                      <div>
                        <div className="text-sm font-700">{e.title}</div>
                        <div className="text-xs text-muted">{e.description}</div>
                      </div>
                      <div className="text-right">
                        <span className="tag" style={{ color: "#ffcc00", borderColor: "rgba(255,204,0,0.3)" }}>{e.event_type}</span>
                        <div className="text-xs font-700 mt-4" style={{ color: "#34d399" }}>+{e.xp_reward} XP</div>
                      </div>
                    </div>
                    <div className="text-xs mt-8" style={{ color: "var(--t3)" }}>
                      <Timer size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle", marginBottom: 2 }}/> {timeLeft(e.end_time)} remaining
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const GuildSection = () => (
    <div className="arena-section">
      {!guild ? (
        <div className="arena-empty-state">
          <Trophy size={48} className="arena-empty-icon" />
          <h3>No Guild</h3>
          <p className="text-muted text-sm">Join a powerful organization (5–20 hunters) or forge your own.</p>
          <Button variant="primary" onClick={() => setShowCreateGuild(true)}><Plus size={14} /> Found Guild</Button>
        </div>
      ) : (
        <>
          <div className="arena-group-header">
            <div>
              <div className="arena-group-name" style={{ color: "#ffcc00" }}>{guild.name}</div>
              <div className="text-xs text-muted">{guild.description}</div>
            </div>
            <div className="flex gap-8">
              {guildMembers.length < 20 && (
                <Button variant="secondary" size="sm" onClick={() => setShowInviteGuild(true)}><Mail size={12} /> Recruit</Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setShowNewGuildEvent(true)}><Star size={12} /> Event</Button>
            </div>
          </div>

          <div className="arena-capacity-bar">
            <div style={{ flex: 1 }}>
              <div className="flex-between mb-4">
                <span className="text-xs text-muted">Roster</span>
                <span className="text-xs font-700">{guildMembers.length} / 20 {guildMembers.length < 5 ? <span className="text-danger">(need 5 min)</span> : ""}</span>
              </div>
              <div className="capacity-track">
                <div className="capacity-fill" style={{ width: `${(guildMembers.length / 20) * 100}%`, background: guildMembers.length < 5 ? "#ff4444" : "#ffcc00" }} />
              </div>
            </div>
          </div>

          <div className="arena-roster">
            {guildMembers.slice(0, 10).map((m, i) => (
              <div key={m.user_id} className={`arena-member-row ${m.user_id === user?.id ? "arena-member-me" : ""}`}>
                <span className="arena-rank-num">#{i + 1}</span>
                <div className="arena-avatar" style={{ borderColor: "#ffcc00" }}>{m.name?.[0]?.toUpperCase()}</div>
                <div className="flex-col" style={{ flex: 1, minWidth: 0 }}>
                  <span className="text-sm font-700 truncate">{m.user_id === user?.id ? "You" : m.name}</span>
                  <span className="text-xs text-muted">{m.player_class} · {m.player_rank}-Rank · <span style={{ fontFamily: 'monospace', color: 'rgba(168,168,255,0.5)', fontSize: '0.58rem' }}>#{m.user_id.slice(0,8).toUpperCase()}</span></span>
                </div>
                <div className="text-sm font-800">{(m.total_points || 0).toLocaleString()} <span className="text-xs text-muted">XP</span></div>
              </div>
            ))}
            {guildMembers.length > 10 && (
              <div className="text-xs text-muted text-center py-8">+{guildMembers.length - 10} more members</div>
            )}
          </div>

          {/* Active Events */}
          {guildEvents.length > 0 && (
            <div className="mt-16">
              <div className="text-xs text-muted uppercase tracking-widest mb-8">Active Events</div>
              <div className="flex-col gap-8">
                {guildEvents.map(e => (
                  <div key={e.id} className="glass-panel panel-no-pad" style={{ padding: 12, borderLeft: "3px solid #ffcc00", background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex-between">
                      <div>
                        <div className="text-sm font-700">{e.title}</div>
                        <div className="text-xs text-muted">{e.description}</div>
                      </div>
                      <div className="text-right">
                        <span className="tag" style={{ color: "#ffcc00", borderColor: "rgba(255,204,0,0.3)" }}>{e.event_type}</span>
                        <div className="text-xs font-700 mt-4" style={{ color: "#34d399" }}>+{e.xp_reward} XP</div>
                      </div>
                    </div>
                    <div className="text-xs mt-8" style={{ color: "var(--t3)" }}>
                      <Timer size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle", marginBottom: 2 }}/> {timeLeft(e.end_time)} remaining
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  const DuelsSection = () => (
    <div className="arena-section">
      <div className="flex-between mb-16">
        <div>
          <div className="text-xs text-muted uppercase tracking-widest">Active Duels</div>
          <div className="text-sm font-700 mt-2">{challenges.length} ongoing</div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowNewChallenge(true)}>
          <Swords size={13} /> Issue Challenge
        </Button>
      </div>

      {challenges.length === 0 ? (
        <div className="arena-empty-state" style={{ padding: "40px 0" }}>
          <Swords size={36} className="arena-empty-icon" />
          <p className="text-muted text-sm mt-8">No active duels. Challenge a hunter to begin.</p>
        </div>
      ) : (
        <div className="flex-col gap-16">
          {challenges.map(c => {
            const isCreator = c.creator_id === user?.id;
            const myPts     = isCreator ? c.creator_pts : c.opponent_pts;
            const theirPts  = isCreator ? c.opponent_pts : c.creator_pts;
            const myName    = "You";
            const theirName = isCreator ? c.opponent_name : c.creator_name;
            const myPct     = Math.min((myPts / c.target_points) * 100, 100);
            const theirPct  = Math.min((theirPts / c.target_points) * 100, 100);
            const leading   = myPts >= theirPts;

            return (
              <div key={c.id} className="glass-panel duel-card" style={{ padding: "16px" }}>
                <div className="duel-header">
                  <div className="flex gap-6 text-xs text-muted">
                    <Timer size={12} /> {timeLeft(c.expires_at)} left
                  </div>
                  <div className="flex gap-6 text-xs font-700">
                    <Target size={12} style={{ color: "#ffcc00" }} /> {c.target_points} pts target
                  </div>
                </div>

                <div className="duel-vs">
                  <div className="duel-fighter">
                    <div className="duel-avatar" style={{ border: leading ? "2px solid #ffcc00" : "1px solid var(--border-1)" }}>Y</div>
                    <div className="duel-name">{myName}</div>
                    <div className="duel-pts" style={{ color: leading ? "#ffcc00" : "#fff" }}>{myPts}</div>
                    <div className="duel-bar-track">
                      <div className="duel-bar-fill" style={{ width: `${myPct}%`, background: leading ? "#ffcc00" : "rgba(255,255,255,0.5)" }} />
                    </div>
                  </div>

                  <div className="vs-badge">VS</div>

                  <div className="duel-fighter">
                    <div className="duel-avatar" style={{ border: !leading ? "2px solid #ff4444" : "1px solid var(--border-1)" }}>{theirName[0]}</div>
                    <div className="duel-name">{theirName}</div>
                    <div className="duel-pts" style={{ color: !leading ? "#ff4444" : "var(--t2)" }}>{theirPts}</div>
                    <div className="duel-bar-track">
                      <div className="duel-bar-fill" style={{ width: `${theirPct}%`, background: !leading ? "#ff4444" : "rgba(255,255,255,0.3)" }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ── render ── */
  return (
    <section className="page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Arena</h2>
          <p className="text-xs text-muted">Clan operations · Guild ops · Hunter duels</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="arena-tabs">
        {TABS.map(t => (
          <button key={t} className={`arena-tab${tab === t ? " arena-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t === "1v1 Duels" && <Swords size={14} />}
            {t === "Clan"     && <Shield size={14} />}
            {t === "Guild"    && <Trophy size={14} />}
            {t}
            {t === "1v1 Duels" && challenges.length > 0 && tab !== t && (
              <span className="arena-tab-badge">{challenges.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-panel panel-empty text-muted text-sm">Scanning arena grid…</div>
      ) : (
        <>
          {tab === "1v1 Duels" && <DuelsSection />}
          {tab === "Clan"      && <ClanSection />}
          {tab === "Guild"     && <GuildSection />}
        </>
      )}

      {/* ── Create Clan Modal ── */}
      <Modal isOpen={showCreateClan} title="Establish Clan" onClose={() => setShowCreateClan(false)}
        footer={<><Button variant="secondary" onClick={() => setShowCreateClan(false)}>Abort</Button>
                 <Button variant="primary" onClick={createClan} disabled={saving}>Initialize</Button></>}>
        <p className="text-xs text-muted mb-12">Clans are elite squads of 3–5 hunters. You become the leader.</p>
        <div className="form-group"><label className="form-label">Clan Name</label>
          <input className="form-input" placeholder="e.g. Shadow Vanguard" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Directive</label>
          <textarea className="form-textarea" placeholder="Mission statement..." value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
      </Modal>

      {/* ── Create Guild Modal ── */}
      <Modal isOpen={showCreateGuild} title="Found Guild" onClose={() => setShowCreateGuild(false)}
        footer={<><Button variant="secondary" onClick={() => setShowCreateGuild(false)}>Abort</Button>
                 <Button variant="primary" onClick={createGuild} disabled={saving}>Found</Button></>}>
        <p className="text-xs text-muted mb-12">Guilds are large organizations of 5–20 hunters. You will lead it.</p>
        <div className="form-group"><label className="form-label">Guild Name</label>
          <input className="form-input" placeholder="e.g. Abyss Coalition" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Charter</label>
          <textarea className="form-textarea" placeholder="Guild doctrine..." value={form.desc} onChange={e => setForm({ ...form, desc: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Min Rank Required</label>
          <select className="form-select" value={form.minRank} onChange={e => setForm({ ...form, minRank: e.target.value })}>
            {["E","D","C","B","A","S"].map(r => <option key={r}>{r}</option>)}
          </select></div>
      </Modal>

      {/* ── Invite Clan Modal ── */}
      <Modal isOpen={showInviteClan} title="Recruit to Clan" onClose={() => setShowInviteClan(false)}
        footer={<><Button variant="secondary" onClick={() => setShowInviteClan(false)}>Cancel</Button>
                 <Button variant="primary" onClick={() => inviteByHunterId("clan")} disabled={saving}>Transmit</Button></>}>
        <p className="text-xs text-muted mb-12">Up to 5 members allowed. Current: {clanMembers.length}/5</p>
        <div className="form-group"><label className="form-label">Hunter ID</label>
          <input className="form-input" placeholder="e.g. A3F6C21B or full UUID" value={form.hunterId} onChange={e => setForm({ ...form, hunterId: e.target.value })} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} /></div>
      </Modal>

      {/* ── Invite Guild Modal ── */}
      <Modal isOpen={showInviteGuild} title="Recruit to Guild" onClose={() => setShowInviteGuild(false)}
        footer={<><Button variant="secondary" onClick={() => setShowInviteGuild(false)}>Cancel</Button>
                 <Button variant="primary" onClick={() => inviteByHunterId("guild")} disabled={saving}>Transmit</Button></>}>
        <p className="text-xs text-muted mb-12">Up to 20 members. Current: {guildMembers.length}/20</p>
        <div className="form-group"><label className="form-label">Hunter ID</label>
          <input className="form-input" placeholder="e.g. A3F6C21B or full UUID" value={form.hunterId} onChange={e => setForm({ ...form, hunterId: e.target.value })} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} /></div>
      </Modal>

      {/* ── New 1v1 Challenge Modal ── */}
      <Modal isOpen={showNewChallenge} title="Issue Challenge" onClose={() => setShowNewChallenge(false)}
        footer={<><Button variant="secondary" onClick={() => setShowNewChallenge(false)}>Cancel</Button>
                 <Button variant="primary" onClick={createChallenge} disabled={saving}>⚔️ Initiate Duel</Button></>}>
        <p className="text-xs text-muted mb-12">Both hunters must earn target XP from scratch within the time limit.</p>
        <div className="form-group"><label className="form-label">Opponent Hunter ID</label>
          <input className="form-input" placeholder="e.g. A3F6C21B or full UUID" value={form.hunterId} onChange={e => setForm({ ...form, hunterId: e.target.value })} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Target XP</label>
            <input type="number" className="form-input" value={form.targetPts} onChange={e => setForm({ ...form, targetPts: parseInt(e.target.value) || 50 })} /></div>
          <div className="form-group"><label className="form-label">Duration (days)</label>
            <input type="number" min={1} max={30} className="form-input" value={form.days} onChange={e => setForm({ ...form, days: parseInt(e.target.value) || 2 })} /></div>
        </div>
      </Modal>

      {/* ── Assign Quest Modal ── */}
      <Modal isOpen={showAssignQuest} title="Assign Mission to Member" onClose={() => setShowAssignQuest(false)}
        footer={<><Button variant="secondary" onClick={() => setShowAssignQuest(false)}>Cancel</Button>
                 <Button variant="primary" onClick={assignQuest} disabled={saving || !aq.assignTo || !aq.title}>Deploy Mission</Button></>}>
        <p className="text-xs text-muted mb-12">Assign a quest to a clan member. It will appear in their Quests → Assigned tab.</p>
        <div className="form-group"><label className="form-label">Target Member</label>
          <select className="form-select" value={aq.assignTo} onChange={e => setAq({ ...aq, assignTo: e.target.value })}>
            <option value="">— Select member —</option>
            {clanMembers.filter(m => m.user_id !== user?.id).map(m => (
              <option key={m.user_id} value={m.user_id}>{m.name} ({m.player_class})</option>
            ))}
          </select></div>
        <div className="form-group"><label className="form-label">Mission Title</label>
          <input className="form-input" placeholder="e.g. Run 5km" value={aq.title} onChange={e => setAq({ ...aq, title: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Category</label>
            <select className="form-select" value={aq.category} onChange={e => setAq({ ...aq, category: e.target.value })}>
              {["General","Work","Fitness","Learning","Academics","Mindfulness","Finance","Social","Creative","Errands"].map(c => <option key={c}>{c}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">Priority</label>
            <select className="form-select" value={aq.priority} onChange={e => setAq({ ...aq, priority: e.target.value })}>
              {["Low","Normal","Medium","URGENT"].map(p => <option key={p}>{p}</option>)}
            </select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">XP Reward</label>
            <input type="number" className="form-input" value={aq.points} onChange={e => setAq({ ...aq, points: parseInt(e.target.value) || 10 })} /></div>
          <div className="form-group"><label className="form-label">Deadline</label>
            <input type="date" className="form-input" value={aq.deadline} onChange={e => setAq({ ...aq, deadline: e.target.value })} /></div>
        </div>
        <div className="form-group"><label className="form-label">Briefing (optional)</label>
          <textarea className="form-textarea" rows={2} value={aq.description} onChange={e => setAq({ ...aq, description: e.target.value })} /></div>
      </Modal>

      {/* ── Clan Event Modal ── */}
      <Modal isOpen={showNewClanEvent} title="Create Clan Event" onClose={() => setShowNewClanEvent(false)}
        footer={<><Button variant="secondary" onClick={() => setShowNewClanEvent(false)}>Cancel</Button>
                 <Button variant="primary" onClick={() => createEvent("clan")} disabled={saving || !eventForm.title}>Launch Event</Button></>}>
        <p className="text-xs text-muted mb-12">Rally your clan for a shared objective or prepare for war.</p>
        <div className="form-group"><label className="form-label">Event Title</label>
          <input className="form-input" placeholder="e.g. Weekend Boss Raid" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label>
          <textarea className="form-textarea" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Type</label>
            <select className="form-select" value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })}>
              {["Rally", "Raid", "War", "Training"].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">XP Reward (Per Member)</label>
            <input type="number" className="form-input" value={eventForm.reward} onChange={e => setEventForm({ ...eventForm, reward: parseInt(e.target.value) || 50 })} /></div>
        </div>
        {eventForm.type === "War" && (
          <div className="form-group"><label className="form-label">Target Opponent Clan ID</label>
            <input className="form-input" placeholder="Enter target Clan ID" value={eventForm.opponentId} onChange={e => setEventForm({ ...eventForm, opponentId: e.target.value })} style={{ fontFamily: 'monospace' }} /></div>
        )}
        <div className="form-group"><label className="form-label">Duration (days)</label>
          <input type="number" min={1} max={14} className="form-input" value={eventForm.days} onChange={e => setEventForm({ ...eventForm, days: parseInt(e.target.value) || 3 })} /></div>
      </Modal>

      {/* ── Guild Event Modal ── */}
      <Modal isOpen={showNewGuildEvent} title="Create Guild Event" onClose={() => setShowNewGuildEvent(false)}
        footer={<><Button variant="secondary" onClick={() => setShowNewGuildEvent(false)}>Cancel</Button>
                 <Button variant="primary" onClick={() => createEvent("guild")} disabled={saving || !eventForm.title}>Launch Event</Button></>}>
        <p className="text-xs text-muted mb-12">Organize large-scale operations for your entire guild.</p>
        <div className="form-group"><label className="form-label">Event Title</label>
          <input className="form-input" placeholder="e.g. Server-Wide Tournament" value={eventForm.title} onChange={e => setEventForm({ ...eventForm, title: e.target.value })} /></div>
        <div className="form-group"><label className="form-label">Description</label>
          <textarea className="form-textarea" value={eventForm.description} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Type</label>
            <select className="form-select" value={eventForm.type} onChange={e => setEventForm({ ...eventForm, type: e.target.value })}>
              {["Rally", "Raid", "Tournament", "War"].map(t => <option key={t}>{t}</option>)}
            </select></div>
          <div className="form-group"><label className="form-label">XP Reward (Per Member)</label>
            <input type="number" className="form-input" value={eventForm.reward} onChange={e => setEventForm({ ...eventForm, reward: parseInt(e.target.value) || 100 })} /></div>
        </div>
        {eventForm.type === "War" && (
          <div className="form-group"><label className="form-label">Target Opponent Guild ID</label>
            <input className="form-input" placeholder="Enter target Guild ID" value={eventForm.opponentId} onChange={e => setEventForm({ ...eventForm, opponentId: e.target.value })} style={{ fontFamily: 'monospace' }} /></div>
        )}
        <div className="form-group"><label className="form-label">Duration (days)</label>
          <input type="number" min={1} max={30} className="form-input" value={eventForm.days} onChange={e => setEventForm({ ...eventForm, days: parseInt(e.target.value) || 7 })} /></div>
      </Modal>
    </section>
  );
}
