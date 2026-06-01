# coded — Spec

## 1. 产品定位

coded 是 Claude Code / Codex 之上的**编码任务发起与验证编排层**。

```
┌────────────────────────────────────────┐
│                 coded                  │
│ Agent 启动 · 任务契约 · 阶段编排 · 项目知识 │
├────────────────────────────────────────┤
│          Claude Code / Codex           │
│        实际探索、实现、验证、checkpoint 的 Agent │
└────────────────────────────────────────┘
```

Claude Code / Codex 的 Agent 能力很强，但日常使用仍然缺少一个稳定的任务入口：

- 每次都要手动组织 prompt、选择 Claude Code 或 Codex、说明工作目录和边界。
- 实现、验证、review、checkpoint 常混在一次对话里，输出难以复用。
- Agent 可能在探索不足时直接实现，解决了错误的问题。
- 任务完成标准常常是隐式的，缺少规范化验证闭环。
- 验证和 checkpoint 也需要 Agent 做，但缺少稳定的阶段提示和交接格式。
- 项目维度的流程、命令、经验和偏好没有沉淀为可复用资产。

coded 的目标是成为 Claude Code / Codex 的统一 task runner：

1. **目标**：用户要什么，以及明确不做什么。
2. **发起**：选择 Claude Code / Codex，并生成适合当前阶段的 prompt。
3. **编排**：把 implement、verify、review、checkpoint 拆成可串联的 Agent stage。
4. **验证契约**：由 coded 管理标准，由 Claude/Codex stage 执行验证。
5. **证据**：保存 Agent 输出、命令结果、diff、截图、评审结论等事实。
6. **项目资产**：在仓库 `.coded/` 中沉淀可复用 workflow、knowledge、prompt 和 run history。

coded 不替代 Claude Code / Codex 的 Agent 能力。coded 负责发起和串联这些 Agent，让每个阶段拿到正确上下文、输出结构化结果，并把项目级流程知识沉淀下来。

---

## 2. 设计原则

这些原则来自 Claude Code 推荐的使用方式，并转化为 coded 的产品要求。

### 2.1 先定义验证，再让 Agent 验证

每个 Task 都应该尽量定义一个可读的通过/失败信号：

- 单元测试、集成测试、端到端测试
- typecheck、lint、build
- bug 的复现命令
- UI 任务的截图或视觉对比
- 无法自动化时的人工检查清单

coded 必须同时保存“应该如何验证”和“最近一次验证的证据”。验证动作优先由 Claude Code / Codex 的 `verify` stage 完成：Agent 可以读 diff、运行命令、检查截图或给出人工检查建议。Task 只有在必需检查通过，或用户明确豁免并记录原因后，才能标记为 `done`。

### 2.2 用 Stage 串联 Agent，而不是只开一段对话

coded 不应把所有会话都当成“继续写代码”。一次 `coded run` 可以由多个 Agent stage 组成：

1. **explore**：查文件、理解流程、定位风险，不预期改代码。
2. **plan**：形成或修订执行计划，补齐依赖和验证方式。
3. **implement**：围绕当前子任务做有限范围的改动。
4. **verify**：由 Agent 检查 diff、运行或建议检查、收集证据。
5. **review**：用独立上下文找 bug、回归、遗漏测试和边界条件。
6. **checkpoint**：由 Agent 压缩本轮结果，提取下一步和 Project Knowledge candidates。

每个 stage 都可以选择不同 Agent，例如 Claude 实现、Codex 验证、Claude checkpoint。很小且明确的改动可以用 `--quick` 跳过完整流水线；多文件、风险较高或不熟悉的任务应该走完整 pipeline。

### 2.3 上下文是一种预算

Context Pack 必须短、准、可丢弃。它只包含能帮助下一次 Agent 会话减少错误的信息：

- 必须包含目标、当前步骤、约束和验证契约。
- 包含最近摘要和相关记忆，而不是完整历史。
- 大文档、大文件只引用路径或链接，不整段粘贴。
- 区分长期有效的项目事实和一次性任务备注。
- 低置信度、过期或已矛盾的 Memory 不进入上下文。

coded 应该显示 Context Pack 的大致长度，让用户能感知上下文膨胀。

### 2.4 具体信息优先于泛泛建议

coded 存储的信息应该是可执行的：

