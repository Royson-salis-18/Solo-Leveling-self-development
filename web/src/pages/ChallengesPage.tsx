import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Swords, Target, Timer, Trophy, ShieldAlert } from "lucide-react";

type Challenge = {
  id: string;
  creator_id: string;
  opponent_id: string;
  target_points: number;
  creator_start_pts: number;
  opponent_start_pts: number;
  expires_at: string;
  status: string;
  creator_name: string;
  opponent_name: string;
  creator_current_pts: number;
  opponent_current_pts: number;
};

export function ChallengesPage() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    
    const { data: chals } = await supabase
      .from("challenges")
      .select("*")
      .or(`creator_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq("status", "active");

    if (chals) {
      const uids = Array.from(new Set(chals.flatMap(c => [c.creator_id, c.opponent_id])));
      const { data: profs } = await supabase.from("user_profiles").select("user_id, name, total_points").in("user_id", uids);
      
      const merged = chals.map(c => {
         const creator = profs?.find(p => p.user_id === c.creator_id);
         const opponent = profs?.find(p => p.user_id === c.opponent_id);
         return {
            ...c,
            creator_name: creator?.name || "Unknown",
            opponent_name: opponent?.name || "Unknown",
            creator_current_pts: (creator?.total_points || 0) - c.creator_start_pts,
            opponent_current_pts: (opponent?.total_points || 0) - c.opponent_start_pts
         };
      });
      setChallenges(merged);
    }
    setLoading(false);
  };

  useEffect(() => { fetchChallenges(); }, [user]);

  if (loading) return <section className="page"><div className="panel panel-empty text-muted text-sm">Scanning Global Grid…</div></section>;

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Ranker Challenges</h2>
        <div className="vs-badge">COMPETITIVE GRID</div>
      </div>

      <article className="panel" style={{ border: "1px solid rgba(255,68,68,0.2)" }}>
        <div className="flex gap-8 text-danger mb-8">
           <ShieldAlert size={16} /> <span className="text-xs font-800 uppercase tracking-widest">Brutal Point Protocol Active</span>
        </div>
        <p className="text-xs text-muted">Points are extremely scarce. Only the most disciplined hunters will succeed in challenges. Standard tasks now yield <span className="points-brutal">10 XP</span> max.</p>
      </article>

      <div className="flex-col gap-16 mt-16">
        {challenges.length > 0 ? challenges.map(c => {
           const creatorProg = Math.min((c.creator_current_pts / c.target_points) * 100, 100);
           const opponentProg = Math.min((c.opponent_current_pts / c.target_points) * 100, 100);
           const timeLeft = Math.max(0, (new Date(c.expires_at).getTime() - Date.now()) / (1000 * 60 * 60));

           return (
              <div key={c.id} className="panel challenge-card">
                 <div className="flex-between mb-16">
                    <div className="flex gap-8 text-xs font-700 uppercase">
                       <Timer size={14} className="text-muted" /> {Math.ceil(timeLeft)}h Remaining
                    </div>
                    <div className="flex gap-8 text-xs font-700">
                       <Target size={14} className="text-accent" /> Target: {c.target_points} pts
                    </div>
                 </div>

                 <div className="challenge-vs">
                    <div className="text-center" style={{ width: '40%' }}>
                       <div className="text-sm font-800 truncate">{c.creator_id === user?.id ? "YOU" : c.creator_name}</div>
                       <div className="points-brutal text-xl">{c.creator_current_pts}</div>
                       <div className="challenge-progress-bar">
                          <div className="challenge-progress-fill" style={{ width: `${creatorProg}%`, background: '#ffcc00' }} />
                       </div>
                    </div>

                    <div className="vs-badge">VS</div>

                    <div className="text-center" style={{ width: '40%' }}>
                       <div className="text-sm font-800 truncate">{c.opponent_id === user?.id ? "YOU" : c.opponent_name}</div>
                       <div className="points-brutal text-xl">{c.opponent_current_pts}</div>
                       <div className="challenge-progress-bar">
                          <div className="challenge-progress-fill" style={{ width: `${opponentProg}%`, background: '#ff4444' }} />
                       </div>
                    </div>
                 </div>
                 
                 { (creatorProg >= 100 || opponentProg >= 100) && (
                    <div className="mt-16 text-center py-8 bg-glass-2 rounded">
                       <Trophy size={16} className="text-accent inline mr-8" />
                       <span className="text-xs font-800 uppercase">Challenge Near Completion</span>
                    </div>
                 )}
              </div>
           );
        }) : (
           <article className="panel panel-empty">
              <Swords size={32} className="opacity-20 mb-12" />
              <p className="text-muted text-sm">No active challenges. Visit the Social tab to challenge a friend.</p>
              <Button variant="secondary" size="sm" onClick={() => window.location.hash = "#/social"}>Find Opponents</Button>
           </article>
        )}
      </div>

      <article className="panel mt-16">
         <h2>Challenge Rules</h2>
         <ul className="text-xs text-muted" style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Both hunters must earn the target amount of <strong>NEW</strong> points within the time limit.</li>
            <li>Points from completed Quests and Daily Missions count towards the total.</li>
            <li>Using a <strong>Task Skip</strong> item counts as points gained.</li>
            <li>The first hunter to reach the target wins the prestige.</li>
         </ul>
      </article>
    </section>
  );
}
