import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Check, X, Search } from "lucide-react";

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
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState("");

  const fetchData = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    
    // Fetch all friendships involving current user
    const { data: frs } = await supabase
      .from("friendship")
      .select("*")
      .or(`requester_id.eq.${user.id},receiver_id.eq.${user.id}`);

    if (!frs) { setFriends([]); setLoading(false); return; }

    const profileIds = frs.map(f => f.requester_id === user.id ? f.receiver_id : f.requester_id);
    const { data: profs } = await supabase
      .from("user_profiles")
      .select("*")
      .in("user_id", profileIds);

    const merged = frs.map(f => {
      const otherId = f.requester_id === user.id ? f.receiver_id : f.requester_id;
      const p = profs?.find(p => p.user_id === otherId);
      return {
        ...p,
        status: f.status,
        request_id: f.id,
        is_requester: f.requester_id === user.id
      } as Friend;
    });

    setFriends(merged);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleSendRequest = async () => {
    if (!supabase || !user || !searchEmail.trim()) return;
    setSearching(true);
    setMsg("");

    // 1. Find user by email (using auth.users is tricky, usually we'd have a public users table or search profiles)
    // For now, we search user_profiles by name (since email isn't in profiles for privacy usually, but we can add it)
    // Actually, the user asked for search by email. Let's assume we can query profiles if they have a searchable email field or similar.
    // In a real Supabase app, you might need an RPC to find a user ID by email.
    
    const { data: targetUser, error } = await supabase.rpc("get_user_id_by_email", { email_input: searchEmail });
    
    if (error || !targetUser) {
      setMsg("Hunter not found in the system.");
      setSearching(false);
      return;
    }

    if (targetUser === user.id) {
       setMsg("You cannot add yourself.");
       setSearching(false);
       return;
    }

    const { error: inviteError } = await supabase.from("friendship").insert({
      requester_id: user.id,
      receiver_id: targetUser,
      status: "pending"
    });

    if (inviteError) setMsg("Request already exists or failed.");
    else {
      setMsg("Request sent to " + searchEmail);
      setSearchEmail("");
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

  const pending = friends.filter(f => f.status === "pending" && !f.is_requester);
  const outgoing = friends.filter(f => f.status === "pending" && f.is_requester);
  const accepted = friends.filter(f => f.status === "accepted");

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Guild Social</h2>
        <p className="text-xs text-muted">Connect with other hunters</p>
      </div>

      <article className="panel">
        <h2>Find Hunter</h2>
        <div className="flex gap-12">
          <input 
            className="form-input" 
            placeholder="Search by email..." 
            value={searchEmail} 
            onChange={e => setSearchEmail(e.target.value)}
          />
          <Button variant="primary" onClick={handleSendRequest} disabled={searching}>
            <Search size={14} /> Send Invite
          </Button>
        </div>
        {msg && <p className={`mt-8 text-xs ${msg.includes("sent") ? "text-success" : "text-danger"}`}>{msg}</p>}
      </article>

      {pending.length > 0 && (
        <article className="panel">
          <h2>Pending Invitations</h2>
          <div className="flex-col gap-8">
            {pending.map(f => (
              <div key={f.request_id} className="item-row">
                <div className="flex gap-10">
                   <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--glass-2)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700 }}>{f.name?.[0]}</div>
                   <div>
                     <div className="text-sm font-600">{f.name}</div>
                     <div className="text-xs text-muted">{f.player_class} · {f.player_rank}-Rank</div>
                   </div>
                </div>
                <div className="flex gap-6">
                  <Button variant="success" size="sm" onClick={() => handleAction(f.request_id, "accepted")}><Check size={12} /></Button>
                  <Button variant="danger" size="sm" onClick={() => handleAction(f.request_id, "rejected")}><X size={12} /></Button>
                </div>
              </div>
            ))}
          </div>
        </article>
      )}

      <article className="panel">
        <h2>Friends List</h2>
        {loading ? (
           <p className="text-muted text-xs text-center py-12">Accessing grid...</p>
        ) : accepted.length > 0 ? (
          <div className="flex-col gap-12">
             {accepted.map(f => (
                <div key={f.user_id} className="panel rpg-card" style={{ padding: 14 }}>
                   <div className="flex-between">
                      <div className="flex gap-12">
                         <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--glass-3)", border: "1px solid var(--border-1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize: "1.2rem", fontWeight:800 }}>{f.name?.[0]}</div>
                         <div>
                            <div className="text-base font-700">{f.name} <span className="rank-tag">[{f.player_rank}]</span></div>
                            <div className="profile-title-tag" style={{ fontSize: "0.6rem", marginBottom: 0 }}>{f.player_class}</div>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-800">{f.total_points.toLocaleString()} XP</div>
                         <div className="text-xs text-muted">Level {f.level}</div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        ) : (
          <p className="text-muted text-xs text-center py-12">You have no friends in the system yet.</p>
        )}
      </article>

      {outgoing.length > 0 && (
         <article className="panel">
            <h2 className="opacity-50">Outgoing Requests</h2>
            {outgoing.map(f => (
               <div key={f.request_id} className="flex-between py-6 px-12 text-sm opacity-50 border-subtle">
                  <span>{f.name}</span>
                  <span className="text-xs italic">Awaiting response...</span>
               </div>
            ))}
         </article>
      )}
    </section>
  );
}