- 已知文件、模块、命令和路径
- 复现步骤和验证命令
- 示例输入、边界条件和反例
- 决策、取舍和不做的范围
- 项目特有约定

避免沉淀“写干净代码”这类没有本地约束的通用建议。

### 2.5 用户可编辑，LLM 只产出草稿

Plan、Stage 输出、Project Knowledge、Verification Contract 都应该可编辑。用户是意图和事实的最终来源，LLM 只负责生成草稿、提炼候选项和减少手工整理成本。

### 2.6 和现有 Agent 工作流互操作

V1 应优先作为发起器工作：能直接启动 Claude Code / Codex 时直接启动；环境不支持时退化为打印可复制命令和 prompt。

- 命名和恢复会话
- hooks 自动 checkpoint 或验证
- 非交互模式用于批处理和 CI
- 独立上下文的 review / verification 会话
- worktree 并行实验

### 2.7 项目级资产保存在 `.coded/`

每个仓库可以有一个和 `.claude/` 平级的 `.coded/` 目录。`.coded/` 不是临时缓存，而是项目级 AI 编码资产库：

- 复用 workflow：本仓库常见任务怎么跑、怎么验、怎么 checkpoint。
- 项目 knowledge：目录结构、模块边界、关键命令、常见坑。
- Agent prompts：implement、verify、review、checkpoint 的项目化模板。
- Run history：每次 coded 发起的 stage 输入、输出和证据。
- Project Knowledge candidates：由 checkpoint stage 提取、等待用户确认的知识。

这些内容应该尽量是人可读、可 review、可进入版本管理的文本文件；包含绝对路径、临时输出、大型 transcript 或敏感信息的内容放入 ignored runtime 区域。

---

## 3. 核心概念

### 3.1 Task

Task 是一个长期编码目标。

生命周期：

```
created -> exploring -> planned -> in_progress -> verifying -> done
                         |              |             |
                         v              v             v
                      blocked        blocked      cancelled
```

Task 拥有：

- 标题和描述
- 范围和非目标
- 验收标准
- 验证契约
- 当前 Plan
- Session 摘要和证据
- 相关 Project Knowledge
- 变更文件和产物引用

### 3.2 Pipeline

Pipeline 是一次 coded run 的阶段编排。

示例：

```yaml
pipeline: default
stages:
  - kind: implement
    agent: claude-code
  - kind: verify
    agent: codex
  - kind: checkpoint
    agent: claude-code
```

Pipeline 解决两个问题：

- 把“写代码、验证、总结”拆成不同上下文，减少一个 Agent 自说自话。
- 允许项目沉淀可复用策略，例如“Claude 实现，Codex 验证”或“UI 任务必须追加 screenshot review”。

### 3.3 Stage

Stage 是 coded 发起的一次 Agent 子任务。

Stage kind：

```
explore | plan | implement | verify | review | fix | checkpoint
```

每个 Stage 有：

- kind
- agent: `claude-code | codex`
- input: Task Contract + Project Knowledge + previous stage output
- prompt template
- expected output schema
- status: `pending | running | passed | failed | skipped`
- evidence references

Stage 的输出必须尽量结构化，方便 coded 作为下一阶段输入。

### 3.4 Plan

Plan 把 Task 拆成有顺序、有依赖、有检查方式的子任务。

示例：

```
Task: "把用户系统从 Session Cookie 迁移到 JWT"
  1. 探索现有 Session 流程
     check: 记录 login / refresh / logout 的调用链
  2. 实现 JWT 签发和验证工具
     check: 覆盖有效、过期、畸形 token 的单元测试
  3. 改造登录接口
     depends on: 2
     check: 集成测试返回 token，且不再写 session
  4. 改造 auth middleware
     depends on: 2
     check: 受保护路由拒绝缺失或过期 token
  5. 清理旧 Session 代码
     depends on: 3, 4
     check: typecheck 和 auth 测试通过
```

子任务状态：

```
pending | in_progress | verifying | done | skipped | blocked
```

Plan 是活文档。每次修订都要保留版本，StageRun 需要知道自己基于哪个 Plan version 产生。

### 3.5 Session / Agent Run

Session 是一次真实的 Claude Code / Codex 对话；Agent Run 是 coded 发起并记录的一次 Stage 执行。V1 可以把一个 Stage 对应到一个 Session。

Agent Run 生命周期：

