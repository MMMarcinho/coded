# coded

让 Claude Code 管理长程任务状态的工具。coded 不替代 CC，而是让 CC 在执行长任务时有个地方记录进度、checkpoint、自测结果，没跑完的下次能接着跑。

## 安装

```bash
npm install -g coded
```

安装后会在全局注册 `coded` 命令。要求 Node >= 18。

### 从源码安装

```bash
git clone <repo-url>
cd coded
npm install
npm run build
npm link
```

## 用法

```bash
coded init                              # 在当前仓库创建 .coded/
coded loop "用户登录错误提示优化"         # 创建一条 loop（标题就是需求）
coded prompt --stage implement          # 组装上下文，启动 CC
```

CC 干活的中间，可以随时记录状态：

```bash
coded selftest add "密码错误展示正确提示"           # 加一条自测
coded selftest pass st-1 "手动验证通过"             # 标记通过
coded checkpoint --record agent-output.yaml        # 记录 CC 输出的 checkpoint
```

完成后收尾：

```bash
coded verify                             # 自动跑命令型自测 + 唤 CC 确认其余
coded done                               # 必测全过才放行（--force 可强制）
```

## 查看

```bash
coded list                               # 列出所有 loop
coded status                             # 查看最近一条 loop 的详情
coded doctor                             # 检查环境
```

## 怎么工作的

coded 在 `.coded/runs/<id>/` 下维护两个文件：

- `loop.json` — 元数据（标题、状态、事件历史）
- `contract.yaml` — 契约（需求、范围、checkpoint、自测、完成标准）

每次 `coded prompt` 把这些拼成一份 Context Pack 丢给 CC。CC 跑完了用户用 `coded selftest`、`coded checkpoint`、`coded done` 把结果写回契约。下次唤 CC 时它看到的契约就是最新的。

coded 不接任何 LLM，不做自动化流水线，就是状态文件和拼 prompt。
