# Repository-local AI agent bootstrap

**English** · [한국어](AgentSetup-README.ko.md) · [Changelog](AgentSetup-README-CHANGES.md)

A script that initializes shared instructions and shared Agent Skills
**within repository scope only**, so that Claude Code, Codex, OpenCode, and
Antigravity (Google agent IDE/CLI) can all be used together in one repository,
plus an optional-item installer that installs plugins, MCP servers, and skills
**with each CLI's own official install commands**.

## Five-minute start

```bash
cd <a git repository>
npx @rch4com/agent-setup bootstrap --dry-run   # see what would be created
npx @rch4com/agent-setup bootstrap             # shared guide, skills, per-tool config
npx @rch4com/agent-setup                       # pick plugins, MCP servers, skills
```

On the screen, `Tab` switches tabs, `Space` picks, `Enter` submits. `[+]` means
to be installed, `[-]` to be removed, and the header's `N pending change(s)`
summarizes what Enter will do. `F1` for help, `Ctrl+Q` to quit. Everything below
is reference material for later.

## Generated structure

```text
repository/
├─ AGENTS.md
├─ CLAUDE.md
├─ opencode.jsonc
├─ .agents/
│  └─ skills/
│     └─ repository-check/
│        └─ SKILL.md
├─ .claude/
│  ├─ settings.json
│  └─ skills/          # link to .agents/skills, or a managed copy
├─ .codex/
│  └─ config.toml
└─ .agent-kit/
   └─ README.md
```

## How each tool is wired

- **Claude Code:** `CLAUDE.md` imports `AGENTS.md`, and `.claude/skills` is
  linked to `.agents/skills`.
- **Codex:** uses the root `AGENTS.md` and `.agents/skills`.
- **OpenCode:** uses the root `AGENTS.md`, `.agents/skills`, and
  `opencode.jsonc`.
- **Antigravity (Google agent IDE/CLI):** natively recognizes the root
  `AGENTS.md` and the `.agents/` directory, so it uses `AGENTS.md` and
  `.agents/skills` as-is (no import wiring, no adapter, no new files). It has no
  project-scope MCP or plugin configuration, so the optional-item installer
  installs into it **user-globally** only, with the Antigravity CLI (`agy`)
  commands.

### Tools not covered

Support for Gemini CLI, Kilo Code, Kiro, Kimi Code, Grok Build, GitHub Copilot
CLI, and VS Code Copilot ended in 2.0.0. The installer does not delete the files
1.x created for those tools (`GEMINI.md`, `.gemini/`, `kilo.jsonc`, `.kiro/`,
`.kimi-code/`, `.grok/`, `.github/mcp.json`, `.github/copilot/`,
`.vscode/mcp.json`) — remove them by hand if you no longer use them.
`chat.useAgentsMdFile` in `.vscode/settings.json` is no longer ensured either.

Cursor, Windsurf, Cline/Roo Code, Amp, Factory Droid, and Qwen Code are not on
the list either. This repository wires only what has been measured with the real
CLI — what each tool reads and which commands install into it. Structurally,
adding one is a single entry in each of `agent-installer/lib/clis.mjs` (CLI name
and executable), `agent-installer/lib/probe.mjs` (the list commands that read
install state), and `agent-installer/lib/bootstrap/manifest.mjs` (generated
files); the per-item check that demands a reason for every unwired CLI catches
anything missed.

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

The managed block in `CLAUDE.md` is replaced only between the markers
(`<!-- agent-kit:begin -->`), so anything you wrote around it survives.

Use `update --force` to take in drifted files too. Since git is the only way to
undo it, it works **only when the working tree is clean** (untracked files
do not count — nothing of theirs is overwritten).

Hashes are computed over content normalized to LF line endings — a CRLF checkout
on Windows is not misjudged as drift.

`status` also flags items whose unwired reasons were verified (`verified`) more
than 90 days ago as `stale check` — a reason is a fact from the day upstream was
measured, and a stale one lingers on screen otherwise.

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
- Adds the managed block to `CLAUDE.md` only when it is absent.
- Preserves an existing `.claude/skills` when it is a user-managed path.
- Adds `.claude/skills` to `.gitignore` so the adapter (link/copy) is not
  committed.
- Adds the negation entry `!.vscode/settings.json` so that the file is committed
  even in a `.gitignore` that ignores `.vscode/*` — the commit template item
  (`config.gitmessage.*`) wires VS Code settings into this file.
