import { describe, expect, it } from "vitest";
import { validateContract } from "../src/contract.js";
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
