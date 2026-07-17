# Agent Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** plugin·MCP·skill을 체크박스로 골라 설치/제거하는 자기완결 콘솔 도구 `agent-installer/`를 만든다.

**Architecture:** 환경 스캔(stateless)으로 설치 상태를 판정하고, `lib/items/*.mjs` 자동 발견 카탈로그로 항목을 유동적으로 관리한다. 7개 CLI의 프로젝트 설정 파일은 CLI별 어댑터가 보존적으로 편집한다.

**Tech Stack:** Node.js ≥ 20 (ESM, node:test), @clack/prompts, jsonc-parser, smol-toml

**Spec:** `docs/superpowers/specs/2026-07-17-agent-installer-design.md`

## Global Constraints

- 의존성은 정확히 3개: `@clack/prompts`, `jsonc-parser`, `smol-toml`. 추가 금지.
- 모든 쓰기는 git 저장소 루트 안으로 제한 (예외: `scope: 'user'`로 선언된 항목의 사용자 홈 쓰기 — v1에서는 gstack 1개).
- 기존 설정 파일의 다른 키·주석은 절대 변경하지 않는다 (보존적 편집).
- 커밋 메시지는 저장소 규칙(`.gitmessage.txt`, AGENTS.md)에 따라 한국어로 작성한다.
- 시크릿(토큰·키)을 설정 파일에 쓰지 않는다. 원격 MCP는 URL만 기록한다.
- Windows(PowerShell)와 Linux(bash) 양쪽에서 동작해야 한다 (경로는 `node:path`, 외부 명령은 `claude`, `npx`, `git`만).

## 확정된 외부 사실 (2026-07-17 조사 완료 — 재조사 불필요)

**플러그인·스킬 4종:**

| 항목 | 유형 | 설치 | 감지 | 제거 |
|---|---|---|---|---|
| superpowers | 플러그인 | `claude plugin install superpowers@claude-plugins-official --scope project` | `.claude/settings.json` `enabledPlugins`에 `superpowers@claude-plugins-official` 또는 `superpowers@superpowers-marketplace` | `claude plugin uninstall <동일 식별자>` |
| bkit | 플러그인 | `claude plugin marketplace add popup-studio-ai/bkit-claude-code` → `claude plugin install bkit@bkit-marketplace --scope project` | `enabledPlugins`에 `bkit@bkit-marketplace` | `claude plugin uninstall bkit@bkit-marketplace` |
| GSD | npx 스킬 인스톨러 | `npx -y @opengsd/gsd-core@latest --claude --local` (프로젝트 로컬) | 프로젝트 `.claude/commands/gsd-*` 또는 `.claude/skills/gsd-*` 존재 | `npx -y @opengsd/gsd-core@latest --uninstall` (저장소 루트에서 실행) |
| gstack | git clone 스킬 (글로벌 전용) | `git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack` 후 `bash ./setup` | `~/.claude/skills/gstack` 디렉터리 존재 | `bash ~/.claude/skills/gstack/bin/gstack-uninstall --force`, 실패 시 디렉터리 삭제 |

- `enabledPlugins`는 **객체 맵**(`"name@marketplace": true`)이 실측 기본 형식이나 배열 형식도 존재 → 감지·편집은 양쪽 처리, 신규 생성은 객체 형식.
- 플러그인 설치는 A(claude CLI 호출) 시도 → 실패 시 B(`.claude/settings.json` 직접 기록: `enabledPlugins` + bkit는 `extraKnownMarketplaces["bkit-marketplace"] = {source:{source:"github",repo:"popup-studio-ai/bkit-claude-code"}}`) 폴백.
- gstack은 프로젝트 로컬 미지원(공식 인스톨러 제약) → `scope: 'user'` 선언 + UI/리포트에 명시. **스펙과의 차이점이므로 사용자 승인 필요.**

**MCP 서버 4종 (정규화된 서버 정의):**

| 항목 | kind | 값 |
|---|---|---|
| notion | http | `https://mcp.notion.com/mcp` (OAuth는 첫 사용 시, 시크릿 없음) |
| supabase | http | `https://mcp.supabase.com/mcp` (OAuth 동적 등록, 필요 시 사용자가 `?project_ref=` 추가) |
| vercel | http | `https://mcp.vercel.com` (경로 없음, OAuth) |
| codebase-memory | stdio | command `codebase-memory-mcp`, args `[]` (PATH에 바이너리 필요 — 미설치 시 안내: `curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh \| bash`, Windows는 install.ps1) |

**CLI별 MCP 설정 (7개 어댑터의 정확한 스키마):**

| CLI | 파일 | 최상위 키 | http 형식 | stdio 형식 |
|---|---|---|---|---|
| claude | `.mcp.json` | `mcpServers` | `{"type":"http","url":U}` | `{"type":"stdio","command":C,"args":A}` |
| codex | `.codex/config.toml` | `[mcp_servers.<name>]` | `url = "U"` | `command = "C"` + `args = [...]` |
| gemini | `.gemini/settings.json` | `mcpServers` | `{"httpUrl":U}` (주의: `url`은 SSE) | `{"command":C,"args":A}` |
| opencode | `opencode.jsonc` | `mcp` | `{"type":"remote","url":U,"enabled":true}` | `{"type":"local","command":[C,...A],"enabled":true}` |
| kilo | `.kilocode/mcp.json` | `mcpServers` | `{"type":"streamable-http","url":U,"disabled":false}` | `{"command":C,"args":A,"disabled":false}` |
| kiro | `.kiro/settings/mcp.json` | `mcpServers` | `{"url":U,"disabled":false,"autoApprove":[]}` | `{"command":C,"args":A,"disabled":false,"autoApprove":[]}` |
| kimi | `.kimi-code/mcp.json` | `mcpServers` | `{"url":U}` | `{"command":C,"args":A}` |

7개 CLI 모두 원격 HTTP MCP 지원 확인됨 → MCP 항목 4종의 `supports`는 7개 전체.

## File Structure

```text
agent-installer/
├─ package.json                # type:module, deps 3개, scripts {start, test}
├─ install.mjs                 # 엔트리포인트: 인자 파싱 + clack UI + engine 호출
├─ lib/
│  ├─ context.mjs              # findRepoRoot, repoPath(경로 안전)
│  ├─ jsonfile.mjs             # JSON/JSONC 보존 편집 (jsonc-parser)
│  ├─ tomlfile.mjs             # TOML 섹션 추가/제거 (텍스트 기반, smol-toml은 검증용)
│  ├─ clis.mjs                 # 7개 CLI MCP 어댑터 레지스트리 {has, add, remove}
│  ├─ claude-plugins.mjs       # enabledPlugins 읽기/폴백 쓰기 (객체·배열 양식)
│  ├─ catalog.mjs              # items/*.mjs 자동 발견 + 검증 + defineMcp/definePlugin/defineSkill
│  ├─ engine.mjs               # scan, planChanges(diff), apply, 리포트 데이터
│  └─ items/
│     ├─ mcp.notion.mjs  mcp.supabase.mjs  mcp.vercel.mjs  mcp.codebase-memory.mjs
│     ├─ plugin.superpowers.mjs  plugin.bkit.mjs
│     └─ skill.gsd.mjs  skill.gstack.mjs
└─ test/
   ├─ jsonfile.test.mjs  tomlfile.test.mjs  clis.test.mjs
   ├─ claude-plugins.test.mjs  catalog.test.mjs  engine.test.mjs
   └─ helpers.mjs               # 임시 git 저장소 생성 헬퍼
```

