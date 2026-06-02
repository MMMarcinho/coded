import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { codedPaths, contractPath, findCodedRoot, taskDir } from "../paths.js";
import { loadConfig, newTaskId, saveMeta } from "../store.js";
import { saveContract } from "../contract.js";
import type { TaskContract, TaskMeta } from "../types.js";

export interface NewOptions {
  workflow?: string;
  goal?: string;
}

export async function cmdNew(title: string | undefined, opts: NewOptions): Promise<void> {
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const config = loadConfig(paths);
  const contract = title ? buildContract(title, opts) : await promptForContract();
  const taskTitle = title ?? contract.goal.summary;

  const id = newTaskId(taskTitle);
  const dir = taskDir(paths, id);
  mkdirSync(join(dir, "checkpoints"), { recursive: true });

  // Seed a clean, minimal contract: goal pre-filled from the title (or --goal),
  // everything else empty so the task is runnable with zero editing and CLI
  // edits (`coded selftest add`) produce clean ids. The verbose, commented
  // reference lives at .coded/templates/contract.yaml.
  const cPath = contractPath(paths, id);
  saveContract(
    cPath,
    contract,
    "coded task contract. Only goal is required.\nFull shape & examples: .coded/templates/contract.yaml",
  );

  const now = new Date().toISOString();
  const meta: TaskMeta = {
    id,
    title: taskTitle,
    status: "created",
    workflow: opts.workflow ?? config.defaultWorkflow ?? "default",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, kind: "created", note: taskTitle }],
  };
  saveMeta(paths, meta);

  console.log(`Created task ${id}`);
  console.log(`  goal: ${meta.title}`);
  console.log("");
  console.log("Ready to go — `coded prompt --stage implement` will launch an agent.");
  console.log("Optional: edit the contract to add scope/self-tests:");
  console.log(`  ${cPath}`);
}

function buildContract(title: string, opts: NewOptions): TaskContract {
  return {
    goal: { summary: opts.goal ?? title, userVisibleResults: [], deliverables: [] },
    context: { reason: "", relatedFiles: [] },
    scope: { in: [], out: [] },
    checkpoints: [],
    selfTests: [],
    doneCriteria: { required: [], optional: [], requiresUserConfirmation: [] },
  };
}

async function promptForContract(): Promise<TaskContract> {
  if (!input.isTTY) {
    throw new Error("Task title is required in non-interactive mode.");
  }

  const rl = createInterface({ input, output });
  try {
    const summary = await askRequired(rl, "你要创建什么任务？");
    const reason = await ask(rl, "为什么要做这个任务？");
    const currentBehavior = await ask(rl, "当前现象是什么？");

    console.log("Scope in：每输入一项回车创建一个，空回车结束。");
    const scopeIn = await collectList(rl, "要做");

    console.log("Scope out：每输入一项回车创建一个，空回车结束。");
    const scopeOut = await collectList(rl, "不做");

    console.log("Checkpoints：每输入一项回车创建一个，空回车结束。");
    const checkpoints = await collectList(rl, "checkpoint");

    console.log("Self-tests：每输入一项回车创建一个，空回车结束。");
    const selfTests = await collectList(rl, "self-test");

    console.log("Done criteria：每输入一项回车创建一个，空回车结束。");
    const doneCriteria = await collectList(rl, "done");

    return {
      goal: { summary, userVisibleResults: [], deliverables: [] },
      context: {
        reason,
        currentBehavior: currentBehavior || null,
        relatedFiles: [],
      },
      scope: { in: scopeIn, out: scopeOut },
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
