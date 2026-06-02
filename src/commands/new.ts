import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { codedPaths, findCodedRoot, taskDir } from "../paths.js";
import { loadConfig, newTaskId, saveMeta } from "../store.js";
import type { TaskMeta } from "../types.js";

export interface NewOptions {
  workflow?: string;
}

export function cmdNew(title: string, opts: NewOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);

  const id = newTaskId(title);
  const dir = taskDir(paths, id);
  mkdirSync(join(dir, "checkpoints"), { recursive: true });

  // Seed contract.yaml from the project template so the user can fill it in.
  const template = join(paths.templatesDir, "contract.yaml");
  const contractPath = join(dir, "contract.yaml");
  if (existsSync(template)) {
    copyFileSync(template, contractPath);
  }

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
  console.log(`  contract: ${contractPath}`);
  console.log("");
  console.log("Next:");
  console.log(`  1. Fill in the contract (goal / scope / selfTests / doneCriteria).`);
  console.log(`  2. \`coded prompt ${id} --stage implement\` to launch an agent.`);
}
