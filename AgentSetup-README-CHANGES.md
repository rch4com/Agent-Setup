# Changelog

**English** · [한국어](AgentSetup-README-CHANGES.ko.md)

Newest entries come first. For detailed usage, see
[AgentSetup-README.md](AgentSetup-README.md).

## Unwired reasons corrected by re-measuring all 22 items (2026-08-15, 1.11.1)

**The detail panel's "why is this CLI not wired" was false in six places.** All
22 items were re-measured against upstream READMEs and the actual CLIs across
10 targets, and only the parts that contradicted reality were changed. Not one
line of install or uninstall logic moves — only the sentences on screen.

- **Upstream added support in three places since we last checked.** superpowers
  went from 11 harnesses in 6.2.0 to 14 in 6.3.0, and Grok Build was one of the
  additions (`grok plugin install superpowers@xai-official --trust`). ponytail
  also ships `grok plugin install DietrichGebert/ponytail --trust`, so "no
  plugin mechanism" was false — the correct reason is user scope. GSD went from
  1.9.1 to 1.10.0 and gained `--kilo`.
- **Whether that `--kilo` meant our Kilo Code was unresolved for a long time.**
  Settled by measurement: the 71 entries `--kilo --local` writes into
  `.kilo/skills/` are all loaded by the installed Kilo Code
  (@kilocode/cli 7.3.45).
- **`definePlugin`'s default reason was routing around verification.** When
  `unsupported` is omitted, all 9 CLIs get "Claude Code plugin only" — and ECC,
  Understand Anything, and Matt Pocock all passed through unverified that way,
  all three falsely. ECC ships native `codex plugin add ecc@ecc` support and
  installs Gemini (`.gemini/`) and Kimi (`.kimi-code/`) project-locally through
  `install.sh --target`. Understand Anything even has a direct Copilot CLI
  plugin install. Matt Pocock's upstream documents `npx skills add` — the very
  registry route this repository already uses.
- **Their real reasons are now stated.** For ECC, Codex has only the single
  active `CODEX_HOME` and no project scope, while the rest are blocked by the
  284 entries in skills/ that would swamp the shared directory. Understand
  Anything is user-scoped through both install.sh and the copilot plugin. Matt
  Pocock is not missing upstream support — we chose the plugin route.
- **Stepping back onto the fallback now fails a test.** A real item that uses
  `item.unsupported.claudePlugin` or `claudeSkill` is rejected. Both keys stay
  as the contract of `definePlugin` and `defineSkill`; only the path where an
  item rides on them without checking upstream is closed.

Judgments that were already correct were left alone — gstack's `--host`
(codex, opencode, kiro), impeccable's supported-tools list, bkit's separate
distributions, and GSD's `--gemini`. That last one was confirmed by measurement
too: `--gemini --local` prints the 2026-06-18 sunset notice and creates no files.

- **One place that said "presumably" without evidence is gone too.** bkit's
  Gemini port was described as "presumably succeeds to Antigravity", which had
  no basis — bkit-gemini is still a Gemini CLI extension through v2.0.7 and its
  README never mentions Antigravity once. What replaces it is the measured
  fact: its last push was 2026-05-20, so it has had no update since the Gemini
  CLI sunset.

Two stale counts were corrected along the way — ECC 281 → 284, Matt Pocock
22 → 35.

## The Diagram Design skill item (2026-08-15, 1.11.0)

**All three items in the design-sense group handled screens, and the spot for
drawings was empty.** Architecture diagrams, flowcharts, and sequence diagrams
still shipped in the default Mermaid skin, and the moment one landed in a deck
it read as foreign to the brand.

- **`skill.diagram-design`** — draws 27 diagram types as self-contained HTML
  with inline SVG. It also takes `.drawio` and `.mmd` sources and redraws them
  under the same rules, and an onboarding path pulls brand colors and fonts
  from a website URL to rewrite `references/style-guide.md`.
- **Not one line of new wiring.** Upstream lays the skill out at
  `skills/diagram-design/SKILL.md`, which the existing registry route reads as
  is. The `name` in SKILL.md matches the directory too, so it never takes the
  frontmatter fallback that `skill.taste` walks.
- **Upstream also ships `.claude-plugin` and `.codex-plugin` manifests.** All
  the plugin route adds is three entries in `commands/` (`/export-diagram`,
  `/import-drawio`, `/import-mermaid`), and those are thin wrappers that
  delegate to `skills/…/references/` — the substance all arrives through the
  shared skill. In exchange we avoid per-CLI directories and all 10 CLIs see it
  at once.
- **A real install and removal moved 147 files** (1 SKILL.md + 104 assets + 39
  references + 3 scripts). If the body arrives without its references, the
  install looks successful while the rules have no substance.

Two things bite when writing in a non-Latin script. The default fonts
(Instrument Serif, Geist, Geist Mono) carry no CJK glyphs, so labels fall back
to a substitute and the font stack in `references/style-guide.md` has to be
swapped. And PNG export needs `pip install playwright` plus
`playwright install chromium` separately — the skill surfaces the instruction
and stops rather than installing either for you.

One more item file brings the published package from 140 files to 141.

## Restoring the provenance 1.10.0 lost (2026-08-14, 1.10.1)

