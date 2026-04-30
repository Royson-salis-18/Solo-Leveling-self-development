import { useState } from "react";
import { Button } from "./Button";
import { CheckCircle, Trash2, Edit3, Plus, Zap, AlertTriangle, Clock, Activity, Layers, ShieldAlert, Circle, Lock, RotateCcw, RefreshCw, Skull } from "lucide-react";
import { RaidTimer } from "./RaidTimer";

export interface DBTask {
  id: string;
  user_id?: string;
  parent_id: string | null;
  title: string;
  description: string;
  category: string;
  points: number;
  xp_tier?: string;
  is_completed: boolean;
  is_failed?: boolean;
  is_pending?: boolean;
  deadline: string | null;
  time?: string | null;
  priority: string;
  assigned_to?: string | null;   // for clan/guild leader assignments
  is_recurring?: boolean;
  is_active?: boolean;
  is_paused?: boolean;
  started_at?: string | null;
  paused_at?: string | null;
  total_elapsed?: number;
  start_time?: string | null;
  end_time?: string | null;
  subtasks: DBTask[];             // always present (not optional) to avoid runtime crashes
}

interface QuestItemProps {
  quest: DBTask;
  onComplete?:    (id: string, isDone: boolean) => void;
  onPending?:     (id: string) => void;
  onFail?:        (id: string) => void;
  onSkip?:        (id: string) => void;
  onDelete?:      (id: string) => void;
  onEdit?:        (quest: DBTask) => void;
  onAddSubtask?:  (parentId: string) => void;
  onPause?:       (id: string) => void;
  onResume?:      (id: string) => void;
  onReset?:       (id: string) => void;
  onStart?:       (id: string) => void;
  onReactivate?:  (id: string) => void;
  depth?: number;
  readOnly?: boolean; // for assigned quests viewed by members
}

