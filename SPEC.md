# coded — Spec

## 1. 产品定位

coded 是 Claude Code / Codex 之上的**长程编码任务编排层**。

```
┌────────────────────────────────────────┐
│                 coded                  │
│ 任务状态 · 上下文包 · 验证证据 · 记忆交接 │
├────────────────────────────────────────┤
│          Claude Code / Codex           │
│        实际探索、写代码、运行工具的 Agent │
└────────────────────────────────────────┘
```

Claude Code / Codex 的 Agent 能力很强，但跨多天、多会话的开发任务仍然容易失去连续性：

- 用户需要反复解释背景、进度和偏好。
- Agent 可能在探索不足时直接实现，解决了错误的问题。
- 上下文窗口被历史细节填满，关键指令反而变弱。
- 任务完成标准常常是隐式的，缺少可运行的验证闭环。
- 会话摘要记录了“做了什么”，但没有保存“凭什么证明它可用”。
- 项目经验和用户偏好没有稳定沉淀到后续任务。

coded 的目标是把长期编码任务变成一份可持续更新的执行契约：

1. **目标**：用户要什么，以及明确不做什么。
2. **计划**：还有哪些步骤，当前正在做哪一步。
3. **上下文包**：让下一次 Agent 会话快速恢复状态的最小必要提示。
4. **验证契约**：Agent 停手前应该运行或确认的检查。
5. **证据**：命令、输出、文件、截图、评审结论等可追溯事实。
6. **记忆**：可跨任务复用的项目知识、工作流和用户偏好。

coded 不替代 Claude Code / Codex 的 Agent 能力，不负责代码生成、工具调用、终端执行或 IDE 集成。coded 只负责在正确时机给 Agent 提供正确的上下文、约束和验证目标。

---

## 2. 设计原则

这些原则来自 Claude Code 推荐的使用方式，并转化为 coded 的产品要求。

### 2.1 先定义验证，再谈完成

每个 Task 都应该尽量定义一个可读的通过/失败信号：

- 单元测试、集成测试、端到端测试
- typecheck、lint、build
- bug 的复现命令
- UI 任务的截图或视觉对比
- 无法自动化时的人工检查清单

coded 必须同时保存“应该如何验证”和“最近一次验证的证据”。Task 只有在必需检查通过，或用户明确豁免并记录原因后，才能标记为 `done`。

### 2.2 探索 → 计划 → 实现 → 验证 → Checkpoint

coded 不应把所有会话都当成“继续写代码”。每次 Session 应该有明确意图：

1. **explore**：查文件、理解流程、定位风险，不预期改代码。
2. **plan**：形成或修订执行计划，补齐依赖和验证方式。
3. **implement**：围绕当前子任务做有限范围的改动。
4. **verify**：运行检查、收集证据、修复失败。
5. **checkpoint**：更新进度、沉淀决策、提取记忆。

很小且明确的改动可以用 `--quick` 跳过完整规划；多文件、风险较高或不熟悉的任务应该走完整循环。

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

Plan、Session 摘要、Memory、Verification Contract 都应该可编辑。用户是意图和事实的最终来源，LLM 只负责生成草稿、提炼候选项和减少手工整理成本。

### 2.6 和现有 Agent 工作流互操作

V1 以复制/粘贴 prompt 的方式工作；后续可以接入 Claude Code / Codex 的能力：

- 命名和恢复会话
- hooks 自动 checkpoint 或验证
- 非交互模式用于批处理和 CI
- 独立上下文的 review / verification 会话
- worktree 并行实验

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
- 相关 Memory
- 变更文件和产物引用

### 3.2 Plan

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

Plan 是活文档。每次修订都要保留版本，Session 需要知道自己基于哪个 Plan version 产生。

### 3.3 Session

Session 是一次真实的 Claude Code / Codex 对话。

Session 生命周期：

1. **Start**：coded 为指定 Task 和会话意图生成 Context Pack。
2. **Work**：用户和 Agent 探索、计划、实现、验证或评审。
3. **Checkpoint**：coded 捕获摘要、证据、决策、变更文件、下一步和 Memory 候选。

Session intent：

```
explore | plan | implement | verify | review | checkpoint
```