1. **Prepare**：coded 读取 `.coded/` 项目资产，生成 stage prompt。
2. **Launch**：coded 启动 Claude Code / Codex，或打印等价命令。
3. **Work**：Agent 执行 explore、implement、verify、review 或 checkpoint。
4. **Capture**：coded 保存结构化输出、证据、变更文件和下一阶段输入。

Stage kind：

```
explore | plan | implement | verify | review | fix | checkpoint
```

关键设计：coded 不依赖 Claude Code / Codex 的内部工具调用细节。它只记录对后续有价值的结果：stage 输入、stage 输出、改了哪些文件、跑了哪些命令、检查是否通过、做了什么决策、还剩什么风险。

### 3.6 Context Pack

Context Pack 是每次 Session 开始前生成的 prompt 产物。

它应该结构化、紧凑、面向行动：

1. Task 目标和当前状态
2. Stage kind
3. 范围、非目标和约束
4. 当前 Plan 和 active step
5. Verification Contract
6. 最新证据和已知失败
7. 相关 Project Knowledge 和项目约定
8. 最近 Stage 输出摘要
9. 用户新指令占位

Context Pack 模式：

```
brief      只包含关键状态和当前步骤
standard   默认模式，足够恢复任务
full       包含更多历史和决策依据
review     面向新上下文评审，减少实现者偏见
```

### 3.7 Verification Contract

Verification Contract 定义“完成”的可检查标准。

字段：

- check name
- command 或 manual procedure
- expected signal
- requiredForDone
- latest status
- latest evidence
- waiver reason

示例：

```yaml
checks:
  - name: auth unit tests
    command: npm test -- auth
    expected: exits 0
    requiredForDone: true
  - name: typecheck
    command: npm run typecheck
    expected: exits 0
    requiredForDone: true
```

### 3.8 Evidence

Evidence 是证明进展或验证结果的紧凑事实：

- 命令和退出码
- 关键输出摘录
- 变更文件列表
- 截图路径
- PR URL
- review 结论
- 用户决策

Evidence 应该独立于摘要存储，避免以后再让 LLM 从长文本中重新推断事实。

### 3.9 Project Knowledge / Memory

Project Knowledge / Memory 是仓库维度跨 Task 复用的知识，默认保存在 `.coded/knowledge/`。

类型：

- `project_structure`：目录职责、模块边界、关键文件位置
- `workflow`：命令、测试方式、发布步骤、repo etiquette
- `user_preference`：用户明确表达的偏好和习惯
- `decision`：长期有效的架构或产品决策
- `lesson`：做任务时发现的坑和注意事项

Memory 生命周期：

1. 从 checkpoint 或 done 中提取 candidate。
2. 用户接受、编辑或拒绝。
3. 保存 tags、confidence 和来源。
4. Context Builder 只召回和当前 Task 相关的 Project Knowledge。
5. 过期、矛盾或低价值 Memory 可删除或降权。

### 3.10 Workflow

Workflow 是项目级可复用流程，保存在 `.coded/workflows/`。

示例：

```yaml
name: ui-change
description: UI 改动默认流程
stages:
  - kind: implement
    agent: claude-code
  - kind: verify
    agent: codex
    checks:
      - npm run typecheck
      - npm run test
      - screenshot review
  - kind: checkpoint
    agent: claude-code
```

Workflow 可以由用户手写，也可以由 checkpoint stage 提议沉淀。

---

## 4. 产品工作流

### 4.1 初始化项目

```bash
$ coded init
```

在项目根目录创建和 `.claude/` 平级的 `.coded/`，检测项目基础信息，并询问缺失命令：

- install command
- test command
- typecheck command
- lint command
- build command
- preferred implement agent: Claude Code / Codex
- preferred verify agent: Claude Code / Codex
- preferred checkpoint agent: Claude Code / Codex

输出：

- `.coded/config.json`
- `.coded/coded.db`
- `.coded/workflows/default.yaml`
- `.coded/prompts/implement.md`
- `.coded/prompts/verify.md`
- `.coded/prompts/checkpoint.md`
- 只基于已确认命令生成初始 Project Knowledge

### 4.2 发起一次编码任务

```bash
$ coded run "把用户系统从 Session Cookie 迁移到 JWT"
```

流程：

