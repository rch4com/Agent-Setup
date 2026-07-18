# 부트스트랩 통합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `setup-agents.ps1`(599줄)·`setup-agents.sh`(478줄)의 저장소 부트스트랩 로직을 `agent-installer`로 옮기고, 두 스크립트를 약 20줄짜리 런처만 남긴다.

**Architecture:** 무엇을 만들지를 `lib/bootstrap/manifest.mjs`에 데이터로 선언하고, 종류별 실행기(`apply.mjs`, `adapter.mjs`)가 순회한다. `flow.mjs`가 순서와 보고만 담당한다. 부트스트랩 경로에서 도달 가능한 모듈은 node 표준 라이브러리만 쓰므로 `npm install` 없이 실행된다.

**Tech Stack:** Node.js 20+ (ESM, `node:` 표준 라이브러리만), `node --test`, PowerShell 7+, bash

## Global Constraints

- 설계 문서: `docs/superpowers/specs/2026-07-18-installer-bootstrap-design.md`
- **부트스트랩 경로는 의존성 0.** `lib/bootstrap/**`와 `lib/context.mjs`는 `node:` 접두사 또는 상대 경로 import만 사용한다. `@clack/prompts`·`jsonc-parser`·`smol-toml`을 직접·간접으로 끌어오면 안 된다.
- **추가 전용.** 부트스트랩은 파일을 지우지 않는다. 유일한 예외는 `.agent-kit-managed-copy` 마커가 있는 복사본의 재동기화다.
- **기존 파일 절대 보존.** 이미 존재하면 내용을 보지 않고 그대로 둔다. 깨진 심볼릭 링크도 "존재"로 친다(`lstatSync` 기준, `existsSync`는 깨진 링크에 false를 반환한다).
- **파일 쓰기는 항상 LF + 끝 개행 1개, BOM 없는 UTF-8.**
- 사용자 출력은 `[agent-setup] ` 접두사와 한국어를 유지한다.
- 커밋 메시지는 `.gitmessage.txt` 규약을 따른다: `<type>(<scope>): <제목>`, 제목은 한글 50자 이내·마침표 없음, 본문 72자 줄바꿈.
- 테스트는 `cd agent-installer && npm test`로 실행한다(`node --test "test/*.test.mjs"`).

## File Structure

| 파일 | 책임 |
|---|---|
| `agent-installer/lib/bootstrap/templates.mjs` (신규) | 생성될 파일 내용 문자열만. 로직 없음 |
| `agent-installer/lib/bootstrap/manifest.mjs` (신규) | 무엇을 만들지 데이터 선언. `dirs`·`files`·`blocks`·`adapters`·`ignore` |
| `agent-installer/lib/bootstrap/apply.mjs` (신규) | `dirs`·`files`·`blocks`·`ignore` 실행기 |
| `agent-installer/lib/bootstrap/adapter.mjs` (신규) | 스킬 어댑터(심볼릭 링크/Junction/복사) |
| `agent-installer/lib/bootstrap/flow.mjs` (신규) | `runBootstrap` 진입점, 순서와 결과 보고 |
| `agent-installer/lib/context.mjs` (수정) | `repoPathStrict` 추가 |
| `agent-installer/install.mjs` (수정) | `bootstrap` 서브커맨드, 세 번째 모드, 의존성 동적 import |
| `setup-agents.sh` (교체) | node 확인 후 패스스루 |
| `setup-agents.ps1` (교체) | node 확인 후 패스스루(PowerShell 관습 인자 변환) |
| `AGENTS.md` (수정) | Test·Full verification 명령 갱신 |
| `AgentSetup-README.md` (수정) | 실행 방법·`--menu` 반영 |

---

### Task 1: 템플릿과 매니페스트 (데이터)

**Files:**
- Create: `agent-installer/lib/bootstrap/templates.mjs`
- Create: `agent-installer/lib/bootstrap/manifest.mjs`
- Test: `agent-installer/test/bootstrap.manifest.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `templates.mjs`: `AGENTS_TEMPLATE`, `CLAUDE_BLOCK`, `GEMINI_BLOCK`, `SKILL_README`, `EXAMPLE_SKILL`, `AGENT_KIT_README`, `CLAUDE_SETTINGS`, `CODEX_CONFIG`, `GEMINI_SETTINGS`, `GROK_CONFIG`, `OPENCODE_CONFIG`, `KILO_CONFIG`, `KIRO_MCP_CONFIG`, `KIMI_MCP_CONFIG` — 모두 `string`
  - `manifest.mjs`: `MANIFEST` — `{ dirs: string[], files: {path,template}[], blocks: {path,block}[], adapters: {tool,path}[], ignore: string[] }`

**템플릿 내용의 출처.** 각 상수는 `setup-agents.ps1`의 here-string 내용을 **글자 그대로** 옮긴다(here-string 시작/종료 줄 제외). 아래 줄 범위가 정확한 출처다.

| 상수 | 출처 (`setup-agents.ps1`) |
|---|---|
| `AGENTS_TEMPLATE` | 384–413 |
| `CLAUDE_BLOCK` | 417–419 |
| `GEMINI_BLOCK` | 423–425 |
| `SKILL_README` | 429–447 |
| `EXAMPLE_SKILL` | 451–462 |
| `AGENT_KIT_README` | 466–481 |
| `CLAUDE_SETTINGS` | 485 |
| `CODEX_CONFIG` | 489–491 |
| `GROK_CONFIG` | 495–498 |
| `GEMINI_SETTINGS` | 502–513 |
| `OPENCODE_CONFIG` | 517–519 |
| `KILO_CONFIG` | 523–526 |
| `KIRO_MCP_CONFIG` | 530–532 |
| `KIMI_MCP_CONFIG` | 536–538 |

`AGENT_KIT_README`(466–481)만 한 군데 문구를 고친다: `The bootstrap scripts:` → `The installer bootstrap:`. 로직이 스크립트에서 설치기로 옮겨졌기 때문이다. 나머지 줄은 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/bootstrap.manifest.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'
import * as templates from '../lib/bootstrap/templates.mjs'

test('MANIFEST는 다섯 종류를 모두 선언한다', () => {
  assert.ok(Array.isArray(MANIFEST.dirs) && MANIFEST.dirs.length > 0)
  assert.ok(Array.isArray(MANIFEST.files) && MANIFEST.files.length > 0)
  assert.ok(Array.isArray(MANIFEST.blocks) && MANIFEST.blocks.length > 0)
  assert.ok(Array.isArray(MANIFEST.adapters) && MANIFEST.adapters.length > 0)
  assert.ok(Array.isArray(MANIFEST.ignore) && MANIFEST.ignore.length > 0)
})

test('경로는 저장소 상대 경로이고 중복이 없다', () => {
  const paths = [
    ...MANIFEST.dirs,
    ...MANIFEST.files.map((f) => f.path),
    ...MANIFEST.blocks.map((b) => b.path),
    ...MANIFEST.adapters.map((a) => a.path),
  ]
  for (const p of paths) {
    assert.ok(!p.startsWith('/') && !/^[A-Za-z]:/.test(p), `절대 경로 금지: ${p}`)
    assert.ok(!p.includes('..'), `상위 이동 금지: ${p}`)
    assert.ok(!p.includes('\\'), `구분자는 / 로 통일: ${p}`)
  }
  const files = MANIFEST.files.map((f) => f.path)
  assert.equal(new Set(files).size, files.length, 'files 경로 중복')
})

test('모든 files 항목이 비어 있지 않은 템플릿을 갖는다', () => {
  for (const f of MANIFEST.files) {
    assert.equal(typeof f.template, 'string', `${f.path}: template 누락`)
    assert.ok(f.template.trim().length > 0, `${f.path}: template 비어 있음`)
  }
})

test('블록은 관리 마커를 포함한다', () => {
  for (const b of MANIFEST.blocks) {
    assert.match(b.block, /<!-- agent-kit:begin -->/, `${b.path}: 시작 마커 없음`)
    assert.match(b.block, /<!-- agent-kit:end -->/, `${b.path}: 종료 마커 없음`)
  }
})

test('어댑터 경로는 모두 .gitignore 대상이다', () => {
  for (const a of MANIFEST.adapters) {
    assert.ok(MANIFEST.ignore.includes(a.path), `${a.path}가 ignore에 없음`)
  }
})

test('템플릿에 CRLF와 BOM이 없다', () => {
  for (const [name, value] of Object.entries(templates)) {
    if (typeof value !== 'string') continue
    assert.ok(!value.includes('\r'), `${name}: CR 포함`)
    assert.ok(!value.startsWith('﻿'), `${name}: BOM 포함`)
  }
})

test('9개 도구의 설정 파일이 모두 선언되어 있다', () => {
  const files = MANIFEST.files.map((f) => f.path)
  for (const expected of [
    'AGENTS.md',
    '.agents/skills/README.md',
    '.agents/skills/repository-check/SKILL.md',
    '.agent-kit/README.md',
    '.claude/settings.json',
    '.codex/config.toml',
    '.gemini/settings.json',
    '.grok/config.toml',
    'opencode.jsonc',
    'kilo.jsonc',
    '.kiro/settings/mcp.json',
    '.kimi-code/mcp.json',
  ]) {
    assert.ok(files.includes(expected), `누락: ${expected}`)
  }
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/bootstrap.manifest.test.mjs"`
Expected: FAIL — `Cannot find module '../lib/bootstrap/manifest.mjs'`