**1.10.0 was published from a local machine instead of through the workflow.**
`--provenance` attaches only with CI's OIDC token, so the attestation chain
running since 1.6.0 broke at that one version. npm does not allow republishing
a version that already exists, so 1.10.0 itself cannot be repaired.

- **The tag is what publishes.** Pushing a tag starting with `v` runs the
  workflow from the checks through to the release, so calling `npm publish` by
  hand skips that path. 1.10.0 went up by hand, and the workflow that followed
  failed because it could not publish the same version twice.
- **`npm pack --dry-run --json` is now read in both shapes.** From npm 12 the
  result is an object keyed by package name rather than an array. A check that
  assumed only the array caught `undefined`, and all 10 tarball assertions
  failed at once — the check had fallen behind, not the artifact.
- **This fix does not ride along in the package.** `files` holds only
  `install.mjs`, `lib/`, `README.md`, and `LICENSE`, so `test/` is never
  published.

`1.10.1` ships the same 140 files as 1.10.0. The contents are unchanged; only
the provenance is added.

## The Hallmark skill item (2026-08-10, 1.10.0)

**The design-sense group held two items, and both stood on "make something
new".** `plugin.impeccable` carries a design language and `skill.taste` handles
landing pages. Scoring a screen that already exists, or rebuilding its structure
from scratch, was an empty spot.

- **`skill.hallmark`** — it has four verbs. The default builds new UI, `audit`
  scores existing code against the anti-patterns without editing, `redesign`
  keeps the copy, IA, and brand while throwing out the structure, and `study`
  extracts the design DNA from a screenshot or URL you admire. Everything runs
  through 21 themes and 57 slop-test gates.
- **`study` can also emit a portable `design.md`** — only when asked. It runs
  opposite to the DESIGN.MD tab, which fetches already-published brand documents
  into `design-md/<provider>/<name>/DESIGN.md`: this one extracts from a
  reference the user picked and writes it at the project root. The format is
  Hallmark's own convention, so it does not mix with what the tab fetches.
- **Not one line of new wiring.** Upstream lays the skill out as
  `skills/hallmark/SKILL.md`, so the existing registry path (`npx skills add …
  --agent universal --copy`) drops it straight into `.agents/skills/hallmark`.
- **The `name` in `SKILL.md` matches the directory name** — the very point where
  `skill.taste` diverged, so it was checked. It is found by name without falling
  back to the frontmatter scan.
- **All 106 files under `references/` are copied along with it** (measured
  2026-08-10). If only the skill body arrived and the references did not, the
  install would look successful while the substance of the rule-set was entirely
  missing — a real install and removal were each run once to confirm.
- **Upstream documents Cursor and Codex paths too, but they are per-CLI
  directories** (`.cursor/rules`, `~/.codex/skills`). One shared path covers all
  10 at once, so that route is not the narrower one — `supports` is every CLI.

`1.10.0` ships 140 files — the 139 of 1.9.0 plus the one item file.

## Splitting the documents into English and Korean (2026-08-03, 1.9.0)

**The screen and the logs were fully translated back in 1.2.0, yet the documents
that explain the tool were Korean-only.** A user who got past the first screen in
English was stopped at the very next step — following the link from the npm page
led to nothing they could read.

- **The base names belong to the English editions.** `AgentSetup-README.md` and
  `AgentSetup-README-CHANGES.md` are English, and the Korean editions carry
  `.ko.md`. The repository had already settled on English as the reference
  language (the catalog originates in English), and the links on the published
  package page point at those two names, so moving the files would break them
  outside the repository.
- **Links follow the language of the document.** The English usage doc links to
  the English changelog, the Korean usage doc to the Korean changelog. Only the
  language switcher sits at the head of each document as a single line — nowhere
  in the body does the language you are reading change out from under you.
- **The root `README.md` and `agent-installer/README.md` were matched to their
  sections' language.** The latter holds an English section and a Korean section
  in one file, so the same link appears twice — and until now both pointed at the
  Korean document. The changelog link, missing from both places, was added too.
- **Only one piece of Korean is left in the English editions.** It is
  `'미리보기'`, the string in the width-computation bug the 1.8.0 entry describes —
  that an 8-column Korean word was truncated in a column of width 7 is the fact
  itself, so translating it would break the explanation.

`1.9.0` ships with the same 139 files as 1.8.0. The split documents live only in
the repository; the only change that rides in the package is the links in
`agent-installer/README.md`.

## A key to leave, and the commit template choice drawn as radios (2026-08-02, 1.8.0)

**The screen was failing to say two things: how to leave, and the fact that the
two language editions exclude each other.** Quitting was only `Ctrl+C` (abort)
and `Esc` (up to three times), so there was nothing to learn as "the key to
leave", and the two editions of the commit template were drawn as bracketed
checkboxes, saying "you can turn both on".

- **`Ctrl+Q` is the dedicated quit key.** It leaves in one press from either
  focus, search box or list, and from the review screen too. The letter `q` was
  avoided for the same reason as `Ctrl+F` and `Ctrl+D` — pressing any character
  in the list moves you up to the search box. Raw mode turns off the terminal's
  flow control (`Ctrl+S`/`Ctrl+Q`), so it is not intercepted.