export function QuestItem({
  quest, onComplete, onPending, onFail, onSkip, onDelete, onEdit, onAddSubtask, onPause, onResume, onReset, onStart, onReactivate,
  depth = 0, readOnly = false,
}: QuestItemProps) {
  const [expanded, setExpanded] = useState(true);
  const isCompleted = quest.is_completed;
  const isPending   = quest.is_pending && !isCompleted && !quest.is_failed;
  const marginLeft  = depth * 20;
  const hasChildren = quest.subtasks && quest.subtasks.length > 0;
  
  // Progress tracking
  const totalSubtasks = quest.subtasks.length;
  const completedSubtasks = quest.subtasks.filter(s => s.is_completed).length;
  const allSubtasksDone = completedSubtasks === totalSubtasks;
  const isLocked = hasChildren && !allSubtasksDone && !isCompleted;
  const isHiddenDungeon = depth > 0;

  // Logic for Dungeon Grades
  const getDungeonGrade = (d: number) => {
    if (d === 0) return hasChildren ? "Dungeon" : null;
    if (d === 1) return "Hidden Dungeon";
    if (d === 2) return "Double Dungeon";
    if (d === 3) return "Triple Dungeon";
    if (d === 4) return "Quadruple Dungeon";
    return "God-Tier Dungeon";
  };
  const dungeonGrade = getDungeonGrade(depth);
  const isRedGate = (quest.xp_tier === 'Legendary' || quest.xp_tier === 'Super') && depth >= 1;

  const XP_TIER_COLOR: Record<string, string> = {
    Legendary: "#ffd700", Super: "#c084fc", High: "#c4b5fd", Mid: "#34d399", Low: "rgba(255,255,255,0.5)"
  };
  const tierColor = XP_TIER_COLOR[quest.xp_tier ?? "Low"] ?? "rgba(255,255,255,0.5)";

  return (
    <div className="list-divider">
      <div
        className={`quest-item-wrapper ${depth > 0 ? 'nested-dungeon' : ''} ${isRedGate ? 'red-gate' : ''} ${isLocked ? 'locked-objective' : ''}`}
        style={{
          marginLeft: `${marginLeft}px`, position: "relative",
          borderLeft: isPending ? "2px solid rgba(255,160,0,0.6)" : undefined,
          background: isPending ? "rgba(255,140,0,0.04)" : depth > 0 ? "rgba(168,168,255,0.01)" : undefined,
          boxShadow: isRedGate ? "0 0 20px rgba(255,68,68,0.1)" : undefined,
        }}
        onMouseEnter={e => {
          if (isPending) e.currentTarget.style.background = "rgba(255,140,0,0.08)";
          else e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={e => {
          if (isPending) e.currentTarget.style.background = "rgba(255,140,0,0.04)";
          else e.currentTarget.style.background = isHiddenDungeon ? "rgba(168,168,255,0.02)" : "transparent";
        }}
      >
        {/* Depth connector line */}
        {depth > 0 && (
          <div style={{
            position: "absolute", left: -12, top: 0, bottom: 0,
            width: 2, background: `linear-gradient(to bottom, rgba(168,168,255,${0.3 / depth}), transparent)`,
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
            : isLocked
              ? <Lock size={14} color="#ffcc00" className="animate-pulse" />
              : hasChildren
                ? <div style={{ fontSize: 10, color: "var(--accent-primary)", marginTop: 2 }}>{expanded ? "▼" : "▶"}</div>
                : <Circle size={14} color="rgba(255,255,255,0.2)" />
          }
        </div>

        {/* Content */}
        <div className="quest-content">
          <div className={`quest-title${isCompleted ? " quest-title-completed" : ""}`} style={{ 
            color: quest.is_failed ? '#ff4444' : isPending ? '#ffa030' : isRedGate ? '#ff4444' : isLocked ? '#ffcc00' : undefined, 
            textDecoration: quest.is_failed ? 'line-through' : undefined,
            fontWeight: isRedGate || isLocked ? 800 : 500,
          }}>
            {quest.title}
            
            {/* Status Badges */}
            {quest.is_active && quest.started_at && (
              <span className={`quest-status-tag ${quest.is_paused ? 'tag-paused' : 'tag-active'}`}>
                <Activity size={9} className={quest.is_paused ? "" : "animate-pulse"} /> 
                {quest.is_paused ? "PAUSED" : <RaidTimer startedAt={quest.started_at} />}
              </span>
            )}
            {isPending && (
              <span className="quest-status-tag tag-pending">
                <AlertTriangle size={9} /> PENDING
              </span>
            )}
            {quest.is_failed && (
              <span className="quest-status-tag tag-failed">
                <Skull size={9} /> MISSION FAILED
              </span>
            )}
            {dungeonGrade && (
              <span className={`quest-status-tag ${isRedGate ? 'tag-red' : 'tag-double'}`}>
                {isRedGate ? <ShieldAlert size={9} /> : <Layers size={9} />} {dungeonGrade.toUpperCase()}
              </span>
            )}
            {isLocked && (
              <span className="quest-status-tag tag-locked">
                <Lock size={9} /> BOSS SHIELD ACTIVE
              </span>
            )}
            {!isLocked && hasChildren && !isCompleted && (
              <span className="quest-status-tag tag-boss-unlocked">
                <Zap size={9} className="animate-pulse" /> BOSS UNLOCKED
              </span>
            )}
            {quest.assigned_to && (
              <span className="quest-status-tag tag-assigned">
                ASSIGNED
              </span>
            )}
          </div>
          
          <div className="quest-meta">
            <span className="quest-point-badge">{quest.category}</span>
            {quest.priority !== "Normal" && quest.priority !== "Low" && (
              <span className={`tag${quest.priority === "URGENT" ? " tag-urgent" : ""}`}>{quest.priority}</span>
            )}
            {quest.xp_tier && quest.xp_tier !== "Low" && (
              <span className="tag" style={{ color: tierColor, borderColor: tierColor, opacity: 0.85 }}>{quest.xp_tier} XP</span>
            )}
            
            {/* Subtask Progress */}
            {hasChildren && (
              <span className={`subtask-progress ${allSubtasksDone ? 'done' : 'pending'}`}>
                <Layers size={10} /> {completedSubtasks}/{totalSubtasks} Objectives Cleared
              </span>
            )}

            {quest.deadline && (
              <span className="text-xs text-muted flex gap-2 items-center">
                <Clock size={10} />
                {new Date(quest.deadline + "T00:00:00").toLocaleDateString()}
                {quest.time && ` @ ${quest.time}`}
              </span>
            )}
            {quest.description && (
              <span className="quest-deadline" style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {quest.description}
              </span>
            )}
            {quest.is_recurring && (
              <span className="tag" style={{ color: 'var(--accent-primary)', borderColor: 'rgba(168,168,255,0.3)', background: 'rgba(168,168,255,0.05)', gap: 4, display: 'inline-flex', alignItems: 'center' }}>
                <RotateCcw size={10} />
                {(quest as any).recurrence_type?.toUpperCase() || "RECURRING"}
              </span>
            )}
          </div>
        </div>

        {/* XP badge */}
        <div className={`quest-xp-badge${isCompleted ? " quest-xp-badge-completed" : ""}`} style={{
          color: quest.is_failed ? '#ff4444' : isPending ? '#ffa030' : tierColor,
          borderColor: quest.is_failed ? '#ff4444' : isPending ? 'rgba(255,160,0,0.3)' : undefined
        }}>
          {quest.is_failed ? `-${quest.points} XP` : isPending ? `±${quest.points} XP` : `+${quest.points} XP`}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex-shrink-0 flex gap-4 action-buttons" style={{ opacity: isCompleted ? 0.4 : 1 }}>
            {/* Pause / Restart (Only for active raids) */}
            {quest.is_active && !isCompleted && (
              <>
                {quest.is_paused ? (
                  <Button variant="primary" size="sm" onClick={() => onResume?.(quest.id)} title="Resume Raid">
                    <Activity size={12} /> Resume
                  </Button>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => onPause?.(quest.id)} title="Pause Raid">
                    <Clock size={12} /> Pause
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => onReset?.(quest.id)} title="Restart Timer">
                  <RotateCcw size={12} />
                </Button>
              </>
            )}

            {/* Start Raid (For inactive/reset tasks) */}
            {!quest.is_active && !isCompleted && !isPending && onStart && (
              <Button variant="primary" size="sm" onClick={() => onStart(quest.id)} title="Initialize Raid" style={{ gap: 6 }}>
                <Zap size={12} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>START</span>
              </Button>
            )}

            {/* RESOLVE for pending tasks */}
            {isPending && onComplete && (
              <Button variant="success" size="sm" onClick={() => onComplete(quest.id, false)} title="Resolve">Resolve</Button>
            )}

            {/* CONQUER for active non-pending tasks */}
            {onComplete && !isCompleted && !isPending && (
              <Button 
                variant={isLocked ? "secondary" : "success"} 
                size="sm" 
                disabled={isLocked}
                onClick={() => onComplete(quest.id, isCompleted)}
                style={{ 
                  position: 'relative',
                  overflow: 'hidden',
                  background: isLocked ? 'rgba(255,204,0,0.1)' : undefined,
                  border: isLocked ? '1px solid #ffcc0044' : undefined,
                  color: isLocked ? '#ffcc00' : undefined,
                  fontWeight: 900
                }}
              >
                {isLocked ? (
                  <span className="flex items-center gap-2">
                    <Lock size={12} /> CLEAR OBJECTIVES
                  </span>
                ) : "CONQUER"}
              </Button>
            )}

            {/* FAIL button — shown for pending AND active non-completed tasks */}
            {onFail && !isCompleted && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => onFail(quest.id)}
                title={`Fail mission — deducts ${quest.points} XP`}
                className="btn-fail-quest"
                style={{
                  gap: 4,
                  background: 'rgba(239,68,68,0.12)',
                  border: '1px solid rgba(239,68,68,0.35)',
                  color: '#ff4444',
                  fontWeight: 900,
                  letterSpacing: '0.5px',
                }}
              >
                <Skull size={11} />
                <span style={{ fontSize: '0.6rem' }}>FAIL</span>
              </Button>
            )}

            {onPending && !isCompleted && !isPending && (
              <Button variant="secondary" size="sm" onClick={() => onPending(quest.id)} title="Defer to Pending"><Clock size={12} /></Button>
            )}
            {!isCompleted && !isPending && onSkip && (
              <Button variant="secondary" size="sm" onClick={() => onSkip(quest.id)} title="Skip"><Zap size={12} /></Button>
            )}
            {onAddSubtask && (
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => onAddSubtask(quest.id)} 
                title="Manifest Subtask (Hidden Dungeon)"
              >
                <Plus size={12} />
              </Button>
            )}
            {!isCompleted && !isPending && onEdit && (
              <Button variant="secondary" size="sm" onClick={() => onEdit(quest)} title="Edit"><Edit3 size={12} /></Button>
            )}

            {isCompleted && onReactivate && (
              <Button variant="secondary" size="sm" onClick={() => onReactivate(quest.id)} title="Return to Active" style={{ gap: 6 }}>
                <RefreshCw size={12} />
                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>RE-ACTIVATE</span>
              </Button>
            )}
            {onDelete && (
              <Button variant="danger" size="sm" onClick={() => onDelete(quest.id)} title="Delete"><Trash2 size={12} /></Button>
            )}
          </div>
        )}
        {readOnly && onComplete && !isCompleted && (
          <Button variant="success" size="sm" onClick={() => onComplete(quest.id, isCompleted)}>Done</Button>
        )}
      </div>

      {/* Recursive subtasks */}
      {expanded && hasChildren && depth < 6 && (
        <div className="subtasks-container">
          {quest.subtasks.map(sub => (
            <QuestItem
              key={sub.id}
              quest={sub}
              onComplete={onComplete}
              onPending={onPending}
              onFail={onFail}
              onSkip={onSkip}
              onDelete={onDelete}
              onEdit={onEdit}
              onAddSubtask={onAddSubtask}
              onPause={onPause}
              onResume={onResume}
              onReset={onReset}
              onStart={onStart}
              onReactivate={onReactivate}
              readOnly={readOnly}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      <style>{`
        .quest-status-tag {
          margin-left: 8px; font-size: 0.6rem; font-weight: 700; padding: 1px 6px; border-radius: 4px;
          display: inline-flex; align-items: center; gap: 3px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .tag-active { background: rgba(255,77,77,0.12); color: #ff4d4d; border: 1px solid rgba(255,77,77,0.2); }
        .tag-paused { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
        .tag-pending { background: rgba(255,160,0,0.12); color: #ffa030; }
        .tag-double { background: rgba(168,168,255,0.15); color: var(--accent-primary); border: 1px solid rgba(168,168,255,0.3); }
        .tag-red { background: rgba(255,68,68,0.2); color: #ff4444; border: 1px solid #ff4444; box-shadow: 0 0 10px rgba(255,68,68,0.3); }
        .tag-locked { background: rgba(255,204,0,0.15); color: #ffcc00; border: 1px solid #ffcc00; }
        .tag-boss-unlocked { background: rgba(52,211,153,0.15); color: #34d399; border: 1px solid #34d399; box-shadow: 0 0 15px rgba(52,211,153,0.3); }
        .tag-failed {
          background: rgba(239,68,68,0.2); color: #ff4444; border: 1px solid rgba(239,68,68,0.5);
          box-shadow: 0 0 12px rgba(239,68,68,0.35); animation: failed-pulse 2s infinite;
        }
        @keyframes failed-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(239,68,68,0.3); }
          50% { box-shadow: 0 0 18px rgba(239,68,68,0.6); }
        }
        
        .subtask-progress {
          font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border-radius: 4px; transition: 0.3s;
        }
        .subtask-progress.pending { color: #ffcc00; background: rgba(255,204,0,0.05); }
        .subtask-progress.done { color: var(--accent-primary); background: rgba(168,168,255,0.05); }

        .nested-dungeon {
          border-left: 1px solid rgba(168,168,255,0.1);
        }

        .red-gate {
          border-left: 3px solid #ff4444 !important;
          background: linear-gradient(90deg, rgba(255,68,68,0.05) 0%, transparent 100%) !important;
          animation: red-glitch 4s infinite;
        }
        .red-gate::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at 0% 50%, rgba(255,68,68,0.15) 0%, transparent 50%);
          pointer-events: none;
        }

        .locked-objective { border-left: 3px solid #ffcc00 !important; }

        .btn-fail-quest:hover {
          background: rgba(239,68,68,0.25) !important;
          border-color: #ff4444 !important;
          box-shadow: 0 0 16px rgba(239,68,68,0.4) !important;
          transform: scale(1.05);
        }

        @keyframes red-glitch {
          0%, 100% { box-shadow: 0 0 5px rgba(255,68,68,0.1); }
          50% { box-shadow: -5px 0 25px rgba(255,68,68,0.3); transform: translateX(1px); }
          52% { transform: translateX(-1px); }
          54% { transform: translateX(0); }
        }

        .action-buttons { opacity: 1 !important; }
      `}</style>
    </div>
  );
}
