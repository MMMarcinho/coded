import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { readFileSync } from "node:fs";
import { codedPaths, findCodedRoot, loopDir } from "../paths.js";
import { appendEvent, loadLoop, resolveLoopId, setStatus } from "../store.js";
import { cmdContext } from "./context.js";

// `coded checkpoint <id>`: without --record, print the checkpoint-stage context.
// With --record <file>, store a structured checkpoint snapshot.
export function cmdCheckpoint(
  taskRef: string | undefined,
  opts: { record?: string; save?: boolean },
): void {
  if (!opts.record) {
    cmdContext(taskRef, { stage: "checkpoint", save: opts.save });
    return;
  }
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const cpDir = join(loopDir(paths, loopId), "checkpoints");
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

// `coded complete <id>`: without --record, print the complete-stage context.
// With --record <file>, store completion.yaml and reflect status.
export function cmdComplete(
  taskRef: string | undefined,
  opts: { record?: string; save?: boolean },
): void {
  if (!opts.record) {
    cmdContext(taskRef, { stage: "complete", save: opts.save });
    return;
  }
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const dest = join(loopDir(paths, loopId), "completion.yaml");
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
