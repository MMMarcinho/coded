import { describe, expect, it } from "vitest";
import { buildResume } from "../src/commands/resume.js";
import type { LoopContract, LoopMeta } from "../src/types.js";

function meta(overrides: Partial<LoopMeta> = {}): LoopMeta {
  return {
    id: "demo-1",
    title: "Demo",
    status: "in_progress",
    workflow: "default",
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    history: [],
    ...overrides,
  };
}

describe("buildResume", () => {
  it("points at the next step and surfaces recent notes", () => {
    const contract: LoopContract = {
      requirement: { summary: "fix login" },
      scope: { in: ["auth"], out: ["billing"] },
      steps: [
        { id: "s-1", text: "repro", status: "done" },
        { id: "s-2", text: "patch the guard", status: "doing" },
      ],
      selfTests: [{ id: "st-1", name: "login works", required: true }],
    };
    const m = meta({
      history: [
        { at: "t1", kind: "note", note: "root cause is the redirect" },
        { at: "t2", kind: "status", note: "in_progress" },
        { at: "t3", kind: "note", note: "reusing existing session helper" },
      ],
    });
    const view = buildResume(m, contract);
    expect(view.steps.next).toEqual({ id: "s-2", text: "patch the guard", status: "doing" });
    expect(view.suggestion).toContain("s-2");
    expect(view.recentNotes.map((n) => n.text)).toEqual([
      "root cause is the redirect",
      "reusing existing session helper",
    ]);
    expect(view.selfTests.blocking.map((b) => b.id)).toEqual(["st-1"]);
  });

  it("suggests closing when the plan is done and tests pass", () => {
    const contract: LoopContract = {
      requirement: { summary: "x" },
      steps: [{ id: "s-1", text: "do it", status: "done" }],
      selfTests: [{ id: "st-1", name: "t", required: true, status: "passed" }],
    };
    const view = buildResume(meta(), contract);
    expect(view.steps.next).toBeNull();
    expect(view.suggestion).toContain("coded done");
  });

  it("suggests verifying when the plan is done but tests are pending", () => {
    const contract: LoopContract = {
      requirement: { summary: "x" },
      steps: [{ id: "s-1", text: "do it", status: "done" }],
      selfTests: [{ id: "st-1", name: "t", required: true }],
    };
    expect(buildResume(meta(), contract).suggestion).toContain("coded verify");
  });

  it("flags a blocked next step", () => {
    const contract: LoopContract = {
      requirement: { summary: "x" },
      steps: [{ id: "s-1", text: "call api", status: "blocked", note: "missing token" }],
    };
    const view = buildResume(meta(), contract);
    expect(view.suggestion).toContain("Unblock s-1");
    expect(view.suggestion).toContain("missing token");
  });
});