---

### Task 1: 스캐폴드 + context 모듈

**Files:**
- Create: `agent-installer/package.json`
- Create: `agent-installer/lib/context.mjs`
- Create: `agent-installer/test/helpers.mjs`
- Test: `agent-installer/test/context.test.mjs`

**Interfaces:**
- Produces: `findRepoRoot(cwd?: string): string` (git 저장소 아니면 throw), `repoPath(root: string, rel: string): string` (루트 밖이면 throw), `makeTempRepo(): string` (테스트 헬퍼, 임시 git 저장소 경로 반환)

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "agent-installer",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "start": "node install.mjs",
    "test": "node --test test/"
  },
  "dependencies": {
    "@clack/prompts": "^0.11.0",
    "jsonc-parser": "^3.3.1",
    "smol-toml": "^1.3.1"
  }
}
```

- [ ] **Step 2: 의존성 설치**

Run: `cd agent-installer && npm install`
Expected: node_modules 생성, 오류 없음. `agent-installer/node_modules/`와 `agent-installer/package-lock.json` 중 lock 파일은 커밋, node_modules는 저장소 루트 `.gitignore`에 `agent-installer/node_modules/` 추가.

- [ ] **Step 3: 테스트 헬퍼 작성** — `test/helpers.mjs`

```js
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-installer-test-'))
  execFileSync('git', ['init', '-q', dir])
  return dir
}
```

- [ ] **Step 4: 실패하는 테스트 작성** — `test/context.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findRepoRoot, repoPath } from '../lib/context.mjs'
import { makeTempRepo } from './helpers.mjs'

test('findRepoRoot는 저장소 루트를 반환한다', () => {
  const repo = makeTempRepo()
  assert.equal(findRepoRoot(repo).toLowerCase(), repo.toLowerCase())
})

test('findRepoRoot는 git 저장소 밖이면 throw한다', () => {
  assert.throws(() => findRepoRoot(tmpdir()), /git/i)
})

test('repoPath는 루트 밖 경로를 거부한다', () => {
  const repo = makeTempRepo()
  assert.throws(() => repoPath(repo, '../escape.txt'), /저장소/)
  assert.equal(repoPath(repo, '.mcp.json'), join(repo, '.mcp.json'))
})
```

- [ ] **Step 5: 실패 확인**

Run: `cd agent-installer && npm test`
Expected: FAIL — `Cannot find module '../lib/context.mjs'`

- [ ] **Step 6: context.mjs 구현**

```js
import { execFileSync } from 'node:child_process'
import { resolve, sep } from 'node:path'

export function findRepoRoot(cwd = process.cwd()) {
  let out
  try {
    out = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  } catch {
    throw new Error('git 저장소 안에서 실행해야 합니다.')
  }
  return resolve(out.trim())
}

export function repoPath(root, rel) {
  const abs = resolve(root, rel)
  const normRoot = resolve(root)
  if (abs !== normRoot && !abs.startsWith(normRoot + sep)) {
    throw new Error(`저장소 밖의 경로에는 쓸 수 없습니다: ${abs}`)
  }
  return abs
}
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS (3 tests)

- [ ] **Step 8: 커밋**

```bash
git add agent-installer/package.json agent-installer/package-lock.json agent-installer/lib/context.mjs agent-installer/test/ .gitignore
git commit -m "feat: agent-installer 스캐폴드와 저장소 경로 안전 모듈 추가"
```

---

### Task 2: JSON/JSONC 보존 편집기

**Files:**
- Create: `agent-installer/lib/jsonfile.mjs`
- Test: `agent-installer/test/jsonfile.test.mjs`

**Interfaces:**
- Consumes: `repoPath` (Task 1)
- Produces: `readJson(file): any|undefined` (파일 없으면 undefined, 파싱은 jsonc 관대 모드), `setKey(file, path: string[], value): void` (중간 객체 자동 생성, 파일 없으면 `{}`부터 생성, 주석·포맷 보존), `removeKey(file, path: string[]): void` (없으면 no-op)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/jsonfile.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readJson, setKey, removeKey } from '../lib/jsonfile.mjs'

function tmpFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'jsonfile-'))
  const file = join(dir, 'config.jsonc')
  if (content !== undefined) writeFileSync(file, content)
  return file
}

test('setKey는 주석을 보존하며 중첩 키를 추가한다', () => {
  const file = tmpFile('{\n  // keep this comment\n  "mcp": {}\n}\n')
  setKey(file, ['mcp', 'notion'], { type: 'remote', url: 'https://mcp.notion.com/mcp', enabled: true })
  const text = readFileSync(file, 'utf8')
  assert.match(text, /keep this comment/)
  assert.equal(readJson(file).mcp.notion.url, 'https://mcp.notion.com/mcp')
})

test('setKey는 없는 파일을 {}부터 생성한다', () => {
  const file = tmpFile(undefined)
  setKey(file, ['mcpServers', 'vercel'], { url: 'https://mcp.vercel.com' })
  assert.equal(readJson(file).mcpServers.vercel.url, 'https://mcp.vercel.com')
})

test('removeKey는 해당 키만 제거하고 형제를 보존한다', () => {
  const file = tmpFile('{"mcpServers":{"a":{"url":"x"},"b":{"url":"y"}}}')
  removeKey(file, ['mcpServers', 'a'])
  const data = readJson(file)
  assert.equal(data.mcpServers.a, undefined)
  assert.equal(data.mcpServers.b.url, 'y')
})

