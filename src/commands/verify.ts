import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { codedPaths, findCodedRoot, loopContractPath, loopDir } from "../paths.js";
import { appendEvent, loadConfig, loadLoop, resolveLoopId } from "../store.js";
import {
  loadContract,
  saveContract,
  selfTestTally,
  setSelfTestStatus,
} from "../contract.js";
import { pendingForAgent, runCommandSelfTests } from "../runner.js";
import { buildConfirmPrompt, parseAgentResults, toSelfTestStatus } from "../confirm.js";
import { chooseVerifyAgent, launchAgent, probeAgent, runAgentHeadless } from "../launch.js";
import type { ContractCheckpoint } from "../types.js";

export interface VerifyOptions {
  agent?: string;
  print?: boolean;
  interactive?: boolean;
}

// `coded verify [loop]` — proactively confirm the contract's self-tests and
// checkpoints after coding. Phase 1: coded runs command-backed self-tests.
// Phase 2: coded wakes the agent to confirm the rest, then writes results back.
export function cmdVerify(taskRef: string | undefined, opts: VerifyOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const cPath = loopContractPath(paths, loopId);
  const contract = loadContract(cPath);

  // Phase 1 — run what coded can run.
  const ran = runCommandSelfTests(root, contract);
  if (ran.length) {
    console.log("Ran command self-tests:");
    for (const r of ran) console.log(`  ${r.passed ? "✓" : "✗"} ${r.id} ${r.name}`);
    saveContract(cPath, contract);
  }

  // Phase 2 — hand the rest to the agent.
  const pending = pendingForAgent(contract);
  if (pending.length === 0) {
    console.log(`\nNo agent confirmation needed. ${selfTestTally(contract)}`);
    appendEvent(paths, meta, { kind: "checkpoint", stage: "verify", note: `auto-ran ${ran.length} command tests` });
    return;
  }

  const prompt = buildConfirmPrompt(contract, pending);
  const packsDir = join(loopDir(paths, loopId), "packs");
  mkdirSync(packsDir, { recursive: true });
  const packPath = join(packsDir, `confirm-${stamp()}.md`);
  writeFileSync(packPath, prompt);

  // Pick the verifying agent intentionally — cross-check against whoever
  // implemented, and announce the choice.
  const choice = chooseVerifyAgent({
    explicit: opts.agent,
    implementAgent: meta.implementAgent,
    configVerifyAgent: config.defaultAgents?.verify,
  });
  const agent = choice.agent;
  console.log(`Verify agent: ${agent} (${choice.reason}).`);

  if (opts.print) {
    console.log("\n" + prompt);
    console.log(`\n# Confirm prompt also saved to ${packPath}`);
    return;
  }

  if (opts.interactive) {
    const res = launchAgent(agent, prompt);
    if (!res.launched) console.log("\n" + prompt);
    console.log("\nAfter confirming, run `coded selftest pass/fail <id>` for any the agent verified.");
    return;
  }

  // Pre-flight: make sure the agent is not just present but actually runs,
  // before committing to a long headless session.
  const probe = probeAgent(agent);
  if (!probe.ok) {
    const other = agent === "codex" ? "claude-code" : "codex";
    if (!probe.available) {
      console.error(`Verify agent '${probe.binary}' is not installed.`);
    } else {
      console.error(`Verify agent '${probe.binary}' is installed but not runnable: ${probe.error}`);
    }
    console.error(`Options (coded won't silently switch agents):`);
    console.error(`  - fix/install ${probe.binary} for the independent angle, or`);
    console.error(`  - \`coded verify --agent ${other}\` to verify with ${other} (same as implementer — weaker check), or`);
    console.error(`  - \`coded verify --print\` to confirm manually.`);
    console.error(`\nConfirm prompt saved to ${packPath}. See \`coded doctor\`.`);
    process.exitCode = 1;
    return;
  }

  // Wake the agent headlessly and write its verdicts back.
  console.log(`\nAsking ${agent} (${probe.version ?? "ok"}) to confirm ${pending.length} item(s)…`);
  const head = runAgentHeadless(agent, prompt);
  if (!head.ok && !head.output) {
    console.error(`Agent run failed: ${head.error ?? "no output"}. Prompt saved to ${packPath}.`);
    process.exitCode = 1;
    return;
  }

  const parsed = parseAgentResults(head.output);
  if (parsed.results.length === 0 && parsed.checkpoints.length === 0) {
    console.error("Could not parse a results block from the agent. Its reply was saved next to the prompt.");
    writeFileSync(packPath.replace(/\.md$/, ".reply.md"), head.output);
    return;
  }

  let applied = 0;
  for (const r of parsed.results) {
    const status = toSelfTestStatus(r.status);
    if (!status) {
      console.log(`  ? ${r.id} inconclusive — left as is`);
      continue;
    }
    try {
      setSelfTestStatus(contract, r.id, status, r.evidence);
      console.log(`  ${status === "passed" ? "✓" : status === "failed" ? "✗" : "·"} ${r.id} -> ${status}`);
      applied++;
    } catch {
      console.log(`  ! agent reported unknown id ${r.id}`);
    }
  }
  applyCheckpoints(contract.checkpoints, parsed.checkpoints);
  saveContract(cPath, contract);
  appendEvent(paths, meta, {
    kind: "checkpoint",
    stage: "verify",
    agent,
    note: `agent confirmed ${applied} self-test(s)`,
  });
  console.log(`\n${selfTestTally(contract)}`);
}

function applyCheckpoints(
  checkpoints: ContractCheckpoint[] | undefined,
  reported: { id: string; status: string }[],
): void {
  if (!checkpoints) return;
  for (const r of reported) {
    const cp = checkpoints.find((c) => c.id === r.id);
    if (cp && ["passed", "failed", "skipped"].includes(r.status)) {
      cp.status = r.status as ContractCheckpoint["status"];
    }
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
