import { useEffect, useState } from "react";
import { useAuth } from "../lib/authContext";
import { Button } from "../components/Button";
import { Swords, Target, Timer, Trophy, ShieldAlert } from "lucide-react";

import { SystemAPI } from "../services/SystemAPI";
import { useToast } from "../lib/toast";
import type { DuelRow } from "../lib/gameTypes";

// Progress is XP EARNED since the duel began (from the server's ledger) — spending XP can't lower it.
type Challenge = DuelRow & { creator_current_pts: number; opponent_current_pts: number };

export function ChallengesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await SystemAPI.listChallenges();
      setChallenges(rows.filter(c => c.status === "active").map(c => ({ ...c, creator_current_pts: c.creator_pts, opponent_current_pts: c.opponent_pts })));
    } catch (err) {
      toast.fail(err, "Could not load duels");
    } finally {
      setLoading(false);
    }
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
        <p className="text-xs text-muted">Points are extremely scarce. Only the most disciplined hunters will succeed in challenges. Gates pay 5–50 base XP by rank (E–S), and E-rank work is capped at 15 XP a day.</p>
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
            <li>Only XP <strong>earned</strong> counts — spending it on rewards never lowers your score.</li>
            <li>The first hunter to reach the target wins; the System declares the result automatically.</li>
         </ul>
      </article>
    </section>
  );
}
