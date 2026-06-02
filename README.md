# coded

coded 是一个用来发起一次 coding 长程任务的伙伴。

它帮助用户把一次研发任务从“我要改点代码”整理成一段可持续推进、可 checkpoint、可自测、可判断完成度的工作流。coded 本身不替代 Claude Code、Codex 或其他编码 Agent；它更像是任务发起前后的协作外壳，帮助用户把任务说清楚、把过程留痕、把结果验明白。

## 核心定位

coded 关注一次研发任务的完整生命周期：

1. **发起任务**：帮助用户描述目标、范围、背景、限制和期望结果。
2. **补全任务信息**：引导用户补充需求细节、相关文件、风险点和验收标准。
3. **设置 checkpoint**：让用户在长程任务中定义中途检查点，避免做到一半失焦。
4. **定义自测用例**：让用户提前写下“我怎么知道这次改动是对的”。
5. **完成后分析**：在任务结束时对照目标、checkpoint 和自测用例，分析当前研发任务是否已经完成。

换句话说，coded 不是单纯的 task list，也不是另一个代码生成器。它是一次 coding 长程任务的任务契约、过程记录和完成度判断工具。

## 当前版本

当前阶段，coded 的关键内容主要由用户手动完成：

- 用户手动补全任务描述、背景和范围。
- 用户手动提出 checkpoint。
- 用户手动提供自测用例或验收方式。
- 用户手动记录阶段性进展。
- coded 根据这些信息组织任务上下文，并在最后帮助分析任务是否完成。

这个阶段的设计目标是先把“什么是一段好的研发任务上下文”打磨清楚，而不是过早自动化。

## 未来方向

未来 coded 会支持接入 LLM provider，让 LLM 帮助用户完成更多任务补全工作：

- 根据用户的一句话任务，补充更完整的任务说明。
- 根据仓库知识，建议可能需要关注的模块和文件。
- 自动提出合理的 checkpoint。
- 自动生成自测用例、验收标准和验证命令。
- 在任务完成后，基于 diff、测试结果和用户记录，分析任务是否真的完成。
- 沉淀项目级经验，复用到下一次类似研发任务。

LLM provider 的角色不是替用户做决定，而是给用户一份更好的草稿，让用户确认、修改和推进。

## 项目级知识

coded 会在仓库根目录维护一个 `.coded/` 目录，用来保存和当前项目相关的可复用信息，例如：

- 项目知识：目录结构、关键模块、常见坑。
- 工作流：常见研发任务应该经历哪些阶段。
- Prompt 模板：发起任务、checkpoint、自测、完成分析时的提示模板。
- 运行记录：一次长程任务中的阶段输出和证据。

这些信息让 coded 不只是一次性的 prompt 工具，而是会随着项目使用逐渐变懂这个仓库。

## 一次任务的理想形态

一次 coded 任务不是一句 prompt，而是一份可以被持续推进的任务单。

```yaml
task:
  goal:
  context:
  scope:
  checkpoints:
  self_tests:
  done_criteria:
  completion_analysis:
```

### 1. 任务目标

任务目标回答“这次到底要完成什么”。

它应该包含：

- 用户想达成的结果
- 用户可感知的变化
- 这次任务的产物
- 成功后的外部表现

示例：

```yaml
goal:
  summary: 登录失败时展示更明确的错误提示
  user_visible_result:
    - 密码错误时提示“账号或密码错误”
    - 网络错误时提示“网络异常，请稍后重试”
  deliverables:
    - 修改登录页错误处理
    - 增加登录失败自测用例
```

### 2. 背景上下文

背景上下文回答“为什么做、在哪里做、有什么历史包袱”。

它应该包含：

- 任务来源：bug、需求、体验问题、技术债
- 当前现象
- 相关页面、接口、模块、文件
- 已知约束和历史决策

示例：

```yaml
context:
  reason: 用户反馈登录失败提示太笼统
  current_behavior: 所有失败都显示“登录失败”
  related_files:
    - src/pages/login
    - src/api/auth
  known_constraints:
    - 不改后端错误码
    - 不调整登录流程
```

### 3. 范围和非目标

范围回答“做什么”，非目标回答“明确不做什么”。长程任务很容易发散，这一层用来防止 Agent 顺手改过头。

示例：

```yaml
scope:
  in:
    - 登录页错误展示
    - auth API 错误映射
    - 登录失败自测用例
  out:
    - 不改注册页
    - 不改后端错误码
    - 不重构整个 auth 模块
```

### 4. Checkpoint

checkpoint 不是普通进度总结，而是在关键不确定性节点停下来确认方向。

常见 checkpoint：

- 方案确认：改代码前确认方向
- 核心实现完成：确认关键逻辑是否符合目标
- 集成前检查：确认依赖、配置、接口是否接上
- 提交前检查：确认没有超范围改动

示例：

```yaml
checkpoints:
  - name: 方案确认
    when: 修改代码前
    questions:
      - 错误码到文案的映射是否清楚？
      - 是否需要后端配合？
  - name: 提交前检查
    when: 准备结束任务前
    questions:
      - 自测用例是否全部通过？
      - 是否有超出 scope 的改动？
```

