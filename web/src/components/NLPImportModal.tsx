import { useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import type { ParsedTask } from "../lib/nlpParser";
import { parseScheduleText, parsePotentialRewards } from "../lib/nlpParser";

interface NLPImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTasksCreate: (tasks: ParsedTask[]) => void;
}

type Step = "input" | "preview" | "customize";

export function NLPImportModal({ isOpen, onClose, onTasksCreate }: NLPImportModalProps) {
  const [step, setStep] = useState<Step>("input");
  const [textInput, setTextInput] = useState("");
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [suggestedRewards, setSuggestedRewards] = useState<any[]>([]);

  const handleParse = () => {
    if (!textInput.trim()) return;
    const tasks = parseScheduleText(textInput);
    const rewards = parsePotentialRewards(textInput);
    setParsedTasks(tasks);
    setSuggestedRewards(rewards);
    setStep("preview");
  };

  const handleCreateTasks = () => {
    onTasksCreate(parsedTasks);
    onClose();
    // Reset
    setStep("input");
    setTextInput("");
    setParsedTasks([]);
    setSuggestedRewards([]);
  };

  const deleteTask = (index: number) => {
    setParsedTasks(parsedTasks.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} title="📋 Import Schedule via NLP" onClose={onClose}>
      {step === "input" && (
        <>
          <div className="form-group">
            <label className="form-label">
              Paste your schedule from ChatGPT, Claude, or any source:
            </label>
            <textarea
              className="form-textarea"
              placeholder={`Example from ChatGPT/Claude:\n\n1. Morning meeting at 10am\n2. Code review (3 PRs)\n3. Lunch break\n4. Work on feature X (high priority)\n5. Afternoon gym session\n6. Read documentation\n\nOr paste your calendar, schedule, notes, etc.`}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              style={{ minHeight: "200px" }}
            />
            <p
              style={{
                fontSize: "0.85rem",
                color: "#94a3b8",
                marginTop: "8px",
              }}
            >
              💡 Tip: Include timing info (today, tomorrow, morning, week), priorities
              (urgent, important), and categories (work, health, learning) for better
              parsing!
            </p>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: "1.1rem", color: "#cbd5e1" }}>
              Parsed Tasks ({parsedTasks.length})
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {parsedTasks.map((task, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "12px",
                    border: "1px solid #1e293b",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.6)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", color: "#f1f5f9" }}>
                        {task.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "6px",
                          fontSize: "0.85rem",
                          color: "#94a3b8",
                        }}
                      >
                        <span
                          style={{
                            padding: "2px 8px",
                            background: "rgba(139, 92, 246, 0.2)",
                            borderRadius: "4px",
                          }}
                        >
                          {task.category}
                        </span>
                        <span
                          style={{
                            padding: "2px 8px",
                            background: "rgba(139, 92, 246, 0.2)",
                            borderRadius: "4px",
                          }}
                        >
                          +{task.points} XP
                        </span>
                        {task.deadline && (
                          <span
                            style={{
                              padding: "2px 8px",
                              background: "rgba(59, 130, 246, 0.2)",
                              borderRadius: "4px",
                            }}
                          >
                            {task.deadline}
                          </span>
                        )}
                      </div>
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div style={{ marginTop: "8px" }}>
                          {task.subtasks.map((sub, subIdx) => (
                            <div
                              key={subIdx}
                              style={{
                                fontSize: "0.85rem",
                                color: "#cbd5e1",
                                marginTop: "4px",
                                paddingLeft: "12px",
                                borderLeft: "2px solid #334155",
                              }}
                            >
                              → {sub}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => deleteTask(idx)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {suggestedRewards.length > 0 && (
            <div style={{ marginBottom: "16px", padding: "12px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 8px", color: "#10b981" }}>
                🎁 Suggested Rewards
              </h4>
              <p style={{ margin: "0", fontSize: "0.9rem", color: "#cbd5e1" }}>
                {suggestedRewards.map((r) => r.name).join(", ")}
              </p>
            </div>
          )}
        </>
      )}

      <div className="modal-footer">
        {step === "input" && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleParse}
              disabled={!textInput.trim()}
            >
              Parse Schedule
            </Button>
          </>
        )}
        {step === "preview" && (
          <>
            <Button variant="secondary" onClick={() => setStep("input")}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleCreateTasks}
              disabled={parsedTasks.length === 0}
            >
              ✓ Create {parsedTasks.length} Tasks
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
