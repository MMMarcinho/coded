import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// The bundled default scaffold copied by `coded init`. dist/ lives one level
// below the package root, so assets/ resolves the same in source and build.
export function assetsDir(): string {
  const candidates = [
    resolve(here, "..", "assets"), // dist/ -> package root/assets
    resolve(here, "..", "..", "assets"), // src/ during dev via tsx
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return candidates[0];
}

// Walk up from cwd to find a `.coded` directory; fall back to cwd/.coded.
export function findCodedRoot(start = process.cwd()): string | null {
  let dir = resolve(start);
  while (true) {
    if (existsSync(join(dir, ".coded"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface CodedPaths {
  projectRoot: string;
  codedDir: string;
  configPath: string;
  promptsDir: string;
  templatesDir: string;
  workflowsDir: string;
  knowledgeDir: string;
  runsDir: string;
}

export function codedPaths(projectRoot: string): CodedPaths {
  const codedDir = join(projectRoot, ".coded");
  return {
    projectRoot,
    codedDir,
    configPath: join(codedDir, "config.json"),
    promptsDir: join(codedDir, "prompts"),
    templatesDir: join(codedDir, "templates"),
    workflowsDir: join(codedDir, "workflows"),
    knowledgeDir: join(codedDir, "knowledge"),
    runsDir: join(codedDir, "runs"),
  };
}

export function taskDir(paths: CodedPaths, taskId: string): string {
  return join(paths.runsDir, taskId);
}

export function contractPath(paths: CodedPaths, taskId: string): string {
  return join(taskDir(paths, taskId), "contract.yaml");
}
