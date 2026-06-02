import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { CodedConfig, TaskEvent, TaskMeta, TaskStatus } from "./types.js";
import { codedPaths, taskDir, type CodedPaths } from "./paths.js";

export function loadConfig(paths: CodedPaths): CodedConfig {
  const raw = readFileSync(paths.configPath, "utf8");
  return JSON.parse(raw) as CodedConfig;
}

export function slugify(title: string): string {
  // Keep Unicode letters/numbers (so Chinese titles stay readable); collapse
  // everything else into single dashes.
  return (
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/g, "") || "task"
  );
}

export function newTaskId(title: string): string {
  const stamp = Date.now().toString(36);
  return `${slugify(title)}-${stamp}`;
}

function metaPath(paths: CodedPaths, taskId: string): string {
  return join(taskDir(paths, taskId), "task.json");
}

export function saveMeta(paths: CodedPaths, meta: TaskMeta): void {
  const dir = taskDir(paths, meta.id);
  mkdirSync(dir, { recursive: true });
  meta.updatedAt = new Date().toISOString();
  writeFileSync(metaPath(paths, meta.id), JSON.stringify(meta, null, 2) + "\n");
}

export function loadMeta(paths: CodedPaths, taskId: string): TaskMeta {
  const p = metaPath(paths, taskId);
  if (!existsSync(p)) {
    throw new Error(`No task '${taskId}'. Run \`coded list\` to see tasks.`);
  }
  return JSON.parse(readFileSync(p, "utf8")) as TaskMeta;
}

export function listMeta(paths: CodedPaths): TaskMeta[] {
  if (!existsSync(paths.runsDir)) return [];
  const tasks: TaskMeta[] = [];
  for (const entry of readdirSync(paths.runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = metaPath(paths, entry.name);
    if (existsSync(p)) {
      try {
        tasks.push(JSON.parse(readFileSync(p, "utf8")) as TaskMeta);
      } catch {
        /* skip unreadable task */
      }
    }
  }
  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendEvent(
  paths: CodedPaths,
  meta: TaskMeta,
  event: Omit<TaskEvent, "at">,
): void {
  meta.history.push({ at: new Date().toISOString(), ...event });
  saveMeta(paths, meta);
}

export function setStatus(
  paths: CodedPaths,
  meta: TaskMeta,
  status: TaskStatus,
  note?: string,
): void {
  meta.status = status;
  appendEvent(paths, meta, { kind: "status", note: note ?? status });
}

// Resolve a task id given a possibly-partial id; if omitted, use the most
// recently created task.
export function resolveTaskId(paths: CodedPaths, given?: string): string {
  const all = listMeta(paths);
  if (!given) {
    if (all.length === 0) throw new Error("No tasks yet. Create one with `coded new`.");
    return all[0].id;
  }
  if (all.some((t) => t.id === given)) return given;
  const matches = all.filter((t) => t.id.includes(given));
  if (matches.length === 1) return matches[0].id;
  if (matches.length === 0) throw new Error(`No task matches '${given}'.`);
  throw new Error(
    `Ambiguous task '${given}' matches: ${matches.map((m) => m.id).join(", ")}`,
  );
}

export { codedPaths, taskDir };
