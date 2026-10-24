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

Claude Code receives these skills through the project-local adapter at
`.claude/skills`. Codex, OpenCode, and Antigravity discover `.agents/skills`
directly.
