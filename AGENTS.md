# Repository Instructions

## Scope

These instructions apply only to this repository.

## Required workflow

1. Inspect the relevant existing implementation before editing.
2. Make the smallest change that satisfies the requirement.
3. Add or update tests for behavior changes.
4. Run focused verification first, then the full repository checks.
5. Report anything that could not be verified.

## Repository commands

This is a script-only repository (no install or build step).

- Install: none
- Build: none
- Test: `pwsh -File ./setup-agents.ps1 -DryRun` and `bash ./setup-agents.sh --dry-run`
- Lint: `bash -n ./setup-agents.sh`
- Full verification: run both dry-run commands above; for behavior changes,
  run both scripts twice in a scratch Git repository and confirm the second
  run is idempotent and `git status` stages no `.claude/skills` or
  `.kiro/skills` entries.

## Commit messages

Follow the template in `.gitmessage.txt` at the repository root:

- Format: `<type>(<scope>): <subject>`. The type is a required lowercase
  English keyword from the list in `.gitmessage.txt`
  (feat, fix, style, refactor, chore, add, remove, move, comment, perf,
  test, docs, design, revert). The scope is optional.
- Write the subject and body in Korean. The only exception is the very
  first commit of a repository, which is "Initial commit".
- Subject: at most 50 characters, present tense, no trailing period,
  simple and clear.
- Body (optional): at most 72 characters per line; explain why and for
  what purpose the change was made.
- Footer (optional): issue references such as `resolve: #99`,
  `ref: #122`, `related to: #30, #50`.

## Rules

- Do not modify files outside this repository.
- Do not add production dependencies without explicit approval.
- Do not edit generated files directly.
- Never commit credentials, access tokens, or connection strings.
