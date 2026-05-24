# coded — Spec

## 1. 产品定位

coded 是 Claude / Codex 之上的**长程任务编排层**。

```
┌──────────────────────────────────────┐
│               coded                    │
│  任务追踪 · 上下文持久化 · 知识积累    │
├──────────────────────────────────────┤
│       Claude Code  /  Codex           │
│         实际写代码的 Agent             │
└──────────────────────────────────────┘
```

现有的 Claude Code / Codex 很强，但每次对话像一个"独立片段"。一个跨越几天的任务，你需要：
- 每次重新描述背景
- 自己记住做到了哪一步
- 手动管理上下文
- 重复解释项目结构和偏好

coded 解决的核心问题：**让每次和 Claude/Codex 的对话，都能从上一次无缝继续。**

coded 不做的事：不替代 Claude/Codex 的 Agent 能力（工具调用、代码生成、命令执行）。coded 只做一件事——在正确的时机，给 Claude/Codex 提供正确的上下文。

---

## 2. 核心概念

### 2.1 Task

一个 Task 是用户定义的长期目标。生命周期：

```
created → planned → in_progress → done
                ↘ blocked
                ↘ cancelled
```

每个 Task 拥有：
- 标题和描述
- 执行计划（Plan）
- 所有历史会话的摘要
- 进度追踪
- 关联的文件变更记录

### 2.2 Plan

Task 创建后，coded 会调用 Claude/Codex 生成一个 Plan，将其分解为有序的子任务：

```
Task: "把用户系统从 Session 改成 JWT"
  ├─ 1. 调研现有 Session 逻辑（依赖：无）
  ├─ 2. 实现 JWT 签发与验证工具（依赖：1）
  ├─ 3. 改造登录接口（依赖：2）
  ├─ 4. 改造中间件（依赖：2）
  ├─ 5. 清理旧 Session 代码（依赖：3, 4）
  └─ 6. 更新测试（依赖：5）
```

每个子任务有状态：`pending | in_progress | done | skipped`

Plan 是活文档——执行中可以调整。

### 2.3 Session

一次和 Claude/Codex 的实际对话。

Session 的生命周期：
1. **启动**：coded 组装上下文（Task 状态 + Plan 进度 + 历史摘要 + 项目记忆）→ 写入 prompt 前缀
2. **进行中**：用户正常和 Claude/Codex 对话、写代码
3. **结束**：coded 捕获本次产出 → 调用 Claude/Codex 生成摘要 → 更新 Task 状态

> 关键设计：coded 不应感知 Claude/Codex 的工具调用细节。它只关注"这次会话做了什么、产出了什么、进度如何"。

### 2.4 Context

每次启动 Session 时，coded 组装一段 **Context Prompt**，放在用户的实际指令之前：

```
## Task: 把用户系统从 Session 改成 JWT
## 状态: in_progress
## 进度: 2/6 子任务完成

### 已完成
- ✅ 调研现有 Session 逻辑
- ✅ 实现 JWT 签发与验证工具

### 当前在做的
- 🔄 改造登录接口 (auth/login.ts, auth/session.ts)

### 历史会话摘要
上次会话 (2026-05-23): 完成了 JWT 工具实现，单元测试全部通过。
用户反馈：token 过期时间用配置文件，不要硬编码。

### 项目记忆
- 本项目使用 express + ts，中间件放在 src/middleware/
- 用户偏好：测试用 vitest，不要 jest
- auth 模块依赖 config/auth.ts 中的配置项
```

这段 Context Prompt 是 coded 的核心产物。

### 2.5 Memory

从已完成的 Task 中提取、可跨任务复用的知识：

- **项目结构知识**：目录职责、模块边界、关键文件位置
- **用户偏好**：技术选型偏好、命名风格、代码组织方式
- **经验教训**：特定模块的注意事项、已知的坑

Memory 的来源：
1. 每个 Task 完成后自动提取
2. 用户手动录入 (`coded memory add`)
3. 用户在 Session 中的反馈被捕获

---

## 3. 工作流

### 3.1 开始一个新 Task

```
$ coded new "把 GraphQL API 改成 REST"

1. coded 调用 Claude/Codex：
   "分析以下任务的实施方案，输出一个结构化的执行计划，拆分为子任务，标注依赖关系。"

2. Claude/Codex 返回 Plan → coded 展示给用户

3. 用户确认或调整

4. coded 存储 Task + Plan → 生成第一个 Session 的 Context Prompt → 用户开始和 Claude/Codex 对话
```

### 3.2 继续一个 Task

```
$ coded continue

1. coded 加载 Task 状态、Plan 进度、上一次 Session 摘要、相关 Memory

2. 组装 Context Prompt

3. 用户复制 prompt 到 Claude/Codex，或者 coded 直接启动 Claude Code CLI session

4. 用户继续写代码...
```