1. coded 询问或推断目标、范围、非目标、验收标准。
2. coded 从 `.coded/` 读取项目 knowledge、workflow、prompt template。
3. coded 选择 pipeline，例如 `implement -> verify -> checkpoint`。
4. coded 发起 implement stage 到 Claude Code 或 Codex。
5. implement stage 输出结构化结果和变更摘要。
6. coded 把 implement 输出作为输入，发起 verify stage。
7. verify stage 运行或建议检查，输出 evidence、risks、pass/fail。
8. coded 发起 checkpoint stage，压缩本轮结果并提议 Project Knowledge candidates。
9. coded 保存 run history、stage artifacts、evidence，并更新 Task 状态。

小任务可以使用：

```bash
$ coded run "修复登录页 typo" --quick
```

`--quick` 使用单步骤 Task Contract 和最短 pipeline，通常只跑 `implement -> checkpoint`，但仍要记录是否跳过 verify 以及原因。

### 4.3 选择 Agent 和 Pipeline

```bash
$ coded run "重构 auth middleware" --implement claude-code --verify codex --checkpoint claude-code
$ coded run "调整设置页布局" --workflow ui-change
```

选择逻辑：

- 未指定时使用 `.coded/config.json` 的默认 Agent。
- `--workflow` 从 `.coded/workflows/` 读取阶段编排。
- 命令行参数可以覆盖 workflow 中的 agent。
- 如果当前环境无法直接启动 Agent，coded 打印等价命令和 prompt。

### 4.4 继续已有 Task

```bash
$ coded continue [task-id] --stage fix --agent codex
```

流程：

1. 加载 Task、active Plan version、最近 stage output、相关 Project Knowledge、最新 Evidence。
2. 根据失败检查或 active subtask 选择下一 stage。
3. 生成 Context Pack 和 stage prompt。
4. 发起 Claude Code / Codex。
5. 捕获 stage output，更新 run history。

### 4.5 Agent-driven Verify

```bash
$ coded verify [task-id] --agent codex
```

coded 不亲自判断任务是否正确，而是发起 verify stage。

verify stage prompt 要求 Agent：

- 读取 Task Contract、diff、相关 Project Knowledge。
- 确认 Verification Contract 是否覆盖任务风险。
- 运行允许的检查，或列出用户需要运行的检查。
- 必要时做代码审查和边界条件分析。
- 输出 `passed | failed | inconclusive`、evidence、risks、recommended_next_action。

验证会更新：

- check status: `unknown | passed | failed | waived`
- latest evidence
- failure summary
- suggested next stage: `fix | review | checkpoint | done`

### 4.6 Agent-driven Checkpoint

```bash
$ coded checkpoint [task-id] --agent claude-code
```

coded 发起 checkpoint stage，让 Agent 把本轮 implement / verify / review 的结果压缩成可恢复状态。

Checkpoint stage 输出格式：

```markdown
## Completed
- ...

## Evidence
- `npm test -- auth` exited 0

## Decisions
- ...

## Remaining
- ...

## Next Suggested Session
- intent: verify
- active step: ...
```

checkpoint stage 还应该输出：

- Project Knowledge candidates
- Workflow candidates
- Prompt template improvement candidates
- 是否需要用户确认的重要决策

### 4.7 完成 Task

```bash
$ coded done [task-id]
```

流程：

1. 确认必需检查已通过，或已有明确 waiver。
2. 标记 Task 为 `done`。
3. 生成 final summary。
4. 提议 Project Knowledge candidates。
5. 展示统计：StageRun 数、耗时、变更文件、检查结果、遗留风险。

### 4.8 Review / Second Opinion

```bash
$ coded review [task-id] --agent codex
```

Review Context Pack 面向一个新上下文 Agent：

- 摘要目标和 diff
- 包含验证证据
- 要求关注 bug、回归、缺失测试和边界条件
- 尽量不包含实现者的辩护性解释，降低评审偏见

---

## 5. 命令设计

