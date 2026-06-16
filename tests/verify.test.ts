import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseAgentResults, toSelfTestStatus } from "../src/confirm.js";
import { pendingForAgent, runCommandSelfTests } from "../src/runner.js";
import type { LoopContract } from "../src/types.js";

describe("parseAgentResults", () => {
  it("extracts the last yaml block's results and checkpoints", () => {
    const text = [
      "Sure, here is my assessment.",
      "```yaml",
      "results:",
      "  - id: st-1",
      "    status: passed",
      "    evidence: avatar preview works",
      "  - id: st-2",
      "    status: failed",
      "    evidence: address not persisted",
      "checkpoints:",
      "  - id: cp-1",
      "    status: passed",
      "```",
    ].join("\n");
    const parsed = parseAgentResults(text);
    expect(parsed.results.map((r) => `${r.id}:${r.status}`)).toEqual(["st-1:passed", "st-2:failed"]);
    expect(parsed.checkpoints[0]).toEqual({ id: "cp-1", status: "passed", evidence: undefined });
  });

  it("returns empty lists when nothing parses", () => {
    expect(parseAgentResults("no yaml here").results).toEqual([]);
  });

  it("maps statuses, leaving inconclusive unchanged", () => {
    expect(toSelfTestStatus("passed")).toBe("passed");
    expect(toSelfTestStatus("FAIL")).toBe("failed");
    expect(toSelfTestStatus("inconclusive")).toBeNull();
  });
});

describe("runCommandSelfTests", () => {
  it("runs command tests and writes pass/fail back", () => {
    const root = mkdtempSync(join(tmpdir(), "coded-run-"));
    const contract: LoopContract = {
      requirement: { summary: "x" },
      selfTests: [
        { id: "st-1", name: "passes", command: "exit 0" },
        { id: "st-2", name: "fails", command: "exit 3" },
        { id: "st-3", name: "manual only" },
      ],
    };
    const results = runCommandSelfTests(root, contract);
    expect(results.map((r) => `${r.id}:${r.passed}`)).toEqual(["st-1:true", "st-2:false"]);
    expect(contract.selfTests![0].status).toBe("passed");
    expect(contract.selfTests![1].status).toBe("failed");
    // st-3 has no command and is left for the agent.
    expect(pendingForAgent(contract).map((t) => t.id)).toEqual(["st-3"]);
  });
});
