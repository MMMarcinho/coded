import { parse } from "yaml";
import type { SelfTest, TaskContract } from "./types.js";

// Build the confirmation prompt coded hands the agent: the goal/scope, the
// self-tests still needing judgement, the checkpoints, and a strict output
// schema coded can parse back. This is the "proactively wake the agent to
// confirm" step — the agent runs repro steps / inspects the diff and reports.
export function buildConfirmPrompt(contract: TaskContract, pending: SelfTest[]): string {
  const lines: string[] = [];
  lines.push("# coded — Confirm self-tests");
  lines.push("");
  lines.push("Coding for this task is done. Confirm the items below against the actual code/diff.");
  lines.push("Run repro steps or commands where you can; inspect the implementation otherwise.");
  lines.push("Do NOT change code in this step — only verify and report.");
  lines.push("");
  lines.push(`Goal: ${contract.goal?.summary ?? ""}`);
  if (contract.scope?.in?.length) lines.push(`Scope in: ${contract.scope.in.join("; ")}`);
  if (contract.scope?.out?.length) lines.push(`Scope out (must not change): ${contract.scope.out.join("; ")}`);
  lines.push("");

  lines.push("## Self-tests to confirm");
  for (const t of pending) {
    lines.push(`- id: ${t.id}`);
    lines.push(`  name: ${t.name}`);
    if (t.type) lines.push(`  type: ${t.type}`);
    if (t.steps?.length) lines.push(`  steps: ${t.steps.join(" | ")}`);
    if (t.expectedResults?.length) lines.push(`  expected: ${t.expectedResults.join(" | ")}`);
  }
  lines.push("");

  if (contract.checkpoints?.length) {
    lines.push("## Checkpoints to assess");
    for (const c of contract.checkpoints) {
      lines.push(`- id: ${c.id}  ${c.name ?? ""}${c.questions?.length ? `  Q: ${c.questions.join(" | ")}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Required output");
  lines.push("End your reply with exactly one fenced yaml block, nothing after it:");
  lines.push("");
  lines.push("```yaml");
  lines.push("results:");
  lines.push("  - id: st-1");
  lines.push("    status: passed | failed | skipped | inconclusive");
  lines.push("    evidence: one concrete line");
  lines.push("checkpoints:");
  lines.push("  - id: cp-1");
  lines.push("    status: passed | failed | skipped");
  lines.push("```");
  return lines.join("\n");
}

export interface ConfirmResult {
  id: string;
  status: string;
  evidence?: string;
}

export interface ParsedConfirm {
  results: ConfirmResult[];
  checkpoints: ConfirmResult[];
}

// Extract the last fenced ```yaml block from agent output and parse the
// results/checkpoints lists. Tolerant: returns empty lists if nothing parses.
export function parseAgentResults(text: string): ParsedConfirm {
  const empty: ParsedConfirm = { results: [], checkpoints: [] };
  const blocks = [...text.matchAll(/```ya?ml\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  const candidate = blocks.length ? blocks[blocks.length - 1] : text;
  let doc: unknown;
  try {
    doc = parse(candidate);
  } catch {
    return empty;
  }
  if (doc == null || typeof doc !== "object") return empty;
  const d = doc as Record<string, unknown>;
  return {
    results: normalize(d.results),
    checkpoints: normalize(d.checkpoints),
  };
}

function normalize(value: unknown): ConfirmResult[] {
  if (!Array.isArray(value)) return [];
  const out: ConfirmResult[] = [];
  for (const row of value) {
    if (row && typeof row === "object" && "id" in row) {
      const r = row as Record<string, unknown>;
      out.push({
        id: String(r.id),
        status: String(r.status ?? "inconclusive"),
        evidence: r.evidence != null ? String(r.evidence) : undefined,
      });
    }
  }
  return out;
}

// Map an agent-reported status onto a coded self-test status (or null to leave
// it unchanged, e.g. for "inconclusive").
export function toSelfTestStatus(s: string): SelfTest["status"] | null {
  switch (s.toLowerCase()) {
    case "passed":
    case "pass":
      return "passed";
    case "failed":
    case "fail":
      return "failed";
    case "skipped":
    case "skip":
      return "skipped";
    default:
      return null;
  }
}
