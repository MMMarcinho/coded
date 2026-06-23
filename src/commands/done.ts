import { resolveTask, saveTask, stepTally } from "../store.js";
import { emit } from "../output.js";

// `coded done [task]` — close a task. v1 keeps it light: it just flips the
// status. Open steps don't block (you decide when it's done), but we surface
// them so closing is a conscious choice.
export function cmdDone(taskRef: string | undefined): void {
  const task = resolveTask(taskRef);
  const open = task.steps.filter((s) => s.status !== "done").length;
  task.status = "done";
  saveTask(task);
  emit({ task: task.id, status: task.status, openSteps: open, tally: stepTally(task) }, () => {
    console.log(`Task ${task.id} marked done.  ${stepTally(task)}`);
    if (open) console.log(`(${open} step(s) were not marked done.)`);
  });
}
