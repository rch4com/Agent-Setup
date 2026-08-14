# Repository-local AI agent bootstrap

**English** · [한국어](AgentSetup-README.ko.md) · [Changelog](AgentSetup-README-CHANGES.md)

A script that initializes shared instructions and shared Agent Skills
**within repository scope only**, so that Claude Code, Codex, Gemini CLI,
OpenCode, Kilo Code, Kiro, Kimi Code, Grok Build (xAI grok CLI), Antigravity
(Google agent IDE/CLI), GitHub Copilot CLI, and VS Code Copilot can all be
used together in one repository.

## Generated structure

```text
repository/
├─ AGENTS.md
├─ CLAUDE.md
├─ GEMINI.md
├─ opencode.jsonc
├─ kilo.jsonc
├─ .agents/
│  └─ skills/
│     └─ repository-check/
│        └─ SKILL.md
├─ .claude/
│  ├─ settings.json
│  └─ skills/          # link to .agents/skills, or a managed copy
├─ .codex/
│  └─ config.toml
├─ .gemini/
│  └─ settings.json
├─ .github/
│  ├─ mcp.json
│  └─ copilot/
│     └─ settings.json
├─ .grok/
│  ├─ config.toml
│  └─ skills/          # link to .agents/skills, or a managed copy
├─ .kiro/
│  ├─ skills/          # link to .agents/skills, or a managed copy
│  └─ settings/
│     └─ mcp.json
├─ .kimi-code/
│  └─ mcp.json
├─ .vscode/
│  ├─ mcp.json
│  └─ settings.json      # only the chat.useAgentsMdFile key is ensured
└─ .agent-kit/
   └─ README.md
```

## How each tool is wired

- **Claude Code:** `CLAUDE.md` imports `AGENTS.md`, and `.claude/skills` is
  linked to `.agents/skills`.
- **Codex:** uses the root `AGENTS.md` and `.agents/skills`.
- **Gemini CLI:** `GEMINI.md` imports `AGENTS.md`, and it uses
  `.agents/skills`.
- **OpenCode:** uses the root `AGENTS.md`, `.agents/skills`, and
  `opencode.jsonc`.
- **Kilo Code:** reads the root `AGENTS.md` and `.agents/skills` directly, and a
  project-local `kilo.jsonc` is created. Its project MCP file lives at a separate
  path, `.kilocode/mcp.json`, which is created by the installer when an MCP item
  is registered — not by the bootstrap.
- **Kiro:** reads the root `AGENTS.md` directly, and `.kiro/skills` is linked to
  `.agents/skills`. The project MCP file is created only at
  `.kiro/settings/mcp.json`.
- **Kimi Code:** reads the root `AGENTS.md` and `.agents/skills` directly. Its
  project MCP file is created at `.kimi-code/mcp.json`, and the machine-specific
  `.kimi-code/local.toml` is added to `.gitignore`.
- **Grok Build (xAI grok CLI):** reads the root `AGENTS.md` directly (including
  the commit message convention — no import wiring needed). Project settings and
  MCP live in `.grok/config.toml` (`[mcp_servers.<name>]` tables), and because
  its project skill lookup path is `.grok/skills`, that path is linked to
  `.agents/skills`. Plugins are loaded from `.grok/plugins/`.
- **Antigravity (Google agent IDE/CLI):** natively recognizes the root
  `AGENTS.md` and the `.agents/` directory, so it uses `AGENTS.md` and
  `.agents/skills` as-is (no import wiring, no adapter, no new files). MCP is
  configured only in the home-global location
  (`~/.gemini/config/mcp_config.json`); there is no project-scope MCP file, so it
  falls outside what this script manages.