### 3.3 结束一个 Session

```
$ coded checkpoint   （或 Session 结束时自动提示）

1. coded 调用 Claude/Codex：
   "以下是本次会话的完整对话记录。请生成一个结构化摘要：
    - 完成了什么？
    - 当前进度如何？（哪些子任务可以标记为 done？哪些还在进行？）
    - 有什么重要的用户反馈或决策？
    - 下一步应该做什么？"

2. coded 更新 Task 状态和 Plan 进度

3. 存储 Session 摘要
```

### 3.4 Task 完成

```
$ coded done

1. 标记 Task 为 done

2. coded 调用 Claude/Codex：
   "这个 Task 已完成。从以下内容中提取可复用的知识点：
    - 关于项目结构的认识
    - 用户的偏好/风格
    - 需要注意的坑"

3. 提取结果写入 Memory Store

4. 展示本次 Task 的统计：耗时、会话数、修改文件数
```

---

## 4. 架构

```
┌─────────────────────────────────────────────────┐
│                    CLI                           │
│          (Commander.js + Ink/React)              │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│   │  Task    │  │  Context  │  │  Memory   │  │
│   │  Manager │  │  Builder  │  │  Store    │  │
│   └──────────┘  └───────────┘  └───────────┘  │
│        │              │              │          │
│   ┌──────────┐  ┌───────────┐  ┌───────────┐  │
│   │  Plan    │  │  Session  │  │  LLM      │  │
│   │  Engine  │  │  Manager  │  │  Client   │  │
│   └──────────┘  └───────────┘  └───────────┘  │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│   ┌──────────────────┐  ┌───────────────────┐  │
│   │     SQLite       │  │   ~/.coded/       │  │
│   │  (Task/Plan/     │  │   (config +       │  │
│   │   Session/Memory)│  │    memories.json) │  │
│   └──────────────────┘  └───────────────────┘  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 4.1 各模块职责

**Task Manager**：任务的 CRUD、状态流转、进度追踪

**Plan Engine**：计划的生成（调 LLM）、更新、子任务状态管理

**Session Manager**：会话的创建和关闭、调用 LLM 生成摘要、存储会话记录

**Context Builder**：组装 Context Prompt——查询 Task 状态 + Plan 进度 + 最近 Session 摘要 + 相关 Memory

**Memory Store**：存储和检索长期记忆。V1 用 JSON 文件 + 关键词匹配；V2 上 embedding + 向量检索

**LLM Client**：封装对 Claude API / OpenAI API 的调用。coded 只需要**轻量**的 LLM 调用（生成 Plan、生成摘要、提取 Memory），不需要 Agent 能力。

**CLI**：Commander.js 处理命令路由，Ink 做交互式 TUI（Plan 调整、状态查看等）

---

## 5. 命令设计

```bash
# Task
coded new "<desc>"             # 创建新任务 + 生成 Plan
coded continue [task-id]       # 继续任务（输出 Context Prompt）
coded list                     # 列出所有任务
coded status [task-id]         # 查看任务详情和进度
coded done [task-id]           # 完成任务 + 提取 Memory

# Plan
coded plan [task-id]           # 查看当前 Plan
coded plan --revise            # 重新生成 Plan（任务范围变了）

# 子任务
coded subtask done <id>        # 手动标记子任务完成
coded subtask skip <id>        # 跳过子任务
coded subtask note <id> "<n>"  # 给子任务加备注

# Session
coded checkpoint               # 结束当前 Session，生成摘要
coded history [task-id]        # 查看任务的所有 Session 历史

# Memory
coded memory list              # 列出所有 Memory
coded memory search "<q>"      # 搜索 Memory
coded memory add "<text>"      # 手动添加 Memory
coded memory forget <id>       # 删除 Memory

# 项目
coded init                     # 在当前目录初始化 coded（创建 .coded/ 目录）
coded config                   # 查看/修改配置
```

---

## 6. 数据模型

```typescript
// ---- Task ----
interface Task {
  id: string;                    // UUID
  title: string;
  description: string;
  status: "created" | "planned" | "in_progress" | "blocked" | "done" | "cancelled";
  currentPlanId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

// ---- Plan ----
interface Plan {
  id: string;
  taskId: string;
  subtasks: Subtask[];
  createdAt: Date;
  updatedAt: Date;
}

interface Subtask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done" | "skipped";
  dependsOn: string[];           // subtask IDs
  notes: string;                 // 用户/Agent 的备注
  order: number;                 // 排序
}