- Safe to run repeatedly.

## What the installer runs

Unlike the bootstrap, the optional-item installer uses the network and runs
external commands. From 2.0.0 it no longer edits each CLI's config files
directly; it calls **that CLI's official install commands**. You can see exactly
what will run for what you pick before anything runs, with `--print` (`p` on the
review screen in the interactive UI).

| Item | What runs |
|---|---|
| `plugin.*` | Claude Code: `claude plugin marketplace add <repo> --scope <scope>` + `claude plugin install <id> --scope <scope>`. Codex (global): `codex plugin marketplace add <repo>` + `codex plugin add <id>`. OpenCode: `opencode plugin <module>` (`-g` for global). Antigravity (global): `agy plugin install <git URL>`. Each item wires only the CLIs its upstream documents. A marketplace registration failing with "already exists" is ignored |
| `mcp.*` | Claude Code: `claude mcp add -s <scope> <name> …`. Codex (global): `codex mcp add <name> …`. Antigravity (global): `agy mcp add <name> …`. OpenCode: `opencode mcp add` is interactive only, so `opencode run "<instruction>"` asks the OpenCode agent to edit its config, and the installer re-reads the config file to confirm the change landed |
| `skill.*` (registry skills: agent-browser, archify, caveman, diagram-design, eli5, find-skills, hallmark, i-have-adhd, im-not-ai, impeccable, karpathy, mattpocock-skills, mcp-builder, officecli, prompt-master, remotion, strix, superpowers, taste) | Repo scope: `npx -y skills@latest add <github repo> --skill <name> --agent universal --yes --copy` — copies into the shared `.agents/skills`. Global: `… -g -a claude-code codex antigravity-cli --yes --copy` (`~/.claude/skills`, `~/.agents/skills`, `~/.gemini/antigravity-cli/skills` — OpenCode reads the first two). Removal runs `npx -y skills@latest remove` and then deletes any leftover directory and the `skills-lock.json` entry |
| `skill.gsd` | `npx -y @opengsd/gsd-core@latest --<runtime> --local` — once per runtime (claude, codex, opencode), downloading and running the latest version with no confirmation prompt (`-y`) |
| `skill.gstack` | Shallow-clones the default branch of `github.com/garrytan/gstack` and then runs `bash ./setup` inside the repository. It does not pin a commit or verify integrity |
| `config.gitmessage.*` | `git config --local commit.template .gitmessage.txt` — also adds `git.useEditorAsCommitInput` and `github.copilot.chat.commitMessageGeneration.instructions` to `.vscode/settings.json` when absent (existing keys are never overwritten; removal deletes only a key whose value is exactly the one written). Touches only the repository (no network). Global and system settings are neither read nor written |
| design.md | Downloads `DESIGN.md` from `raw.githubusercontent.com` (a document file; it is not executed). If it exists in the bundled cache, no network is used |

- Make sure you trust the target repository/package before picking an item.
  Every plugin and skill item runs third-party code — repo-scope items install
  into this repository, and global-scope (`--global`) items into this whole
  machine.
- Network calls have a 20-second time limit and an 8 MiB response body cap (a
  response that keeps streaming would never hit a time limit, so size is capped
  too).
- Adding `--print` (old name `--dry-run`) prints only the commands that would
  run and changes nothing.
- MCP items register only URLs and commands in each CLI's config.
  Authentication (OAuth) happens the first time you use each CLI, and tokens are
  not stored in this repository.
- `opencode run` is an LLM run, so its result is nondeterministic. The installer
  re-reads the config file to confirm, and reports a failure if the change did
  not land or the run stalls on a permission prompt and hits the time limit
  (10 minutes) — in that case, run the instruction `--print` shows directly in
  OpenCode. As of 2.0.0 this path has not been verified against a real
  OpenCode.

## Windows

Place these files anywhere in the repository and run them from PowerShell.

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-agents.ps1
```

PowerShell 7:

```powershell
pwsh -File .\setup-agents.ps1
```

Claude Code's skill adapter mode:

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

Claude Code's skill adapter mode:

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
.claude/settings.json
.codex/config.toml
opencode.jsonc
```

