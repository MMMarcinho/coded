// Data shapes for coded — a state-management tool for long-running agent tasks.
// Mirrors the Loop Contract model and the templates under .coded/templates/.

export type StageKind =
  | "explore"
  | "plan"
  | "implement"
  | "verify"
  | "review"
  | "checkpoint"
  | "complete";

export type SelfTestType =
  | "manual"
  | "unit"
  | "integration"
  | "e2e"
  | "command"
  | "screenshot";

export type CheckpointType =
  | "direction"
  | "scope"
  | "risk"
  | "integration"
  | "pre_submit"
  | "custom";

// A Requirement describes what the loop should achieve.
export interface Requirement {
  summary: string;
  userVisibleResults?: string[];
  deliverables?: string[];
  successSignals?: string[];
}

export interface LoopContext {
  reason?: string;
  currentBehavior?: string | null;
  relatedFiles?: string[];
  relatedModules?: string[];
  knownConstraints?: string[];
  historicalNotes?: string[];
}

export interface LoopScope {
  in?: string[];
  out?: string[];
}

export interface ContractCheckpoint {
  id: string;
  type?: CheckpointType;
  name: string;
  when?: string;
  questions?: string[];
  expectedEvidence?: string[];
  status?: "pending" | "passed" | "failed" | "skipped";
  notes?: string;
}

export interface SelfTest {
  id: string;
  name: string;
  type?: SelfTestType;
  required?: boolean;
  command?: string;
  preconditions?: string[];
  steps?: string[];
  expectedResults?: string[];
  latestEvidence?: string | null;
  status?: "unknown" | "passed" | "failed" | "skipped";
}

export interface DoneCriteria {
  required?: string[];
  optional?: string[];
  requiresUserConfirmation?: string[];
}

export type StepStatus = "todo" | "doing" | "done" | "blocked";

// A Step is a single unit of the working plan — the "what's next" backbone that
// lets a fresh session pick the task back up. Distinct from selfTests (which
// answer "is it correct?") and checkpoints (which answer "should we stop and
// confirm direction?"). Steps answer "where are we and what's left?".
export interface Step {
  id: string; // s-1, s-2, ...
  text: string;
  status: StepStatus;
  note?: string; // e.g. why it is blocked, or a one-line result
}

// The full loop contract — defines what to do and how to know it's done.
export interface LoopContract {
  requirement: Requirement;
  context?: LoopContext;
  scope?: LoopScope;
  steps?: Step[];
  checkpoints?: ContractCheckpoint[];
  selfTests?: SelfTest[];
  doneCriteria?: DoneCriteria;
}

export type LoopStatus =
  | "created"
  | "in_progress"
  | "verifying"
  | "blocked"
  | "done"
  | "cancelled";

// runs/<id>/loop.json — lightweight loop metadata.
export interface LoopMeta {
  id: string;
  title: string;
  status: LoopStatus;
  workflow: string;
  createdAt: string;
  updatedAt: string;
  history: LoopEvent[];
}

export interface LoopEvent {
  at: string;
  // "prompt" is kept for back-compat with loop.json files written by older
  // versions; new context dumps record "context".
  kind: "created" | "context" | "prompt" | "checkpoint" | "complete" | "verify" | "step" | "note" | "status";
  stage?: StageKind;
  note?: string;
}

export interface CodedConfig {
  name: string;
  defaultWorkflow: string;
  context: {
    defaultMode: "brief" | "standard" | "full";
    maxKnowledgeFiles: number;
    maxRecentStageRuns: number;
  };
  assets: Record<string, string>;
}
