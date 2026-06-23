# coded

外置的**长程任务状态管理工具**。coded 只做一件事：让长任务有个地方**定义需求 + 跟踪计划**，这样换了会话、上下文被压缩、或人回来接手时，下一棒能立刻知道"到哪了、下一步做什么"。

它不连 LLM、不启动任何 agent、零原生依赖。每个任务就是一个本地 JSON 文件（`.coded/tasks/<id>.json`），`cat` 就能看。

> v1 刻意做小：只有 **task（需求定义）** 和 **step（计划状态）** 两个概念。验证、checkpoint 这些以后再加——现在验证就当成普通 step。

## 安装

```bash
npm install -g coded        # 全局注册 coded 命令，要求 Node >= 18
```

从源码：

```bash
git clone <repo-url> && cd coded
npm install && npm run build && npm link
```

## 用法

```bash
coded start "用户登录错误提示优化"     # 定义一条长任务（首次自动建 .coded/）

# 起一个计划，然后随手更新状态
coded step add "定位错误处理分支"
coded step add "实现明确提示文案"
coded step add "联调验证"
coded step start s-1                  # 开工
coded step done s-1 "改在 api 层透传错误码"
coded step block s-3 "等后端给错误码字典"

# 换了个会话？一条命令接着跑
coded resume                         # 需求 / 计划 / 下一步 / 建议动作

coded list                           # 看所有任务
coded done                           # 关闭当前任务
```

## 命令一览

| 命令 | 作用 |
|------|------|
| `coded start "<需求>"` | 定义一条长任务 |
| `coded step add "<步骤>"` | 加一个计划步骤 |
| `coded step start <id> [note]` | 标记进行中 |
| `coded step done <id> [note]` | 标记完成（note 可记结果） |
| `coded step block <id> [note]` | 标记卡住（note 记原因） |
| `coded resume [task]` | 续跑视图：到哪了 / 下一步 / 建议 |
| `coded list` | 列出所有任务 |
| `coded done [task]` | 关闭任务 |

不带 `[task]` 的命令默认作用于**最近更新的那个任务**；用 `-t/--task <id>` 指定其它任务。

## 给 Coding Agent 的用法

coded 是给 Agent 用的——是**你**在跑长任务时主动用它把状态写下来。约定很简单：

1. **开工前**先 `coded resume --json` 恢复上下文；没有对应任务就 `coded start "<需求>"`。
2. **动手前**用 `coded step add` 把任务拆成步骤。
3. **干活中**状态跟手：开始 `coded step start <id>`，完成 `coded step done <id> "<结果>"`，卡住 `coded step block <id> "<原因>"`。
4. **结束会话前**确认 `coded resume` 里的"下一步"和实际一致，方便下次接力。

所有命令都支持全局 `--json`，方便 Agent 在会话里直接解析状态而不是抓人类文本：

```bash
coded --json resume
coded --json list
```

## 存储

每个任务一个文件：`.coded/tasks/<id>.json`，内含需求、状态、步骤。`.coded/tasks/` 默认进 `.gitignore`（任务状态是本地工作记录，不入库）。想换后端（如以后迁 SQLite）只需替换 `src/store.ts`，命令层不变。
