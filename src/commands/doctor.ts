import { codedPaths, findCodedRoot } from "../paths.js";
import { loadConfig } from "../store.js";
import { probeAgent } from "../launch.js";
import type { Agent } from "../types.js";

const AGENTS: Agent[] = ["claude-code", "codex"];

// `coded doctor` — diagnose the environment so agent invocation problems are
// visible before a task, not after a hung verify.
export function cmdDoctor(): void {
  console.log(`node      ${process.version}`);
  console.log(`platform  ${process.platform} ${process.arch}`);
  console.log(`cwd       ${process.cwd()}`);

  const root = findCodedRoot();
  console.log(`.coded    ${root ? `found at ${root}` : "not found (run `coded init`)"}`);

  let config;
  if (root) {
    try {
      config = loadConfig(codedPaths(root));
    } catch {
      /* config unreadable; skip */
    }
  }

  console.log("\nAgents:");
  for (const agent of AGENTS) {
    const p = probeAgent(agent);
    if (!p.available) {
      console.log(`  ✗ ${agent.padEnd(11)} not installed (${p.binary} not on PATH)`);
    } else if (p.ok) {
      console.log(`  ✓ ${agent.padEnd(11)} ${p.version ?? "ok"}  [${p.path}]`);
    } else {
      console.log(`  ! ${agent.padEnd(11)} found but not runnable: ${p.error}  [${p.path}]`);
    }
  }

  if (config?.defaultAgents) {
    console.log("\nConfigured default agents:");
    for (const [stage, agent] of Object.entries(config.defaultAgents)) {
      console.log(`  ${stage.padEnd(11)} ${agent}`);
    }
  }
}
