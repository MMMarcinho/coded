import { codedPaths, contractPath, findCodedRoot } from "../paths.js";
import { loadMeta, resolveTaskId, setStatus } from "../store.js";
import { blockingSelfTests, loadContract, selfTestTally } from "../contract.js";

// `coded done [task]` — the light close. Checks that required self-tests pass,
// then marks the task done. No file recording required; --force to override the
// guard (and record why).
export function cmdDone(taskRef: string | undefined, opts: { force?: boolean }): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const taskId = resolveTaskId(paths, taskRef);
  const meta = loadMeta(paths, taskId);
  const contract = loadContract(contractPath(paths, taskId));

  const blocking = blockingSelfTests(contract);
  if (blocking.length && !opts.force) {
    console.error(`Not done yet — ${selfTestTally(contract)}.`);
    console.error("Required self-tests still pending:");
    for (const t of blocking) console.error(`  - ${t.id} ${t.name ?? ""} (${t.status ?? "unknown"})`);
    console.error("Mark them with `coded selftest pass <id>`, or `coded done --force` to override.");
    process.exitCode = 1;
    return;
  }

  const note = opts.force && blocking.length ? `forced (${blocking.length} pending)` : selfTestTally(contract);
  setStatus(paths, meta, "done", `done: ${note}`);
  console.log(`Task ${taskId} marked done.  ${selfTestTally(contract)}`);
}
