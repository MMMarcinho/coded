import { addStep, resolveTask, saveTask, setStepStatus, stepTally } from "../store.js";
import { emit } from "../output.js";
import type { StepStatus } from "../types.js";

// `coded step add "<text>"` — append a step to the plan.
export function cmdStepAdd(taskRef: string | undefined, text: string): void {
  if (!text || !text.trim()) throw new Error('Step text is required: coded step add "<text>".');
  const task = resolveTask(taskRef);
  const step = addStep(task, text.trim());
  saveTask(task);
  emit({ task: task.id, step, tally: stepTally(task) }, () =>
    console.log(`Added ${step.id} "${step.text}".  ${stepTally(task)}`),
  );
}

// `coded step start|done|block <id> [note]` — move a step through the plan.
const VERB_TO_STATUS: Record<"start" | "done" | "block", StepStatus> = {
  start: "doing",
  done: "done",
  block: "blocked",
};

export function cmdStepStatus(
  verb: keyof typeof VERB_TO_STATUS,
  taskRef: string | undefined,
  id: string,
  note: string | undefined,
): void {
  const task = resolveTask(taskRef);
  const step = setStepStatus(task, id, VERB_TO_STATUS[verb], note);
  saveTask(task);
  emit({ task: task.id, step, tally: stepTally(task) }, () =>
    console.log(`${step.id} -> ${step.status}.  ${stepTally(task)}`),
  );
}
