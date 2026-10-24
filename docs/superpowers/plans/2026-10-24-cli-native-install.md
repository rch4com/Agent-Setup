# CLI 네이티브 명령 기반 설치 구조 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** agent-installer가 설정 파일을 직접 편집하는 대신 각 LLM CLI의 공식 설치 명령을 실행(또는 출력)하게 하고, 지원 CLI를 Claude Code·Codex·OpenCode·Antigravity로 줄인다.

**Architecture:** 항목은 CLI·범위별 명령 목록(레시피)을 담은 데이터다. `bindScope`가 레시피를 지금 엔진·TUI가 쓰는 항목 모양(`detect/install/uninstall` + `steps`)으로 바꾸고, 실행 모드와 출력 모드가 같은 `steps()`에서 명령을 얻는다. 감지는 CLI 목록 명령을 스캔당 한 번씩 캐시하는 `probe`가 맡는다.

**Tech Stack:** Node.js ≥20 ESM, `node:test`, 기존 의존성(`jsonc-parser`)만.

**Spec:** `docs/superpowers/specs/2026-10-24-cli-native-install-design.md`

## Global Constraints

- 지원 CLI id: `claude`, `codex`, `opencode`, `antigravity`(실행 파일 `agy`). 이 순서가 표시·실행 순서다.
- 범위 값: `project`(기본), `user`(`--global`).
- 새 production 의존성 금지. `jsonc-parser`·`smol-toml` 외 추가 없음(`smol-toml`은 남은 사용처가 없으면 package.json에서 빼지 않는다 — 승인 없는 의존성 변경 금지).
- 부트스트랩 경로(`install.mjs`의 정적 import, `lib/bootstrap/*`, `lib/i18n/*`, `lib/args.mjs`, `lib/context.mjs`)는 외부 의존성을 import하지 않는다(`bootstrap.isolation.test.mjs`).
- i18n: 새 키는 `lib/i18n/catalog/en.mjs`와 `ko.mjs`에 같은 자리표시자로 함께 넣는다(`i18n.test.mjs`가 대칭을 검사).
- 사용자 문구·주석은 한국어(ko 카탈로그)와 영어(en 카탈로그) 각각. 코드 주석은 주변 코드처럼 한국어.
- 커밋 메시지: `<type>(<scope>): <한국어 제목>` 50자 이내, 본문 72자 줄바꿈, 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 작업 브랜치: `refactor/cli-native-install`.
- 버전: `agent-installer/package.json` → `2.0.0`.
- OpenCode는 이 머신에서 실행되지 않는다 — OpenCode 경로는 단위 테스트와 출력 모드로만 검증하고 보고에 "미검증"으로 적는다.

## Review Focus

- CLI는 PATH에 있지만 목록 명령이 실패(로그인 만료·네트워크) → 그 CLI를 `absent`로 보고 재설치하면 안 된다. 감지 실패로 표시하고 단계에서 뺀다 (Task 3 테스트).
- Windows에서 `opencode run` 지시문에 큰따옴표가 섞이면 `shellQuote`가 던진다 → 지시문은 큰따옴표 없이 만든다 (Task 4 테스트).
- 다른 저장소에 `--scope project`로 깐 Claude 플러그인이 이 저장소에서 설치됨으로 읽히면 안 된다 — `projectPath` 대조 (Task 1 테스트).
- `--global --set a`가 목록 밖 전역 항목을 지우면 안 된다 (Task 7 테스트).
- 일부 CLI만 설치된 항목을 다시 설치하면 빠진 CLI 단계만 돈다. 마켓플레이스 "이미 등록됨" 실패는 무시된다 (Task 3 테스트).

---

### Task 1: CLI 실행 파일 정보와 감지 캐시(probe)

**Files:**
- Modify: `agent-installer/lib/clis.mjs` (네 CLI에 `bin`, 파일 끝에 `TARGET_CLI_IDS`)
- Create: `agent-installer/lib/probe.mjs`
- Create: `agent-installer/test/fixtures/probe/claude-plugin-list.json`, `codex-plugin-list.json`, `codex-mcp-list.json`, `agy-plugin-list.json`, `agy-mcp-list.txt`, `skills-list.json`
- Test: `agent-installer/test/probe.test.mjs`

**Interfaces:**
- Produces:
  - `CLIS[id].bin: string` (claude→`claude`, codex→`codex`, opencode→`opencode`, antigravity→`agy`)
  - `TARGET_CLI_IDS: string[]` = `['claude','codex','opencode','antigravity']` (Task 6에서 `CLI_IDS`로 흡수되고 삭제)
  - `onPath(bin, { env, platform, exists }) → boolean`
  - `parseAgyMcpList(text) → string[]`
  - `opencodeConfigFile({ root, scope, home, env }) → string`, `readOpencodeConfig(opts) → { file, data }`
  - `createProbe({ root, scope, exec, env, home, platform }) → Probe`
  - `Probe`: `{ root, scope, home, has(cli) → boolean, claudePlugin(ids) → Promise<boolean>, codexPlugin(id), agyPlugin(name), opencodePlugin(module), mcp(cli, name), skill(name), exists(rel) → boolean, dirHasPrefix(rel, prefix) → boolean }`

- [ ] **Step 1: 픽스처 작성** (이 머신 실측 출력을 잘라 익명화)

`test/fixtures/probe/claude-plugin-list.json`:
```json
[
  { "id": "caveman@caveman", "scope": "user", "enabled": true, "projectEnabled": false },
  { "id": "cli-anything@cli-anything", "scope": "project", "enabled": false, "projectPath": "C:\\Other\\repo", "projectEnabled": false },
  { "id": "ponytail@ponytail", "scope": "project", "enabled": true, "projectPath": "__ROOT__", "projectEnabled": true }
]
```
`codex-plugin-list.json`:
```json
{ "installed": [
  { "pluginId": "ponytail@ponytail", "name": "ponytail", "installed": true, "enabled": true },
  { "pluginId": "latex@openai-bundled", "name": "latex", "installed": false, "enabled": false }
] }
```
`codex-mcp-list.json`:
```json
[ { "name": "codebase-memory", "enabled": true, "transport": { "type": "stdio", "command": "codebase-memory-mcp", "args": [] } } ]
```
`agy-plugin-list.json`:
```json
[ { "name": "superpowers", "enabled": true, "version": "6.4.1", "source": "antigravity" } ]
```
`agy-mcp-list.txt`:
```
NAME                 TYPE   STATUS   COMMAND/URL
codebase-memory      stdio  enabled  codebase-memory-mcp
notion               http   enabled  https://mcp.notion.com/mcp
```
`skills-list.json`:
```json
[ { "name": "find-skills", "path": "/home/u/.agents/skills/find-skills", "scope": "global", "agents": ["Claude Code", "Codex"] } ]
```

- [ ] **Step 2: 실패하는 테스트 작성** — `test/probe.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProbe, onPath, parseAgyMcpList, opencodeConfigFile } from '../lib/probe.mjs'

const FIX = join(import.meta.dirname, 'fixtures', 'probe')
const fixture = (name) => readFileSync(join(FIX, name), 'utf8')

// 명령 문자열 → 출력. 부른 명령을 calls에 남겨 캐시를 검사한다.
function fakeExec(routes) {
  const calls = []
  const exec = async (cmd, args) => {
    const key = [cmd, ...args].join(' ')
    calls.push(key)
    if (!(key in routes)) return { ok: false, output: `unexpected ${key}` }
    const out = routes[key]
    return out instanceof Error ? { ok: false, output: out.message } : { ok: true, output: out }
  }
  return { exec, calls }
}

function tempDirs() {
  const root = mkdtempSync(join(tmpdir(), 'probe-root-'))
  const home = mkdtempSync(join(tmpdir(), 'probe-home-'))
  return { root, home }
}

const allOnPath = { PATH: '' }
const has = () => true

test('onPath는 PATH 디렉터리에서 실행 파일을 찾는다 (win32는 PATHEXT)', () => {
  const seen = new Set(['/bin/claude', 'C:\\bin\\agy.EXE'])
  const exists = (p) => seen.has(p)
  assert.equal(onPath('claude', { env: { PATH: '/bin' }, platform: 'linux', exists }), true)
  assert.equal(onPath('codex', { env: { PATH: '/bin' }, platform: 'linux', exists }), false)
  assert.equal(onPath('agy', { env: { PATH: 'C:\\bin', PATHEXT: '.CMD;.EXE' }, platform: 'win32', exists: (p) => seen.has(p.replace('/', '\\')) }), true)
})

test('parseAgyMcpList는 표의 첫 열만 이름으로 읽는다', () => {
  assert.deepEqual(parseAgyMcpList(fixture('agy-mcp-list.txt')), ['codebase-memory', 'notion'])
  assert.deepEqual(parseAgyMcpList(''), [])
})

test('claudePlugin은 범위와 projectPath까지 맞아야 설치됨이다', async () => {
  const { root, home } = tempDirs()
  const list = fixture('claude-plugin-list.json').replace('"__ROOT__"', JSON.stringify(root))
  const { exec, calls } = fakeExec({ 'claude plugin list --json': list })
  const project = createProbe({ root, scope: 'project', exec, home, env: allOnPath })
  assert.equal(await project.claudePlugin(['ponytail@ponytail']), true)
  // 다른 저장소에 project 범위로 깐 것은 이 저장소의 설치가 아니다.
  assert.equal(await project.claudePlugin(['cli-anything@cli-anything']), false)
  assert.equal(await project.claudePlugin(['caveman@caveman']), false)
  assert.equal(calls.length, 1, '목록 명령은 스캔당 한 번만 돈다')
  const user = createProbe({ root, scope: 'user', exec, home, env: allOnPath })
  assert.equal(await user.claudePlugin(['caveman@caveman']), true)
})

test('codex·agy 목록과 MCP를 이름으로 대조한다', async () => {
  const { root, home } = tempDirs()
  const { exec } = fakeExec({
    'codex plugin list --json': fixture('codex-plugin-list.json'),
    'codex mcp list --json': fixture('codex-mcp-list.json'),
    'agy plugin list --json': fixture('agy-plugin-list.json'),
    'agy mcp list': fixture('agy-mcp-list.txt'),
  })
  const p = createProbe({ root, scope: 'user', exec, home, env: allOnPath })
  assert.equal(await p.codexPlugin('ponytail@ponytail'), true)
  assert.equal(await p.codexPlugin('latex@openai-bundled'), false, 'installed:false는 미설치')
  assert.equal(await p.mcp('codex', 'codebase-memory'), true)
  assert.equal(await p.agyPlugin('superpowers'), true)
  assert.equal(await p.mcp('antigravity', 'notion'), true)
  assert.equal(await p.mcp('antigravity', 'vercel'), false)
})

test('Claude MCP는 .mcp.json(project)·~/.claude.json(user)을 읽기만 한다', async () => {
  const { root, home } = tempDirs()
  writeFileSync(join(root, '.mcp.json'), '{ "mcpServers": { "notion": { "type": "http", "url": "x" } } }')
  writeFileSync(join(home, '.claude.json'), '{ "mcpServers": { "vercel": { "type": "http", "url": "y" } } }')
  const { exec, calls } = fakeExec({})
  assert.equal(await createProbe({ root, scope: 'project', exec, home, env: allOnPath }).mcp('claude', 'notion'), true)
  assert.equal(await createProbe({ root, scope: 'user', exec, home, env: allOnPath }).mcp('claude', 'vercel'), true)
  assert.equal(await createProbe({ root, scope: 'user', exec, home, env: allOnPath }).mcp('claude', 'notion'), false)
  assert.deepEqual(calls, [], 'claude mcp list는 서버마다 연결을 검사해 쓰지 않는다')
})

test('OpenCode는 프로젝트 opencode.jsonc·전역 ~/.config/opencode를 읽는다', async () => {
  const { root, home } = tempDirs()
  writeFileSync(join(root, 'opencode.jsonc'), '{\n // c\n "plugin": ["@dietrichgebert/ponytail"], "mcp": { "graft": {} } }')
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(join(home, '.config', 'opencode', 'opencode.json'), '{ "mcp": { "notion": {} } }')
  const { exec } = fakeExec({})
  const proj = createProbe({ root, scope: 'project', exec, home, env: {} })
  assert.equal(await proj.opencodePlugin('@dietrichgebert/ponytail'), true)
  assert.equal(await proj.mcp('opencode', 'graft'), true)
  const user = createProbe({ root, scope: 'user', exec, home, env: {} })
  assert.equal(await user.mcp('opencode', 'notion'), true)
  assert.equal(opencodeConfigFile({ root, scope: 'user', home, env: { XDG_CONFIG_HOME: join(home, 'x') } }), join(home, 'x', 'opencode', 'opencode.json'))
})

test('스킬: project는 .agents/skills 스캔, user는 npx skills list -g --json', async () => {
  const { root, home } = tempDirs()
  mkdirSync(join(root, '.agents', 'skills', 'caveman'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'caveman', 'SKILL.md'), '---\nname: caveman\n---\n')
  const { exec } = fakeExec({ 'npx -y skills@latest list -g --json': fixture('skills-list.json') })
  assert.equal(await createProbe({ root, scope: 'project', exec, home, env: {} }).skill('caveman'), true)
  assert.equal(await createProbe({ root, scope: 'user', exec, home, env: {} }).skill('find-skills'), true)
})

test('목록 명령이 실패하면 조회가 던진다 — 호출부가 감지 실패로 처리한다', async () => {
  const { root, home } = tempDirs()
  const { exec } = fakeExec({ 'codex plugin list --json': new Error('not logged in') })
  const p = createProbe({ root, scope: 'user', exec, home, env: {} })
  await assert.rejects(() => p.codexPlugin('x@y'), /not logged in/)
})

test('exists·dirHasPrefix는 저장소 기준 상대 경로다', () => {
  const { root, home } = tempDirs()
  mkdirSync(join(root, '.codex', 'skills', 'gsd-plan'), { recursive: true })
  const p = createProbe({ root, scope: 'project', exec: async () => ({ ok: false, output: '' }), home, env: {} })
  assert.equal(p.exists('.codex/skills'), true)
  assert.equal(p.dirHasPrefix('.codex/skills', 'gsd-'), true)
  assert.equal(p.dirHasPrefix('.opencode/skills', 'gsd-'), false)
  void has
})
```

- [ ] **Step 3: 실패 확인**

Run: `cd agent-installer && node --test test/probe.test.mjs`
Expected: FAIL — `Cannot find module '../lib/probe.mjs'`

- [ ] **Step 4: `lib/clis.mjs`에 `bin`과 `TARGET_CLI_IDS` 추가**

`claude`·`codex`·`opencode`·`antigravity` 항목에 각각 `bin: 'claude'`, `bin: 'codex'`, `bin: 'opencode'`, `bin: 'agy'`를 `label` 다음 줄에 넣는다. 파일 끝에 추가:
```js
// 2.0.0에서 남는 네 CLI. 레시피 모듈이 먼저 이 목록을 쓰고, 항목 이전(Task 6)에서
// CLIS가 이 넷으로 줄면 CLI_IDS와 같아져 사라진다.
export const TARGET_CLI_IDS = ['claude', 'codex', 'opencode', 'antigravity']
```

- [ ] **Step 5: `lib/skills-registry.mjs`로 스킬 디렉터리 보조 함수 분리**

`lib/catalog.mjs`에서 `SHARED_SKILLS`, `skillDirs`, `findSkillDir`, `isSafeSkillName`, `SKILLS_LOCK`, `sourceKey`, `readLock`, `lockedSkills`, `pruneLock`를 주석째 그대로 잘라 `lib/skills-registry.mjs`로 옮기고 전부 `export`한다. 필요한 import(`existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync`, `join`, `repoPath, repoPathStrict`, `escapeRegExp, isSafeSegment`)도 함께 옮긴다. `catalog.mjs`는 `import { SHARED_SKILLS, findSkillDir, isSafeSkillName, lockedSkills, pruneLock } from './skills-registry.mjs'`로 바꾸고, 더는 쓰지 않는 import를 지운다. `catalog.registry.test.mjs`가 그대로 통과해야 한다.

- [ ] **Step 6: `lib/probe.mjs` 구현**

