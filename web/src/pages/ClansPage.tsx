import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Shield, Users, Mail, Crown, LogOut, Plus } from "lucide-react";
import { Modal } from "../components/Modal";

type Clan = {
  id: string;
  name: string;
  description: string;
  leader_id: string;
  created_at: string;
};

type Member = {
  user_id: string;
  name: string;
  role: string;
  level: number;
  total_points: number;
};

export function ClansPage() {
  const { user } = useAuth();
  const [clan, setClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [formData, setFormData] = useState({ name: "", desc: "", inviteHunterId: "" });
  const [saving, setSaving] = useState(false);

  const fetchClan = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    
    // Check if user is in a clan
    const { data: membership } = await supabase.from("clan_members").select("clan_id").eq("user_id", user.id).maybeSingle();
    
    if (membership) {
      const { data: clanData } = await supabase.from("clans").select("*").eq("id", membership.clan_id).single();
      setClan(clanData);

      // Fetch members with stats
      const { data: memberRows } = await supabase.from("clan_members").select("user_id, role").eq("clan_id", membership.clan_id);
      if (memberRows) {
        const uids = memberRows.map(m => m.user_id);
        const { data: profs } = await supabase.from("user_profiles").select("*").in("user_id", uids);
        const merged = memberRows.map(m => {
          const p = profs?.find(p => p.user_id === m.user_id);
          return { ...m, name: p?.name, level: p?.level, total_points: p?.total_points };
        });
        setMembers(merged.sort((a,b) => (b.total_points || 0) - (a.total_points || 0)));
      }
    } else {
      setClan(null);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClan(); }, [user]);

  const handleCreateClan = async () => {
    if (!supabase || !user || !formData.name.trim()) return;
    setSaving(true);
    const { data: newClan } = await supabase.from("clans").insert({
      name: formData.name,
      description: formData.desc,
      leader_id: user.id
    }).select().single();

    if (newClan) {
      await supabase.from("clan_members").insert({
        clan_id: newClan.id,
        user_id: user.id,
        role: "leader"
      });
      // Link clan to profile
      await supabase.from("user_profiles").update({ clan_id: newClan.id }).eq("user_id", user.id);
      fetchClan();
      setShowCreate(false);
    }
    setSaving(false);
  };

  const handleInvite = async () => {
    if (!supabase || !user || !clan || !formData.inviteHunterId.trim()) return;
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
       await supabase.from("clan_members").insert({
          clan_id: clan.id,
          user_id: targetId,
          role: "member"
       });
       await supabase.from("user_profiles").update({ clan_id: clan.id }).eq("user_id", targetId);
       fetchClan();
       setShowInvite(false);
       setFormData({ ...formData, inviteHunterId: "" });
    } else {
       alert("Target hunter not found in system.");
    }
    setSaving(false);
  };

  if (loading) return <section className="page"><div className="panel panel-empty text-muted">Scanning Sector…</div></section>;

  if (!clan) return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Clan Systems</h2>
      </div>
      <article className="panel panel-empty" style={{ padding: "60px 20px" }}>
        <Shield size={48} className="mb-16 opacity-30" />
        <h2>Unbound Hunter</h2>
        <p className="text-muted text-sm mb-16">You are not part of any clan. Create your own or join an existing one.</p>
        <Button variant="primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Establish Clan</Button>
      </article>

      <Modal isOpen={showCreate} title="Establish New Clan" onClose={() => setShowCreate(false)}
        footer={<><Button variant="secondary" onClick={() => setShowCreate(false)}>Abort</Button>
                 <Button variant="primary" onClick={handleCreateClan} disabled={saving}>Initialize Clan</Button></>}>
        <div className="form-group">
          <label className="form-label">Clan Designation</label>
          <input className="form-input" placeholder="e.g. Shadow Vanguard" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Clan Directive (Description)</label>
          <textarea className="form-textarea" placeholder="What is your mission?" value={formData.desc} onChange={e => setFormData({...formData, desc: e.target.value})} />
        </div>
      </Modal>
    </section>
  );

  return (
    <section className="page">
      <div className="page-header">
        <div className="flex gap-12">
          <Shield size={24} className="text-accent" />
          <h2 className="page-title">{clan.name}</h2>
        </div>
        <div className="flex gap-8">
           <Button variant="secondary" size="sm" onClick={() => setShowInvite(true)}><Mail size={13} /> Invite</Button>
           <Button variant="danger" size="sm"><LogOut size={13} /> Leave</Button>
        </div>
      </div>

      <p className="text-sm text-muted mb-16">{clan.description}</p>

      <article className="panel">
        <div className="flex-between mb-16">
          <h2 className="flex gap-8"><Users size={18} /> Hunter Roster</h2>
          <span className="text-xs text-muted">{members.length} Members</span>
        </div>
        <div className="flex-col gap-10">
          {members.map((m, i) => (
            <div key={m.user_id} className="item-row" style={{ borderLeft: i === 0 ? "3px solid #ffcc00" : "none" }}>
              <div className="flex gap-12">
                <span className="text-xs font-800 opacity-30">#0{i+1}</span>
                <div>
                   <div className="text-sm font-700 flex gap-6">
                      {m.name} {m.role === 'leader' && <Crown size={12} className="text-accent" />}
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

      <Modal isOpen={showInvite} title="Recruit Hunter" onClose={() => setShowInvite(false)}
        footer={<><Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
                 <Button variant="primary" onClick={handleInvite} disabled={saving}>Send Transmission</Button></>}>
        <p className="text-xs text-muted mb-12">Enter the target's Hunter ID to send a clan recruitment request.</p>
        <div className="form-group">
          <label className="form-label">Hunter ID</label>
          <input className="form-input" placeholder="e.g. A3F6C21B or full UUID" value={formData.inviteHunterId} onChange={e => setFormData({...formData, inviteHunterId: e.target.value})} style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
        </div>
      </Modal>
    </section>
  );
}
