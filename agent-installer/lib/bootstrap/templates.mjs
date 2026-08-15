// setup-agents.ps1의 here-string 내용을 옮긴 단일 출처.
// 여기만 고치면 모든 OS가 같은 파일을 만든다.

export const AGENTS_TEMPLATE = `# Repository Instructions

## Scope

These instructions apply only to this repository.

## Required workflow

1. Inspect the relevant existing implementation before editing.
2. Make the smallest change that satisfies the requirement.
3. Add or update tests for behavior changes.
4. Run focused verification first, then the full repository checks.
5. Report anything that could not be verified.

## Repository commands

Document the actual commands used by this repository:

- Install:
- Build:
- Test:
- Lint:
- Full verification:

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

- \`npm test\`, \`pytest\`, \`cargo test\`, whatever the project uses. Smallest
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
instead of surfacing as mistakes late.`

export const CLAUDE_BLOCK = `<!-- agent-kit:begin -->
@AGENTS.md
<!-- agent-kit:end -->`

export const GEMINI_BLOCK = `<!-- agent-kit:begin -->
@./AGENTS.md
<!-- agent-kit:end -->`

export const SKILL_README = `# Shared repository skills

Create each shared skill in:

\`.agents/skills/<skill-name>/SKILL.md\`

Use portable Agent Skills frontmatter:

\`\`\`yaml
---
name: example-skill
description: Explain when this skill should be used.
---
\`\`\`

Claude Code, Kiro, and Grok Build receive these skills through project-local
adapters at \`.claude/skills\`, \`.kiro/skills\`, and \`.grok/skills\`. Codex,
Gemini CLI, OpenCode, Kilo Code, Kimi Code, Antigravity, GitHub Copilot CLI,
and VS Code Copilot discover \`.agents/skills\` directly.`

export const EXAMPLE_SKILL = `---
name: repository-check
description: Verify repository changes by reviewing the diff and running the documented build, test, and lint commands. Use before reporting implementation work as complete.
---

# Repository check

1. Read \`AGENTS.md\`.
2. Review the complete working-tree diff.
3. Run the smallest relevant checks first.
4. Run the repository's documented full verification command.
5. Report failures, skipped checks, and remaining risks.`

export const AGENT_KIT_README = `# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The installer bootstrap:

- finds the current Git repository root;
- refuses to write outside that repository;
- creates only project-scoped configuration;
- never writes to user-home or system-wide agent configuration;
- preserves existing configuration files;
- adds a small managed import block to \`CLAUDE.md\` and \`GEMINI.md\`;
- exposes \`.agents/skills\` to Claude Code, Kiro, and Grok Build through
  local adapters;
- adds \`chat.useAgentsMdFile\` to \`.vscode/settings.json\` only when the key
  is absent, so VS Code Copilot reads the shared \`AGENTS.md\`;
- relies on the native support of Kilo Code, Kimi Code, Antigravity, GitHub
  Copilot CLI, and VS Code Copilot for \`AGENTS.md\` and \`.agents/skills\`.`

export const CLAUDE_SETTINGS = `{}`

export const CODEX_CONFIG = `# Repository-local Codex configuration.
# Personal or machine-wide defaults belong outside this repository.
project_doc_max_bytes = 65536`

export const GEMINI_SETTINGS = `{
  "skills": {
    "enabled": true
  },
  "security": {
    "folderTrust": {
      "enabled": true
    },
    "disableAlwaysAllow": true,
    "enablePermanentToolApproval": false
  }
}`

export const GROK_CONFIG = `# Repository-local Grok Build configuration.
# Project scope supports mcp_servers, plugins, and permission rules only.
# Personal or machine-wide defaults belong in ~/.grok/config.toml.
# Grok Build reads the root AGENTS.md natively.`

export const OPENCODE_CONFIG = `{
  "$schema": "https://opencode.ai/config.json"
}`

export const KILO_CONFIG = `{
  // Project-local Kilo Code configuration.
  // Kilo Code automatically loads ./AGENTS.md and ./.agents/skills/.
}`

export const KIRO_MCP_CONFIG = `{
  "mcpServers": {}
}`

export const KIMI_MCP_CONFIG = `{
  "mcpServers": {}
}`

export const COPILOT_MCP_CONFIG = `{
  "mcpServers": {}
}`

// 모델·추론 강도·컨텍스트 티어를 저장소 단위로 고정하는 공유 설정 자리.
// 구체적인 값은 팀이 정한다. 개인 오버라이드는 settings.local.json이며
// .gitignore 대상이다.
export const COPILOT_SETTINGS = `{}`

// VS Code는 최상위 키가 servers다 (Copilot CLI의 mcpServers와 다르다).
export const VSCODE_MCP_CONFIG = `{
  "servers": {}
}`
