import { createTask } from "../store.js";
import { emit } from "../output.js";

// `coded start "<需求>"` — define a new long-running task. Creates the .coded
// store on first use and writes one JSON file for the task.
export function cmdStart(requirement: string | undefined): void {
  if (!requirement || !requirement.trim()) {
    throw new Error('A requirement is required: coded start "<需求>".');
  }
  const task = createTask(requirement.trim());
  emit({ id: task.id, requirement: task.requirement, status: task.status }, () => {
    console.log(`Started task ${task.id}`);
    console.log(`  requirement: ${task.requirement}`);
    console.log("");
    console.log("Next:");
    console.log('  coded step add "<第一步>"   # sketch the plan');
    console.log("  coded resume               # see where things stand");
  });
}
