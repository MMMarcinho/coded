import { describe, expect, it } from "vitest";
import {
  addSelfTest,
  blockingSelfTests,
  selfTestTally,
  setSelfTestStatus,
  validateContract,
} from "../src/contract.js";
import { slugify } from "../src/store.js";
import type { TaskContract } from "../src/types.js";

describe("validateContract", () => {
  it("requires a goal summary", () => {
    const c = { goal: { summary: "" } } as TaskContract;
    const { errors } = validateContract(c);
    expect(errors.some((e) => e.includes("goal.summary"))).toBe(true);
  });

  it("accepts a minimal valid contract with warnings", () => {
    const c: TaskContract = {
      goal: { summary: "do the thing" },
      scope: { in: ["a"], out: ["b"] },
      selfTests: [{ id: "st-1", name: "t", required: true }],
    };
    const { errors, warnings } = validateContract(c);
    expect(errors).toHaveLength(0);
    expect(Array.isArray(warnings)).toBe(true);
  });

  it("flags duplicate self-test ids", () => {
    const c: TaskContract = {
      goal: { summary: "x" },
      selfTests: [
        { id: "st-1", name: "a" },
        { id: "st-1", name: "b" },
      ],
    };
    const { errors } = validateContract(c);
    expect(errors.some((e) => e.includes("Duplicate self-test id"))).toBe(true);
  });

  it("warns when no self-test is required", () => {
    const c: TaskContract = {
      goal: { summary: "x" },
      selfTests: [{ id: "st-1", name: "a", required: false }],
    };
    const { warnings } = validateContract(c);
    expect(warnings.some((w) => w.includes("required"))).toBe(true);
  });
});

describe("self-test mutations", () => {
  it("adds tests with sequential ids", () => {
    const c: TaskContract = { goal: { summary: "x" } };
    expect(addSelfTest(c, "first").id).toBe("st-1");
    expect(addSelfTest(c, "second").id).toBe("st-2");
    expect(c.selfTests).toHaveLength(2);
  });

  it("writes status back and tallies", () => {
    const c: TaskContract = {
      goal: { summary: "x" },
      selfTests: [
        { id: "st-1", name: "a", required: true },
        { id: "st-2", name: "b", required: true },
      ],
    };
    setSelfTestStatus(c, "st-1", "passed", "ran it");
    expect(c.selfTests![0].status).toBe("passed");
    expect(c.selfTests![0].latestEvidence).toBe("ran it");
    expect(selfTestTally(c)).toContain("1/2 passed");
    expect(blockingSelfTests(c).map((t) => t.id)).toEqual(["st-2"]);
  });

  it("throws on unknown self-test id", () => {
    const c: TaskContract = { goal: { summary: "x" }, selfTests: [] };
    expect(() => setSelfTestStatus(c, "st-9", "passed")).toThrow(/No self-test/);
  });
});

describe("slugify", () => {
  it("keeps unicode (chinese) characters", () => {
    expect(slugify("用户个人信息完善")).toBe("用户个人信息完善");
  });

  it("collapses punctuation and trims dashes", () => {
    expect(slugify("Fix: the login!! page")).toBe("fix-the-login-page");
  });

  it("falls back to 'task' when empty", () => {
    expect(slugify("!!!")).toBe("task");
  });
});
