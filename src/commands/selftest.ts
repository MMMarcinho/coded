import { codedPaths, findCodedRoot, loopContractPath } from "../paths.js";
import { appendEvent, loadLoop, resolveLoopId } from "../store.js";
import {
  addSelfTest,
  loadContract,
  saveContract,
  selfTestTally,
  setSelfTestStatus,
} from "../contract.js";
import type { SelfTest, SelfTestType } from "../types.js";

type StatusVerb = "pass" | "fail" | "skip";
const VERB_TO_STATUS: Record<StatusVerb, NonNullable<SelfTest["status"]>> = {
  pass: "passed",
  fail: "failed",
  skip: "skipped",
};

// `coded selftest pass|fail|skip <id> [evidence]` — one-liner status writeback
// straight into the contract. This is the light alternative to recording files.
export function cmdSelfTestStatus(
  verb: StatusVerb,
  taskRef: string | undefined,
  id: string,
  evidence: string | undefined,
): void {
  const { paths, loopId } = resolve(taskRef);
  const cPath = loopContractPath(paths, loopId);
  const contract = loadContract(cPath);
  const test = setSelfTestStatus(contract, id, VERB_TO_STATUS[verb], evidence);
  saveContract(cPath, contract);

  const meta = loadLoop(paths, loopId);
  appendEvent(paths, meta, { kind: "status", note: `selftest ${id} -> ${test.status}` });
  console.log(`${id} -> ${test.status}.  ${selfTestTally(contract)}`);
}

// `coded selftest add "<name>" [--type] [--required] [--cmd]` — add a test from
// the CLI instead of hand-editing yaml.
export function cmdSelfTestAdd(
  taskRef: string | undefined,
  name: string,
  opts: { type?: string; required?: boolean; cmd?: string },
): void {
  const { paths, loopId } = resolve(taskRef);
  const cPath = loopContractPath(paths, loopId);
  const contract = loadContract(cPath);
  const test = addSelfTest(contract, name, {
    type: opts.type as SelfTestType | undefined,
    required: opts.required,
    command: opts.cmd,
  });
  saveContract(cPath, contract);
  console.log(`Added ${test.id} "${name}" (${test.type}, ${test.required ? "required" : "optional"}).`);
}

function resolve(taskRef?: string) {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  return { paths, loopId };
}
