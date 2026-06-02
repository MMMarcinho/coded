import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { codedPaths, findCodedRoot, taskDir } from "../paths.js";
import { loadMeta, resolveTaskId } from "../store.js";
import { loadContract, selfTestTally, summarizeSelfTests } from "../contract.js";

export function cmdStatus(taskRef?: string): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const taskId = resolveTaskId(paths, taskRef);
  const meta = loadMeta(paths, taskId);
  const dir = taskDir(paths, taskId);

  console.log(`Task   ${meta.id}`);
  console.log(`Title  ${meta.title}`);
  console.log(`Status ${meta.status}   Workflow ${meta.workflow}`);

  const contractPath = join(dir, "contract.yaml");
  if (existsSync(contractPath)) {
    const contract = loadContract(contractPath);
    console.log(`\nGoal   ${contract.goal?.summary ?? "(unset)"}`);
    const inScope = contract.scope?.in ?? [];
    const outScope = contract.scope?.out ?? [];
    if (inScope.length) console.log(`Scope  in: ${inScope.join("; ")}`);
    if (outScope.length) console.log(`       out: ${outScope.join("; ")}`);
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