关键设计：coded 不依赖 Claude Code / Codex 的内部工具调用细节。它只记录对后续有价值的结果：改了哪些文件、跑了哪些命令、检查是否通过、做了什么决策、还剩什么风险。

### 3.4 Context Pack

Context Pack 是每次 Session 开始前生成的 prompt 产物。

它应该结构化、紧凑、面向行动：

1. Task 目标和当前状态
2. Session intent
3. 范围、非目标和约束
4. 当前 Plan 和 active step
5. Verification Contract
6. 最新证据和已知失败
7. 相关 Memory 和项目约定
8. 最近 Session 摘要
9. 用户新指令占位

Context Pack 模式：

```
brief      只包含关键状态和当前步骤
standard   默认模式，足够恢复任务
full       包含更多历史和决策依据
review     面向新上下文评审，减少实现者偏见
```

### 3.5 Verification Contract

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

### 3.6 Evidence

Evidence 是证明进展或验证结果的紧凑事实：

- 命令和退出码
- 关键输出摘录
- 变更文件列表
- 截图路径
- PR URL
- review 结论
- 用户决策

Evidence 应该独立于摘要存储，避免以后再让 LLM 从长文本中重新推断事实。

### 3.7 Memory

Memory 是跨 Task 复用的知识。

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
4. Context Builder 只召回和当前 Task 相关的 Memory。
5. 过期、矛盾或低价值 Memory 可删除或降权。

---

## 4. 产品工作流

### 4.1 初始化项目

```bash
$ coded init
```

创建 `.coded/`，检测项目基础信息，并询问缺失命令：

- install command
- test command
- typecheck command
- lint command
- build command
- preferred agent: Claude Code / Codex / manual

输出：

- `.coded/config.json`
- `.coded/coded.db`
- 只基于已确认命令生成初始 workflow Memory

### 4.2 创建新 Task

```bash
$ coded new "把用户系统从 Session Cookie 迁移到 JWT"
```

流程：

1. coded 询问或推断目标、范围、非目标、验收标准。
2. 如果代码结构未知，先生成 exploration prompt。
3. 用户在 Claude Code / Codex 中执行 explore Session。
4. coded checkpoint 探索结果。
5. coded 生成或修订 Plan，并补齐验证检查。
6. 用户确认 Plan。
7. Task 进入 `planned` 或 `in_progress`。

小任务可以使用：

```bash
$ coded new "修复登录页 typo" --quick
```

`--quick` 创建一个单步骤 Plan 和简单验证契约。

### 4.3 继续 Task

```bash
$ coded continue [task-id] --intent implement --mode standard
```

流程：

1. 加载 Task、active Plan version、最近 Session 摘要、相关 Memory、最新 Evidence。
2. 选择 active subtask。
3. 生成 Context Pack。
4. V1 打印 prompt，用户复制到 Claude Code / Codex。
5. 后续版本可直接启动或附着到 Agent session。

### 4.4 Checkpoint Session

```bash
$ coded checkpoint [task-id]
```

输入方式：

- 用户粘贴会话摘要
- 用户粘贴 transcript
- 用户手写 notes
- 用户粘贴命令输出
- coded 从 git 读取 changed files

流程：

1. 生成结构化 Session summary。
2. 提取 decisions、blockers、changed files、evidence。
3. 更新 subtask 状态。
4. 更新 verification check 状态。
5. 提议 Memory candidates，等待用户确认。
6. 建议下一次 Session intent。

Checkpoint 摘要格式：

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

### 4.5 验证 Task

```bash
$ coded verify [task-id]
```

V1 打印需要执行的检查，并让用户粘贴结果。后续版本可以在用户许可下直接运行安全命令。

验证会更新：

- check status: `unknown | passed | failed | waived`
- latest evidence
- failure summary
- suggested next intent

### 4.6 完成 Task

```bash
$ coded done [task-id]
```

流程：

1. 确认必需检查已通过，或已有明确 waiver。
2. 标记 Task 为 `done`。
3. 生成 final summary。
4. 提议 Memory candidates。
5. 展示统计：Session 数、耗时、变更文件、检查结果、遗留风险。

### 4.7 Review / Second Opinion