```bash
# Project
coded init
coded config
coded doctor

# Run / Pipeline
coded run "<task>" [--workflow default] [--implement claude-code|codex] [--verify claude-code|codex] [--checkpoint claude-code|codex]
coded run "<task>" --quick
coded continue [task-id] [--stage explore|plan|implement|verify|review|fix|checkpoint] [--agent claude-code|codex]
coded pipeline list
coded pipeline show [name]

# Task
coded new "<desc>" [--quick]      # create Task without launching; optional lower-level command
coded list [--status in_progress]
coded status [task-id]
coded done [task-id]
coded cancel [task-id]

# Stage
coded stage run <task-id> --kind verify --agent codex
coded stage status <stage-run-id>
coded stage output <stage-run-id>

# Plan
coded plan [task-id]
coded plan revise [task-id]
coded subtask start <subtask-id>
coded subtask done <subtask-id>
coded subtask block <subtask-id> "<reason>"
coded subtask skip <subtask-id> "<reason>"
coded subtask note <subtask-id> "<note>"

# Checkpoint / Prompt
coded checkpoint [task-id]
coded history [task-id]
coded prompt [task-id] [--mode standard]

# Verification / Review
coded verify [task-id]
coded review [task-id]
coded check add [task-id] "<name>" --cmd "<command>"
coded check pass <check-id> "<evidence>"
coded check fail <check-id> "<evidence>"
coded check waive <check-id> "<reason>"

# Project Knowledge
coded knowledge list
coded knowledge search "<query>"
coded knowledge add "<text>" --type workflow --tags repo,test
coded knowledge accept <candidate-id>
coded knowledge reject <candidate-id>
coded knowledge forget <memory-id>

# Workflow Assets
coded workflow list
coded workflow add <name>
coded workflow edit <name>
coded workflow promote <candidate-id>
```

---

## 6. 数据模型

```typescript
type Agent = "claude-code" | "codex";

type TaskStatus =
  | "created"
  | "exploring"
  | "planned"
  | "in_progress"
  | "verifying"
  | "blocked"
  | "done"
  | "cancelled";

type SessionIntent =
  | "explore"
  | "plan"
  | "implement"
  | "verify"
  | "review"
  | "fix"
  | "checkpoint";

type StageKind = SessionIntent;

interface Pipeline {
  id: string;
  name: string;
  description: string;
  stages: StageDefinition[];
  source: "builtin" | "project" | "user";
  createdAt: Date;
  updatedAt: Date;
}

interface StageDefinition {
  id: string;
  pipelineId: string;
  kind: StageKind;
  defaultAgent: Agent;
  promptTemplatePath: string;
  required: boolean;
  order: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  scope: string[];
  nonGoals: string[];
  acceptanceCriteria: string[];
  status: TaskStatus;
  currentPlanId: string | null;
  activeSubtaskId: string | null;
  pipelineId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

interface Plan {
  id: string;
  taskId: string;
  version: number;
  rationale: string;
  subtasks: Subtask[];
  createdAt: Date;
  updatedAt: Date;
}

interface Subtask {
  id: string;
  planId: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "verifying" | "done" | "skipped" | "blocked";
  dependsOn: string[];
  checkIds: string[];
  notes: string;
  order: number;
}

interface Session {
  id: string;
  taskId: string;
  planId: string | null;
  intent: SessionIntent;
  contextPackId: string;
  summary: string;
  decisions: string[];
  blockers: string[];
  changedFiles: string[];
  nextStep: string | null;
  createdAt: Date;
  endedAt: Date | null;
}

interface StageRun {
  id: string;
  taskId: string;
  pipelineId: string | null;
  stageDefinitionId: string | null;
  kind: StageKind;
  agent: Agent;
  status: "pending" | "running" | "passed" | "failed" | "skipped";
  inputContextPackId: string;
  prompt: string;
  output: string;
  structuredOutput: Record<string, unknown> | null;
  evidenceIds: string[];
  startedAt: Date | null;
  endedAt: Date | null;
}

interface ContextPack {
  id: string;
  taskId: string;
  sessionId: string | null;
  stageRunId: string | null;
  mode: "brief" | "standard" | "full" | "review";
  tokenEstimate: number | null;
  content: string;
  createdAt: Date;
}

interface VerificationCheck {
  id: string;
  taskId: string;
  subtaskId: string | null;
  name: string;
  command: string | null;
  manualProcedure: string | null;
  expectedSignal: string;
  requiredForDone: boolean;
  status: "unknown" | "passed" | "failed" | "waived";
  latestEvidenceId: string | null;
  waiverReason: string | null;
  updatedAt: Date;
}

interface Evidence {
  id: string;
  taskId: string;
  sessionId: string | null;
  stageRunId: string | null;
  checkId: string | null;
  kind: "command" | "file_change" | "screenshot" | "review" | "decision" | "note";
  summary: string;
  content: string;
  createdAt: Date;
}

interface Memory {
  id: string;
  type: "project_structure" | "workflow" | "user_preference" | "decision" | "lesson";
  content: string;
  sourceTaskId: string | null;
  sourceSessionId: string | null;
  tags: string[];
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
  accessCount: number;
}

interface MemoryCandidate {
  id: string;
  sourceTaskId: string;
  sourceSessionId: string | null;
  proposedType: Memory["type"];
  content: string;
  tags: string[];
  reason: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: Date;
}

interface ProjectConfig {
  name: string;
  defaultAgents: {
    implement: Agent;
    verify: Agent;
    checkpoint: Agent;
  };
  defaultWorkflow: string;
  commands: {
    install?: string;
    test?: string;
    typecheck?: string;
    lint?: string;
    build?: string;
  };
  context: {
    defaultMode: "brief" | "standard" | "full";
    maxKnowledgeFiles: number;
    maxRecentStageRuns: number;
  };
  assets: {
    knowledgeDir: ".coded/knowledge";
    workflowsDir: ".coded/workflows";
    promptsDir: ".coded/prompts";
    runsDir: ".coded/runs";
  };
  llm: {
    provider: "claude" | "openai" | "ollama";
    model: string;
    apiKeyEnv?: string;
  };
}
```

