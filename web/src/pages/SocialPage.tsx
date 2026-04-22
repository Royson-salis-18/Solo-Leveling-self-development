import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Check, X, Search, Copy, CheckCheck, Users, UserPlus, Clock, MessageSquare, Send } from "lucide-react";

type Friend = {
  id: string;
  user_id: string;
  name: string;
  level: number;
  total_points: number;
  player_class: string;
  player_rank: string;
  status: "accepted" | "pending";
  request_id: string;
  is_requester: boolean;
};

export function SocialPage() {
  const { user } = useAuth();
  const [friends, setFriends]         = useState<Friend[]>([]);
  const [searchCode, setSearchCode]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [searching, setSearching]     = useState(false);
  const [msg, setMsg]                 = useState("");
  const [copied, setCopied]           = useState(false);
  const [activeTab, setActiveTab]     = useState<"social" | "tavern">("social");
  
  // Tavern states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput]       = useState("");
  const [chatLoading, setChatLoading]   = useState(false);

  /* ── Hunter Code: first 8 chars of UUID, uppercase ── */
  const hunterCode = user?.id?.slice(0, 8).toUpperCase() ?? "--------";
  const fullId     = user?.id ?? "";

  const copyCode = async () => {
    await navigator.clipboard.writeText(fullId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Fetch all friendship rows + profiles ── */
  const fetchData = async () => {
    if (!supabase || !user) return;
    setLoading(true);

    const { data: frs } = await supabase
      .from("friendship")
      .select("*")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!frs || frs.length === 0) { setFriends([]); setLoading(false); return; }

    const profileIds = frs.map(f =>
      f.requester_id === user.id ? f.receiver_id : f.requester_id
    );
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("user_id, name, level, total_points, player_class, player_rank")
      .in("user_id", profileIds);

    const merged: Friend[] = frs.map(f => {
      const otherId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
      const p = profs?.find(x => x.user_id === otherId);
      return {
        id:           otherId,
        user_id:      otherId,
        name:         p?.name         ?? "Unknown Hunter",
        level:        p?.level        ?? 1,
        total_points: p?.total_points ?? 0,
        player_class: p?.player_class ?? "None",
        player_rank:  p?.player_rank  ?? "E",
        status:       f.status,
        request_id:   f.id,
        is_requester: f.requester_id === user.id,
      };
    });

    setFriends(merged);
    setLoading(false);
  };

  const fetchChat = async () => {
    if (!supabase) return;
    const { data: msgs } = await supabase
      .from("global_chat")
      .select("*, user_profiles(name, player_rank, hunter_code)")
      .order("created_at", { ascending: true })
      .limit(100);
    setChatMessages(msgs ?? []);
  };

  useEffect(() => { 
    fetchData(); 
    fetchChat();
    
    // Simple polling for chat
    const interval = setInterval(fetchChat, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !chatInput.trim()) return;
    setChatLoading(true);
    await supabase.from("global_chat").insert({
      user_id: user.id,
      message: chatInput.trim()
    });
    setChatInput("");
    setChatLoading(false);
    fetchChat();
  };

  /* ── Send friend request by Hunter Code ── */
  const handleSendRequest = async () => {
    const code = searchCode.trim();
    if (!supabase || !user || !code) return;
    setSearching(true);
    setMsg("");

    // Support both short 8-char code and full UUID
    const isFullUUID = code.length === 36 && code.includes("-");
    let targetId: string | null = null;

    if (isFullUUID) {
      // Look up directly
      const { data: prof } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("user_id", code)
        .maybeSingle();
      targetId = prof?.user_id ?? null;
    } else {
      // Search by exact Hunter Code Match
      const { data: results } = await supabase
        .from("user_profiles")
        .select("user_id")
        .eq("hunter_code", code.toUpperCase())
        .limit(1);
      targetId = results?.[0]?.user_id ?? null;
    }

    if (!targetId) {
      setMsg("⚠ Hunter not found in the System.");
      setSearching(false);
      return;
    }

    if (targetId === user.id) {
      setMsg("⚠ You cannot add yourself.");
      setSearching(false);
      return;
    }

    // Check if already connected
    const existing = friends.find(f => f.user_id === targetId);
    if (existing) {
      setMsg(existing.status === "accepted"
        ? "Already a companion in your guild."
        : "Request is already pending.");
      setSearching(false);
      return;
    }

    const { error } = await supabase.from("friendship").insert({
      requester_id: user.id,
      receiver_id:  targetId,
      status:       "pending",
    });

    if (error) {
      setMsg("⚠ Request already exists or failed to send.");
    } else {
      setMsg("✓ Friend request dispatched!");
      setSearchCode("");
      fetchData();
    }
    setSearching(false);
  };

  const handleAction = async (id: string, action: "accepted" | "rejected") => {
    if (!supabase) return;
    if (action === "rejected") {
      await supabase.from("friendship").delete().eq("id", id);
    } else {
      await supabase.from("friendship").update({ status: "accepted" }).eq("id", id);
    }
    fetchData();
  };

  const handleRemoveFriend = async (id: string) => {
    if (!supabase) return;
    await supabase.from("friendship").delete().eq("id", id);
    fetchData();
  };

  const pending  = friends.filter(f => f.status === "pending" && !f.is_requester);
  const outgoing = friends.filter(f => f.status === "pending" && f.is_requester);
  const accepted = friends.filter(f => f.status === "accepted");

  /* ── Player rank colour ── */
  const rankColor = (rank: string) => {
    const m: Record<string, string> = {
      S: "#ffcc00", A: "#ff8844", B: "#aa88ff",
      C: "#44aaff", D: "#aaffaa", E: "#888",
    };
    return m[rank] ?? "#888";
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Guild Social</h2>
        <p className="text-xs text-muted">Connect with other hunters</p>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab${activeTab === "social" ? " active" : ""}`} onClick={() => setActiveTab("social")}>
          <Users size={14} /> Companions
        </div>
        <div className={`tab${activeTab === "tavern" ? " active" : ""}`} onClick={() => setActiveTab("tavern")}>
          <MessageSquare size={14} /> The Tavern
        </div>
      </div>

      {activeTab === "social" ? (
        <>
          {/* ── Your Hunter ID ── */}
      <article className="panel" style={{
        background: "linear-gradient(135deg, rgba(168,168,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
        border: "1px solid rgba(168,168,255,0.2)",
      }}>
        <div className="flex-between">
          <div>
            <div className="text-xs text-muted" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Your Hunter ID
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Short code badge */}
              <div style={{
                fontFamily: "monospace",
                fontSize: "1.4rem",
                fontWeight: 800,
                letterSpacing: "0.15em",
                color: "rgba(168,168,255,0.9)",
                background: "rgba(168,168,255,0.1)",
                border: "1px solid rgba(168,168,255,0.25)",
                padding: "6px 14px",
                borderRadius: 10,
              }}>
                {hunterCode}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div className="text-xs text-muted" style={{ fontFamily: "monospace", opacity: 0.5, fontSize: "0.62rem", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fullId}
                </div>
                <div className="text-xs text-muted" style={{ fontSize: "0.6rem" }}>
                  Share your Hunter ID for others to add you as a companion
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={copyCode}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
              background: copied ? "rgba(168,255,168,0.12)" : "rgba(255,255,255,0.06)",
              color: copied ? "#88ff88" : "var(--t2)",
              cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
              transition: "all 0.2s ease",
            }}
          >
            {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy ID"}
          </button>
        </div>
      </article>

      {/* ── Send Friend Request ── */}
      <article className="panel">
        <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 4 }}>
          <UserPlus size={15} style={{ opacity: 0.6 }} />
          <h2 style={{ margin: 0 }}>Find Hunter</h2>
        </div>
        <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
          Paste a hunter's 8-char code (e.g. <span style={{ fontFamily: "monospace", color: "rgba(168,168,255,0.8)" }}>A3F6C21B</span>) or full UUID
        </p>
        <div className="flex gap-12">
          <input
            className="form-input"
            placeholder="Hunter Code or full UUID..."
            value={searchCode}
            onChange={e => setSearchCode(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSendRequest()}
            style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
          />
          <Button variant="primary" onClick={handleSendRequest} disabled={searching || !searchCode.trim()}>
            <Search size={14} /> {searching ? "Searching…" : "Send Invite"}
          </Button>
        </div>
        {msg && (
          <p className={`mt-8 text-xs ${msg.startsWith("✓") ? "text-success" : "text-danger"}`}>
            {msg}
          </p>
        )}
      </article>

      {/* ── Pending Invitations (incoming) ── */}
      {pending.length > 0 && (
        <article className="panel" style={{ border: "1px solid rgba(255,204,0,0.2)" }}>
          <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 12 }}>
            <Clock size={14} style={{ color: "#ffcc00" }} />
            <h2 style={{ margin: 0, color: "#ffcc00" }}>
              Pending Invitations
              <span style={{ marginLeft: 8, fontSize: "0.7rem", background: "rgba(255,204,0,0.15)", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>
                {pending.length}
              </span>
            </h2>
          </div>
          <div className="flex-col gap-8">
            {pending.map(f => (
              <div key={f.request_id} className="item-row" style={{ background: "rgba(255,204,0,0.04)", borderRadius: 8 }}>
                <div className="flex gap-12" style={{ alignItems: "center" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: `rgba(${rankColor(f.player_rank).replace("#","")}, 0.15)`,
                    border: `1px solid ${rankColor(f.player_rank)}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "1rem", color: rankColor(f.player_rank),
                  }}>
                    {f.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-600">{f.name}</div>
                    <div className="text-xs text-muted">
                      {f.player_class} · <span style={{ color: rankColor(f.player_rank), fontWeight: 700 }}>{f.player_rank}-Rank</span> · Lv.{f.level}
                    </div>
                  </div>
                </div>
                <div className="flex gap-6">
                  <Button variant="success" size="sm" onClick={() => handleAction(f.request_id, "accepted")}>
                    <Check size={13} /> Accept
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleAction(f.request_id, "rejected")}>
                    <X size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      {/* ── Friends List ── */}
      <article className="panel">
        <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 12 }}>
          <Users size={15} style={{ opacity: 0.6 }} />
          <h2 style={{ margin: 0 }}>Companions ({accepted.length})</h2>
        </div>
        {loading ? (
          <p className="text-muted text-xs text-center py-12">Syncing with Guild Grid…</p>
        ) : accepted.length > 0 ? (
          <div className="flex-col gap-10">
            {accepted.map(f => (
              <div key={f.user_id} className="panel rpg-card" style={{ padding: "12px 14px" }}>
                <div className="flex-between">
                  <div className="flex gap-12" style={{ alignItems: "center" }}>
                    {/* Avatar */}
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      background: `${rankColor(f.player_rank)}18`,
                      border: `1px solid ${rankColor(f.player_rank)}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "1.3rem", fontWeight: 800,
                      color: rankColor(f.player_rank),
                      flexShrink: 0,
                    }}>
                      {f.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span className="text-base font-700">{f.name}</span>
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 800, padding: "1px 6px", borderRadius: 4,
                          background: `${rankColor(f.player_rank)}20`,
                          color: rankColor(f.player_rank),
                          border: `1px solid ${rankColor(f.player_rank)}44`,
                        }}>
                          {f.player_rank}-RANK
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                        <span className="profile-title-tag" style={{ fontSize: "0.62rem", margin: 0 }}>{f.player_class}</span>
                        <span className="text-xs text-muted">· Lv.{f.level}</span>
                        {/* Short Hunter ID */}
                        <span style={{
                          fontFamily: "monospace", fontSize: "0.58rem",
                          color: "rgba(168,168,255,0.5)", background: "rgba(168,168,255,0.07)",
                          padding: "1px 5px", borderRadius: 4,
                        }}>
                          #{f.user_id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <div className="text-sm font-800">{f.total_points.toLocaleString()} XP</div>
                    <Button variant="danger" size="sm" onClick={() => handleRemoveFriend(f.request_id)}>
                      <X size={11} /> Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "24px 0", opacity: 0.5 }}>
            <Users size={32} style={{ margin: "0 auto 10px", display: "block", opacity: 0.3 }} />
            <p className="text-muted text-xs">No companions yet. Share your Hunter ID to connect.</p>
          </div>
        )}
      </article>

      {/* ── Outgoing Requests ── */}
      {outgoing.length > 0 && (
        <article className="panel" style={{ opacity: 0.7 }}>
          <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 10 }}>
            <Clock size={13} style={{ opacity: 0.5 }} />
            <h2 style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>Outgoing Requests ({outgoing.length})</h2>
          </div>
          <div className="flex-col gap-6">
            {outgoing.map(f => (
              <div key={f.request_id} className="flex-between py-6 px-12 text-sm" style={{
                background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div className="flex gap-10" style={{ alignItems: "center" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: "rgba(255,255,255,0.08)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: "0.8rem",
                  }}>
                    {f.name?.[0]?.toUpperCase()}
                  </div>
                  <span>{f.name}</span>
                  <span style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "rgba(168,168,255,0.4)" }}>
                    #{f.user_id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex gap-8" style={{ alignItems: "center" }}>
                  <span className="text-xs italic text-muted">Awaiting response…</span>
                  <Button variant="danger" size="sm" onClick={() => handleRemoveFriend(f.request_id)}>
                    <X size={11} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}
      </>
      ) : (
        /* ── THE TAVERN (GLOBAL CHAT) ── */
        <article className="panel" style={{ display: 'flex', flexDirection: 'column', height: '65vh', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex gap-8" style={{ alignItems: "center" }}>
              <MessageSquare size={16} className="text-accent" />
              <h2 style={{ margin: 0 }}>The Tavern</h2>
            </div>
            <p className="text-xs text-muted mt-4">Global communication channel for all Awakened hunters.</p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {chatMessages.length === 0 ? (
              <div className="text-center text-muted text-xs py-20 mt-20 opacity-50">
                It's quiet in the tavern... Send a message to break the silence.
              </div>
            ) : (
              chatMessages.map(m => (
                <div key={m.id} style={{ display: 'flex', gap: '12px', opacity: m.user_id === user?.id ? 1 : 0.8 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: `${rankColor(m.user_profiles?.player_rank)}15`,
                    border: `1px solid ${rankColor(m.user_profiles?.player_rank)}44`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, fontSize: "0.85rem", color: rankColor(m.user_profiles?.player_rank),
                  }}>
                    {m.user_profiles?.name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '4px' }}>
                      <span className="font-600 outline-text text-sm" style={{ color: rankColor(m.user_profiles?.player_rank) }}>
                        {m.user_profiles?.name}
                      </span>
                      <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                        #{m.user_profiles?.hunter_code} • {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                    <div className="text-sm" style={{ lineHeight: 1.4, color: 'var(--t2)', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '0 8px 8px 8px' }}>
                      {m.message}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Speak to the tavern..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatLoading}
                style={{ flex: 1 }}
              />
              <Button variant="primary" onClick={() => {}} disabled={chatLoading || !chatInput.trim()}>
                 <Send size={14} />
              </Button>
            </form>
          </div>
        </article>
      )}
    </section>
  );
}
