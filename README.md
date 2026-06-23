# coded

外置的**长程任务状态管理工具**。coded 不替代 Coding Agent（Claude Code / Codex 等），也不去启动它们——它只是一个状态存储：让 Agent 在跑长任务时有个地方记进度、记计划、记自测结果，**没跑完的下次换个会话能接着跑**。

设计原则：coded 只管状态，不碰编排。它不连 LLM、不 spawn 任何进程、不做流水线——就是状态文件 + 一组随手读写的命令，外加给 Agent 直接消费的机器可读输出（`--json`）。

## 安装

```bash
npm install -g coded     # 全局注册 coded 命令，要求 Node >= 18
```

从源码：

```bash
git clone <repo-url> && cd coded
npm install && npm run build && npm link
```

## 核心模型

每条任务是一个 **loop**，状态存在 `.coded/runs/<id>/` 下：

- `loop.json` — 元数据（标题、生命周期状态、事件时间线，含 notes）
- `contract.yaml` — 契约：需求、范围、**计划步骤(steps)**、自测(selfTests)、checkpoint、完成标准

三种状态各司其职：

| 概念 | 回答的问题 | 命令 |
|------|-----------|------|
| **steps** | 进行到哪了 / 下一步做什么 | `coded step …` |
| **selfTests** | 改对了没有 | `coded selftest …` / `coded verify` |
| **checkpoints** | 要不要停下来对一下方向 | `coded checkpoint …` |
| **notes** | 做过哪些关键决策 | `coded note …` |

## 典型用法

```bash
coded init                              # 在当前仓库创建 .coded/
coded loop "用户登录错误提示优化"          # 新建一条 loop（标题即需求）

# 起一个计划
coded step add "定位错误处理分支"
coded step add "实现明确提示文案"
coded step start s-1                     # 开工
coded note "根因是 catch 吞掉了后端错误码"  # 随手记决策
coded step done s-1 "改在 api 层透传错误码"

# 换了个会话？一条命令接着跑：
coded resume                             # 目标 / 计划 / 下一步 / 待过自测 / 最近决策 / 建议动作
coded context                            # 把完整上下文打印出来喂给当前会话

# 收尾
coded selftest add "登录失败展示后端文案" --type command --cmd "npm test"
coded verify                             # 跑命令型自测，列出还需人工确认的
coded selftest pass st-1 "手动验证通过"
coded done                               # 必测全过才放行（--force 可强制）
```

## 续跑：resume 与 context

长任务最贵的是"换会话后重新搞清楚到哪了"。coded 把这件事压成一条命令：

```bash
coded resume        # 给人看：一眼看清进度、卡点、下一步
coded resume --json # 给 Agent 看：直接解析 next step / blocking / notes
coded context       # 打印完整上下文块（需求+范围+计划+自测+项目知识），供会话内 Agent 加载
```

`coded context` 只**打印**，永远不启动任何东西——粘贴或管道喂给你的 Agent 即可。

## 机器可读输出

任何读命令都支持全局 `--json`，方便 Agent 在会话里直接解析状态而不是抓人类文本：

```bash
coded --json resume
coded --json status
coded --json list
coded --json verify
```

## 查看与诊断

```bash
coded list                # 列出所有 loop
coded status              # 某条 loop 的完整详情（计划/自测/checkpoint/notes）
coded step list           # 只看计划
coded doctor              # 检查 .coded、config、每条 loop 的契约是否可解析
```

## 命令一览

| 命令 | 作用 |
|------|------|
| `init` | 创建 `.coded/` 脚手架 |
| `loop [title]` | 新建 loop（省略 title 进入交互向导） |
| `step add/start/done/block/list` | 管理计划步骤 |
| `note <text>` | 记一条决策/发现到时间线 |
| `resume [loop]` | 续跑视图：到哪了 / 下一步 / 建议动作 |
| `context [loop] --stage` | 打印完整上下文供会话消费 |
| `status [loop]` | loop 详情 |
| `list` | 列出所有 loop |
| `selftest add/pass/fail/skip` | 管理验收自测 |
| `verify [loop]` | 跑命令型自测 + 列出待人工确认项 |
| `checkpoint / complete [--record]` | 打印阶段上下文，或记录快照 |
| `done [loop] [--force]` | 必测全过后收尾 |
| `doctor` | 检查状态存储健康度 |

`.coded/runs/` 默认进 `.gitignore`——任务状态是本地的工作记录，不入库。