Even when `CLAUDE.md` exists, if it has no agent-kit managed block, only the
shared-instruction import block is added.

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
| `Enter` (list) | On a `[▶]` action row (Language, Install scope, and Run bootstrap on the Actions tab, the three sync actions at the top of the DESIGN.MD tab), run that action; otherwise **submit** (review screen → apply all) |
| `Ctrl+A` | Select/deselect all visible items in the current tab |
| `Ctrl+O` | Preview the item under the cursor (design.md opens in a browser) |
| `Ctrl+F` / `Ctrl+B` | Cycle the CLI filter forward / backward (All → one CLI at a time; the position shows at the right of the search line, as in `CLI › codex (2/4)`) |
| `Ctrl+D` | Expand/collapse the detail panel to full screen |
| `Home` / `End` | Jump to the first / last row |
| `F1` | Key guide (any key closes it) |
| `Ctrl+Q` | **Quit** — from any focus, and from the review screen, in one press |
| `Esc` | Clear the query → go to the list → press again to quit |
| `p` (review screen) | Without applying, lay out the CLI commands to run and the after-install steps outside the screen |

**The key to leave is `Ctrl+Q`.** `Ctrl+C` means "abort", and `Esc` first undoes
the query and focus, so it takes up to three presses to get out — neither was
easy to learn as "the key to leave". `Ctrl+Q` works in one press regardless of
state, and it is **always shown** at the far bottom-right of the screen. Other
hints fold onto two lines when the terminal is narrow (an 80-column Korean
screen does that) and get truncated from the tail if that is still not enough,
but this spot survives — precisely because it is the guidance you need most at
that moment.
The letter `q` was avoided for the same reason as `c` and `d` (pressing any
character in the list moves you up to the search box). Raw mode turns off the
terminal's flow control (`Ctrl+S`/`Ctrl+Q`), so it is not intercepted.

`Ctrl+F`, `Ctrl+B`, `Ctrl+D`, and `Ctrl+Q` work from either focus, the search box
or the list — right after narrowing by search is exactly when you want to layer
on a CLI filter. Not using letter keys like `c`/`d` is deliberate: pressing any
character in the list focus moves you up to the search box, so assigning `c` to
the filter would make it impossible to type `codex` as a query.

- **The check mark says what Enter will do, not whether the row is ticked** —
  `[×]` installed and left alone, `[+]` to be installed (or completed) this time,
  `[-]` installed but unticked, so to be removed, `[ ]` absent and not chosen.
  The header always carries the count and breakdown, as in `3 pending change(s)
  (+2 -1)` — `selected 3 / 106` is a sum of install state and says nothing about
  what Enter will do.
- **Every item shows its CLI coverage right after its status** — the supported
  CLI names, as in `claude·opencode`. Which CLIs are supported depends on the
  **chosen install scope**: Codex and Antigravity install plugins and MCP
  servers only user-globally, so in repo scope they drop out with "switch the
  scope to Global" as the reason. CLIs not on this machine's PATH are dropped
  from the list and noted separately, as in `codex missing`. Items on the CONFIG
  tab are repository conventions rather than CLI wiring, so they carry no such
  indicator and are not filtered by the CLI filter.
- **`--list` carries the same information** — coverage, target file, and
  install location follow the status, id, and name. CI reads this path, so it
  must not disagree with the screen.
- **`F1` opens the key guide** — every key with its meaning on one screen, which
  the two-line footer cannot hold. `Home`/`End` jump to the first/last row.
  Resizing the terminal redraws at the new size without a keypress.
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
  group headers there, so there would be no other way to know (`--list` carries
  coverage, target file, and install location too).
- **The detail panel below the list unfolds the full text of the item under the
  cursor** — which CLIs it is wired into, which ones are not and why (grouped by
  identical reason, as in `not wired for 2: codex·antigravity — reason`), plus
  the item's note and description across multiple lines. The hint keeps only
  status and coverage. The panel height is determined **by terminal size only**,
  independent of cursor position — a height that changed as you moved the cursor
  would make the list bounce. If the terminal is short, the panel disappears
  entirely. Use `Ctrl+D` to expand the panel to full screen.
- **Applying a CLI filter with `Ctrl+F`/`Ctrl+B`** drops items not wired into
  that CLI out of the list entirely. Where the detail panel's wiring table shows
  one item in depth, this filter answers the same question from the other
  direction ("what works in this CLI").
