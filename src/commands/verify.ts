import { codedPaths, findCodedRoot, loopContractPath } from "../paths.js";
import { appendEvent, loadLoop, resolveLoopId } from "../store.js";
import { loadContract, saveContract, selfTestTally } from "../contract.js";
import { pendingManual, runCommandSelfTests } from "../runner.js";
import { emit } from "../output.js";

export interface VerifyOptions {
  json?: boolean;
}

// `coded verify [loop]` — run the self-tests coded can run (those with a
// `command`), write pass/fail back to the contract, then list the manual ones
// the session still needs to confirm with `coded selftest pass/fail`.
//
// coded does not launch or drive an agent here: it is a state store. The running
// session does the manual confirmation and reports back via `coded selftest`.
export function cmdVerify(taskRef: string | undefined, _opts: VerifyOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const cPath = loopContractPath(paths, loopId);
  const contract = loadContract(cPath);

  const ran = runCommandSelfTests(root, contract);
  if (ran.length) saveContract(cPath, contract);

  const pending = pendingManual(contract).map((t) => ({
    id: t.id,
    name: t.name ?? "",
    type: t.type ?? "manual",
  }));

  appendEvent(paths, meta, {
    kind: "verify",
    note: `ran ${ran.length} command test(s), ${pending.length} manual pending`,
  });

  emit(
    {
      loop: loopId,
      ran: ran.map((r) => ({ id: r.id, name: r.name, passed: r.passed, evidence: r.evidence })),
      pendingManual: pending,
      tally: selfTestTally(contract),
    },
    () => {
      if (ran.length) {
        console.log("Ran command self-tests:");
        for (const r of ran) console.log(`  ${r.passed ? "✓" : "✗"} ${r.id} ${r.name}`);
      } else {
        console.log("No command-backed self-tests to run.");
      }
      if (pending.length) {
        console.log(`\nManual self-tests still to confirm (use \`coded selftest pass/fail <id>\`):`);
        for (const p of pending) console.log(`  - ${p.id} ${p.name} (${p.type})`);
      } else {
        console.log("\nNo manual self-tests pending.");
      }
      console.log(`\n${selfTestTally(contract)}`);
    },
  );
}
