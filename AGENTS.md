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

Bootstrap logic lives in `agent-installer`; the shell scripts are launchers.

- Install: none for bootstrap (Node standard library only).
  `npm install --prefix agent-installer` for the interactive menu.
- Build: none
- Test: `cd agent-installer && npm test`
- Lint: `bash -n ./setup-agents.sh`
- Full verification: run `cd agent-installer && npm test`, then smoke-test both
  launchers with `bash ./setup-agents.sh --dry-run` and
  `pwsh -File ./setup-agents.ps1 -DryRun`. For behavior changes, run both
  launchers twice in a scratch Git repository and confirm the second run is
  idempotent and `git status` stages no `.claude/skills`, `.kiro/skills`, or
  `.grok/skills` entries. Also confirm `git status` *does* stage
  `.vscode/mcp.json` and `.vscode/settings.json` — both depend on gitignore
  negation entries, so a missing one fails silently.

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

## Behavioral guidelines

Behavioral guidelines to reduce common LLM coding mistakes.

**Scope:** Only what current models still get wrong. If the model or the
harness already handles something reliably, it doesn't belong here - a rule
that restates default behavior burns context and buys nothing.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial
tasks, use judgment.

### 1. State Assumptions, Then Proceed

**Say what you assumed. Keep going. Default the rest.**

Before implementing:

- State your assumptions in one line, then start.
- If multiple interpretations exist, pick the likeliest and say which one you
  picked.
- If a simpler approach exists, say so while doing the work - not as a question
  that blocks it.
- Ask only when the answer changes what gets built, not how well, and the wrong
  choice can't be cheaply undone.

A stated assumption gets corrected in seconds. A question costs a round-trip
and hands the work back to the user. If you're about to ask a second question
in one task, you're doing it wrong.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes,
simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Verify Before Done

**If you touched code, run the check before saying "done" - and report what
actually ran.**

- `npm test`, `pytest`, `cargo test`, whatever the project uses. Smallest
  relevant check first, broader checks when risk is high.
- No test setup? At minimum, verify the project builds or typechecks.
- Report the exact command and its result: "passed", "failed with X", or "not
  run because Y".
- Never write "done", "fixed", or "works" unless a concrete check backs it.
- Run it proactively, before the user signals "끝", "완료", "다 됐어".

This is the step LLMs skip most often. Treat it as non-negotiable.

### 5. Teach One Thing On The Way Out

**End with what the user would want to know next time. Two or three
sentences.**

When the work is done:

- Name the one concept, tradeoff, or gotcha that actually mattered here.
- Teach what the code doesn't show: why this way over the obvious one, which
  default you leaned on, what breaks first at scale.
- If it needs a heading, it's too long. If it restates the diff, delete it.
- Skip it when the change is trivial, or when the user is the one who taught
  you the thing.

Why: an agent that only ships code leaves the user unable to maintain it. They
should finish each task slightly more able to do it without you.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer
rewrites due to overcomplication, and stated assumptions get corrected early
instead of surfacing as mistakes late.