- [ ] **Step 3: templates.mjs 작성**

`setup-agents.ps1`의 위 표에 적힌 줄 범위를 읽어 각 상수로 옮긴다. 형식은 다음과 같다(앞뒤 개행은 `apply.mjs`가 정규화하므로 백틱 문자열 그대로 두면 된다).

```js
// setup-agents.ps1의 here-string 내용을 옮긴 단일 출처.
// 여기만 고치면 모든 OS가 같은 파일을 만든다.

export const AGENTS_TEMPLATE = `# Repository Instructions

## Scope

These instructions apply only to this repository.
` // ← setup-agents.ps1:384-413 전체를 그대로 채운다

export const CLAUDE_BLOCK = `<!-- agent-kit:begin -->
@AGENTS.md
<!-- agent-kit:end -->`

export const GEMINI_BLOCK = `<!-- agent-kit:begin -->
@./AGENTS.md
<!-- agent-kit:end -->`

export const CLAUDE_SETTINGS = `{}`

export const CODEX_CONFIG = `# Repository-local Codex configuration.
# Personal or machine-wide defaults belong outside this repository.
project_doc_max_bytes = 65536`

// SKILL_README, EXAMPLE_SKILL, AGENT_KIT_README, GEMINI_SETTINGS,
// GROK_CONFIG, OPENCODE_CONFIG, KILO_CONFIG, KIRO_MCP_CONFIG,
// KIMI_MCP_CONFIG 도 같은 방식으로 표의 줄 범위에서 옮긴다.
```

주의: 템플릿 안에 백틱이나 `${`가 있으면 이스케이프해야 한다. 표의 범위를 확인한 결과 `KILO_CONFIG`·`GEMINI_SETTINGS` 등에는 없지만, 옮긴 뒤 Step 5에서 테스트로 확인한다.

- [ ] **Step 4: manifest.mjs 작성**

```js
import {
  AGENTS_TEMPLATE, CLAUDE_BLOCK, GEMINI_BLOCK, SKILL_README, EXAMPLE_SKILL,
  AGENT_KIT_README, CLAUDE_SETTINGS, CODEX_CONFIG, GEMINI_SETTINGS, GROK_CONFIG,
  OPENCODE_CONFIG, KILO_CONFIG, KIRO_MCP_CONFIG, KIMI_MCP_CONFIG,
} from './templates.mjs'

// 저장소 부트스트랩이 만들 대상 선언.
// 도구 추가 = dirs 한 줄 + files 한 줄. 실행 로직은 apply.mjs·adapter.mjs에 있다.
export const MANIFEST = {
  dirs: [
    '.agents/skills', '.agent-kit', '.claude', '.codex',
    '.gemini', '.grok', '.kiro/settings', '.kimi-code',
  ],

  // 없을 때만 생성한다. 이미 있으면 내용을 보지 않고 보존한다.
  files: [
    { path: 'AGENTS.md', template: AGENTS_TEMPLATE },
    { path: '.agents/skills/README.md', template: SKILL_README },
    { path: '.agents/skills/repository-check/SKILL.md', template: EXAMPLE_SKILL },
    { path: '.agent-kit/README.md', template: AGENT_KIT_README },
    { path: '.claude/settings.json', template: CLAUDE_SETTINGS },
    { path: '.codex/config.toml', template: CODEX_CONFIG },
    { path: '.gemini/settings.json', template: GEMINI_SETTINGS },
    { path: '.grok/config.toml', template: GROK_CONFIG },
    { path: 'opencode.jsonc', template: OPENCODE_CONFIG },
    { path: 'kilo.jsonc', template: KILO_CONFIG },
    { path: '.kiro/settings/mcp.json', template: KIRO_MCP_CONFIG },
    { path: '.kimi-code/mcp.json', template: KIMI_MCP_CONFIG },
  ],

  // 마커가 없을 때만 덧붙인다. 파일이 없으면 블록만으로 생성한다.
  blocks: [
    { path: 'CLAUDE.md', block: CLAUDE_BLOCK },
    { path: 'GEMINI.md', block: GEMINI_BLOCK },
  ],

  // .agents/skills 를 가리키는 도구별 어댑터
  adapters: [
    { tool: 'Claude Code', path: '.claude/skills' },
    { tool: 'Kiro', path: '.kiro/skills' },
    { tool: 'Grok Build', path: '.grok/skills' },
  ],

  ignore: ['.claude/skills', '.kiro/skills', '.grok/skills', '.kimi-code/local.toml'],
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/bootstrap.manifest.test.mjs"`
Expected: PASS — 7개 테스트 통과

- [ ] **Step 6: 옮긴 14개 템플릿이 원본과 글자 단위로 같은지 대조**

`agent-installer/scripts/verify-templates.mjs`를 만들어 실행한다. 이 스크립트는 이번
이식이 끝나면 지워도 되는 일회성 검증 도구다.

```js
// setup-agents.ps1의 here-string과 templates.mjs가 같은지 대조하는 일회성 검사.
import { readFileSync } from 'node:fs'
import * as t from '../lib/bootstrap/templates.mjs'

// [상수명, 시작줄, 끝줄] — 1-based, 양끝 포함. here-string 구분자는 제외한 내용 범위다.
const RANGES = [
  ['AGENTS_TEMPLATE', 384, 413], ['CLAUDE_BLOCK', 417, 419], ['GEMINI_BLOCK', 423, 425],
  ['SKILL_README', 429, 447], ['EXAMPLE_SKILL', 451, 462], ['AGENT_KIT_README', 466, 481],
  ['CLAUDE_SETTINGS', 485, 485], ['CODEX_CONFIG', 489, 491], ['GROK_CONFIG', 495, 498],
  ['GEMINI_SETTINGS', 502, 513], ['OPENCODE_CONFIG', 517, 519], ['KILO_CONFIG', 523, 526],
  ['KIRO_MCP_CONFIG', 530, 532], ['KIMI_MCP_CONFIG', 536, 538],
]

const lines = readFileSync('../setup-agents.ps1', 'utf8').split(/\r?\n/)
let bad = 0
for (const [name, from, to] of RANGES) {
  const origin = lines.slice(from - 1, to).join('\n').trim()
  const ported = String(t[name] ?? '').replace(/\r\n/g, '\n').trim()
  // AGENT_KIT_README는 의도적으로 한 문구를 바꿨으므로 그 차이만 허용한다.
  const expected = name === 'AGENT_KIT_README'
    ? origin.replace('The bootstrap scripts:', 'The installer bootstrap:')
    : origin
  if (ported !== expected) {
    bad++
    console.log(`✖ ${name} 불일치`)
  }
}
console.log(bad === 0 ? '14개 템플릿 전부 일치' : `${bad}개 불일치`)
process.exitCode = bad === 0 ? 0 : 1
```

