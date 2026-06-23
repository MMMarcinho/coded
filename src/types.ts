// coded — a minimal state store for long-running tasks.
// v1 scope: define a task and manage its plan (steps). One JSON file per task.

export type TaskStatus = "active" | "done";

export type StepStatus = "todo" | "doing" | "done" | "blocked";

// A Step is one unit of the plan — the "what's next" backbone that lets a fresh
// session pick the task back up.
export interface Step {
  id: string; // s-1, s-2, ...
  text: string;
  status: StepStatus;
  note?: string; // optional result, or why it is blocked
}

// A Task is one long-running piece of work, stored as .coded/tasks/<id>.json.
export interface Task {
  id: string;
  requirement: string; // the one-line definition of what this task is
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  steps: Step[];
}
