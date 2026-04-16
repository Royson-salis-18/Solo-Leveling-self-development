import type { Reward } from "../lib/mockData";
import { Button } from "./Button";

interface RewardItemProps {
  reward: Reward;
  userPoints?: number;
  onClaim?: (id: string) => void;
}

export function RewardItem({ reward, userPoints = 0, onClaim }: RewardItemProps) {
  const canClaim = userPoints >= reward.xp_cost;
  const typeLabel = {
    instant: "⚡ Instant",
    medium: "💫 Medium",
    major: "🏆 Major",
  }[reward.type];

  return (
    <div className="reward-item">
      <div className="reward-item-content">
        <div className="reward-item-title">{reward.name}</div>
        <div className="flex" style={{ gap: "8px" }}>
          <span className="quest-item-category">{typeLabel}</span>
        </div>
      </div>
      <div className="flex-between" style={{ gap: "12px" }}>
        <div className="reward-item-cost">{reward.xp_cost} XP</div>
        {onClaim && (
          <Button
            variant={canClaim ? "primary" : "secondary"}
            size="sm"
            onClick={() => onClaim(reward.id)}
            disabled={!canClaim}
          >
            {canClaim ? "Claim" : "Not enough XP"}
          </Button>
        )}
      </div>
    </div>
  );
}
