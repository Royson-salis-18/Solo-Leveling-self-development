import { useState } from "react";
import { Button } from "./Button";
import { CheckCircle, Trash2, Edit3, Plus, Zap } from "lucide-react";

export interface DBTask {
  id: string;
  user_id?: string;
  parent_id: string | null;
  title: string;
  description: string;
  category: string;
  points: number;
  is_completed: boolean;
  is_failed?: boolean;
  deadline: string | null;
  priority: string;
  assigned_to?: string | null;   // for clan/guild leader assignments
  subtasks: DBTask[];             // always present (not optional) to avoid runtime crashes
}

interface QuestItemProps {
  quest: DBTask;
  onComplete?:    (id: string, isDone: boolean) => void;
  onSkip?:        (id: string) => void;
  onDelete?:      (id: string) => void;
  onEdit?:        (quest: DBTask) => void;
  onAddSubtask?:  (parentId: string) => void;
  depth?: number;
  readOnly?: boolean; // for assigned quests viewed by members
}

export function QuestItem({
  quest, onComplete, onSkip, onDelete, onEdit, onAddSubtask,
  depth = 0, readOnly = false,
}: QuestItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isCompleted = quest.is_completed;
  const marginLeft  = depth * 20;
  const hasChildren = quest.subtasks && quest.subtasks.length > 0;

  return (
    <div className="list-divider">
      <div
        className="quest-item-wrapper"
        style={{ marginLeft: `${marginLeft}px`, position: "relative" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        {/* Depth connector line */}
        {depth > 0 && (
          <div style={{
            position: "absolute", left: -12, top: 0, bottom: 0,
            width: 2, background: `rgba(168,168,255,${Math.max(0.06, 0.2 - depth * 0.04)})`,
            borderRadius: 1,
          }} />
        )}
        {/* Expand / done indicator */}
        <div
          className="quest-checkbox"
          style={{ cursor: hasChildren ? "pointer" : "default" }}
          onClick={() => hasChildren && setExpanded(p => !p)}
        >
          {isCompleted
            ? <CheckCircle size={16} color="rgba(255,255,255,0.35)" />
            : hasChildren
              ? <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{expanded ? "▼" : "▶"}</div>
              : <div className="quest-indicator" />
          }
        </div>

        {/* Content */}
        <div className="quest-content">
          <div className={`quest-title${isCompleted ? " quest-title-completed" : ""}`} style={{ color: quest.is_failed ? '#ff4444' : undefined, textDecoration: quest.is_failed ? 'line-through' : undefined }}>
            {quest.title}
            {quest.assigned_to && (
              <span style={{ marginLeft: 8, fontSize: "0.6rem", color: "#a8a8ff", fontWeight: 700,
                background: "rgba(168,168,255,0.12)", padding: "1px 6px", borderRadius: 4 }}>
                ASSIGNED
              </span>
            )}
          </div>
          <div className="quest-meta">
            <span className="quest-point-badge">{quest.category}</span>
            {quest.priority !== "Normal" && (
              <span className={`tag${quest.priority === "URGENT" ? " tag-urgent" : ""}`}>{quest.priority}</span>
            )}
            {quest.deadline && (
              <span className="text-xs text-muted">
                Due {new Date(quest.deadline + "T00:00:00").toLocaleDateString()}
              </span>
            )}
            {quest.description && (
              <span className="quest-deadline" style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {quest.description}
              </span>
            )}
          </div>
        </div>

        {/* XP badge */}
        <div className={`quest-xp-badge${isCompleted ? " quest-xp-badge-completed" : ""}`} style={{ color: quest.is_failed ? '#ff4444' : undefined, borderColor: quest.is_failed ? '#ff4444' : undefined }}>
          {quest.is_failed ? `-${quest.points} XP (FAILED)` : `+${quest.points} XP`}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex-shrink-0 flex gap-4" style={{ opacity: isCompleted ? 0.4 : 1 }}>
            {onComplete && !isCompleted && (
              <Button variant="success" size="sm"
                onClick={() => onComplete(quest.id, isCompleted)}>
                Done
              </Button>
            )}
            {!isCompleted && onSkip && (
              <Button variant="secondary" size="sm"
                onClick={() => onSkip(quest.id)}
                title="Skip quest (uses ⚡ item)">
                <Zap size={12} />
              </Button>
            )}
            {!isCompleted && onAddSubtask && (
              <Button variant="secondary" size="sm"
                onClick={() => onAddSubtask(quest.id)} title="Add subtask">
                <Plus size={12} />
              </Button>
            )}
            {!isCompleted && onEdit && (
              <Button variant="secondary" size="sm"
                onClick={() => onEdit(quest)} title="Edit">
                <Edit3 size={12} />
              </Button>
            )}
            {onDelete && (
              <Button variant="danger" size="sm"
                onClick={() => onDelete(quest.id)} title="Delete">
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        )}
        {readOnly && onComplete && !isCompleted && (
          <Button variant="success" size="sm" onClick={() => onComplete(quest.id, isCompleted)}>
            Done
          </Button>
        )}
      </div>

      {/* Recursive subtasks */}
      {expanded && hasChildren && (
        <div className="subtasks-container">
          {quest.subtasks.map(sub => (
            <QuestItem
              key={sub.id}
              quest={sub}
              onComplete={onComplete}
              onSkip={onSkip}
              onDelete={onDelete}
              onEdit={onEdit}
              onAddSubtask={onAddSubtask}
              readOnly={readOnly}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