- **The quit hint is pinned to the far right of the hint line.** The rest of the
  hints get truncated from the tail in a narrow terminal, and that is exactly
  when "how do I get out of here" matters most — string guidance that may be
  truncated together with guidance that must never disappear, and the latter
  always goes first. The spot survives even when a status message replaces the
  hints. Verified down to 24 columns.
- **Mutually exclusive items are drawn as radios.** `[ ]` is a universal signal
  for "you can pick several", which is a lie for items where only one edition can
  sit in one file. Changed to `( )`/`(×)`. The inner glyph is left alone — `●`
  and `•` have ambiguous East Asian width and get drawn two columns wide in some
  terminals, pushing the column.
- **The group header states the target file and the rule together.** `Commit
  message template · .gitmessage.txt · pick one`. Previously it sat under "Way of
  working", where the header told you nothing about what you were choosing. The
  labels also lead with the distinguishing word (`English commit template`).
- **The status line announces when a sibling is turned off.** A checkbox flipping
  silently reads to the user as their own mistake — and if the search had put the
  sibling off screen, there was no way to even see what happened.
- **The target file is shown by both the detail panel and the list.** The flat
  `--list` has no group headers, so there was no way to know what was being
  touched, and searching for `.gitmessage` did not match.
- **Fixed truncation in the detail panel's label column (regression).** The width
  computation measured only 'wired'/'not wired', so the Korean '미리보기' (8
  columns) was cut to `미리…` in a column of width 7. `pad` discards overflow, so
  it disappears silently. Now the width is derived from every label that can sit
  in that column.

`1.8.0` ships with the same 139 files as 1.7.0 — no new files, only screen and
wording changes.

## Shipping the commit message template through the TUI (2026-08-02, 1.7.0)

**Of the repository conventions, only the commit message template was still
handed around by hand.** The bootstrap wires up `AGENTS.md` and `.agents/skills`,
but `.gitmessage.txt` — what the team actually looks at every day — had to be
copied by someone and hooked up with `git config` individually. The installer now
ships it the same way as any other item: decided by scan, installed by checking,
removed by unchecking.

- **The CONFIG tab and `config.gitmessage.en`/`config.gitmessage.ko`.** Writes
  the chosen language edition to the repository root and points
  `git config --local commit.template` at it. The decision looks at both file
  content and repository config — if the file is placed but the setting is empty,
  the template never appears, so it is marked `partially installed`, and
  submitting again with the item still checked fills in just the setting.
  `--local` is explicit so that the same value in a global `~/.gitconfig` cannot
  make this repository look installed.
- **The two language editions exclude each other.** There is only one target
  file, so turning both on lets the later one silently overwrite the earlier —
  two checkboxes on screen would be lying about one file on disk. Turning one on
  turns the sibling off (including a sibling hidden by the search), and `Ctrl+A`
  turns on only one from the group without beating an edition you already chose.
  Passing both to `--set` ends in an error asking which one you meant.
- **Hand-written templates are not overwritten.** Only a switch between the two
  editions this tool wrote counts as an overwrite; any other content already
  there means refusal — the same rule as the bootstrap's "never overwrite
  existing configuration files". Removal is symmetric: the file is deleted only
  when its content is our edition, and `commit.template` pointing at someone
  else's value is left alone. This rule is why the file you just wrote is not
  lost when changing language runs in the order `[install en → remove ko]`.
- **No CLI coverage indicator.** This item is a repository convention rather than
  CLI wiring, so the question "how many out of 10" does not even apply — the
  hint's coverage line, the detail panel's wiring table, and the CLI filter all
  skip it.
- **Tests guard the item label width.** The label slot is 24 columns and overflow
  is truncated silently — and the place that gets cut may be exactly the tag that
  distinguishes the items (`…(Englis…`), which is easy to miss by eye alone.

`1.7.0` ships with 139 files.

## Recording non-wiring reasons against upstream evidence (2026-08-02, 1.6.0)

**A blanket "Claude Code only" reason was false information for five items.**
Verifying the upstreams of superpowers, bkit, impeccable, gstack, and GSD against
primary sources (READMEs, install scripts, npm tarballs, local installations)
showed that all five tools support CLIs beyond Claude — it is true that the
wiring is Claude-only, but stating the reason as "exclusive" is false for the
CLIs the upstream does support.

- **`definePlugin` and `defineSkill` accept per-item non-wiring reasons.** Only
  the CLIs passed in are overridden; the rest are filled from the existing
  blanket reason — a formalization of a pattern ponytail was doing by hand, so
  items that pass nothing are unchanged.
- **Five items' reasons made precise per CLI.** superpowers: per-harness separate
  installs for 5 CLIs; bkit: separate distributions (bkit-codex, bkit-gemini) for
  2; impeccable: "upstream supports it, but the npx install breaks the shared
  `.agents/skills` link, so it is not wired" for 6; gstack: `./setup --host` for
  3; GSD: runtime flags for 4. CLIs with no upstream path at all are distinguished
  as "no official install path".
