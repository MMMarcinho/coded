import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { assetsDir, codedPaths } from "../paths.js";

// Copy every file from src into dest, never overwriting existing files.
function copyMissing(src: string, dest: string, created: string[]): void {
  cpSync(src, dest, {
    recursive: true,
    force: false,
    errorOnExist: false,
    filter: (from) => {
      // Record top-level-ish files we are about to create for reporting.
      if (!existsSync(from.replace(src, dest))) created.push(from);
      return true;
    },
  });
}

function ensureRunsIgnored(codedDir: string): void {
  const ignorePath = join(codedDir, ".gitignore");
  const lines = ["runs/", "exports/", "*.local.*"];
  if (existsSync(ignorePath)) {
    const current = readFileSync(ignorePath, "utf8");
    const missing = lines.filter((l) => !current.split(/\r?\n/).includes(l));
    if (missing.length) {
      writeFileSync(ignorePath, current.trimEnd() + "\n" + missing.join("\n") + "\n");
    }
  } else {
    writeFileSync(ignorePath, lines.join("\n") + "\n");
  }
}

export function cmdInit(): void {
  const projectRoot = process.cwd();
  const paths = codedPaths(projectRoot);
  const assets = assetsDir();

  const existed = existsSync(paths.codedDir);
  mkdirSync(paths.codedDir, { recursive: true });

  const created: string[] = [];
  copyMissing(assets, paths.codedDir, created);
  mkdirSync(paths.runsDir, { recursive: true });
  ensureRunsIgnored(paths.codedDir);

  if (existed) {
    console.log(`Updated .coded/ (added ${created.length} missing default files).`);
  } else {
    console.log(`Initialized .coded/ in ${projectRoot}`);
  }
  console.log("Next: `coded new \"<task title>\"` to start a task.");
}
