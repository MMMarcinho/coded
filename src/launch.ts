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
