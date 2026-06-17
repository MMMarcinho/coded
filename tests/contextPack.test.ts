import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildContextPack } from "../src/contextPack.js";
import { codedPaths } from "../src/paths.js";
import type { CodedConfig, LoopContract, LoopMeta } from "../src/types.js";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "coded-test-"));
  const paths = codedPaths(root);
  mkdirSync(paths.promptsDir, { recursive: true });
  mkdirSync(paths.knowledgeDir, { recursive: true });
  writeFileSync(join(paths.promptsDir, "implement.md"), "# Implement\nDo the work.");
  writeFileSync(join(paths.knowledgeDir, "project.md"), "Project facts here.");
  return paths;
}

const config: CodedConfig = {
  name: "coded",
  defaultWorkflow: "default",
  defaultAgents: { implement: "claude-code" },
  context: { defaultMode: "standard", maxKnowledgeFiles: 6, maxRecentStageRuns: 3 },
  assets: {},
};

const meta: LoopMeta = {
  id: "demo-1",
  title: "Demo",
  status: "in_progress",
  workflow: "default",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  history: [],
};

const contract: LoopContract = {
  requirement: { summary: "ship it" },
  scope: { in: ["module a"], out: ["everything else"] },
  selfTests: [{ id: "st-1", name: "smoke", required: true }],
};

describe("buildContextPack", () => {
  it("includes contract, stage prompt, knowledge, and rules", () => {
    const paths = setup();
    const pack = buildContextPack({ paths, config, meta, contract, stage: "implement" });
    expect(pack.content).toContain("# coded Context Pack");
    expect(pack.content).toContain("ship it");
    expect(pack.content).toContain("Do the work.");
    expect(pack.content).toContain("Project facts here.");
    expect(pack.content).toContain("Rules For This Session");
    expect(pack.tokenEstimate).toBeGreaterThan(0);
  });

  it("carries the user instruction through", () => {
    const paths = setup();
    const pack = buildContextPack({
      paths,
      config,
      meta,
      contract,
      stage: "implement",
      userInstruction: "focus on the error path",
    });
    expect(pack.content).toContain("focus on the error path");
  });
});