Run: `cd agent-installer && node scripts/verify-templates.mjs`
Expected: `14개 템플릿 전부 일치`

하나라도 불일치하면 Step 3으로 돌아가 해당 상수를 다시 옮긴다.

- [ ] **Step 7: 커밋**

```bash
git add agent-installer/lib/bootstrap/templates.mjs agent-installer/lib/bootstrap/manifest.mjs agent-installer/test/bootstrap.manifest.test.mjs
git commit -m "add(bootstrap): 템플릿과 매니페스트 선언 추가"
```

---

### Task 2: repoPathStrict — 링크를 통한 저장소 이탈 차단

**Files:**
- Modify: `agent-installer/lib/context.mjs`
- Test: `agent-installer/test/context.test.mjs` (기존 파일에 추가)

**Interfaces:**
- Consumes: 기존 `repoPath(root, rel)` — 어휘적 검사 후 절대 경로 반환, 위반 시 throw
- Produces: `repoPathStrict(root, rel): string` — 어휘적 검사 + 가장 가까운 존재하는 조상의 `realpath`가 저장소 안인지 확인. 위반 시 throw. `apply.mjs`·`adapter.mjs`가 모든 쓰기 경로에 사용한다.

기존 `repoPath`는 문자열 비교만 하므로 `<root>/.codex`가 저장소 밖을 가리키는 심볼릭 링크여도 통과한다. bash의 `safe_path`와 pwsh의 부모 reparse point 순회가 막던 위험이다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/context.test.mjs` 끝에 추가:

```js
import { symlinkSync, mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { repoPathStrict } from '../lib/context.mjs'

test('repoPathStrict: 저장소 안 경로는 통과한다', () => {
  const root = makeTempRepo()
  assert.equal(repoPathStrict(root, 'a/b/c'), join(root, 'a', 'b', 'c'))
})

test('repoPathStrict: 저장소 밖 경로는 거부한다', () => {
  const root = makeTempRepo()
  assert.throws(() => repoPathStrict(root, '../escape'), /저장소 밖/)
})

test('repoPathStrict: 링크를 통한 이탈을 거부한다', () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  mkdirSync(join(outside, 'skills'), { recursive: true })
  // <root>/.evil -> <tmp>/outside : 어휘적으로는 저장소 안이지만 실제로는 밖이다
  symlinkSync(outside, join(root, '.evil'), 'junction')

  assert.doesNotThrow(() => repoPath(root, '.evil/skills')) // 기존 함수는 통과시킨다
  assert.throws(() => repoPathStrict(root, '.evil/skills'), /외부 링크/)
})

test('repoPathStrict: 아직 없는 하위 경로는 조상 기준으로 검사한다', () => {
  const root = makeTempRepo()
  assert.equal(
    repoPathStrict(root, 'not/created/yet.txt'),
    join(root, 'not', 'created', 'yet.txt'),
  )
})
```

기존 `test/context.test.mjs`가 `makeTempRepo`·`join`·`repoPath`를 이미 import하고 있는지 확인하고, 없으면 위 import에 함께 추가한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/context.test.mjs"`
Expected: FAIL — `repoPathStrict is not a function`

- [ ] **Step 3: repoPathStrict 구현**

`agent-installer/lib/context.mjs`:

```js
import { execFileSync } from 'node:child_process'
import { lstatSync, realpathSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

// ... 기존 findRepoRoot, repoPath는 그대로 ...

function pathExists(target) {
  try {
    lstatSync(target)
    return true
  } catch {
    return false
  }
}

// repoPath의 어휘적 검사에 더해, 가장 가까운 존재하는 조상의 realpath가
// 저장소 안인지 확인한다. 어휘적 검사만으로는 심볼릭 링크/Junction을 통한
// 이탈을 막지 못한다. 부트스트랩의 모든 쓰기 경로가 이 함수를 쓴다.
export function repoPathStrict(root, rel) {
  const abs = repoPath(root, rel)

  let probe = abs
  while (!pathExists(probe)) {
    const parent = dirname(probe)
    if (parent === probe) break
    probe = parent
  }

  const realProbe = realpathSync(probe)
  const realRoot = realpathSync(root)
  if (realProbe !== realRoot && !realProbe.startsWith(realRoot + sep)) {
    throw new Error(`저장소 내부 경로가 외부 링크를 통해 이탈합니다: ${probe} -> ${realProbe}`)
  }
  return abs
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/context.test.mjs"`
Expected: PASS — 기존 테스트 + 신규 4개 모두 통과

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/context.mjs agent-installer/test/context.test.mjs
git commit -m "feat(bootstrap): 링크를 통한 저장소 이탈 차단 추가"
```

---

### Task 3: apply.mjs — 디렉터리와 파일

**Files:**
- Create: `agent-installer/lib/bootstrap/apply.mjs`
- Test: `agent-installer/test/bootstrap.apply.test.mjs`

**Interfaces:**
- Consumes: `repoPathStrict(root, rel)` (Task 2)
- Produces:
  - `ensureDirs(root, dirs, ctx): Result[]`
  - `ensureFiles(root, files, ctx): Result[]`
  - `ctx` = `{ dryRun: boolean, log: (message: string) => void }`
  - `Result` = `{ ok: boolean, action: 'create'|'keep'|'append'|'skip', path: string, message?: string }`
  - `flow.mjs`(Task 6)가 결과를 모아 보고한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/bootstrap.apply.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { ensureDirs, ensureFiles } from '../lib/bootstrap/apply.mjs'

const ctx = (cap, dryRun = false) => ({ dryRun, log: cap.log })

test('ensureDirs: 없는 디렉터리를 만든다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const results = ensureDirs(root, ['.codex', '.kiro/settings'], ctx(cap))

  assert.ok(statSync(join(root, '.codex')).isDirectory())
  assert.ok(statSync(join(root, '.kiro', 'settings')).isDirectory())
  assert.deepEqual(results.map((r) => r.action), ['create', 'create'])
})

test('ensureDirs: 이미 있으면 건너뛴다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.codex'))
  const results = ensureDirs(root, ['.codex'], ctx(makeCapture()))
  assert.equal(results[0].action, 'skip')
})

test('ensureFiles: 없는 파일을 템플릿으로 만든다', () => {
  const root = makeTempRepo()
  const results = ensureFiles(root, [{ path: 'AGENTS.md', template: '# 제목' }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# 제목\n')
  assert.equal(results[0].action, 'create')
})

test('ensureFiles: 기존 파일은 내용을 보지 않고 보존한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), '사용자가 쓴 내용\n')
  const results = ensureFiles(root, [{ path: 'AGENTS.md', template: '# 템플릿' }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '사용자가 쓴 내용\n')
  assert.equal(results[0].action, 'keep')
})

// existsSync는 깨진 링크에 false를 반환한다 — 덮어쓰면 사용자 의도를 파괴한다.
test('ensureFiles: 깨진 심볼릭 링크도 존재로 보아 보존한다', () => {
  const root = makeTempRepo()
  symlinkSync(join(root, 'does-not-exist'), join(root, 'kilo.jsonc'))
  const results = ensureFiles(root, [{ path: 'kilo.jsonc', template: '{}' }], ctx(makeCapture()))
  assert.equal(results[0].action, 'keep')
})

test('ensureFiles: 부모 디렉터리를 함께 만든다', () => {
  const root = makeTempRepo()
  ensureFiles(root, [{ path: 'a/b/c.md', template: 'x' }], ctx(makeCapture()))
  assert.ok(existsSync(join(root, 'a', 'b', 'c.md')))
})

test('ensureFiles: LF로 쓰고 끝 개행 1개, BOM 없음', () => {
  const root = makeTempRepo()
  ensureFiles(root, [{ path: 'x.md', template: '\n\n한 줄\r\n두 줄\n\n' }], ctx(makeCapture()))

  const raw = readFileSync(join(root, 'x.md'))
  assert.equal(raw.toString('utf8'), '한 줄\n두 줄\n')
  assert.notEqual(raw[0], 0xef) // BOM 아님
})

test('dry-run은 파일시스템을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  ensureDirs(root, ['.codex'], ctx(cap, true))
  ensureFiles(root, [{ path: 'AGENTS.md', template: 'x' }], ctx(cap, true))

  assert.equal(existsSync(join(root, '.codex')), false)
  assert.equal(existsSync(join(root, 'AGENTS.md')), false)
  assert.match(cap.text(), /디렉터리 생성/)
  assert.match(cap.text(), /파일 생성/)
})

test('저장소 밖 경로는 거부한다', () => {
  const root = makeTempRepo()
  assert.throws(() => ensureDirs(root, ['../escape'], ctx(makeCapture())), /저장소 밖/)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/bootstrap.apply.test.mjs"`
