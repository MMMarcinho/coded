import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { codedPaths, findCodedRoot, loopContractPath, loopDir } from "../paths.js";
import { loadConfig, newLoopId, saveLoop } from "../store.js";
import { saveContract } from "../contract.js";
import type { LoopContract, LoopMeta } from "../types.js";

export interface LoopOptions {
  workflow?: string;
  requirement?: string;
}

export async function cmdLoop(title: string | undefined, opts: LoopOptions): Promise<void> {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);
  const contract = title ? buildLoopContract(title, opts) : await promptForLoop();
  const loopTitle = title ?? contract.requirement.summary;

  const id = newLoopId(loopTitle);
  const dir = loopDir(paths, id);
  mkdirSync(join(dir, "checkpoints"), { recursive: true });

  const cPath = loopContractPath(paths, id);
  saveContract(
    cPath,
    contract,
    "coded loop contract. Only requirement.summary is required.\nFull shape & examples: .coded/templates/contract.yaml",
  );

  const now = new Date().toISOString();
  const meta: LoopMeta = {
    id,
    title: loopTitle,
    status: "created",
    workflow: opts.workflow ?? config.defaultWorkflow ?? "default",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, kind: "created", note: loopTitle }],
  };
  saveLoop(paths, meta);

  console.log(`Created loop ${id}`);
  console.log(`  requirement: ${meta.title}`);
  console.log("");
  console.log("Next:");
  console.log('  coded step add "<first step>"   # sketch the plan');
  console.log("  coded context                   # load it into your session");
  console.log("  coded resume                    # see where things stand");
  console.log(`Edit the contract to add scope/self-tests: ${cPath}`);
}

function buildLoopContract(title: string, opts: LoopOptions): LoopContract {
  return {
    requirement: { summary: opts.requirement ?? title, userVisibleResults: [], deliverables: [] },
    context: { reason: "", relatedFiles: [] },
    scope: { in: [], out: [] },
    steps: [],
    checkpoints: [],
    selfTests: [],
    doneCriteria: { required: [], optional: [], requiresUserConfirmation: [] },
  };
}

async function promptForLoop(): Promise<LoopContract> {
  if (!input.isTTY) {
    throw new Error("Loop title is required in non-interactive mode.");
  }

  const rl = createInterface({ input, output });
  try {
    const summary = await askRequired(rl, "What should this loop achieve?");
    const reason = await ask(rl, "Why is this needed?");
    const currentBehavior = await ask(rl, "What is the current state?");

    console.log("Scope in — one per line, empty to finish:");
    const scopeIn = await collectList(rl, "in");

    console.log("Scope out — one per line, empty to finish:");
    const scopeOut = await collectList(rl, "out");

    console.log("Plan steps — one per line, empty to finish:");
    const steps = await collectList(rl, "step");

    console.log("Checkpoints — one per line, empty to finish:");
    const checkpoints = await collectList(rl, "checkpoint");

    console.log("Self-tests — one per line, empty to finish:");
    const selfTests = await collectList(rl, "self-test");

    console.log("Done criteria — one per line, empty to finish:");
    const doneCriteria = await collectList(rl, "done");

    return {
      requirement: { summary, userVisibleResults: [], deliverables: [] },
      context: {
        reason,
        currentBehavior: currentBehavior || null,
        relatedFiles: [],
      },
      scope: { in: scopeIn, out: scopeOut },
      steps: steps.map((text, index) => ({
        id: `s-${index + 1}`,
        text,
        status: "todo" as const,
      })),
      checkpoints: checkpoints.map((name, index) => ({
        id: `cp-${index + 1}`,
        type: "custom",
        name,
        status: "pending",
      })),
      selfTests: selfTests.map((name, index) => ({
        id: `st-${index + 1}`,
        name,
        type: "manual",
        required: true,
        status: "unknown",
      })),
      doneCriteria: {
        required: doneCriteria,
        optional: [],
        requiresUserConfirmation: [],
      },
    };
  } finally {
    rl.close();
  }
}

async function ask(rl: Interface, question: string): Promise<string> {
  return (await rl.question(`${question} `)).trim();
}

async function askRequired(rl: Interface, question: string): Promise<string> {
  while (true) {
    const answer = await ask(rl, question);
    if (answer) return answer;
  }
}

async function collectList(rl: Interface, label: string): Promise<string[]> {
  const items: string[] = [];
  while (true) {
    const answer = await ask(rl, `${label} ${items.length + 1}:`);
    if (!answer) return items;
    items.push(answer);
  }
}