```js
// 감지 질의. 항목 detect는 여기 캐시만 조회한다 — CLI 목록 명령은 스캔
// 한 번에 질의마다 한 번만 돈다. 쓰기는 하지 않는다: 읽는 파일도 CLI가
// 소유한 설정이라, 고치는 일은 그 CLI의 명령이 맡는다.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { CLIS } from './clis.mjs'
import { readJson } from './jsonfile.mjs'
import { findSkillDir } from './skills-registry.mjs'

// 목록 명령 하나에 주는 시간. 설치 명령(10분)과 달리 목록은 금방 끝나야
// 정상이다 — 멈춘 CLI 하나가 화면 전체의 스캔을 붙잡지 않게 한다.
const PROBE_TIMEOUT_MS = 60 * 1000

export function onPath(bin, { env = process.env, platform = process.platform, exists = existsSync } = {}) {
  const dirs = String(env.PATH ?? env.Path ?? '').split(delimiter).filter(Boolean)
  // Windows는 확장자 없는 파일을 실행하지 않는다 — PATHEXT 후보만 본다.
  const exts = platform === 'win32'
    ? String(env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : ['']
  return dirs.some((dir) => exts.some((ext) => exists(join(dir, `${bin}${ext}`))))
}

// `agy mcp list`는 JSON을 주지 않는다. 머리줄(NAME …) 뒤 각 줄의 첫 열이 이름이다.
export function parseAgyMcpList(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const head = lines.findIndex((l) => /^NAME\s/.test(l))
  return head === -1 ? [] : lines.slice(head + 1).map((l) => l.split(/\s+/)[0])
}

// OpenCode 설정 파일. 둘 다 없으면 OpenCode가 새로 만들 자리를 돌려준다.
export function opencodeConfigFile({ root, scope, home = homedir(), env = process.env }) {
  const dir = scope === 'project' ? root : join(env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode')
  for (const name of ['opencode.jsonc', 'opencode.json']) {
    if (existsSync(join(dir, name))) return join(dir, name)
  }
  return join(dir, scope === 'project' ? 'opencode.jsonc' : 'opencode.json')
}

export function readOpencodeConfig(opts) {
  const file = opencodeConfigFile(opts)
  return { file, data: readJson(file) ?? null }
}

function samePath(a, b, platform) {
  if (!a) return false
  const norm = (p) => (platform === 'win32' ? resolve(p).toLowerCase() : resolve(p))
  return norm(a) === norm(b)
}

export function createProbe({ root, scope, exec, env = process.env, home = homedir(), platform = process.platform }) {
  const memo = new Map()
  // 실패도 캐시한다 — 같은 스캔에서 항목마다 죽은 CLI를 다시 부르지 않는다.
  const once = (key, fn) => {
    if (!memo.has(key)) memo.set(key, Promise.resolve().then(fn))
    return memo.get(key)
  }
  const run = (cli, args) => once(`${cli} ${args.join(' ')}`, async () => {
    const r = await exec(CLIS[cli]?.bin ?? cli, args, { cwd: root, timeout: PROBE_TIMEOUT_MS })
    if (!r.ok) throw new Error(String(r.output).trim() || `${cli} ${args.join(' ')} failed`)
    return r.output
  })
  const json = async (cli, args) => JSON.parse(await run(cli, args))
  const opencode = () => readOpencodeConfig({ root, scope, home, env }).data

  return {
    root, scope, home,
    has: (cli) => onPath(CLIS[cli].bin, { env, platform }),
    async claudePlugin(ids) {
      const list = await json('claude', ['plugin', 'list', '--json'])
      return list.some((p) => ids.includes(p.id) && p.scope === scope
        && (scope !== 'project' || samePath(p.projectPath, root, platform)))
    },
    async codexPlugin(id) {
      const data = await json('codex', ['plugin', 'list', '--json'])
      return (data.installed ?? []).some((p) => p.pluginId === id && p.installed !== false)
    },
    async agyPlugin(name) {
      return (await json('antigravity', ['plugin', 'list', '--json'])).some((p) => p.name === name)
    },
    async opencodePlugin(module) {
      const list = opencode()?.plugin
      return Array.isArray(list) && list.includes(module)
    },
    async mcp(cli, name) {
      if (cli === 'claude') {
        // `claude mcp list`는 서버마다 연결을 검사해 느리고 네트워크를 탄다.
        const file = scope === 'project' ? join(root, '.mcp.json') : join(home, '.claude.json')
        return readJson(file)?.mcpServers?.[name] !== undefined
      }
      if (cli === 'codex') return (await json('codex', ['mcp', 'list', '--json'])).some((s) => s.name === name)
      if (cli === 'antigravity') return parseAgyMcpList(await run('antigravity', ['mcp', 'list'])).includes(name)
      if (cli === 'opencode') return opencode()?.mcp?.[name] !== undefined
      return false
    },
    async skill(name) {
      if (scope === 'project') return findSkillDir(root, name) !== null
      const list = JSON.parse(await run('npx', ['-y', 'skills@latest', 'list', '-g', '--json']))
      return list.some((s) => s.name === name)
    },
    exists: (rel) => existsSync(join(root, rel)),
    dirHasPrefix(rel, prefix) {
      try {
        return readdirSync(join(root, rel)).some((f) => f.startsWith(prefix))
      } catch {
        return false
      }
    },
  }
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd agent-installer && node --test test/probe.test.mjs test/catalog.registry.test.mjs`
Expected: PASS

- [ ] **Step 8: 전체 테스트 후 커밋**

Run: `cd agent-installer && npm test` → 전부 PASS
```bash
git add agent-installer/lib/clis.mjs agent-installer/lib/probe.mjs agent-installer/lib/skills-registry.mjs agent-installer/lib/catalog.mjs agent-installer/test/probe.test.mjs agent-installer/test/fixtures/probe
git commit -m "feat(installer): CLI 목록 명령으로 설치 상태를 읽는 probe를 넣는다"
```

---

### Task 2: 레시피 모델 — 정의 검증·범위 바인딩·단계 실행

**Files:**
- Create: `agent-installer/lib/recipe.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/recipe.test.mjs`

**Interfaces:**
- Consumes: `TARGET_CLI_IDS`, `CLIS[id].label` (Task 1), `msg`, `LocalizedError`
- Produces:
  - `SCOPES = ['project', 'user']`, `SHARED = 'shared'`
  - `normalizeStep(step, cli) → Step | null`; `Step = { cli, argv, cwd, tolerateFail, undo } | { cli, fn, describe }`
  - `defineRecipe(def) → def & { kind: 'recipe' }` (형식이 틀리면 `error.recipeInvalid`)
  - `bindScope(def, scope) → Item | null`
  - `Item`(바인딩 결과): `{ id, category, label, group, exclusive, note, verified, hooks, postInstall, scope, supports, unsupported, detect({ probe }) → DetectResult, steps(action, state) → Step[], install(ctx), uninstall(ctx) }`
  - `DetectResult = { status, detail, excluded, present, failed, targets, reach }`
  - `runSteps(steps, ctx)` — 실패가 있으면 `LocalizedError('error.stepsFailed', { details })`

- [ ] **Step 1: i18n 키 추가** (en / ko 같은 위치, `item.unsupported.upstreamNone` 아래)

en:
```js
  'item.unsupported.userOnly': 'this CLI installs it only user-globally — switch the scope to Global',
  'item.unsupported.projectOnly': 'this CLI installs it only per repository — switch the scope to Repo',
  'item.probeFailed': 'could not read install state: {list}',
  'error.recipeInvalid': 'Invalid recipe in item {id}: {why}',
  'error.stepsFailed': ['Some commands failed:', '{details}'],
```
ko:
```js
  'item.unsupported.userOnly': '이 CLI는 사용자 전역으로만 설치한다 — 범위를 전역으로 바꿔라',
  'item.unsupported.projectOnly': '이 CLI는 저장소 단위로만 설치한다 — 범위를 저장소로 바꿔라',
  'item.probeFailed': '설치 상태를 읽지 못함: {list}',
  'error.recipeInvalid': '항목 {id}의 레시피가 잘못됐다: {why}',
  'error.stepsFailed': ['일부 명령이 실패했다:', '{details}'],
```
(카탈로그 값이 배열이면 여러 줄 — 기존 `usage.*`와 같은 형식)

- [ ] **Step 2: 실패하는 테스트 작성** — `test/recipe.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope, normalizeStep, runSteps } from '../lib/recipe.mjs'

const P = (argv) => ({ install: [argv], uninstall: [['x', 'remove']] })

function sample(extra = {}) {
  return defineRecipe({
    id: 'plugin.sample', category: 'plugin', label: 'Sample', group: '__flow',
    recipes: {
      claude: { project: P(['claude', 'plugin', 'install', 's', '--scope', 'project']), user: P(['claude', 'plugin', 'install', 's', '--scope', 'user']) },
      codex: { user: { install: [{ argv: ['codex', 'plugin', 'marketplace', 'add', 'o/r'], tolerateFail: true }, ['codex', 'plugin', 'add', 's@s']], uninstall: [['codex', 'plugin', 'remove', 's@s']] } },
    },
    detect: { claude: async () => false, codex: async () => false },
    reasons: { opencode: 'item.unsupported.upstreamNone', antigravity: 'item.unsupported.upstreamNone' },
    ...extra,
  })
}

// has: PATH에 있는 CLI 목록, found: 설치됐다고 답할 CLI, broken: 조회가 던질 CLI
function probe({ has = ['claude', 'codex', 'opencode', 'antigravity'] } = {}) {
  return { has: (c) => has.includes(c) }
}

test('defineRecipe는 모르는 CLI·범위·단계를 거부한다', () => {
  assert.throws(() => sample({ recipes: { gemini: { project: P(['g']) } }, detect: { gemini: async () => false } }), /recipeInvalid|gemini/)
  assert.throws(() => sample({ recipes: { claude: { global: P(['c']) } } }), /global/)
  assert.throws(() => sample({ recipes: { claude: { project: { install: [[1]], uninstall: [] } } } }), /bad step/)
  assert.throws(() => sample({ detect: { claude: async () => false } }), /detect\.codex/)
})

test('bindScope: 범위별 supports와 자동 사유', () => {
  const project = bindScope(sample(), 'project')
  assert.deepEqual(project.supports, ['claude'])
  assert.equal(project.unsupported.codex.key, 'item.unsupported.userOnly')
  assert.equal(project.unsupported.opencode.key, 'item.unsupported.upstreamNone')
  const user = bindScope(sample(), 'user')
  assert.deepEqual(user.supports, ['claude', 'codex'])
  assert.equal(user.scope, 'user')
})

test('bindScope: 사유도 레시피도 없는 CLI는 로드 오류다', () => {
  const def = sample({ reasons: { opencode: 'item.unsupported.upstreamNone' } })
  assert.throws(() => bindScope(def, 'project'), /itemReasonMissing|antigravity/)
})

test('bindScope: 그 범위 레시피가 없으면 항목이 빠진다(null)', () => {
  const def = defineRecipe({
    id: 'skill.x', category: 'skill', label: 'X',
    recipes: { shared: { project: P(['npx', 'skills', 'add']) } },
    detect: { shared: async () => false },
  })
  assert.equal(bindScope(def, 'user'), null)
  assert.deepEqual(bindScope(def, 'project').supports, ['claude', 'codex', 'opencode', 'antigravity'])
})

test('detect: PATH에 없는 CLI는 excluded, 조회 실패는 failed, 나머지로 상태를 정한다', async () => {
  const def = sample({ detect: { claude: async () => true, codex: async () => { throw new Error('login') } } })
  const user = bindScope(def, 'user')
  const r = await user.detect({ probe: probe() })
  assert.equal(r.status, 'installed', '읽힌 CLI 전부(claude)에 있다')
  assert.deepEqual(r.failed, ['codex'])
  assert.equal(r.detail.key, 'item.probeFailed')
  const none = await user.detect({ probe: probe({ has: ['codex'] }) })
  assert.deepEqual(none.excluded, ['claude'])
})

test('steps: install은 빠진 CLI만, 실패한 조회는 건너뛴다; uninstall은 있는 CLI만', async () => {
  const user = bindScope(sample({ detect: { claude: async () => true, codex: async () => false } }), 'user')
  const state = await user.detect({ probe: probe() })
  assert.equal(state.status, 'partial')
  assert.deepEqual(user.steps('install', state).map((s) => s.argv.join(' ')), [
    'codex plugin marketplace add o/r', 'codex plugin add s@s',
  ])
  assert.deepEqual(user.steps('complete', state).map((s) => s.cli), ['codex', 'codex'])
  assert.deepEqual(user.steps('uninstall', state).map((s) => s.argv.join(' ')), ['x remove'])
  assert.deepEqual(user.steps('install', { ...state, present: [], failed: ['codex'] }).map((s) => s.cli), ['claude'])
})

test('runSteps: tolerateFail은 넘어가고, 실패한 CLI만 멈추고 다음 CLI는 계속한다', async () => {
  const ran = []
  const exec = async (cmd, args) => {
    const line = [cmd, ...args].join(' ')
    ran.push(line)
    return { ok: !line.includes('fail'), output: 'boom\nlast line' }
  }
  const steps = [
    normalizeStep({ argv: ['codex', 'marketplace', 'fail'], tolerateFail: true }, 'codex'),
    normalizeStep(['codex', 'add', 'ok'], 'codex'),
    normalizeStep(['claude', 'install', 'fail'], 'claude'),
    normalizeStep(['claude', 'never'], 'claude'),
    normalizeStep(['agy', 'install', 'ok'], 'antigravity'),
  ]
  await assert.rejects(() => runSteps(steps, { root: '/r', exec }), (err) => {
    assert.equal(err.key, 'error.stepsFailed')
    assert.match(err.params.details, /Claude Code: claude install fail/)
    assert.doesNotMatch(err.params.details, /codex/)
    return true
  })
  assert.deepEqual(ran, ['codex marketplace fail', 'codex add ok', 'claude install fail', 'agy install ok'])
})

test('runSteps: undo는 그 단계가 실패했을 때만 돈다; fn 단계는 ctx를 받는다', async () => {
  let undone = 0
  let seen = null
  const exec = async () => ({ ok: false, output: '' })
  const steps = [
    normalizeStep({ argv: ['bash', './setup'], cwd: 'dir', undo: () => { undone++ } }, 'claude'),
    normalizeStep({ fn: (ctx) => { seen = ctx.root }, describe: 'touch' }, 'codex'),
  ]
  await assert.rejects(() => runSteps(steps, { root: '/r', exec }))
  assert.equal(undone, 1)
  assert.equal(seen, '/r')
})

test('runSteps: dryRun에서 fn 단계는 실행하지 않고 describe를 로그로 남긴다', async () => {
  const logs = []
  let ran = false
  await runSteps([normalizeStep({ fn: () => { ran = true }, describe: 'clean up' }, 'shared')], { root: '/r', exec: async () => ({ ok: true }), dryRun: true, log: (m) => logs.push(m) })
  assert.equal(ran, false)
  assert.match(logs.join('\n'), /clean up/)
})
```

- [ ] **Step 3: 실패 확인**

Run: `cd agent-installer && node --test test/recipe.test.mjs`
Expected: FAIL — `Cannot find module '../lib/recipe.mjs'`

- [ ] **Step 4: `lib/recipe.mjs` 구현**

