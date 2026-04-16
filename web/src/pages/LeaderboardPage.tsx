import { useState } from "react";
import { mockLeaderboard } from "../lib/mockData";

export function LeaderboardPage() {
  const [leaderboard] = useState(mockLeaderboard);
  const [filterLevel, setFilterLevel] = useState<number | null>(null);

  const displayUsers = filterLevel
    ? leaderboard.filter((u) => u.level >= filterLevel)
    : leaderboard;

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return null;
  };

  return (
    <section className="page">
      <div className="page-header">
        <h1>Leaderboard</h1>
        <select
          className="form-select"
          style={{ width: "200px" }}
          onChange={(e) => setFilterLevel(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">All Levels</option>
          <option value="10">Level 10+</option>
          <option value="15">Level 15+</option>
          <option value="20">Level 20+</option>
        </select>
      </div>

      <article className="panel">
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {displayUsers.map((user) => (
            <div key={user.email} className="leaderboard-item">
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
                <div style={{ minWidth: "50px", display: "flex", alignItems: "center", gap: "8px" }}>
                  {getMedalEmoji(user.rank) && (
                    <span style={{ fontSize: "1.3rem" }}>{getMedalEmoji(user.rank)}</span>
                  )}
                  <div className="leaderboard-rank"># {user.rank}</div>
                </div>

                <div className="leaderboard-user">
                  <div className="leaderboard-username">{user.name}</div>
                  <div className="leaderboard-level">
                    Level {user.level}{" "}
                    <span
                      style={{
                        marginLeft: "8px",
                        padding: "2px 8px",
                        background: "rgba(139, 92, 246, 0.2)",
                        borderRadius: "4px",
                        fontSize: "0.8rem",
                      }}
                    >
                      ✨ {Math.floor(user.total_points / 250)} milestones
                    </span>
                  </div>
                </div>
              </div>

              <div className="leaderboard-points">{user.total_points.toLocaleString()} XP</div>
            </div>
          ))}
        </div>
      </article>

      {displayUsers.length === 0 && (
        <article className="panel">
          <p style={{ textAlign: "center", color: "#94a3b8" }}>
            No users found at this level. Try adjusting your filter.
          </p>
        </article>
      )}
    </section>
  );
}