Expected: FAIL — `Cannot find module '../lib/bootstrap/apply.mjs'`

- [ ] **Step 3: apply.mjs의 디렉터리·파일 부분 구현**

```js
// 매니페스트 선언을 실제 파일시스템 변경으로 옮기는 실행기.
// 추가 전용 — 여기에는 삭제 경로가 없다.
import { lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPathStrict } from '../context.mjs'

// existsSync는 깨진 심볼릭 링크에 false를 반환한다. 그대로 쓰면 사용자가 만든
// 링크를 덮어쓰게 되므로 lstat으로 "항목이 있는가"를 본다.
export function pathExists(target) {
  try {
    lstatSync(target)
    return true
  } catch {
    return false
  }
}

// 두 OS가 같은 파일을 만들도록 항상 LF + 끝 개행 1개로 쓴다.
function writeText(file, text) {
  const body = text.replace(/\r\n/g, '\n').trim() + '\n'
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body, { encoding: 'utf8' })
}

export function ensureDirs(root, dirs, { dryRun = false, log }) {
  return dirs.map((rel) => {
    const target = repoPathStrict(root, rel)
    if (pathExists(target)) return { ok: true, action: 'skip', path: rel }
    log(`디렉터리 생성: ${rel}`)
    if (!dryRun) mkdirSync(target, { recursive: true })
    return { ok: true, action: 'create', path: rel }
  })
}

export function ensureFiles(root, files, { dryRun = false, log }) {
  return files.map(({ path: rel, template }) => {
    const target = repoPathStrict(root, rel)
    if (pathExists(target)) {
      log(`기존 파일 유지: ${rel}`)
      return { ok: true, action: 'keep', path: rel }
    }
    log(`파일 생성: ${rel}`)
    if (!dryRun) writeText(target, template)
    return { ok: true, action: 'create', path: rel }
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/bootstrap.apply.test.mjs"`
Expected: PASS — 9개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/bootstrap/apply.mjs agent-installer/test/bootstrap.apply.test.mjs
git commit -m "feat(bootstrap): 디렉터리·파일 생성 실행기 추가"
```

---

### Task 4: apply.mjs — 관리 블록과 .gitignore

**Files:**
- Modify: `agent-installer/lib/bootstrap/apply.mjs`
- Test: `agent-installer/test/bootstrap.apply.test.mjs` (같은 파일에 추가)

**Interfaces:**
- Consumes: `pathExists`, `writeText` (Task 3, 같은 모듈 내부), `ensureGitignoreEntries(root, entries)` (기존 `lib/gitignore.mjs`)
- Produces:
  - `ensureBlocks(root, blocks, ctx): Result[]`
  - `ensureIgnore(root, entries, ctx): Result[]`

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/bootstrap.apply.test.mjs`에 추가(import에 `ensureBlocks, ensureIgnore` 함께 추가):

```js
const BLOCK = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'

test('ensureBlocks: 파일이 없으면 블록만으로 만든다', () => {
  const root = makeTempRepo()
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), BLOCK + '\n')
  assert.equal(results[0].action, 'create')
})

test('ensureBlocks: 기존 내용을 보존하고 뒤에 덧붙인다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '# 내 지침\n')
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.ok(text.startsWith('# 내 지침\n'), '기존 내용이 보존되어야 한다')
  assert.ok(text.includes(BLOCK), '블록이 추가되어야 한다')
  assert.equal(results[0].action, 'append')
})

test('ensureBlocks: 마커가 이미 있으면 중복 추가하지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '# 내 지침\n\n' + BLOCK + '\n')
  const before = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), before)
  assert.equal(results[0].action, 'skip')
})

test('ensureBlocks: 끝 개행이 없어도 블록이 줄 경계에서 시작한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '개행 없이 끝남')
  ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.ok(text.includes('개행 없이 끝남\n'), '기존 마지막 줄이 닫혀야 한다')
  assert.ok(text.includes('\n' + BLOCK), '블록이 줄 처음에서 시작해야 한다')
})

test('ensureIgnore: 없는 항목만 추가한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, '.gitignore'), '.claude/skills\n')
  ensureIgnore(root, ['.claude/skills', '.kiro/skills'], ctx(makeCapture()))

  const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n')
  assert.equal(lines.filter((l) => l === '.claude/skills').length, 1, '중복 추가 금지')
  assert.ok(lines.includes('.kiro/skills'))
})

test('ensureIgnore: 모두 있으면 파일을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, '.gitignore'), '.claude/skills\n.kiro/skills\n')
  const before = readFileSync(join(root, '.gitignore'), 'utf8')
  const results = ensureIgnore(root, ['.claude/skills', '.kiro/skills'], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), before)
  assert.equal(results[0].action, 'skip')
})

test('블록·ignore도 dry-run에서 바꾸지 않는다', () => {
  const root = makeTempRepo()
  ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture(), true))
  ensureIgnore(root, ['.claude/skills'], ctx(makeCapture(), true))

  assert.equal(existsSync(join(root, 'CLAUDE.md')), false)
  assert.equal(existsSync(join(root, '.gitignore')), false)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/bootstrap.apply.test.mjs"`
Expected: FAIL — `ensureBlocks is not a function`

- [ ] **Step 3: 관리 블록과 ignore 실행기 구현**

`agent-installer/lib/bootstrap/apply.mjs`에 추가(상단 import에 `readFileSync, appendFileSync` 추가):