- **Reflected the Gemini CLI → Antigravity succession.** Google shut down Gemini
  CLI on 2026-06-18 and designated Antigravity CLI as its official successor.
  GSD's gemini reason is now "removed upstream (succeeded by --antigravity)", and
  bkit-gemini is recorded as presumed succeeded. Antigravity is not in the CLI
  list, so it is stated in superpowers' and GSD's notes.
- **Pitfalls for future extension pinned down in comments.** GSD `--uninstall`
  removes the default, claude, when no runtime flag is given. The
  `--host cursor`/`slate` from gstack's README are rejected by setup (exit 1).
  impeccable's junction destruction is by design, not a bug
  (`isInProjectProviderLink`).

`1.6.0` ships with 136 files.

## Detail panel and live progress bar (2026-08-02, 1.5.0)

**Information that had been crammed into one list row moves down into a detail
panel, and how much of the apply is left becomes visible.** In an 80-column
terminal, appending status, CLI coverage, and non-wiring reasons onto a single
hint line cut the tail off entirely. During apply the screen looked frozen for
minutes — external commands were in fact running in order, but there was no way
to know.

- **A detail panel below the list.** It unfolds the full text of the item under
  the cursor across several lines — which CLIs it is wired into (with config file
  paths for MCP), which ones are not and why (identical reasons grouped into
  one), plus note and description. The hint line keeps only status and
  `CLI n/10` coverage. Panel height is determined **by terminal size only**, not
  by the cursor — a height that changed as the cursor moved would make the list
  bounce. When there is not enough room, the panel drops out entirely. `Ctrl+D`
  expands it to full screen.
- **A CLI filter for the other direction.** `Ctrl+F`/`Ctrl+B` cycle through the
  CLIs and drop items not wired into that CLI out of the list entirely. Where the
  detail panel shows "where is this item wired", the filter answers from the
  opposite direction: "what works in this CLI". Letter keys (`c`, `d`) were
  avoided deliberately — pressing any character in the list focus moves you up to
  the search box, so assigning `c` to the filter would make it impossible to type
  `codex` as a query.
- **External command execution became asynchronous so a progress bar can be
  drawn.** The alt screen is kept during apply and redrawn every 100 ms — the
  running item, command, elapsed time, and `done/total` count all update live.
  When command execution was synchronous, the event loop was blocked and the
  screen could not be redrawn.
- **`Ctrl+C` stops only at item boundaries.** An abort is only a request — the
  item currently running finishes first. Killing a package install or file write
  mid-command would leave a half-installed state. Items not yet started are marked
  "skipped". Skipped does not count as failure — it is excluded from both the
  failure tally and the exit code. Stopping on purpose is different from something
  going wrong.
- **Non-interactive and CI runs use plain text.** With `--set` and piped input,
  progress streams one line per item instead of a bar — so as not to pollute logs
  with ANSI control characters. The bootstrap does synchronous file work, so
  instead of a bar it prefixes each log line with a `[n/total]` step number.

`1.5.0` ships with 136 files.

## Upstream notice for the bundled copies (2026-08-01, 1.4.0)

**Filling in the one piece that was missing from honoring MIT.** The 74 DESIGN.md
files carried for offline installation are copies from
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md), and upstream
is MIT. MIT permits redistribution but requires the copyright notice and
permission text to be included **with the copies**, and until now the package had
only a single source link in the README body. All 74 files are plainly a
substantial portion, so the notice is required.

- **`cache/awesome-design-md/LICENSE.md`.** Carries the upstream `LICENSE` text
  verbatim, with the source and "the original text is not modified" written
  above. The reason the file is not named `LICENSE` is that the publication check
  allows only one top-level `LICENSE` as an extensionless file — what satisfies
  the requirement is the content, not the name.
- **The pack test guards it.** It checks both that the file makes it into the
  tarball and that the copyright notice, permission text, and source link are
  actually in it. A single link line or an empty file does not pass — a silent
  omission would make the release itself violate the terms.
- **Bundle regeneration must not lose the notice.** `refresh-bundle` fetches the
  upstream `LICENSE` and compares it against ours, reporting any divergence. It
  does not overwrite automatically — our notice carries the source explanation we
  wrote, which would vanish if replaced by the original text, and a license change
  is something a human should look at and judge.

The files themselves contain no assets such as logos or fonts. They are color
hexes and prose analysis, and the body text actually says things like "this
typeface is proprietary, substitute an open-source one".

`1.4.0` ships with 134 files.

## Six new items and grouping by character (2026-08-01, 1.3.0)

**The classification you see while choosing changed from "what installs it" to
"what it does for you".** The tabs are PLUGIN·MCP·SKILL, i.e. installation
mechanisms. But within one tab, something that saves tokens sat next to something
that reviews your design, so there was no comparison to be made while choosing.
Character headers now appear inside the tabs — in the order **Token savings ·
Code understanding · Design sense · Way of working · External services**. It
simply reuses the group mechanism design.md already had, so the renderer was
untouched.

### Making unsupported CLIs visible **before** you choose

Until now the unsupported reason appeared **only on MCP items**. So a plugin that
goes into only two CLIs (`plugin.ponytail`) said not a single character on screen
about the other eight — there was no way to know while choosing, and it only came
out after applying.

