import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { codedPaths, findCodedRoot, taskDir } from "../paths.js";
import { appendEvent, loadConfig, loadMeta, resolveTaskId, setStatus } from "../store.js";
import { loadContract, validateContract } from "../contract.js";
import { buildContextPack } from "../contextPack.js";
import { launchAgent, resolveAgent } from "../launch.js";
import type { StageKind } from "../types.js";

const STAGES: StageKind[] = [
  "explore",
  "plan",
  "implement",
  "verify",
  "review",
  "fix",
  "checkpoint",
  "complete",
];

export interface PromptOptions {
  stage: string;
  agent?: string;
  print?: boolean;
  message?: string;
}

export function cmdPrompt(taskRef: string | undefined, opts: PromptOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);

  const stage = opts.stage as StageKind;
  if (!STAGES.includes(stage)) {
    throw new Error(`Unknown stage '${opts.stage}'. One of: ${STAGES.join(", ")}`);
  }

  const taskId = resolveTaskId(paths, taskRef);
  const meta = loadMeta(paths, taskId);
  const contract = loadContract(join(taskDir(paths, taskId), "contract.yaml"));

  const { errors, warnings } = validateContract(contract);
  if (errors.length) {
    console.error("Contract is not ready:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(`Edit ${join(taskDir(paths, taskId), "contract.yaml")} and retry.`);
    process.exitCode = 1;
    return;
  }
  for (const w of warnings) console.error(`  ! ${w}`);

  const pack = buildContextPack({ paths, config, meta, contract, stage, userInstruction: opts.message });

  // Always persist the generated pack as evidence of what the agent was given.
  const packsDir = join(taskDir(paths, taskId), "packs");
  mkdirSync(packsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const packPath = join(packsDir, `${stage}-${stamp}.md`);
  writeFileSync(packPath, pack.content);

  const agent = resolveAgent(opts.agent ?? config.defaultAgents?.[stage]);
  console.error(`Context pack: ${pack.charCount} chars (~${pack.tokenEstimate} tokens) -> ${packPath}`);

  const result = opts.print
    ? { launched: false, binary: agent === "codex" ? "codex" : "claude", available: false, exitCode: null }
    : launchAgent(agent, pack.content);

  if (result.launched) {
    appendEvent(paths, meta, { kind: "prompt", stage, agent, note: `launched ${result.binary}` });
    if (meta.status === "created") setStatus(paths, meta, "in_progress");
    return;
  }

  // Fallback: print the pack and the equivalent command.
  if (!opts.print && !result.available) {
    console.error(`Agent '${result.binary}' not found on PATH — printing prompt instead.`);
  }
  console.log("\n" + pack.content);
  console.log(`# Copy the prompt above into ${result.binary}, or run:`);
  console.log(`#   ${result.binary} "$(cat ${packPath})"`);
  appendEvent(paths, meta, { kind: "prompt", stage, agent, note: `printed (${result.binary})` });
  if (meta.status === "created") setStatus(paths, meta, "in_progress");
}
