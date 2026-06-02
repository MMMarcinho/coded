import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { codedPaths, contractPath, findCodedRoot, taskDir } from "../paths.js";
import { loadConfig, newTaskId, saveMeta } from "../store.js";
import { saveContract } from "../contract.js";
import type { TaskContract, TaskMeta } from "../types.js";

export interface NewOptions {
  workflow?: string;
  goal?: string;
}

export function cmdNew(title: string, opts: NewOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);

  const id = newTaskId(title);
  const dir = taskDir(paths, id);
  mkdirSync(join(dir, "checkpoints"), { recursive: true });

  // Seed a clean, minimal contract: goal pre-filled from the title (or --goal),
  // everything else empty so the task is runnable with zero editing and CLI
  // edits (`coded selftest add`) produce clean ids. The verbose, commented
  // reference lives at .coded/templates/contract.yaml.
  const cPath = contractPath(paths, id);
  const contract: TaskContract = {
    goal: { summary: opts.goal ?? title, userVisibleResults: [], deliverables: [] },
    context: { reason: "", relatedFiles: [] },
    scope: { in: [], out: [] },
    checkpoints: [],
    selfTests: [],
    doneCriteria: { required: [], optional: [], requiresUserConfirmation: [] },
  };
  saveContract(
    cPath,
    contract,
    "coded task contract. Only goal is required.\nFull shape & examples: .coded/templates/contract.yaml",
  );

  const now = new Date().toISOString();
  const meta: TaskMeta = {
    id,
    title,
    status: "created",
    workflow: opts.workflow ?? config.defaultWorkflow ?? "default",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, kind: "created", note: title }],
  };
  saveMeta(paths, meta);

  console.log(`Created task ${id}`);
  console.log(`  goal: ${meta.title}`);
  console.log("");
  console.log("Ready to go — `coded prompt --stage implement` will launch an agent.");
  console.log("Optional: edit the contract to add scope/self-tests:");
  console.log(`  ${cPath}`);
}
