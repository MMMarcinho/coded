import { spawnSync } from "node:child_process";
import type { LoopContract, SelfTest } from "./types.js";

export interface RunResult {
  id: string;
  name: string;
  ran: boolean;
  passed: boolean;
  evidence: string;
}

function firstLine(s: string, max = 200): string {
  const line = s.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return line.slice(0, max);
}

// `coded verify` step 1: run every self-test that has a `command`, in the
// project root, and write pass/fail + evidence straight back to the contract.
// Self-tests without a command are left for a human/session to confirm.
export function runCommandSelfTests(projectRoot: string, contract: LoopContract): RunResult[] {
  const results: RunResult[] = [];
  for (const test of contract.selfTests ?? []) {
    if (!test.command) continue;
    const proc = spawnSync(test.command, {
      cwd: projectRoot,
      shell: true,
      encoding: "utf8",
      timeout: 1000 * 60 * 10,
    });
    const passed = proc.status === 0;
    const detail = passed
      ? firstLine(proc.stdout || "exit 0")
      : firstLine(proc.stderr || proc.stdout || `exit ${proc.status}`);
    const evidence = `\`${test.command}\` -> ${passed ? "exit 0" : `exit ${proc.status}`}: ${detail}`;
    applyResult(test, passed, evidence);
    results.push({ id: test.id, name: test.name, ran: true, passed, evidence });
  }
  return results;
}

function applyResult(test: SelfTest, passed: boolean, evidence: string): void {
  test.status = passed ? "passed" : "failed";
  test.latestEvidence = evidence;
}

// Self-tests still needing manual confirmation: no command coded can run, and
// not yet resolved. The session/human confirms these with `coded selftest`.
export function pendingManual(contract: LoopContract): SelfTest[] {
  return (contract.selfTests ?? []).filter(
    (t) => !t.command && t.status !== "passed" && t.status !== "skipped",
  );
}