- **`CLI n/10` goes right after the status.** The tail of the hint gets truncated
  in a narrow terminal, and that is exactly the moment you most want to know
  "does this item work in the CLI I use". **It is printed even when everything is
  supported** — no indicator and `10/10` mean different things. Without it, you
  cannot tell "we forgot" from "it all works" on screen.
- **The reason appears regardless of category.** CLIs with the same reason are
  grouped and written once, as in `Not wired in 9: codex·gemini·… — Claude Code
  only plugin`. If there is more than one reason, the split stays visible.
  Repeating it nine times only lengthens the lines and buries "what is missing
  and why".
- **It is attached to the pre-submit review screen too.** That is the last point
  where you can turn back. Items with full support stay quiet, though — a warning
  that becomes common is a warning nobody reads.

### The skill registry path — one install for 10 CLIs

The `--agent universal` project path of `npx skills add` (vercel-labs/skills) is
**`.agents/skills`** — the very directory this repository already uses as the
shared skills location. Claude, Kiro, and Grok reach it through the junction the
bootstrap creates, and the rest read that path natively, so **one install is seen
by all 10**. `--copy` leaves the real files behind — this is a place to commit and
share with the team, and links break after a clone.

- **`skill.caveman`** — cuts output tokens with caveman speech. Code and errors
  are left intact.
- **`skill.taste`** — an anti-slop frontend skill. The repository folder is named
  `taste-skill` while the `name` in `SKILL.md` is `design-taste-frontend`. The
  registry selects by name, so **judging by the directory name alone would keep
  reading it as 'not installed' even after installing it** — we read the
  frontmatter to find it.
- **`skill.karpathy`** — behavioral guidance that reduces over-engineering and
  vague completion criteria.

The registry's `remove` **prints "Done!" and still leaves the directory behind**
under `--agent universal` (measured). So removal deletes the leftover directory
ourselves, regardless of the command's result. Without that fallback, removal
looks successful and then reads as having come back to life on the next scan.

### The three shipped as plugins, and why

- **`plugin.ecc`** — ECC's `skills/` holds 281 entries. Installing it through the
  registry without `--skill` would cover the entire shared skills directory.
  Profile management is left to upstream and it is installed as a plugin.
- **`plugin.impeccable`** — the upstream multi-CLI path
  (`npx impeccable install --providers=… --scope=project`) is **not used**.
  Measurement showed that command replaces `.claude/skills` with a real
  directory, breaking the `.agents/skills` junction the bootstrap created — every
  shared skill vanishes from the Claude Code screen. On top of that, without both
  `--providers` and `--scope` it asks interactively, and on a non-TTY it silently
  chooses **global** and installs into the home directory.
- **`plugin.understand-anything`** — the `install.sh` for other CLIs clones into
  `~/.understand-anything` and links from the home directory. That is user scope,
  so it cannot be an item of this repository.

`caveman-code` was not added as an item. It is not a skill or a setting but a
**standalone terminal agent** installed with `npm install -g` — there is nothing
to wire inside the repository.

### On Node 20 not a single test was running

This surfaced the first time the release workflow ran. **Glob expansion in
`node --test "test/*.test.mjs"` is a Node 21+ feature**, so on 20 — declared as
our floor — it is treated as a literal path and ends in `Could not find`. The
tests did not fail; **not one of them ran**. Switched to convention-based
discovery (`node --test`), which behaves identically on every version from 18 up.

Running on 20 for the first time then showed a dependency integration test whose
premise had collapsed. **Node 20's `cpSync` on Windows passes extended-length
paths (`\\?\D:\…`) to the filter.** `relative()` cannot establish a relation with
`PKG_ROOT` so an absolute path comes back, its first segment becomes `\\?\D:`,
and no exclusion matches at all. `node_modules` was copied wholesale, so it was no
longer "a tree without dependencies", and it passed with the subject of the test
gone. We now strip the prefix before comparing, and **pinned the premise itself as
an assertion** — if the exclusion breaks again, it fails right there.

The third surfaced on Linux. The `parseDirSpec` check was using `D:\a=b\c`, but
backslash is a separator **only on Windows**. On POSIX that string is a filename
with no separator at all, so `basename` returning the whole thing is correct,
while the test read it as a failure. What is under test is "if there is a
separator in the id slot, do not treat it as an id", so it is now tested with
slash paths, and the backslash case is checked separately on Windows. The code was
right on both platforms from the start — it was the test that mistook one for the
other.

`1.3.0` ships with 133 files.

## Three token-saving tools at repository scope (2026-08-01, 1.3.0)

**Wiring the same tools at repository scope rather than user scope, and into
every CLI they can attach to rather than Claude Code alone.** Ponytail, Graphify,
and Headroom each address a different place tokens leak — in order, the amount
the model **writes**, the amount **read** while searching, and the amount actually
**sent**. All three upstream install guides use `--scope user` or
`~/.claude/skills` and only look at Claude Code. That leaves the session of the
colleague next to you leaking just the same.

- **`mcp.graphify` and `mcp.headroom` — registered into 10 CLIs' project settings
  at once.** They ride exactly the same path as the existing MCP items.
  `headroom` goes in with the same contract (`headroom mcp serve`) as the
  `server.json` upstream ships, and `graphify-mcp` takes no arguments and reads
  `graphify-out/graph.json` from the working directory, so the graph stays inside
  the repository too.
