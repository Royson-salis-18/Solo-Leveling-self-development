import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { useToast } from "../lib/toast";
import { useConfirm } from "../lib/confirm";
import { SystemAPI } from "../services/SystemAPI";
import type { DuelRow, PendingInvites } from "../lib/gameTypes";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import {
  Shield, Swords, Crown, Plus, Mail,
  LogOut, Trophy, Zap, Target, Timer, Star
} from "lucide-react";

/* ─────────────────────── types ─────────────────────── */
type Guild = { id: string; name: string; description: string; leader_id: string; member_count: number; min_rank: string };
type Clan  = { id: string; name: string; description: string; leader_id: string };
// XP shown for other hunters is their STANDING (balance + spent), so spending on rewards doesn't drop you down the roster.
type Member = { user_id: string; name: string; role: string; level: number; standing_xp: number; player_class: string; player_rank: string };
type Challenge = DuelRow;
type GroupEvent = {
  id: string; title: string; description: string; event_type: string;
  xp_reward: number; start_time: string; end_time: string; status: string;
};

const TABS = ["1v1 Duels", "Clan", "Guild"] as const;
type Tab = typeof TABS[number];

/* ─────────────────────── component ─────────────────────── */
export function ArenaPage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [invites, setInvites]   = useState<PendingInvites>({ clan: [], guild: [] });
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
    tier: "Low", priority: "Normal", deadline: "", description: ""
  });

  const [eventForm, setEventForm] = useState({
    title: "", description: "", type: "Rally", reward: 50, days: 3, opponentId: ""
  });

  const [guildAssets, setGuildAssets] = useState({
    logo: "⚜️",
    aura: "shadow"
  });

  /* ── fetch everything ── */
  const fetchAll = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    try {
      const [clanMembership, guildMembership, duels, inv] = await Promise.all([
        supabase.from("clan_members").select("clan_id").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_profiles").select("guild_id").eq("user_id", user.id).maybeSingle(),
        SystemAPI.listChallenges().catch(() => [] as Challenge[]),
        SystemAPI.myInvites().catch(() => ({ clan: [], guild: [] }) as PendingInvites),
      ]);
      setChallenges(duels);
      setInvites(inv);

      // Rosters read other hunters from the public view (no email / Dark Mana / timezone).
      if (clanMembership.data) {
        const clanId = clanMembership.data.clan_id;
        const [{ data: clanData }, { data: clanMR }, { data: cEvents }] = await Promise.all([
          supabase.from("clans").select("*").eq("id", clanId).single(),
          supabase.from("clan_members").select("user_id, role").eq("clan_id", clanId),
          supabase.from("clan_events").select("*").eq("clan_id", clanId).eq("status", "active"),
        ]);
        setClan(clanData);
        setClanEvents(cEvents ?? []);
        if (clanMR) {
          const { data: profs } = await supabase.from("public_profiles").select("*").in("user_id", clanMR.map((m: any) => m.user_id));
          const enriched = clanMR.map((m: any) => ({ ...m, ...profs?.find((p: any) => p.user_id === m.user_id) } as Member))
            .sort((a: Member, b: Member) => (b.standing_xp || 0) - (a.standing_xp || 0));
          setClanMembers(enriched);
          const myRole = clanMR.find((m: any) => m.user_id === user.id)?.role;
          setIsLeader(myRole === "leader" || myRole === "officer");
        }
      } else { setClan(null); setClanMembers([]); setIsLeader(false); setClanEvents([]); }

      const guildId = guildMembership.data?.guild_id;
      if (guildId) {
        const [{ data: guildData }, { data: guildProfs }, { data: gEvents }] = await Promise.all([
          supabase.from("guilds").select("*").eq("id", guildId).single(),
          supabase.from("public_profiles").select("*").eq("guild_id", guildId),
          supabase.from("guild_events").select("*").eq("guild_id", guildId).eq("status", "active"),
        ]);
        setGuild(guildData);
        setGuildMembers(((guildProfs ?? []) as Member[]).sort((a, b) => (b.standing_xp || 0) - (a.standing_xp || 0)));
        setGuildEvents(gEvents ?? []);
      } else { setGuild(null); setGuildMembers([]); setGuildEvents([]); }
    } catch (err) {
      toast.fail(err, "Could not load the arena");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [user]);

  /** Run an action, toast failures, and refresh. Returns true on success. */
  const act = async (fn: () => Promise<unknown>, ok?: string, failTitle = "Action failed") => {
    setSaving(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await Promise.all([fetchAll(), refreshProfile()]);
      return true;
    } catch (err) {
      toast.fail(err, failTitle);
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** Resolve a Hunter ID (8-char code or full UUID) through the server — never by reading profiles. */
  const resolveHunter = async (raw: string) => {
    const hunter = await SystemAPI.findHunter(raw);
    if (!hunter) throw new Error("Hunter not found in the System.");
    return hunter;
  };

  /* ── actions ── */
  const createClan = async () => {
    if (!form.name.trim()) return;
    if (await act(() => SystemAPI.createClan(form.name, form.desc), "Clan established", "Could not create the clan")) {
      setShowCreateClan(false); setForm({ ...form, name: "", desc: "" });
    }
  };

  const createGuild = async () => {
    if (!form.name.trim()) return;
    const ok = await act(
      () => SystemAPI.createGuild({ name: form.name, desc: form.desc, minRank: form.minRank, logo: guildAssets.logo, aura: guildAssets.aura }),
      "Guild founded", "Could not found the guild");
    if (ok) { setShowCreateGuild(false); setForm({ ...form, name: "", desc: "" }); }
  };

  const inviteByHunterId = async (type: "clan" | "guild") => {
    if (!form.hunterId.trim()) return;
    const ok = await act(async () => {
      const hunter = await resolveHunter(form.hunterId);
      return type === "clan" ? SystemAPI.inviteToClan(hunter.user_id) : SystemAPI.inviteToGuild(hunter.user_id);
    }, "Invitation sent — they must accept to join", "Could not send the invitation");
    if (ok) { setShowInviteClan(false); setShowInviteGuild(false); setForm({ ...form, hunterId: "" }); }
  };

  const respondInvite = (kind: "clan" | "guild", id: string, accept: boolean) =>
    act(() => (kind === "clan" ? SystemAPI.respondClanInvite(id, accept) : SystemAPI.respondGuildInvite(id, accept)),
        accept ? "Welcome aboard" : "Invitation declined", "Could not answer the invitation");

  const createChallenge = async () => {
    if (!form.hunterId.trim()) return;
    const ok = await act(async () => {
      const hunter = await resolveHunter(form.hunterId);
      return SystemAPI.createChallenge(hunter.user_id, form.targetPts, form.days);
    }, "Duel started", "Could not issue the challenge");
    if (ok) { setShowNewChallenge(false); setForm({ ...form, hunterId: "" }); }
  };

  const leaveClan = async () => {
    if (!clan) return;
    const yes = await confirm({ title: `Leave ${clan.name}?`, message: "If you lead the clan, leadership passes to the next member.", confirmLabel: "Leave clan", danger: true });
    if (yes) await act(() => SystemAPI.leaveClan(), "You left the clan");
  };

  const leaveGuild = async () => {
    if (!guild) return;
    const yes = await confirm({ title: `Leave ${guild.name}?`, message: "If you are the guild master, leadership passes to the next member.", confirmLabel: "Leave guild", danger: true });
    if (yes) await act(() => SystemAPI.leaveGuild(), "You left the guild");
  };

  const assignQuest = async () => {
    if (!aq.assignTo || !aq.title.trim()) return;
    const ok = await act(() => SystemAPI.assignQuest({
      target: aq.assignTo, title: aq.title, category: aq.category, tier: aq.tier,
      priority: aq.priority, deadline: aq.deadline || null, description: aq.description,
    }), "Mission deployed", "Could not assign the quest");
    if (ok) {
      setShowAssignQuest(false);
      setAq({ assignTo: "", title: "", category: "General", tier: "Low", priority: "Normal", deadline: "", description: "" });
    }
  };

  const createEvent = async (group: "clan" | "guild") => {
    if (!supabase || !user) return;
    const table = group === "clan" ? "clan_events" : "guild_events";
    const groupId = group === "clan" ? clan?.id : guild?.id;
    if (!groupId || !eventForm.title.trim()) return;

    const payload: Record<string, unknown> = {
      creator_id: user.id,
      title: eventForm.title.trim(),
      description: eventForm.description,
      event_type: eventForm.type,
      xp_reward: Math.min(1000, Math.max(0, eventForm.reward)),
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + eventForm.days * 86400000).toISOString(),
      status: "active",
    };
    if (group === "clan") {
      payload.clan_id = groupId;
      if (eventForm.type === "War" && eventForm.opponentId.trim()) payload.opponent_clan_id = eventForm.opponentId.trim();
    } else {
      payload.guild_id = groupId;
      if (eventForm.type === "War" && eventForm.opponentId.trim()) payload.opponent_guild_id = eventForm.opponentId.trim();
    }

    const ok = await act(async () => { const { error } = await supabase!.from(table).insert(payload); if (error) throw error; },
      "Event launched", "Could not create the event");
    if (ok) {
      if (group === "clan") setShowNewClanEvent(false); else setShowNewGuildEvent(false);
      setEventForm({ title: "", description: "", type: "Rally", reward: 50, days: 3, opponentId: "" });
    }
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
                  <div className="text-sm font-800" style={{ color: "#fff" }}>{(m.standing_xp || 0).toLocaleString()}</div>
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
                        <div className="text-xs font-700 mt-4" style={{ color: "#34d399" }}>Goal: {e.xp_reward} XP</div>
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
              <Button variant="danger" size="sm" onClick={leaveGuild}><LogOut size={12} /></Button>
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
                <div className="text-sm font-800">{(m.standing_xp || 0).toLocaleString()} <span className="text-xs text-muted">XP</span></div>
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
                        <div className="text-xs font-700 mt-4" style={{ color: "#34d399" }}>Goal: {e.xp_reward} XP</div>
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
          <div className="text-sm font-700 mt-2">{challenges.filter(c => c.status === "active").length} ongoing</div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowNewChallenge(true)}>
          <Swords size={13} /> Issue Challenge
        </Button>
      </div>

      {challenges.filter(c => c.status === "active").length === 0 ? (
        <div className="arena-empty-state" style={{ padding: "40px 0" }}>
          <Swords size={36} className="arena-empty-icon" />
          <p className="text-muted text-sm mt-8">No active duels. Challenge a hunter to begin.</p>
        </div>
      ) : (
        <div className="flex-col gap-16">
          {challenges.filter(c => c.status === "active").map(c => {
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

      {challenges.some(c => c.status !== "active") && (
        <div className="mt-16">
          <div className="text-xs text-muted uppercase tracking-widest mb-8">Recent results</div>
          <div className="flex-col gap-8">
            {challenges.filter(c => c.status !== "active").map(c => {
              const won = c.winner_id === user?.id;
              const theirName = c.creator_id === user?.id ? c.opponent_name : c.creator_name;
              return (
                <div key={c.id} className="glass-panel panel-no-pad" style={{ padding: 12, borderLeft: `3px solid ${c.status === "expired" ? "#64748b" : won ? "#34d399" : "#ff4444"}` }}>
                  <div className="flex-between">
                    <div className="text-sm font-700">vs {theirName}</div>
                    <span className="tag" style={{ color: c.status === "expired" ? "#94a3b8" : won ? "#34d399" : "#ff4444" }}>
                      {c.status === "expired" ? "EXPIRED" : won ? "VICTORY" : "DEFEAT"}
                    </span>
                  </div>
                  <div className="text-xs text-muted mt-4">Target {c.target_points} XP · you {c.creator_id === user?.id ? c.creator_pts : c.opponent_pts} · them {c.creator_id === user?.id ? c.opponent_pts : c.creator_pts}</div>
                </div>
              );
            })}
          </div>
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

      {(invites.clan.length > 0 || invites.guild.length > 0) && (
        <div className="glass-panel" style={{ padding: 16, marginBottom: 16, borderLeft: "3px solid #34d399" }}>
          <div className="text-xs text-muted uppercase tracking-widest mb-8">Pending invitations</div>
          <div className="flex-col gap-8">
            {([["clan", invites.clan], ["guild", invites.guild]] as const).flatMap(([kind, list]) =>
              list.map(inv => (
                <div key={inv.id} className="flex-between" style={{ gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="text-sm font-700 truncate">{kind === "clan" ? "🛡️" : "⚜️"} {inv.name}</div>
                    <div className="text-xs text-muted">Invited by {inv.inviter ?? "a hunter"}</div>
                  </div>
                  <div className="flex gap-8">
                    <Button variant="success" size="sm" disabled={saving} onClick={() => respondInvite(kind, inv.id, true)}>Accept</Button>
                    <Button variant="secondary" size="sm" disabled={saving} onClick={() => respondInvite(kind, inv.id, false)}>Decline</Button>
                  </div>
                </div>
              )))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="arena-tabs">
        {TABS.map(t => (
          <button key={t} className={`arena-tab${tab === t ? " arena-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t === "1v1 Duels" && <Swords size={14} />}
            {t === "Clan"     && <Shield size={14} />}
            {t === "Guild"    && <Trophy size={14} />}
            {t}
            {t === "1v1 Duels" && challenges.some(c => c.status === "active") && tab !== t && (
              <span className="arena-tab-badge">{challenges.filter(c => c.status === "active").length}</span>
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
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Guild Logo</label>
            <select className="form-select" value={guildAssets.logo} onChange={e => setGuildAssets({ ...guildAssets, logo: e.target.value })}>
              <option value="⚜️">⚜️ Sovereign</option>
              <option value="🗡️">🗡️ Vanguard</option>
              <option value="🛡️">🛡️ Aegis</option>
              <option value="🦅">🦅 Hunter</option>
              <option value="🔥">🔥 Inferno</option>
              <option value="⚡">⚡ Lightning</option>
            </select></div>
          <div className="form-group"><label className="form-label">Aura Theme</label>
            <select className="form-select" value={guildAssets.aura} onChange={e => setGuildAssets({ ...guildAssets, aura: e.target.value })}>
              <option value="shadow">Shadow (Purple)</option>
              <option value="flame">Flame (Red)</option>
              <option value="lightning">Lightning (Blue)</option>
              <option value="smoke">Smoke (Gray)</option>
            </select></div>
        </div>

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
        <p className="text-xs text-muted mb-12">Both hunters race to earn the target XP from scratch within the time limit. Only hunters in your party (friends) can be challenged.</p>
        <div className="form-group"><label className="form-label">Opponent Hunter ID</label>
          <input className="form-input" placeholder="e.g. A3F6C21B or full UUID" value={form.hunterId} onChange={e => setForm({ ...form, hunterId: e.target.value })} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Target XP</label>
            <input type="number" className="form-input" value={form.targetPts} onChange={e => setForm({ ...form, targetPts: parseInt(e.target.value) || 50 })} /></div>
          <div className="form-group"><label className="form-label">Duration (days)</label>
            <input type="number" min={1} max={14} className="form-input" value={form.days} onChange={e => setForm({ ...form, days: parseInt(e.target.value) || 2 })} /></div>
        </div>
      </Modal>

      {/* ── Assign Quest Modal ── */}
      <Modal isOpen={showAssignQuest} title="Assign Mission to Member" onClose={() => setShowAssignQuest(false)}
        footer={<><Button variant="secondary" onClick={() => setShowAssignQuest(false)}>Cancel</Button>
                 <Button variant="primary" onClick={assignQuest} disabled={saving || !aq.assignTo || !aq.title}>Deploy Mission</Button></>}>
        <p className="text-xs text-muted mb-12">Assign a quest to a clan member. It appears in their Dungeon Gate, and they earn its XP (set by the rank you choose) when they conquer it.</p>
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
              {["Low","Normal","High","URGENT"].map(p => <option key={p}>{p}</option>)}
            </select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="form-group"><label className="form-label">Rank (sets the XP)</label>
            <select className="form-select" value={aq.tier} onChange={e => setAq({ ...aq, tier: e.target.value })}>
              <option value="Low">E-Rank · 5 XP</option>
              <option value="Mid">C-Rank · 15 XP</option>
              <option value="High">B-Rank · 25 XP</option>
              <option value="Super">A-Rank · 35 XP</option>
              <option value="Legendary">S-Rank · 50 XP</option>
            </select></div>
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
          <div className="form-group"><label className="form-label">Team goal (XP)</label>
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
          <div className="form-group"><label className="form-label">Team goal (XP)</label>
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
