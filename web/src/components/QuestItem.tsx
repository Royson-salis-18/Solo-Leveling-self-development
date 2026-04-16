import type { Quest } from "../lib/mockData";
import { Button } from "./Button";

interface QuestItemProps {
  quest: Quest;
  onComplete?: (id: string) => void;
  onDelete?: (id: string) => void;
  isCompleted?: boolean;
}

export function QuestItem({
  quest,
  onComplete,
  onDelete,
  isCompleted = false,
}: QuestItemProps) {
  return (
    <div className="quest-item">
      <div className="quest-item-content">
        <div className="quest-item-title">{quest.title}</div>
        <div className="flex gap-8" style={{ gap: "8px" }}>
          <span className="quest-item-category">{quest.category}</span>
          {quest.deadline && (
            <span className="quest-item-category">
              Due: {new Date(quest.deadline).toLocaleDateString()}
            </span>
          )}
        </div>
        {quest.description && (
          <p style={{ margin: "4px 0 0", color: "#94a3b8", fontSize: "0.9rem" }}>
            {quest.description}
          </p>
        )}
      </div>
      <div className="flex-between" style={{ gap: "12px" }}>
        <div className="quest-item-points">+{quest.points} XP</div>
        <div style={{ display: "flex", gap: "8px" }}>
          {!isCompleted && onComplete && (
            <Button
              variant="success"
              size="sm"
              onClick={() => onComplete(quest.id)}
            >
              ✓ Complete
            </Button>
          )}
          {onDelete && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => onDelete(quest.id)}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