- **Within a tab, items are grouped by character** — subgroup headers appear in
  the order Token savings · Code understanding · Design sense · Way of working ·
  External services, with counts alongside. Tabs (PLUGIN·MCP·SKILL) are about
  "what installs it", which makes comparison hard when picking — the same tab
  mixes something that saves tokens with something that reviews your design.
  **The install scope is chosen on the `Install scope` row of the Actions tab**
  — `Enter` switches between repo and user-global; switching rescans the items
  for that scope and resets the picks to the actual install state. Turning an
  item on in global scope announces in the status line that it applies to this
  whole computer.
- Search and the CLI filter both apply within the active tab, but the **per-tab
  hit counts on the tab row** keep you from missing results in another tab
  (`DESIGN.MD 19/76`). Multiple words narrow with AND.
- On submit, a **review screen shows what will be installed/completed/removed**
  just before applying, and `Enter` applies them all. Partially covered items
  show their coverage once more on this screen, and in global scope a warning
  says that settings outside this repo (`~/.codex` etc.) will change. Pressing
  `p` lays out the same commands outside the screen without applying — you can
  copy them and run them yourself (on a screen opened with `--print`, `Enter`
  does this too). You can go back with `Esc`.
- **A progress bar runs in real time while applying** — the item and command
  currently running, elapsed time, and a `done/total` count, refreshed every
  100 ms. External command execution is asynchronous so the event loop is not
  blocked, which is why elapsed time actually advances. `Ctrl+C` only
  **requests** a stop — the item currently running finishes first. Killing a
  package install mid-command would leave a half-installed state. Items not yet
  started are marked "skipped". Skipped does not count as failure — it is
  excluded from both the failure tally and the exit code. Stopping on purpose is
  different from something going wrong.
- **When applying finishes, the after-install steps are announced once per
  CLI** — start a new session, restart OpenCode or Antigravity, and, if an item
  with hooks (Ponytail, ECC, ai-memory) went into Codex, the step of opening
  `/hooks` in `codex` to trust the new lifecycle hooks. Item-specific
  prerequisites (for example the ai-memory binary and `ai-memory setup`) are
  listed separately below. If one CLI's command fails, only that CLI's remaining
  steps are skipped and the other CLIs carry on — the failed command and the
  last few lines of its output stay in the result.
- **In non-interactive (`--set`) and CI (non-TTY) runs, plain progress lines**
  appear one per item instead of a bar — so as not to pollute logs with ANSI
  control characters.
- `Ctrl+A` touches **only visible items** — installations off screen are not
  swept up.

```bash
cd agent-installer && npm install && cd ..    # once (install dependencies)

node agent-installer/install.mjs              # interactive: check = install, uncheck = remove
node agent-installer/install.mjs --help       # usage (design and bootstrap support --help too)
node agent-installer/install.mjs --list       # print current state only (repo scope)
node agent-installer/install.mjs --global --list
                                              # state in user-global scope
node agent-installer/install.mjs --set mcp.notion,plugin.superpowers
                                              # non-interactive: the given set becomes the target state
node agent-installer/install.mjs --global --set plugin.ponytail,plugin.ai-memory
                                              # install user-globally (global items not
                                              #  in the list are not removed)
node agent-installer/install.mjs --print --set plugin.ponytail
                                              # print the CLI commands only (same as --dry-run)
node agent-installer/install.mjs --set ""     # remove everything in repo scope (the empty value
                                              #  must be explicit; omitting it exits with an error)
node agent-installer/install.mjs --design-dir internal=//nas/design --list
                                              # add a design.md source (repeatable)
node agent-installer/install.mjs --lang en    # display language for this run only
                                              #  (en|ko, defaults to OS language → English)
```

Example `--print` output (`--global --print --set plugin.ponytail`, on a machine
with Claude Code and Codex on PATH):

```text
# Claude Code — user-global
claude plugin marketplace add DietrichGebert/ponytail --scope user
claude plugin install ponytail@ponytail --scope user

# Codex — user-global
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail

After installing:
  Claude Code: start a new session (check /plugin if something looks inactive)
  Codex: run codex and start a new session
    hooks (Ponytail): in codex type /hooks, trust the new lifecycle hooks, then start a new session
  · Ponytail: Node.js must be on PATH for the always-on hook to run
```

