import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Check, X, Search, Copy, CheckCheck, Users, UserPlus, Clock, MessageSquare, Send, ArrowLeft } from "lucide-react";

type Friend = {
  id: string; user_id: string; name: string; level: number;
  total_points: number; player_class: string; player_rank: string;
  status: "accepted" | "pending"; request_id: string; is_requester: boolean;
};

type DM = {
  id: string; sender_id: string; receiver_id: string;
  message: string; created_at: string; sender_name?: string;
};

export function SocialPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchCode, setSearchCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"social" | "messages">("social");

  // DM states
  const [chatFriend, setChatFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const hunterCode = user?.id?.slice(0, 8).toUpperCase() ?? "--------";
  const fullId = user?.id ?? "";

  const copyCode = async () => {
    await navigator.clipboard.writeText(fullId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rankColor = (rank: string) => {
    const m: Record<string, string> = {
      S: "#ffcc00", A: "#ff8844", B: "#aa88ff",
      C: "#44aaff", D: "#aaffaa", E: "#888",
    };
    return m[rank] ?? "#888";
  };

  /* ── Fetch friends ── */
  const fetchData = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const { data: frs } = await supabase
      .from("friendship").select("*")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);
    if (!frs || frs.length === 0) { setFriends([]); setLoading(false); return; }
    const profileIds = frs.map(f => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("user_id, name, level, total_points, player_class, player_rank")
      .in("user_id", profileIds);
    const merged: Friend[] = frs.map(f => {
      const otherId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
      const p = profs?.find(x => x.user_id === otherId);
      return {
        id: otherId, user_id: otherId,
        name: p?.name ?? "Unknown Hunter", level: p?.level ?? 1,
        total_points: p?.total_points ?? 0, player_class: p?.player_class ?? "None",
        player_rank: p?.player_rank ?? "E", status: f.status,
        request_id: f.id, is_requester: f.requester_id === user.id,
      };
    });
    setFriends(merged);
    setLoading(false);
  };

  /* ── Cleanup old messages (>24h) on mount ── */
  const cleanupOldMessages = async () => {
    if (!supabase || !user) return;
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("direct_messages").delete()
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .lt("created_at", cutoff);
  };

  /* ── Fetch DMs with a specific friend ── */
  const fetchMessages = async (friendId: string, silent = false) => {
    if (!supabase || !user) return;
    if (!silent) setChatLoading(true);
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friendId}),` +
        `and(sender_id.eq.${friendId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data ?? []);
    if (!silent) setChatLoading(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSendDM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !user || !chatFriend || !chatInput.trim()) return;
    const text = chatInput.trim();
    // Optimistically show the message immediately
    const optimistic: DM = {
      id: `opt-${Date.now()}`,
      sender_id: user.id,
      receiver_id: chatFriend.user_id,
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setChatInput("");
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    await supabase.from("direct_messages").insert({ sender_id: user.id, receiver_id: chatFriend.user_id, message: text });
    // Refresh to get the real DB record (replaces optimistic entry) - do it silently
    fetchMessages(chatFriend.user_id, true);
  };

  const openChat = (friend: Friend) => {
    setChatFriend(friend);
    setActiveTab("messages");
    fetchMessages(friend.user_id); // first load not silent
  };

  useEffect(() => {
    fetchData();
    cleanupOldMessages();
  }, [user]);

  // Poll for new messages when in a chat
  useEffect(() => {
    if (!chatFriend) return;
    const interval = setInterval(() => fetchMessages(chatFriend.user_id, true), 4000);
    return () => clearInterval(interval);
  }, [chatFriend]);

  /* ── Friend request handlers ── */
  const handleSendRequest = async () => {
    const code = searchCode.trim();
    if (!supabase || !user || !code) return;
    setSearching(true); setMsg("");
    const isFullUUID = code.length === 36 && code.includes("-");
    let targetId: string | null = null;
    if (isFullUUID) {
      const { data: prof } = await supabase.from("user_profiles").select("user_id").eq("user_id", code).maybeSingle();
      targetId = prof?.user_id ?? null;
    } else {
      const { data: results } = await supabase.from("user_profiles").select("user_id").eq("hunter_code", code.toUpperCase()).limit(1);
      targetId = results?.[0]?.user_id ?? null;
    }
    if (!targetId) { setMsg("⚠ Hunter not found."); setSearching(false); return; }
    if (targetId === user.id) { setMsg("⚠ You cannot add yourself."); setSearching(false); return; }
    const existing = friends.find(f => f.user_id === targetId);
    if (existing) { setMsg(existing.status === "accepted" ? "Already companions." : "Request pending."); setSearching(false); return; }
    const { error } = await supabase.from("friendship").insert({ requester_id: user.id, receiver_id: targetId, status: "pending" });
    if (error) { setMsg("⚠ Request failed."); } else { setMsg("✓ Request sent!"); setSearchCode(""); fetchData(); }
    setSearching(false);
  };

  const handleAction = async (id: string, action: "accepted" | "rejected") => {
    if (!supabase) return;
    if (action === "rejected") { await supabase.from("friendship").delete().eq("id", id); }
    else { await supabase.from("friendship").update({ status: "accepted" }).eq("id", id); }
    fetchData();
  };

  const handleRemoveFriend = async (id: string) => {
    if (!supabase) return;
    await supabase.from("friendship").delete().eq("id", id);
    if (chatFriend?.request_id === id) setChatFriend(null);
    fetchData();
  };

  const pending = friends.filter(f => f.status === "pending" && !f.is_requester);
  const outgoing = friends.filter(f => f.status === "pending" && f.is_requester);
  const accepted = friends.filter(f => f.status === "accepted");

  /* ── RENDER ── */
  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Guild Social</h2>
        <p className="text-xs text-muted">Connect with other hunters</p>
      </div>

      <div className="tabs" style={{ marginBottom: 24 }}>
        <div className={`tab${activeTab === "social" ? " active" : ""}`} onClick={() => { setActiveTab("social"); setChatFriend(null); }}>
          <Users size={14} /> Companions
        </div>
        <div className={`tab${activeTab === "messages" ? " active" : ""}`} onClick={() => setActiveTab("messages")}>
          <MessageSquare size={14} /> Messages
          {accepted.length > 0 && <span className="badge-counter">{accepted.length}</span>}
        </div>
      </div>

      {activeTab === "social" ? (
        <>
          {/* ── Hunter ID Card ── */}
          <article className="panel" style={{
            background: "linear-gradient(135deg, rgba(168,168,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
            border: "1px solid rgba(168,168,255,0.2)",
          }}>
            <div className="flex-between">
              <div>
                <div className="text-xs text-muted" style={{ marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Your Hunter ID</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    fontFamily: "monospace", fontSize: "1.4rem", fontWeight: 800, letterSpacing: "0.15em",
                    color: "rgba(168,168,255,0.9)", background: "rgba(168,168,255,0.1)",
                    border: "1px solid rgba(168,168,255,0.25)", padding: "6px 14px", borderRadius: 10,
                  }}>{hunterCode}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div className="text-xs text-muted" style={{ fontFamily: "monospace", opacity: 0.5, fontSize: "0.62rem", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullId}</div>
                    <div className="text-xs text-muted" style={{ fontSize: "0.6rem" }}>Share your Hunter ID for others to add you</div>
                  </div>
                </div>
              </div>
              <button onClick={copyCode} style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.12)",
                background: copied ? "rgba(168,255,168,0.12)" : "rgba(255,255,255,0.06)",
                color: copied ? "#88ff88" : "var(--t2)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, transition: "all 0.2s ease",
              }}>
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                {copied ? "Copied!" : "Copy ID"}
              </button>
            </div>
          </article>

          {/* ── Find Hunter ── */}
          <article className="panel">
            <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 4 }}>
              <UserPlus size={15} style={{ opacity: 0.6 }} />
              <h2 style={{ margin: 0 }}>Find Hunter</h2>
            </div>
            <p className="text-xs text-muted" style={{ marginBottom: 12 }}>
              Paste a hunter's 8-char code or full UUID
            </p>
            <div className="flex gap-12">
              <input className="form-input" placeholder="Hunter Code or UUID..." value={searchCode}
                onChange={e => setSearchCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSendRequest()}
                style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} />
              <Button variant="primary" onClick={handleSendRequest} disabled={searching || !searchCode.trim()}>
                <Search size={14} /> {searching ? "Searching…" : "Send Invite"}
              </Button>
            </div>
            {msg && <p className={`mt-8 text-xs ${msg.startsWith("✓") ? "text-success" : "text-danger"}`}>{msg}</p>}
          </article>

          {/* ── Pending Invitations ── */}
          {pending.length > 0 && (
            <article className="panel" style={{ border: "1px solid rgba(255,204,0,0.2)" }}>
              <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 12 }}>
                <Clock size={14} style={{ color: "#ffcc00" }} />
                <h2 style={{ margin: 0, color: "#ffcc00" }}>
                  Pending <span style={{ marginLeft: 8, fontSize: "0.7rem", background: "rgba(255,204,0,0.15)", padding: "1px 7px", borderRadius: 99, fontWeight: 700 }}>{pending.length}</span>
                </h2>
              </div>
              <div className="flex-col gap-8">
                {pending.map(f => (
                  <div key={f.request_id} className="item-row" style={{ background: "rgba(255,204,0,0.04)", borderRadius: 8 }}>
                    <div className="flex gap-12" style={{ alignItems: "center" }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${rankColor(f.player_rank)}18`, border: `1px solid ${rankColor(f.player_rank)}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1rem", color: rankColor(f.player_rank) }}>
                        {f.name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-600">{f.name}</div>
                        <div className="text-xs text-muted">{f.player_class} · <span style={{ color: rankColor(f.player_rank), fontWeight: 700 }}>{f.player_rank}-Rank</span> · Lv.{f.level}</div>
                      </div>
                    </div>
                    <div className="flex gap-6">
                      <Button variant="success" size="sm" onClick={() => handleAction(f.request_id, "accepted")}><Check size={13} /> Accept</Button>
                      <Button variant="danger" size="sm" onClick={() => handleAction(f.request_id, "rejected")}><X size={13} /></Button>
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
              <p className="text-muted text-xs text-center py-12">Syncing…</p>
            ) : accepted.length > 0 ? (
              <div className="flex-col gap-10">
                {accepted.map(f => (
                  <div key={f.user_id} className="panel rpg-card" style={{ padding: "12px 14px" }}>
                    <div className="flex-between">
                      <div className="flex gap-12" style={{ alignItems: "center" }}>
                        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${rankColor(f.player_rank)}18`, border: `1px solid ${rankColor(f.player_rank)}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", fontWeight: 800, color: rankColor(f.player_rank), flexShrink: 0 }}>
                          {f.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span className="text-base font-700">{f.name}</span>
                            <span style={{ fontSize: "0.65rem", fontWeight: 800, padding: "1px 6px", borderRadius: 4, background: `${rankColor(f.player_rank)}20`, color: rankColor(f.player_rank), border: `1px solid ${rankColor(f.player_rank)}44` }}>{f.player_rank}-RANK</span>
                          </div>
                          <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                            <span className="profile-title-tag" style={{ fontSize: "0.62rem", margin: 0 }}>{f.player_class}</span>
                            <span className="text-xs text-muted">· Lv.{f.level}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                        <div className="text-sm font-800">{f.total_points.toLocaleString()} XP</div>
                        <div className="flex gap-6">
                          <Button variant="primary" size="sm" onClick={() => openChat(f)}><MessageSquare size={11} /> Chat</Button>
                          <Button variant="danger" size="sm" onClick={() => handleRemoveFriend(f.request_id)}><X size={11} /></Button>
                        </div>
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

          {/* ── Outgoing ── */}
          {outgoing.length > 0 && (
            <article className="panel" style={{ opacity: 0.7 }}>
              <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 10 }}>
                <Clock size={13} style={{ opacity: 0.5 }} />
                <h2 style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>Outgoing ({outgoing.length})</h2>
              </div>
              <div className="flex-col gap-6">
                {outgoing.map(f => (
                  <div key={f.request_id} className="flex-between py-6 px-12 text-sm" style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex gap-10" style={{ alignItems: "center" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem" }}>{f.name?.[0]?.toUpperCase()}</div>
                      <span>{f.name}</span>
                    </div>
                    <div className="flex gap-8" style={{ alignItems: "center" }}>
                      <span className="text-xs italic text-muted">Awaiting…</span>
                      <Button variant="danger" size="sm" onClick={() => handleRemoveFriend(f.request_id)}><X size={11} /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </>
      ) : (
        /* ── MESSAGES TAB ── */
        chatFriend ? (
          /* ── Active Chat ── */
          <article className="panel" style={{ display: "flex", flexDirection: "column", height: "65vh", padding: 0, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setChatFriend(null)} style={{ background: "none", border: "none", color: "var(--t2)", cursor: "pointer", padding: 4 }}>
                <ArrowLeft size={16} />
              </button>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${rankColor(chatFriend.player_rank)}18`, border: `1px solid ${rankColor(chatFriend.player_rank)}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: rankColor(chatFriend.player_rank) }}>
                {chatFriend.name[0]?.toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-700">{chatFriend.name}</div>
                <div className="text-xs text-muted">{chatFriend.player_class} · {chatFriend.player_rank}-Rank</div>
              </div>
              <div style={{ marginLeft: "auto", fontSize: "0.6rem", color: "var(--t4)" }}>Messages auto-clear after 24h</div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {chatLoading ? (
                <div className="text-center text-muted text-xs py-20">Loading messages…</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted text-xs py-20 opacity-50">
                  No messages yet. Say hello to {chatFriend.name}!
                </div>
              ) : (
                messages.map(m => {
                  const isMe = m.sender_id === user?.id;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "70%", padding: "10px 14px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        background: isMe ? "rgba(168,168,255,0.12)" : "rgba(255,255,255,0.05)",
                        border: `1px solid ${isMe ? "rgba(168,168,255,0.2)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                        <div className="text-sm" style={{ lineHeight: 1.5, color: "var(--t1)" }}>{m.message}</div>
                        <div style={{ fontSize: "0.58rem", color: "var(--t4)", marginTop: 4, textAlign: isMe ? "right" : "left" }}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "14px 16px", background: "rgba(0,0,0,0.3)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <form onSubmit={handleSendDM} style={{ display: "flex", gap: "10px" }}>
                <input type="text" className="form-input" placeholder={`Message ${chatFriend.name}...`}
                  value={chatInput} onChange={e => setChatInput(e.target.value)}
                  disabled={chatLoading} style={{ flex: 1 }} autoComplete="off" />
                <button type="submit" disabled={chatLoading || !chatInput.trim()}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 16px", borderRadius: 8, border: "1px solid rgba(168,168,255,0.3)",
                    background: chatInput.trim() ? "rgba(168,168,255,0.15)" : "rgba(255,255,255,0.04)",
                    color: chatInput.trim() ? "rgba(168,168,255,0.9)" : "var(--t4)",
                    cursor: chatInput.trim() ? "pointer" : "not-allowed", transition: "all 0.15s",
                  }}>
                  <Send size={14} />
                </button>
              </form>
            </div>
          </article>
        ) : (
          /* ── Friend picker for messages ── */
          <article className="panel">
            <div className="flex gap-8" style={{ alignItems: "center", marginBottom: 16 }}>
              <MessageSquare size={15} style={{ opacity: 0.6 }} />
              <h2 style={{ margin: 0 }}>Choose a companion to message</h2>
            </div>
            {accepted.length === 0 ? (
              <div className="text-center text-muted text-xs py-16">Add companions first to start messaging.</div>
            ) : (
              <div className="flex-col gap-8">
                {accepted.map(f => (
                  <div key={f.user_id} onClick={() => openChat(f)} style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-0)",
                    borderRadius: 12, cursor: "pointer", transition: "all 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.borderColor = "var(--border-1)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "var(--border-0)"; }}
                  >
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${rankColor(f.player_rank)}18`, border: `1px solid ${rankColor(f.player_rank)}44`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.1rem", color: rankColor(f.player_rank) }}>
                      {f.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="text-sm font-600">{f.name}</div>
                      <div className="text-xs text-muted">{f.player_class} · {f.player_rank}-Rank</div>
                    </div>
                    <MessageSquare size={16} style={{ color: "var(--t3)" }} />
                  </div>
                ))}
              </div>
            )}
          </article>
        )
      )}
    </section>
  );
}