test('removeKey는 없는 키에 no-op이다', () => {
  const file = tmpFile('{"x":1}')
  removeKey(file, ['mcpServers', 'a'])
  assert.equal(readJson(file).x, 1)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && npm test`
Expected: FAIL — `Cannot find module '../lib/jsonfile.mjs'`

- [ ] **Step 3: jsonfile.mjs 구현** (jsonc-parser의 `parse`/`modify`/`applyEdits` 사용)

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse, modify, applyEdits } from 'jsonc-parser'

const FORMAT = { formattingOptions: { insertSpaces: true, tabSize: 2 } }

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function readJson(file) {
  const text = readText(file)
  if (!text.trim()) return undefined
  return parse(text)
}

export function setKey(file, path, value) {
  let text = readText(file)
  if (!text.trim()) text = '{}\n'
  const edits = modify(text, path, value, FORMAT)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, applyEdits(text, edits))
}

export function removeKey(file, path) {
  const text = readText(file)
  if (!text.trim()) return
  if (getIn(parse(text), path) === undefined) return
  const edits = modify(text, path, undefined, FORMAT)
  writeFileSync(file, applyEdits(text, edits))
}

export function getIn(data, path) {
  let cur = data
  for (const key of path) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[key]
  }
  return cur
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS (누적 7 tests)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/jsonfile.mjs agent-installer/test/jsonfile.test.mjs
git commit -m "feat: 주석 보존 JSONC 편집 모듈 추가"
```

---

### Task 3: TOML 섹션 편집기 (Codex용)

**Files:**
- Create: `agent-installer/lib/tomlfile.mjs`
- Test: `agent-installer/test/tomlfile.test.mjs`

**Interfaces:**
- Produces: `hasSection(file, name): boolean` (smol-toml 파싱으로 `mcp_servers.<name>` 존재 확인), `appendSection(file, name, lines: string[]): void` (파일 끝에 `[mcp_servers.<name>]` 블록 추가, 기존 텍스트 불변), `removeSection(file, name): void` (해당 섹션 헤더부터 다음 `[` 헤더 직전까지 텍스트 제거)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/tomlfile.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hasSection, appendSection, removeSection } from '../lib/tomlfile.mjs'

function tmpToml(content) {
  const file = join(mkdtempSync(join(tmpdir(), 'toml-')), 'config.toml')
  if (content !== undefined) writeFileSync(file, content)
  return file
}

const BASE = '# Repository-local Codex configuration.\nproject_doc_max_bytes = 65536\n'

test('appendSection은 기존 내용과 주석을 보존한다', () => {
  const file = tmpToml(BASE)
  appendSection(file, 'notion', ['url = "https://mcp.notion.com/mcp"'])
  const text = readFileSync(file, 'utf8')
  assert.match(text, /# Repository-local Codex configuration\./)
  assert.match(text, /project_doc_max_bytes = 65536/)
  assert.equal(hasSection(file, 'notion'), true)
})

test('removeSection은 해당 섹션만 제거한다', () => {
  const file = tmpToml(BASE)
  appendSection(file, 'notion', ['url = "https://mcp.notion.com/mcp"'])
  appendSection(file, 'cbm', ['command = "codebase-memory-mcp"', 'args = []'])
  removeSection(file, 'notion')
  assert.equal(hasSection(file, 'notion'), false)
  assert.equal(hasSection(file, 'cbm'), true)
  assert.match(readFileSync(file, 'utf8'), /project_doc_max_bytes/)
})

test('hasSection은 없는 파일에서 false를 반환한다', () => {
  assert.equal(hasSection(join(tmpdir(), 'no-such-dir', 'x.toml'), 'notion'), false)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && npm test`
Expected: FAIL — `Cannot find module '../lib/tomlfile.mjs'`

- [ ] **Step 3: tomlfile.mjs 구현**

```js
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { parse } from 'smol-toml'

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : ''
}

export function hasSection(file, name) {
  const text = readText(file)
  if (!text.trim()) return false
  try {
    const data = parse(text)
    return data.mcp_servers != null && Object.hasOwn(data.mcp_servers, name)
  } catch {
    return false
  }
}

export function appendSection(file, name, lines) {
  let text = readText(file)
  if (text.length > 0 && !text.endsWith('\n')) text += '\n'
  text += `\n[mcp_servers.${name}]\n${lines.join('\n')}\n`
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
}

export function removeSection(file, name) {
  const text = readText(file)
  if (!text) return
  const lines = text.split('\n')
  const headerRe = new RegExp(`^\\s*\\[mcp_servers\\.${name}(\\.|\\])`)
  const anyHeaderRe = /^\s*\[/
  const out = []
  let skipping = false
  for (const line of lines) {
    if (skipping && anyHeaderRe.test(line) && !headerRe.test(line)) skipping = false
    if (headerRe.test(line)) skipping = true
    if (!skipping) out.push(line)
  }
  // 섹션 앞에 우리가 추가했던 빈 줄이 겹치면 하나로 정리
  writeFileSync(file, out.join('\n').replace(/\n{3,}/g, '\n\n'))
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS (누적 10 tests)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/tomlfile.mjs agent-installer/test/tomlfile.test.mjs
git commit -m "feat: Codex TOML 섹션 편집 모듈 추가"
```

---

### Task 4: 7개 CLI MCP 어댑터 레지스트리

**Files:**
- Create: `agent-installer/lib/clis.mjs`
- Test: `agent-installer/test/clis.test.mjs`

**Interfaces:**
- Consumes: `repoPath`(Task 1), `readJson/setKey/removeKey/getIn`(Task 2), `hasSection/appendSection/removeSection`(Task 3)
- Produces: `CLI_IDS: string[]` = `['claude','codex','gemini','opencode','kilo','kiro','kimi']`, `CLIS: Record<id, {label, has(root,name), add(root,name,server), remove(root,name)}>`. `server`는 정규형 `{kind:'http', url}` 또는 `{kind:'stdio', command, args}`.

- [ ] **Step 1: 실패하는 테스트 작성** — `test/clis.test.mjs` (전 어댑터 roundtrip + 스키마 정확성)

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'
import { readJson } from '../lib/jsonfile.mjs'
import { makeTempRepo } from './helpers.mjs'

const HTTP = { kind: 'http', url: 'https://mcp.notion.com/mcp' }
const STDIO = { kind: 'stdio', command: 'codebase-memory-mcp', args: [] }

for (const id of CLI_IDS) {
  test(`${id}: add→has→remove roundtrip (http, stdio)`, () => {
    const repo = makeTempRepo()
    for (const server of [HTTP, STDIO]) {
      assert.equal(CLIS[id].has(repo, 'testsrv'), false)
      CLIS[id].add(repo, 'testsrv', server)
      assert.equal(CLIS[id].has(repo, 'testsrv'), true)
      CLIS[id].remove(repo, 'testsrv')
      assert.equal(CLIS[id].has(repo, 'testsrv'), false)
    }
  })
}

test('gemini는 원격에 httpUrl 키를 쓴다 (url은 SSE라서 금지)', () => {
  const repo = makeTempRepo()
  CLIS.gemini.add(repo, 'n', HTTP)
  const entry = readJson(join(repo, '.gemini/settings.json')).mcpServers.n
  assert.equal(entry.httpUrl, HTTP.url)
  assert.equal(entry.url, undefined)
})

test('opencode는 mcp 키 + command 배열 형식을 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.opencode.add(repo, 'c', STDIO)
  const entry = readJson(join(repo, 'opencode.jsonc')).mcp.c
  assert.equal(entry.type, 'local')
  assert.deepEqual(entry.command, ['codebase-memory-mcp'])
})

test('kilo는 .kilocode/mcp.json에 streamable-http를 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.kilo.add(repo, 'n', HTTP)
  const entry = readJson(join(repo, '.kilocode/mcp.json')).mcpServers.n
  assert.equal(entry.type, 'streamable-http')
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && npm test`
Expected: FAIL — `Cannot find module '../lib/clis.mjs'`

- [ ] **Step 3: clis.mjs 구현**

```js
import { repoPath } from './context.mjs'
import { readJson, setKey, removeKey, getIn } from './jsonfile.mjs'
import { hasSection, appendSection, removeSection } from './tomlfile.mjs'

function jsonAdapter(relFile, topKey, toEntry) {
  return {
    has(root, name) {
      const data = readJson(repoPath(root, relFile))
      return getIn(data, [topKey, name]) !== undefined
    },
    add(root, name, server) {
      setKey(repoPath(root, relFile), [topKey, name], toEntry(server))
    },
    remove(root, name) {
      removeKey(repoPath(root, relFile), [topKey, name])
    },
  }
}

function tomlLines(server) {
  if (server.kind === 'http') return [`url = ${JSON.stringify(server.url)}`]
  return [
    `command = ${JSON.stringify(server.command)}`,
    `args = [${server.args.map((a) => JSON.stringify(a)).join(', ')}]`,
  ]
}

export const CLIS = {
  claude: {
    label: 'Claude Code',
    ...jsonAdapter('.mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { type: 'http', url: s.url }
        : { type: 'stdio', command: s.command, args: s.args }),
  },
  codex: {
    label: 'Codex',
    has: (root, name) => hasSection(repoPath(root, '.codex/config.toml'), name),
    add: (root, name, s) => appendSection(repoPath(root, '.codex/config.toml'), name, tomlLines(s)),
    remove: (root, name) => removeSection(repoPath(root, '.codex/config.toml'), name),
  },
  gemini: {
    label: 'Gemini CLI',
    ...jsonAdapter('.gemini/settings.json', 'mcpServers', (s) =>
      s.kind === 'http' ? { httpUrl: s.url } : { command: s.command, args: s.args }),
  },
  opencode: {
    label: 'OpenCode',
    ...jsonAdapter('opencode.jsonc', 'mcp', (s) =>
      s.kind === 'http'
        ? { type: 'remote', url: s.url, enabled: true }
        : { type: 'local', command: [s.command, ...s.args], enabled: true }),
  },
  kilo: {
    label: 'Kilo Code',
    ...jsonAdapter('.kilocode/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { type: 'streamable-http', url: s.url, disabled: false }
        : { command: s.command, args: s.args, disabled: false }),
  },
  kiro: {
    label: 'Kiro',
    ...jsonAdapter('.kiro/settings/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { url: s.url, disabled: false, autoApprove: [] }
        : { command: s.command, args: s.args, disabled: false, autoApprove: [] }),
  },
  kimi: {
    label: 'Kimi Code',
    ...jsonAdapter('.kimi-code/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http' ? { url: s.url } : { command: s.command, args: s.args }),
  },
}

export const CLI_IDS = Object.keys(CLIS)
```

주의: `jsonAdapter`의 spread 뒤에 `label`이 오면 덮어써지므로 위처럼 `label`을 먼저 두거나 객체를 명시 구성한다 (구현 시 스프레드 순서 확인).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS (누적 20 tests)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/clis.mjs agent-installer/test/clis.test.mjs
git commit -m "feat: 7개 CLI MCP 설정 어댑터 추가"
```

---

### Task 5: Claude 플러그인 설정 모듈 (감지 + B 폴백 쓰기)

**Files:**
- Create: `agent-installer/lib/claude-plugins.mjs`
- Test: `agent-installer/test/claude-plugins.test.mjs`

**Interfaces:**
- Consumes: `repoPath`, `readJson/setKey/removeKey/getIn`
- Produces: `isPluginEnabled(root, ids: string[]): boolean` (여러 별칭 중 하나라도 enabledPlugins에 있으면 true, 객체·배열 양식 모두), `enablePlugin(root, id, marketplace?: {name, repo}): void` (객체 양식으로 기록 + 필요 시 extraKnownMarketplaces), `disablePlugin(root, ids: string[]): void` (모든 별칭 제거, 마지막 사용자면 마켓 항목도 제거)

- [ ] **Step 1: 실패하는 테스트 작성** — `test/claude-plugins.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { isPluginEnabled, enablePlugin, disablePlugin } from '../lib/claude-plugins.mjs'
import { readJson } from '../lib/jsonfile.mjs'
import { makeTempRepo } from './helpers.mjs'

function settingsPath(repo) { return join(repo, '.claude', 'settings.json') }

test('객체 양식 enabledPlugins를 감지한다', () => {
  const repo = makeTempRepo()
  mkdirSync(join(repo, '.claude'), { recursive: true })
  writeFileSync(settingsPath(repo), '{"enabledPlugins":{"bkit@bkit-marketplace":true}}')
  assert.equal(isPluginEnabled(repo, ['bkit@bkit-marketplace']), true)
  assert.equal(isPluginEnabled(repo, ['superpowers@claude-plugins-official']), false)
})

test('배열 양식 enabledPlugins도 감지한다', () => {
  const repo = makeTempRepo()
  mkdirSync(join(repo, '.claude'), { recursive: true })
  writeFileSync(settingsPath(repo), '{"enabledPlugins":["superpowers@claude-plugins-official"]}')
  assert.equal(isPluginEnabled(repo, ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace']), true)
})

test('enablePlugin은 객체 양식으로 기록하고 마켓플레이스를 등록한다', () => {
  const repo = makeTempRepo()
  enablePlugin(repo, 'bkit@bkit-marketplace', { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' })
  const s = readJson(settingsPath(repo))
  assert.equal(s.enabledPlugins['bkit@bkit-marketplace'], true)
  assert.equal(s.extraKnownMarketplaces['bkit-marketplace'].source.repo, 'popup-studio-ai/bkit-claude-code')
})

test('disablePlugin은 항목과 고아 마켓플레이스를 제거한다', () => {
  const repo = makeTempRepo()
  enablePlugin(repo, 'bkit@bkit-marketplace', { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' })
  disablePlugin(repo, ['bkit@bkit-marketplace'])
  const s = readJson(settingsPath(repo))
  assert.equal(isPluginEnabled(repo, ['bkit@bkit-marketplace']), false)
  assert.equal(s.extraKnownMarketplaces?.['bkit-marketplace'], undefined)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && npm test`
Expected: FAIL — `Cannot find module '../lib/claude-plugins.mjs'`

- [ ] **Step 3: claude-plugins.mjs 구현**

```js
import { repoPath } from './context.mjs'
import { readJson, setKey, removeKey } from './jsonfile.mjs'

const SETTINGS = '.claude/settings.json'

function readSettings(root) {
  return readJson(repoPath(root, SETTINGS)) ?? {}
}

function enabledList(settings) {
  const ep = settings.enabledPlugins
  if (Array.isArray(ep)) return ep
  if (ep && typeof ep === 'object') return Object.keys(ep).filter((k) => ep[k])
  return []
}

export function isPluginEnabled(root, ids) {
  const list = enabledList(readSettings(root))
  return ids.some((id) => list.includes(id))
}

export function enablePlugin(root, id, marketplace) {
  const file = repoPath(root, SETTINGS)
  const settings = readSettings(root)
  if (Array.isArray(settings.enabledPlugins)) {
    if (!settings.enabledPlugins.includes(id)) {
      setKey(file, ['enabledPlugins', settings.enabledPlugins.length], id)
    }
  } else {
    setKey(file, ['enabledPlugins', id], true)
  }
  if (marketplace) {
    setKey(file, ['extraKnownMarketplaces', marketplace.name], {
      source: { source: 'github', repo: marketplace.repo },
    })
  }
}

export function disablePlugin(root, ids) {
  const file = repoPath(root, SETTINGS)
  const settings = readSettings(root)
  if (Array.isArray(settings.enabledPlugins)) {
    const kept = settings.enabledPlugins.filter((e) => !ids.includes(e))
    setKey(file, ['enabledPlugins'], kept)
  } else if (settings.enabledPlugins) {
    for (const id of ids) removeKey(file, ['enabledPlugins', id])
  }
  // 고아 마켓플레이스 정리: 남은 플러그인이 참조하지 않는 extraKnownMarketplaces 항목 제거
  const after = readSettings(root)
  const remaining = enabledList(after).map((e) => e.split('@')[1])
  for (const mkt of Object.keys(after.extraKnownMarketplaces ?? {})) {
    if (!remaining.includes(mkt)) removeKey(file, ['extraKnownMarketplaces', mkt])
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS (누적 24 tests)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/claude-plugins.mjs agent-installer/test/claude-plugins.test.mjs
git commit -m "feat: Claude 플러그인 감지와 설정 직접 기록 폴백 모듈 추가"
```

---

### Task 6: 카탈로그 로더 + 항목 팩토리

**Files:**
- Create: `agent-installer/lib/catalog.mjs`
- Test: `agent-installer/test/catalog.test.mjs`

**Interfaces:**
- Consumes: `CLIS, CLI_IDS`(Task 4), `isPluginEnabled/enablePlugin/disablePlugin`(Task 5)
- Produces:
  - `loadItems(): Promise<Item[]>` — `lib/items/*.mjs` 자동 발견, id 정렬, 검증 실패 시 throw
  - `defineMcp({id, label, server, supports?, unsupported?, note?}): Item`
  - `definePlugin({id, label, install, uninstall, detectIds, marketplace?, note?}): Item`
  - `defineSkill({id, label, scope, detect, install, uninstall, note?}): Item`
  - `Item = { id, category, label, scope: 'project'|'user', supports: string[], unsupported: Record<string,string>, note?, detect(ctx), install(ctx), uninstall(ctx) }`
  - `ctx = { root, dryRun, exec(cmd, args, opts?): {ok, output} }` — exec는 외부 명령 실행 래퍼(dryRun이면 실행 안 하고 로그만)
  - detect 반환: `{ status: 'installed'|'partial'|'absent', detail?: string }`

- [ ] **Step 1: 실패하는 테스트 작성** — `test/catalog.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadItems, defineMcp } from '../lib/catalog.mjs'
import { CLIS } from '../lib/clis.mjs'
import { makeTempRepo } from './helpers.mjs'

test('loadItems는 8개 항목을 id순으로 로드한다', async () => {
  const items = await loadItems()
  assert.equal(items.length, 8)
  const ids = items.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  assert.ok(ids.includes('mcp.notion'))
  assert.ok(ids.includes('plugin.superpowers'))
  assert.ok(ids.includes('skill.gstack'))
})

test('defineMcp: supports에서 빠진 CLI에 사유가 없으면 throw한다', () => {
  assert.throws(
    () => defineMcp({ id: 'mcp.x', label: 'X', server: { kind: 'http', url: 'https://x' }, supports: ['claude'] }),
    /사유/,
  )
})

test('defineMcp detect: 지원 CLI 전부 등록 시 installed, 일부면 partial', async () => {
  const item = defineMcp({
    id: 'mcp.t', label: 'T',
    server: { kind: 'http', url: 'https://t/mcp' },
    supports: ['claude', 'gemini'],
    unsupported: Object.fromEntries(['codex','opencode','kilo','kiro','kimi'].map((c) => [c, '테스트용 제외'])),
  })
  const root = makeTempRepo()
  const ctx = { root, dryRun: false }
  assert.equal((await item.detect(ctx)).status, 'absent')
  CLIS.claude.add(root, 't', { kind: 'http', url: 'https://t/mcp' })
  assert.equal((await item.detect(ctx)).status, 'partial')
  CLIS.gemini.add(root, 't', { kind: 'http', url: 'https://t/mcp' })
  assert.equal((await item.detect(ctx)).status, 'installed')
})

test('defineMcp install은 누락 CLI만 채우고 uninstall은 전부 제거한다', async () => {
  const item = defineMcp({ id: 'mcp.t2', label: 'T2', server: { kind: 'stdio', command: 'x', args: [] } })
  const root = makeTempRepo()
  const ctx = { root, dryRun: false }
  CLIS.kimi.add(root, 't2', { kind: 'stdio', command: 'x', args: [] })
  await item.install(ctx)
  assert.equal((await item.detect(ctx)).status, 'installed')
  await item.uninstall(ctx)
  assert.equal((await item.detect(ctx)).status, 'absent')
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && npm test`
Expected: FAIL — `Cannot find module '../lib/catalog.mjs'` (loadItems 테스트는 Task 7·8에서 items가 모두 생기기 전까지 개수 불일치로 실패할 수 있음 — 그 경우 이 테스트만 Task 8 완료 후 통과 확인)

- [ ] **Step 3: catalog.mjs 구현**

```js
import { readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { CLIS, CLI_IDS } from './clis.mjs'
import { isPluginEnabled, enablePlugin, disablePlugin } from './claude-plugins.mjs'

const ITEMS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'items')

export async function loadItems() {
  const files = readdirSync(ITEMS_DIR).filter((f) => f.endsWith('.mjs')).sort()
  const items = []
  for (const f of files) {
    const mod = await import(pathToFileURL(join(ITEMS_DIR, f)).href)
    items.push(validate(mod.default, f))
  }
  return items
}

function validate(item, file) {
  for (const field of ['id', 'category', 'label', 'detect', 'install', 'uninstall']) {
    if (!item?.[field]) throw new Error(`${file}: ${field} 누락`)
  }
  return item
}

function assertReasons(id, supports, unsupported) {
  for (const cli of CLI_IDS) {
    if (!supports.includes(cli) && !unsupported[cli]) {
      throw new Error(`${id}: 미지원 CLI '${cli}'의 사유(unsupported.${cli})가 필요합니다`)
    }
  }
}

export function makeExec(dryRun, log = console.log) {
  return (cmd, args, opts = {}) => {
    if (dryRun) {
      log(`  [dry-run] ${cmd} ${args.join(' ')}`)
      return { ok: true, output: '' }
    }
    try {
      const output = execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts })
      return { ok: true, output }
    } catch (err) {
      return { ok: false, output: String(err.stderr ?? err.message) }
    }
  }
}

export function defineMcp({ id, label, server, supports = [...CLI_IDS], unsupported = {}, note }) {
  assertReasons(id, supports, unsupported)
  const name = id.replace(/^mcp\./, '')
  return {
    id, category: 'mcp', label, scope: 'project', supports, unsupported, note,
    async detect({ root }) {
      const present = supports.filter((cli) => CLIS[cli].has(root, name))
      if (present.length === 0) return { status: 'absent' }
      if (present.length === supports.length) return { status: 'installed' }
      return { status: 'partial', detail: `등록됨: ${present.join(', ')} / 누락: ${supports.filter((c) => !present.includes(c)).join(', ')}` }
    },
    async install({ root, dryRun }) {
      for (const cli of supports) {
        if (!CLIS[cli].has(root, name)) {
          if (!dryRun) CLIS[cli].add(root, name, server)
        }
      }
    },
    async uninstall({ root, dryRun }) {
      for (const cli of supports) {
        if (CLIS[cli].has(root, name) && !dryRun) CLIS[cli].remove(root, name)
      }
    },
  }
}

export function definePlugin({ id, label, installId, detectIds, marketplace, note }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, 'Claude Code 전용 플러그인']),
  )
  return {
    id, category: 'plugin', label, scope: 'project', supports: ['claude'], unsupported, note,
    async detect({ root }) {
      return { status: isPluginEnabled(root, detectIds) ? 'installed' : 'absent' }
    },
    async install(ctx) {
      const { root, dryRun, exec } = ctx
      if (marketplace) exec('claude', ['plugin', 'marketplace', 'add', marketplace.repo], { cwd: root })
      const r = exec('claude', ['plugin', 'install', installId, '--scope', 'project'], { cwd: root })
      if (!r.ok) {
        if (!dryRun) enablePlugin(root, installId, marketplace)
        return { fallback: true, message: '설정 기록됨 — 다음 Claude Code 실행 시 다운로드됩니다' }
      }
    },
    async uninstall(ctx) {
      const { root, dryRun, exec } = ctx
      const r = exec('claude', ['plugin', 'uninstall', installId], { cwd: root })
      if (!r.ok && !dryRun) disablePlugin(root, detectIds)
    },
  }
}

export function defineSkill({ id, label, scope, detect, install, uninstall, note }) {
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, 'Claude Code 스킬 설치본']),
  )
  return { id, category: 'skill', label, scope, supports: ['claude'], unsupported, note, detect, install, uninstall }
}
```

- [ ] **Step 4: catalog 단위 테스트 통과 확인** (loadItems 제외)

Run: `cd agent-installer && node --test test/catalog.test.mjs`
Expected: defineMcp 관련 3개 PASS, loadItems 테스트는 items 파일이 없어 FAIL (Task 7·8 완료 후 재확인)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/catalog.mjs agent-installer/test/catalog.test.mjs
git commit -m "feat: 항목 카탈로그 로더와 팩토리 추가"
```

---

### Task 7: MCP 항목 4개 + 플러그인 항목 2개

**Files:**
- Create: `agent-installer/lib/items/mcp.notion.mjs`, `mcp.supabase.mjs`, `mcp.vercel.mjs`, `mcp.codebase-memory.mjs`
- Create: `agent-installer/lib/items/plugin.superpowers.mjs`, `plugin.bkit.mjs`

**Interfaces:**
- Consumes: `defineMcp`, `definePlugin`(Task 6)
- Produces: 카탈로그 자동 발견 대상 항목 6개

- [ ] **Step 1: MCP 항목 4개 작성**

`mcp.notion.mjs`:
```js
import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.notion', label: 'Notion MCP',
  server: { kind: 'http', url: 'https://mcp.notion.com/mcp' },
  note: '인증: 각 CLI 첫 사용 시 OAuth',
})
```

`mcp.supabase.mjs`:
```js
import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.supabase', label: 'Supabase MCP',
  server: { kind: 'http', url: 'https://mcp.supabase.com/mcp' },
  note: '인증: OAuth 동적 등록. 프로젝트 고정이 필요하면 URL에 ?project_ref=<id> 추가',
})
```

`mcp.vercel.mjs`:
```js
import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.vercel', label: 'Vercel MCP',
  server: { kind: 'http', url: 'https://mcp.vercel.com' },
  note: '인증: 첫 사용 시 OAuth (승인된 클라이언트만 연결 가능)',
})
```

`mcp.codebase-memory.mjs`:
```js
import { defineMcp } from '../catalog.mjs'
export default defineMcp({
  id: 'mcp.codebase-memory', label: 'Codebase Memory MCP',
  server: { kind: 'stdio', command: 'codebase-memory-mcp', args: [] },
  note: 'PATH에 codebase-memory-mcp 바이너리 필요. 설치: https://github.com/DeusData/codebase-memory-mcp (install.sh / install.ps1)',
})
```

- [ ] **Step 2: 플러그인 항목 2개 작성**

`plugin.superpowers.mjs`:
```js
import { definePlugin } from '../catalog.mjs'
export default definePlugin({
  id: 'plugin.superpowers', label: 'superpowers',
  installId: 'superpowers@claude-plugins-official',
  detectIds: ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace'],
  note: '공식 마켓플레이스 플러그인',
})
```

`plugin.bkit.mjs`:
```js
import { definePlugin } from '../catalog.mjs'
export default definePlugin({
  id: 'plugin.bkit', label: 'bkit',
  installId: 'bkit@bkit-marketplace',
  detectIds: ['bkit@bkit-marketplace'],
  marketplace: { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' },
})
```

- [ ] **Step 3: 동작 확인** (임시 검증 스크립트 없이 기존 테스트로)

Run: `cd agent-installer && npm test`
Expected: 기존 테스트 전부 PASS. `catalog.test.mjs`의 loadItems 테스트는 아직 6/8개라 FAIL — 정상 (Task 8에서 해소).

- [ ] **Step 4: 커밋**

```bash
git add agent-installer/lib/items/
git commit -m "feat: MCP 4종과 플러그인 2종 카탈로그 항목 추가"
```

---

### Task 8: 스킬 항목 2개 (GSD, gstack)

**Files:**
- Create: `agent-installer/lib/items/skill.gsd.mjs`, `skill.gstack.mjs`

**Interfaces:**
- Consumes: `defineSkill`(Task 6), `ctx.exec`
- Produces: 카탈로그 항목 8개 완성 → Task 6의 loadItems 테스트 통과

- [ ] **Step 1: skill.gsd.mjs 작성** (프로젝트 로컬 설치)

```js
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'

function hasGsdFiles(dir) {
  return existsSync(dir) && readdirSync(dir).some((f) => f.startsWith('gsd-'))
}

export default defineSkill({
  id: 'skill.gsd', label: 'GSD (Get Shit Done)', scope: 'project',
  note: 'npx @opengsd/gsd-core 프로젝트 로컬 설치',
  async detect({ root }) {
    const found = hasGsdFiles(join(root, '.claude', 'commands')) || hasGsdFiles(join(root, '.claude', 'skills'))
    return { status: found ? 'installed' : 'absent' }
  },
  async install({ root, exec }) {
    const r = exec('npx', ['-y', '@opengsd/gsd-core@latest', '--claude', '--local'], { cwd: root })
    if (!r.ok) throw new Error(`GSD 설치 실패: ${r.output}`)
  },
  async uninstall({ root, exec }) {
    const r = exec('npx', ['-y', '@opengsd/gsd-core@latest', '--uninstall'], { cwd: root })
    if (!r.ok) throw new Error(`GSD 제거 실패: ${r.output}`)
  },
})
```

Windows 주의: `npx`는 `npx.cmd`일 수 있음 — `exec`에서 `shell: process.platform === 'win32'` 옵션을 npx/claude 호출에 적용하도록 `makeExec`를 보강한다 (구현 시 `opts.shell` 기본값을 win32에서 true로).

- [ ] **Step 2: skill.gstack.mjs 작성** (글로벌 전용 — scope: 'user' 명시)

```js
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defineSkill } from '../catalog.mjs'

const GSTACK_DIR = join(homedir(), '.claude', 'skills', 'gstack')

export default defineSkill({
  id: 'skill.gstack', label: 'gstack', scope: 'user',
  note: '주의: 사용자 글로벌(~/.claude/skills/gstack) 설치 — 공식 인스톨러가 프로젝트 로컬을 지원하지 않음. bash 필요(Windows는 Git Bash).',
  async detect() {
    return { status: existsSync(GSTACK_DIR) ? 'installed' : 'absent' }
  },
  async install({ exec }) {
    if (existsSync(GSTACK_DIR)) return
    const clone = exec('git', ['clone', '--single-branch', '--depth', '1', 'https://github.com/garrytan/gstack.git', GSTACK_DIR])
    if (!clone.ok) throw new Error(`gstack clone 실패: ${clone.output}`)
    const setup = exec('bash', ['./setup'], { cwd: GSTACK_DIR })
    if (!setup.ok) throw new Error(`gstack setup 실패: ${setup.output}`)
  },
  async uninstall({ exec }) {
    const r = exec('bash', [join(GSTACK_DIR, 'bin', 'gstack-uninstall'), '--force'])
    if (!r.ok) throw new Error(`gstack 제거 실패: ${r.output}`)
  },
})
```

- [ ] **Step 3: 전체 테스트 통과 확인** (loadItems 8개 포함)

Run: `cd agent-installer && npm test`
Expected: PASS — catalog.test.mjs의 loadItems 테스트 포함 전부

- [ ] **Step 4: 커밋**

```bash
git add agent-installer/lib/items/skill.gsd.mjs agent-installer/lib/items/skill.gstack.mjs
git commit -m "feat: GSD와 gstack 스킬 항목 추가"
```

---

### Task 9: 엔진 (scan → diff → apply → 리포트)

**Files:**
- Create: `agent-installer/lib/engine.mjs`
- Test: `agent-installer/test/engine.test.mjs`

**Interfaces:**
- Consumes: `loadItems`, `makeExec`(Task 6)
- Produces:
  - `scan(root, items): Promise<Array<{item, status, detail?}>>`
  - `planChanges(states, selectedIds: Set<string>): Array<{item, action}>` — action: `'install'`(absent→체크), `'complete'`(partial→체크 유지), `'uninstall'`(installed|partial→체크 해제), 변경 없음은 미포함
  - `apply(root, changes, {dryRun}): Promise<Array<{item, action, ok, message?}>>` — 항목 실패 시에도 계속, fallback 메시지 전달

- [ ] **Step 1: 실패하는 테스트 작성** — `test/engine.test.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planChanges } from '../lib/engine.mjs'

function fake(id, status) {
  return { item: { id, label: id }, status }
}

test('planChanges: absent+체크=install, installed+해제=uninstall', () => {
  const states = [fake('a', 'absent'), fake('b', 'installed'), fake('c', 'installed')]
  const changes = planChanges(states, new Set(['a', 'c']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['a', 'install'], ['b', 'uninstall']],
  )
})

test('planChanges: partial+체크 유지=complete, partial+해제=uninstall', () => {
  const states = [fake('p1', 'partial'), fake('p2', 'partial')]
  const changes = planChanges(states, new Set(['p1']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['p1', 'complete'], ['p2', 'uninstall']],
  )
})

test('planChanges: 변경 없으면 빈 배열', () => {
  const states = [fake('a', 'installed'), fake('b', 'absent')]
  assert.deepEqual(planChanges(states, new Set(['a'])), [])
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/engine.test.mjs`
Expected: FAIL — `Cannot find module '../lib/engine.mjs'`

- [ ] **Step 3: engine.mjs 구현**

```js
import { makeExec } from './catalog.mjs'

export async function scan(root, items) {
  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root })
      states.push({ item, status: r.status, detail: r.detail })
    } catch (err) {
      states.push({ item, status: 'absent', detail: `감지 실패: ${err.message}` })
    }
  }
  return states
}

export function planChanges(states, selectedIds) {
  const changes = []
  for (const { item, status } of states) {
    const selected = selectedIds.has(item.id)
    if (selected && status === 'absent') changes.push({ item, action: 'install' })
    else if (selected && status === 'partial') changes.push({ item, action: 'complete' })
    else if (!selected && status !== 'absent') changes.push({ item, action: 'uninstall' })
  }
  return changes
}

export async function apply(root, changes, { dryRun = false, log = console.log } = {}) {
  const exec = makeExec(dryRun, log)
  const results = []
  for (const { item, action } of changes) {
    const ctx = { root, dryRun, exec }
    try {
      const fn = action === 'uninstall' ? item.uninstall : item.install
      const r = await fn.call(item, ctx)
      results.push({ item, action, ok: true, message: r?.message })
    } catch (err) {
      results.push({ item, action, ok: false, message: err.message })
    }
  }
  return results
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && npm test`
Expected: PASS (전체)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/engine.mjs agent-installer/test/engine.test.mjs
git commit -m "feat: 스캔·diff·적용 엔진 추가"
```

---

### Task 10: 엔트리포인트 (clack UI + 비대화형 모드) + E2E 검증

**Files:**
- Create: `agent-installer/install.mjs`
- Modify: `AgentSetup-README.md` (사용법 섹션 추가)

**Interfaces:**
- Consumes: `loadItems`(Task 6), `scan/planChanges/apply`(Task 9)
- Produces: CLI 인자 — `--dry-run`, `--set <id,id,...>`(비대화형: 지정 집합을 목표 상태로), `--list`(스캔 결과만 출력)

- [ ] **Step 1: install.mjs 구현**

```js
#!/usr/bin/env node
import * as p from '@clack/prompts'
import { findRepoRoot } from './lib/context.mjs'
import { loadItems } from './lib/catalog.mjs'
import { scan, planChanges, apply } from './lib/engine.mjs'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const listOnly = argv.includes('--list')
const setArg = argv.includes('--set') ? (argv[argv.indexOf('--set') + 1] ?? '') : null

const STATUS_LABEL = { installed: '설치됨', partial: '일부 설치됨', absent: '미설치' }

function hint(item, state) {
  const parts = []
  if (state.status !== 'absent') parts.push(STATUS_LABEL[state.status])
  if (state.detail) parts.push(state.detail)
  if (item.scope === 'user') parts.push('설치 위치: 사용자 글로벌')
  const un = Object.entries(item.unsupported ?? {})
  if (item.category === 'mcp' && un.length > 0) {
    parts.push(`미지원: ${un.map(([cli, why]) => `${cli}(${why})`).join(', ')}`)
  }
  if (item.supports.length === 1 && item.supports[0] === 'claude') parts.push('Claude Code 전용')
  if (item.note) parts.push(item.note)
  return parts.join(' · ')
}

async function main() {
  const root = findRepoRoot()
  const items = await loadItems()
  const states = await scan(root, items)

  if (listOnly) {
    for (const s of states) console.log(`${STATUS_LABEL[s.status].padEnd(7)} ${s.item.id} — ${s.item.label}${s.detail ? ` (${s.detail})` : ''}`)
    return
  }

  let selectedIds
  if (setArg !== null) {
    selectedIds = new Set(setArg.split(',').map((s) => s.trim()).filter(Boolean))
    const known = new Set(items.map((i) => i.id))
    for (const id of selectedIds) if (!known.has(id)) throw new Error(`알 수 없는 항목: ${id}`)
  } else {
    p.intro(`agent-installer${dryRun ? ' (dry-run)' : ''} — 저장소: ${root}`)
    const byCategory = { plugin: '플러그인', mcp: 'MCP 서버', skill: '스킬' }
    const selection = await p.groupMultiselect({
      message: '설치할 항목을 선택하세요 (체크 해제 = 제거)',
      options: Object.fromEntries(
        Object.entries(byCategory).map(([cat, label]) => [
          label,
          states.filter((s) => s.item.category === cat).map((s) => ({
            value: s.item.id,
            label: s.item.label,
            hint: hint(s.item, s),
          })),
        ]),
      ),
      initialValues: states.filter((s) => s.status !== 'absent').map((s) => s.item.id),
      required: false,
    })
    if (p.isCancel(selection)) { p.cancel('취소되었습니다.'); return }
    selectedIds = new Set(selection)
  }

  const changes = planChanges(states, selectedIds)
  if (changes.length === 0) { console.log('변경할 항목이 없습니다.'); return }

  const results = await apply(root, changes, { dryRun })
  const ACTION_LABEL = { install: '설치', complete: '보완 설치', uninstall: '제거' }
  for (const r of results) {
    const mark = r.ok ? '✔' : '✖'
    console.log(`${mark} ${ACTION_LABEL[r.action]} ${r.item.label}${r.message ? ` — ${r.message}` : ''}`)
  }

  const after = await scan(root, items)
  console.log('\n최종 상태:')
  for (const s of after) console.log(`  ${STATUS_LABEL[s.status].padEnd(7)} ${s.item.label}`)
  console.log('\n설정 파일 변경 내용은 git diff로 확인할 수 있습니다.')
  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) process.exitCode = 1
}

main().catch((err) => { console.error(err.message); process.exit(1) })
```

- [ ] **Step 2: 스크래치 저장소 E2E — MCP 설치·감지·제거**

Run (스크래치 git 저장소 생성 후 그 안에서):
```bash
node <repo>/agent-installer/install.mjs --set mcp.notion,mcp.codebase-memory
node <repo>/agent-installer/install.mjs --list
```
Expected: 1번째 실행 후 `.mcp.json`·`.gemini/settings.json`·`.codex/config.toml`·`opencode.jsonc`·`.kilocode/mcp.json`·`.kiro/settings/mcp.json`·`.kimi-code/mcp.json`에 notion(http)·codebase-memory(stdio) 항목 생성. `--list`에서 두 항목 `설치됨`, 나머지 `미설치`.

Run: `node <repo>/agent-installer/install.mjs --set ""` 후 `--list`
Expected: 모든 MCP 항목 제거되어 `미설치`, 설정 파일의 다른 키는 불변.

- [ ] **Step 3: 이 저장소에서 dry-run 확인**

Run: `node agent-installer/install.mjs --list` 및 `node agent-installer/install.mjs --set mcp.notion --dry-run`
Expected: 스캔 결과 출력, dry-run에서 파일 변경 없음 (`git status`로 확인).

- [ ] **Step 4: AgentSetup-README.md에 사용법 섹션 추가**

`## 팀 저장소에 넣을 파일` 섹션 앞에 삽입:

```markdown
## 선택 항목 설치기 (agent-installer)

플러그인·MCP·스킬을 체크박스로 골라 설치/제거합니다.

​```bash
node agent-installer/install.mjs            # 대화형
node agent-installer/install.mjs --dry-run  # 변경 없이 확인
node agent-installer/install.mjs --list     # 현재 상태만 출력
​```

- 설치 상태는 파일에 저장되지 않고 실행 시 실제 설정을 스캔해 판정합니다.
- 항목 추가는 `agent-installer/lib/items/`에 파일 하나를 추가하면 됩니다.
- MCP는 7개 CLI 프로젝트 설정에 동시 등록됩니다.
- `agent-installer/` 폴더는 자기완결이라 다른 저장소에 복사해도 동작합니다
  (최초 1회 `npm install` 필요).
```

- [ ] **Step 5: 전체 테스트 + 커밋**

Run: `cd agent-installer && npm test`
Expected: 전부 PASS

```bash
git add agent-installer/install.mjs AgentSetup-README.md
git commit -m "feat: agent-installer 대화형 UI와 비대화형 모드 추가"
```

---

## Self-Review 결과

- 스펙 커버리지: 환경 스캔(T6·T9), 유동적 카탈로그(T6·T7·T8), 7개 CLI 등록(T4), supports/unsupported 3곳 반영(T6 팩토리 + T10 hint/리포트), A→B 폴백(T5·T6), --dry-run/--set(T9·T10), 자기완결 폴더(T1) — 전 항목 태스크 매핑 확인.
- 스펙과의 차이 1건(명시적): gstack은 조사 결과 프로젝트 로컬 미지원 → `scope: 'user'`로 선언하고 UI에 글로벌 설치임을 표시. 저장소 밖(사용자 홈) 쓰기가 발생하는 유일한 항목.
- 타입 일관성: `{kind, url|command+args}` 정규형(T4 정의)을 T6·T7이 동일하게 사용, `ctx = {root, dryRun, exec}` 시그니처 T6 정의·T8·T9 사용 일치.