- **GitHub Copilot CLI:** reads the root `AGENTS.md` and `.agents/skills`
  natively (no import wiring, no adapter). Project MCP is registered in
  `.github/mcp.json`, and `.github/copilot/settings.json` is created as the place
  for team-shared settings. The personal override
  `.github/copilot/settings.local.json` is added to `.gitignore`. Copilot CLI
  reads both `.github/mcp.json` and the root `.mcp.json` (the file Claude Code
  uses); when the same server name appears in both, `.mcp.json` wins. Remote
  (HTTP) servers are identical in both files (`type: "http"`), but **stdio
  servers differ in format** — `.mcp.json` records Claude Code's `type: "stdio"`
  while `.github/mcp.json` records Copilot's `type: "local"`. Because of the
  precedence, what Copilot CLI actually sees is the `.mcp.json` entry, so if an
  stdio MCP (`mcp.codebase-memory`) fails to connect in Copilot CLI, change that
  entry in `.mcp.json` to `type: "local"` or delete it and keep only
  `.github/mcp.json`.
- **VS Code Copilot:** reads `.agents/skills` natively, and the root `AGENTS.md`
  is enabled through the `chat.useAgentsMdFile` key in `.vscode/settings.json`
  (added only when the key is absent; an existing value is preserved). Project
  MCP is `.vscode/mcp.json`, whose top-level key is `servers` — a different
  format from Copilot CLI.

## Running the bootstrap

The shortest path is npx. You do not need to copy any file from this repository.

```bash
npx @rch4com/agent-setup bootstrap
npx @rch4com/agent-setup bootstrap --dry-run
npx @rch4com/agent-setup bootstrap --help
```

The package name is the scoped `@rch4com/agent-setup` only. The unscoped
`agent-setup` runs into npm's similar-name restriction — normalized, it collides
with the existing package `agentsetup`, and publishing is rejected with a 403.
The `bin` name is `agent-setup`, so the typing only gets longer when invoking it
directly through npx.

Keeping the launchers (`./setup-agents.sh`, `pwsh -File ./setup-agents.ps1`) in
the repository still works too — use that in offline environments, or when your
team prefers a committed entry point. Both launchers are thin runners with no
logic of their own; all bootstrap logic lives in
`agent-installer/lib/bootstrap/`. To add a new tool, add an entry to
`agent-installer/lib/bootstrap/manifest.mjs`, and if it needs a tool-specific
config file, add a template to `agent-installer/lib/bootstrap/templates.mjs`.

The interactive screen is enabled with `--tui` (Linux) / `-Tui` (Windows), and
**only then** does `npm install --prefix agent-installer` run first internally
(it passes through immediately if dependencies are already installed). `--menu` /
`-Menu` are the old names and still work. Every other invocation (the default
bootstrap, `-DryRun`, `-Help`, and so on) runs on the Node.js standard library
alone and needs no `npm install`.

`--skill-mode` / `-SkillMode` is also passed through to the interactive screen,
so the `Run bootstrap` action inside the screen uses the same linking mode.

The bootstrap does synchronous file work, so instead of a progress bar each log
line is prefixed with a step number like `[3/39]` — the screen cannot be
redrawn while the work blocks the event loop.

`--lang` / `-Lang` is passed through the same way and decides the display
language for this run (`en`|`ko`). If unspecified it follows the OS language, and
falls back to English for unsupported ones. You can also change it on the first
row (Language) of the interactive screen with `Enter`; the chosen language is
saved to `.agent-kit/agent-setup.json` and carries over to the next run. The
`AGENT_SETUP_LANG` environment variable works at the same precedence.

You can also call it directly, without going through the installer.

```bash
node agent-installer/install.mjs bootstrap --dry-run
node agent-installer/install.mjs bootstrap --help
```

## Keeping up to date

```bash
npx @rch4com/agent-setup@latest update             # managed files to the newest templates
npx @rch4com/agent-setup@latest update --dry-run   # just show what would change
npx @rch4com/agent-setup@latest status             # intent / reality / version
```

`update` changes **only files that are still exactly as this tool wrote them**.
The decision is based on the per-file hashes stored in the install record.

| Situation | What happens |
|---|---|
| Matches the recorded hash | Replaced with the new template |
| Hash differs | You edited it → **left alone**, reported as drift |
| File missing | Created (this is how support for new tools arrives) |
| No hash in the record | Origin unknown → left alone |

