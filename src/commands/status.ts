import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { codedPaths, findCodedRoot, loopDir } from "../paths.js";
import { loadLoop, resolveLoopId } from "../store.js";
import { loadContract, selfTestTally, summarizeSelfTests } from "../contract.js";

export function cmdStatus(taskRef?: string): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const dir = loopDir(paths, loopId);

  console.log(`Loop    ${meta.id}`);
  console.log(`Title   ${meta.title}`);
  console.log(`Status  ${meta.status}   Workflow ${meta.workflow}`);

  const cPath = join(dir, "contract.yaml");
  if (existsSync(cPath)) {
    const contract = loadContract(cPath);
    const req = contract.requirement;
    console.log(`\nRequirement  ${req?.summary ?? "(unset)"}`);
    if (req?.source) console.log(`Source       ${req.source}`);
    if (req?.priority) console.log(`Priority     ${req.priority}`);
    if (req?.detail) console.log(`Detail       ${req.detail}`);
    const inScope = contract.scope?.in ?? [];
    const outScope = contract.scope?.out ?? [];
    if (inScope.length) console.log(`Scope in     ${inScope.join("; ")}`);
    if (outScope.length) console.log(`Scope out    ${outScope.join("; ")}`);
    console.log(`\nSelf-tests (${selfTestTally(contract)}):\n${summarizeSelfTests(contract)}`);
  }

  // Latest checkpoint + drift.
  const cpDir = join(dir, "checkpoints");
  if (existsSync(cpDir)) {
    const files = readdirSync(cpDir)
      .filter((f) => f.endsWith(".yaml"))
      .sort();
    if (files.length) {
      const latest = parse(readFileSync(join(cpDir, files[files.length - 1]), "utf8")) ?? {};
      const drift = latest.drift ?? {};
      console.log(`\nLatest checkpoint (${files[files.length - 1]}):`);
      console.log(`  drift: ${drift.status ?? "unknown"} -> ${drift.recommendation ?? "n/a"}`);
    }
  }

  const completion = join(dir, "completion.yaml");
  if (existsSync(completion)) {
    const c = parse(readFileSync(completion, "utf8")) ?? {};
    console.log(`\nCompletion: ${c.status ?? "unknown"} -> ${c.recommendation ?? "n/a"}`);
  }

  console.log(`\nHistory: ${meta.history.length} events. Files under ${dir}`);
}
