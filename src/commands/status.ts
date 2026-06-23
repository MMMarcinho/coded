import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { codedPaths, findCodedRoot, loopDir } from "../paths.js";
import { loadLoop, resolveLoopId } from "../store.js";
import {
  loadContract,
  selfTestTally,
  stepTally,
  summarizeSelfTests,
  summarizeSteps,
} from "../contract.js";
import { emit } from "../output.js";
import { recentNotes } from "./note.js";

export function cmdStatus(taskRef?: string): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const dir = loopDir(paths, loopId);
  const cPath = join(dir, "contract.yaml");
  const contract = existsSync(cPath) ? loadContract(cPath) : null;

  const latestCheckpoint = readLatestCheckpoint(dir);
  const completion = readCompletion(dir);
  const notes = recentNotes(meta).map((e) => ({ at: e.at, text: e.note ?? "" }));

  emit(
    {
      id: meta.id,
      title: meta.title,
      status: meta.status,
      workflow: meta.workflow,
      requirement: contract?.requirement?.summary ?? null,
      scope: { in: contract?.scope?.in ?? [], out: contract?.scope?.out ?? [] },
      steps: contract ? { tally: stepTally(contract), items: contract.steps ?? [] } : null,
      selfTests: contract ? { tally: selfTestTally(contract), items: contract.selfTests ?? [] } : null,
      latestCheckpoint,
      completion,
      recentNotes: notes,
      events: meta.history.length,
    },
    () => {
      console.log(`Loop    ${meta.id}`);
      console.log(`Title   ${meta.title}`);
      console.log(`Status  ${meta.status}   Workflow ${meta.workflow}`);

      if (contract) {
        console.log(`\nRequirement  ${contract.requirement?.summary ?? "(unset)"}`);
        const inScope = contract.scope?.in ?? [];
        const outScope = contract.scope?.out ?? [];
        if (inScope.length) console.log(`Scope in     ${inScope.join("; ")}`);
        if (outScope.length) console.log(`Scope out    ${outScope.join("; ")}`);
        console.log(`\nPlan (${stepTally(contract)}):\n${summarizeSteps(contract)}`);
        console.log(`\nSelf-tests (${selfTestTally(contract)}):\n${summarizeSelfTests(contract)}`);
      }

      if (latestCheckpoint) {
        console.log(`\nLatest checkpoint (${latestCheckpoint.file}):`);
        console.log(`  drift: ${latestCheckpoint.drift} -> ${latestCheckpoint.recommendation}`);
      }
      if (completion) console.log(`\nCompletion: ${completion.status} -> ${completion.recommendation}`);
      if (notes.length) {
        console.log(`\nRecent notes:`);
        for (const n of notes) console.log(`  · ${n.text}`);
      }

      console.log(`\nHistory: ${meta.history.length} events. Files under ${dir}`);
    },
  );
}

function readLatestCheckpoint(dir: string) {
  const cpDir = join(dir, "checkpoints");
  if (!existsSync(cpDir)) return undefined;
  const files = readdirSync(cpDir).filter((f) => f.endsWith(".yaml")).sort();
  if (!files.length) return undefined;
  const file = files[files.length - 1];
  const drift = (parse(readFileSync(join(cpDir, file), "utf8")) ?? {}).drift ?? {};
  return { file, drift: drift.status ?? "unknown", recommendation: drift.recommendation ?? "n/a" };
}

function readCompletion(dir: string) {
  const p = join(dir, "completion.yaml");
  if (!existsSync(p)) return undefined;
  const c = parse(readFileSync(p, "utf8")) ?? {};
  return { status: c.status ?? "unknown", recommendation: c.recommendation ?? "n/a" };
}
