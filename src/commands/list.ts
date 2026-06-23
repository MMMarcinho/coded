import { codedPaths, findCodedRoot } from "../paths.js";
import { listLoops } from "../store.js";
import { emit } from "../output.js";

export interface ListOptions {
  status?: string;
}

export function cmdList(opts: ListOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  let loops = listLoops(paths);
  if (opts.status) loops = loops.filter((t) => t.status === opts.status);

  emit(
    loops.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      workflow: t.workflow,
      updatedAt: t.updatedAt,
    })),
    () => {
      if (loops.length === 0) {
        console.log('No loops. Create one with `coded loop "<需求标题>"`.');
        return;
      }
      for (const t of loops) {
        console.log(`${t.status.padEnd(14)} ${t.id}`);
        console.log(`${" ".repeat(14)} ${t.title}`);
      }
    },
  );
}
