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

Claude Code and Kiro receive these skills through project-local adapters at
`.claude/skills` and `.kiro/skills`. Codex, Gemini CLI, OpenCode, and Kilo Code
discover `.agents/skills` directly.
