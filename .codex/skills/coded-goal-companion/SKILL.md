---
name: coded-goal-companion
description: Use coded as a local task ledger while Codex works on long-running coding goals. Trigger when a user asks to start, resume, track, hand off, unblock, or complete a multi-step coding task in a repository that has or should use the `coded` CLI, especially when goal progress needs to survive context compaction or a later session.
---

# Coded Goal Companion

Use `coded` as the goal's external working memory. The goal says what must be achieved; `coded` records the plan, current step, blockers, and completion evidence in `.coded/tasks/*.json`.

## Workflow

1. At the start of a long-running coding task, run `coded --json resume` if a `.coded` store may already exist.
2. If there is no matching task, run `coded start "<requirement>"`.
3. Before coding, create a short plan with `coded step add "<step>"`. Keep steps concrete and outcome-oriented.
4. When starting work on a step, run `coded step start <id>`.
5. When finishing a step, run `coded step done <id> "<result or evidence>"`.
6. When blocked, run `coded step block <id> "<reason and needed unblocker>"`.
7. Before ending or after context compaction, run `coded --json resume` to recover the requirement, plan, next step, and suggestion.
8. Before deciding whether the user-level goal is active, blocked, or complete, run `coded --json resume --goal`.

## Goal Mapping

- Use the coded task requirement as the goal objective.
- Treat coded steps as the goal progress record.
- Treat the next step as the work to continue.
- Treat `coded resume --goal` as the concise goal update source.
- Mark the external goal complete only after `coded done`, unless the user explicitly overrides that.
- Mark the external goal blocked when `coded resume --goal` suggests `blocked` or the current step is blocked.

## Command Patterns

```bash
coded start "修复登录失败时错误提示不准确的问题"
coded step add "阅读登录流程和错误处理代码"
coded step add "定位错误码到提示文案的映射位置"
coded step add "实现文案修复"
coded step add "跑测试并确认行为"

coded step start s-1
coded step done s-1 "登录错误来自 loginErrorToMessage 映射"

coded --json resume
coded --json resume --goal
coded done
```

Keep `coded` updates lightweight and frequent. Do not invent checkpoint, verify, prompt, or selftest commands unless the installed CLI actually exposes them; in v1, validation and checkpoint work should be represented as ordinary steps.
