import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import type { LoopContract, SelfTest, SelfTestType, Step, StepStatus } from "./types.js";

export function loadContract(path: string): LoopContract {
  const raw = readFileSync(path, "utf8");
  const doc = parse(raw);
  if (doc == null || typeof doc !== "object") {
    throw new Error(`Contract at ${path} is empty or not a mapping.`);
  }
  return doc as LoopContract;
}

export function saveContract(path: string, contract: LoopContract, header?: string): void {
  const prefix = header ? header.replace(/^/gm, "# ").trimEnd() + "\n\n" : "";
  writeFileSync(path, prefix + stringify(contract));
}

// Light, one-shot self-test status update written straight back to the
// contract — no file shuffling. Returns the updated test.
export function setSelfTestStatus(
  contract: LoopContract,
  id: string,
  status: NonNullable<SelfTest["status"]>,
  evidence?: string,
): SelfTest {
  const test = (contract.selfTests ?? []).find((t) => t.id === id);
  if (!test) {
    const known = (contract.selfTests ?? []).map((t) => t.id).join(", ") || "none";
    throw new Error(`No self-test '${id}'. Known ids: ${known}.`);
  }
  test.status = status;
  if (evidence) test.latestEvidence = evidence;
  return test;
}

export function addSelfTest(
  contract: LoopContract,
  name: string,
  opts: { type?: SelfTestType; required?: boolean; command?: string } = {},
): SelfTest {
  const tests = contract.selfTests ?? (contract.selfTests = []);
  const n = tests.length + 1;
  const test: SelfTest = {
    id: `st-${n}`,
    name,
    type: opts.type ?? (opts.command ? "command" : "manual"),
    required: opts.required ?? true,
    status: "unknown",
  };
  if (opts.command) test.command = opts.command;
  tests.push(test);
  return test;
}

// "3/4 passed (1 required pending)" — a compact health line for `status`.
export function selfTestTally(c: LoopContract): string {
  const tests = c.selfTests ?? [];
  if (tests.length === 0) return "no self-tests defined";
  const passed = tests.filter((t) => t.status === "passed").length;
  const reqPending = tests.filter(
    (t) => t.required && t.status !== "passed" && t.status !== "skipped",
  ).length;
  const tail = reqPending ? ` (${reqPending} required pending)` : "";
  return `${passed}/${tests.length} passed${tail}`;
}

// Required self-tests that are not yet passed (or skipped). Empty => done-ready.
export function blockingSelfTests(c: LoopContract): SelfTest[] {
  return (c.selfTests ?? []).filter(
    (t) => t.required && t.status !== "passed" && t.status !== "skipped",
  );
}

// --- Steps: the working plan / "what's next" backbone ------------------------

export function addStep(contract: LoopContract, text: string): Step {
  const steps = contract.steps ?? (contract.steps = []);
  const n = steps.length + 1;
  const step: Step = { id: `s-${n}`, text, status: "todo" };
  steps.push(step);
  return step;
}

export function setStepStatus(
  contract: LoopContract,
  id: string,
  status: StepStatus,
  note?: string,
): Step {
  const step = (contract.steps ?? []).find((s) => s.id === id);
  if (!step) {
    const known = (contract.steps ?? []).map((s) => s.id).join(", ") || "none";
    throw new Error(`No step '${id}'. Known ids: ${known}.`);
  }
  step.status = status;
  if (note !== undefined) step.note = note || undefined;
  return step;
}

// The step a fresh session should pick up: the one in progress, else the first
// not-yet-done step. null once every step is done (or there are no steps).
export function nextStep(c: LoopContract): Step | null {
  const steps = c.steps ?? [];
  return (
    steps.find((s) => s.status === "doing") ??
    steps.find((s) => s.status === "todo") ??
    steps.find((s) => s.status === "blocked") ??
    null
  );
}

// "2/5 done (1 in progress, 1 blocked)" — a compact plan health line.
export function stepTally(c: LoopContract): string {
  const steps = c.steps ?? [];
  if (steps.length === 0) return "no steps yet";
  const done = steps.filter((s) => s.status === "done").length;
  const doing = steps.filter((s) => s.status === "doing").length;
  const blocked = steps.filter((s) => s.status === "blocked").length;
  const extra = [doing && `${doing} in progress`, blocked && `${blocked} blocked`].filter(Boolean);
  const tail = extra.length ? ` (${extra.join(", ")})` : "";
  return `${done}/${steps.length} done${tail}`;
}

export function summarizeSteps(c: LoopContract): string {
  const steps = c.steps ?? [];
  if (steps.length === 0) return "  (none — add with `coded step add \"<text>\"`)";
  const mark: Record<StepStatus, string> = { todo: " ", doing: "~", done: "x", blocked: "!" };
  return steps
    .map((s) => {
      const note = s.note ? `  — ${s.note}` : "";
      return `  [${mark[s.status]}] ${s.id} ${s.text}${note}`;
    })
    .join("\n");
}

// --- Validation --------------------------------------------------------------

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

// Validation is lenient on purpose: a freshly created contract is mostly empty
// and the user fills it in. Errors block prompt generation; warnings only nudge.
export function validateContract(c: LoopContract): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!c.requirement || !c.requirement.summary || !c.requirement.summary.trim()) {
    errors.push("requirement.summary is required — describe what this loop should deliver.");
  }

  const scopeIn = c.scope?.in ?? [];
  if (scopeIn.length === 0) {
    warnings.push("scope.in is empty — list what is in scope to keep the agent focused.");
  }
  if ((c.scope?.out ?? []).length === 0) {
    warnings.push("scope.out is empty — non-goals are the main guard against drift.");
  }

  const selfTests = c.selfTests ?? [];
  if (selfTests.length === 0) {
    warnings.push("selfTests is empty — define how you'll know the change is right.");
  }
  const ids = new Set<string>();
  selfTests.forEach((t, i) => {
    if (!t.id) errors.push(`selfTests[${i}] is missing an id.`);
    else if (ids.has(t.id)) errors.push(`Duplicate self-test id: ${t.id}.`);
    else ids.add(t.id);
    if (!t.name || !t.name.trim()) warnings.push(`selfTests[${i}] is missing a name.`);
  });

  const required = selfTests.filter((t) => t.required);
  if (selfTests.length > 0 && required.length === 0) {
    warnings.push("No self-test is marked required — done criteria may be unenforceable.");
  }

  return { errors, warnings };
}

export function summarizeSelfTests(c: LoopContract): string {
  const tests = c.selfTests ?? [];
  if (tests.length === 0) return "  (none defined)";
  return tests
    .map((t) => {
      const status = t.status ?? "unknown";
      const req = t.required ? "required" : "optional";
      return `  [${status}] ${t.id} ${t.name ?? ""} (${req})`;
    })
    .join("\n");
}
