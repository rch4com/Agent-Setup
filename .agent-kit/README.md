# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The bootstrap scripts:

- find the current Git repository root;
- refuse to write outside that repository;
- create only project-scoped configuration;
- never write to user-home or system-wide agent configuration;
- preserve existing configuration files;
- add a small managed import block to `CLAUDE.md` and `GEMINI.md`;
- expose `.agents/skills` to Claude Code, Kiro, and Grok Build through
  local adapters;
- add `chat.useAgentsMdFile` to `.vscode/settings.json` only when the key
  is absent, so VS Code Copilot reads the shared `AGENTS.md`;
- rely on the native support of Kilo Code, Kimi Code, Antigravity, GitHub
  Copilot CLI, and VS Code Copilot for `AGENTS.md` and `.agents/skills`.