---

## 7. Context Pack 模板

```markdown
# coded Context Pack

## Task
- Title: {task.title}
- Status: {task.status}
- Objective: {task.description}
- Scope: {scope}
- Non-goals: {nonGoals}
- Acceptance criteria: {acceptanceCriteria}

## Stage
- Kind: {stage.kind}
- Agent: {stage.agent}
- Expected output: {stage.outputSchema}

## Current Plan
{subtasks with status, dependencies, and active marker}

## Active Step
{activeSubtask.title}
{activeSubtask.description}

## Verification Contract
{required checks, commands/procedures, latest status}

## Latest Evidence
{most recent relevant evidence}

## Relevant Project Memory
{ranked memories with source tags}

## Relevant Project Workflow
{workflow name, stage order, stage-specific rules}

## Recent Session Summary
{last useful summary, decisions, blockers, next step}

## Instructions For This Session
- Follow the current stage kind.
- For `implement`, explore before editing when the active step is unclear.
- For `verify`, inspect the diff and run or request the Verification Contract checks.
- For `checkpoint`, summarize facts, preserve evidence, and propose reusable knowledge only when it is concrete.
- Keep changes scoped to the active step unless the user redirects.
- At the end, emit the requested structured output.

## User's New Instruction
```

模板规则：

- 空 section 直接省略。
- 优先使用 bullet，避免长段落。
- 已知命令必须原样写入。
- `brief` 模式要足够短，不挤占用户新指令。
- `review` 模式要降低实现者偏见，突出缺陷发现。

---

## 8. 存储布局

```
~/.coded/
  config.json
  global-knowledge.json

<project>/.coded/
  config.json                    # 项目级 coded 配置
  coded.db                       # Task / Pipeline / StageRun / Evidence 索引
  knowledge/
    project.md                   # 项目结构、模块边界、常见坑
    commands.md                  # 已确认可用的安装、测试、构建命令
    conventions.md               # 本仓库编码和协作约定
  workflows/
    default.yaml                 # 默认 implement -> verify -> checkpoint
    ui-change.yaml               # 可选：UI 任务流程
    bugfix.yaml                  # 可选：bug 修复流程
  prompts/
    implement.md
    verify.md
    review.md
    checkpoint.md
  runs/                          # 默认 gitignored，保存每次 stage 的运行产物
    <run-id>/
      task.md
      implement.prompt.md
      implement.output.md
      verify.prompt.md
      verify.output.md
      checkpoint.output.md
      evidence.json
  candidates/
    knowledge/
    workflows/
    prompts/
  exports/
    context-packs/
    summaries/
```

存储选择：

