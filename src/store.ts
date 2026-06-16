import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { CodedConfig, LoopEvent, LoopMeta, LoopStatus } from "./types.js";
import { codedPaths, loopDir, type CodedPaths } from "./paths.js";

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
      .replace(/-+$/g, "") || "loop"
  );
}

export function newLoopId(title: string): string {
  const stamp = Date.now().toString(36);
  return `${slugify(title)}-${stamp}`;
}

function metaPath(paths: CodedPaths, loopId: string): string {
  return join(loopDir(paths, loopId), "loop.json");
}

export function saveLoop(paths: CodedPaths, meta: LoopMeta): void {
  const dir = loopDir(paths, meta.id);
  mkdirSync(dir, { recursive: true });
  meta.updatedAt = new Date().toISOString();
  writeFileSync(metaPath(paths, meta.id), JSON.stringify(meta, null, 2) + "\n");
}

export function loadLoop(paths: CodedPaths, loopId: string): LoopMeta {
  const p = metaPath(paths, loopId);
  if (!existsSync(p)) {
    throw new Error(`No loop '${loopId}'. Run \`coded list\` to see loops.`);
  }
  return JSON.parse(readFileSync(p, "utf8")) as LoopMeta;
}

export function listLoops(paths: CodedPaths): LoopMeta[] {
  if (!existsSync(paths.runsDir)) return [];
  const loops: LoopMeta[] = [];
  for (const entry of readdirSync(paths.runsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const p = metaPath(paths, entry.name);
    if (existsSync(p)) {
      try {
        loops.push(JSON.parse(readFileSync(p, "utf8")) as LoopMeta);
      } catch {
        /* skip unreadable loop */
      }
    }
  }
  return loops.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function appendEvent(
  paths: CodedPaths,
  meta: LoopMeta,
  event: Omit<LoopEvent, "at">,
): void {
  meta.history.push({ at: new Date().toISOString(), ...event });
  saveLoop(paths, meta);
}

export function setStatus(
  paths: CodedPaths,
  meta: LoopMeta,
  status: LoopStatus,
  note?: string,
): void {
  meta.status = status;
  appendEvent(paths, meta, { kind: "status", note: note ?? status });
}

// Resolve a loop id given a possibly-partial id; if omitted, use the most
// recently created loop.
export function resolveLoopId(paths: CodedPaths, given?: string): string {
  const all = listLoops(paths);
  if (!given) {
    if (all.length === 0) throw new Error("No loops yet. Create one with `coded loop`.");
    return all[0].id;
  }
  if (all.some((t) => t.id === given)) return given;
  const matches = all.filter((t) => t.id.includes(given));
  if (matches.length === 1) return matches[0].id;
  if (matches.length === 0) throw new Error(`No loop matches '${given}'.`);
  throw new Error(
    `Ambiguous loop '${given}' matches: ${matches.map((m) => m.id).join(", ")}`,
  );
}

// Deprecated aliases — migrated code should use the Loop variants above.

/** @deprecated Use newLoopId instead. */
export const newTaskId = newLoopId;

/** @deprecated Use saveLoop instead. */
export const saveMeta = saveLoop;

/** @deprecated Use loadLoop instead. */
export const loadMeta = loadLoop;

/** @deprecated Use listLoops instead. */
export const listMeta = listLoops;

/** @deprecated Use resolveLoopId instead. */
export const resolveTaskId = resolveLoopId;

export { codedPaths, loopDir };