```js
import { ensureGitignoreEntries } from '../gitignore.mjs'

const BEGIN_MARKER = '<!-- agent-kit:begin -->'

export function ensureBlocks(root, blocks, { dryRun = false, log }) {
  return blocks.map(({ path: rel, block }) => {
    const target = repoPathStrict(root, rel)

    if (!pathExists(target)) {
      log(`파일 생성: ${rel}`)
      if (!dryRun) writeText(target, block)
      return { ok: true, action: 'create', path: rel }
    }

    const text = readFileSync(target, 'utf8')
    if (text.includes(BEGIN_MARKER)) {
      log(`관리 블록 확인: ${rel}`)
      return { ok: true, action: 'skip', path: rel }
    }

    log(`관리 블록 추가: ${rel}`)
    if (!dryRun) {
      // 기존 마지막 줄을 닫고 빈 줄 하나를 띄운 뒤 블록을 붙인다.
      const separator = text.endsWith('\n') ? '\n' : '\n\n'
      appendFileSync(target, separator + block.trim() + '\n', { encoding: 'utf8' })
    }
    return { ok: true, action: 'append', path: rel }
  })
}

export function ensureIgnore(root, entries, { dryRun = false, log }) {
  const target = repoPathStrict(root, '.gitignore')
  const text = pathExists(target) ? readFileSync(target, 'utf8') : ''
  const lines = new Set(text.split(/\r?\n/))
  const missing = entries.filter((e) => !lines.has(e))

  if (missing.length === 0) {
    log(`.gitignore 항목 확인: ${entries.join(', ')}`)
    return entries.map((e) => ({ ok: true, action: 'skip', path: e }))
  }

  log(`.gitignore 항목 추가: ${missing.join(', ')}`)
  if (!dryRun) ensureGitignoreEntries(root, missing)
  return missing.map((e) => ({ ok: true, action: 'append', path: e }))
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/bootstrap.apply.test.mjs"`
Expected: PASS — 16개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/bootstrap/apply.mjs agent-installer/test/bootstrap.apply.test.mjs
git commit -m "feat(bootstrap): 관리 블록과 gitignore 실행기 추가"
```

---

### Task 5: adapter.mjs — 스킬 어댑터

**Files:**
- Create: `agent-installer/lib/bootstrap/adapter.mjs`
- Test: `agent-installer/test/bootstrap.adapter.test.mjs`

**Interfaces:**
- Consumes: `repoPathStrict(root, rel)` (Task 2), `pathExists(target)` (Task 3, `apply.mjs`에서 export)
- Produces: `configureAdapter(root, entry, ctx): Result`
  - `entry` = `{ tool: string, path: string }`
  - `ctx` = `{ dryRun: boolean, skillMode: 'auto'|'link'|'copy', log: (m: string) => void }`
  - `Result` = `{ ok, action: 'skip'|'link'|'copy'|'warn', path, message? }`

기존 항목 처리 우선순위를 그대로 보존한다.

| 기존 상태 | 동작 | `action` |
|---|---|---|
| `.agents/skills`를 가리키는 올바른 링크 | 확인만 | `skip` |
| 다른 곳을 가리키는 링크 | 보존 + 경고 | `warn` |
| `.agent-kit-managed-copy` 마커가 있는 복사본 | 삭제 후 재동기화 | `copy` |
| 그 외 이미 존재 | 보존 + 경고 | `warn` |

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/bootstrap.adapter.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync, lstatSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, mkdtempSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { configureAdapter } from '../lib/bootstrap/adapter.mjs'

const ENTRY = { tool: 'Claude Code', path: '.claude/skills' }
const ctx = (cap, over = {}) => ({ dryRun: false, skillMode: 'auto', log: cap.log, ...over })

// .agents/skills에 스킬 하나를 둔 저장소를 만든다.
function repoWithSkills() {
  const root = makeTempRepo()
  mkdirSync(join(root, '.agents', 'skills', 'demo'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'demo', 'SKILL.md'), '# demo\n')
  mkdirSync(join(root, '.claude'), { recursive: true })
  return root
}

test('링크를 만들고 원본이 보인다', () => {
  const root = repoWithSkills()
  const result = configureAdapter(root, ENTRY, ctx(makeCapture()))

  assert.ok(['link', 'copy'].includes(result.action))
  assert.equal(
    readFileSync(join(root, '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8'),
    '# demo\n',
  )
})

// auto 모드는 링크 실패 시 복사로 떨어지므로, 링크 확인 경로를 보려면 link로 고정한다.
// (복사본 재동기화 경로는 아래 별도 테스트가 덮는다.)
test('이미 올바른 링크면 확인만 한다', () => {
  const root = repoWithSkills()
  const first = configureAdapter(root, ENTRY, ctx(makeCapture(), { skillMode: 'link' }))
  assert.equal(first.action, 'link')
  assert.equal(first.ok, true, '이 환경에서 링크를 만들 수 있어야 한다')

  const cap = makeCapture()
  const result = configureAdapter(root, ENTRY, ctx(cap, { skillMode: 'link' }))

  assert.equal(result.action, 'skip')
  assert.match(cap.text(), /링크 확인/)
})

test('다른 곳을 가리키는 링크는 보존하고 경고한다', () => {
  const root = repoWithSkills()
  const elsewhere = mkdtempSync(join(tmpdir(), 'elsewhere-'))
  symlinkSync(elsewhere, join(root, '.claude', 'skills'), 'junction')

  const cap = makeCapture()
  const result = configureAdapter(root, ENTRY, ctx(cap))

  assert.equal(result.action, 'warn')
  assert.ok(lstatSync(join(root, '.claude', 'skills')).isSymbolicLink(), '링크가 남아야 한다')
  assert.match(cap.text(), /다른 위치/)
})

test('마커 없는 디렉터리는 보존하고 경고한다', () => {
  const root = repoWithSkills()
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true })
  writeFileSync(join(root, '.claude', 'skills', '내것.md'), '건드리지 마\n')

  const cap = makeCapture()
  const result = configureAdapter(root, ENTRY, ctx(cap))

  assert.equal(result.action, 'warn')
  assert.equal(readFileSync(join(root, '.claude', 'skills', '내것.md'), 'utf8'), '건드리지 마\n')
  assert.match(cap.text(), /관리 대상이 아닙니다/)
})

test('마커가 있는 복제본은 재동기화한다', () => {
  const root = repoWithSkills()
  const target = join(root, '.claude', 'skills')
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, '.agent-kit-managed-copy'), '')
  writeFileSync(join(target, '오래된.md'), '옛날 내용\n')

  const result = configureAdapter(root, ENTRY, ctx(makeCapture(), { skillMode: 'copy' }))

  assert.equal(result.action, 'copy')
  assert.equal(existsSync(join(target, '오래된.md')), false, '옛 복제본은 정리된다')
  assert.ok(existsSync(join(target, 'demo', 'SKILL.md')))
})

test('copy 모드는 복제본과 마커를 만든다', () => {
  const root = repoWithSkills()
  const result = configureAdapter(root, ENTRY, ctx(makeCapture(), { skillMode: 'copy' }))

  assert.equal(result.action, 'copy')
  assert.equal(lstatSync(join(root, '.claude', 'skills')).isSymbolicLink(), false)
  assert.ok(existsSync(join(root, '.claude', 'skills', '.agent-kit-managed-copy')))
  assert.ok(existsSync(join(root, '.claude', 'skills', 'demo', 'SKILL.md')))
})

test('dry-run은 아무것도 만들지 않는다', () => {
  const root = repoWithSkills()
  const cap = makeCapture()
  configureAdapter(root, ENTRY, ctx(cap, { dryRun: true }))

  assert.equal(existsSync(join(root, '.claude', 'skills')), false)
  assert.match(cap.text(), /어댑터 생성 예정/)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/bootstrap.adapter.test.mjs"`
Expected: FAIL — `Cannot find module '../lib/bootstrap/adapter.mjs'`

- [ ] **Step 3: adapter.mjs 구현**

```js
// 스킬 어댑터 — .agents/skills를 도구별 경로에서 보이게 한다.
// Windows는 Junction을 쓴다. 관리자 권한이 필요 없고, MSYS(Git Bash)의 ln -s가
// 링크 대신 복사를 만드는 문제도 우회한다.
import { cpSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { repoPathStrict } from '../context.mjs'
import { pathExists } from './apply.mjs'

const MARKER = '.agent-kit-managed-copy'
const SOURCE_REL = '.agents/skills'

// 심볼릭 링크/Junction이면 가리키는 절대 경로를, 아니면 null을 돌려준다.
function linkTarget(target) {
  try {
    if (!lstatSync(target).isSymbolicLink()) return null
    return resolve(dirname(target), readlinkSync(target))
  } catch {
    return null
  }
}

function createLink(source, target) {
  if (process.platform === 'win32') {
    // Junction은 절대 경로를 요구한다.
    symlinkSync(source, target, 'junction')
  } else {
    symlinkSync(relative(dirname(target), source), target)
  }
}

function createCopy(source, target) {
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
  writeFileSync(join(target, MARKER), '', { encoding: 'utf8' })
}

export function configureAdapter(root, { tool, path: rel }, { dryRun = false, skillMode = 'auto', log }) {
  const source = repoPathStrict(root, SOURCE_REL)
  const target = repoPathStrict(root, rel)

  const linked = linkTarget(target)
  if (linked !== null) {
    if (linked === source) {
      log(`${tool} 스킬 링크 확인: ${rel}`)
      return { ok: true, action: 'skip', path: rel }
    }
    log(`경고: ${rel} 경로가 다른 위치를 가리키는 링크입니다. 변경하지 않습니다.`)
    return { ok: true, action: 'warn', path: rel, message: '다른 위치를 가리키는 링크' }
  }

  const managedCopy = pathExists(target) && pathExists(join(target, MARKER))
  if (pathExists(target) && !managedCopy) {
    log(`경고: ${rel} 경로가 이미 존재하며 agent-kit 관리 대상이 아닙니다. 변경하지 않습니다.`)
    return { ok: true, action: 'warn', path: rel, message: '관리 대상이 아닌 기존 항목' }
  }

  if (dryRun) {
    log(`${tool} 스킬 어댑터 생성 예정: ${rel} (${skillMode})`)
    return { ok: true, action: 'skip', path: rel }
  }

  if (managedCopy) {
    log(`${tool} 스킬 복제본 동기화: ${rel}`)
    rmSync(target, { recursive: true, force: true })
  }

  mkdirSync(dirname(target), { recursive: true })

  if (skillMode !== 'copy') {
    try {
      createLink(source, target)
      log(`${tool} 스킬 링크 생성: ${rel} -> ${SOURCE_REL}`)
      return { ok: true, action: 'link', path: rel }
    } catch (err) {
      if (skillMode === 'link') {
        return { ok: false, action: 'link', path: rel, message: `링크 생성 실패: ${err.message}` }
      }
      log(`경고: ${tool} 링크 생성에 실패하여 복사 방식으로 전환합니다.`)
    }
  }

  createCopy(source, target)
  log(`${tool} 스킬 복제본 생성: ${rel}`)
  return { ok: true, action: 'copy', path: rel }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/bootstrap.adapter.test.mjs"`
