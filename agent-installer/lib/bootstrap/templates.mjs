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
- Never commit credentials, access tokens, or connection strings.`

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
Gemini CLI, OpenCode, Kilo Code, Kimi Code, and Antigravity discover
\`.agents/skills\` directly.`

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

- find the current Git repository root;
- refuse to write outside that repository;
- create only project-scoped configuration;
- never write to user-home or system-wide agent configuration;
- preserve existing configuration files;
- add a small managed import block to \`CLAUDE.md\` and \`GEMINI.md\`;
- expose \`.agents/skills\` to Claude Code, Kiro, and Grok Build through
  local adapters;
- rely on the native support of Kilo Code, Kimi Code, and Antigravity for
  \`AGENTS.md\` and \`.agents/skills\`.`

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
