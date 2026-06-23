import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Step, StepStatus, Task } from "./types.js";

// --- Locating the store ------------------------------------------------------

// Walk up from a starting dir to find an existing `.coded`; null if none.
export function findCodedDir(start = process.cwd()): string | null {
  let dir = resolve(start);
  while (true) {
    const candidate = join(dir, ".coded");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Where tasks live for an existing store. Throws if there is no store yet —
// every read command needs one, and `coded start` is what creates it.
export function tasksDir(): string {
  const codedDir = findCodedDir();
  if (!codedDir) {
    throw new Error("No .coded store here. Run `coded start \"<需求>\"` to create one.");
  }
  return join(codedDir, "tasks");
}

// Create (or reuse) the store under cwd and return its tasks dir. Used by start.
export function ensureStore(): string {
  const codedDir = findCodedDir() ?? join(process.cwd(), ".coded");
  const dir = join(codedDir, "tasks");
  mkdirSync(dir, { recursive: true });
  // Task files are local working state — keep them out of git by default.
  const ignore = join(codedDir, ".gitignore");
  if (!existsSync(ignore)) writeFileSync(ignore, "tasks/\n");
  return dir;
}

// --- Ids ---------------------------------------------------------------------

export function slugify(text: string): string {
  // Keep Unicode letters/numbers (so Chinese stays readable); collapse the rest.
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "task"
  );
}

export function newTaskId(requirement: string): string {
  return `${slugify(requirement)}-${Date.now().toString(36)}`;
}

// --- Task CRUD ---------------------------------------------------------------

function taskPath(dir: string, id: string): string {
  return join(dir, `${id}.json`);
}

export function createTask(requirement: string): Task {
  const dir = ensureStore();
  const now = new Date().toISOString();
  const task: Task = {
    id: newTaskId(requirement),
    requirement,
    status: "active",
    createdAt: now,
    updatedAt: now,
    steps: [],
  };
  writeTask(dir, task);
  return task;
}

function writeTask(dir: string, task: Task): void {
  writeFileSync(taskPath(dir, task.id), JSON.stringify(task, null, 2) + "\n");
}

export function saveTask(task: Task): void {
  task.updatedAt = new Date().toISOString();
  writeTask(tasksDir(), task);
}

export function listTasks(): Task[] {
  const dir = findCodedDir() ? tasksDir() : null;
  if (!dir || !existsSync(dir)) return [];
  const tasks: Task[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    try {
      tasks.push(JSON.parse(readFileSync(join(dir, file), "utf8")) as Task);
    } catch {
      /* skip unreadable task file */
    }
  }
  // Most recently touched first — that is "the current task" by default.
  // Tie-break on id so the order is deterministic when timestamps collide.
  return tasks.sort(
    (a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id),
  );
}

// Resolve a task by (possibly partial) id, or default to the most recent one.
export function resolveTask(given?: string): Task {
  const all = listTasks();
  if (!given) {
    if (all.length === 0) throw new Error("No tasks yet. Create one with `coded start \"<需求>\"`.");
    return all[0];
  }
  const exact = all.find((t) => t.id === given);
  if (exact) return exact;
  const matches = all.filter((t) => t.id.includes(given));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`No task matches '${given}'.`);
  throw new Error(`Ambiguous task '${given}' matches: ${matches.map((m) => m.id).join(", ")}`);
}

// --- Step helpers ------------------------------------------------------------

export function addStep(task: Task, text: string): Step {
  const n = task.steps.length + 1;
  const step: Step = { id: `s-${n}`, text, status: "todo" };
  task.steps.push(step);
  return step;
}

export function setStepStatus(task: Task, id: string, status: StepStatus, note?: string): Step {
  const step = task.steps.find((s) => s.id === id);
  if (!step) {
    const known = task.steps.map((s) => s.id).join(", ") || "none";
    throw new Error(`No step '${id}'. Known ids: ${known}.`);
  }
  step.status = status;
  if (note !== undefined) step.note = note || undefined;
  return step;
}

// The step a fresh session should pick up: in-progress, else first todo, else a
// blocked one. null once every step is done (or there are none).
export function nextStep(task: Task): Step | null {
  return (
    task.steps.find((s) => s.status === "doing") ??
    task.steps.find((s) => s.status === "todo") ??
    task.steps.find((s) => s.status === "blocked") ??
    null
  );
}

// "2/5 done (1 in progress, 1 blocked)" — a compact plan health line.
export function stepTally(task: Task): string {
  const steps = task.steps;
  if (steps.length === 0) return "no steps yet";
  const done = steps.filter((s) => s.status === "done").length;
  const doing = steps.filter((s) => s.status === "doing").length;
  const blocked = steps.filter((s) => s.status === "blocked").length;
  const extra = [doing && `${doing} in progress`, blocked && `${blocked} blocked`].filter(Boolean);
  return `${done}/${steps.length} done${extra.length ? ` (${extra.join(", ")})` : ""}`;
}

export function summarizeSteps(task: Task): string {
  if (task.steps.length === 0) return '  (none — add with `coded step add "<text>"`)';
  const mark: Record<StepStatus, string> = { todo: " ", doing: "~", done: "x", blocked: "!" };
  return task.steps
    .map((s) => `  [${mark[s.status]}] ${s.id} ${s.text}${s.note ? `  — ${s.note}` : ""}`)
    .join("\n");
}
