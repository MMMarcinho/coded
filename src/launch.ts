import { spawnSync } from "node:child_process";
import { accessSync, constants as fsConstants, existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { Agent } from "./types.js";

// Map a coded agent to its CLI binary name.
const BINARY: Record<Agent, string> = {
  "claude-code": "claude",
  codex: "codex",
};

const isWin = process.platform === "win32";

// On Windows npm installs CLIs as .cmd/.exe shims; try those too.
function binaryCandidates(name: string): string[] {
  return isWin ? [`${name}.cmd`, `${name}.exe`, `${name}.bat`, name] : [name];
}

// Search dirs beyond PATH where agent CLIs commonly live. GUI-launched
// processes (and some shells) get a stripped PATH that misses these — the same
// problem multica fixes for its daemon. Cheap to check, prevents false
// "not installed" reports.
function searchDirs(): string[] {
  const fromPath = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const extra: string[] = [];
  const home = homedir();
  if (isWin) {
    if (process.env.APPDATA) extra.push(join(process.env.APPDATA, "npm"));
    extra.push(join(home, ".bun", "bin"));
  } else {
    extra.push(
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      join(home, ".local", "bin"),
      join(home, ".bun", "bin"),
      join(home, ".npm-global", "bin"),
      join(home, ".volta", "bin"),
    );
  }
  // PATH first (respect user's choice), then the well-known fallbacks.
  return [...fromPath, ...extra];
}

function isExecutableFile(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    if (!isWin) accessSync(p, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Resolve an agent binary to an absolute path, or null if not found.
export function findBinary(name: string): string | null {
  for (const dir of searchDirs()) {
    for (const cand of binaryCandidates(name)) {
      const full = join(dir, cand);
      if (existsSync(full) && isExecutableFile(full)) return full;
    }
  }
  return null;
}

// Env handed to every agent child: inherit, but make sure the well-known dirs
// are on PATH (so the agent can find node/git/etc.) and mark who spawned it.
function spawnEnv(): NodeJS.ProcessEnv {
  const merged = [...new Set(searchDirs())].join(delimiter);
  return { ...process.env, PATH: merged, CODED_LAUNCHED_BY: "coded" };
}

export interface ProbeResult {
  agent: Agent;
  binary: string;
  path: string | null;
  available: boolean; // binary found on disk
  ok: boolean; // binary found AND `--version` ran successfully
  version?: string;
  error?: string;
}

// Cheap pre-flight: confirm the agent binary not only exists but actually runs,
// before committing to a long headless session. Catches "installed but broken /
// wrong arch / incompatible" up front instead of hanging or failing late.
export function probeAgent(agent: Agent): ProbeResult {
  const binary = BINARY[agent];
  const found = findBinary(binary);
  if (!found) return { agent, binary, path: null, available: false, ok: false };

  const res = spawnSync(found, ["--version"], {
    encoding: "utf8",
    timeout: 8000,
    env: spawnEnv(),
    windowsHide: true,
  });
  if (res.error) {
    const timedOut = (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    return {
      agent,
      binary,
      path: found,
      available: true,
      ok: false,
      error: timedOut ? "version probe timed out" : res.error.message,
    };
  }
  const line = (res.stdout || res.stderr || "").trim().split(/\r?\n/)[0];
  return {
    agent,
    binary,
    path: found,
    available: true,
    ok: res.status === 0,
    version: line || undefined,
    error: res.status === 0 ? undefined : res.stderr?.trim() || `exit ${res.status}`,
  };
}

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

// Back-compat alias; resolves an agent binary name to a path.
export function which(bin: string): string | null {
  return findBinary(bin);
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
  const found = findBinary(binary);
  const available = found != null;
  const interactive = Boolean(process.stdout.isTTY) || force;

  if (!available || !interactive) {
    return { launched: false, binary, available, exitCode: null };
  }

  // Spawn the resolved absolute path with a curated env; the prompt is the
  // opening argument. Interactive prompts are small enough for argv.
  const res = spawnSync(found, [prompt], {
    stdio: "inherit",
    env: spawnEnv(),
    windowsHide: true,
  });
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
// parse confirmation results back. claude uses `-p` (print mode); codex uses
// its non-interactive `exec` subcommand. Both read the prompt from stdin.
//
// The prompt is piped via stdin rather than passed as an argv string: it can be
// large (full contract + context) and may contain characters that are awkward
// to escape on a command line.
export function runAgentHeadless(agent: Agent, prompt: string, timeoutMs = 1000 * 60 * 10): HeadlessResult {
  const binary = BINARY[agent];
  const found = findBinary(binary);
  if (!found) return { ok: false, available: false, binary, output: "" };

  const args = agent === "claude-code" ? ["-p"] : ["exec"];
  const res = spawnSync(found, args, {
    input: prompt,
    encoding: "utf8",
    timeout: timeoutMs,
    killSignal: "SIGTERM",
    maxBuffer: 64 * 1024 * 1024,
    env: spawnEnv(),
    windowsHide: true,
  });
  if (res.error) {
    const timedOut = (res.error as NodeJS.ErrnoException).code === "ETIMEDOUT";
    return {
      ok: false,
      available: true,
      binary,
      output: res.stdout ?? "",
      error: timedOut ? `timed out after ${Math.round(timeoutMs / 1000)}s` : res.error.message,
    };
  }
  return {
    ok: res.status === 0,
    available: true,
    binary,
    output: res.stdout ?? "",
    error: res.status === 0 ? undefined : res.stderr || `exit ${res.status}`,
  };
}