```js
// 레시피 = CLI·범위별 설치 명령 목록. 항목 파일은 데이터만 적고, 이 모듈이
// 그것을 엔진·TUI가 아는 항목 모양으로 바꾼다. 실행(install)과 출력(--print)이
// 같은 steps()에서 명령을 얻으므로 둘이 어긋날 수 없다.
import { join } from 'node:path'
import { CLIS, TARGET_CLI_IDS as RECIPE_CLIS } from './clis.mjs'
import { LocalizedError, msg } from './i18n/index.mjs'

export const SCOPES = ['project', 'user']
// 한 단계 묶음이 네 CLI를 한꺼번에 덮는 자리(.agents/skills).
export const SHARED = 'shared'
// 실패 보고에 싣는 출력 줄 수. 설치 로그 전체는 화면을 덮는다.
const TAIL_LINES = 5

export function normalizeStep(step, cli) {
  if (Array.isArray(step)) return { cli, argv: step, cwd: null, tolerateFail: false, undo: null }
  if (step && Array.isArray(step.argv)) {
    return { cli, argv: step.argv, cwd: step.cwd ?? null, tolerateFail: Boolean(step.tolerateFail), undo: step.undo ?? null }
  }
  if (step && typeof step.fn === 'function' && step.describe) return { cli, fn: step.fn, describe: String(step.describe) }
  return null
}

function assertRecipe(def) {
  const bad = (why) => { throw new LocalizedError('error.recipeInvalid', { id: def?.id ?? '?', why }) }
  for (const field of ['id', 'category', 'label']) if (!def?.[field]) bad(`missing ${field}`)
  const entries = Object.entries(def.recipes ?? {})
  if (entries.length === 0) bad('no recipes')
  if (def.recipes[SHARED] && entries.length > 1) bad('shared cannot be combined with per-CLI recipes')
  for (const [cli, byScope] of entries) {
    if (cli !== SHARED && !RECIPE_CLIS.includes(cli)) bad(`unknown CLI ${cli}`)
    for (const [scope, recipe] of Object.entries(byScope)) {
      if (!SCOPES.includes(scope)) bad(`unknown scope ${scope}`)
      for (const action of ['install', 'uninstall']) {
        if (!Array.isArray(recipe?.[action])) bad(`${cli}.${scope}.${action} is not a list`)
        for (const raw of recipe[action]) {
          const step = normalizeStep(raw, cli)
          if (!step || (step.argv && (step.argv.length === 0 || !step.argv.every((a) => typeof a === 'string')))) {
            bad(`${cli}.${scope}.${action} has a bad step`)
          }
        }
      }
    }
    if (typeof def.detect?.[cli] !== 'function') bad(`detect.${cli} missing`)
  }
}

export function defineRecipe(def) {
  assertRecipe(def)
  return { ...def, kind: 'recipe' }
}

const reasonOf = (r) => (typeof r === 'string' ? msg(r) : r)

export function bindScope(def, scope) {
  const shared = def.recipes[SHARED]
  if (shared && !shared[scope]) return null
  const supports = shared ? [...RECIPE_CLIS] : RECIPE_CLIS.filter((c) => def.recipes[c]?.[scope])
  if (supports.length === 0) return null

  // 다른 범위엔 레시피가 있으면 "범위를 바꾸면 된다"가 사유다. 어느 범위에도
  // 없을 때만 항목이 사유를 직접 대야 한다 — 빠뜨리면 로드 오류로 막는다.
  const other = scope === 'project' ? 'user' : 'project'
  const unsupported = {}
  for (const cli of RECIPE_CLIS) {
    if (supports.includes(cli)) continue
    if (def.recipes[cli]?.[other]) unsupported[cli] = msg(`item.unsupported.${other}Only`)
    else if (def.reasons?.[cli]) unsupported[cli] = reasonOf(def.reasons[cli])
    else throw new LocalizedError('error.itemReasonMissing', { id: def.id, cli })
  }

  const recipeOf = (cli) => def.recipes[cli][scope]

  return {
    id: def.id, category: def.category, label: def.label,
    group: def.group ?? null, exclusive: def.exclusive ?? null, note: def.note ?? null,
    verified: def.verified ?? null, hooks: Boolean(def.hooks), postInstall: def.postInstall ?? null,
    scope, supports, unsupported,

    async detect({ probe }) {
      const reach = supports.filter((c) => probe.has(c))
      // 공유 스킬은 CLI가 아니라 디렉터리에 깔린다 — PATH와 무관하다.
      const excluded = shared ? [] : supports.filter((c) => !reach.includes(c))
      const targets = shared ? [SHARED] : reach
      const present = []
      const failed = []
      for (const cli of targets) {
        try {
          if (await def.detect[cli](probe)) present.push(cli)
        } catch {
          // 목록 명령 실패(로그인 만료 등)를 "없음"으로 읽으면 깔린 것을 또 깐다.
          failed.push(cli)
        }
      }
      const live = targets.filter((c) => !failed.includes(c))
      const status = present.length === 0 ? 'absent' : present.length === live.length ? 'installed' : 'partial'
      let detail = null
      if (failed.length > 0) detail = msg('item.probeFailed', { list: failed.join(', ') })
      else if (status === 'partial') {
        detail = msg('item.plugin.partial', { present: present.join(', '), missing: live.filter((c) => !present.includes(c)).join(', ') })
      } else if (targets.length === 0) detail = msg('item.global.noCli', { list: excluded.join(', ') })
      return { status, detail, excluded, present, failed, targets, reach }
    },

    steps(action, state = {}) {
      const present = state.present ?? []
      const failed = state.failed ?? []
      const targets = state.targets ?? (shared ? [SHARED] : supports)
      const removing = action === 'uninstall'
      const clis = removing
        ? targets.filter((c) => present.includes(c))
        : targets.filter((c) => !present.includes(c) && !failed.includes(c))
      return clis.flatMap((cli) => recipeOf(cli)[removing ? 'uninstall' : 'install'].map((s) => normalizeStep(s, cli)))
    },

    async install(ctx) {
      await runSteps(this.steps('install', ctx.state), ctx)
    },

    async uninstall(ctx) {
      await runSteps(this.steps('uninstall', ctx.state), ctx)
    },
  }
}

function tail(output) {
  return String(output ?? '').trim().split(/\r?\n/).slice(-TAIL_LINES).join('\n    ')
}

const cliLabel = (cli) => CLIS[cli]?.label ?? cli

// 한 CLI의 단계가 실패하면 그 CLI의 남은 단계만 건너뛴다. 다른 CLI는 계속
// 간다 — 로그인이 풀린 Codex 하나 때문에 Claude 설치까지 막을 이유가 없다.
export async function runSteps(steps, ctx) {
  const { root, exec, dryRun = false, log = () => {} } = ctx
  const broken = new Set()
  // 참아 준 실패(마켓플레이스 "이미 등록됨")는 뒤 단계가 실패할 때만 함께 보인다.
  const soft = new Map()
  const failures = []
  for (const step of steps) {
    if (broken.has(step.cli)) continue
    if (step.fn) {
      if (dryRun) { log(`  [dry-run] ${step.describe}`); continue }
      try {
        await step.fn(ctx)
      } catch (err) {
        failures.push({ cli: step.cli, what: step.describe, output: err.message })
        broken.add(step.cli)
      }
      continue
    }
    const [cmd, ...args] = step.argv
    const r = await exec(cmd, args, { cwd: step.cwd ? join(root, step.cwd) : root })
    if (r.ok) continue
    const failure = { cli: step.cli, what: step.argv.join(' '), output: tail(r.output) }
    if (step.tolerateFail) { soft.set(step.cli, failure); continue }
    if (step.undo && !dryRun) {
      try { await step.undo(ctx) } catch { /* 되돌리기 실패가 원래 실패를 가리면 안 된다 */ }
    }
    if (soft.has(step.cli)) failures.push(soft.get(step.cli))
    failures.push(failure)
    broken.add(step.cli)
  }
  if (failures.length > 0) {
    const details = failures.map((f) => `  ${cliLabel(f.cli)}: ${f.what}${f.output ? `\n    ${f.output}` : ''}`).join('\n')
    throw new LocalizedError('error.stepsFailed', { details })
  }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd agent-installer && node --test test/recipe.test.mjs test/i18n.test.mjs`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/lib/recipe.mjs agent-installer/lib/i18n/catalog agent-installer/test/recipe.test.mjs
git commit -m "feat(installer): CLI·범위별 명령 레시피 모델을 넣는다"
```

---

### Task 3: 레시피 헬퍼 — 마켓플레이스 플러그인·MCP·레지스트리 스킬

**Files:**
- Create: `agent-installer/lib/recipe-helpers.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/recipe-helpers.test.mjs`

**Interfaces:**
- Consumes: `defineRecipe`, `bindScope`, `normalizeStep` (Task 2), `readOpencodeConfig` (Task 1), `findSkillDir`, `lockedSkills`, `pruneLock`, `isSafeSkillName`, `SHARED_SKILLS`, `sourceKey` (Task 1 Step 5)
- Produces:
  - `marketplacePlugin({ claude?, codex?, opencode?, antigravity? }) → { recipes, detect }`
    - `claude: { marketplace?, id, detectIds? }`, `codex: { marketplace, id }`, `opencode: { module }`, `antigravity: { source, name }`
  - `mcpServer({ name, server, clis? }) → { recipes, detect }`; `server = { kind: 'stdio', command, args } | { kind: 'http', url }`
  - `skillsAdd({ source, skill, anchor? }) → { recipes, detect }`
  - `opencodePrompt(scope, task) → string` (큰따옴표 없음)
  - `SKILLS_AGENTS: string[]`

- [ ] **Step 1: 전역 스킬 에이전트 ID 실측** (결과를 Step 5의 `SKILLS_AGENTS`에 반영)

스크래치 디렉터리에서:
```bash
cd "$TEMP" && mkdir -p ag-probe && cd ag-probe
for a in universal claude-code codex opencode antigravity antigravity-cli; do
  npx -y skills@latest add vercel-labs/skills --skill find-skills -g -a $a --copy -y --json 2>/dev/null | tail -c 600; echo " <= $a"
done
npx -y skills@latest list -g --json
```
각 ID가 쓴 전역 경로를 기록한다. 결정 규칙: 네 CLI(Claude: `~/.claude/skills`, Codex·OpenCode·Antigravity: 각자 읽는 전역 경로 — Antigravity는 `~/.gemini/skills`·`~/.agents/skills`, 2026-07-18 기록)를 모두 덮으면서 한 CLI가 두 경로에서 같은 스킬을 읽지 않는 최소 ID 집합. 실측 뒤 `npx -y skills@latest remove find-skills -g -y`로 치운다. 결과(ID별 경로)를 커밋 본문에 적는다.

- [ ] **Step 2: i18n 키 추가**

en:
```js
  'error.opencodeVerify': 'OpenCode did not apply the change to {file} — check the file and run the printed command by hand',
```
ko:
```js
  'error.opencodeVerify': 'OpenCode가 {file}에 변경을 반영하지 않았다 — 파일을 확인하고 출력된 명령을 직접 실행하라',
```

- [ ] **Step 3: 실패하는 테스트 작성** — `test/recipe-helpers.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, mcpServer, skillsAdd, opencodePrompt, SKILLS_AGENTS } from '../lib/recipe-helpers.mjs'

const lines = (item, action, state = {}) => item.steps(action, state).map((s) => (s.argv ? s.argv.join(' ') : `# ${s.describe}`))

const ponytail = () => defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    opencode: { module: '@dietrichgebert/ponytail' },
    antigravity: { source: 'https://github.com/DietrichGebert/ponytail', name: 'ponytail' },
  }),
})

test('marketplacePlugin: project 범위 명령', () => {
  const item = bindScope(ponytail(), 'project')
  assert.deepEqual(item.supports, ['claude', 'opencode'])
  assert.deepEqual(lines(item, 'install'), [
    'claude plugin marketplace add DietrichGebert/ponytail --scope project',
    'claude plugin install ponytail@ponytail --scope project',
    'opencode plugin @dietrichgebert/ponytail',
  ])
  assert.equal(item.steps('install')[0].tolerateFail, true)
})

