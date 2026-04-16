import { useState } from "react";
import { mockLeaderboard } from "../lib/mockData";
import { Medal } from "lucide-react";

export function LeaderboardPage() {
  const [leaderboard]  = useState(mockLeaderboard);
  const [filterLevel,  setFilterLevel] = useState<number | null>(null);
  const [activeView,   setActiveView]  = useState<"global"|"weekly">("global");

  const displayUsers = filterLevel
    ? leaderboard.filter(u => u.level >= filterLevel)
    : leaderboard;

  const rankEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <section className="page">
      <div className="page-header">
        <h2 className="page-title">Leaderboard</h2>
        <select
          className="form-select"
          style={{ width: 160 }}
          onChange={e => setFilterLevel(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">All Levels</option>
          <option value="10">Level 10+</option>
          <option value="15">Level 15+</option>
          <option value="20">Level 20+</option>
        </select>
      </div>

      {/* View tabs */}
      <div className="tabs">
        <div className={`tab${activeView==="global"?" active":""}`}  onClick={()=>setActiveView("global")}>Global</div>
        <div className={`tab${activeView==="weekly"?" active":""}`}  onClick={()=>setActiveView("weekly")}>This Week</div>
      </div>

      {/* Top 3 podium cards */}
      {displayUsers.length >= 3 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:4 }}>
          {[displayUsers[1], displayUsers[0], displayUsers[2]].map((user, pos) => {
            const isPodiumTop = pos === 1;
            return (
              <div key={user.email} className="panel" style={{
                textAlign:"center", padding:"20px 12px",
                background: isPodiumTop ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
                border: isPodiumTop ? "1px solid rgba(255,255,255,0.18)" : undefined,
                transform: isPodiumTop ? "translateY(-4px)" : undefined,
              }}>
                <div style={{ fontSize:"1.6rem", marginBottom:6 }}>{rankEmoji(user.rank)}</div>
                <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 10px", fontSize:"1rem", fontWeight:700 }}>
                  {user.name.charAt(0)}
                </div>
                <div style={{ fontSize:"0.82rem", fontWeight:600, color:"var(--text-primary)", marginBottom:3 }}>{user.name}</div>
                <div style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", marginBottom:6 }}>Lv. {user.level}</div>
                <div style={{ fontSize:"0.80rem", fontWeight:600, color:"var(--text-secondary)" }}>{user.total_points.toLocaleString()} XP</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <article className="panel" style={{ padding:0 }}>
        {displayUsers.length === 0 ? (
          <p style={{ textAlign:"center", color:"var(--text-tertiary)", padding:"32px 20px", fontSize:"0.82rem" }}>
            No users at this level range.
          </p>
        ) : (
          displayUsers.map((user, i) => (
            <div key={user.email} className="leaderboard-item" style={{
              borderRadius: 0,
              borderBottom: i < displayUsers.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              padding: "12px 16px",
            }}>
              {/* Rank */}
              <div style={{ display:"flex", alignItems:"center", gap:8, minWidth:60 }}>
                <span style={{ fontSize:"0.80rem", color: user.rank <= 3 ? "var(--text-primary)" : "var(--text-tertiary)", fontWeight:600, fontVariantNumeric:"tabular-nums" }}>
                  {rankEmoji(user.rank) ?? `#${user.rank}`}
                </span>
              </div>

              {/* Avatar + name */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flex:1 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.10)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.80rem", fontWeight:600, flexShrink:0 }}>
                  {user.name.charAt(0)}
                </div>
                <div>
                  <div style={{ fontSize:"0.83rem", fontWeight:500, color:"var(--text-primary)" }}>{user.name}</div>
                  <div style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", display:"flex", gap:6 }}>
                    <span>Level {user.level}</span>
                    <span style={{ padding:"0 5px", background:"rgba(255,255,255,0.06)", borderRadius:4 }}>
                      {Math.floor(user.total_points / 250)} milestones
                    </span>
                  </div>
                </div>
              </div>

              {/* XP */}
              <div style={{ fontWeight:600, fontSize:"0.84rem", color:"var(--text-secondary)", fontVariantNumeric:"tabular-nums" }}>
                {user.total_points.toLocaleString()} XP
              </div>
            </div>
          ))
        )}
      </article>
    </section>
  );
}