- **`plugin.ponytail` — two places, Claude Code and OpenCode.** Claude Code
  installs with `--scope project` like the existing plugin items, falling back to
  recording in `.claude/settings.json`. OpenCode **appends** one entry to the
  `plugin` array in `opencode.jsonc` — this is the only code in this repository
  that touches an array, so preservation of existing entries, idempotence, and
  refusal when `plugin` is not an array are all pinned down by tests. Overwriting
  wholesale would silently erase settings the user wrote.
- **Binaries are not installed.** The two MCP items assume `graphify-mcp` and
  `headroom` are on PATH, and when they are not, the item note shows the
  `uv tool install` command. Same rule as `mcp.codebase-memory` — the installer
  only wires.
- **The proxy (`headroom wrap claude`) is not an item.** It is a way of running
  with nothing to put in repository settings, so it is documented only as a note.

Ponytail is not wired into the other 8 CLIs. Codex, Copilot, and Gemini have
upstream install paths but all of them are user-scoped, and the rest have no
plugin mechanism at all, so the rules would have to be transcribed into
`AGENTS.md`. Both are written on screen as the item's unsupported reason — a
visible reason beats a silent omission.

## Internationalization (2026-07-31, 1.2.0)

**Fixed what stopped anyone who does not read Korean at the very first screen.**
It was published to npm, but roughly 289 user-visible strings were all in Korean.
If you cannot read the first line of `npx @rch4com/agent-setup --help`, there is
no second.

- **English is the reference language.** Every key originates in the English
  catalog and Korean is second. The language for a run is decided in the order
  `--lang <en|ko>` → `AGENT_SETUP_LANG` → `lang` in the install record → OS
  detection → `en`, earlier winning. Unsupported values are skipped silently, but
  a value **explicitly given** with `--lang` is rejected — what the user typed in
  must not be silently ignored.
- **The translation scope is everything the user sees.** 5 kinds of `--help`, the
  TUI, bootstrap and install logs, `status` and `update` output, and error
  messages.
- **No global singleton.** After the locale is settled, `t` is built and passed
  down on the options bag that already existed. That way the pure reducer
  (`state.mjs`) still imports nothing, and locales do not contaminate each other
  when tests run in file-level parallel. **Zero new dependencies** — `lib/i18n/`
  is a leaf module that imports nothing, so `bootstrap.isolation.test.mjs`
  upholds that invariant as-is.
- **Language cycles with Enter on the first row of the interactive screen.** No
  separate popup. Even trapped in a language you cannot read, repeating Enter
  gets you out. The chosen value is saved immediately to `lang` in
  `.agent-kit/agent-setup.json` and carries into the next run, creating the record
  if there is none. A write failure does not kill the screen — language is an
  incidental setting, and dying here would make the installer itself unusable.
- **The record format version stays at 1.** `lang` is an optional field addition,
  so an older tool reading it simply ignores it. Bumping it would have blocked
  every repository holding an existing record.
- **Where the options bag does not reach, `LocalizedError`.** Repository detection
  and record-reading errors can be thrown *before* the locale is settled. The
  `.message` is filled in English at construction so the stack trace survives, and
  a single entry point re-renders `.key` in the active locale.
- **Sections and groups were split from display strings into ids.**
  `SECTION_ORDER` was the sort key, the tab name, and an element of the state all
  at once, so translating it broke the ordering. The search text now includes the
  id, the English label, and the current-language label together, so `plugin`
  finds it even on a Korean screen.
- **Only the launcher error text is an exception, printed bilingually.** It is the
  line printed when Node is absent, where the i18n machinery cannot run at all.
  `-Lang` was added to `setup-agents.ps1` — `.sh` passes it through automatically
  with `"$@"`, but `.ps1` uses named parameters, so `--lang` never reached it.

Comments and commit messages stay in Korean. They are for maintainers, and
`.gitmessage.txt` requires a Korean body. The bodies of the 76 bundled `DESIGN.md`
files are provider originals and are not translation targets either.

### Pinning missing translations down with tests

There are two directions. The English locale is run across the whole CLI surface
and asserted to contain no Hangul in its output (`i18n.en.test.mjs`), and **the
reverse** — English sentences left in Korean output — is checked too
(`i18n.ko.test.mjs`). While nobody was looking at the latter, `writeRecord`'s
English fallback was printing one line in English right in the middle of Korean
output.

The catalogs themselves are checked as data: whether en and ko have the same key
sets, the same `{placeholder}` sets, and the same value types; whether `t()`
throws on unknown keys or missing placeholder values; and whether row labels'
display width stays within `LABEL_WIDTH` in both locales. The width constant is
imported from `render.mjs` rather than copied — two values drifting apart would
silently render the rule meaningless.

`1.2.0` ships with 124 files.

## Install record and update (2026-07-30, 1.1.0)

**Fixed a state in which a file, once created, was never updated.** `files` in
`manifest.mjs` was "create only if absent" and `blocks` appended only when the
marker was missing, so improvements to a template had no way of reaching an
existing repository.