test('marketplacePlugin: user 범위 명령과 제거', () => {
  const item = bindScope(ponytail(), 'user')
  assert.deepEqual(item.supports, ['claude', 'codex', 'opencode', 'antigravity'])
  const all = { present: ['claude', 'codex', 'opencode', 'antigravity'], targets: item.supports }
  assert.deepEqual(lines(item, 'install', { targets: item.supports }), [
    'claude plugin marketplace add DietrichGebert/ponytail --scope user',
    'claude plugin install ponytail@ponytail --scope user',
    'codex plugin marketplace add DietrichGebert/ponytail',
    'codex plugin add ponytail@ponytail',
    'opencode plugin @dietrichgebert/ponytail -g',
    'agy plugin install https://github.com/DietrichGebert/ponytail',
  ])
  const removal = lines(item, 'uninstall', all)
  assert.equal(removal[0], 'claude plugin uninstall ponytail@ponytail --scope user')
  assert.equal(removal[1], 'codex plugin remove ponytail@ponytail')
  assert.match(removal[2], /^opencode run /)
  assert.match(removal[3], /^# /, 'opencode run 뒤에는 검증 단계가 붙는다')
  assert.equal(removal[4], 'agy plugin uninstall ponytail')
})

test('marketplacePlugin: 마켓플레이스 없는 Claude 공식 플러그인', () => {
  const def = defineRecipe({
    id: 'plugin.sp', category: 'plugin', label: 'sp',
    ...marketplacePlugin({ claude: { id: 'superpowers@claude-plugins-official', detectIds: ['a', 'b'] } }),
    reasons: { codex: 'x', opencode: 'x', antigravity: 'x' },
  })
  assert.deepEqual(lines(bindScope(def, 'project'), 'install'), ['claude plugin install superpowers@claude-plugins-official --scope project'])
})

test('mcpServer: stdio·http를 CLI별 문법으로', () => {
  const stdio = defineRecipe({ id: 'mcp.graft', category: 'mcp', label: 'g', ...mcpServer({ name: 'graft', server: { kind: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft', 'mcp'] } }) })
  const user = bindScope(stdio, 'user')
  const got = lines(user, 'install', { targets: user.supports })
  assert.equal(got[0], 'claude mcp add -s user graft -- npx -y @nanonets/graft mcp')
  assert.equal(got[1], 'codex mcp add graft -- npx -y @nanonets/graft mcp')
  assert.match(got[2], /^opencode run /)
  assert.equal(got[4], 'agy mcp add graft -- npx -y @nanonets/graft mcp')
  const http = defineRecipe({ id: 'mcp.notion', category: 'mcp', label: 'n', ...mcpServer({ name: 'notion', server: { kind: 'http', url: 'https://mcp.notion.com/mcp' } }) })
  const p = bindScope(http, 'project')
  assert.deepEqual(p.supports, ['claude', 'opencode'])
  assert.equal(lines(p, 'install')[0], 'claude mcp add -s project -t http notion https://mcp.notion.com/mcp')
  assert.equal(lines(bindScope(http, 'user'), 'install', { targets: ['codex', 'antigravity'] }).join('|'),
    'codex mcp add notion --url https://mcp.notion.com/mcp|agy mcp add notion https://mcp.notion.com/mcp')
  assert.deepEqual(lines(p, 'uninstall', { present: ['claude'], targets: ['claude'] }), ['claude mcp remove -s project notion'])
})

test('mcpServer: clis로 일부 CLI만 고른다', () => {
  const part = mcpServer({ name: 'ai-memory', server: { kind: 'stdio', command: 'ai-memory', args: ['mcp-bridge'] }, clis: ['opencode', 'antigravity'] })
  assert.deepEqual(Object.keys(part.recipes), ['opencode', 'antigravity'])
  assert.deepEqual(Object.keys(part.detect), ['opencode', 'antigravity'])
})

test('opencodePrompt에는 큰따옴표가 없다 — Windows cmd 인용이 거부한다', () => {
  const prompt = opencodePrompt('project', `set ${JSON.stringify({ type: 'local', command: ['a b'] })}`)
  assert.doesNotMatch(prompt, /"/)
  assert.match(prompt, /opencode\.jsonc/)
  assert.match(opencodePrompt('user', 'x'), /~\/\.config\/opencode\/opencode\.json/)
})

test('OpenCode 검증 단계: 파일에 반영되지 않았으면 던진다', async () => {
  const root = mkdtempSync(join(tmpdir(), 'oc-'))
  const def = defineRecipe({ id: 'mcp.n', category: 'mcp', label: 'n', ...mcpServer({ name: 'n', server: { kind: 'http', url: 'https://x' } }) })
  const verify = bindScope(def, 'project').steps('install', { targets: ['opencode'] }).find((s) => s.fn)
  await assert.rejects(() => verify.fn({ root }), (err) => err.key === 'error.opencodeVerify')
  writeFileSync(join(root, 'opencode.jsonc'), '{ "mcp": { "n": { "type": "remote", "url": "https://x", "enabled": true } } }')
  await verify.fn({ root })
})

test('skillsAdd: 공유 단계 하나로 네 CLI, 전역은 에이전트 명시', () => {
  const def = defineRecipe({ id: 'skill.caveman', category: 'skill', label: 'c', ...skillsAdd({ source: 'https://github.com/JuliusBrussee/caveman', skill: 'caveman' }) })
  const p = bindScope(def, 'project')
  assert.deepEqual(p.supports, ['claude', 'codex', 'opencode', 'antigravity'])
  assert.deepEqual(lines(p, 'install'), ['npx -y skills@latest add https://github.com/JuliusBrussee/caveman --skill caveman --agent universal --yes --copy'])
  const removal = lines(p, 'uninstall', { present: ['shared'], targets: ['shared'] })
  assert.equal(removal[0], 'npx -y skills@latest remove caveman --agent universal --yes')
  assert.match(removal[1], /^# /)
  const u = bindScope(def, 'user')
  assert.deepEqual(lines(u, 'install'), [`npx -y skills@latest add https://github.com/JuliusBrussee/caveman --skill caveman -g -a ${SKILLS_AGENTS.join(' ')} --yes --copy`])
})

test('skillsAdd: skill * 는 project 전용이고 제거는 잠금 파일을 따른다', async () => {
  const def = defineRecipe({ id: 'skill.sp', category: 'skill', label: 's', ...skillsAdd({ source: 'https://github.com/obra/superpowers', skill: '*', anchor: 'using-superpowers' }) })
  assert.equal(bindScope(def, 'user'), null)
  const root = mkdtempSync(join(tmpdir(), 'sk-'))
  for (const n of ['using-superpowers', 'brainstorming']) {
    mkdirSync(join(root, '.agents', 'skills', n), { recursive: true })
    writeFileSync(join(root, '.agents', 'skills', n, 'SKILL.md'), `---\nname: ${n}\n---\n`)
  }
  writeFileSync(join(root, 'skills-lock.json'), JSON.stringify({ skills: { 'using-superpowers': { source: 'obra/superpowers' }, brainstorming: { source: 'obra/superpowers' } } }))
  const [step] = bindScope(def, 'project').steps('uninstall', { present: ['shared'], targets: ['shared'] })
  const ran = []
  await step.fn({ root, exec: async (cmd, args) => { ran.push(args.join(' ')); return { ok: true, output: '' } } })
  assert.equal(ran.length, 2)
  assert.equal(existsSync(join(root, '.agents', 'skills', 'brainstorming')), false)
  assert.equal(existsSync(join(root, 'skills-lock.json')), false)
})
```

- [ ] **Step 4: 실패 확인**

Run: `cd agent-installer && node --test test/recipe-helpers.test.mjs`
Expected: FAIL — `Cannot find module '../lib/recipe-helpers.mjs'`

- [ ] **Step 5: `lib/recipe-helpers.mjs` 구현**

```js
// 항목 파일이 거의 다 쓰는 레시피 세 갈래. 명령 문법은 2026-10-24 이 머신의
// --help 실측(claude 2.1.304, codex-cli 0.163.0, agy)과 opencode.ai/docs/cli를
// 따른다.
import { rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { repoPathStrict } from './context.mjs'
import { LocalizedError } from './i18n/index.mjs'
import { readOpencodeConfig } from './probe.mjs'
import { SHARED } from './recipe.mjs'
import { SHARED_SKILLS, findSkillDir, isSafeSkillName, lockedSkills, pruneLock, sourceKey } from './skills-registry.mjs'

const SKILLS = ['npx', '-y', 'skills@latest']
// Step 1 실측으로 고정한 전역 설치 에이전트(네 CLI를 덮는 최소 집합).
export const SKILLS_AGENTS = ['claude-code', 'codex', 'opencode', 'antigravity']

const OPENCODE_FILE = {
  project: 'the project config ./opencode.jsonc (or ./opencode.json if only that one exists)',
  user: 'the global config ~/.config/opencode/opencode.json (or opencode.jsonc there if only that one exists)',
}

// `opencode mcp add`는 대화형뿐이라 OpenCode 에이전트에게 편집을 맡긴다.
// 지시문에는 큰따옴표를 남기지 않는다 — Windows에서 명령 한 줄은 cmd.exe를
// 거치고, shellQuote는 그 안의 큰따옴표를 안전하게 이스케이프할 수 없어 거부한다.
export function opencodePrompt(scope, task) {
  return `Edit ${OPENCODE_FILE[scope]}. ${task} Keep comments and every other key unchanged. Do not run any other command. Reply only DONE.`
    .replace(/"/g, "'")
}

// JSON을 작은따옴표로 적고 "파일에는 표준 JSON으로"라고 덧붙인다.
const quotedJson = (value) => `${JSON.stringify(value).replace(/"/g, "'")} (written with single quotes here; use standard JSON double quotes in the file)`

// LLM 실행이라 결과가 비결정적이다 — 파일을 다시 읽는 이 단계가 유일한 성공 근거다.
function verifyOpencode(scope, check, describe) {
  return {
    describe,
    fn: ({ root }) => {
      const { file, data } = readOpencodeConfig({ root, scope, home: homedir() })
      if (!check(data)) throw new LocalizedError('error.opencodeVerify', { file })
    },
  }
}

const fileName = (scope) => (scope === 'project' ? './opencode.jsonc' : '~/.config/opencode/opencode.json')

export function marketplacePlugin({ claude, codex, opencode, antigravity }) {
  const recipes = {}
  const detect = {}
  if (claude) {
    const at = (scope) => ({
      install: [
        ...(claude.marketplace ? [{ argv: ['claude', 'plugin', 'marketplace', 'add', claude.marketplace, '--scope', scope], tolerateFail: true }] : []),
        ['claude', 'plugin', 'install', claude.id, '--scope', scope],
      ],
      uninstall: [['claude', 'plugin', 'uninstall', claude.id, '--scope', scope]],
    })
    recipes.claude = { project: at('project'), user: at('user') }
    detect.claude = (p) => p.claudePlugin(claude.detectIds ?? [claude.id])
  }
  if (codex) {
    // Codex는 범위 플래그가 없다 — 활성 CODEX_HOME 하나에 깔린다(전역).
    recipes.codex = {
      user: {
        install: [{ argv: ['codex', 'plugin', 'marketplace', 'add', codex.marketplace], tolerateFail: true }, ['codex', 'plugin', 'add', codex.id]],
        uninstall: [['codex', 'plugin', 'remove', codex.id]],
      },
    }
    detect.codex = (p) => p.codexPlugin(codex.id)
  }
  if (opencode) {
    // 설치 명령은 있지만 제거 명령은 문서에 없다 — 제거는 run 지시문 + 검증이다.
    const at = (scope) => ({
      install: [['opencode', 'plugin', opencode.module, ...(scope === 'user' ? ['-g'] : [])]],
      uninstall: [
        ['opencode', 'run', opencodePrompt(scope, `Remove the string '${opencode.module}' from the top-level 'plugin' array; delete the array if it becomes empty.`)],
        verifyOpencode(scope, (d) => !(Array.isArray(d?.plugin) && d.plugin.includes(opencode.module)), `check ${fileName(scope)} no longer lists plugin ${opencode.module}`),
      ],
    })
    recipes.opencode = { project: at('project'), user: at('user') }
    detect.opencode = (p) => p.opencodePlugin(opencode.module)
  }
  if (antigravity) {
    recipes.antigravity = {
      user: {
        install: [['agy', 'plugin', 'install', antigravity.source]],
        uninstall: [['agy', 'plugin', 'uninstall', antigravity.name]],
      },
    }
    detect.antigravity = (p) => p.agyPlugin(antigravity.name)
  }
  return { recipes, detect }
}

export function mcpServer({ name, server, clis = ['claude', 'codex', 'opencode', 'antigravity'] }) {
  const http = server.kind === 'http'
  // stdio 명령 앞의 `--`: 인자가 `-y`처럼 대시로 시작해도 CLI가 자기 플래그로 읽지 않는다.
  const tail = http ? [] : ['--', server.command, ...server.args]
  const entry = http
    ? { type: 'remote', url: server.url, enabled: true }
    : { type: 'local', command: [server.command, ...server.args], enabled: true }
  const opencodeAt = (scope) => ({
    install: [
      ['opencode', 'run', opencodePrompt(scope, `Under the top-level 'mcp' object (create it, and the file with '$schema': 'https://opencode.ai/config.json', if missing) set the key '${name}' to this value: ${quotedJson(entry)}.`)],
      verifyOpencode(scope, (d) => d?.mcp?.[name] !== undefined, `check ${fileName(scope)} has mcp.${name}`),
    ],
    uninstall: [
      ['opencode', 'run', opencodePrompt(scope, `Delete the key '${name}' from the top-level 'mcp' object.`)],
      verifyOpencode(scope, (d) => d?.mcp?.[name] === undefined, `check ${fileName(scope)} no longer has mcp.${name}`),
    ],
  })
  const claudeAt = (scope) => ({
    install: [http ? ['claude', 'mcp', 'add', '-s', scope, '-t', 'http', name, server.url] : ['claude', 'mcp', 'add', '-s', scope, name, ...tail]],
    uninstall: [['claude', 'mcp', 'remove', '-s', scope, name]],
  })
  const all = {
    claude: { project: claudeAt('project'), user: claudeAt('user') },
    // Codex·Antigravity의 mcp add에는 범위 플래그가 없다 — 사용자 전역 설정에 쓴다.
    codex: { user: { install: [http ? ['codex', 'mcp', 'add', name, '--url', server.url] : ['codex', 'mcp', 'add', name, ...tail]], uninstall: [['codex', 'mcp', 'remove', name]] } },
    opencode: { project: opencodeAt('project'), user: opencodeAt('user') },
    antigravity: { user: { install: [http ? ['agy', 'mcp', 'add', name, server.url] : ['agy', 'mcp', 'add', name, ...tail]], uninstall: [['agy', 'mcp', 'remove', name]] } },
  }
  const recipes = Object.fromEntries(clis.map((c) => [c, all[c]]))
  const detect = Object.fromEntries(clis.map((c) => [c, (p) => p.mcp(c, name)]))
  return { recipes, detect }
}

// 레지스트리의 remove는 --agent universal에서 "Done!"을 찍고도 디렉터리와
// 잠금 항목을 남긴다(실측) — 남은 것을 우리가 치운다. 남겨 두면 detect가
// 계속 설치됨으로 읽고, 동료가 잠금 파일로 복원하면 지운 스킬이 되살아난다.
function cleanup(root, names) {
  for (const name of names) {
    const dir = findSkillDir(root, name)
    if (dir) rmSync(repoPathStrict(root, `${SHARED_SKILLS}/${dir}`), { recursive: true, force: true })
  }
  pruneLock(root, names)
}

export function skillsAdd({ source, skill, anchor = null }) {
  const wildcard = skill === '*'
  const probeName = anchor ?? skill
  const project = {
    install: [[...SKILLS, 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy']],
    uninstall: wildcard
      ? [{
          describe: `npx -y skills@latest remove <each skill from ${sourceKey(source)} in skills-lock.json> --agent universal --yes, then remove leftover ${SHARED_SKILLS} dirs`,
          fn: async ({ root, exec }) => {
            const locked = lockedSkills(root, source)
            const names = (locked.length > 0 ? locked : [probeName]).filter(isSafeSkillName)
            for (const name of names) await exec('npx', ['-y', 'skills@latest', 'remove', name, '--agent', 'universal', '--yes'], { cwd: root })
            cleanup(root, names)
          },
        }]
      : [
          { argv: [...SKILLS, 'remove', skill, '--agent', 'universal', '--yes'], tolerateFail: true },
          { describe: `remove leftover ${SHARED_SKILLS}/${skill} and its skills-lock.json entry`, fn: ({ root }) => cleanup(root, [skill]) },
        ],
  }
  const byScope = { project }
  // 한 상류의 스킬 전부(*)는 전역에서 무엇을 지울지 추적할 근거가 없다.
  if (!wildcard) {
    byScope.user = {
      install: [[...SKILLS, 'add', source, '--skill', skill, '-g', '-a', ...SKILLS_AGENTS, '--yes', '--copy']],
      uninstall: [[...SKILLS, 'remove', skill, '-g', '-a', ...SKILLS_AGENTS, '--yes']],
    }
  }
  return { recipes: { [SHARED]: byScope }, detect: { [SHARED]: (p) => p.skill(probeName) } }
}
```

`skills-registry.mjs`에서 `sourceKey`도 export되어 있어야 한다(Task 1 Step 5에서 함께 export).

- [ ] **Step 6: 통과 확인**

Run: `cd agent-installer && node --test test/recipe-helpers.test.mjs test/recipe.test.mjs`
Expected: PASS

- [ ] **Step 7: 커밋** (본문에 Step 1 실측 결과)

```bash
git add agent-installer/lib/recipe-helpers.mjs agent-installer/lib/i18n/catalog agent-installer/test/recipe-helpers.test.mjs
git commit -m "feat(installer): 플러그인·MCP·스킬 레시피 헬퍼를 넣는다"
```

---

### Task 4: 출력 모드·활성화 안내·엔진 상태 전달

**Files:**
- Create: `agent-installer/lib/commands.mjs`, `agent-installer/lib/activation.mjs`
- Modify: `agent-installer/lib/engine.mjs` (scan이 probe 전달·결과 보존, planChanges가 state 실음, apply가 ctx.state 전달)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/commands.test.mjs`, `agent-installer/test/activation.test.mjs`, `agent-installer/test/engine.test.mjs`(추가)

**Interfaces:**
- Consumes: `Item.steps`, `DetectResult`(Task 2), `createProbe`(Task 1), `shellQuote`·`makeExec`(catalog.mjs)
- Produces:
  - `scan(root, items, { probe, scope } = {}) → State[]`; `State = { item, status, detail, excluded, result }`
  - `planChanges(states, selectedIds) → Change[]`; `Change = { item, action, state }` (`state` = `DetectResult` 또는 undefined)
  - `apply(...)`이 항목에 `ctx.state = change.state`를 넘긴다
  - `quoteArg(arg, platform) → string`
  - `planCommands(changes) → Group[]`; `Group = { key, entries: [{ item, action, step? , manual? }] }` (`key`: `'shared' | cliId | 'files'`)
  - `formatCommands(groups, { t, scope, platform }) → string[]`
  - `activationLines(changes, t) → string[]`

- [ ] **Step 1: i18n 키 추가**

en:
```js
  'scope.project': 'repo',
  'scope.user': 'user-global',
  'print.title': 'Commands for these changes (nothing was run):',
  'print.shared': 'Shared skills',
  'print.files': 'File items',
  'print.fileItem': '{label}: the installer writes these files itself — run without --print to apply',
  'print.none': 'No commands — nothing to change.',
  'activation.title': 'After installing:',
  'activation.cli.claude': 'start a new session (check /plugin if something looks inactive)',
  'activation.cli.codex': 'run codex and start a new session',
  'activation.cli.opencode': 'restart OpenCode',
  'activation.cli.antigravity': 'restart Antigravity',
  'activation.hooks.codex': 'hooks ({items}): in codex type /hooks, trust the new lifecycle hooks, then start a new session',
```
ko:
```js
  'scope.project': '저장소',
  'scope.user': '사용자 전역',
  'print.title': '이번 변경에 필요한 명령 (아무것도 실행하지 않았다):',
  'print.shared': '공유 스킬',
  'print.files': '파일 항목',
  'print.fileItem': '{label}: 설치기가 파일을 직접 쓰는 항목이다 — --print 없이 실행해 적용하라',
  'print.none': '명령 없음 — 바꿀 것이 없다.',
  'activation.title': '설치 후 할 일:',
  'activation.cli.claude': '새 세션을 시작한다 (비활성으로 보이면 /plugin에서 확인)',
  'activation.cli.codex': 'codex를 실행해 새 세션을 시작한다',
  'activation.cli.opencode': 'OpenCode를 재시작한다',
  'activation.cli.antigravity': 'Antigravity를 재시작한다',
  'activation.hooks.codex': '훅({items}): codex에서 /hooks를 입력해 새 라이프사이클 훅을 Trust한 뒤 새 세션을 시작한다',
```

- [ ] **Step 2: 실패하는 테스트 작성**

`test/commands.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, skillsAdd } from '../lib/recipe-helpers.mjs'
import { planCommands, formatCommands, quoteArg } from '../lib/commands.mjs'
import { apply, planChanges } from '../lib/engine.mjs'
import { createT } from '../lib/i18n/index.mjs'

const t = createT('en')
const ponytail = (scope) => bindScope(defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
  }),
  reasons: { opencode: 'item.unsupported.upstreamNone', antigravity: 'item.unsupported.upstreamNone' },
}), scope)
const caveman = (scope) => bindScope(defineRecipe({ id: 'skill.caveman', category: 'skill', label: 'caveman', ...skillsAdd({ source: 'o/caveman', skill: 'caveman' }) }), scope)
const fileItem = { id: 'config.gitmessage.ko', category: 'config', label: '.gitmessage.txt (ko)', scope: 'project', detect: async () => ({ status: 'absent' }), install: async () => {}, uninstall: async () => {} }

const stateOf = (item, extra = {}) => ({ status: 'absent', present: [], failed: [], targets: item.supports.includes('codex') && item.scope === 'user' ? ['claude', 'codex'] : item.id.startsWith('skill') ? ['shared'] : ['claude'], ...extra })

test('quoteArg: 안전한 인자는 그대로, 나머지는 셸별 인용', () => {
  assert.equal(quoteArg('ponytail@ponytail', 'linux'), 'ponytail@ponytail')
  assert.equal(quoteArg('a b', 'linux'), "'a b'")
  assert.equal(quoteArg("it's", 'linux'), `'it'\\''s'`)
  assert.equal(quoteArg('a b', 'win32'), '"a b"')
})

test('planCommands·formatCommands: 공유·CLI·파일 순으로 묶는다', () => {
  const user = ponytail('user')
  const changes = [
    { item: user, action: 'install', state: stateOf(user) },
    { item: caveman('project'), action: 'install', state: stateOf(caveman('project')) },
    { item: fileItem, action: 'install' },
  ]
  const groups = planCommands(changes)
  assert.deepEqual(groups.map((g) => g.key), ['shared', 'claude', 'codex', 'files'])
  const text = formatCommands(groups, { t, scope: 'user', platform: 'linux' }).join('\n')
  assert.match(text, /# Shared skills/)
  assert.match(text, /# Codex — user-global\ncodex plugin marketplace add DietrichGebert\/ponytail\ncodex plugin add ponytail@ponytail/)
  assert.match(text, /\.gitmessage\.txt \(ko\): the installer writes these files itself/)
})

test('불변식: 실행 모드가 부른 명령 == 출력 모드가 낸 명령', async () => {
  const user = ponytail('user')
  const states = [{ item: user, status: 'absent', result: stateOf(user) }]
  const changes = planChanges(states, new Set([user.id]))
  const printed = planCommands(changes).flatMap((g) => g.entries).filter((e) => e.step?.argv).map((e) => e.step.argv.join(' '))
  const ran = []
  const realExec = async () => ({ ok: true, output: '' })
  void realExec
  // apply는 makeExec를 쓰므로 dryRun 로그로 실행된 명령을 받는다.
  const logs = []
  await apply('/repo', changes, { dryRun: true, log: (m) => logs.push(m), t })
  for (const l of logs) { const m = /\[dry-run\] (.*)$/.exec(l); if (m) ran.push(m[1]) }
  assert.deepEqual(ran, printed)
})
```

`test/activation.test.mjs`:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, skillsAdd } from '../lib/recipe-helpers.mjs'
import { activationLines } from '../lib/activation.mjs'
import { createT } from '../lib/i18n/index.mjs'

const t = createT('en')
const pony = bindScope(defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', hooks: true, postInstall: 'activation.cli.opencode',
  ...marketplacePlugin({ claude: { id: 'p@p' }, codex: { marketplace: 'o/r', id: 'p@p' } }),
  reasons: { opencode: 'x', antigravity: 'x' },
}), 'user')
const skill = bindScope(defineRecipe({ id: 'skill.c', category: 'skill', label: 'c', ...skillsAdd({ source: 'o/c', skill: 'c' }) }), 'project')

test('설치가 있는 CLI마다 공통 안내 한 줄, Codex 훅 안내는 hooks 항목만', () => {
  const lines = activationLines([{ item: pony, action: 'install', state: { present: [], targets: ['claude', 'codex'] } }], t)
  assert.equal(lines[0], 'After installing:')
  assert.ok(lines.some((l) => l.includes('Claude Code: start a new session')))
  assert.ok(lines.some((l) => l.includes('Codex: run codex')))
  assert.ok(lines.some((l) => l.includes('hooks (Ponytail)')))
  assert.ok(lines.some((l) => l.includes('Ponytail: restart OpenCode')), '항목 고유 안내')
})

test('공유 스킬은 PATH에 있는 CLI(reach)에 안내를 낸다; 제거만 있으면 안내가 없다', () => {
  const lines = activationLines([{ item: skill, action: 'install', state: { present: [], targets: ['shared'], reach: ['codex'] } }], t)
  assert.ok(lines.some((l) => l.startsWith('  Codex:')))
  assert.ok(!lines.some((l) => l.startsWith('  Claude Code:')))
  assert.deepEqual(activationLines([{ item: pony, action: 'uninstall', state: { present: ['claude'], targets: ['claude'] } }], t), [])
})
```

`test/engine.test.mjs` 끝에 추가:
```js
test('scan은 probe를 detect에 넘기고 결과를 result로 보존한다; planChanges가 state로 싣는다', async () => {
  const seen = []
  const item = {
    id: 'x', category: 'plugin', label: 'x',
    detect: async ({ probe }) => { seen.push(probe); return { status: 'absent', present: [], targets: ['claude'] } },
    install: async () => {}, uninstall: async () => {},
  }
  const probe = { has: () => true }
  const states = await scan('/r', [item], { probe })
  assert.equal(seen[0], probe)
  assert.deepEqual(states[0].result.targets, ['claude'])
  const [change] = planChanges(states, new Set(['x']))
  assert.deepEqual(change.state.targets, ['claude'])
})

test('apply는 change.state를 ctx.state로 넘긴다', async () => {
  let got = null
  const item = { id: 'x', category: 'plugin', label: 'x', detect: async () => ({ status: 'absent' }), install: async (ctx) => { got = ctx.state }, uninstall: async () => {} }
  await apply('/r', [{ item, action: 'install', state: { present: ['codex'] } }], { log: () => {} })
  assert.deepEqual(got, { present: ['codex'] })
})
```
(`engine.test.mjs` 상단 import에 `scan`·`planChanges`·`apply`가 없으면 추가)

- [ ] **Step 3: 실패 확인**

Run: `cd agent-installer && node --test test/commands.test.mjs test/activation.test.mjs test/engine.test.mjs`
Expected: FAIL — 모듈 없음 / `result` undefined

- [ ] **Step 4: `lib/engine.mjs` 수정**

`scan`:
```js
import { makeExec } from './catalog.mjs'
import { createProbe } from './probe.mjs'

// probe는 스캔 하나가 공유하는 감지 캐시다. 없으면 여기서 만든다 — design.md
// 항목처럼 probe를 안 쓰는 detect는 그냥 무시한다.
export async function scan(root, items, { probe = null, scope = 'project' } = {}) {
  const shared = probe ?? createProbe({ root, scope, exec: makeExec(false) })
  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root, probe: shared })
      states.push({ item, status: r.status, detail: r.detail, excluded: r.excluded ?? [], result: r })
    } catch (err) {
      states.push({ item, status: 'absent', detail: msg('item.scanFailed', { message: err.message }) })
    }
  }
  return states
}
```
`planChanges`: 루프를 `for (const { item, status, result } of states)`로 바꾸고 세 `changes.push`에 `state: result`를 넣는다.
`apply`: `const { item, action } = changes[index]`를 `const { item, action, state } = changes[index]`로, ctx를 `const ctx = { root, dryRun, exec, log, t, state }`로.

- [ ] **Step 5: `lib/commands.mjs` 구현**

```js
// 출력 모드(--print). 실행 모드와 같은 item.steps()에서 명령을 얻는다.
import { CLIS, TARGET_CLI_IDS } from './clis.mjs'
import { shellQuote } from './catalog.mjs'
import { SHARED } from './recipe.mjs'

const ORDER = [SHARED, ...TARGET_CLI_IDS, 'files']
// 따옴표 없이도 셸이 한 인자로 읽는 문자만. 복사해 붙일 줄이 읽기 쉬워야 한다.
const PLAIN = /^[A-Za-z0-9_@+=:,./-]+$/

export function quoteArg(arg, platform = process.platform) {
  return PLAIN.test(arg) ? arg : shellQuote(arg, platform)
}

export function planCommands(changes) {
  const groups = new Map()
  const push = (key, entry) => {
    if (!groups.has(key)) groups.set(key, { key, entries: [] })
    groups.get(key).entries.push(entry)
  }
  for (const { item, action, state } of changes) {
    // 파일을 직접 쓰는 항목(.gitmessage.txt 등)은 명령이 없다.
    if (typeof item.steps !== 'function') { push('files', { item, action, manual: true }); continue }
    for (const step of item.steps(action, state)) push(step.cli, { item, action, step })
  }
  return ORDER.filter((k) => groups.has(k)).map((k) => groups.get(k))
}

export function formatCommands(groups, { t, scope, platform = process.platform }) {
  if (groups.length === 0) return [t('print.none')]
  const lines = [t('print.title'), '']
  for (const g of groups) {
    const title = g.key === SHARED ? t('print.shared') : g.key === 'files' ? t('print.files') : CLIS[g.key].label
    lines.push(`# ${title} — ${t(`scope.${scope}`)}`)
    for (const e of g.entries) {
      if (e.manual) lines.push(`# ${t('print.fileItem', { label: e.item.label })}`)
      else if (e.step.fn) lines.push(`#   ${e.step.describe}`)
      else lines.push(e.step.argv.map((a) => quoteArg(a, platform)).join(' '))
    }
    lines.push('')
  }
  return lines
}
```

- [ ] **Step 6: `lib/activation.mjs` 구현**

```js
// 설치 뒤 사용자가 CLI 안에서 해야 하는 일. CLI마다 한 번만 말한다 — 항목이
// 다섯 개라고 "새 세션을 시작하라"를 다섯 번 읽힐 이유가 없다.
import { CLIS, TARGET_CLI_IDS } from './clis.mjs'
import { SHARED } from './recipe.mjs'

export function activationLines(changes, t) {
  const clis = new Set()
  const hookItems = []
  const extras = []
  for (const { item, action, state } of changes) {
    if (action === 'uninstall' || typeof item.steps !== 'function') continue
    const touched = new Set(item.steps(action, state).flatMap((s) => (s.cli === SHARED ? state?.reach ?? [] : [s.cli])))
    for (const cli of touched) clis.add(cli)
    if (item.hooks && touched.has('codex')) hookItems.push(item.label)
    if (item.postInstall) extras.push(`${item.label}: ${t(item.postInstall)}`)
  }
  if (clis.size === 0 && extras.length === 0) return []
  const lines = [t('activation.title')]
  for (const cli of TARGET_CLI_IDS) {
    if (!clis.has(cli)) continue
    lines.push(`  ${CLIS[cli].label}: ${t(`activation.cli.${cli}`)}`)
    if (cli === 'codex' && hookItems.length > 0) lines.push(`    ${t('activation.hooks.codex', { items: hookItems.join(', ') })}`)
  }
  for (const e of extras) lines.push(`  · ${e}`)
  return lines
}
```

- [ ] **Step 7: 통과 확인**

Run: `cd agent-installer && node --test test/commands.test.mjs test/activation.test.mjs test/engine.test.mjs`
Expected: PASS. 불변식 테스트는 `makeExec(dryRun)`의 로그 형식(`  [dry-run] cmd args`)에 기대므로, 실패하면 `makeExec` 로그 형식을 바꾸지 말고 테스트의 정규식을 맞춘다.

- [ ] **Step 8: 전체 테스트 후 커밋**

Run: `cd agent-installer && npm test` → PASS
```bash
git add agent-installer/lib/commands.mjs agent-installer/lib/activation.mjs agent-installer/lib/engine.mjs agent-installer/lib/i18n/catalog agent-installer/test/commands.test.mjs agent-installer/test/activation.test.mjs agent-installer/test/engine.test.mjs
git commit -m "feat(installer): 명령 출력 모드와 활성화 안내를 넣는다"
```

---

### Task 5: 테스트용 가짜 CLI와 PATH 격리

**Files:**
- Modify: `agent-installer/test/helpers.mjs`
- Create: `agent-installer/test/fixtures/fake-cli.mjs`
- Test: `agent-installer/test/helpers.fakecli.test.mjs`

**Interfaces:**
- Produces:
  - `isolateGlobalHome()` — 지금 동작 + `process.env.PATH`를 git 실행 파일이 있는 디렉터리 하나로 줄인다(실제 claude·codex·agy가 감지에 끼지 않게)
  - `makeFakeClis(names, responses) → { dir, env, calls() }` — `dir`에 가짜 실행 파일을 만들고, `env`는 `{ PATH: dir + delimiter + gitDir, FAKE_CLI_LOG, FAKE_CLI_RESPONSES }`, `calls()`는 기록된 `"<name> <args...>"` 배열. `responses`는 `{ "<name> <args>": { out, code } }`, 없는 명령은 `out: ''`, `code: 0`.

- [ ] **Step 1: 실패하는 테스트** — `test/helpers.fakecli.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeFakeClis } from './helpers.mjs'
import { makeExec } from '../lib/catalog.mjs'
import { onPath } from '../lib/probe.mjs'

test('가짜 CLI는 PATH에서 찾히고, 응답을 돌려주고, 호출을 기록한다', async () => {
  const fake = makeFakeClis(['claude', 'agy'], { 'claude plugin list --json': { out: '[]' }, 'agy mcp list': { out: 'x', code: 3 } })
  assert.equal(onPath('claude', { env: fake.env }), true)
  assert.equal(onPath('codex', { env: fake.env }), false)
  const saved = { ...process.env }
  Object.assign(process.env, fake.env)
  try {
    const exec = makeExec(false)
    assert.deepEqual(await exec('claude', ['plugin', 'list', '--json']), { ok: true, output: '[]' })
    assert.equal((await exec('agy', ['mcp', 'list'])).ok, false)
    await exec('claude', ['mcp', 'add', '-s', 'project', 'n', '--', 'npx', '-y', 'a b'])
  } finally {
    process.env = saved
  }
  assert.deepEqual(fake.calls(), ['claude plugin list --json', 'agy mcp list', 'claude mcp add -s project n -- npx -y a b'])
})
```

- [ ] **Step 2: 실패 확인** — Run: `node --test test/helpers.fakecli.test.mjs` → FAIL (`makeFakeClis` 없음)

- [ ] **Step 3: `test/fixtures/fake-cli.mjs` 작성**

```js
// 가짜 CLI 본체. 셸 심(.cmd / sh)이 `node fake-cli.mjs <이름> <인자...>`로 부른다.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
const [name, ...args] = process.argv.slice(2)
const key = [name, ...args].join(' ')
appendFileSync(process.env.FAKE_CLI_LOG, `${JSON.stringify(key)}\n`)
const responses = existsSync(process.env.FAKE_CLI_RESPONSES) ? JSON.parse(readFileSync(process.env.FAKE_CLI_RESPONSES, 'utf8')) : {}
const r = responses[key] ?? { out: '', code: 0 }
process.stdout.write(r.out ?? '')
process.exit(r.code ?? 0)
```

- [ ] **Step 4: `test/helpers.mjs`에 구현**

```js
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { delimiter } from 'node:path'

// git이 있는 디렉터리 — 테스트가 PATH를 줄여도 makeTempRepo의 git은 돌아야 한다.
function gitDir() {
  const finder = process.platform === 'win32' ? 'where' : 'which'
  const first = execFileSync(finder, ['git'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim()
  return dirname(first)
}

const FAKE_CLI = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'fake-cli.mjs')

export function makeFakeClis(names, responses = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-cli-'))
  const log = join(dir, 'calls.log')
  const responsesFile = join(dir, 'responses.json')
  writeFileSync(log, '')
  writeFileSync(responsesFile, JSON.stringify(responses))
  for (const name of names) {
    if (process.platform === 'win32') {
      writeFileSync(join(dir, `${name}.cmd`), `@"${process.execPath}" "${FAKE_CLI}" ${name} %*\r\n`)
    } else {
      const file = join(dir, name)
      writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${FAKE_CLI}" ${name} "$@"\n`)
      chmodSync(file, 0o755)
    }
  }
  return {
    dir,
    env: { PATH: `${dir}${delimiter}${gitDir()}`, FAKE_CLI_LOG: log, FAKE_CLI_RESPONSES: responsesFile },
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
  }
}
```
`isolateGlobalHome()` 끝(return 앞)에 추가:
```js
  // 실제 claude·codex·agy가 PATH에 있으면 감지가 개발 머신 상태를 읽는다.
  process.env.PATH = gitDir()
```
(`helpers.mjs` 상단 import에 `chmodSync, existsSync, readFileSync, writeFileSync`, `delimiter`를 더한다.)

Windows `.cmd` 심의 `%*`는 makeExec가 각 인자를 큰따옴표로 감싼 줄을 그대로 넘기고, node가 그 따옴표를 벗겨 argv를 복원한다 — 테스트의 `'a b'` 인자가 이를 확인한다.

- [ ] **Step 5: 통과 확인** — Run: `node --test test/helpers.fakecli.test.mjs` → PASS. 이어 `npm test` → PASS (isolateGlobalHome을 쓰는 기존 테스트가 PATH 축소로 깨지면 그 테스트가 npx·node를 이름으로 부르는 자리를 `process.execPath`로 바꾼다).

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/test/helpers.mjs agent-installer/test/fixtures/fake-cli.mjs agent-installer/test/helpers.fakecli.test.mjs
git commit -m "test(installer): 가짜 CLI와 PATH 격리 도우미를 넣는다"
```

---

### Task 6: 항목 이전 — 네 CLI로 축소하고 전 항목을 레시피로

**Files:**
- Modify: `agent-installer/lib/clis.mjs` (전체 교체)
- Modify: `agent-installer/lib/catalog.mjs` (`loadItems({ scope })`, `defineMcp`·`definePlugin`·`defineSkill`·`defineRegistrySkill`·`assertReasons` 삭제)
- Modify: `agent-installer/lib/recipe.mjs`, `recipe-helpers.mjs`, `commands.mjs`, `activation.mjs` (`TARGET_CLI_IDS` → `CLI_IDS`)
- Modify: `agent-installer/lib/tui/detail.mjs` (MCP 파일 경로 표시 제거)
- Delete: `agent-installer/lib/global-plugin.mjs`, `agent-installer/lib/claude-plugins.mjs`, `agent-installer/lib/tomlfile.mjs`, `agent-installer/lib/items/global.ponytail.mjs`, `agent-installer/lib/items/global.superpowers.mjs`, `agent-installer/lib/items/mcp.ai-memory.mjs`
- Create: `agent-installer/lib/items/plugin.ai-memory.mjs`
- Modify: `agent-installer/lib/items/mcp.*.mjs`(7), `plugin.*.mjs`(8), `skill.*.mjs`(21)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Delete tests: `test/items.superpowers-global.test.mjs`, `test/items.ponytail-global.test.mjs`, `test/items.ponytail.test.mjs`, `test/claude-plugins.test.mjs`, `test/tomlfile.test.mjs`
- Modify tests: `test/clis.test.mjs`, `test/catalog.test.mjs`, `test/catalog.registry.test.mjs`, `test/items.test.mjs`, `test/items.gsd.test.mjs`, `test/tui.detail.test.mjs`, 그 밖에 삭제된 CLI·함수를 참조하는 테스트

**Interfaces:**
- Consumes: Task 1–4 전부
- Produces:
  - `CLIS`(네 개, `{ label, bin }`), `CLI_IDS`
  - `loadItems({ scope = 'project' } = {}) → Item[]` — 레시피 항목은 `bindScope`, 함수형 항목(`config.gitmessage.*`)은 `item.scope === scope`일 때만
  - 항목 id 목록(project 39개): `config.gitmessage.{en,ko}`, `mcp.{codebase-memory,graft,graphify,headroom,notion,supabase,vercel}`, `plugin.{ai-memory,cli-anything,ecc,hyperframes,impeccable,mattpocock-skills,ponytail,superpowers,understand-anything}`, `skill.*` 21개(기존과 같은 id)

- [ ] **Step 1: `lib/clis.mjs` 전체 교체**

```js
// 2.0.0이 지원하는 네 CLI. 설치는 각 CLI의 공식 명령이 맡으므로 여기에는
// 이름과 실행 파일만 둔다 — 설정 파일 경로와 쓰기 어댑터는 더는 없다.
export const CLIS = {
  claude: { label: 'Claude Code', bin: 'claude' },
  codex: { label: 'Codex', bin: 'codex' },
  opencode: { label: 'OpenCode', bin: 'opencode' },
  // Antigravity CLI의 실행 파일 이름은 agy다.
  antigravity: { label: 'Antigravity', bin: 'agy' },
}

export const CLI_IDS = Object.keys(CLIS)
```
그다음 `rg -l "TARGET_CLI_IDS" agent-installer/lib`의 모든 파일에서 `TARGET_CLI_IDS`를 `CLI_IDS`로 바꾼다(`recipe.mjs`는 `import { CLIS, CLI_IDS as RECIPE_CLIS } from './clis.mjs'`). `rg -n "MCP_CLI_IDS|\.file\b.*CLIS|CLIS\[.*\]\.(has|add|remove|file)" agent-installer/lib` 결과가 0이 될 때까지 참조를 지운다.

- [ ] **Step 2: `lib/catalog.mjs`의 `loadItems` 교체와 옛 정의 함수 삭제**

```js
import { bindScope } from './recipe.mjs'

// 레시피 항목은 범위마다 다른 모양으로 묶인다. 그 범위에 레시피가 없는
// 항목(예: gstack의 전역)은 목록에서 빠진다. 파일을 직접 쓰는 함수형 항목은
// 자기 scope와 같은 범위에서만 나온다.
export async function loadItems({ scope = 'project' } = {}) {
  const files = readdirSync(ITEMS_DIR).filter((f) => f.endsWith('.mjs')).sort()
  const items = []
  for (const f of files) {
    const mod = await import(pathToFileURL(join(ITEMS_DIR, f)).href)
    if (mod.default?.kind === 'recipe') {
      const item = bindScope(mod.default, scope)
      if (item) items.push(item)
      continue
    }
    const item = validate(mod.default, f)
    if ((item.scope ?? 'project') === scope) items.push(item)
  }
  return items
}
```
`defineMcp`, `definePlugin`, `defineSkill`, `defineRegistrySkill`, `assertReasons`와 그 주석을 지운다. 그 결과 쓰지 않게 된 import(`CLIS, CLI_IDS, MCP_CLI_IDS`, `isPluginEnabled…`, `repoPath, repoPathStrict`, `msg`, skills-registry의 함수들, `existsSync` 등)를 지운다. `makeExec`, `shellQuote`, `EXEC_TIMEOUT_MS`, `EXEC_MAX_BUFFER`, `validate`, `loadItems`는 남는다.

- [ ] **Step 3: MCP 항목 7개 교체** — 각 파일의 머리 주석(상류 설명)은 남기고 본문을 아래로

`mcp.codebase-memory.mjs`:
```js
import { defineRecipe } from '../recipe.mjs'
import { mcpServer } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'mcp.codebase-memory', category: 'mcp', label: 'Codebase Memory MCP', group: '__context',
  note: 'item.mcp.codebase-memory.note',
  ...mcpServer({ name: 'codebase-memory', server: { kind: 'stdio', command: 'codebase-memory-mcp', args: [] } }),
})
```
같은 꼴로(값만 다름):

| 파일 | id / label / group | name | server |
|---|---|---|---|
| `mcp.graft.mjs` | `mcp.graft` / `Graft MCP` / `__context` | `graft` | `{ kind: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft', 'mcp'] }` |
| `mcp.graphify.mjs` | `mcp.graphify` / `Graphify MCP` / `__context` | `graphify` | `{ kind: 'stdio', command: 'graphify-mcp', args: [] }` |
| `mcp.headroom.mjs` | `mcp.headroom` / `Headroom MCP` / `__token` | `headroom` | `{ kind: 'stdio', command: 'headroom', args: ['mcp', 'serve'] }` |
| `mcp.notion.mjs` | `mcp.notion` / `Notion MCP` / `__service` | `notion` | `{ kind: 'http', url: 'https://mcp.notion.com/mcp' }` |
| `mcp.supabase.mjs` | `mcp.supabase` / `Supabase MCP` / `__service` | `supabase` | `{ kind: 'http', url: 'https://mcp.supabase.com/mcp' }` |
| `mcp.vercel.mjs` | `mcp.vercel` / `Vercel MCP` / `__service` | `vercel` | `{ kind: 'http', url: 'https://mcp.vercel.com' }` |

note 키는 기존 `item.mcp.<name>.note` 그대로.

- [ ] **Step 4: 플러그인 항목 교체**

`plugin.ponytail.mjs`(전체 교체 — 옛 OpenCode 배열 편집 코드는 지운다):
```js
import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// DietrichGebert/ponytail. 하니스별 공식 경로(상류 README·INSTALL.md, 2026-10-24):
// Claude·Codex는 마켓플레이스, OpenCode는 opencode plugin, Antigravity는
// agy plugin install <git URL>. Codex는 설치 후 /hooks에서 훅 두 개를 신뢰해야
// 켜진다(hooks: true가 활성화 안내에 싣는다).
export default defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', group: '__token',
  note: 'item.plugin.ponytail.note',
  verified: '2026-10-24',
  hooks: true,
  postInstall: 'item.plugin.ponytail.post',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    opencode: { module: '@dietrichgebert/ponytail' },
    antigravity: { source: 'https://github.com/DietrichGebert/ponytail', name: 'ponytail' },
  }),
})
```
`plugin.superpowers.mjs`:
```js
import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

// obra/superpowers. Claude는 공식 마켓플레이스(claude-plugins-official, 추가
// 등록 불필요), Codex는 obra/superpowers-marketplace(2026-08-15 헤드리스 실측),
// OpenCode는 git 모듈, Antigravity는 agy plugin install <git URL>(상류 README).
export default defineRecipe({
  id: 'plugin.superpowers', category: 'plugin', label: 'superpowers', group: '__flow',
  exclusive: 'superpowers',
  note: 'item.plugin.superpowers.note',
  verified: '2026-10-24',
  ...marketplacePlugin({
    claude: { id: 'superpowers@claude-plugins-official', detectIds: ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace'] },
    codex: { marketplace: 'obra/superpowers-marketplace', id: 'superpowers@superpowers-marketplace' },
    opencode: { module: 'superpowers@git+https://github.com/obra/superpowers.git' },
    antigravity: { source: 'https://github.com/obra/superpowers', name: 'superpowers' },
  }),
})
```
`plugin.ai-memory.mjs`(신규):
```js
import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin, mcpServer } from '../recipe-helpers.mjs'

// akitaonrails/ai-memory(MIT). Claude·Codex는 상류 마켓플레이스 플러그인(훅·스킬
// 포함), OpenCode·Antigravity는 상류 docs/install.md가 다른 클라이언트에 쓰는
// stdio 브리지(`ai-memory mcp-bridge --no-session-id`)를 MCP로 건다. 어느 쪽이든
// ai-memory 바이너리와 서버가 먼저 있어야 한다(postInstall 안내).
const plugin = marketplacePlugin({
  claude: { marketplace: 'akitaonrails/ai-memory', id: 'ai-memory@ai-memory' },
  codex: { marketplace: 'akitaonrails/ai-memory', id: 'ai-memory@ai-memory' },
})
const bridge = mcpServer({
  name: 'ai-memory',
  server: { kind: 'stdio', command: 'ai-memory', args: ['mcp-bridge', '--no-session-id'] },
  clis: ['opencode', 'antigravity'],
})

export default defineRecipe({
  id: 'plugin.ai-memory', category: 'plugin', label: 'ai-memory', group: '__context',
  note: 'item.plugin.ai-memory.note',
  verified: '2026-10-24',
  hooks: true,
  postInstall: 'item.plugin.ai-memory.post',
  recipes: { ...plugin.recipes, ...bridge.recipes },
  detect: { ...plugin.detect, ...bridge.detect },
})
```
Claude 전용·부분 지원 플러그인(머리 주석 유지, 본문 교체):

| 파일 | 공통 필드 | `marketplacePlugin` 인자 | `reasons` |
|---|---|---|---|
| `plugin.cli-anything.mjs` | `id: 'plugin.cli-anything', category: 'plugin', label: 'CLI-Anything', group: '__service', note: 'item.plugin.cli-anything.note', verified: '2026-10-06'` | `claude: { marketplace: 'HKUDS/CLI-Anything', id: 'cli-anything@cli-anything' }` | `{ codex: 'item.unsupported.cliAnythingCodex', opencode: 'item.unsupported.cliAnythingManual', antigravity: 'item.unsupported.upstreamNone' }` |
| `plugin.ecc.mjs` | `id: 'plugin.ecc', label: 'ECC', group: '__flow', note: 'item.plugin.ecc.note', verified: '2026-10-24', hooks: true` | `claude: { marketplace: 'affaan-m/ECC', id: 'ecc@ecc' }, codex: { marketplace: 'affaan-m/ECC', id: 'ecc@ecc' }` | `{ opencode: 'item.unsupported.eccScale', antigravity: 'item.unsupported.eccScale' }` |
| `plugin.hyperframes.mjs` | `id: 'plugin.hyperframes', label: 'HyperFrames', group: '__service', note: 'item.plugin.hyperframes.note', verified: '2026-10-06'` | `claude: { marketplace: 'heygen-com/hyperframes', id: 'hyperframes@hyperframes' }` | `{ codex: 'item.unsupported.superpowersSeparate', opencode: 'item.unsupported.superpowersSeparate', antigravity: 'item.unsupported.superpowersSeparate' }` |
| `plugin.impeccable.mjs` | `id: 'plugin.impeccable', label: 'impeccable', group: '__style', exclusive: 'impeccable', note: 'item.plugin.impeccable.note', verified: '2026-10-06'` | `claude: { marketplace: 'pbakaus/impeccable', id: 'impeccable@impeccable' }` | `{ codex: 'item.unsupported.impeccableSkill', opencode: 'item.unsupported.impeccableSkill', antigravity: 'item.unsupported.impeccableSkill' }` |
| `plugin.mattpocock-skills.mjs` | `id: 'plugin.mattpocock-skills', label: 'Matt Pocock', group: '__flow', exclusive: 'mattpocock', note: 'item.plugin.mattpocock-skills.note', verified: '2026-10-24'` | `claude: { marketplace: 'mattpocock/skills', id: 'mattpocock-skills@mattpocock' }, codex: { marketplace: 'mattpocock/skills', id: 'mattpocock-skills@mattpocock' }` | `{ opencode: 'item.unsupported.mattpocockRegistry', antigravity: 'item.unsupported.mattpocockRegistry' }` |
| `plugin.understand-anything.mjs` | `id: 'plugin.understand-anything', label: 'Understand Anything', group: '__context', note: 'item.plugin.understand-anything.note', verified: '2026-08-15'` | `claude: { marketplace: 'Egonex-AI/Understand-Anything', id: 'understand-anything@understand-anything' }` | `{ codex: 'item.unsupported.uaUser', opencode: 'item.unsupported.uaUser', antigravity: 'item.unsupported.uaUser' }` |

예 — `plugin.ecc.mjs` 본문:
```js
import { defineRecipe } from '../recipe.mjs'
import { marketplacePlugin } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'plugin.ecc', category: 'plugin', label: 'ECC', group: '__flow',
  note: 'item.plugin.ecc.note',
  verified: '2026-10-24',
  hooks: true,
  ...marketplacePlugin({
    claude: { marketplace: 'affaan-m/ECC', id: 'ecc@ecc' },
    codex: { marketplace: 'affaan-m/ECC', id: 'ecc@ecc' },
  }),
  reasons: { opencode: 'item.unsupported.eccScale', antigravity: 'item.unsupported.eccScale' },
})
```

- [ ] **Step 5: 레지스트리 스킬 19개 교체** — `rg -l defineRegistrySkill agent-installer/lib/items`의 각 파일에서

```js
import { defineRegistrySkill } from '../catalog.mjs'
export default defineRegistrySkill({ id, label, group, source, skill, anchor?, exclusive?, note, verified? })
```
를
```js
import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
export default defineRecipe({
  id, category: 'skill', label, group, exclusive?, note, verified?,
  ...skillsAdd({ source, skill, anchor? }),
})
```
로 바꾼다(필드 값은 파일의 기존 값 그대로, 머리 주석 유지). 예 — `skill.caveman.mjs`:
```js
import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'

export default defineRecipe({
  id: 'skill.caveman', category: 'skill', label: 'caveman', group: '__token',
  note: 'item.skill.caveman.note',
  ...skillsAdd({ source: 'https://github.com/JuliusBrussee/caveman', skill: 'caveman' }),
})
```

- [ ] **Step 6: `skill.gsd.mjs`·`skill.gstack.mjs` 교체**

`skill.gsd.mjs`(머리 주석 중 copilot·kilo·gemini·kimi 설명은 지우고 상류 플래그 설명은 남긴다):
```js
import { defineRecipe } from '../recipe.mjs'

// GSD는 런타임 플래그(--claude 등)로 저장소 안 디렉터리에 설치한다(--local).
// 감지는 런타임별 디렉터리의 gsd- 이름으로 한다 — 제거가 상태 파일 등 잔재를
// 남기므로(2026-08-16 실측) 디렉터리 존재만으로는 판정할 수 없다.
const RUNTIMES = {
  claude: ['.claude/commands', '.claude/skills'],
  codex: ['.codex/skills'],
  opencode: ['.opencode/skills'],
}
const NPX = ['npx', '-y', '@opengsd/gsd-core@latest']

export default defineRecipe({
  id: 'skill.gsd', category: 'skill', label: 'GSD (Get Shit Done)', group: '__flow',
  note: 'item.skill.gsd.note',
  verified: '2026-08-15',
  recipes: Object.fromEntries(Object.keys(RUNTIMES).map((cli) => [cli, {
    project: {
      install: [[...NPX, `--${cli}`, '--local']],
      // 런타임 플래그 없는 --uninstall은 기본값 claude를 지운다 — 늘 플래그를 준다.
      uninstall: [[...NPX, `--${cli}`, '--local', '--uninstall']],
    },
  }])),
  detect: Object.fromEntries(Object.entries(RUNTIMES).map(([cli, dirs]) => [cli, (p) => dirs.some((d) => p.dirHasPrefix(d, 'gsd-'))])),
  reasons: { antigravity: 'item.unsupported.unmeasuredUpstream' },
})
```
`skill.gstack.mjs`:
```js
import { rmSync } from 'node:fs'
import { defineRecipe } from '../recipe.mjs'
import { repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries, removeGitignoreEntries } from '../gitignore.mjs'

// (기존 머리 주석 유지)
const DIR = '.claude/skills/gstack'
const IGNORE_ENTRIES = ['.claude/skills/gstack', '.agents/skills/gstack']
const removeDir = ({ root }) => rmSync(repoPathStrict(root, DIR), { recursive: true, force: true })

export default defineRecipe({
  id: 'skill.gstack', category: 'skill', label: 'gstack', group: '__flow',
  note: 'item.skill.gstack.note',
  verified: '2026-08-15',
  recipes: {
    claude: {
      project: {
        install: [
          ['git', 'clone', '--single-branch', '--depth', '1', 'https://github.com/garrytan/gstack.git', DIR],
          // setup이 실패하면 반쯤 깔린 클론을 지운다 — 남기면 다음 감지가 설치됨으로 읽는다.
          { argv: ['bash', './setup'], cwd: DIR, undo: removeDir },
          { describe: `add ${IGNORE_ENTRIES.join(', ')} to .gitignore`, fn: ({ root }) => ensureGitignoreEntries(root, IGNORE_ENTRIES) },
        ],
        uninstall: [
          { argv: ['bash', './bin/gstack-uninstall', '--force'], cwd: DIR, tolerateFail: true },
          { describe: `remove ${DIR} and its .gitignore entries`, fn: (ctx) => { removeDir(ctx); removeGitignoreEntries(ctx.root, IGNORE_ENTRIES) } },
        ],
      },
    },
  },
  detect: { claude: (p) => p.exists(DIR) },
  reasons: {
    codex: 'item.unsupported.gstackShared',
    opencode: 'item.unsupported.gstackShared',
    antigravity: 'item.unsupported.upstreamNone',
  },
})
```

- [ ] **Step 7: 지울 파일 삭제**

```bash
cd agent-installer
git rm lib/global-plugin.mjs lib/claude-plugins.mjs lib/tomlfile.mjs \
  lib/items/global.ponytail.mjs lib/items/global.superpowers.mjs \
  test/items.superpowers-global.test.mjs test/items.ponytail-global.test.mjs test/items.ponytail.test.mjs \
  test/claude-plugins.test.mjs test/tomlfile.test.mjs
rm lib/items/mcp.ai-memory.mjs   # 커밋된 적 없는 작업 파일
```

- [ ] **Step 8: `lib/tui/detail.mjs`의 MCP 파일 표시 제거**

`import { CLIS } from '../clis.mjs'`와 `showFile`·`pairs` 계산을 지우고, 지원 CLI 줄은 `supports` 이름만 나열한다(`supports.join(', ')`가 쓰이던 다른 카테고리와 같은 경로). 해당 부분을 읽고 `item.category === 'mcp'` 분기만 걷어 낸다.

- [ ] **Step 9: i18n 정리**

1. 새 키(en/ko):
   - en `'item.plugin.ponytail.post': 'Node.js must be on PATH for the always-on hook to run'`, ko `'item.plugin.ponytail.post': '상시 활성화 훅이 돌려면 Node.js가 PATH에 있어야 한다'`
   - en `'item.plugin.ai-memory.post': 'install the ai-memory binary first (install.sh / install.ps1 from the upstream release), run ai-memory setup once, and resume a session with ai-memory run <agent>'`, ko `'item.plugin.ai-memory.post': 'ai-memory 바이너리를 먼저 설치하고(상류 릴리스의 install.sh / install.ps1) ai-memory setup을 한 번 실행한다. 세션 이어받기는 ai-memory run <agent>'`
   - `item.plugin.ai-memory.note`: 기존 `item.mcp.ai-memory.note` 값을 옮기되 문장을 "Claude·Codex는 상류 마켓플레이스 플러그인, OpenCode·Antigravity는 mcp-bridge MCP"로 고친다(en/ko). `item.mcp.ai-memory.note`는 지운다.
2. 지울 키: `rg -n "'(item\.global\.(ponytail|superpowers)\.note|item\.unsupported\.(claudePlugin|claudeSkill|ponytailUser|ponytailRules|noProjectMcp|superpowersGlobalClaude|superpowersGlobalKimi|globalProjectItem|gsdKimiLocal|gsdGemini|gstackHost|gstackSharedShallow|eccCodexHome)|item\.plugin\.deferred|item\.global\.skipped|log\.(mcp|plugin)\.(add|remove)|error\.(ponytailOpencodePlugin|registrySkillAnchor|registrySkillInstall|gsdInstall|gsdUninstall|gstackClone|gstackSetup))'" agent-installer/lib/i18n/catalog` — 각 키를 `rg "<key>" agent-installer/lib agent-installer/test`로 확인해 남은 사용처가 없을 때만 en·ko 양쪽에서 지운다.
3. 남는 사유·note 문장 중 지운 CLI를 언급하는 것을 고친다: `rg -n -i "gemini|kiro|grok|copilot|kilo|kimi" agent-installer/lib/i18n/catalog`. 문장의 뜻(상류가 무엇을 제공하나)은 유지하고 지운 CLI 이름과 "this item wires Claude Code only"류의 낡은 단정만 고친다. 예: `item.unsupported.mattpocockRegistry` → en `'upstream documents npx skills add — the shared-skill edition skill.mattpocock-skills covers this CLI'`, ko `'상류는 npx skills add를 안내한다 — 공유 스킬 판 skill.mattpocock-skills가 이 CLI를 덮는다'`.

- [ ] **Step 10: 테스트 갱신**

- `test/clis.test.mjs`: 어댑터 쓰기 테스트를 전부 지우고 다음으로 교체:
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'

test('지원 CLI는 넷이고 실행 파일 이름을 갖는다', () => {
  assert.deepEqual(CLI_IDS, ['claude', 'codex', 'opencode', 'antigravity'])
  assert.deepEqual(CLI_IDS.map((c) => CLIS[c].bin), ['claude', 'codex', 'opencode', 'agy'])
})
```
- `test/items.test.mjs`: 개수·id 테스트를
```js
test('loadItems: project 39개, user 31개', async () => {
  const project = await loadItems()
  assert.equal(project.length, 39)
  const ids = project.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  for (const id of ['plugin.ai-memory', 'plugin.ponytail', 'plugin.superpowers', 'skill.gsd', 'skill.gstack', 'config.gitmessage.ko', 'mcp.graft']) assert.ok(ids.includes(id), id)
  for (const id of ['global.ponytail', 'global.superpowers', 'mcp.ai-memory']) assert.ok(!ids.includes(id), id)
  const user = await loadItems({ scope: 'user' })
  assert.equal(user.length, 31)
  const uids = user.map((i) => i.id)
  for (const id of ['skill.gsd', 'skill.gstack', 'skill.superpowers', 'config.gitmessage.ko']) assert.ok(!uids.includes(id), `${id}는 전역에 없다`)
  assert.ok(user.every((i) => i.scope === 'user'))
})
```
로 바꾸고, 같은 파일에서 지운 CLI·`global.*`·`defineX`를 겨냥한 단언을 지운다. "모든 항목의 사유는 렌더된다" 류 테스트는 두 범위(`loadItems()`, `loadItems({ scope: 'user' })`) 모두를 돌게 한다.
- 실제 항목 명령을 고정하는 테스트를 `test/items.test.mjs`에 추가:
```js
test('Ponytail·ai-memory 전역 명령은 상류 안내와 같다', async () => {
  const user = await loadItems({ scope: 'user' })
  const pick = (id) => user.find((i) => i.id === id)
  const cmds = (item) => item.steps('install', { targets: item.supports }).filter((s) => s.argv).map((s) => s.argv.join(' '))
  assert.deepEqual(cmds(pick('plugin.ponytail')).filter((c) => c.startsWith('codex')), [
    'codex plugin marketplace add DietrichGebert/ponytail', 'codex plugin add ponytail@ponytail',
  ])
  assert.deepEqual(cmds(pick('plugin.ai-memory')).filter((c) => c.startsWith('codex')), [
    'codex plugin marketplace add akitaonrails/ai-memory', 'codex plugin add ai-memory@ai-memory',
  ])
  assert.ok(cmds(pick('plugin.ai-memory')).includes('agy mcp add ai-memory -- ai-memory mcp-bridge --no-session-id'))
})
```
- `test/items.gsd.test.mjs`: 파일 기반 detect와 플래그 테스트를 새 레시피(`steps`)·`probe.dirHasPrefix` 기준으로 고친다 — 런타임은 claude·codex·opencode 셋, 설치·제거 argv가 CLI마다 한 줄씩인지 단언.
- `test/catalog.test.mjs`·`test/catalog.registry.test.mjs`: `defineMcp`·`definePlugin`·`defineRegistrySkill`을 겨냥한 테스트는 지우고, 레지스트리 보조 함수(`findSkillDir`·`lockedSkills`·`pruneLock`) 테스트는 `../lib/skills-registry.mjs`에서 import하도록 바꾼다. `shellQuote`·`makeExec` 테스트는 그대로 둔다.
- 나머지: `rg -l "global\.(ponytail|superpowers)|mcp\.ai-memory|MCP_CLI_IDS|claude-plugins|tomlfile|gemini|kiro|grok|copilot|kilo|kimi" agent-installer/test`의 각 파일에서 지운 대상을 겨냥한 단언을 지우거나 네 CLI 기준으로 고친다. TUI·install 테스트가 실제 항목을 스캔하면 `isolateGlobalHome()`(Task 5)이 PATH를 줄여 실제 CLI가 끼지 않는다.

- [ ] **Step 11: 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS. 실패하는 테스트는 (a) 지운 기능을 겨냥한 것이면 지우고, (b) 남은 기능이면 코드를 고친다 — 어느 쪽인지 커밋 본문에 적는다.

- [ ] **Step 12: 커밋**

```bash
git add -A agent-installer
git commit -m "refactor(installer): 항목을 CLI 명령 레시피로 옮기고 지원 CLI를 넷으로 줄인다"
```

---

### Task 7: 비대화형 경로 — `--global`·`--print`·활성화 안내·status

**Files:**
- Modify: `agent-installer/lib/args.mjs`
- Modify: `agent-installer/install.mjs` (`runClassic`, `main`의 TUI 호출)
- Modify: `agent-installer/lib/status.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs` (`usage.root`, `usage.design`에 영향 없음)
- Test: `agent-installer/test/args.test.mjs`, `agent-installer/test/install.cli.test.mjs`, `agent-installer/test/status.test.mjs`

**Interfaces:**
- Consumes: `loadItems({ scope })`, `scan(root, items, { probe })`, `createProbe`, `makeExec`, `planCommands`, `formatCommands`, `activationLines`
- Produces: `parseRootArgs(argv) → { …, scope: 'project'|'user', dryRun }` (`dryRun`은 `--dry-run` 또는 `--print`)

- [ ] **Step 1: 실패하는 테스트**

`test/args.test.mjs`에 추가:
```js
test('루트: --global은 user 범위, --print는 --dry-run과 같다', () => {
  assert.equal(parseRootArgs([]).scope, 'project')
  assert.equal(parseRootArgs(['--global', '--list']).scope, 'user')
  assert.equal(parseRootArgs(['--print', '--set', 'a']).dryRun, true)
  assert.equal(parseRootArgs(['--dry-run', '--set', 'a']).dryRun, true)
  assert.throws(() => parseRootArgs(['--global=1']), /flagTakesNoValue|takes no value/)
})
```
`test/install.cli.test.mjs`에 추가(파일 상단 import에 `makeFakeClis`):
```js
test('--set이 CLI 명령을 실행하고, 다음 실행은 감지로 아무것도 하지 않는다', () => {
  const repo = makeTempRepo()
  const fake = makeFakeClis(['claude'], {})
  const r = runInstaller(repo, ['--set', 'mcp.notion'], { env: { ...fake.env, AGENT_SETUP_LANG: 'en', HOME: repo, USERPROFILE: repo } })
  assert.equal(r.status, 0, r.stderr)
  assert.ok(fake.calls().includes('claude mcp add -s project -t http notion https://mcp.notion.com/mcp'), fake.calls().join('\n'))
  assert.match(r.stdout, /After installing:/)
})

test('--print는 명령만 출력하고 아무것도 실행하지 않는다', () => {
  const repo = makeTempRepo()
  const fake = makeFakeClis(['claude', 'codex'], { 'codex plugin list --json': { out: '{"installed":[]}' }, 'claude plugin list --json': { out: '[]' } })
  const r = runInstaller(repo, ['--global', '--print', '--set', 'plugin.ponytail'], { env: { ...fake.env, AGENT_SETUP_LANG: 'en', HOME: repo, USERPROFILE: repo } })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /# Codex — user-global\ncodex plugin marketplace add DietrichGebert\/ponytail\ncodex plugin add ponytail@ponytail/)
  assert.ok(fake.calls().every((c) => c.includes(' list')), `목록 명령 외에는 부르지 않는다: ${fake.calls()}`)
})

test('--global --set은 목록 밖 전역 항목을 지우지 않는다', () => {
  const repo = makeTempRepo()
  const list = JSON.stringify([{ id: 'ecc@ecc', scope: 'user', enabled: true }])
  const fake = makeFakeClis(['claude'], { 'claude plugin list --json': { out: list } })
  const r = runInstaller(repo, ['--global', '--set', 'plugin.ponytail'], { env: { ...fake.env, AGENT_SETUP_LANG: 'en', HOME: repo, USERPROFILE: repo } })
  assert.equal(r.status, 0, r.stderr)
  assert.ok(!fake.calls().some((c) => c.includes('uninstall ecc@ecc')))
  assert.match(r.stdout, /plugin\.ecc is a user-global item/)
})
```
(가짜 claude는 `plugin list --json`에 응답이 없으면 빈 출력을 내 JSON 파싱이 실패한다 → 감지 실패. 첫 테스트는 MCP라 목록 명령을 부르지 않는다. 세 번째 테스트가 쓰는 `run.keepUserScope` 영어 문구가 다르면 실제 문구에 맞춘다.)

- [ ] **Step 2: 실패 확인** — Run: `node --test test/args.test.mjs test/install.cli.test.mjs` → FAIL

- [ ] **Step 3: `lib/args.mjs` 수정**

`ROOT_SPEC`에 `'--global': 'bool', '--print': 'bool'`을 더한다. `parseRootArgs`의 help 반환값에 `scope: 'project'`를 더하고, 본 반환값을
```js
    // --print는 --dry-run의 새 이름이다. 두 런처가 아직 --dry-run을 넘긴다.
    dryRun: argv.includes('--dry-run') || argv.includes('--print'),
    scope: argv.includes('--global') ? 'user' : 'project',
```
로 바꾼다.

- [ ] **Step 4: `install.mjs` 수정**

`runClassic(root, { dryRun, listOnly, setArg, scope, t })`:
```js
  const { loadItems, makeExec } = await withDeps(() => import('./lib/catalog.mjs'), t)
  const { scan, planChanges, apply, assertExclusive } = await withDeps(() => import('./lib/engine.mjs'), t)
  const { createProbe } = await withDeps(() => import('./lib/probe.mjs'), t)
  const { planCommands, formatCommands } = await withDeps(() => import('./lib/commands.mjs'), t)
  const { activationLines } = await withDeps(() => import('./lib/activation.mjs'), t)
  ...
  const items = await loadItems({ scope })
  // 스캔마다 새 probe — 적용 뒤 재스캔이 적용 전 캐시를 읽으면 안 된다.
  const freshProbe = () => createProbe({ root, scope, exec: makeExec(false) })
  const states = await scan(root, items, { probe: freshProbe() })
```
변경 계획(`changes`)을 만든 직후, `apply` 앞에:
```js
  // 출력 모드: 같은 steps()로 명령만 낸다. 아무것도 실행하지 않는다.
  if (dryRun) {
    for (const line of formatCommands(planCommands(changes), { t, scope })) console.log(line)
    for (const line of activationLines(changes, t)) console.log(line)
    return
  }
```
`apply` 호출에서 `dryRun` 인자를 지우고(항상 false), 결과 출력 뒤:
```js
  const done = new Set(results.filter((r) => r.ok).map((r) => r.item.id))
  const notes = activationLines(changes.filter((c) => done.has(c.item.id)), t)
  if (notes.length > 0) console.log(`\n${notes.join('\n')}`)
```
재스캔은 `await scan(root, items, { probe: freshProbe() })`. `main`의 `runClassic(root, { ...opts, t })`는 그대로(opts에 scope가 있다). `openTui`도 `scope`를 넘기도록 `openTui(root, { dryRun, skillMode, designDirs, scope, t, localeForced })` → `runTui(root, { dryRun, skillMode, designDirs, scope, t, localeForced })`.

- [ ] **Step 5: `lib/status.mjs` 수정**

`collectStatus`의 항목 루프가 `item.detect({ root })` 대신 `engine.scan`을 쓰게 한다:
```js
import { scan } from './engine.mjs'
...
  const states = (await scan(root, items, { probe })).map((s) => ({ id: s.item.id, status: s.status }))
```
`collectStatus(root, { manifest, items, latest, now, probe = null })`로 받고, `runStatus`는 `loadItems({ scope: 'project' })`를 넘긴다. 기존 try/catch는 scan이 이미 하므로 지운다(검출 실패는 `absent`로 온다). `status.test.mjs`가 그대로 통과하는지 확인하고, 항목 상태 단언이 `detect({ root })` 호출 방식을 겨냥하면 `scan` 경유로 고친다.

- [ ] **Step 6: 사용법 문구**

`usage.root`(en/ko)의 옵션 목록에 다음 줄을 더하고 `--dry-run` 줄을 `--print` 설명으로 바꾼다:
- en: `'  --global          Install user-globally instead of into this repository.'`, `'  --print           Print the commands instead of running them (--dry-run is an alias).'`
- ko: `'  --global          이 저장소 대신 사용자 전역에 설치한다.'`, `'  --print           명령을 실행하지 않고 출력만 한다(--dry-run과 같다).'`

- [ ] **Step 7: 통과 확인** — Run: `cd agent-installer && npm test` → PASS

- [ ] **Step 8: 커밋**

```bash
git add agent-installer/install.mjs agent-installer/lib/args.mjs agent-installer/lib/status.mjs agent-installer/lib/i18n/catalog agent-installer/test
git commit -m "feat(installer): --global·--print와 설치 후 안내를 넣는다"
```

---

### Task 8: TUI — 범위 행·명령 보기·활성화 안내

**Files:**
- Modify: `agent-installer/lib/tui/rows.mjs` (`collectRows({ scope })`, 범위 행, plugin 범위 그룹 오버라이드 제거, 행에 `result` 보존)
- Modify: `agent-installer/lib/tui/run.mjs` (범위 전환, 검토 화면 `p`, 활성화 안내, `itemStates`)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs` (`action.scope.*`, `tui.review.hint`, `help.lines`)
- Test: `agent-installer/test/tui.rows.test.mjs`, `agent-installer/test/tui.run.test.mjs`

**Interfaces:**
- Consumes: `loadItems({ scope })`, `createProbe`, `makeExec`, `planCommands`, `formatCommands`, `activationLines`
- Produces: `collectRows(root, { …, scope })`, `buildActions(root, { designItems, scope, t })`, 행 필드 `result`, `itemStates(rows) → [{ item, status, result }]`, `runTui(root, { scope })`

- [ ] **Step 1: i18n 키**

en:
```js
  'action.scope.label': 'Install scope',
  'action.scope.hint': 'now: {current} · Enter switches repo ↔ user-global',
  'tui.scope.switched': 'Scope: {current}',
```
ko:
```js
  'action.scope.label': '설치 범위',
  'action.scope.hint': '현재: {current} · Enter로 저장소 ↔ 사용자 전역 전환',
  'tui.scope.switched': '범위: {current}',
```
`tui.review.hint`(en/ko)에 `p` 설명을 더한다 — en: 기존 문구 끝에 `' · p print commands'`, ko: `' · p 명령 보기'`. `help.lines`에도 같은 줄을 넣는다.

- [ ] **Step 2: 실패하는 테스트**

`test/tui.rows.test.mjs`에 추가:
```js
test('작업 탭에 범위 행이 있고 현재 범위를 보인다', () => {
  const t = createT('en')
  const actions = buildActions('/r', { designItems: [], scope: 'user', t })
  const row = actions.find((a) => a.id === 'action.scope')
  assert.ok(row)
  assert.match(row.hint, /user-global/)
})

test('plugin 탭은 범위가 아니라 성격 그룹으로 묶는다', () => {
  const item = { id: 'plugin.x', category: 'plugin', label: 'x', scope: 'user', group: '__flow', supports: ['claude'], unsupported: {} }
  const rows = buildRows({ agentStates: [{ item, status: 'absent', result: { targets: ['claude'] } }], t: createT('en') })
  const row = rows.find((r) => r.id === 'plugin.x')
  assert.equal(row.group, '__flow')
  assert.deepEqual(row.result.targets, ['claude'])
})
```
`test/tui.run.test.mjs`: 기존 키 입력 기반 테스트 패턴(가짜 stdin에 키 이벤트를 넣는 도우미)을 써서 (a) 범위 행에서 Enter → 상태줄 `Scope: user-global`, (b) 검토 화면에서 `p` → 출력 로그에 `print.title` 문구가 찍히고 apply가 돌지 않음을 단언한다. 이 파일의 기존 "검토 화면 Enter 적용" 테스트를 복제해 키만 `p`로 바꾸고, 가짜 항목의 `install`이 불리지 않았음을 확인한다.

- [ ] **Step 3: 실패 확인** — Run: `node --test test/tui.rows.test.mjs test/tui.run.test.mjs` → FAIL

- [ ] **Step 4: `lib/tui/rows.mjs` 수정**

1. `GROUP_ORDER`에서 `'__scope-project', '__scope-user'`를 지운다.
2. `buildRows`의 agents 매핑에서 `group:` 삼항을 `group: s.item.group ?? null`로 바꾸고 `itemRow` 호출에 `result: s.result ?? null`을 더한다. `itemRow`의 인자 목록에 `result = null`, 반환 객체에 `result`를 더한다.
3. `buildActions(root, { designItems = [], scope = 'project', t })`: 언어 행 바로 다음에
```js
    // 언어 행과 같은 방식 — run.mjs가 그 자리에서 범위를 바꾸고 다시 스캔한다.
    actionRow({
      id: 'action.scope',
      label: t('action.scope.label'),
      hint: t('action.scope.hint', { current: t(`scope.${scope}`) }),
      t,
    }),
```
4. `collectRows`: `opts.scope ?? 'project'`를 받아
```js
  const agentItems = await loadItems({ scope })
  const probe = createProbe({ root, scope, exec: makeExec(false) })
  ...
  const [agentStates, designStates] = await Promise.all([scan(root, agentItems, { probe }), scan(root, designItems)])
  ...
  actions: buildActions(root, { designItems, scope, t }),
```
(import에 `createProbe`(`../probe.mjs`), `makeExec`(`../catalog.mjs`)를 더한다.)

- [ ] **Step 5: `lib/tui/run.mjs` 수정**

1. `itemStates`: `.map((r) => ({ item: r.item, status: r.status, result: r.result }))`
2. `runTui` 옵션에 `scope: initialScope = 'project'`, 본문에 `let scope = initialScope`. `collectRows` 호출 두 곳(`collected =` 초기화, `rebuild`)에 `scope`를 넘긴다.
3. 메인 루프의 Enter 분기, 언어 행 처리 다음 줄:
```js
        if (row?.id === 'action.scope') {
          scope = scope === 'project' ? 'user' : 'project'
          // 다른 범위의 설치 상태로 선택을 다시 맞춘다 — 저장소에서 고르던 체크가
          // 전역 목록에 남으면 엉뚱한 항목이 설치된다.
          await rebuild(false)
          status = t('tui.scope.switched', { current: t(`scope.${scope}`) })
          continue
        }
```
4. `review`의 키 루프에 `if (key.str === 'p') return 'print'`를 더한다.
5. import에 `planCommands, formatCommands`(`../commands.mjs`), `activationLines`(`../activation.mjs`). 검토 뒤 분기:
```js
        // --print로 띄웠거나 검토 화면에서 p를 눌렀다 — 실행 대신 명령을 화면 밖에 편다.
        if (verdict === 'print' || dryRun) {
          await suspend(async () => {
            log('')
            for (const line of formatCommands(planCommands(changes), { t, scope })) log(line)
            for (const line of activationLines(changes, t)) log(line)
            await pause()
          })
          continue
        }
```
6. 적용 결과 표시(`suspend` 블록)의 `apply.seeGitDiff` 로그 앞에:
```js
          const done = new Set(results.filter((r) => r.ok).map((r) => r.item.id))
          const notes = activationLines(changes.filter((c) => done.has(c.item.id)), t)
          if (notes.length > 0) log(`\n${notes.join('\n')}`)
```
7. `runApply`의 `apply(...)` 인자 `dryRun`은 이제 늘 false다 — `dryRun,` 줄을 지운다(출력 모드는 위 5에서 끝난다).

- [ ] **Step 6: 통과 확인** — Run: `cd agent-installer && npm test` → PASS

- [ ] **Step 7: 커밋**

```bash
git add agent-installer/lib/tui agent-installer/lib/i18n/catalog agent-installer/test
git commit -m "feat(installer): TUI에 설치 범위 전환과 명령 보기를 넣는다"
```

---

### Task 9: 부트스트랩 축소와 이 저장소의 생성물 정리

**Files:**
- Modify: `agent-installer/lib/bootstrap/manifest.mjs`, `templates.mjs`, (필요 시) `apply.mjs`·`adapter.mjs`의 도구 이름 주석
- Modify: `setup-agents.sh`, `setup-agents.ps1` (도구 목록 문구가 있으면)
- Modify tests: `test/bootstrap.manifest.test.mjs`, `test/bootstrap.apply.test.mjs`, `test/bootstrap.flow.test.mjs`, `test/bootstrap.update.test.mjs`, `test/gitignore.test.mjs`, `test/i18n.ko.test.mjs`
- Delete (이 저장소): `GEMINI.md`, `kilo.jsonc`, `.gemini/`, `.grok/`, `.kimi-code/`, `.kiro/`, `.github/mcp.json`, `.github/copilot/`, `.vscode/mcp.json`
- Modify (이 저장소): `.vscode/settings.json`(`chat.useAgentsMdFile` 제거), `.gitignore`, `.agents/skills/README.md`, `.agent-kit/README.md`

**Interfaces:**
- Produces: `MANIFEST.tools = ['Claude Code', 'Codex', 'OpenCode', 'Antigravity']`, `MANIFEST.adapters = [{ tool: 'Claude Code', path: '.claude/skills' }]`, `MANIFEST.ignore = ['.claude/skills', '!.vscode/settings.json']`, `MANIFEST.settings = []`

- [ ] **Step 1: 실패하는 테스트** — `test/bootstrap.manifest.test.mjs`에 추가(기존 도구 수 단언은 이것으로 교체):

```js
test('부트스트랩은 네 도구만 다룬다', () => {
  assert.deepEqual(MANIFEST.tools, ['Claude Code', 'Codex', 'OpenCode', 'Antigravity'])
  const paths = MANIFEST.files.map((f) => f.path)
  for (const gone of ['.gemini/settings.json', '.grok/config.toml', 'kilo.jsonc', '.kiro/settings/mcp.json', '.kimi-code/mcp.json', '.github/mcp.json', '.github/copilot/settings.json', '.vscode/mcp.json']) {
    assert.ok(!paths.includes(gone), gone)
  }
  for (const kept of ['AGENTS.md', '.claude/settings.json', '.codex/config.toml', 'opencode.jsonc']) assert.ok(paths.includes(kept), kept)
  assert.deepEqual(MANIFEST.blocks.map((b) => b.path), ['CLAUDE.md'])
  assert.deepEqual(MANIFEST.adapters.map((a) => a.path), ['.claude/skills'])
  assert.deepEqual(MANIFEST.ignore, ['.claude/skills', '!.vscode/settings.json'])
  assert.deepEqual(MANIFEST.settings, [])
})
```

- [ ] **Step 2: 실패 확인** — Run: `node --test test/bootstrap.manifest.test.mjs` → FAIL

- [ ] **Step 3: `manifest.mjs`·`templates.mjs` 수정**

- `manifest.mjs`: `tools`를 위 넷으로, `dirs`를 `['.agents/skills', '.agent-kit', '.claude', '.codex']`로, `files`에서 지운 도구의 줄을 빼고, `blocks`를 `CLAUDE.md` 하나로, `settings`를 `[]`로, `ignore`를 `['.claude/skills', '!.vscode/settings.json']`로, `adapters`를 Claude 한 줄로. 주석 중 지운 도구 실측 근거는 지우고 남는 도구(Codex·OpenCode·Antigravity가 `.agents/skills`를 네이티브로 읽는다)는 남긴다. `.vscode/settings.json` 부정 항목 주석은 "config.gitmessage.*가 VS Code 커밋 템플릿을 이 파일에 배선한다"로 고친다. import 목록에서 지운 템플릿을 뺀다.
- `templates.mjs`: `GEMINI_BLOCK`, `GEMINI_SETTINGS`, `GROK_CONFIG`, `KILO_CONFIG`, `KIRO_MCP_CONFIG`, `KIMI_MCP_CONFIG`, `COPILOT_MCP_CONFIG`, `COPILOT_SETTINGS`, `VSCODE_MCP_CONFIG`를 지운다. `AGENTS_TEMPLATE`·`SKILL_README`·`AGENT_KIT_README`·`CODEX_CONFIG` 본문에서 지운 도구 이름을 빼고 네 도구 기준으로 고친다(`rg -n -i "gemini|kiro|grok|copilot|kilo|kimi|vs ?code" agent-installer/lib/bootstrap/templates.mjs`가 0건이 될 때까지, 단 VS Code 커밋 템플릿 언급은 예외).
- `record.mjs`가 템플릿의 옛 해시 목록(채택·갱신 판정용)을 들고 있으면, 지운 템플릿의 해시는 그대로 두되 바뀐 템플릿(AGENTS.md 등)의 1.28.0 해시를 "알려진 옛 판"으로 추가해 `update`가 이 저장소·사용자 저장소의 기존 파일을 드리프트가 아닌 갱신으로 처리하게 한다. 해당 구조가 없으면 손대지 않는다(`rg -n "hash" agent-installer/lib/bootstrap/record.mjs`로 확인).

- [ ] **Step 4: 부트스트랩 테스트 갱신**

`rg -n -i "gemini|kiro|grok|copilot|kilo|kimi|vscode/mcp|useAgentsMdFile" agent-installer/test/bootstrap.*.test.mjs agent-installer/test/gitignore.test.mjs agent-installer/test/i18n.ko.test.mjs`의 각 단언을 네 도구 기준으로 고치거나(개수·목록) 지운다(지운 도구만 겨냥한 것). Run: `cd agent-installer && npm test` → PASS.

- [ ] **Step 5: 이 저장소의 생성물 정리**

```bash
git rm -r GEMINI.md kilo.jsonc .gemini .grok .kimi-code .kiro .github/mcp.json .github/copilot .vscode/mcp.json
```
- `.vscode/settings.json`에서 `"chat.useAgentsMdFile": true` 키만 지운다(gitmessage 키는 유지).
- `.gitignore`의 agent-kit 블록에서 `.kiro/skills`, `.grok/skills`, `.kimi-code/local.toml`, `.github/copilot/settings.local.json`, `!.vscode/mcp.json` 줄을 지운다.
- `.agents/skills/README.md`, `.agent-kit/README.md`를 새 `SKILL_README`·`AGENT_KIT_README` 본문과 같게 고친다.
- `.kiro/steering/commit-messages.md`의 내용은 AGENTS.md "Commit messages" 절에 이미 있다 — 별도 이전 없음.

- [ ] **Step 6: 런처 확인**

`rg -n -i "gemini|kiro|grok|copilot|kilo|kimi" setup-agents.sh setup-agents.ps1` 결과가 있으면 네 도구 문구로 고친다. `bash -n ./setup-agents.sh` → 오류 없음.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor(bootstrap): 지원 도구를 넷으로 줄이고 생성물을 정리한다"
```

---

### Task 10: 문서와 버전

**Files:**
- Modify: `AgentSetup-README.ko.md`, `AgentSetup-README.md`, `agent-installer/README.md`, `README.md`
- Modify: `AgentSetup-README-CHANGES.ko.md`, `AgentSetup-README-CHANGES.md` (맨 위에 2.0.0 항목 추가 — 기존 이력은 고치지 않는다)
- Modify: `AGENTS.md` ("Full verification" 절)
- Modify: `agent-installer/package.json` (`version`, `keywords`, `description`)

- [ ] **Step 1: `package.json`**

`"version": "2.0.0"`. `keywords`에서 `gemini-cli`, `copilot`을 지우고 `opencode`, `antigravity`를 더한다. `description`의 "multiple coding-agent CLIs"는 유지.

- [ ] **Step 2: README 2종 고치기** (`AgentSetup-README.ko.md`가 원본, `.md`는 같은 구조의 영어판)

- "도구별 연결 방식" 표: 네 도구만. Antigravity 행은 "AGENTS.md·`.agents/skills` 네이티브, MCP·플러그인은 `agy` 명령(전역)".
- "다루지 않는 도구" 절: Gemini CLI·Kilo Code·Kiro·Kimi Code·Grok Build·GitHub Copilot CLI·VS Code Copilot을 2.0.0에서 지원 종료했다고 적고, 이미 생성된 파일은 설치기가 지우지 않으니 필요하면 손으로 지우라고 안내.
- "생성되는 구조"·"설치기가 실행하는 것": 9절(부트스트랩 축소) 기준으로 고친다.
- "선택 항목 설치기" 절 전면 개정: (1) 설치가 각 CLI의 공식 명령으로 돈다는 원칙과 CLI·범위 표(스펙 "사실 관계" 표), (2) `--global`·`--print`·TUI 범위 행·검토 화면 `p`, (3) 활성화 안내 예(Codex `/hooks` Trust, ai-memory 바이너리·`ai-memory setup`·`ai-memory run codex`), (4) OpenCode MCP가 `opencode run`으로 에이전트에게 편집을 맡기고 파일을 다시 읽어 검증한다는 점과 그 한계(비결정적·권한 프롬프트·타임아웃), (5) 예시 두 개 — Ponytail·ai-memory의 `--global --print` 출력.
- `rg -n -i "gemini|kiro|grok|copilot|kilo|kimi" AgentSetup-README*.md README.md agent-installer/README.md`에서 CHANGES 파일을 뺀 결과는 "지원 종료" 문장 외 0건.

- [ ] **Step 3: CHANGES 2종** — 맨 위에 `## 2.0.0 (2026-10-24)` 항목: 깨지는 변경(CLI 7개 제거, 설정 파일 직접 편집 → CLI 명령, `--dry-run` → `--print` 별칭, `global.*` 항목이 `plugin.*`에 병합, `mcp.ai-memory` → `plugin.ai-memory`), 새 기능(`--global`, `--print`, 활성화 안내, TUI 범위 행), 미검증(OpenCode 경로).

- [ ] **Step 4: `AGENTS.md`의 Full verification**

```
  idempotent and `git status` stages no `.claude/skills` entries. Also
  confirm `git status` *does* stage `.vscode/settings.json` after installing
  a `config.gitmessage.*` item — it depends on a gitignore negation entry,
  so a missing one fails silently.
```
로 해당 문장을 바꾼다(`.kiro/skills`·`.grok/skills`·`.vscode/mcp.json` 언급 제거).

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "docs(installer): 2.0.0으로 올리고 CLI 명령 설치 구조를 기록한다"
```

---

### Task 11: 전체 검증과 실측 왕복

**Files:** (코드 변경 없음 — 실패가 나오면 해당 Task 파일을 고치고 그 Task 형식으로 커밋)

- [ ] **Step 1: 단위·통합 테스트** — Run: `cd agent-installer && npm test` → 전부 PASS. 테스트 수와 결과를 기록.

- [ ] **Step 2: 린트·런처 스모크**

```bash
bash -n ./setup-agents.sh
bash ./setup-agents.sh --dry-run
pwsh -File ./setup-agents.ps1 -DryRun
```
Expected: 오류 없음, 네 도구만 언급.

- [ ] **Step 3: 스크래치 저장소 멱등성**

```bash
S="$TEMP/agent-setup-scratch-$(date +%s)" && mkdir -p "$S" && cd "$S" && git init -q
bash /d/Sources/github/Agent-Setup/setup-agents.sh && bash /d/Sources/github/Agent-Setup/setup-agents.sh
git add -A && git status --porcelain
node /d/Sources/github/Agent-Setup/agent-installer/install.mjs --set config.gitmessage.ko && git add -A && git status --porcelain
```
같은 절차를 `pwsh -File .../setup-agents.ps1`로 새 스크래치에서 반복. Expected: 두 번째 실행은 변경 없음, `.claude/skills` 미스테이징, gitmessage 설치 뒤 `.vscode/settings.json` 스테이징.

- [ ] **Step 4: 실측 왕복 (이 머신)** — 스크래치 저장소에서

```bash
node install.mjs --print --set plugin.ponytail,mcp.codebase-memory,skill.caveman
node install.mjs --set plugin.ponytail,mcp.codebase-memory,skill.caveman      # project: claude
node install.mjs --list                                                        # 설치됨 확인
node install.mjs --set ''                                                      # 제거
node install.mjs --global --print --set plugin.ponytail,plugin.ai-memory,mcp.codebase-memory
node install.mjs --global --set plugin.ponytail,plugin.ai-memory               # claude·codex·agy
node install.mjs --global --list
```
전역 제거는 TUI에서 해제하거나, 실측 뒤 출력된 제거 명령(`claude plugin uninstall … --scope user`, `codex plugin remove …`, `agy plugin uninstall …`)으로 되돌린다 — **이 머신에 원래 있던 전역 설치(ponytail·superpowers·caveman 등)는 건드리지 않는다**: 실측 전에 `claude plugin list --json`, `codex plugin list --json`, `agy plugin list --json`, `codex mcp list --json`, `agy mcp list`를 저장해 두고, 이미 있던 항목은 왕복 대상에서 뺀다(대상: 원래 없던 것만. 예: `plugin.ai-memory`, `mcp.graphify`).
OpenCode: 실행 불가 → `--print` 출력만 확인하고 보고에 "미검증".

- [ ] **Step 5: 메모리·보고**

- `C:\Users\rchco\.claude\projects\D--Sources-github-Agent-Setup\memory\`의 `multi-cli-agent-conventions.md`·`upstream-tool-cli-support.md`에 2.0.0 전환 사실(지원 CLI 넷, 명령 문법 실측 버전, 전역 스킬 에이전트 ID 실측 결과)을 덧붙이고 MEMORY.md 한 줄 요약을 갱신한다.
- 결과 보고: 실행한 명령과 결과, 미검증 항목(OpenCode, 그 밖에 실패한 것)을 그대로 적는다. 발행(`v2.0.0` 태그 push)은 사용자 요청 시에만.