### 5. 自测用例

自测用例回答“怎么知道这次改动是对的”。它可以是手动验证，也可以映射到自动化测试。

每条自测用例应该包含：

- 场景
- 前置条件
- 操作步骤
- 期望结果
- 验证方式
- 是否必需

示例：

```yaml
self_tests:
  - name: 密码错误提示
    type: manual
    required: true
    steps:
      - 打开登录页
      - 输入正确账号和错误密码
      - 点击登录
    expected:
      - 页面显示“账号或密码错误”
      - 不跳转首页
```

### 6. 完成标准

完成标准比自测用例更高一层，用来判断任务是否可以结束。

示例：

```yaml
done_criteria:
  required:
    - 所有 required self_tests 通过
    - 没有修改 out-of-scope 模块
    - 登录成功流程不回归
  requires_user_confirmation:
    - 最终错误文案是否符合产品口径
```

### 7. 完成分析

完成分析是 coded 在任务结束时应该生成的判断，不只是“完成了”。

示例：

```yaml
completion_analysis:
  status: done | partially_done | not_done | blocked
  completed:
    - 密码错误和网络错误已分开展示
  failed_or_missing:
    - 未补自动化测试
  evidence:
    - 手动验证两个错误场景通过
  risks:
    - 后端新增错误码时仍会落到未知错误
  recommendation: 可以结束，但建议后续补错误映射测试
```

当这些内容足够清楚时，Claude Code、Codex 或其他 Agent 才更容易稳定地完成长程研发任务。coded 的产品核心就是持续追问三个问题：你要做什么，中途怎么知道没有跑偏，最后怎么知道真的做完了。

## 初版 CLI

仓库现在带有一个可运行的初版 CLI（TypeScript + Node）。它专注于结果层：把任务整理成契约、生成可丢给 Agent 的 prompt、记录 checkpoint 和完成度。它**不**规定研发路径，也不自动改你的代码——实际开发仍由 Claude Code / Codex 完成。

```bash
npm install
npm run build      # 编译到 dist/
npm test           # 运行 vitest

# 在任意仓库里使用（用 node 直接跑，或 npm link 成全局 coded 命令）
node /path/to/coded/dist/index.js <command>
```

最轻路径 **零 yaml 编辑** 就能跑（标题即目标）：

```bash
coded init                                  # 在当前仓库创建 .coded/（一次性）
coded new "用户个人信息完善：增加头像、住址"   # 标题自动预填 goal，任务即可运行
coded prompt --stage implement              # 组装 Context Pack 并启动 claude（缺失则打印 prompt）

# 加自测和更新状态都用一行命令，不用搬文件、不用编辑 yaml
coded selftest add "上传头像并预览"
coded selftest add "详细地址必填校验" --type unit --cmd "npm test -- profile"
coded verify --agent claude-code            # 无感自测：见下
coded done                                  # 必测全过才放行（未过会列出待办；--force 可强制）
```

### 无感自测：`coded verify`

编码完成后，不用你逐条手动验。`coded verify` 会**主动唤起 agent 去确认**你定义的自测用例和 checkpoint，再把结果自动写回契约：

- **Phase 1（coded 直接跑）**：带 `--cmd` 的自测，coded 直接执行命令，按退出码自动判 pass/fail 并记录证据。
- **Phase 2（唤起 agent）**：manual / 截图 / 需判断的自测，coded 组装确认 prompt，**headless 调用 `claude -p`**，解析它返回的结构化结果，自动回写每条 self-test 和 checkpoint 的状态。

```bash
coded verify                    # 默认 headless 唤起 verify agent，解析回写
coded verify --interactive      # 改为交互式进入 agent 确认
coded verify --print            # 只打印确认 prompt，不唤起
```

这样用户只需在契约里写清"怎么算对"，剩下的确认由 coded + agent 自动完成。

想做更细的任务时，按需补充（全部可选）：

```bash
# 编辑 .coded/runs/<id>/contract.yaml 补 scope.in/out、checkpoints、doneCriteria
coded status                                # 契约、self-test 计分（如 3/4 passed）、最近 drift
coded list
coded checkpoint                            # 生成 checkpoint prompt；或 --record cp.yaml 存快照
coded complete                              # 生成完成度分析 prompt；或 --record done.yaml
```

设计取舍（初版，刻意「轻」）：

- **只有 goal 是必须的**，scope / checkpoints / selfTests / doneCriteria 全可选，按需加。
- **状态一行命令回写契约**（`coded selftest pass st-1`），`--record` 文件只是可选高级用法。
- **checkpoint / verify / complete 是可选助手**，不是强制流水线；最小闭环就是 `new → prompt → selftest → done`。
- **存储用文件系统**，不用数据库：`.coded/runs/<id>/` 下的 yaml 人可读、可 diff、可 review。
- **发起优先启动 Agent**：检测到 `claude` / `codex` 且在终端里时直接启动，否则回退打印 prompt 和等价命令。
- **不接 LLM**：契约由用户填，coded 负责组织上下文、校验、生成 prompt、记录结果。
