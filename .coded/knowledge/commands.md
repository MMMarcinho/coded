# Commands

Confirmed to work in this repository:

```bash
npm install            # install deps
npm run build          # tsc -> dist/  (also serves as the typecheck)
npm test               # vitest run (unit tests)
npm run dev -- <args>  # run the CLI from source via tsx
git diff --check       # whitespace check for docs/spec changes
```

There is no separate lint step yet.