- **The install record `.agent-kit/agent-setup.json`.** It is committed and holds
  the wiring version, the chosen items, and a hash per managed file. The
  documented "there is no state file" principle split in two — **the scan is
  reality, the record is intent**. The record does not replace the decision; it
  adds reproducibility and version pinning.
- **`update`.** Moves only files matching the recorded hash to the newest
  template, leaving files the user edited alone and reporting them as drift. It
  creates missing files, which is how support for new tools arrives through this
  path. `--force` overwrites drifted files too, but is allowed **only when the
  working tree is clean** — git is the only way to undo it.
- **`status`.** Shows intent, reality, and version side by side, with `--json` for
  use in CI. The update decision is obtained by calling the same function as
  `update` in dry-run mode, so the two commands cannot give different answers.
- **`bootstrap --adopt`.** Brings repositories that copied the installer into the
  record system. It creates no files and adopts **only files identical to the
  template**. Stamping a hash onto current content as-is would disguise a file you
  had already edited as "exactly what we wrote", and the next `update` would blow
  it away.
- **Hashes are computed after normalizing line endings to LF.** `.gitattributes`
  is `text=auto`, so a Windows working tree is CRLF. Hashing the raw bytes would
  make every file show up as drift in that environment.
- **Blocks are replaced between the markers only.** Anything the user wrote around
  them in `CLAUDE.md` and `GEMINI.md` survives.

The existing commands (`bootstrap`, `--list`, `--set`, `design`) work as before.
A version mismatch is only reported; a strict check that aborts was deferred to
the next step that reshapes the command surface — aborting here would kill
existing users' runs.

### Removing foreign matter from the published package

In the `1.1.0` publish log,
`lib/items/.omc/state/sessions/…/pre-tool-advisory-throttle.json` was found riding
in the tarball and removed. It is a session state file created by a local tool and
it went into `1.0.0` as well (1 of 116 files). Its content is only hook throttle
timestamps and advisory text, so there are no secrets.

The cause is that **`files` in `package.json` takes precedence over
`.gitignore`**. The `.omc/` at `.gitignore:435` worked correctly for git and kept
it untracked, but because `lib/` was listed in `files`, npm unconditionally took
everything under it. `.npmignore` cannot block it either.

The pack verification test was looking only at top-level paths and missed what was
lodged under `lib/`. Two more checks were added.

- Failure if **any segment of the path starts with `.`**
- Failure if the extension is anything other than `.mjs`, `.json`, `.md`, or
  `LICENSE`

`1.1.0` ships with 119 files.

## npm publication (2026-07-30)

It became usable without copying files. The installer is published to npm as
`@rch4com/agent-setup`.

The name is scoped because **the unscoped `agent-setup` cannot be used**. npm
blocks similar names, and `agent-setup` normalizes to the same thing as the
existing package `agentsetup`, so publishing is rejected with a 403. That
`npm view agent-setup` returns a 404 is not enough to confirm it can be published
— the restriction applies only at publish time. The `bin` name was left as
`agent-setup`, so the command after installation is short.

- **Wiring with `npx @rch4com/agent-setup bootstrap`.** The existing commands
  (`bootstrap`, `--list`, `--set`, `design`) work as before. The CLI surface did
  not change at this step.
- **Vendoring dropped out of what a team repository commits.** `agent-installer/`
  and the two launchers became optional. In offline environments, or when a
  committed entry point is needed, committing them alongside still works exactly
  as before.
- **Tests guard the tarball's contents.** Publication cannot be undone, so a
  top-level path whitelist, a ban on `test/` and `scripts/` leaking, the presence
  of the DESIGN.md bundle, and a 2 MiB ceiling are checked with
  `npm pack --dry-run --json`. The measured tarball is 0.58 MB, so the 76-file
  DESIGN.md bundle ships as-is.
- **MIT license added.** `files` cannot reach outside the package directory, so a
  copy sits at the root and in `agent-installer/`, and a test binds the two files
  so they cannot diverge.

## Second review pass applied (2026-07-30)

Items left over from the earlier review. Four things changed in behavior.

- **Link-escape checks on the MCP and plugin write paths.** Only the bootstrap,
  design.md, and gstack were doing realpath checks, while the widest write paths
  of all — MCP registration/removal across 10 CLIs and the plugin record in
  `.claude/settings.json` — remained at lexical checks. If a `.codex` or `.claude`
  inside the repository was a junction pointing at the home directory, choosing a
  single item created or modified global configuration.
- **Windows shell quoting.** Changed from quoting only when there is a space to
  always quoting. Under `D:\R&D\repo`, the gstack clone command split in two at
  the `&`. The POSIX side moved to single quotes, which also blocks `$(...)` and
  backticks.
- **Remote response size cap (8 MiB).** A time limit does not stop a response
  where "data keeps arriving", so an endless body was read until memory filled.
  The bundle regeneration script moved from bare `fetch` to `netFetch` so it is
  subject to both limits.
- **Rejection of mutually exclusive flags.** `--list --set a` silently discarded
  `--set`, and `design --preview x --set y` discarded `--set`. They are rejected
  for the same reason unknown arguments are.

Beyond that, bidi overrides and zero-width Unicode formatting characters are
stripped together from remote text that goes to the screen; the unused dependency
`@clack/prompts` was deleted (the TUI uses only the Node standard library); and
the undocumented `.kilocode/mcp.json` and the bundle count (76) were corrected in
the docs.

