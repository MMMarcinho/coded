// Data shapes for coded — a Loop engineering management tool.
// Mirrors the Loop Contract model in SPEC §3 and the templates under .coded/templates/.

export type StageKind =
  | "analyze"
  | "design"
  | "plan"
  | "implement"
  | "test"
  | "verify"
  | "review"
  | "refine"
  | "checkpoint"
  | "complete";

export type Agent = "claude-code" | "codex";

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

export type RequirementSource =
  | "product"
  | "tech_debt"
  | "bug"
  | "optimization"
  | "other";

export type LoopPriority = "p0" | "p1" | "p2" | "p3";

// A Requirement is the driving force behind every Loop — it captures what needs to
// be built and why, with source tracing and stakeholder context.
export interface Requirement {
  summary: string;
  source?: RequirementSource;
  priority?: LoopPriority;
  detail?: string;
  stakeholders?: string[];
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
  // A shell command coded can run to verify this test automatically. When
  // present, `coded verify` runs it and marks pass/fail by exit code.
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

// The full loop contract — one complete requirement-to-delivery cycle.
export interface LoopContract {
  requirement: Requirement;
  context?: LoopContext;
  scope?: LoopScope;
  checkpoints?: ContractCheckpoint[];
  selfTests?: SelfTest[];
  doneCriteria?: DoneCriteria;
}

// LoopStatus tracks where a loop is in its lifecycle.
export type LoopStatus =
  | "drafting"
  | "analyzing"
  | "designing"
  | "implementing"
  | "testing"
  | "reviewing"
  | "done"
  | "cancelled";

// runs/<id>/loop.json — lightweight loop metadata, separate from the contract.
export interface LoopMeta {
  id: string;
  title: string;
  status: LoopStatus;
  workflow: string;
  // The agent that implemented this loop, so verify/review can cross-check with
  // the other agent for an independent perspective.
  implementAgent?: Agent;
  createdAt: string;
  updatedAt: string;
  history: LoopEvent[];
}

export interface LoopEvent {
  at: string;
  kind: "created" | "prompt" | "checkpoint" | "complete" | "status";
  stage?: StageKind;
  agent?: Agent;
  note?: string;
}

export interface CodedConfig {
  name: string;
  defaultWorkflow: string;
  defaultAgents: Record<string, Agent>;
  context: {
    defaultMode: "brief" | "standard" | "full";
    maxKnowledgeFiles: number;
    maxRecentStageRuns: number;
  };
  assets: Record<string, string>;
}

// Backward-compat aliases so downstream code can migrate incrementally.
// Remove once all consumers have switched to the new names.

/** @deprecated Use LoopContract instead. */
export type TaskContract = LoopContract;

/** @deprecated Use LoopMeta instead. */
export type TaskMeta = LoopMeta;

/** @deprecated Use LoopEvent instead. */
export type TaskEvent = LoopEvent;