Expected: PASS — 7개 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/bootstrap/adapter.mjs agent-installer/test/bootstrap.adapter.test.mjs
git commit -m "feat(bootstrap): 스킬 어댑터 실행기 추가"
```

---

### Task 6: flow.mjs — 오케스트레이션과 보고

**Files:**
- Create: `agent-installer/lib/bootstrap/flow.mjs`
- Test: `agent-installer/test/bootstrap.flow.test.mjs`

**Interfaces:**
- Consumes: `MANIFEST` (Task 1), `ensureDirs`·`ensureFiles`·`ensureBlocks`·`ensureIgnore` (Task 3·4), `configureAdapter` (Task 5)
- Produces: `runBootstrap(root, opts): { results: Result[], failed: Result[] }`
  - `opts` = `{ dryRun?: boolean, skillMode?: 'auto'|'link'|'copy', log?: (m: string) => void, manifest?: typeof MANIFEST }`
  - `install.mjs`(Task 7)가 호출한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/bootstrap.flow.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'

test('매니페스트가 선언한 모든 대상을 만든다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })

  for (const rel of MANIFEST.dirs) {
    assert.ok(existsSync(join(root, rel)), `디렉터리 누락: ${rel}`)
  }
  for (const { path: rel } of MANIFEST.files) {
    assert.ok(existsSync(join(root, rel)), `파일 누락: ${rel}`)
  }
  for (const { path: rel } of MANIFEST.blocks) {
    assert.match(readFileSync(join(root, rel), 'utf8'), /<!-- agent-kit:begin -->/)
  }
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8')
  for (const entry of MANIFEST.ignore) {
    assert.ok(ignore.includes(entry), `.gitignore 누락: ${entry}`)
  }
})

test('두 번 실행해도 두 번째는 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const second = runBootstrap(root, { log() {} })

  const created = second.results.filter((r) => ['create', 'append', 'copy'].includes(r.action))
  assert.deepEqual(created.map((r) => r.path), [], '멱등하지 않다')
  assert.deepEqual(second.failed, [])
})

test('기존 파일을 보존한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), '내가 쓴 지침\n')
  runBootstrap(root, { log() {} })
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '내가 쓴 지침\n')
})

test('dry-run은 파일시스템을 전혀 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  runBootstrap(root, { dryRun: true, log: cap.log })

  for (const rel of [...MANIFEST.dirs, ...MANIFEST.files.map((f) => f.path)]) {
    assert.equal(existsSync(join(root, rel)), false, `dry-run이 만들었다: ${rel}`)
  }
  assert.match(cap.text(), /\[agent-setup\]/)
})

test('출력에 저장소 루트와 완료 안내가 있다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  runBootstrap(root, { log: cap.log })

  assert.match(cap.text(), /저장소 루트/)
  assert.match(cap.text(), /글로벌 설정 경로는 읽거나 수정하지 않습니다/)
  assert.match(cap.text(), /완료되었습니다/)
})

// 저장소 밖 경로는 repoPathStrict가 던지므로 어느 OS에서도 확실히 실패한다.
// (없는 원본으로 링크를 만들면 POSIX는 dangling symlink로 성공해 버려 테스트가 흔들린다.)
test('실패는 격리되어 나머지 진행을 막지 않는다', () => {
  const root = makeTempRepo()
  const manifest = { ...MANIFEST, adapters: [{ tool: '실패용', path: '../escape' }] }
  const { results, failed } = runBootstrap(root, { log() {}, manifest })

  assert.equal(failed.length, 1, '어댑터 하나만 실패해야 한다')
  assert.match(failed[0].message, /저장소 밖/)
  assert.ok(results.some((r) => r.action === 'create'), '파일 생성은 계속되어야 한다')
  // .gitignore는 어댑터 뒤에 실행된다 — 실패 이후 단계까지 진행됐다는 증거다.
  assert.ok(existsSync(join(root, '.gitignore')), '실패 이후 단계도 실행되어야 한다')
})

test('실패가 있으면 failed에 모인다', () => {
  const root = makeTempRepo()
  const { failed } = runBootstrap(root, { log() {} })
  assert.deepEqual(failed, [], '정상 실행에는 실패가 없어야 한다')
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/bootstrap.flow.test.mjs"`
Expected: FAIL — `Cannot find module '../lib/bootstrap/flow.mjs'`

- [ ] **Step 3: flow.mjs 구현**

```js
// 부트스트랩 진입점 — 순서와 보고만 담당한다.
// 무엇을 만들지는 manifest.mjs가, 어떻게 만들지는 apply.mjs·adapter.mjs가 안다.
import { MANIFEST } from './manifest.mjs'
import { ensureBlocks, ensureDirs, ensureFiles, ensureIgnore } from './apply.mjs'
import { configureAdapter } from './adapter.mjs'

const SKILL_MODES = ['auto', 'link', 'copy']

export function runBootstrap(root, opts = {}) {
  const { dryRun = false, skillMode = 'auto', log = console.log, manifest = MANIFEST } = opts

  if (!SKILL_MODES.includes(skillMode)) {
    throw new Error(`--skill-mode는 ${SKILL_MODES.join(', ')} 중 하나여야 합니다: ${skillMode}`)
  }

  const say = (message) => log(`[agent-setup] ${message}`)
  const ctx = { dryRun, log: say }

  say(`저장소 루트: ${root}`)
  say('글로벌 설정 경로는 읽거나 수정하지 않습니다.')

  const results = [
    ...ensureDirs(root, manifest.dirs, ctx),
    ...ensureFiles(root, manifest.files, ctx),
    ...ensureBlocks(root, manifest.blocks, ctx),
  ]

  // 어댑터는 항목별로 실패를 격리한다 — 하나가 실패해도 나머지를 계속한다.
  for (const entry of manifest.adapters) {
    try {
      results.push(configureAdapter(root, entry, { ...ctx, skillMode }))
    } catch (err) {
      results.push({ ok: false, action: 'link', path: entry.path, message: err.message })
    }
  }

  results.push(...ensureIgnore(root, manifest.ignore, ctx))

  const failed = results.filter((r) => !r.ok)
  log('')
  if (failed.length > 0) {
    say(`실패 ${failed.length}건:`)
    for (const f of failed) say(`  ✖ ${f.path} — ${f.message}`)
  }
  say('완료되었습니다.')
  say('공통 지침: AGENTS.md')
  say('공통 스킬: .agents/skills/')
  say('적용 도구: Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code, Grok Build, Antigravity')
  say('도구별 설정은 모두 현재 저장소 안에만 생성되었습니다.')
  say('기존 설정 파일은 덮어쓰지 않았습니다.')

  return { results, failed }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/bootstrap.flow.test.mjs"`
