# Kilo Code / Kiro update

This corrected package includes the Kilo Code and Kiro changes.

## setup-agents.ps1

- Creates project-local `kilo.jsonc`.
- Creates project-local `.kiro/settings/mcp.json`.
- Creates `.kiro/skills` as a Junction or managed copy of `.agents/skills`.
- Reports Kilo Code and Kiro in the supported tool list.

## setup-agents.sh

- Creates project-local `kilo.jsonc`.
- Creates project-local `.kiro/settings/mcp.json`.
- Creates `.kiro/skills` as a symbolic link or managed copy of `.agents/skills`.
- Reports Kilo Code and Kiro in the supported tool list.

No user-home or global agent configuration is written.
