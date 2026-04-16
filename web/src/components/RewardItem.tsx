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
    <div style={{
      display:"flex", alignItems:"center", gap:14, padding:"13px 16px",
      transition:"background 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Icon placeholder */}
      <div style={{ width:36, height:36, borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", flexShrink:0 }}>
        🎁
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.83rem", fontWeight:500, color:"var(--text-primary)", marginBottom:3 }}>
          {reward.name}
        </div>
        <span style={{ fontSize:"0.68rem", padding:"1px 6px", background:"rgba(255,255,255,0.06)", borderRadius:4, color:"var(--text-tertiary)", border:"1px solid rgba(255,255,255,0.08)" }}>
          {TYPE_LABEL[reward.type] ?? reward.type}
        </span>
      </div>

      {/* Cost */}
      <div style={{ fontSize:"0.82rem", fontWeight:600, color: canClaim ? "var(--text-secondary)" : "var(--text-tertiary)", whiteSpace:"nowrap", flexShrink:0 }}>
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
