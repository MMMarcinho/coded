import { codedPaths, findCodedRoot } from "../paths.js";
import { appendEvent, loadLoop, resolveLoopId } from "../store.js";
import { emit } from "../output.js";
import type { LoopEvent } from "../types.js";

// `coded note "<text>"` — record a decision/discovery on the loop's timeline.
// Lightweight on purpose: it reuses the loop's history (no new files), and
// `coded resume`/`status` surface the most recent ones so a fresh session sees
// the reasoning instead of re-deriving it.
export function cmdNote(taskRef: string | undefined, text: string): void {
  if (!text || !text.trim()) throw new Error("Note text is required: coded note \"<decision>\".");
  const root = findCodedRoot();
  if (!root) throw new Error("No .coded/ found. Run `coded init` first.");
  const paths = codedPaths(root);
  const loopId = resolveLoopId(paths, taskRef);
  const meta = loadLoop(paths, loopId);
  appendEvent(paths, meta, { kind: "note", note: text.trim() });
  emit({ loop: loopId, note: text.trim() }, () => console.log(`Noted on ${loopId}: ${text.trim()}`));
}

// Shared helper: the most recent note events, newest last.
export function recentNotes(meta: { history: LoopEvent[] }, max = 5): LoopEvent[] {
  return meta.history.filter((e) => e.kind === "note").slice(-max);
}
