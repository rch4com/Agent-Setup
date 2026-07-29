# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The installer bootstrap:

- finds the current Git repository root;
- refuses to write outside that repository;
- creates only project-scoped configuration;
- never writes to user-home or system-wide agent configuration;
- preserves existing configuration files;
- adds a small managed import block to `CLAUDE.md` and `GEMINI.md`;
- exposes `.agents/skills` to Claude Code, Kiro, and Grok Build through
  local adapters;
- adds `chat.useAgentsMdFile` to `.vscode/settings.json` only when the key
  is absent, so VS Code Copilot reads the shared `AGENTS.md`;
- relies on the native support of Kilo Code, Kimi Code, Antigravity, GitHub
  Copilot CLI, and VS Code Copilot for `AGENTS.md` and `.agents/skills`.
