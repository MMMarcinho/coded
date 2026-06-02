import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import type { Agent } from "./types.js";

// Map a coded agent to its CLI binary name.
const BINARY: Record<Agent, string> = {
  "claude-code": "claude",
  codex: "codex",
};

export function resolveAgent(name?: string): Agent {
  if (!name) return "claude-code";
  const n = name.toLowerCase();
  if (n === "claude" || n === "claude-code") return "claude-code";
  if (n === "codex") return "codex";
  throw new Error(`Unknown agent '${name}'. Use claude-code or codex.`);
}

// The other agent — used to verify/review with a different perspective than
// the one that implemented (cross-checking is intentional, not a fallback).
export function otherAgent(a: Agent): Agent {
  return a === "claude-code" ? "codex" : "claude-code";
}

export interface AgentChoice {
  agent: Agent;
  reason: string;
}

// Pick the agent that should confirm/verify. Explicit choice wins. Otherwise
// cross-check against whoever implemented. This is deliberately "有感": coded
// announces the choice and never silently swaps to a different agent.
export function chooseVerifyAgent(args: {
  explicit?: string;
  implementAgent?: Agent;
  configVerifyAgent?: Agent;
}): AgentChoice {
  if (args.explicit) {
    return { agent: resolveAgent(args.explicit), reason: "explicitly chosen" };
  }
  if (args.implementAgent) {
    const agent = otherAgent(args.implementAgent);
    return { agent, reason: `implement used ${args.implementAgent} → cross-checking with ${agent} for an independent angle` };
  }
  if (args.configVerifyAgent) {
    return { agent: args.configVerifyAgent, reason: "from config defaultAgents.verify" };
  }
  return { agent: "claude-code", reason: "default" };
}

// Find an executable on PATH without extra dependencies.
export function which(bin: string): string | null {
  const path = process.env.PATH ?? "";
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    const full = join(dir, bin);
    if (existsSync(full)) return full;
  }
  return null;
}

export interface LaunchResult {
  launched: boolean;
  binary: string;
  available: boolean;
  exitCode: number | null;
}

// Launch the agent with the context pack as its opening prompt, inheriting the
// terminal so the user lands inside the agent. Falls back (launched=false) when
// the binary is missing or stdout is not a TTY.
export function launchAgent(agent: Agent, prompt: string, force = false): LaunchResult {
  const binary = BINARY[agent];
  const found = which(binary);
  const available = found != null;
  const interactive = Boolean(process.stdout.isTTY) || force;

  if (!available || !interactive) {
    return { launched: false, binary, available, exitCode: null };
  }

  const res = spawnSync(binary, [prompt], { stdio: "inherit" });
  return {
    launched: true,
    binary,
    available,
    exitCode: res.status,
  };
}

export interface HeadlessResult {
  ok: boolean;
  available: boolean;
  binary: string;
  output: string;
  error?: string;
}

// Run the agent non-interactively and capture its final response, so coded can
// parse confirmation results back. Uses `claude -p` (print mode); other agents
// fall back to unavailable until their headless flag is wired.
export function runAgentHeadless(agent: Agent, prompt: string, timeoutMs = 1000 * 60 * 10): HeadlessResult {
  const binary = BINARY[agent];
  const found = which(binary);
  if (!found) return { ok: false, available: false, binary, output: "" };

  // Only claude has a verified print mode in V1.
  const args = agent === "claude-code" ? ["-p", prompt] : [prompt];
  const res = spawnSync(binary, args, { encoding: "utf8", timeout: timeoutMs });
  if (res.error) {
    return { ok: false, available: true, binary, output: res.stdout ?? "", error: res.error.message };
  }
  return {
    ok: res.status === 0,
    available: true,
    binary,
    output: res.stdout ?? "",
    error: res.status === 0 ? undefined : res.stderr || `exit ${res.status}`,
  };
}
