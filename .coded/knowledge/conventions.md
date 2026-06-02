# Conventions

- `SPEC.md` is the product source of truth; `src/` is the V1 implementation.
- The CLI is TypeScript + Node (ESM, NodeNext). Source in `src/`, bundled init
  assets in `assets/`, tests in `tests/` (vitest). Build with `npm run build`.
- Storage is filesystem-based under `.coded/runs/<id>/` (no database in V1).
- Prefer concrete workflows, commands, and data structures over generic agent advice.
- Treat `.coded/knowledge`, `.coded/workflows`, and `.coded/prompts` as reviewable project assets.
- Keep `.coded/runs` out of git because it may contain transcripts, local paths, or sensitive command output.