Expected: PASS — 7개 테스트 통과

- [ ] **Step 5: 전체 테스트 확인**

Run: `cd agent-installer && npm test`
Expected: 기존 112개 + 신규 테스트 모두 PASS, fail 0

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/lib/bootstrap/flow.mjs agent-installer/test/bootstrap.flow.test.mjs
git commit -m "feat(bootstrap): 부트스트랩 오케스트레이션 추가"
```

---

### Task 7: install.mjs 배선과 의존성 격리

**Files:**
- Modify: `agent-installer/install.mjs`
- Test: `agent-installer/test/bootstrap.isolation.test.mjs`

**Interfaces:**
- Consumes: `runBootstrap(root, opts)` (Task 6), 기존 `findRepoRoot()`
- Produces: `node install.mjs bootstrap [--skill-mode auto|link|copy] [--dry-run]`, 대화형 첫 화면의 세 번째 모드

**의존성 격리가 이 작업의 핵심이다.** 현재 `install.mjs`의 최상위 import 5개 중 4개가 의존성을 끌어온다.

```text
install.mjs
├─ @clack/prompts                                    ✗
├─ lib/context.mjs           → node:* 만              ✓
├─ lib/catalog.mjs           → clis.mjs → jsonfile.mjs(jsonc-parser)
│                                       → tomlfile.mjs(smol-toml)    ✗
├─ lib/engine.mjs            → catalog.mjs → 위와 동일               ✗
└─ lib/design-md/flow.mjs    → @clack/prompts                        ✗
```

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/bootstrap.isolation.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function importsOf(file) {
  const text = readFileSync(file, 'utf8')
  // 정적 import만 본다. 동적 import()는 분기 안에서만 실행되므로 대상이 아니다.
  return [...text.matchAll(/^\s*import\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm)].map((m) => m[1])
}

// 지정한 진입점에서 정적 import로 도달 가능한 모든 파일을 모은다.
function reachable(entry) {
  const seen = new Set()
  const queue = [resolve(entry)]
  const bare = []

  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) continue
    seen.add(file)

    for (const spec of importsOf(file)) {
      if (spec.startsWith('node:')) continue
      if (spec.startsWith('.')) {
        queue.push(resolve(dirname(file), spec))
        continue
      }
      bare.push({ file: file.slice(ROOT.length + 1), spec })
    }
  }
  return { files: seen, bare }
}

// npm install 없이 부트스트랩이 돌아야 한다. 이 불변식은 최상위 import 한 줄로
// 조용히 깨지고, 깨진 사실은 node_modules가 없는 환경에서만 드러난다.
test('부트스트랩 모듈 그래프에 외부 의존성이 없다', () => {
  const { bare } = reachable(join(ROOT, 'lib', 'bootstrap', 'flow.mjs'))
  assert.deepEqual(bare, [], `외부 의존성 유입: ${JSON.stringify(bare)}`)
})

test('context.mjs에 외부 의존성이 없다', () => {
  const { bare } = reachable(join(ROOT, 'lib', 'context.mjs'))
  assert.deepEqual(bare, [])
})

test('install.mjs의 정적 import가 부트스트랩 경로만 끌어온다', () => {
  const { bare } = reachable(join(ROOT, 'install.mjs'))
  assert.deepEqual(bare, [], `install.mjs 최상위에서 의존성 유입: ${JSON.stringify(bare)}`)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd agent-installer && node --test "test/bootstrap.isolation.test.mjs"`
Expected: FAIL — `install.mjs 최상위에서 의존성 유입`에 `@clack/prompts`, `jsonc-parser`, `smol-toml`이 나열된다

- [ ] **Step 3: install.mjs를 동적 import로 바꾸기**

최상위 import를 표준 라이브러리 경로만 남긴다.

```js
#!/usr/bin/env node
import { findRepoRoot } from './lib/context.mjs'
import { runBootstrap } from './lib/bootstrap/flow.mjs'
```

의존성이 필요한 곳은 사용 지점에서 동적으로 가져온다. `runClassic`과 `runDesign` 호출부를 다음과 같이 감싼다.

```js
// 의존성 모듈은 필요한 분기에서만 가져온다 — bootstrap은 npm install 없이 돈다.
async function loadPrompts() {
  try {
    return await import('@clack/prompts')
  } catch (err) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err
    throw new Error(
      '대화형 메뉴에는 의존성이 필요합니다. 다음 중 하나를 실행하세요:\n' +
      '  ./setup-agents.sh --menu\n' +
      '  npm install --prefix agent-installer',
    )
  }
}
```

`runClassic` 안의 `loadItems`·`scan`·`planChanges`·`apply`·`runDesign`도 같은 방식으로 함수 안에서 `await import()`한다.

```js
async function runClassic(root, { dryRun, listOnly, setArg, designDirs = [] }) {
  const { loadItems } = await import('./lib/catalog.mjs')
  const { scan, planChanges, apply } = await import('./lib/engine.mjs')
  // ... 이하 기존 로직 그대로 ...
}
```

`design` 서브커맨드도 마찬가지다.

```js
if (argv[0] === 'design') {
  const { runDesign } = await import('./lib/design-md/flow.mjs')
  await runDesign(root, parseDesignArgs(argv.slice(1)))
  return
}
```

- [ ] **Step 4: bootstrap 서브커맨드와 인자 파싱 추가**

```js
// `bootstrap` 서브커맨드 플래그 파싱.
function parseBootstrapArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  let skillMode = 'auto'

  const flag = argv.find((a) => a === '--skill-mode' || a.startsWith('--skill-mode='))
  if (flag) {
    const value = flag.includes('=') ? flag.slice('--skill-mode='.length) : argv[argv.indexOf(flag) + 1]
    if (!['auto', 'link', 'copy'].includes(value)) {
      throw new Error('--skill-mode는 auto, link, copy 중 하나여야 합니다.')
    }
    skillMode = value
  }
  return { dryRun, skillMode }
}
```

`main()`에 분기를 추가한다. `design` 분기 바로 위에 둔다.

```js
if (argv[0] === 'bootstrap') {
  const { failed } = runBootstrap(root, parseBootstrapArgs(argv.slice(1)))
  if (failed.length > 0) process.exitCode = 1
  return
}
```

- [ ] **Step 5: 대화형 모드 선택지에 부트스트랩 추가**

`runClassic`의 모드 선택을 세 개로 늘린다.

```js
const mode = await p.select({
  message: '무엇을 관리할까요?',
  options: [
    { value: 'bootstrap', label: '저장소 부트스트랩 (지침 · 스킬 · 도구별 설정)' },
    { value: 'agents', label: '에이전트 설치 (plugin · mcp · skill)' },
    { value: 'design', label: 'design.md 라이브러리' },
  ],
})
if (p.isCancel(mode)) { p.cancel('취소되었습니다.'); return }
if (mode === 'bootstrap') { runBootstrap(root, { dryRun }); return }
if (mode === 'design') { await runDesign(root, { interactive: true, dryRun, designDirs }); return }
```

- [ ] **Step 6: 격리 테스트 통과 확인**

Run: `cd agent-installer && node --test "test/bootstrap.isolation.test.mjs"`
Expected: PASS — 3개 테스트 통과

- [ ] **Step 7: 의존성 없이 실제로 도는지 확인**

Run:
```bash
cd /tmp && rm -rf iso-check && git init -q iso-check && cd iso-check
node D:/sources/github/Agent-Setup/agent-installer/install.mjs bootstrap --dry-run
```
Expected: `[agent-setup] 저장소 루트: ...`로 시작하는 출력이 나오고 오류가 없다. (`node_modules` 해석이 상위로 올라가 우연히 성공하는 것을 막으려면 Step 6의 정적 검사를 신뢰한다.)

- [ ] **Step 8: 전체 테스트 확인**

Run: `cd agent-installer && npm test`
Expected: 전부 PASS, fail 0

- [ ] **Step 9: 커밋**

