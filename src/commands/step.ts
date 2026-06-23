import { codedPaths, findCodedRoot, loopContractPath } from "../paths.js";
import { appendEvent, loadLoop, resolveLoopId, setStatus } from "../store.js";
import {
  addStep,
  loadContract,
  saveContract,
  setStepStatus,
  stepTally,
  summarizeSteps,
} from "../contract.js";
import { emit } from "../output.js";
import type { LoopContract, StepStatus } from "../types.js";

function resolve(taskRef?: string) {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  return { paths, loopId };
}

// `coded step add "<text>"` — append a step to the working plan.
export function cmdStepAdd(taskRef: string | undefined, text: string): void {
  const { paths, loopId } = resolve(taskRef);
  const cPath = loopContractPath(paths, loopId);
  const contract = loadContract(cPath);
  const step = addStep(contract, text);
  saveContract(cPath, contract);
  const meta = loadLoop(paths, loopId);
  appendEvent(paths, meta, { kind: "step", note: `add ${step.id}: ${text}` });
  emit({ step, tally: stepTally(contract) }, () =>
    console.log(`Added ${step.id} "${text}".  ${stepTally(contract)}`),
  );
}

// `coded step start|done|block <id> [note]` — move a step through the plan.
const VERB_TO_STATUS: Record<string, StepStatus> = {
  start: "doing",
  done: "done",
  block: "blocked",
  todo: "todo",
};

export function cmdStepStatus(
  verb: keyof typeof VERB_TO_STATUS,
  taskRef: string | undefined,
  id: string,
  note: string | undefined,
): void {
  const { paths, loopId } = resolve(taskRef);
  const cPath = loopContractPath(paths, loopId);
  const contract = loadContract(cPath);
  const step = setStepStatus(contract, id, VERB_TO_STATUS[verb], note);
  saveContract(cPath, contract);
  const meta = loadLoop(paths, loopId);
  appendEvent(paths, meta, { kind: "step", note: `${id} -> ${step.status}${note ? ` (${note})` : ""}` });
  // Touching the plan means work is underway — reflect that in the lifecycle.
  if (meta.status === "created") setStatus(paths, meta, "in_progress");
  emit({ step, tally: stepTally(contract) }, () =>
    console.log(`${id} -> ${step.status}.  ${stepTally(contract)}`),
  );
}

// `coded step list` — show the plan.
export function cmdStepList(taskRef?: string): void {
  const { paths, loopId } = resolve(taskRef);
  const contract: LoopContract = loadContract(loopContractPath(paths, loopId));
  emit({ loop: loopId, tally: stepTally(contract), steps: contract.steps ?? [] }, () => {
    console.log(`Plan (${stepTally(contract)}):`);
    console.log(summarizeSteps(contract));
  });
}
