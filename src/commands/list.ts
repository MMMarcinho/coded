import { codedPaths, findCodedRoot } from "../paths.js";
import { listMeta } from "../store.js";

export interface ListOptions {
  status?: string;
}

export function cmdList(opts: ListOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  let tasks = listMeta(paths);
  if (opts.status) tasks = tasks.filter((t) => t.status === opts.status);

  if (tasks.length === 0) {
    console.log("No tasks. Create one with `coded new \"<title>\"`.");
    return;
  }
  for (const t of tasks) {
    console.log(`${t.status.padEnd(12)} ${t.id}`);
    console.log(`${" ".repeat(12)} ${t.title}`);
  }
}