```bash
git add agent-installer/install.mjs agent-installer/test/bootstrap.isolation.test.mjs
git commit -m "feat(bootstrap): bootstrap 서브커맨드와 의존성 격리 추가"
```

---

### Task 8: 얇아진 런처 스크립트

**Files:**
- Modify: `setup-agents.sh` (478줄 → 약 20줄)
- Modify: `setup-agents.ps1` (599줄 → 약 25줄)

**Interfaces:**
- Consumes: `node install.mjs bootstrap [--skill-mode ...] [--dry-run]` (Task 7)
- Produces: 기존 호출 방식 유지 — `./setup-agents.sh --skill-mode copy --dry-run`, `pwsh -File ./setup-agents.ps1 -SkillMode Copy -DryRun`, 추가로 `--menu` / `-Menu`

- [ ] **Step 1: setup-agents.sh 교체**

```bash
#!/usr/bin/env bash
# 저장소 부트스트랩 런처. 실제 로직은 agent-installer에 있다.
#   ./setup-agents.sh [--skill-mode auto|link|copy] [--dry-run]
#   ./setup-agents.sh --menu   # 의존성 설치 후 대화형 메뉴
set -Eeuo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent-installer"

command -v node >/dev/null 2>&1 || {
  echo "Node.js 20 이상이 필요합니다: https://nodejs.org" >&2
  exit 1
}

if [[ "${1-}" == "--menu" ]]; then
  npm install --prefix "$DIR" --silent
  exec node "$DIR/install.mjs" "${@:2}"
fi

exec node "$DIR/install.mjs" bootstrap "$@"
```

- [ ] **Step 2: setup-agents.ps1 교체**

```powershell
# 저장소 부트스트랩 런처. 실제 로직은 agent-installer에 있다.
#   ./setup-agents.ps1 [-SkillMode Auto|Link|Copy] [-DryRun]
#   ./setup-agents.ps1 -Menu   # 의존성 설치 후 대화형 메뉴
[CmdletBinding()]
param(
    [ValidateSet("Auto", "Link", "Copy")]
    [string]$SkillMode = "Auto",

    [switch]$DryRun,
    [switch]$Menu
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installer = Join-Path $PSScriptRoot "agent-installer"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20 이상이 필요합니다: https://nodejs.org"
    exit 1
}

if ($Menu) {
    & npm install --prefix $installer --silent
    & node (Join-Path $installer "install.mjs")
    exit $LASTEXITCODE
}

$nodeArgs = @((Join-Path $installer "install.mjs"), "bootstrap", "--skill-mode", $SkillMode.ToLower())
if ($DryRun) { $nodeArgs += "--dry-run" }

& node @nodeArgs
exit $LASTEXITCODE
```

- [ ] **Step 3: bash 문법 검사와 dry-run 스모크**

Run: `cd D:/sources/github/Agent-Setup && bash -n ./setup-agents.sh && bash ./setup-agents.sh --dry-run`
Expected: 문법 오류 없음. `[agent-setup] 저장소 루트: ...` 출력 후 `[agent-setup] 완료되었습니다.`로 끝난다. 파일은 변하지 않는다.

- [ ] **Step 4: PowerShell dry-run 스모크**

Run: `cd D:/sources/github/Agent-Setup && pwsh -File ./setup-agents.ps1 -DryRun`
Expected: `bash` 실행과 같은 출력. 마지막 줄이 `[agent-setup] 기존 설정 파일은 덮어쓰지 않았습니다.`

- [ ] **Step 5: 인자 전달 확인**

Run: `cd D:/sources/github/Agent-Setup && bash ./setup-agents.sh --skill-mode copy --dry-run && pwsh -File ./setup-agents.ps1 -SkillMode Copy -DryRun`
Expected: 두 명령 모두 어댑터 줄이 `... 어댑터 생성 예정: .claude/skills (copy)` 형태로 나온다.

- [ ] **Step 6: 잘못된 인자가 설치기에서 잡히는지 확인**

Run: `cd D:/sources/github/Agent-Setup && bash ./setup-agents.sh --skill-mode nope; echo "exit=$?"`
Expected: `--skill-mode는 auto, link, copy 중 하나여야 합니다.` 출력 후 `exit=1`

- [ ] **Step 7: 실제 저장소에서 멱등성 확인**

Run:
```bash
cd /tmp && rm -rf idem && git init -q idem && cd idem
bash D:/sources/github/Agent-Setup/setup-agents.sh
bash D:/sources/github/Agent-Setup/setup-agents.sh
git status --porcelain | grep -E '\.claude/skills|\.kiro/skills|\.grok/skills' || echo "어댑터 미스테이징 OK"
```
Expected: 두 번째 실행에서 `파일 생성` 대신 `기존 파일 유지`·`관리 블록 확인`만 나온다. 마지막 줄에 `어댑터 미스테이징 OK`.

- [ ] **Step 8: 커밋**

```bash
git add setup-agents.sh setup-agents.ps1
git commit -m "refactor: 부트스트랩 스크립트를 런처로 축소"
```

---

### Task 9: 문서 갱신

**Files:**
- Modify: `AGENTS.md`
- Modify: `AgentSetup-README.md`

**Interfaces:**
- Consumes: Task 7·8에서 확정된 명령들
- Produces: 없음 (문서)

- [ ] **Step 1: AGENTS.md의 Repository commands 갱신**

`## Repository commands` 절을 다음으로 바꾼다.

```markdown
## Repository commands

Bootstrap logic lives in `agent-installer`; the shell scripts are launchers.

- Install: none for bootstrap (Node standard library only).
  `npm install --prefix agent-installer` for the interactive menu.
- Build: none
- Test: `cd agent-installer && npm test`
- Lint: `bash -n ./setup-agents.sh`
- Full verification: run `cd agent-installer && npm test`, then smoke-test both
  launchers with `bash ./setup-agents.sh --dry-run` and
  `pwsh -File ./setup-agents.ps1 -DryRun`. For behavior changes, run both
  launchers twice in a scratch Git repository and confirm the second run is
  idempotent and `git status` stages no `.claude/skills`, `.kiro/skills`, or
  `.grok/skills` entries.
```

- [ ] **Step 2: AgentSetup-README.md 갱신**

부트스트랩 실행 방법 절에 다음을 반영한다.

- 기본 실행은 `./setup-agents.sh` / `pwsh -File ./setup-agents.ps1` 그대로다.
- 대화형 메뉴는 `--menu` / `-Menu`이며 이때만 `npm install`이 필요하다.
- 부트스트랩 로직이 `agent-installer/lib/bootstrap/`에 있고, 도구 추가는
  `manifest.mjs` 한 곳만 고치면 된다.
- 설치기에서 직접 부를 수도 있다: `node agent-installer/install.mjs bootstrap --dry-run`

- [ ] **Step 3: 문서의 명령이 실제로 도는지 확인**

Run:
```bash
cd D:/sources/github/Agent-Setup/agent-installer && npm test
cd D:/sources/github/Agent-Setup && bash -n ./setup-agents.sh && bash ./setup-agents.sh --dry-run >/dev/null && pwsh -File ./setup-agents.ps1 -DryRun >/dev/null && echo "문서 명령 전부 OK"
```
Expected: `문서 명령 전부 OK`

- [ ] **Step 4: 커밋**

```bash
git add AGENTS.md AgentSetup-README.md
git commit -m "docs: 부트스트랩 통합에 맞춰 명령과 안내 갱신"
```

---

## 완료 기준

- `cd agent-installer && npm test` 전부 통과 (기존 112개 + 신규 약 45개)
- 부트스트랩 모듈 그래프에 외부 의존성 0 (정적 검사로 고정)
- 빈 저장소에서 두 런처를 두 번 실행해도 멱등하고, 어댑터 경로가 스테이징되지 않음
- 기존 호출 방식(`--skill-mode copy --dry-run`, `-SkillMode Copy -DryRun`)이 그대로 동작
- `setup-agents.sh` 20줄 내외, `setup-agents.ps1` 25줄 내외
