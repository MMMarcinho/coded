import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface, type Interface } from "node:readline/promises";
import { codedPaths, findCodedRoot, loopContractPath, loopDir } from "../paths.js";
import { loadConfig, newLoopId, saveLoop } from "../store.js";
import { saveContract } from "../contract.js";
import type { LoopContract, LoopMeta, RequirementSource, LoopPriority } from "../types.js";

export interface LoopOptions {
  workflow?: string;
  requirement?: string;
  source?: string;
  priority?: string;
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
    status: "drafting",
    workflow: opts.workflow ?? config.defaultWorkflow ?? "default",
    createdAt: now,
    updatedAt: now,
    history: [{ at: now, kind: "created", note: loopTitle }],
  };
  saveLoop(paths, meta);

  console.log(`Created loop ${id}`);
  console.log(`  requirement: ${meta.title}`);
  if (contract.requirement.source) console.log(`  source: ${contract.requirement.source}`);
  if (contract.requirement.priority) console.log(`  priority: ${contract.requirement.priority}`);
  console.log("");
  console.log("Ready — `coded prompt --stage analyze` will launch an agent for 需求分析.");
  console.log("Optional: edit the contract to add scope/self-tests:");
  console.log(`  ${cPath}`);
}

function buildLoopContract(title: string, opts: LoopOptions): LoopContract {
  return {
    requirement: {
      summary: opts.requirement ?? title,
      source: (opts.source as RequirementSource) ?? undefined,
      priority: (opts.priority as LoopPriority) ?? undefined,
      userVisibleResults: [],
      deliverables: [],
    },
    context: { reason: "", relatedFiles: [] },
    scope: { in: [], out: [] },
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
    const summary = await askRequired(rl, "需求是什么？");
    const source = await askChoice(rl, "需求来源", ["product", "tech_debt", "bug", "optimization", "other"]);
    const priority = await askChoice(rl, "优先级", ["p0", "p1", "p2", "p3"]);
    const detail = await ask(rl, "需求详细描述（可选）：");
    const reason = await ask(rl, "为什么要做这个需求？");
    const currentState = await ask(rl, "当前现状是什么？");

    console.log("范围 (scope in)：每输入一项回车创建一个，空回车结束。");
    const scopeIn = await collectList(rl, "要做");

    console.log("非目标 (scope out)：每输入一项回车创建一个，空回车结束。");
    const scopeOut = await collectList(rl, "不做");

    console.log("Checkpoints：每输入一项回车创建一个，空回车结束。");
    const checkpoints = await collectList(rl, "checkpoint");

    console.log("自测用例 (self-tests)：每输入一项回车创建一个，空回车结束。");
    const selfTests = await collectList(rl, "self-test");

    console.log("完成标准 (done criteria)：每输入一项回车创建一个，空回车结束。");
    const doneCriteria = await collectList(rl, "done");

    return {
      requirement: {
        summary,
        source: source as RequirementSource | undefined,
        priority: priority as LoopPriority | undefined,
        detail: detail || undefined,
        userVisibleResults: [],
        deliverables: [],
      },
      context: {
        reason,
        currentBehavior: currentState || null,
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

async function askChoice(rl: Interface, question: string, options: string[]): Promise<string> {
  const prompt = `${question} (${options.join("/")})：`;
  while (true) {
    const answer = await ask(rl, prompt);
    if (!answer) return "";
    if (options.includes(answer.toLowerCase())) return answer.toLowerCase();
    console.log(`  请输入: ${options.join(", ")}`);
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
