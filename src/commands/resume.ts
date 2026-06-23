import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { codedPaths, findCodedRoot, loopContractPath, loopDir } from "../paths.js";
import { loadLoop, resolveLoopId } from "../store.js";
import {
  blockingSelfTests,
  loadContract,
  nextStep,
  selfTestTally,
  stepTally,
} from "../contract.js";
import { emit } from "../output.js";
import { recentNotes } from "./note.js";
import type { LoopContract, LoopMeta } from "../types.js";

export interface ResumeView {
  id: string;
  title: string;
  status: string;
  workflow: string;
  requirement: string;
  scope: { in: string[]; out: string[] };
  steps: { tally: string; next: { id: string; text: string; status: string } | null; items: unknown[] };
  selfTests: { tally: string; blocking: { id: string; name: string; status: string }[] };
  recentNotes: { at: string; text: string }[];
  latestCheckpoint?: { file: string; drift: string; recommendation: string };
  completion?: { status: string; recommendation: string };
  suggestion: string;
}

// Pure synthesis of "where are we / what's next" — the heart of resuming a long
// task in a fresh session. Kept free of I/O so it can be unit-tested; the
// command reads checkpoint/completion files and hands them in.
export function buildResume(
  meta: LoopMeta,
  contract: LoopContract,
  extras: { latestCheckpoint?: ResumeView["latestCheckpoint"]; completion?: ResumeView["completion"] } = {},
): ResumeView {
  const next = nextStep(contract);
  const blocking = blockingSelfTests(contract).map((t) => ({
    id: t.id,
    name: t.name ?? "",
    status: t.status ?? "unknown",
  }));

  return {
    id: meta.id,
    title: meta.title,
    status: meta.status,
    workflow: meta.workflow,
    requirement: contract.requirement?.summary ?? "",
    scope: { in: contract.scope?.in ?? [], out: contract.scope?.out ?? [] },
    steps: {
      tally: stepTally(contract),
      next: next ? { id: next.id, text: next.text, status: next.status } : null,
      items: contract.steps ?? [],
    },
    selfTests: { tally: selfTestTally(contract), blocking },
    recentNotes: recentNotes(meta).map((e) => ({ at: e.at, text: e.note ?? "" })),
    latestCheckpoint: extras.latestCheckpoint,
    completion: extras.completion,
    suggestion: suggest(meta, contract, next, blocking.length),
  };
}

function suggest(
  meta: LoopMeta,
  contract: LoopContract,
  next: ReturnType<typeof nextStep>,
  blockingCount: number,
): string {
  if (meta.status === "done") return "Loop is done. Nothing to resume.";
  if (meta.status === "cancelled") return "Loop is cancelled.";
  if (next?.status === "blocked") {
    return `Unblock ${next.id}${next.note ? ` (${next.note})` : ""}, then continue the plan.`;
  }
  if (next) return `Work step ${next.id}: ${next.text}`;
  // No open steps left.
  if ((contract.steps ?? []).length === 0) {
    return 'Plan is empty — add steps with `coded step add "<text>"`.';
  }
  if (blockingCount > 0) return "Plan done — run `coded verify`, then confirm remaining self-tests.";
  return "Plan done and self-tests pass — close with `coded done`.";
}

export function cmdResume(taskRef: string | undefined): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const dir = loopDir(paths, loopId);
  const contract = loadContract(loopContractPath(paths, loopId));

  const view = buildResume(meta, contract, {
    latestCheckpoint: readLatestCheckpoint(dir),
    completion: readCompletion(dir),
  });

  emit(view, () => renderResume(view));
}

function readLatestCheckpoint(dir: string): ResumeView["latestCheckpoint"] {
  const cpDir = join(dir, "checkpoints");
  if (!existsSync(cpDir)) return undefined;
  const files = readdirSync(cpDir).filter((f) => f.endsWith(".yaml")).sort();
  if (!files.length) return undefined;
  const file = files[files.length - 1];
  const drift = (parse(readFileSync(join(cpDir, file), "utf8")) ?? {}).drift ?? {};
  return { file, drift: drift.status ?? "unknown", recommendation: drift.recommendation ?? "n/a" };
}

function readCompletion(dir: string): ResumeView["completion"] {
  const p = join(dir, "completion.yaml");
  if (!existsSync(p)) return undefined;
  const c = parse(readFileSync(p, "utf8")) ?? {};
  return { status: c.status ?? "unknown", recommendation: c.recommendation ?? "n/a" };
}

function renderResume(v: ResumeView): void {
  console.log(`Resume  ${v.id}`);
  console.log(`Title   ${v.title}`);
  console.log(`Status  ${v.status}   Workflow ${v.workflow}`);
  console.log(`\nRequirement  ${v.requirement || "(unset)"}`);
  if (v.scope.in.length) console.log(`Scope in     ${v.scope.in.join("; ")}`);
  if (v.scope.out.length) console.log(`Scope out    ${v.scope.out.join("; ")}`);

  console.log(`\nPlan (${v.steps.tally}):`);
  console.log(summarizeStepsView(v));
  if (v.steps.next) console.log(`\n→ Next: ${v.steps.next.id} ${v.steps.next.text}`);

  console.log(`\nSelf-tests (${v.selfTests.tally})`);
  for (const b of v.selfTests.blocking) console.log(`  ! ${b.id} ${b.name} (${b.status})`);

  if (v.latestCheckpoint) {
    console.log(`\nLatest checkpoint (${v.latestCheckpoint.file}): drift ${v.latestCheckpoint.drift} -> ${v.latestCheckpoint.recommendation}`);
  }
  if (v.completion) console.log(`Completion: ${v.completion.status} -> ${v.completion.recommendation}`);

  if (v.recentNotes.length) {
    console.log(`\nRecent notes:`);
    for (const n of v.recentNotes) console.log(`  · ${n.text}`);
  }

  console.log(`\nSuggested next: ${v.suggestion}`);
}

// Render steps from the view without re-loading the contract.
function summarizeStepsView(v: ResumeView): string {
  if (!v.steps.items.length) return "  (none — add with `coded step add \"<text>\"`)";
  const mark: Record<string, string> = { todo: " ", doing: "~", done: "x", blocked: "!" };
  return (v.steps.items as { id: string; text: string; status: string; note?: string }[])
    .map((s) => `  [${mark[s.status] ?? "?"}] ${s.id} ${s.text}${s.note ? `  — ${s.note}` : ""}`)
    .join("\n");
}
