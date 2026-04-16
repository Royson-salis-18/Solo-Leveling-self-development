import type { Quest } from "../lib/mockData";
import { Button } from "./Button";
import { CheckCircle, Trash2 } from "lucide-react";

interface QuestItemProps {
  quest: Quest;
  onComplete?: (id: string) => void;
  onDelete?:   (id: string) => void;
  isCompleted?: boolean;
}

export function QuestItem({ quest, onComplete, onDelete, isCompleted = false }: QuestItemProps) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 16px",
      transition: "background 0.15s",
      cursor: "default",
    }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      {/* Done indicator */}
      <div style={{ flexShrink:0, width:18 }}>
        {isCompleted
          ? <CheckCircle size={16} color="rgba(255,255,255,0.35)" />
          : <div style={{ width:14, height:14, borderRadius:"50%", border:"1px solid rgba(255,255,255,0.18)", background:"rgba(255,255,255,0.04)" }} />
        }
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{
          fontSize:"0.83rem", fontWeight:500,
          color: isCompleted ? "var(--text-tertiary)" : "var(--text-primary)",
          textDecoration: isCompleted ? "line-through" : "none",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>
          {quest.title}
        </div>
        <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap", alignItems:"center" }}>
          <span style={{ fontSize:"0.68rem", padding:"1px 6px", background:"rgba(255,255,255,0.06)", borderRadius:4, color:"var(--text-tertiary)", border:"1px solid rgba(255,255,255,0.08)" }}>
            {quest.category}
          </span>
          {quest.deadline && (
            <span style={{ fontSize:"0.68rem", color:"var(--text-tertiary)" }}>
              Due {new Date(quest.deadline).toLocaleDateString()}
            </span>
          )}
          {quest.description && (
            <span style={{ fontSize:"0.70rem", color:"var(--text-tertiary)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:200 }}>
              {quest.description}
            </span>
          )}
        </div>
      </div>

      {/* XP badge */}
      <div style={{ fontSize:"0.80rem", fontWeight:600, color: isCompleted ? "var(--text-tertiary)" : "var(--text-secondary)", whiteSpace:"nowrap", flexShrink:0 }}>
        +{quest.points} XP
      </div>

      {/* Actions */}
      {!isCompleted && (
        <div style={{ display:"flex", gap:6, flexShrink:0 }}>
          {onComplete && (
            <Button variant="success" size="sm" onClick={() => onComplete(quest.id)}>
              <CheckCircle size={12} /> Done
            </Button>
          )}
          {onDelete && (
            <Button variant="danger" size="sm" onClick={() => onDelete(quest.id)}>
              <Trash2 size={12} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
