# Shared repository skills

Create each shared skill in:

`.agents/skills/<skill-name>/SKILL.md`

Use portable Agent Skills frontmatter:

```yaml
---
name: example-skill
description: Explain when this skill should be used.
---
```

Claude Code, Kiro, and Grok Build receive these skills through project-local
adapters at `.claude/skills`, `.kiro/skills`, and `.grok/skills`. Codex,
Gemini CLI, OpenCode, Kilo Code, Kimi Code, and Antigravity discover
`.agents/skills` directly.