The managed blocks in `CLAUDE.md` and `GEMINI.md` are replaced only between the
markers (`<!-- agent-kit:begin -->`), so anything you wrote around them survives.

Use `update --force` to take in drifted files too. Since git is the only way to
undo it, it works **only when the working tree is clean**.

Hashes are computed over content normalized to LF line endings — a CRLF checkout
on Windows is not misjudged as drift.

### Adopting a repository that already uses this

Repositories that vendored the installer have no record.

```bash
npx @rch4com/agent-setup bootstrap --adopt
```

This creates no files, only the record. It adopts **only files identical to this
version's template** — stamping a hash onto a file you had already customized
would let the next `update` erase your changes. Unadopted files show up in
`status` and can be pulled in later with `update --force`.

## Safety principles

The rules below are what the **bootstrap** (`setup-agents.sh` / `.ps1`) upholds.
The extent to which the optional-item installer uses the network and external
commands is described separately in
[What the installer runs](#what-the-installer-runs).

- Runs only inside a Git repository.
- Finds the repository root with `git rev-parse --show-toplevel`.
- Refuses to write to any path outside the repository root.
- Never reads or modifies global configuration in your home directory.
- Never overwrites existing configuration files.
- Adds the managed block to `CLAUDE.md` and `GEMINI.md` only when it is absent.
- Preserves existing `.claude/skills`, `.kiro/skills`, and `.grok/skills` when
  they are user-managed paths.
- Adds `.claude/skills`, `.kiro/skills`, and `.grok/skills` to `.gitignore` so
  the adapters (links/copies) are not committed.
- Adds the machine-specific `.kimi-code/local.toml` to `.gitignore` as well.
- Adds the personal `.github/copilot/settings.local.json` to `.gitignore` as well.
- Adds the negation entries `!.vscode/mcp.json` and `!.vscode/settings.json` so
  that both files are committed even in a `.gitignore` that ignores `.vscode/*`.
  If `settings.json` is ignored, adding `chat.useAgentsMdFile` never reaches the
  team.
- Adds the `chat.useAgentsMdFile` key to `.vscode/settings.json` **only when it
  is absent**, leaving existing keys, comments, and values untouched.
- Safe to run repeatedly.

## What the installer runs

Unlike the bootstrap, the optional-item installer uses the network and runs
external commands. This is written down so you can know in advance what gets run
when you pick something.

| Item | What runs |
|---|---|
| `plugin.*` | `claude plugin marketplace add <repo>` + `claude plugin install`. If the `claude` command is missing, it only records into `.claude/settings.json` and the download happens on the next Claude Code run |
| `skill.gsd` | `npx -y @opengsd/gsd-core@latest` — downloads and runs the latest version with no confirmation prompt (`-y`) |
| `skill.gstack` | Shallow-clones the default branch of `github.com/garrytan/gstack` and then runs `bash ./setup` inside the repository. It does not pin a commit or verify integrity |
| `config.gitmessage.*` | `git config --local commit.template .gitmessage.txt` — touches only the repository's `.git/config` (no network). Global and system settings are neither read nor written |
| design.md | Downloads `DESIGN.md` from `raw.githubusercontent.com` (a document file; it is not executed). If it exists in the bundled cache, no network is used |

- Make sure you trust the target repository/package before picking an item. All
  three of those items run third-party code inside this repository.
- Network calls have a 20-second time limit and an 8 MiB response body cap (a
  response that keeps streaming would never hit a time limit, so size is capped
  too).
- Adding `--dry-run` prints only what would be run/recorded and changes nothing.
- MCP items record only URLs and commands into config files. Authentication
  (OAuth) happens the first time you use each CLI, and tokens are not stored in
  this repository.

## Windows

Place these files anywhere in the repository and run them from PowerShell.

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-agents.ps1
```

PowerShell 7:

```powershell
pwsh -File .\setup-agents.ps1
```

Skill adapter mode for Claude, Kiro, and Grok Build:

```powershell
# Junction first, fall back to copying
pwsh -File .\setup-agents.ps1 -SkillMode Auto

# Junction only
pwsh -File .\setup-agents.ps1 -SkillMode Link

# Copy only
pwsh -File .\setup-agents.ps1 -SkillMode Copy
```

Choosing the display language (defaults to the OS language, English if
unsupported):

```powershell
pwsh -File .\setup-agents.ps1 -Lang en
pwsh -File .\setup-agents.ps1 -Lang ko
```

Check without making actual changes:

```powershell
pwsh -File .\setup-agents.ps1 -DryRun
```

Check usage (creates no files):

```powershell
pwsh -File .\setup-agents.ps1 -Help   # -h works as a short form
```

## Linux

```bash
chmod +x ./setup-agents.sh
./setup-agents.sh
```

Skill adapter mode for Claude, Kiro, and Grok Build:

```bash
# Symlink first, fall back to copying
./setup-agents.sh --skill-mode auto

# Symlink only
./setup-agents.sh --skill-mode link

# Copy only
./setup-agents.sh --skill-mode copy
```

Choosing the display language (defaults to the OS language, English if
unsupported):

```bash
./setup-agents.sh --lang en
./setup-agents.sh --lang ko
```

Check without making actual changes:

```bash
./setup-agents.sh --dry-run
```

Check usage (creates no files):

```bash
./setup-agents.sh --help   # -h works too
```

## Handling of existing files

The following files are preserved as-is if they already exist.

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.github/mcp.json
.github/copilot/settings.json
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
.vscode/mcp.json
opencode.jsonc
kilo.jsonc
```

Even when `CLAUDE.md` and `GEMINI.md` exist, if they have no agent-kit managed
block, only the shared-instruction import block is added.

## Optional-item installer (agent-installer)

A console tool for picking plugins, MCP servers, skills, repository settings, and
design.md documents with checkboxes to install/remove. Check and submit to
install; run it again and it scans the actual environment so installed items come
up pre-checked, and unchecking removes them.

The interactive screen is a single list of **a search box + tabbed list**. You
move between the Actions, PLUGIN, MCP, SKILL, CONFIG, and DESIGN.MD tabs to make
your picks, then submit once at the end to **apply them all at once**.

Focus moves between two places, the **search box** and the **list** — typing
naturally moves you up to the search box (shown with the input cursor `▌`), and
pressing `↓` takes you down to the list. Pressing `↑` at the top of the list
returns to the search box. **The meaning of `Space` depends on focus.**

| Key | What it does |
|---|---|
| Any character · `/` | Move up to the search box and start searching (in the search box `Space` is part of the query → **multi-word search**) |
| `↓` / `Enter` (search box) | Go down to the list (cursor on the first result) |
| `↑` / `↓` / `PgUp` `PgDn` (list) | Move the cursor. `↑` at the top returns to the search box |
| `Space` (list) | Select/deselect the item under the cursor |
| `Tab` / `Shift+Tab` / `←` `→` | Move between tabs (selections accumulate across tabs) |
| `Enter` (list) | On the Actions tab, run that action; otherwise **submit** (review screen → apply all) |
| `Ctrl+A` | Select/deselect all visible items in the current tab |
| `Ctrl+O` | Preview the item under the cursor (design.md opens in a browser) |
| `Ctrl+F` / `Ctrl+B` | Cycle the CLI filter forward / backward (All → one CLI at a time) |
| `Ctrl+D` | Expand/collapse the detail panel to full screen |
| `Ctrl+Q` | **Quit** — from any focus, and from the review screen, in one press |
| `Esc` | Clear the query → go to the list → press again to quit |

**The key to leave is `Ctrl+Q`.** `Ctrl+C` means "abort", and `Esc` first undoes
the query and focus, so it takes up to three presses to get out — neither was
easy to learn as "the key to leave". `Ctrl+Q` works in one press regardless of
state, and it is **always shown** at the far bottom-right of the screen. Other
hints get truncated from the tail when the terminal is narrow, but this spot
survives — precisely because it is the guidance you need most at that moment.
The letter `q` was avoided for the same reason as `c` and `d` (pressing any
character in the list moves you up to the search box). Raw mode turns off the
terminal's flow control (`Ctrl+S`/`Ctrl+Q`), so it is not intercepted.

`Ctrl+F`, `Ctrl+B`, `Ctrl+D`, and `Ctrl+Q` work from either focus, the search box
or the list — right after narrowing by search is exactly when you want to layer
on a CLI filter. Not using letter keys like `c`/`d` is deliberate: pressing any
character in the list focus moves you up to the search box, so assigning `c` to
the filter would make it impossible to type `codex` as a query.

- **Every item shows `CLI n/10` right after its status** — how many of the 10
  supported tools it is actually wired into. Items that cover everything still
  print `CLI 10/10` — "no indicator" and "everything works" must not look the
  same. Items on the CONFIG tab are repository conventions rather than CLI
  wiring, so they carry no such indicator and are not filtered by the CLI filter.
- **Items that contend over one file are drawn as radios and only one can be
  on** — the English and Korean commit templates are such a pair. They are drawn
  as radios `( )` instead of checkboxes `[ ]` to head off the "you can pick
  several" misreading, and the group header states both the target file and the
  rule (`Commit message template · .gitmessage.txt · pick one`). Turning one on
  turns the sibling off (even when the sibling is hidden by the search), and the
  status line tells you what was deselected. `Ctrl+A` also turns on only one from
  the group, and an already-chosen variant wins.
- **The detail panel shows the target file first** — for items with a single
  fixed target (the commit template), `Target file  .gitmessage.txt` comes before
  the description. The flat list you get when running with no arguments where a
  screen cannot be opened (pipes, CI) carries the same information — there are no
  group headers there, so there would be no other way to know (`--list` is
  excluded, being a shorter format that prints only status and item name).
- **The detail panel below the list unfolds the full text of the item under the
  cursor** — which CLIs it is actually wired into (with config file paths for
  MCP), which ones are not and why (grouped by identical reason, as in
  `Not wired in 9: codex·gemini·… — reason`), plus the item's note and
  description across multiple lines. Previously all of that was appended to a
  one-line hint and the tail was cut off entirely in an 80-column terminal — so
  the hint keeps only status and coverage, and the rest moved into the panel. The
  panel height is determined **by terminal size only**, independent of cursor
  position — a height that changed as you moved the cursor would make the list
  bounce. If the terminal is short, the panel disappears entirely. Use `Ctrl+D`
  to expand the panel to full screen and see a long wiring table at once.
- **Applying a CLI filter with `Ctrl+F`/`Ctrl+B`** drops items not wired into
  that CLI out of the list entirely. Where the detail panel's wiring table shows
  one item in depth, this filter answers the same question from the other
  direction ("what works in this CLI").
- **Within a tab, items are grouped by character** — subgroup headers appear in
  the order Token savings · Code understanding · Design sense · Way of working ·
  External services, with counts alongside. Tabs (PLUGIN·MCP·SKILL) are about
  "what installs it", which makes comparison hard when picking — the same tab
  mixes something that saves tokens with something that reviews your design.
- Search and the CLI filter both apply within the active tab, but the **per-tab
  hit counts on the tab row** keep you from missing results in another tab
  (`DESIGN.MD 19/76`). Multiple words narrow with AND.
- On submit, a **review screen shows what will be installed/completed/removed**
  just before applying, and `Enter` applies them all. Partially covered items
  show their coverage once more on this screen. You can go back with `Esc`.
- **A progress bar runs in real time while applying** — the item and command
  currently running, elapsed time, and a `done/total` count, refreshed every
  100 ms. External command execution is asynchronous so the event loop is not
  blocked, which is why elapsed time actually advances. `Ctrl+C` only
  **requests** a stop — the item currently running finishes first. Killing a
  package install mid-command would leave a half-installed state. Items not yet
  started are marked "skipped". Skipped does not count as failure — it is
  excluded from both the failure tally and the exit code. Stopping on purpose is
  different from something going wrong.
- **In non-interactive (`--set`) and CI (non-TTY) runs, plain progress lines**
  appear one per item instead of a bar — so as not to pollute logs with ANSI
  control characters.
- `Ctrl+A` touches **only visible items** — installations off screen are not
  swept up.

```bash
cd agent-installer && npm install && cd ..    # once (install dependencies)

node agent-installer/install.mjs              # interactive: check = install, uncheck = remove
node agent-installer/install.mjs --help       # usage (design and bootstrap support --help too)
node agent-installer/install.mjs --list       # print current state only
node agent-installer/install.mjs --set mcp.notion,plugin.bkit
                                              # non-interactive: the given set becomes the target state
node agent-installer/install.mjs --set ""     # remove everything (the empty value must be explicit;
                                              #  omitting the value exits with an error)
node agent-installer/install.mjs --list --dry-run
                                              # --dry-run modifies other flags.
                                              #  Given alone, it opens the interactive
                                              #  screen in dry-run state
node agent-installer/install.mjs --design-dir internal=//nas/design --list
                                              # add a design.md source (repeatable)
node agent-installer/install.mjs --lang en    # display language for this run only
                                              #  (en|ko, defaults to OS language → English)
```

Flags that take a value accept both `--set a,b` and `--set=a,b`. Unknown
arguments and typos (`--dryrun`) are not silently ignored — they exit with an
error and the usage text. For the same reason, stacking flags that choose the
action is rejected too: specify only one of `--list`/`--set` at the root, and one
of `--list`/`--set`/`--preview`/`--sync` for `design` (flags that modify
behavior, like `--dry-run` and `--design-dir`, can be combined).

### Installable items

| Kind | Item | Notes |
|---|---|---|
| Plugin | `plugin.superpowers`, `plugin.bkit`, `plugin.mattpocock-skills` | Installed with `--scope project` through the Claude Code plugin mechanism. Upstream superpowers supports 11 harnesses including Codex and Antigravity via per-harness installs, and bkit supports Codex and Gemini through separate distributions (bkit-codex, bkit-gemini), but what this item wires is only the Claude edition — per-CLI reasons are shown in the detail panel. If the `claude` command is missing, it only records into `.claude/settings.json` and downloads on the next Claude Code run |
| Plugin | `plugin.ponytail` | Wired simultaneously into the Claude Code plugin mechanism and the `plugin` array of OpenCode's `opencode.jsonc` (both project scope). Existing `plugin` entries are preserved and only appended to. For the remaining CLIs, upstream installation is user-scoped (Codex, Copilot, Gemini) or there is no plugin mechanism at all, and the reason is shown in the item's note |
| MCP | `mcp.notion`, `mcp.supabase`, `mcp.vercel` | Remote URLs registered simultaneously into 10 CLIs' project settings. Authentication (OAuth) happens the first time you use each CLI, and no secrets are committed |
| MCP | `mcp.codebase-memory` | stdio transport — requires the `codebase-memory-mcp` binary on PATH (if missing, install guidance is shown in the item's note) |
| MCP | `mcp.graphify` | stdio transport — requires `graphify-mcp` on PATH (`uv tool install "graphifyy[mcp]"`). It takes no arguments and reads `graphify-out/graph.json` from the working directory, so the graph stays inside the repository too |
| MCP | `mcp.headroom` | stdio transport — requires `headroom` on PATH (`uv tool install --python 3.13 "headroom-ai[proxy,mcp]"`). Registered with the same `headroom mcp serve` contract as the upstream `server.json` |
| Plugin | `plugin.ecc`, `plugin.impeccable`, `plugin.understand-anything` | Claude Code marketplace plugins, `--scope project`. All three have installation paths for other CLIs, but they are not used because they are user-scoped (ECC, Understand Anything) or because they break this repository's `.agents/skills` link (impeccable) — the reason appears in the item's note |
| Skill | `skill.caveman`, `skill.taste`, `skill.karpathy`, `skill.hallmark`, `skill.diagram-design` | **Copied** into the shared `.agents/skills` with `npx skills add … --agent universal --copy`. All 10 CLIs look at that path, so one install applies to all of them, and it can be committed and shared with the team. Upstream Hallmark documents Cursor and Codex paths of its own, and Diagram Design ships Claude and Codex plugin manifests, but those are all per-CLI directories — the shared path covers all 10 at once |
| Skill | `skill.gsd` | Project-local install via `npx @opengsd/gsd-core --claude --local`. Upstream supports 18 runtimes including `--codex` and `--antigravity`, but this item wires only `--claude` |
| Skill | `skill.gstack` | Clone + setup into the in-repository `.claude/skills/gstack` (bash required, `.gitignore` handled automatically). Upstream setup also supports Codex, Kiro, and OpenCode via `--host`, but this item runs it only with the default (Claude) |
| Config | `config.gitmessage.en`, `config.gitmessage.ko` | Writes the commit message template `.gitmessage.txt` to the repository root and points `git config --local commit.template` at it. **Only one of the English and Korean editions** can be chosen — there is a single target file, so turning both on would let the later one overwrite the earlier (the TUI turns the sibling off automatically, and passing both to `--set` is rejected with an error). Only a switch between the two editions this tool wrote counts as an overwrite; if a hand-written template is already there, it refuses |

### Operating principles

- **The ground truth for actual state is the scan** — every run scans the real
  config files to decide, so manual installs and removals are always reflected
  accurately.
- **The install record (`.agent-kit/agent-setup.json`) is intent** — which
  version wired things up, which items you meant to pick, and whether managed
  files are still exactly as this tool wrote them. It does not replace the scan;
  it adds reproducibility and version pinning. It is committed, so teammates get
  the same result.
- `status` shows the difference between the two as `record only` / `repository
  only`.
- MCP servers registered in only some CLIs are shown as `(partially installed)`,
  and submitting with the item still checked installs into the missing CLIs only.
- The files an MCP item writes differ per CLI — `.mcp.json` (Claude Code),
  `.codex/config.toml`, `.gemini/settings.json`, `opencode.jsonc`,
  `.kilocode/mcp.json` (Kilo Code), `.kiro/settings/mcp.json`,
  `.kimi-code/mcp.json`, `.grok/config.toml`, `.github/mcp.json` (Copilot CLI),
  `.vscode/mcp.json`. Of these, `.mcp.json` and `.kilocode/mcp.json` are not
  created by the bootstrap, so they appear the first time you pick an MCP item
  (both are meant to be committed).
- Other keys and comments in existing config files are preserved, and the changes
  can be reviewed with `git diff`.
- Adding a new item = 1 file in `agent-installer/lib/items/` (using the
  `defineMcp`/`definePlugin`/`defineSkill` factories; 5 lines is enough for MCP).
- The `agent-installer/` folder is self-contained, so it works when copied into
  another repository.

### design.md library

Picks DESIGN.md documents — which AI agents read to generate consistent UI —
from [awesome-design-md](https://github.com/VoltAgent/awesome-design-md),
downloads them to `design-md/<provider>/<name>/DESIGN.md`, syncs them, and lets
you check them in a browser preview. Downloads are committed to git, so they are
shared with the team. The listing, cache, and install path are all scoped per
provider, so the same name from several providers coexists without conflict.

**You can install several at once.** Install paths split by `provider/name`, so
no matter how many you take they never overwrite each other. Inside the
DESIGN.MD tab they are grouped by category, and items without a classification
gather at the end under `Other`.

**License of the bundled copies.** For offline installation, copies of
awesome-design-md's DESIGN.md files ship inside the package. Upstream is MIT, and
MIT permits redistribution while requiring the copyright notice and permission
text to be included with the copies. That original text lives at
`agent-installer/lib/design-md/cache/awesome-design-md/LICENSE.md`, and the pack
test checks both the file's presence and its content so it cannot fall out of a
release.

Syncing and catalog refresh are run with `Enter` on items in the **Actions tab**.

```bash
node agent-installer/install.mjs design --list        # catalog + install state
node agent-installer/install.mjs design --set stripe,vercel   # install the target set
node agent-installer/install.mjs design --preview stripe      # open the getdesign.md preview
node agent-installer/install.mjs design --sync=installed  # bring installs up to the latest source
node agent-installer/install.mjs design --sync=catalog   # refresh the available list and categories
node agent-installer/install.mjs design --sync=stale     # detect installs that diverged from source
```

- Preview opens the `https://getdesign.md/<name>/design-md` page in your OS
  default browser (the site provides its own light/dark theme; no download
  needed).
- The catalog is cached in `agent-installer/lib/design-md/catalog.json` so it
  works instantly offline, and is refreshed with `--sync=catalog` (or the sync
  menu).
- **Offline bundle**: 76 DESIGN.md files ship in
  `agent-installer/lib/design-md/cache/<provider>/` and are copied instantly at
  install time with no network (falling back to the network when not bundled).
  `--sync=installed` and stale-item updates skip the bundle and fetch the latest
  source. Regenerate the bundle with
  `cd agent-installer && npm run refresh-bundle`.
- **Duplicate handling**: `--set` and `--preview` accept `name` or
  `provider/name`. When the same name exists under several providers, you must
  specify `provider/name`.
- Adding a source = registering 1 provider in
  `agent-installer/lib/design-md/providers/`. That said, as shown below,
  **just placing a directory** gets it listed without a provider.

#### Including internal offline DESIGN.md files

They are searched and listed **from directory structure alone**, with no provider
code. A folder containing `DESIGN.md` is one item, and the path above it is the
category.

```text
<source>/<category…>/<name>/DESIGN.md
```

Use whichever of the two ways is more convenient.

```bash
# 1) Put it straight into the bundle cache — it travels with the installer when copied
agent-installer/lib/design-md/cache/internal/fintech/checkout/DESIGN.md

# 2) Point at an external path — connect an internal share or a separate repository as-is
node agent-installer/install.mjs design --list --design-dir internal=//nas/design
export AGENT_INSTALLER_DESIGN_MD_DIRS="internal=//nas/design"   # path separator: `;` on Windows, `:` on POSIX
```

- The file name may be either `DESIGN.md` or `design.md` (case-insensitive).
- Label, category, and description are filled in automatically **from the path
  plus the file content**. Frontmatter `title`/`name`/`category`/`description`
  takes precedence (even multi-KB frontmatter holding design tokens is read); if
  absent, the first heading becomes the label, the first paragraph the
  description, and the intermediate path the category (`internal` when there is
  none).
- When the same name exists under different categories (`web/button`,
  `mobile/button`), the later one gets the category as a prefix (`web-button`) so
  both are preserved, and you are told this happened.
- Local definitions use no network. Installing is a file copy, and
  `--sync=installed` treats the same directory as the source. There is no
  getdesign.md page, so the preview only shows a notice.
- If you omit the name, as in `--design-dir <path>`, the folder name becomes the
  source id, and a suffix like `-2` is appended if it collides with another or
  with a registered provider id (so internal items never leak out to an external
  network). `--sync=catalog` refreshes remote providers only, so it does not
  remove internal items.

## Files to put in a team repository

With `npx @rch4com/agent-setup` there is no need to commit the installer itself.
What gets committed is only the wiring output.

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.agents/skills/
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.github/mcp.json
.github/copilot/settings.json
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
.vscode/mcp.json
.vscode/settings.json
opencode.jsonc
kilo.jsonc
```

In offline environments, or when you need a committed entry point, the existing
approach of committing `setup-agents.ps1`, `setup-agents.sh`, and
`agent-installer/` (excluding node_modules) still works.

Registering MCP items with the installer adds `.mcp.json` and
`.kilocode/mcp.json` here — two files the bootstrap does not create, and, like
the other MCP files, meant to be committed and shared with the team.

If `.claude/skills`, `.kiro/skills`, or `.grok/skills` are local junctions or
symlinks, Git and the operating system may handle them differently (on Windows,
git treats a junction as an ordinary directory, so skills get committed twice).
To prevent this, the script adds the three adapter paths to `.gitignore`
automatically. In other words, only `.agents/skills` is committed, and each
developer runs the bootstrap script to create the adapters.
