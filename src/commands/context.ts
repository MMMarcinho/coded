import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { codedPaths, findCodedRoot, loopContractPath, loopDir } from "../paths.js";
import { appendEvent, loadConfig, loadLoop, resolveLoopId, setStatus } from "../store.js";
import { loadContract, validateContract } from "../contract.js";
import { buildContextPack } from "../contextPack.js";
import { emit } from "../output.js";
import type { StageKind } from "../types.js";

const STAGES: StageKind[] = [
  "explore",
  "plan",
  "implement",
  "verify",
  "review",
  "checkpoint",
  "complete",
];

export interface ContextOptions {
  stage?: string;
  message?: string;
  save?: boolean;
}

// `coded context [loop] [--stage]` — assemble the loop's state (requirement,
// scope, plan, self-tests, knowledge) into one block and PRINT it. coded never
// launches an agent: the running session reads this to (re)load its context.
export function cmdContext(taskRef: string | undefined, opts: ContextOptions): void {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);

  const stage = (opts.stage ?? "implement") as StageKind;
  if (!STAGES.includes(stage)) {
    throw new Error(`Unknown stage '${opts.stage}'. One of: ${STAGES.join(", ")}`);
  }

  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  const contract = loadContract(loopContractPath(paths, loopId));

  const { errors, warnings } = validateContract(contract);
  if (errors.length) {
    console.error("Contract is not ready:");
    for (const e of errors) console.error(`  ✗ ${e}`);
    console.error(`Edit ${loopContractPath(paths, loopId)} and retry.`);
    process.exitCode = 1;
    return;
  }
  for (const w of warnings) console.error(`  ! ${w}`);

  const pack = buildContextPack({ paths, config, meta, contract, stage, userInstruction: opts.message });

  // Optionally persist the assembled context as a record of what the session
  // was working from. Off by default — context is usually just piped/pasted.
  let packPath: string | undefined;
  if (opts.save) {
    const packsDir = join(loopDir(paths, loopId), "packs");
    mkdirSync(packsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    packPath = join(packsDir, `${stage}-${stamp}.md`);
    writeFileSync(packPath, pack.content);
  }

  appendEvent(paths, meta, { kind: "context", stage, note: opts.save ? `saved ${packPath}` : "printed" });
  if (meta.status === "created") setStatus(paths, meta, "in_progress");

  emit(
    {
      loop: loopId,
      stage,
      charCount: pack.charCount,
      tokenEstimate: pack.tokenEstimate,
      savedTo: packPath,
      content: pack.content,
    },
    () => {
      console.error(
        `# coded context — ${loopId} / ${stage} — ${pack.charCount} chars (~${pack.tokenEstimate} tokens)` +
          (packPath ? ` -> ${packPath}` : ""),
      );
      console.log(pack.content);
    },
  );
}
