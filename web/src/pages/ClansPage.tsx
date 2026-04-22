import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Shield, Users, Mail, Crown, LogOut, Plus, Search } from "lucide-react";
import { Modal } from "../components/Modal";

type Clan = {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  created_at: string;
  myRole?: string;
};

type Member = {
  user_id: string;
  name: string;
  role: string;
  level: number;
  total_points: number;
};

type BrowseClan = {
  id: string;
  name: string;
  description: string;
  member_count: number;
  isMember: boolean;
};

export function ClansPage() {
  const { user } = useAuth();
  const [myClans, setMyClans]         = useState<Clan[]>([]);
  const [browsable, setBrowsable]     = useState<BrowseClan[]>([]);
  const [activeClanId, setActiveClanId] = useState<string | null>(null);
  const [members, setMembers]         = useState<Member[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showInvite, setShowInvite]   = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [formData, setFormData]       = useState({ name: "", desc: "", inviteHunterId: "" });
  const [saving, setSaving]           = useState(false);
  const [view, setView]               = useState<"mine" | "browse">("mine");

  /* ─── fetch ─── */
  const fetchAll = async () => {
    if (!supabase || !user) return;
    setLoading(true);

    // All clan_ids this user belongs to
    const { data: memberships } = await supabase
      .from("clan_members").select("clan_id, role").eq("user_id", user.id);

    const myIds = (memberships ?? []).map(m => m.clan_id);

    if (myIds.length > 0) {
      const { data: clanRows } = await supabase.from("clans").select("*").in("id", myIds);
      const enriched: Clan[] = (clanRows ?? []).map(c => ({
        ...c,
        myRole: memberships?.find(m => m.clan_id === c.id)?.role ?? "member",
      }));
      setMyClans(enriched);
      if (!activeClanId || !myIds.includes(activeClanId)) {
        setActiveClanId(enriched[0]?.id ?? null);
      }
    } else {
      setMyClans([]);
      setActiveClanId(null);
    }

    // Browse: all clans + member counts
    const { data: allClans } = await supabase.from("clans").select("id, name, description");
    const { data: allMemberships } = await supabase.from("clan_members").select("clan_id");
    const countMap = new Map<string, number>();
    (allMemberships ?? []).forEach((m: any) => countMap.set(m.clan_id, (countMap.get(m.clan_id) ?? 0) + 1));

    setBrowsable((allClans ?? []).map(c => ({
      ...c,
      member_count: countMap.get(c.id) ?? 0,
      isMember: myIds.includes(c.id),
    })));

    setLoading(false);
  };

  /* load members of active clan */
  const fetchMembers = async (clanId: string) => {
    if (!supabase) return;
    const { data: memberRows } = await supabase.from("clan_members").select("user_id, role").eq("clan_id", clanId);
    if (memberRows) {
      const uids = memberRows.map(m => m.user_id);
      const { data: profs } = await supabase.from("user_profiles").select("*").in("user_id", uids);
      const merged: Member[] = memberRows.map(m => {
        const p = profs?.find(p => p.user_id === m.user_id);
        return { user_id: m.user_id, role: m.role, name: p?.name ?? "Hunter", level: p?.level ?? 1, total_points: p?.total_points ?? 0 };
      });
      setMembers(merged.sort((a, b) => b.total_points - a.total_points));
    }
  };

  useEffect(() => { fetchAll(); }, [user]);
  useEffect(() => { if (activeClanId) fetchMembers(activeClanId); }, [activeClanId]);

  /* ─── handlers ─── */
  const handleCreateClan = async () => {
    if (!supabase || !user || !formData.name.trim()) return;
    setSaving(true);
    const { data: newClan } = await supabase.from("clans").insert({
      name: formData.name, description: formData.desc, leader_id: user.id
    }).select().single();

    if (newClan) {
      await supabase.from("clan_members").insert({ clan_id: newClan.id, user_id: user.id, role: "leader" });
      await fetchAll();
      setActiveClanId(newClan.id);
      setShowCreate(false);
      setFormData({ name: "", desc: "", inviteHunterId: "" });
    }
    setSaving(false);
  };

  const handleJoinClan = async (clanId: string) => {
    if (!supabase || !user) return;
    await supabase.from("clan_members").insert({ clan_id: clanId, user_id: user.id, role: "member" });
    await fetchAll();
    setActiveClanId(clanId);
    setView("mine");
  };

  const handleLeaveClan = async (clanId: string) => {
    if (!supabase || !user) return;
    if (!confirm("Leave this clan?")) return;
    await supabase.from("clan_members").delete().eq("clan_id", clanId).eq("user_id", user.id);
    await fetchAll();
  };

  const handleInvite = async () => {
    if (!supabase || !user || !activeClanId || !formData.inviteHunterId.trim()) return;
    setSaving(true);
    const code = formData.inviteHunterId.trim();
    const isFullUUID = code.length === 36 && code.includes("-");
    let targetId: string | null = null;
    if (isFullUUID) {
      const { data: prof } = await supabase.from("user_profiles").select("user_id").eq("user_id", code).maybeSingle();
      targetId = prof?.user_id ?? null;
    } else {
      const { data: results } = await supabase.from("user_profiles").select("user_id").eq("hunter_code", code.toUpperCase()).limit(1);
      targetId = results?.[0]?.user_id ?? null;
    }

    if (targetId) {
      if (targetId === user.id) { alert("You can't invite yourself."); setSaving(false); return; }
      await supabase.from("clan_members").upsert({ clan_id: activeClanId, user_id: targetId, role: "member" }, { onConflict: "clan_id,user_id" });
      await fetchMembers(activeClanId);
      setShowInvite(false);
      setFormData(f => ({ ...f, inviteHunterId: "" }));
    } else {
      alert("Target hunter not found.");
    }
    setSaving(false);
  };

  const activeClan = myClans.find(c => c.id === activeClanId);
  const filteredBrowse = browsable.filter(c => c.name.toLowerCase().includes(browseSearch.toLowerCase()));

  if (loading) return <section className="page"><div className="panel panel-empty text-muted">Scanning Sector…</div></section>;

  return (
    <section className="page">
      <div className="page-header">
        <div className="flex gap-12" style={{ alignItems: "center" }}>
          <Shield size={22} className="text-accent" />
          <h2 className="page-title">Clan Systems</h2>
        </div>
        <div className="flex gap-8">
          <Button variant="secondary" size="sm" onClick={() => setView(v => v === "mine" ? "browse" : "mine")}>
            <Search size={13} /> {view === "mine" ? "Browse Clans" : "My Clans"}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            <Plus size={13} /> New Clan
          </Button>
        </div>
      </div>

      {/* ── BROWSE VIEW ── */}
      {view === "browse" && (
        <div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <input className="form-input" placeholder="Search clans…" value={browseSearch}
              onChange={e => setBrowseSearch(e.target.value)} />
          </div>
          {filteredBrowse.length === 0 ? (
            <article className="panel panel-empty"><p className="text-muted text-sm">No clans found.</p></article>
          ) : (
            <div className="flex-col gap-10">
              {filteredBrowse.map(c => (
                <div key={c.id} className="item-row">
                  <div>
                    <div className="text-sm font-700">{c.name}</div>
                    <div className="text-xs text-muted">{c.description || "No description"} · {c.member_count} members</div>
                  </div>
                  {c.isMember ? (
                    <span className="tag" style={{ color: "#34d399", borderColor: "#34d399", opacity: 0.8 }}>Joined</span>
                  ) : (
                    <Button variant="secondary" size="sm" onClick={() => handleJoinClan(c.id)}>Join</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MY CLANS VIEW ── */}
      {view === "mine" && (
        <>
          {myClans.length === 0 ? (
            <article className="panel panel-empty" style={{ padding: "60px 20px" }}>
              <Shield size={48} className="mb-16 opacity-30" />
              <h2>Unbound Hunter</h2>
              <p className="text-muted text-sm mb-16">You are not part of any clan. Create your own or browse existing ones.</p>
              <div className="flex gap-8">
                <Button variant="primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Establish Clan</Button>
                <Button variant="secondary" onClick={() => setView("browse")}><Search size={16} /> Browse Clans</Button>
              </div>
            </article>
          ) : (
            <>
              {/* Clan selector tabs */}
              {myClans.length > 1 && (
                <div className="tabs" style={{ marginBottom: 20 }}>
                  {myClans.map(c => (
                    <div key={c.id}
                      className={`tab${activeClanId === c.id ? " active" : ""}`}
                      onClick={() => setActiveClanId(c.id)}>
                      {c.name}
                      {c.myRole === "leader" && <Crown size={10} style={{ marginLeft: 4, color: "#ffcc00" }} />}
                    </div>
                  ))}
                </div>
              )}

              {activeClan && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <div className="flex gap-8" style={{ alignItems: "center" }}>
                        <h2 className="page-title" style={{ margin: 0 }}>{activeClan.name}</h2>
                        <span className="tag" style={{ fontSize: "0.6rem" }}>{activeClan.myRole?.toUpperCase()}</span>
                      </div>
                      {activeClan.description && <p className="text-sm text-muted" style={{ marginTop: 4 }}>{activeClan.description}</p>}
                    </div>
                    <div className="flex gap-8">
                      {(activeClan.myRole === "leader" || activeClan.myRole === "officer") && (
                        <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}><Mail size={13} /> Invite</Button>
                      )}
                      <Button variant="danger" size="sm" onClick={() => handleLeaveClan(activeClan.id)}><LogOut size={13} /> Leave</Button>
                    </div>
                  </div>

                  <article className="panel">
                    <div className="flex-between mb-16">
                      <h2 className="flex gap-8"><Users size={18} /> Hunter Roster</h2>
                      <span className="text-xs text-muted">{members.length} Members</span>
                    </div>
                    <div className="flex-col gap-10">
                      {members.map((m, i) => (
                        <div key={m.user_id} className="item-row" style={{ borderLeft: i === 0 ? "3px solid #ffcc00" : "none" }}>
                          <div className="flex gap-12">
                            <span className="text-xs font-800 opacity-30">#{String(i + 1).padStart(2, "0")}</span>
                            <div>
                              <div className="text-sm font-700 flex gap-6">
                                {m.name} {m.role === "leader" && <Crown size={12} className="text-accent" />}
                              </div>
                              <div className="text-xs text-muted">Level {m.level}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-800 text-accent">{m.total_points.toLocaleString()} XP</div>
                            <div className="text-xs opacity-50 uppercase tracking-tighter" style={{ fontSize: 9 }}>{m.role}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* Create Clan Modal */}
      <Modal isOpen={showCreate} title="Establish New Clan" onClose={() => setShowCreate(false)}
        footer={<><Button variant="secondary" onClick={() => setShowCreate(false)}>Abort</Button>
                   <Button variant="primary" onClick={handleCreateClan} disabled={saving}>Initialize Clan</Button></>}>
        <div className="form-group">
          <label className="form-label">Clan Designation</label>
          <input className="form-input" placeholder="e.g. Shadow Vanguard" value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Clan Directive (Description)</label>
          <textarea className="form-textarea" placeholder="What is your mission?" value={formData.desc}
            onChange={e => setFormData({ ...formData, desc: e.target.value })} />
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal isOpen={showInvite} title="Recruit Hunter" onClose={() => setShowInvite(false)}
        footer={<><Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
                   <Button variant="primary" onClick={handleInvite} disabled={saving}>Send Transmission</Button></>}>
        <p className="text-xs text-muted mb-12">Enter the target's Hunter Code or full UUID.</p>
        <div className="form-group">
          <label className="form-label">Hunter ID</label>
          <input className="form-input" placeholder="e.g. A3F6C21B or full UUID"
            value={formData.inviteHunterId}
            onChange={e => setFormData({ ...formData, inviteHunterId: e.target.value })}
            style={{ fontFamily: "monospace", letterSpacing: "0.05em" }} />
        </div>
      </Modal>
    </section>
  );
}
