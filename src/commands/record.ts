import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { codedPaths, findCodedRoot, taskDir } from "../paths.js";
import { appendEvent, loadMeta, resolveTaskId, setStatus } from "../store.js";
import { cmdPrompt } from "./prompt.js";

// `coded checkpoint <id>`: without --record, generate the checkpoint prompt.
// With --record <file>, store the agent's structured output as the next snapshot.
export function cmdCheckpoint(
  taskRef: string | undefined,
  opts: { record?: string; agent?: string; print?: boolean },
): void {
  if (!opts.record) {
    cmdPrompt(taskRef, { stage: "checkpoint", agent: opts.agent, print: opts.print });
    return;
  }
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const taskId = resolveTaskId(paths, taskRef);
  const meta = loadMeta(paths, taskId);
  const cpDir = join(taskDir(paths, taskId), "checkpoints");
  mkdirSync(cpDir, { recursive: true });

  const next = readdirSync(cpDir).filter((f) => f.endsWith(".yaml")).length + 1;
  const dest = join(cpDir, `${next}.yaml`);
  copyFileSync(opts.record, dest);

  const drift = (parse(readFileSync(dest, "utf8")) ?? {}).drift ?? {};
  appendEvent(paths, meta, {
    kind: "checkpoint",
    stage: "checkpoint",
    note: `recorded ${next}.yaml (drift: ${drift.status ?? "unknown"})`,
  });
  console.log(`Recorded checkpoint ${dest} (drift: ${drift.status ?? "unknown"}).`);
}

// `coded complete <id>`: without --record, generate the completion prompt.
// With --record <file>, store completion.yaml and reflect status.
export function cmdComplete(
  taskRef: string | undefined,
  opts: { record?: string; agent?: string; print?: boolean },
): void {
  if (!opts.record) {
    cmdPrompt(taskRef, { stage: "complete", agent: opts.agent, print: opts.print });
    return;
  }
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const taskId = resolveTaskId(paths, taskRef);
  const meta = loadMeta(paths, taskId);
  const dest = join(taskDir(paths, taskId), "completion.yaml");
  copyFileSync(opts.record, dest);

  const c = parse(readFileSync(dest, "utf8")) ?? {};
  appendEvent(paths, meta, {
    kind: "complete",
    stage: "complete",
    note: `status: ${c.status ?? "unknown"} -> ${c.recommendation ?? "n/a"}`,
  });
  if (c.status === "done") setStatus(paths, meta, "done", "completion analysis: done");
  console.log(`Recorded completion (${c.status ?? "unknown"} -> ${c.recommendation ?? "n/a"}).`);
}

export function ensureExists(file?: string): void {
  if (file && !existsSync(file)) throw new Error(`--record file not found: ${file}`);
}
