import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pendingManual, runCommandSelfTests } from "../src/runner.js";
import type { LoopContract } from "../src/types.js";

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
    // st-3 has no command and is left for a human/session to confirm.
    expect(pendingManual(contract).map((t) => t.id)).toEqual(["st-3"]);
  });
});
