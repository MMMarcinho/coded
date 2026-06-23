import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { CodedConfig, LoopContract, LoopMeta, StageKind } from "./types.js";
import type { CodedPaths } from "./paths.js";
import { nextStep, stepTally, summarizeSteps } from "./contract.js";

function readIfExists(path: string): string | null {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function loadStagePrompt(paths: CodedPaths, stage: StageKind): string {
  const p = join(paths.promptsDir, `${stage}.md`);
  const body = readIfExists(p);
  if (body) return body.trim();
  return `# ${stage} Stage\n\nNo prompt template found at ${p}. Act as the ${stage} agent for this task.`;
}

function loadKnowledge(paths: CodedPaths, max: number): string[] {
  if (!existsSync(paths.knowledgeDir)) return [];
  return readdirSync(paths.knowledgeDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .slice(0, max)
    .map((f) => `### ${f}\n\n${readFileSync(join(paths.knowledgeDir, f), "utf8").trim()}`);
}

function section(title: string, body: string | null | undefined): string {
  if (!body || !body.trim()) return "";
  return `## ${title}\n${body.trim()}\n\n`;
}

function contractYaml(contract: LoopContract): string {
  // Show the contract compactly: requirement, scope, steps, self-tests, done.
  const view: Record<string, unknown> = { requirement: contract.requirement };
  if (contract.context) view.context = contract.context;
  if (contract.scope) view.scope = contract.scope;
  if (contract.steps?.length) view.steps = contract.steps;
  if (contract.checkpoints?.length) view.checkpoints = contract.checkpoints;
  if (contract.selfTests?.length) view.selfTests = contract.selfTests;
  if (contract.doneCriteria) view.doneCriteria = contract.doneCriteria;
  return stringify(view).trim();
}

export interface PackInput {
  paths: CodedPaths;
  config: CodedConfig;
  meta: LoopMeta;
  contract: LoopContract;
  stage: StageKind;
  userInstruction?: string;
}

export interface BuiltPack {
  content: string;
  charCount: number;
  tokenEstimate: number;
}

export function buildContextPack(input: PackInput): BuiltPack {
  const { paths, config, meta, contract, stage } = input;
  const max = config.context?.maxKnowledgeFiles ?? 6;
  const knowledge = loadKnowledge(paths, max);

  let out = "";
  out += `# coded Context Pack\n\n`;
  out += section(
    "Loop",
    [
      `- Title: ${meta.title}`,
      `- Id: ${meta.id}`,
      `- Status: ${meta.status}`,
      `- Stage: ${stage}`,
    ].join("\n"),
  );
  const next = nextStep(contract);
  out += section(
    "Working Plan",
    [
      `Steps: ${stepTally(contract)}`,
      next ? `Next step: ${next.id} ${next.text}` : "Next step: (none — plan is empty or complete)",
      "",
      summarizeSteps(contract),
    ].join("\n"),
  );
  out += section("Loop Contract", "```yaml\n" + contractYaml(contract) + "\n```");
  if (knowledge.length) out += section("Relevant Project Knowledge", knowledge.join("\n\n"));
  out += section("Stage Instructions", loadStagePrompt(paths, stage));
  out += section(
    "Rules For This Session",
    [
      "- Stay within scope.in; do not touch scope.out without flagging it.",
      "- Work the plan: pick up `Next step`, and keep step status current with `coded step`.",
      "- Treat selfTests as the definition of correct; run or describe them.",
      "- coded only stores state — it does not prescribe how you implement.",
      "- Record decisions worth keeping with `coded note` so the next session sees them.",
    ].join("\n"),
  );
  out += section("User's New Instruction", input.userInstruction ?? "(none — follow the stage)");

  const content = out.trimEnd() + "\n";
  const charCount = content.length;
  return { content, charCount, tokenEstimate: Math.round(charCount / 4) };
}
