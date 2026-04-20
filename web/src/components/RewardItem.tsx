import type { Reward } from "../lib/mockData";
import { Button } from "./Button";

interface RewardItemProps {
  reward:     Reward;
  userPoints?: number;
  onClaim?:   (id: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  instant: "⚡ Instant",
  medium:  "💫 Medium",
  major:   "🏆 Major",
};

export function RewardItem({ reward, userPoints = 0, onClaim }: RewardItemProps) {
  const canClaim = userPoints >= reward.xp_cost;

  return (
    <div className="quest-item-wrapper"
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Icon placeholder */}
      <div className="reward-icon">
        🎁
      </div>

      {/* Content */}
      <div className="reward-content">
        <div className="reward-name">
          {reward.name}
        </div>
        <span className="reward-type-badge">
          {TYPE_LABEL[reward.type] ?? reward.type}
        </span>
      </div>

      {/* Cost */}
      <div className={`reward-cost${canClaim ? "" : " reward-cost-unavailable"}`}>
        {reward.xp_cost} XP
      </div>

      {/* Claim button */}
      {onClaim && (
        <Button variant={canClaim ? "primary" : "secondary"} size="sm" onClick={() => onClaim(reward.id)} disabled={!canClaim}>
          {canClaim ? "Claim" : "Not enough XP"}
        </Button>
      )}
    </div>
  );
}

