#!/usr/bin/env node
import { Command } from "commander";
import { cmdInit } from "./commands/init.js";
import { cmdLoop } from "./commands/loop.js";
import { cmdContext } from "./commands/context.js";
import { cmdResume } from "./commands/resume.js";
import { cmdStatus } from "./commands/status.js";
import { cmdList } from "./commands/list.js";
import { cmdCheckpoint, cmdComplete, ensureExists } from "./commands/record.js";
import { cmdSelfTestAdd, cmdSelfTestStatus } from "./commands/selftest.js";
import { cmdStepAdd, cmdStepList, cmdStepStatus } from "./commands/step.js";
import { cmdNote } from "./commands/note.js";
import { cmdDone } from "./commands/done.js";
import { cmdVerify } from "./commands/verify.js";
import { cmdDoctor } from "./commands/doctor.js";
import { setJsonMode } from "./output.js";

const program = new Command();

program
  .name("coded")
  .description("外置的长程任务状态管理工具 — 记录长任务的进度、计划、自测，换会话能接着跑。")
  .version("0.3.0")
  // A global --json so any command can be machine-read by the running session.
  .option("--json", "emit machine-readable JSON instead of human text")
  .hook("preAction", (_thisCmd, actionCmd) => setJsonMode(Boolean(actionCmd.optsWithGlobals().json)));

program
  .command("init")
  .description("Create .coded/ in the current repository with default assets.")
  .action(() => run(() => cmdInit()));

program
  .command("doctor")
  .description("Check node, .coded, config, and that every loop's contract parses.")
  .action(() => run(() => cmdDoctor()));

program
  .command("loop")
  .alias("new")
  .argument("[title]", "需求标题 (also the requirement summary); omit for interactive wizard")
  .option("-w, --workflow <name>", "workflow to attach")
  .option("-r, --requirement <text>", "requirement summary (defaults to the title)")
  .description("Create a new loop (长程任务).")
  .action((title, opts) => run(() => cmdLoop(title, opts)));

program
  .command("context")
  .alias("pack")
  .argument("[loop]", "loop id (default: most recent)")
  .option("-s, --stage <stage>", "explore|plan|implement|verify|review|checkpoint|complete", "implement")
  .option("-m, --message <text>", "extra instruction to include")
  .option("--save", "also save the context to runs/<id>/packs/ as a record")
  .description("Assemble and print the loop's context for the current session (never launches anything).")
  .action((task, opts) => run(() => cmdContext(task, opts)));

program
  .command("resume")
  .argument("[loop]", "loop id (default: most recent)")
  .description("Synthesize where the loop stands: goal, plan, next step, pending tests, recent notes.")
  .action((task) => run(() => cmdResume(task)));

program
  .command("status")
  .argument("[loop]", "loop id (default: most recent)")
  .description("Show a loop's requirement, plan, self-tests, latest checkpoint, and recent notes.")
  .action((task) => run(() => cmdStatus(task)));

program
  .command("list")
  .option("--status <status>", "filter by lifecycle status")
  .description("List all loops.")
  .action((opts) => run(() => cmdList(opts)));

// --- Steps: the working plan / "what's next" --------------------------------

const step = program.command("step").description("Manage the loop's working plan (steps).");

step
  .command("add")
  .argument("<text>", "what the step does")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Append a step to the plan.")
  .action((text, opts) => run(() => cmdStepAdd(opts.task, text)));

step
  .command("start")
  .argument("<id>", "step id, e.g. s-1")
  .argument("[note]", "optional note")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Mark a step in progress.")
  .action((id, note, opts) => run(() => cmdStepStatus("start", opts.task, id, note)));

step
  .command("done")
  .argument("<id>", "step id")
  .argument("[note]", "optional result note")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Mark a step done.")
  .action((id, note, opts) => run(() => cmdStepStatus("done", opts.task, id, note)));

step
  .command("block")
  .argument("<id>", "step id")
  .argument("[note]", "why it is blocked")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Mark a step blocked.")
  .action((id, note, opts) => run(() => cmdStepStatus("block", opts.task, id, note)));

step
  .command("list")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Show the plan.")
  .action((opts) => run(() => cmdStepList(opts.task)));

program
  .command("note")
  .argument("<text>", "decision or discovery worth keeping")
  .option("-t, --task <loop>", "loop id (default: most recent)")
  .description("Record a note on the loop's timeline (surfaced by resume/status).")
  .action((text, opts) => run(() => cmdNote(opts.task, text)));

program
  .command("checkpoint")
  .argument("[loop]", "loop id (default: most recent)")
  .option("--save", "save the assembled context as a record")
  .option("--record <file>", "store an agent/session checkpoint output as the next snapshot")
  .description("Print checkpoint-stage context, or record a checkpoint with --record.")
  .action((task, opts) => run(() => {
    ensureExists(opts.record);
    cmdCheckpoint(task, opts);
  }));

program
  .command("complete")
  .argument("[loop]", "loop id (default: most recent)")
  .option("--save", "save the assembled context as a record")
  .option("--record <file>", "store a completion analysis (completion.yaml)")
  .description("Print complete-stage context, or record a completion analysis with --record.")
  .action((task, opts) => run(() => {
    ensureExists(opts.record);
    cmdComplete(task, opts);
  }));

const selftest = program
  .command("selftest")
  .description("Update or add self-tests on a loop's contract.");

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
  .description("Run command-backed self-tests, then list the manual ones still to confirm.")
  .action((task) => run(() => cmdVerify(task, {})));

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