Flags that take a value accept both `--set a,b` and `--set=a,b`. Unknown
arguments and typos (`--dryrun`) are not silently ignored — they exit with an
error and the usage text. For the same reason, stacking flags that choose the
action is rejected too: specify only one of `--list`/`--set` at the root, and one
of `--list`/`--set`/`--preview`/`--sync` for `design` (flags that modify
behavior, like `--global`, `--print`, and `--design-dir`, can be combined).

### Installable items

| Kind | Item | Notes |
|---|---|---|
| Plugin | `plugin.ponytail` | Lean-code ruleset (`DietrichGebert/ponytail`). Installed into all four CLIs with upstream's official commands — Claude Code (repo and global), Codex (global), OpenCode (`@dietrichgebert/ponytail`, repo and global), and Antigravity (global). On Codex it turns on only after you trust its two hooks in `/hooks`, and the always-on hook needs Node.js on PATH. Upstream recommends `scripts/uninstall.js` to clean `~/.config/ponytail` before removal (this item removes the plugin only) |
| Plugin | `plugin.ai-memory` | `akitaonrails/ai-memory` (MIT), which lets several agents share long-term memory and working context. Claude Code (repo and global) and Codex (global) get the upstream marketplace plugin (hooks and skills); OpenCode and Antigravity get the stdio bridge `ai-memory mcp-bridge --no-session-id` as an MCP server — the bridge reads its token from the data directory, so it never lands in a config file. The server that stores the memory must be running too: install the binary first with upstream `install.sh`/`install.ps1` and run `ai-memory setup` once. To pick a session back up, launch through it, as in `ai-memory run codex` |
| Plugin | `plugin.superpowers` | Claude Code uses the official marketplace (`superpowers@claude-plugins-official`), Codex (global) `obra/superpowers-marketplace`, OpenCode a git module, and Antigravity (global) `agy plugin install https://github.com/obra/superpowers`. **Only one** of this and `skill.superpowers` can be chosen |
| Plugin | `plugin.ecc`, `plugin.mattpocock-skills` | Marketplace plugins for Claude Code (repo and global) and Codex (global). ECC supports OpenCode and Antigravity only through `install.sh --target`, and its 284 skills would swamp the shared directory, so those are not wired (Codex native hooks need to be trusted). Matt Pocock's remaining CLIs are covered by the shared-skill edition (`skill.mattpocock-skills`), and **only one** of the two can be chosen |
| Plugin | `plugin.impeccable`, `plugin.understand-anything`, `plugin.hyperframes`, `plugin.cli-anything` | Claude Code marketplace plugins (repo and global). The other CLIs are skipped for different reasons — impeccable's shared-skill edition (`skill.impeccable`, **pick one**) covers them, while Understand Anything offers only a script that clones into the home directory, HyperFrames a separate install per CLI, and CLI-Anything scripts and manual copies, none of which can be wired as CLI commands. HyperFrames rendering needs Node.js 22+ and FFmpeg |
| MCP | `mcp.notion`, `mcp.supabase`, `mcp.vercel` | Remote URLs. Registered in Claude Code and OpenCode (repo and global) and in Codex and Antigravity (global). Authentication (OAuth) happens the first time you use each CLI, and no secrets are committed |
| MCP | `mcp.codebase-memory`, `mcp.graphify`, `mcp.headroom` | stdio transport — requires `codebase-memory-mcp`, `graphify-mcp` (`uv tool install "graphifyy[mcp]"`), and `headroom` (`uv tool install --python 3.13 "headroom-ai[proxy,mcp]"`) on PATH, respectively. graphify reads `graphify-out/graph.json` from the working directory |
| MCP | `mcp.graft` | stdio transport — `npx -y @nanonets/graft mcp`, so nothing to install. Build the graph first with `graft build` (a gitignored `graft/`). The upstream `graft init` deep integration is not used because it edits files this repository manages. On Windows the `tree-sitter-kotlin` dependency needs a C++ toolchain, and Node 24 cannot compile it (upstream #400) |
| Skill | `skill.superpowers`, `skill.mattpocock-skills`, `skill.strix`, `skill.im-not-ai` | Copies one upstream's skills at once into the shared `.agents/skills` via `--skill '*'`. Removal picks its targets from the source records in `skills-lock.json`; global scope has no such record, so these are **repo scope only**. superpowers and mattpocock-skills allow **only one** of this and the plugin edition of the same upstream (the superpowers skill edition has no session-start injection). strix needs the `strix` binary on PATH, and im-not-ai brings in the skills only, without the upstream subagents |
| Skill | `skill.caveman`, `skill.taste`, `skill.karpathy`, `skill.hallmark`, `skill.diagram-design`, `skill.agent-browser`, `skill.find-skills`, `skill.mcp-builder`, `skill.prompt-master`, `skill.i-have-adhd`, `skill.eli5`, `skill.archify`, `skill.impeccable`, `skill.remotion`, `skill.officecli` | In repo scope, copies one skill into the shared `.agents/skills`, which all four CLIs see (it can be committed and shared with the team); in global scope, puts it into the `claude-code`, `codex`, and `antigravity-cli` global paths. agent-browser and officecli need their own binaries on PATH, impeccable downloads its engine into `~/.impeccable` on first run (**pick one** of it and `plugin.impeccable`), and Remotion needs a company license for larger for-profit organizations |
| Skill | `skill.gsd` | Repo-scope install via `npx @opengsd/gsd-core --<runtime> --local` — claude→`.claude/commands`, codex→`.codex/skills`, opencode→`.opencode/skills`. Each runtime produces roughly 700 files. Antigravity has an upstream flag, but its install path has not been measured, so it is not wired |
| Skill | `skill.gstack` | Clone + setup into the in-repository `.claude/skills/gstack` (bash required, `.gitignore` handled automatically). In a bootstrapped repository that path is a junction, so the files land in the shared `.agents/skills/gstack`, and Codex and OpenCode scan recursively, so they see the individual skills. Repo scope only |
| Config | `config.gitmessage.en`, `config.gitmessage.ko` | Writes the commit message template `.gitmessage.txt` to the repository root and points `git config --local commit.template` at it. **Only one of the English and Korean editions** can be chosen. It writes files itself, so it is repo scope only, and `--print` shows a one-line notice instead of commands |

### Operating principles

- **The ground truth for actual state is the scan** — every run decides by
  **only reading** each CLI's list commands (`claude plugin list --json`,
  `codex plugin list --json`, `codex mcp list --json`, `agy plugin list --json`,
  `agy mcp list`, `npx skills list -g --json`) and config files (`.mcp.json` and
  `~/.claude.json`, `opencode.jsonc`), so manual installs and removals are
  reflected accurately. `claude mcp list` is not used because it health-checks
  every server and is slow. A CLI whose list command fails (an expired login,
  for example) is shown as "could not read install state", and nothing is done
  to that CLI.