## Code and documentation review applied (2026-07-29)

Items from the full review. Four things changed in behavior.

- **Blocked command injection in preview.** The Windows opener used
  `cmd /c start`, so an `&` in a name coming from a remote README executed as a
  command. Three layers now block it — webUrl encoding, catalog name validation,
  and rundll32, which does not go through a shell — and only http(s) URLs or paths
  that actually exist may be opened.
- **`.vscode/settings.json` negation entry added.** It is the file where
  `chat.useAgentsMdFile` lives, and in repositories that ignore `.vscode/*` it was
  not committed and therefore never propagated to the team.
- **Argument handling.** The root and design parsers changed from ignoring unknown
  arguments to rejecting them, and value flags were unified to accept the
  `--flag=value` form too. `--help` was added at the root, and the discarded
  `--skill-mode` is now passed through to the interactive screen.
- **Link-escape checks on the installer's write paths.** design.md
  install/removal, gstack clone/delete, and `.gitignore` writes were doing only
  lexical checks.

Beyond that, dry-run now reports MCP and design.md changes, network calls got a
20-second limit, and control characters in remote text are kept off the screen.
The docs corrected or newly documented the `--tui` naming, Copilot's differing
stdio MCP format, and the third-party commands the installer runs.

## GitHub Copilot support (2026-07-29)

- GitHub Copilot CLI and VS Code Copilot added to the supported tools. Both read
  the root `AGENTS.md` and `.agents/skills` natively, so no import wiring or skill
  adapter is needed.
- Project MCP is `.github/mcp.json` for Copilot CLI (`mcpServers`, local servers
  as `type: "local"`) and `.vscode/mcp.json` for VS Code (`servers`, local servers
  as `type: "stdio"`). The installer's MCP registration targets grew from 8 to 10.
- `.github/copilot/settings.json` was created as the place for team-shared
  settings, and the personal override
  `.github/copilot/settings.local.json` is `.gitignore`d.
- VS Code needs the `chat.useAgentsMdFile` setting to read `AGENTS.md`, so the key
  is added to `.vscode/settings.json` only when absent (existing values
  preserved). For this, an `ensureJsonKeys` executor was added to the bootstrap —
  handled by text insertion with no external dependency, preserving comments and
  formatting.
- Because `VisualStudio.gitignore` ignores `.vscode/*`, the negation entry
  `!.vscode/mcp.json` was added alongside.
- Cloud coding agents are out of scope — their instructions are already covered by
  `AGENTS.md`, and MCP is configured in GitHub web settings rather than in
  repository files.

## Antigravity support (2026-07-18)

- Antigravity (Google agent IDE/CLI) added to the supported tools. It natively
  recognizes the root `AGENTS.md` and the `.agents/` directory, so the existing
  shared `AGENTS.md` and `.agents/skills` are used as-is — no import wiring,
  adapter, or new files needed.
- MCP is configured only in the home-global location
  (`~/.gemini/config/mcp_config.json`), and there is no project-scope MCP file, so
  it falls outside the script's scope → excluded from agent-installer's project MCP
  registration targets as well.
- Reflected only in generated document wording and the tool list in the completion
  summary (no structural change).
- The request to apply a root `.mcp.json` was declined — checking Google's official
  forum confirmed Antigravity does not support project-scope MCP (it is a feature
  request) and does not read a root `.mcp.json` (that claim was an error in an
  unofficial brain note).

## Matt Pocock skills plugin item (2026-07-17)

- `plugin.mattpocock-skills` added to agent-installer — installs the
  `mattpocock-skills@mattpocock` plugin (22 engineering and productivity skills)
  from the Claude Code marketplace `mattpocock/skills` at project scope.

## Grok Build support (2026-07-17)

- Grok Build (xAI grok CLI) added to the supported tools. It reads the root
  `AGENTS.md` natively, so no import wiring is needed.
- Project settings `.grok/config.toml` created (project scope covers only
  mcp_servers, plugins, and permission rules).
- `.grok/skills` set up as a junction/link/copy of `.agents/skills` and added
  automatically to `.gitignore`.
- A grok MCP adapter added to agent-installer — MCP items are now registered into
  8 CLIs' project settings at once.
- The official MiniMax CLI (`mmx`) is excluded from support because it is not a
  coding agent (it has no project conventions). A skill install item was
  considered and rolled back.

## agent-installer added (2026-07-17)

- Added `agent-installer/`, a self-contained console tool that installs/removes
  plugins, MCP servers, and skills chosen with checkboxes. It decides by scanning
  the actual config files with no state file, and supports the non-interactive
  `--list`, `--dry-run`, and `--set` modes.

## Kimi Code support

- Uses the root `AGENTS.md` and `.agents/skills` natively.
- Project MCP file `.kimi-code/mcp.json` created.
- The machine-specific `.kimi-code/local.toml` added to `.gitignore`.

## Kilo Code / Kiro support

- Project-local `kilo.jsonc` and `.kiro/settings/mcp.json` created.
- `.kiro/skills` set up as a junction/link/copy of `.agents/skills`.
- Nothing is written to the user home directory or global agent settings.
