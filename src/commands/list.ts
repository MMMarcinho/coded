import { listTasks, stepTally } from "../store.js";
import { emit } from "../output.js";

export interface ListOptions {
  status?: string;
}

// `coded list` — every task in the store, most recently touched first.
export function cmdList(opts: ListOptions): void {
  let tasks = listTasks();
  if (opts.status) tasks = tasks.filter((t) => t.status === opts.status);

  emit(
    tasks.map((t) => ({
      id: t.id,
      requirement: t.requirement,
      status: t.status,
      steps: stepTally(t),
      updatedAt: t.updatedAt,
    })),
    () => {
      if (tasks.length === 0) {
        console.log('No tasks. Create one with `coded start "<需求>"`.');
        return;
      }
      for (const t of tasks) {
        console.log(`${t.status.padEnd(8)} ${t.id}  (${stepTally(t)})`);
        console.log(`${" ".repeat(8)} ${t.requirement}`);
      }
    },
  );
}
