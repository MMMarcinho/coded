import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  addStep,
  createTask,
  listTasks,
  newTaskId,
  nextStep,
  resolveTask,
  saveTask,
  setStepStatus,
  slugify,
  stepTally,
} from "../src/store.js";

let cwd: string;
const origCwd = process.cwd();

beforeEach(() => {
  cwd = mkdtempSync(join(tmpdir(), "coded-store-"));
  process.chdir(cwd);
});
afterEach(() => process.chdir(origCwd));

describe("slugify / ids", () => {
  it("keeps unicode and collapses punctuation", () => {
    expect(slugify("用户登录！优化")).toBe("用户登录-优化");
    expect(slugify("Fix: the Login!!")).toBe("fix-the-login");
    expect(slugify("!!!")).toBe("task");
  });

  it("ids are slug + stamp", () => {
    expect(newTaskId("do a thing")).toMatch(/^do-a-thing-[a-z0-9]+$/);
  });
});

describe("task store (one JSON per task)", () => {
  it("creates a task file and lists it", () => {
    const t = createTask("ship login fix");
    expect(t.status).toBe("active");
    expect(t.steps).toEqual([]);
    const all = listTasks();
    expect(all.map((x) => x.id)).toContain(t.id);
  });

  it("resolves the most recent task by default and by partial id", () => {
    const a = createTask("first");
    const b = createTask("second");
    expect(resolveTask().id).toBe(b.id); // most recent
    expect(resolveTask(a.id).id).toBe(a.id);
    expect(() => resolveTask("nope")).toThrow(/No task matches/);
  });

  it("persists steps across reloads", () => {
    const t = createTask("x");
    addStep(t, "step one");
    addStep(t, "step two");
    saveTask(t);
    const reloaded = resolveTask(t.id);
    expect(reloaded.steps.map((s) => s.id)).toEqual(["s-1", "s-2"]);
  });
});

describe("steps", () => {
  it("adds sequential ids defaulting to todo", () => {
    const t = createTask("x");
    expect(addStep(t, "a").id).toBe("s-1");
    expect(addStep(t, "b").status).toBe("todo");
  });

  it("picks next as doing > todo, returns null when all done", () => {
    const t = createTask("x");
    addStep(t, "a");
    addStep(t, "b");
    setStepStatus(t, "s-1", "done");
    expect(nextStep(t)!.id).toBe("s-2");
    setStepStatus(t, "s-2", "doing");
    expect(nextStep(t)!.id).toBe("s-2");
    setStepStatus(t, "s-2", "done");
    expect(nextStep(t)).toBeNull();
  });

  it("stores a note and tallies", () => {
    const t = createTask("x");
    addStep(t, "a");
    setStepStatus(t, "s-1", "blocked", "waiting on api");
    expect(t.steps[0].note).toBe("waiting on api");
    expect(stepTally(t)).toContain("0/1 done");
    expect(stepTally(t)).toContain("1 blocked");
  });

  it("throws on unknown step id", () => {
    const t = createTask("x");
    expect(() => setStepStatus(t, "s-9", "done")).toThrow(/No step/);
  });
});