// ---- Session ----
interface Session {
  id: string;
  taskId: string;
  summary: string;               // LLM 生成的摘要
  contextPrompt: string;         // 本次 Session 使用的 Context Prompt
  notes: string;                 // 用户手动备注
  createdAt: Date;
}

// ---- Memory ----
interface Memory {
  id: string;
  type: "project_structure" | "user_preference" | "lesson" | "general";
  content: string;
  sourceTaskId: string | null;
  tags: string[];                // 用于关键词检索
  createdAt: Date;
  accessCount: number;
}

// ---- Project Config (.coded/config.json) ----
interface ProjectConfig {
  name: string;
  language: string;              // typescript | python | go | rust | ...
  framework: string;             // express | nextjs | fastapi | ...
  llm: {
    provider: "claude" | "openai" | "ollama";
    model: string;               // claude-opus-4-7 | gpt-4o | ...
    apiKey: string;              // 或引用环境变量
  };
  conventions: string[];         // 项目编码约定（手动维护或从 Memory 自动汇总）
}
```

---

## 7. Context Prompt 模板

这是 coded 最重要的输出。每次启动 Session 时生成：

```markdown
# Task: {task.title}
**状态**: {task.status}  |  **进度**: {doneCount}/{totalCount} 子任务完成
**描述**: {task.description}

---

## 执行计划

{subtasks formatted as:
  - ✅ 完成的
  - 🔄 进行中的
  - ⏳ 待做的
}

---

## 上次会话摘要
{lastSession.summary}

---

## 项目记忆
{relevantMemories}

---

## 项目约定
{conventions}

---

以下是我的新指令：
```

---

## 8. 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| 语言 | TypeScript (Node.js) | 用户指定 |
| CLI 框架 | Commander.js | 成熟稳定，命令路由清晰 |
| TUI 组件 | Ink (React) | 交互式终端 UI，React 生态 |
| 数据库 | better-sqlite3 | 零配置嵌入式，同步 API 适合 CLI |
| ORM | Drizzle ORM | 类型安全，迁移方便 |
| LLM SDK | @anthropic-ai/sdk + openai | 都支持，按配置切换 |
| 配置管理 | cosmiconfig | 自动查找 .coded/config.json |
| 测试 | vitest | 快，TS 原生支持 |

---

## 9. 文件结构

```
~/.coded/                        # 全局数据目录
  config.json                    # 全局配置（默认 LLM、API key 等）
  memories.json                  # 跨项目的全局 Memory

<project>/.coded/                # 项目级数据目录
  config.json                    # 项目配置
  coded.db                       # SQLite（Task/Plan/Session）
  memories.json                  # 项目 Memory
```

Task/Plan/Session 放 SQLite 因为它们是结构化数据且需要查询。Memory 放 JSON 文件因为它结构简单、人可以打开编辑、V1 不需要向量检索。

---

## 10. V1 MVP 范围

### 要做

1. `coded init` — 初始化项目配置
2. `coded new` — 创建 Task，调用 LLM 生成 Plan
3. `coded continue` — 输出完整的 Context Prompt（打印到终端，用户复制到 Claude/Codex）
4. `coded checkpoint` — 接收用户粘贴的会话记录 / 让用户口述做了什么，调 LLM 生成摘要，更新进度
5. `coded status` / `coded list` — 查看任务状态
6. `coded done` — 标记完成，提取 Memory
7. SQLite 存储 Task/Plan/Session，JSON 文件存储 Memory
8. 支持 Claude API 和 OpenAI API

### 不做

- 直接集成 Claude Code CLI / Codex CLI（V1 靠复制粘贴）
- 向量检索
- Ink TUI 界面
- 多人协作
- VS Code 插件

---

## 11. 开放问题

1. **Session 内容如何录入？** V1 让用户手动粘贴对话记录到 `coded checkpoint` 的体验不好。能否通过 Claude Code 的 `--session` 或 hook 机制自动捕获？或者直接要求用户用 Claude Code 的 `--continue` 配合 coded 的 Context Prompt？

2. **Context Prompt 的粒度？** 每次给 Claude/Codex 的上下文应该多详细？太长了浪费 token（尤其是 Codex 按 token 计费），太短了信息不够。要不要让用户可选"详细模式"和"精简模式"？

3. **Plan 要不要支持并行子任务？** 有些子任务是真的可以并行的（比如"写前端单元测试"和"写后端单元测试"），但 V1 是否需要这种复杂度？

4. **Memory 提取质量怎么保证？** 依赖 LLM 自动提取，但 LLM 可能提取出噪音。要不要加一个人工审核步骤？

5. **coded 本身要不要作为 Claude Code 的 hook/skill 存在？** 而不是一个独立 CLI。比如 `/coded:new`、`/coded:checkpoint` 这样直接在对话中管理任务？
