import { existsSync } from "node:fs";
import { codedPaths, findCodedRoot, loopContractPath } from "../paths.js";
import { listLoops, loadConfig } from "../store.js";
import { loadContract, validateContract } from "../contract.js";
import { emit } from "../output.js";

// `coded doctor` — sanity-check the state store itself: is .coded present,
// is the config readable, and do the loops' contracts parse and validate.
// (coded no longer launches agents, so there is nothing external to probe.)
export function cmdDoctor(): void {
  const root = findCodedRoot();
  const env = { node: process.version, platform: `${process.platform} ${process.arch}`, cwd: process.cwd() };

  if (!root) {
    emit({ ...env, coded: null, ready: false }, () => {
      console.log(`node      ${env.node}`);
      console.log(`platform  ${env.platform}`);
      console.log(`.coded    not found (run \`coded init\`)`);
    });
    return;
  }

  const paths = codedPaths(root);
  let configOk = false;
  try {
    loadConfig(paths);
    configOk = true;
  } catch {
    /* config unreadable */
  }

  const loops = listLoops(paths);
  const problems: { loop: string; error: string }[] = [];
  for (const l of loops) {
    const cPath = loopContractPath(paths, l.id);
    if (!existsSync(cPath)) {
      problems.push({ loop: l.id, error: "contract.yaml missing" });
      continue;
    }
    try {
      const { errors } = validateContract(loadContract(cPath));
      if (errors.length) problems.push({ loop: l.id, error: errors.join("; ") });
    } catch (e) {
      problems.push({ loop: l.id, error: (e as Error).message });
    }
  }

  emit(
    { ...env, coded: root, configOk, loops: loops.length, problems, ready: configOk && problems.length === 0 },
    () => {
      console.log(`node      ${env.node}`);
      console.log(`platform  ${env.platform}`);
      console.log(`.coded    found at ${root}`);
      console.log(`config    ${configOk ? "ok" : "unreadable"}`);
      console.log(`loops     ${loops.length}`);
      if (problems.length) {
        console.log("\nProblems:");
        for (const p of problems) console.log(`  ✗ ${p.loop}: ${p.error}`);
      } else {
        console.log("\nNo problems found.");
      }
    },
  );
}
