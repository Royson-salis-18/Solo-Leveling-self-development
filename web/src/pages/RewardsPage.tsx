import { useState } from "react";
import { RewardItem } from "../components/RewardItem";
import { mockRewards } from "../lib/mockData";

export function RewardsPage() {
  const [userPoints] = useState(2840); // Mock current user points
  const [claimedRewards, setClaimedRewards] = useState<string[]>([]);

  const handleClaimReward = (id: string) => {
    if (!claimedRewards.includes(id)) {
      setClaimedRewards([...claimedRewards, id]);
      // In a real app, this would deduct points
    }
  };

  const instantRewards = mockRewards.filter((r) => r.type === "instant");
  const mediumRewards = mockRewards.filter((r) => r.type === "medium");
  const majorRewards = mockRewards.filter((r) => r.type === "major");

  return (
    <section className="page">
      <div className="page-header">
        <h1>Rewards</h1>
        <div style={{ fontSize: "1.2rem", fontWeight: "600", color: "#f59e0b" }}>
          💰 {userPoints} XP Available
        </div>
      </div>

      {instantRewards.length > 0 && (
        <article className="panel">
          <h2>⚡ Instant Rewards</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {instantRewards.map((reward) => (
              <RewardItem
                key={reward.id}
                reward={reward}
                userPoints={userPoints}
                onClaim={handleClaimReward}
              />
            ))}
          </div>
        </article>
      )}

      {mediumRewards.length > 0 && (
        <article className="panel">
          <h2>💫 Medium Rewards</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {mediumRewards.map((reward) => (
              <RewardItem
                key={reward.id}
                reward={reward}
                userPoints={userPoints}
                onClaim={handleClaimReward}
              />
            ))}
          </div>
        </article>
      )}

      {majorRewards.length > 0 && (
        <article className="panel">
          <h2>🏆 Major Rewards</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {majorRewards.map((reward) => (
              <RewardItem
                key={reward.id}
                reward={reward}
                userPoints={userPoints}
                onClaim={handleClaimReward}
              />
            ))}
          </div>
        </article>
      )}

      {claimedRewards.length > 0 && (
        <article className="panel">
          <h2>✓ Claimed Today ({claimedRewards.length})</h2>
          <p style={{ color: "#94a3b8" }}>
            Great job claiming your rewards! Come back tomorrow for more.
          </p>
        </article>
      )}
    </section>
  );
}
