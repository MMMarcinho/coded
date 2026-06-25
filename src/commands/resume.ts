import { nextStep, resolveTask, stepTally, summarizeSteps } from "../store.js";
import { emit } from "../output.js";
import type { Task } from "../types.js";

export interface ResumeView {
  id: string;
  requirement: string;
  status: string;
  steps: { tally: string; next: { id: string; text: string; status: string } | null; items: Task["steps"] };
  suggestion: string;
}

export interface GoalSummary {
  id: string;
  objective: string;
  suggestedGoalStatus: "active" | "complete" | "blocked";
  progress: string;
  next: { id: string; text: string; status: string } | null;
  blocked: { id: string; text: string; note?: string }[];
  note: string;
}

// Pure synthesis of "where are we / what's next" — the heart of resuming a long
// task in a fresh session. No I/O, so it is easy to unit-test.
export function buildResume(task: Task): ResumeView {
  const next = nextStep(task);
  return {
    id: task.id,
    requirement: task.requirement,
    status: task.status,
    steps: {
      tally: stepTally(task),
      next: next ? { id: next.id, text: next.text, status: next.status } : null,
      items: task.steps,
    },
    suggestion: suggest(task, next),
  };
}

// A compact bridge from coded's task ledger to an agent goal update. This does
// not mutate any external goal API; it gives the running agent a stable summary
// it can use when deciding whether the goal is active, blocked, or complete.
export function buildGoalSummary(task: Task): GoalSummary {
  const view = buildResume(task);
  const blocked = task.steps
    .filter((s) => s.status === "blocked")
    .map((s) => ({ id: s.id, text: s.text, note: s.note }));
  const suggestedGoalStatus =
    task.status === "done" ? "complete" : view.steps.next?.status === "blocked" ? "blocked" : "active";
  const nextLine = view.steps.next
    ? `Next: ${view.steps.next.id} ${view.steps.next.text}`
    : task.status === "done"
      ? "Next: none"
      : "Next: close with `coded done` if the work is actually complete";
  const blockedLine = blocked.length
    ? `Blocked: ${blocked.map((s) => `${s.id} ${s.text}${s.note ? ` (${s.note})` : ""}`).join("; ")}`
    : "Blocked: none";

  return {
    id: task.id,
    objective: task.requirement,
    suggestedGoalStatus,
    progress: view.steps.tally,
    next: view.steps.next,
    blocked,
    note: [
      `Objective: ${task.requirement}`,
      `Progress: ${view.steps.tally}`,
      nextLine,
      blockedLine,
      `Suggested goal status: ${suggestedGoalStatus}`,
    ].join("\n"),
  };
}

function suggest(task: Task, next: ReturnType<typeof nextStep>): string {
  if (task.status === "done") return "Task is done. Nothing to resume.";
  if (next?.status === "blocked") {
    return `Unblock ${next.id}${next.note ? ` (${next.note})` : ""}, then continue the plan.`;
  }
  if (next) return `Work step ${next.id}: ${next.text}`;
  if (task.steps.length === 0) return 'Plan is empty — add steps with `coded step add "<text>"`.';
  return "All steps done — close with `coded done`.";
}

export function cmdResume(taskRef?: string, opts: { goal?: boolean } = {}): void {
  const task = resolveTask(taskRef);
  if (opts.goal) {
    const summary = buildGoalSummary(task);
    emit(summary, () => {
      console.log(`Goal summary  ${summary.id}`);
      console.log(`Suggested goal status  ${summary.suggestedGoalStatus}`);
      console.log(`\n${summary.note}`);
    });
    return;
  }

  const view = buildResume(task);
  emit(view, () => {
    console.log(`Resume  ${view.id}`);
    console.log(`Status  ${view.status}`);
    console.log(`\nRequirement  ${view.requirement}`);
    console.log(`\nPlan (${view.steps.tally}):`);
    console.log(summarizeSteps(task));
    if (view.steps.next) console.log(`\n→ Next: ${view.steps.next.id} ${view.steps.next.text}`);
    console.log(`\nSuggested next: ${view.suggestion}`);
  });
}