- **The install record (`.agent-kit/agent-setup.json`) is intent** — which
  version wired things up, which items you meant to pick, and whether managed
  files are still exactly as this tool wrote them. It does not replace the scan;
  it adds reproducibility and version pinning. It is committed, so teammates get
  the same result.
- `status` shows the difference between the two as `record only` / `repository
  only`.
- Items installed in only some CLIs are shown as `(partially installed)`, and
  submitting with the item still checked runs only the missing CLIs' commands.
- Run mode and `--print` come from the same command list — the commands shown
  on screen are the commands the installer runs.
- Adding a new item = 1 file in `agent-installer/lib/items/` (spreading the
  `marketplacePlugin`/`mcpServer`/`skillsAdd` helpers into `defineRecipe`;
  7 lines is enough for MCP).
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

Syncing and catalog refresh are run with `Enter` on the `[▶]` rows at the **top of
the DESIGN.MD tab** — they concern design.md only, so they live there rather than
on the Actions tab.

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
.agents/skills/
.claude/settings.json
.codex/config.toml
opencode.jsonc
```

In offline environments, or when you need a committed entry point, the existing
approach of committing `setup-agents.ps1`, `setup-agents.sh`, and
`agent-installer/` (excluding node_modules) still works.

Installing MCP items in repo scope makes Claude Code write `.mcp.json` and
OpenCode write the `mcp` key of `opencode.jsonc` — both meant to be committed
and shared with the team. If you installed `config.gitmessage.*`,
`.gitmessage.txt` and `.vscode/settings.json` are added too.

If `.claude/skills` is a local junction or symlink, Git and the operating system
may handle it differently (on Windows, git treats a junction as an ordinary
directory, so skills get committed twice). To prevent this, the script adds that
adapter path to `.gitignore` automatically. In other words, only
`.agents/skills` is committed, and each developer runs the bootstrap script to
create the adapter.
