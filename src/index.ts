#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdNew } from "./commands/new.js";
import { cmdPrompt } from "./commands/prompt.js";
import { cmdStatus } from "./commands/status.js";
import { cmdList } from "./commands/list.js";
import { cmdCheckpoint, cmdComplete, ensureExists } from "./commands/record.js";

const program = new Command();

program
  .name("coded")
  .description("Task contract, checkpoint, and completion layer for Claude Code / Codex.")
  .version("0.1.0");

program
  .command("init")
  .description("Create .coded/ in the current repository with default assets.")
  .action(() => run(() => cmdInit()));

program
  .command("new")
  .argument("<title>", "task title")
  .option("-w, --workflow <name>", "workflow to attach")
  .description("Create a new task with a contract to fill in.")
  .action((title, opts) => run(() => cmdNew(title, opts)));

program
  .command("prompt")
  .alias("run")
  .argument("[task]", "task id (default: most recent)")
  .requiredOption("-s, --stage <stage>", "stage: implement|verify|review|checkpoint|complete|explore|plan|fix")
  .option("-a, --agent <agent>", "claude-code | codex")
  .option("-m, --message <text>", "extra instruction for this session")
  .option("--print", "print the prompt instead of launching an agent")
  .description("Build the context pack for a stage and launch the agent (or print it).")
  .action((task, opts) => run(() => cmdPrompt(task, opts)));

program
  .command("status")
  .argument("[task]", "task id (default: most recent)")
  .description("Show a task's contract, self-test status, and latest checkpoint.")
  .action((task) => run(() => cmdStatus(task)));

program
  .command("list")
  .option("--status <status>", "filter by status")
  .description("List tasks.")
  .action((opts) => run(() => cmdList(opts)));

program
  .command("checkpoint")
  .argument("[task]", "task id (default: most recent)")
  .option("-a, --agent <agent>", "claude-code | codex")
  .option("--print", "print the prompt instead of launching an agent")
  .option("--record <file>", "store an agent's checkpoint output as the next snapshot")
  .description("Generate a checkpoint prompt, or record a checkpoint with --record.")
  .action((task, opts) => run(() => {
    ensureExists(opts.record);
    cmdCheckpoint(task, opts);
  }));

program
  .command("complete")
  .argument("[task]", "task id (default: most recent)")
  .option("-a, --agent <agent>", "claude-code | codex")
  .option("--print", "print the prompt instead of launching an agent")
  .option("--record <file>", "store a completion analysis (completion.yaml)")
  .description("Generate a completion-analysis prompt, or record one with --record.")
  .action((task, opts) => run(() => {
    ensureExists(opts.record);
    cmdComplete(task, opts);
  }));

program.parseAsync(process.argv);

function run(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.error(`coded: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
