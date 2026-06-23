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

function suggest(task: Task, next: ReturnType<typeof nextStep>): string {
  if (task.status === "done") return "Task is done. Nothing to resume.";
  if (next?.status === "blocked") {
    return `Unblock ${next.id}${next.note ? ` (${next.note})` : ""}, then continue the plan.`;
  }
  if (next) return `Work step ${next.id}: ${next.text}`;
  if (task.steps.length === 0) return 'Plan is empty — add steps with `coded step add "<text>"`.';
  return "All steps done — close with `coded done`.";
}

export function cmdResume(taskRef?: string): void {
  const task = resolveTask(taskRef);
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
