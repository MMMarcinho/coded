import { describe, expect, it } from "vitest";
import { buildResume } from "../src/commands/resume.js";
import type { Task } from "../src/types.js";

function task(steps: Task["steps"], status: Task["status"] = "active"): Task {
  return {
    id: "demo-1",
    requirement: "fix login",
    status,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z",
    steps,
  };
}

describe("buildResume", () => {
  it("points at the in-progress step", () => {
    const v = buildResume(
      task([
        { id: "s-1", text: "repro", status: "done" },
        { id: "s-2", text: "patch the guard", status: "doing" },
      ]),
    );
    expect(v.steps.next).toEqual({ id: "s-2", text: "patch the guard", status: "doing" });
    expect(v.suggestion).toContain("s-2");
  });

  it("suggests adding steps when the plan is empty", () => {
    expect(buildResume(task([])).suggestion).toContain("coded step add");
  });

  it("suggests closing when all steps are done", () => {
    const v = buildResume(task([{ id: "s-1", text: "do it", status: "done" }]));
    expect(v.steps.next).toBeNull();
    expect(v.suggestion).toContain("coded done");
  });

  it("flags a blocked next step with its note", () => {
    const v = buildResume(task([{ id: "s-1", text: "call api", status: "blocked", note: "missing token" }]));
    expect(v.suggestion).toContain("Unblock s-1");
    expect(v.suggestion).toContain("missing token");
  });

  it("reports done tasks as not resumable", () => {
    const v = buildResume(task([{ id: "s-1", text: "x", status: "done" }], "done"));
    expect(v.suggestion).toContain("done");
  });
});
