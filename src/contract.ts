import { readFileSync } from "node:fs";
import { parse } from "yaml";
import type { TaskContract } from "./types.js";

export function loadContract(path: string): TaskContract {
  const raw = readFileSync(path, "utf8");
  const doc = parse(raw);
  if (doc == null || typeof doc !== "object") {
    throw new Error(`Contract at ${path} is empty or not a mapping.`);
  }
  return doc as TaskContract;
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

// Validation is lenient on purpose: a freshly created contract is mostly empty
// and the user fills it in. Errors block prompt generation; warnings only nudge.
export function validateContract(c: TaskContract): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!c.goal || !c.goal.summary || !c.goal.summary.trim()) {
    errors.push("goal.summary is required — say what this task should achieve.");
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

export function summarizeSelfTests(c: TaskContract): string {
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
