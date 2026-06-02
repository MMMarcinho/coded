// Data shapes for coded. They mirror the Task Contract model in SPEC §3 and the
// templates under .coded/templates/.

export type StageKind =
  | "explore"
  | "plan"
  | "implement"
  | "verify"
  | "review"
  | "fix"
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

export interface TaskGoal {
  summary: string;
  userVisibleResults?: string[];
  deliverables?: string[];
  successSignals?: string[];
}

export interface TaskContext {
  reason?: string;
  currentBehavior?: string | null;
  relatedFiles?: string[];
  relatedModules?: string[];
  knownConstraints?: string[];
  historicalNotes?: string[];
}

export interface TaskScope {
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

// The full contract.yaml document.
export interface TaskContract {
  goal: TaskGoal;
  context?: TaskContext;
  scope?: TaskScope;
  checkpoints?: ContractCheckpoint[];
  selfTests?: SelfTest[];
  doneCriteria?: DoneCriteria;
}

export type TaskStatus =
  | "created"
  | "in_progress"
  | "verifying"
  | "blocked"
  | "done"
  | "cancelled";

// runs/<id>/task.json — lightweight task metadata, separate from the contract.
export interface TaskMeta {
  id: string;
  title: string;
  status: TaskStatus;
  workflow: string;
  createdAt: string;
  updatedAt: string;
  history: TaskEvent[];
}

export interface TaskEvent {
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
