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

// The full loop contract — defines what to do and how to know it's done.
export interface LoopContract {
  requirement: Requirement;
  context?: LoopContext;
  scope?: LoopScope;
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
