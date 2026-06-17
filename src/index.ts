#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdLoop } from "./commands/loop.js";
import { cmdPrompt } from "./commands/prompt.js";
import { cmdStatus } from "./commands/status.js";
import { cmdList } from "./commands/list.js";
import { cmdCheckpoint, cmdComplete, ensureExists } from "./commands/record.js";
import { cmdSelfTestAdd, cmdSelfTestStatus } from "./commands/selftest.js";
import { cmdDone } from "./commands/done.js";
import { cmdVerify } from "./commands/verify.js";
import { cmdDoctor } from "./commands/doctor.js";

const program = new Command();

program
  .name("coded")
  .description("Loop 工程管理工具 — 记录需求研发的全流程。")
  .version("0.2.0");

program
  .command("init")
  .description("Create .coded/ in the current repository with default assets.")
  .action(() => run(() => cmdInit()));

program
  .command("doctor")
  .description("Check node, .coded, and whether claude-code / codex are installed and runnable.")
  .action(() => run(() => cmdDoctor()));

program
  .command("loop")
  .alias("new")
  .argument("[title]", "需求标题 (also used as the requirement summary); omit for interactive wizard")
  .option("-w, --workflow <name>", "workflow to attach")
  .option("-r, --requirement <text>", "requirement summary (defaults to the title)")
  .option("--source <source>", "product|tech_debt|bug|optimization|other")
  .option("--priority <priority>", "p0|p1|p2|p3")
  .description("Create a new loop (需求研发循环).")
  .action((title, opts) => run(() => cmdLoop(title, opts)));

program
  .command("prompt")
  .alias("run")
  .argument("[loop]", "loop id (default: most recent)")
  .requiredOption("-s, --stage <stage>", "stage: explore|plan|implement|verify|review|checkpoint|complete")
  .option("-a, --agent <agent>", "claude-code | codex")
  .option("-m, --message <text>", "extra instruction for this session")
  .option("--print", "print the prompt instead of launching an agent")
  .description("Build the context pack for a stage and launch the agent (or print it).")
  .action((task, opts) => run(() => cmdPrompt(task, opts)));

program
  .command("status")
  .argument("[loop]", "loop id (default: most recent)")
  .description("Show a loop's requirement, lifecycle status, self-tests, and latest checkpoint.")
  .action((task) => run(() => cmdStatus(task)));

program
  .command("list")
  .option("--status <status>", "filter by lifecycle status")
  .description("List all loops.")
  .action((opts) => run(() => cmdList(opts)));

program
  .command("checkpoint")
  .argument("[loop]", "loop id (default: most recent)")
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
  .argument("[loop]", "loop id (default: most recent)")
  .option("-a, --agent <agent>", "claude-code | codex")
  .option("--print", "print the prompt instead of launching an agent")
  .option("--record <file>", "store a completion analysis (completion.yaml)")
  .description("Generate a completion-analysis prompt, or record one with --record.")
  .action((task, opts) => run(() => {
    ensureExists(opts.record);
    cmdComplete(task, opts);
  }));

const selftest = program
  .command("selftest")
  .description("Update or add self-tests on a task's contract.");

selftest
  .command("pass")
  .argument("<id>", "self-test id, e.g. st-1")
  .argument("[evidence]", "evidence note")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Mark a self-test passed (writes back to the contract).")
  .action((id, evidence, opts) => run(() => cmdSelfTestStatus("pass", opts.task, id, evidence)));

selftest
  .command("fail")
  .argument("<id>", "self-test id")
  .argument("[evidence]", "evidence note")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Mark a self-test failed.")
  .action((id, evidence, opts) => run(() => cmdSelfTestStatus("fail", opts.task, id, evidence)));

selftest
  .command("skip")
  .argument("<id>", "self-test id")
  .argument("[reason]", "why it is skipped")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Mark a self-test skipped.")
  .action((id, reason, opts) => run(() => cmdSelfTestStatus("skip", opts.task, id, reason)));

selftest
  .command("add")
  .argument("<name>", "self-test name")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .option("--type <type>", "manual|unit|integration|e2e|command|screenshot")
  .option("--cmd <command>", "command that verifies it")
  .option("--optional", "mark as not required")
  .description("Add a self-test from the CLI instead of editing yaml.")
  .action((name, opts) =>
    run(() => cmdSelfTestAdd(opts.task, name, { type: opts.type, required: !opts.optional, cmd: opts.cmd })),
  );

program
  .command("verify")
  .argument("[loop]", "loop id (default: most recent)")
  .option("-a, --agent <agent>", "claude-code | codex")
  .option("--interactive", "launch the agent interactively instead of headless")
  .option("--print", "print the confirm prompt instead of waking an agent")
  .description("Confirm self-tests/checkpoints: run commands, then wake the agent for the rest.")
  .action((task, opts) => run(() => cmdVerify(task, opts)));

program
  .command("done")
  .argument("[loop]", "loop id (default: most recent)")
  .option("--force", "close even if required self-tests are pending")
  .description("Mark a loop done once required self-tests pass.")
  .action((task, opts) => run(() => cmdDone(task, opts)));

program.parseAsync(process.argv);

async function run(fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`coded: ${(err as Error).message}`);
    process.exitCode = 1;
  }
}
