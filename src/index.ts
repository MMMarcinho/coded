#!/usr/bin/env node
import { Command } from "commander";
import { cmdStart } from "./commands/start.js";
import { cmdStepAdd, cmdStepStatus } from "./commands/step.js";
import { cmdResume } from "./commands/resume.js";
import { cmdList } from "./commands/list.js";
import { cmdDone } from "./commands/done.js";
import { setJsonMode } from "./output.js";

const program = new Command();

program
  .name("coded")
  .description("外置的长程任务状态管理工具 — 定义长任务，跟踪计划，换会话能接着跑。")
  .version("0.4.0")
  // Global --json so any command can be machine-read by a running agent.
  .option("--json", "emit machine-readable JSON instead of human text")
  .hook("preAction", (_thisCmd, actionCmd) => setJsonMode(Boolean(actionCmd.optsWithGlobals().json)));

program
  .command("start")
  .argument("<requirement>", "一句话需求 — what this long task is")
  .description("Define a new long-running task (creates the .coded store on first use).")
  .action((requirement) => run(() => cmdStart(requirement)));

const step = program.command("step").description("Manage a task's plan (steps).");

step
  .command("add")
  .argument("<text>", "what the step does")
  .option("-t, --task <id>", "task id (default: most recent)")
  .description("Append a step to the plan.")
  .action((text, opts) => run(() => cmdStepAdd(opts.task, text)));

step
  .command("start")
  .argument("<id>", "step id, e.g. s-1")
  .argument("[note]", "optional note")
  .option("-t, --task <id>", "task id (default: most recent)")
  .description("Mark a step in progress.")
  .action((id, note, opts) => run(() => cmdStepStatus("start", opts.task, id, note)));

step
  .command("done")
  .argument("<id>", "step id")
  .argument("[note]", "optional result note")
  .option("-t, --task <id>", "task id (default: most recent)")
  .description("Mark a step done.")
  .action((id, note, opts) => run(() => cmdStepStatus("done", opts.task, id, note)));

step
  .command("block")
  .argument("<id>", "step id")
  .argument("[note]", "why it is blocked")
  .option("-t, --task <id>", "task id (default: most recent)")
  .description("Mark a step blocked.")
  .action((id, note, opts) => run(() => cmdStepStatus("block", opts.task, id, note)));

program
  .command("resume")
  .argument("[task]", "task id (default: most recent)")
  .description("Show where the task stands: requirement, plan, next step.")
  .action((task) => run(() => cmdResume(task)));

program
  .command("list")
  .option("--status <status>", "filter by status (active|done)")
  .description("List all tasks.")
  .action((opts) => run(() => cmdList(opts)));

program
  .command("done")
  .argument("[task]", "task id (default: most recent)")
  .description("Mark a task done.")
  .action((task) => run(() => cmdDone(task)));

program.parseAsync(process.argv);

async function run(fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`coded: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