- `.coded/` 与 `.claude/` 平级，属于仓库维度的 AI 编码资产目录。
- SQLite 存 Task、Plan、Pipeline、StageRun、VerificationCheck、Evidence、MemoryCandidate 的索引和状态。
- `knowledge/`、`workflows/`、`prompts/` 优先使用 markdown/yaml，方便人工编辑和 code review。
- `runs/` 保存具体运行产物，默认可加入 `.gitignore`，避免提交 transcript、绝对路径或敏感输出。
- `candidates/` 保存 checkpoint stage 提议但尚未确认的知识、流程或 prompt 改进。
- Context Pack 和 final summary 可导出为 markdown。

---

## 9. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 语言 | TypeScript (Node.js) | CLI 生态成熟，类型约束清晰 |
| CLI 框架 | Commander.js | 命令路由稳定 |
| 交互输入 | prompts 或 @inquirer/prompts | 轻量，适合问答式补全 |
| 数据库 | better-sqlite3 | 零配置嵌入式存储 |
| ORM | Drizzle ORM | 类型安全，迁移清晰 |
| LLM SDK | @anthropic-ai/sdk + openai | 支持 Claude / OpenAI 生成摘要和计划 |
| 配置管理 | cosmiconfig | 支持项目和全局配置发现 |
| 测试 | vitest | TypeScript 友好，速度快 |

Ink TUI 不进入 V1。先验证状态机、Context Pack 质量和 checkpoint 流程，再考虑 TUI。

---

## 10. V1 MVP 范围

### 必须做

1. `coded init`
2. 初始化项目根目录 `.coded/`，包含 `config.json`、`knowledge/`、`workflows/`、`prompts/`
3. `coded run "<task>"`，作为 Claude Code / Codex 的统一发起入口
4. 支持 `implement -> verify -> checkpoint` 默认 pipeline
5. 支持为 implement / verify / checkpoint 分别选择 Claude Code 或 Codex
6. 环境允许时直接启动 Agent；不允许时打印等价命令和 prompt
7. Agent-driven `coded verify`，由 Claude/Codex stage 执行验证并输出结构化 evidence
8. Agent-driven `coded checkpoint`，由 Claude/Codex stage 提取 summary、next step、knowledge candidates
9. `coded status` / `coded list`
10. `coded done`，带验证守卫
11. SQLite 存 Task / Pipeline / StageRun / Check / Evidence
12. markdown/yaml 存项目 knowledge、workflow、prompt template
13. 生成 `brief`、`standard`、`review` 三种 Context Pack

### 便宜就做

1. checkpoint 时读取 git changed files
2. Context Pack 的字符数或 token 估算
3. 导出 Context Pack 到 markdown 文件
4. `--quick` 快速任务创建
5. checkpoint stage 提议 workflow / prompt template 改进
6. `.coded/runs/` 自动加入项目 `.gitignore`

### 明确不做

- 自动捕获 Agent transcript
- 向量检索
- Ink TUI
- 多人协作
- VS Code / JetBrains 插件
- 创建 PR
- hooks 集成
- 在没有用户许可的情况下运行危险命令

---

## 11. 质量标准

V1 成功的标准：

1. 用户愿意用 `coded run` 作为发起 Claude Code / Codex 编码任务的默认入口。
2. implement、verify、checkpoint 可以由不同 Agent stage 串联完成。
3. 每个非平凡 Task 都有明确 Verification Contract，并由 verify stage 产出证据。
4. Checkpoint stage 能保留决策、证据、下一步和可复用 knowledge candidates。
5. `.coded/` 能沉淀项目级 workflow、knowledge、prompt，并在后续 run 中被自动召回。
6. 生成的 Context Pack 比粘贴完整历史更短、更有用。
7. CLI 不阻碍用户直接使用 Claude Code / Codex；必要时可以打印 prompt/命令作为 fallback。

---

## 12. 开放问题

1. **Agent launch**：V1 如何稳定发起 Claude Code / Codex？是否需要先支持打印命令，再支持真实 spawn？
2. **Stage handoff**：不同 Agent stage 之间的结构化输出 schema 应该多严格？
3. **Command permission**：verify stage 可以自动运行哪些命令？危险命令如何确认？
4. **`.coded/` versioning**：哪些内容默认进入 git，哪些内容默认加入 `.gitignore`？
5. **Knowledge review UX**：所有 knowledge / workflow / prompt candidate 都要显式确认吗？
6. **Context ranking**：V1 用关键词匹配是否足够，还是应该更早引入 embedding？
7. **Agent-specific templates**：Claude Code 和 Codex 是否需要不同的 stage prompt wording？