```bash
$ coded continue [task-id] --intent review --mode review
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

# Task
coded new "<desc>" [--quick]
coded list [--status in_progress]
coded status [task-id]
coded continue [task-id] [--intent explore|plan|implement|verify|review] [--mode brief|standard|full|review]
coded done [task-id]
coded cancel [task-id]

# Plan
coded plan [task-id]
coded plan revise [task-id]
coded subtask start <subtask-id>
coded subtask done <subtask-id>
coded subtask block <subtask-id> "<reason>"
coded subtask skip <subtask-id> "<reason>"
coded subtask note <subtask-id> "<note>"

# Session
coded checkpoint [task-id]
coded history [task-id]
coded prompt [task-id] [--mode standard]

# Verification
coded verify [task-id]
coded check add [task-id] "<name>" --cmd "<command>"
coded check pass <check-id> "<evidence>"
coded check fail <check-id> "<evidence>"
coded check waive <check-id> "<reason>"

# Memory
coded memory list
coded memory search "<query>"
coded memory add "<text>" --type workflow --tags repo,test
coded memory accept <candidate-id>
coded memory reject <candidate-id>
coded memory forget <memory-id>
```

---

## 6. 数据模型

```typescript
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
  | "checkpoint";

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

interface ContextPack {
  id: string;
  taskId: string;
  sessionId: string | null;
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
  defaultAgent: "claude-code" | "codex" | "manual";
  commands: {
    install?: string;
    test?: string;
    typecheck?: string;
    lint?: string;
    build?: string;
  };
  context: {
    defaultMode: "brief" | "standard" | "full";
    maxMemories: number;
    maxRecentSessions: number;
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

## Session Intent
{intent}

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

## Recent Session Summary
{last useful summary, decisions, blockers, next step}

## Instructions For This Session
- Follow the session intent.
- Explore before editing when the active step is unclear.
- Keep changes scoped to the active step unless the user redirects.
- Run or request the verification checks before claiming completion.
- At the end, report completed work, evidence, remaining risks, and next step.

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
  memories.json

<project>/.coded/
  config.json
  coded.db
  memories.json
  exports/
    context-packs/
    summaries/
```

存储选择：

- SQLite 存 Task、Plan、Session、VerificationCheck、Evidence、MemoryCandidate。
- V1 用 JSON 存已接受 Memory，方便人工编辑。
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
2. `coded new`
3. `coded continue`
4. `coded checkpoint`
5. `coded status` / `coded list`
6. `coded plan` 和基础 subtask 状态管理
7. `coded verify`，支持人工录入证据
8. `coded done`，带验证守卫
9. SQLite 存 Task / Plan / Session / Check / Evidence
10. JSON 存已接受 Memory
11. 生成 `brief`、`standard`、`review` 三种 Context Pack
12. checkpoint / done 时进行 Memory candidate review

### 便宜就做

1. checkpoint 时读取 git changed files
2. Context Pack 的字符数或 token 估算
3. 导出 Context Pack 到 markdown 文件
4. `--quick` 快速任务创建

### 明确不做

- 直接控制 Claude Code CLI / Codex CLI
- 自动捕获 Agent transcript
- hooks 集成
- 向量检索
- Ink TUI
- 多人协作
- VS Code / JetBrains 插件
- 创建 PR
- 未经用户确认直接运行任意验证命令

---

## 11. 质量标准

V1 成功的标准：

1. 用户可以暂停一个多会话编码任务，并在之后恢复，而不需要手动重建上下文。
2. 生成的 Context Pack 比粘贴完整历史更短、更有用。
3. 每个非平凡 Task 都有明确 Verification Contract。
4. Checkpoint 能保留决策、证据和下一步。
5. Memory 能创造未来价值，而不是污染每次 prompt。
6. CLI 不阻碍用户直接使用 Claude Code / Codex。

---

## 12. 开放问题

1. **Session capture**：V1 是否只依赖手动 checkpoint notes，还是支持从文件导入 transcript？
2. **Command execution**：`coded verify` 在 V1 是否可以运行命令，还是只打印命令并录入用户粘贴的证据？
3. **Memory review UX**：所有 Memory candidate 都要显式确认吗？高置信度 workflow Memory 能否自动接受？
4. **Context ranking**：V1 用关键词匹配是否足够，还是应该更早引入 embedding？
5. **Agent-specific templates**：Claude Code 和 Codex 是否需要不同的 Context Pack wording？
