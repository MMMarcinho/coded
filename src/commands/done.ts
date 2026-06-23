import { codedPaths, findCodedRoot, loopContractPath } from "../paths.js";
import { loadLoop, resolveLoopId, setStatus } from "../store.js";
import { blockingSelfTests, loadContract, selfTestTally } from "../contract.js";
import { emit } from "../output.js";

// `coded done [loop]` — the light close. Checks that required self-tests pass,
// then marks the loop done. No file recording required; --force to override the
// guard (and record why).
export function cmdDone(taskRef: string | undefined, opts: { force?: boolean }): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const contract = loadContract(loopContractPath(paths, loopId));

  const blocking = blockingSelfTests(contract);
  if (blocking.length && !opts.force) {
    emit(
      {
        loop: loopId,
        done: false,
        tally: selfTestTally(contract),
        blocking: blocking.map((t) => ({ id: t.id, name: t.name ?? "", status: t.status ?? "unknown" })),
      },
      () => {
        console.error(`Not done yet — ${selfTestTally(contract)}.`);
        console.error("Required self-tests still pending:");
        for (const t of blocking) console.error(`  - ${t.id} ${t.name ?? ""} (${t.status ?? "unknown"})`);
        console.error("Mark them with `coded selftest pass <id>`, or `coded done --force` to override.");
      },
    );
    process.exitCode = 1;
    return;
  }

  const note = opts.force && blocking.length ? `forced (${blocking.length} pending)` : selfTestTally(contract);
  setStatus(paths, meta, "done", `done: ${note}`);
  emit({ loop: loopId, done: true, tally: selfTestTally(contract), forced: Boolean(opts.force && blocking.length) }, () =>
    console.log(`Loop ${loopId} marked done.  ${selfTestTally(contract)}`),
  );
}
