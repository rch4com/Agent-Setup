# Repository-local agent setup

This directory documents files generated or used by the bootstrap scripts.

The installer bootstrap:

- finds the current Git repository root;
- refuses to write outside that repository;
- creates only project-scoped configuration;
- never writes to user-home or system-wide agent configuration;
- preserves existing configuration files;
- adds a small managed import block to `CLAUDE.md`;
- exposes `.agents/skills` to Claude Code through a local adapter;
- relies on the native support of Codex, OpenCode, and Antigravity for
  `AGENTS.md` and `.agents/skills`.
