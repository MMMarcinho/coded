# Project Knowledge

## Product

coded is a task runner and orchestration layer for Claude Code and Codex. It launches coding agents, gives them structured task contracts, delegates implement / verify / checkpoint stages, and stores project-level reusable workflows and knowledge.

## Repository Shape

- `SPEC.md` is the product source of truth.
- `README.md` is currently minimal.
- `.coded/` stores project-level AI coding assets for this repository.

## Current Direction

- `coded run` should become the default entry point for launching Claude Code / Codex.
- Verification and checkpointing should be agent-driven stages, not logic coded performs by itself.
- Project-specific reusable workflows, knowledge, and prompt templates should live under `.coded/`.

## Result-Layer Focus

coded owns the result layer of a long-horizon task, not the development path:

- Task Contract (`.coded/templates/contract.yaml`): goal, context, scope, checkpoints, self-tests, and done criteria. This is the anchor.
- Checkpoint (`.coded/templates/checkpoint.yaml`): compresses a round and runs a drift check against the contract.
- Completion Analysis (`.coded/templates/completion.yaml`): status + recommendation judged against the contract.

How the agent actually explores and implements is deliberately left open — that is Claude Code / Codex's job.
