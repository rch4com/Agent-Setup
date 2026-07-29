# GitHub Copilot 지원 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장소 부트스트랩과 선택 항목 설치기가 GitHub Copilot CLI와 VS Code Copilot을 기존 9개 도구와 동일하게 다루도록 만든다.

**Architecture:** 두 도구 모두 루트 `AGENTS.md`와 `.agents/skills`를 네이티브로 읽으므로 어댑터와 import 블록은 추가하지 않는다. 새로 필요한 것은 (1) 프로젝트 설정 파일 3개 생성, (2) `.vscode/settings.json`에 키 하나를 보존적으로 주입하는 신규 primitive, (3) MCP 등록 대상 2개 추가다. 선언은 `manifest.mjs`, 실행은 `apply.mjs`, MCP 등록은 `clis.mjs`라는 기존 책임 경계를 그대로 따른다.

**Tech Stack:** Node.js 20+ (ESM), `node --test` 내장 테스트 러너, jsonc-parser(설치기 경로 전용 — 부트스트랩에서는 사용 금지)

## Global Constraints

- **부트스트랩 모듈 그래프에 외부 의존성 0.** `lib/bootstrap/**`와 `lib/context.mjs`에서 도달 가능한 모든 정적 import는 `node:*` 또는 상대 경로여야 한다. `test/bootstrap.isolation.test.mjs`가 강제한다. `lib/jsonfile.mjs`(jsonc-parser)는 부트스트랩에서 import 금지.
- **새로 만드는 파일은 항상 LF + 끝 개행 1개 + BOM 없음.** `apply.mjs`의 `writeText`가 처리한다.
- **기존 파일은 덮어쓰지 않는다.** 내용을 고치는 경우에도 기존 줄바꿈·들여쓰기·주석을 보존한다(정규화 금지).
- **쓰기 경로는 반드시 `repoPathStrict`를 통과시킨다.** 검사는 dry-run 여부와 무관하게 수행하고, 로그보다 먼저 호출한다.
- **테스트 실행:** `cd agent-installer && npm test`
- **커밋 메시지:** `.gitmessage.txt` 규약 — `<type>(<scope>): <subject>`, 타입은 영어 소문자 키워드, 제목 50자 이내·마침표 없음, 본문은 한국어 72자 줄바꿈.
- **도구 표기 문자열(그대로 사용):** `GitHub Copilot CLI`, `VS Code Copilot`
- **주입 대상 설정 키(그대로 사용):** `chat.useAgentsMdFile`, 값은 `true`

---

## File Structure

| 파일 | 책임 | 이번 변경 |
|---|---|---|
| `agent-installer/lib/bootstrap/apply.mjs` | 매니페스트 선언 → 파일시스템 변경 | `ensureJsonKeys` 추가 (Task 1) |
| `agent-installer/lib/bootstrap/manifest.mjs` | 무엇을 만들지(데이터만) | 도구·디렉터리·파일·`settings`·ignore 항목 추가 (Task 2) |
| `agent-installer/lib/bootstrap/templates.mjs` | 생성 파일 내용(문자열만) | 템플릿 3개 추가, 안내 문구 갱신 (Task 2) |
| `agent-installer/lib/bootstrap/flow.mjs` | 순서와 보고 | `ensureJsonKeys` 배선 (Task 2) |
| `agent-installer/lib/clis.mjs` | 도구별 MCP 등록 어댑터 | `copilot`·`vscode` 엔트리 (Task 3) |
| `agent-installer/test/bootstrap.apply.test.mjs` | primitive 단위 테스트 | 신규 케이스 8개 (Task 1) |
| `agent-installer/test/bootstrap.manifest.test.mjs` | 선언 검증 | 파일 3개·도구 수·`settings` 형태 (Task 2) |
| `agent-installer/test/bootstrap.flow.test.mjs` | 통합·멱등성 | `insert` 액션 포함 (Task 2) |
| `agent-installer/test/clis.test.mjs` | MCP 포맷 검증 | 신규 단언 2개 (Task 3) |
| 문서 5종 | 사용자 문서 | Task 4 |

---

## Task 1: `ensureJsonKeys` primitive

기존 JSON 파일을 보존한 채 최상위 키 하나를 보장하는 실행기. 부트스트랩은 외부 의존성을 쓸 수 없으므로 JSON 파서 없이 텍스트 삽입으로 처리한다. 대상은 "최상위 키 1개"로 좁다 — 범용 JSON 편집기가 아니다.

**Files:**
- Modify: `agent-installer/lib/bootstrap/apply.mjs` (파일 끝에 추가)
- Test: `agent-installer/test/bootstrap.apply.test.mjs` (파일 끝에 추가)

**Interfaces:**
- Consumes: `pathExists`, `writeText`, `repoPath`, `repoPathStrict` — 모두 `apply.mjs` 안에 이미 있다.
- Produces: `ensureJsonKeys(root, entries, { dryRun, log })` → `Array<{ ok, action, path, message? }>`
  - `entries`: `Array<{ path: string, key: string, value: unknown }>`
  - `action`: `'create'` | `'insert'` | `'skip'` | `'warn'`
  - Task 2의 `flow.mjs`가 이 이름과 시그니처로 호출한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/bootstrap.apply.test.mjs` 끝에 붙인다. 파일 맨 위 import 줄에 `ensureJsonKeys`를 추가하는 것도 이 단계에 포함한다:

```js
import { ensureDirs, ensureFiles, ensureBlocks, ensureIgnore, ensureJsonKeys } from '../lib/bootstrap/apply.mjs'
```

```js
const SETTING = { path: '.vscode/settings.json', key: 'chat.useAgentsMdFile', value: true }

test('ensureJsonKeys: 파일이 없으면 키만 담아 만든다', () => {
  const root = makeTempRepo()
  const results = ensureJsonKeys(root, [SETTING], ctx(makeCapture()))

  const text = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  assert.equal(text, '{\n  "chat.useAgentsMdFile": true\n}\n')
  assert.equal(results[0].action, 'create')
})

test('ensureJsonKeys: 빈 객체에는 콤마 없이 삽입한다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '{}\n')

  const results = ensureJsonKeys(root, [SETTING], ctx(makeCapture()))

  const text = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  assert.deepEqual(JSON.parse(text), { 'chat.useAgentsMdFile': true }, '유효한 JSON이어야 한다')
  assert.equal(results[0].action, 'insert')
})

test('ensureJsonKeys: 기존 키와 주석을 보존하고 앞에 삽입한다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '{\n  // 팀 규약\n  "editor.tabSize": 2\n}\n')

  ensureJsonKeys(root, [SETTING], ctx(makeCapture()))

  const text = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  assert.ok(text.includes('// 팀 규약'), '주석이 보존되어야 한다')
  assert.ok(text.includes('"editor.tabSize": 2'), '기존 키가 보존되어야 한다')
  assert.match(text, /\{\n {2}"chat\.useAgentsMdFile": true,\n/, '콤마와 함께 첫 키로 삽입되어야 한다')
})

test('ensureJsonKeys: 키가 이미 있으면 값이 false여도 건드리지 않는다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  const before = '{\n  "chat.useAgentsMdFile": false\n}\n'
  writeFileSync(join(root, '.vscode/settings.json'), before)

  const results = ensureJsonKeys(root, [SETTING], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, '.vscode/settings.json'), 'utf8'), before)
  assert.equal(results[0].action, 'skip')
})

test('ensureJsonKeys: 두 번 실행해도 한 번만 삽입한다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '{\n  "editor.tabSize": 2\n}\n')

  ensureJsonKeys(root, [SETTING], ctx(makeCapture()))
  const after = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  const second = ensureJsonKeys(root, [SETTING], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, '.vscode/settings.json'), 'utf8'), after, '멱등해야 한다')
  assert.equal(second[0].action, 'skip')
})

test('ensureJsonKeys: 루트 앞 주석 속 중괄호에 속지 않는다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '// 예: { "a": 1 }\n{\n  "editor.tabSize": 2\n}\n')

  ensureJsonKeys(root, [SETTING], ctx(makeCapture()))

  const text = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  assert.ok(text.startsWith('// 예: { "a": 1 }\n{\n  "chat.useAgentsMdFile": true,\n'), `주석 뒤 루트에 삽입해야 한다: ${text}`)
})

test('ensureJsonKeys: 루트 객체가 없으면 경고로 처리한다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '// 내용 없음\n')

  const cap = makeCapture()
  const results = ensureJsonKeys(root, [SETTING], ctx(cap))

  assert.equal(results[0].action, 'warn')
  assert.equal(readFileSync(join(root, '.vscode/settings.json'), 'utf8'), '// 내용 없음\n')
  assert.match(cap.text(), /경고/)
})

test('ensureJsonKeys: dry-run은 파일시스템을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  ensureJsonKeys(root, [SETTING], ctx(cap, true))

  assert.equal(existsSync(join(root, '.vscode/settings.json')), false)
  assert.match(cap.text(), /파일 생성/)
})

test('ensureJsonKeys: 링크를 통한 저장소 이탈을 거부한다', () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  writeFileSync(join(outside, 'settings.json'), '{}\n')
  symlinkSync(outside, join(root, '.evil'), 'junction')

  assert.throws(
    () => ensureJsonKeys(root, [{ ...SETTING, path: '.evil/settings.json' }], ctx(makeCapture())),
    /외부 링크/,
  )
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.apply.test.mjs`
Expected: FAIL — `ensureJsonKeys is not a function` (또는 import 오류)

- [ ] **Step 3: 구현을 쓴다**

`agent-installer/lib/bootstrap/apply.mjs` 끝에 추가한다:

```js
// 줄 주석(//)과 블록 주석(/* */)을 건너뛰고 루트 객체의 여는 중괄호 위치를 찾는다.
// JSONC인 .vscode/settings.json은 파일 첫머리에 주석이 오는 일이 흔하고,
// 그 주석 안의 중괄호에 속으면 주석 한가운데에 키를 끼워 넣게 된다.
function findRootBrace(text) {
  let inBlock = false
  let offset = 0

  for (const line of text.split('\n')) {
    let i = 0
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i)
        if (end === -1) { i = line.length; break }
        inBlock = false
        i = end + 2
        continue
      }
      if (line[i] === '/' && line[i + 1] === '/') break
      if (line[i] === '/' && line[i + 1] === '*') { inBlock = true; i += 2; continue }
      if (line[i] === '{') return offset + i
      i++
    }
    offset += line.length + 1 // split이 제거한 개행 1자
  }
  return -1
}

// 기존 JSON 파일을 보존한 채 최상위 키 하나를 보장한다.
// 부트스트랩은 외부 의존성을 쓸 수 없어(jsonc-parser는 설치기 경로 전용)
// 파싱·재직렬화 대신 텍스트 삽입으로 처리한다. 재직렬화하지 않으므로
// 사용자의 주석·들여쓰기·줄바꿈이 그대로 남는다.
export function ensureJsonKeys(root, entries, { dryRun = false, log }) {
  return entries.map(({ path: rel, key, value }) => {
    const pair = `${JSON.stringify(key)}: ${JSON.stringify(value)}`

    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (!pathExists(repoPath(root, rel))) {
      // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
      const target = repoPathStrict(root, rel)
      log(`파일 생성: ${rel}`)
      if (!dryRun) writeText(target, `{\n  ${pair}\n}`)
      return { ok: true, action: 'create', path: rel }
    }

    let text
    try {
      text = readFileSync(repoPath(root, rel), 'utf8')
    } catch (err) {
      log(`경고: ${rel}을 읽을 수 없어 건너뜁니다 (${err.code ?? err.message})`)
      return { ok: true, action: 'warn', path: rel, message: '읽기 실패' }
    }

    // 주석 안에 있어도 건드리지 않는다 — 사용자가 언급한 키를 스크립트가
    // 되살리지 않는 편이 "기존 설정을 덮어쓰지 않는다"는 원칙에 맞는다.
    if (text.includes(JSON.stringify(key))) {
      log(`설정 키 확인: ${rel} — ${key}`)
      return { ok: true, action: 'skip', path: rel }
    }

    const brace = findRootBrace(text)
    if (brace === -1) {
      log(`경고: ${rel}에서 루트 객체를 찾지 못해 건너뜁니다`)
      return { ok: true, action: 'warn', path: rel, message: '루트 객체 없음' }
    }

    const strictTarget = repoPathStrict(root, rel)
    log(`설정 키 추가: ${rel} — ${key}`)
    if (!dryRun) {
      const rest = text.slice(brace + 1)
      // 빈 객체면 콤마 없이, 뒤에 항목이 있으면 콤마를 붙여 유효한 JSON을 유지한다.
      const empty = rest.trimStart().startsWith('}')
      const inserted = `\n  ${pair}${empty ? '\n' : ','}`
      writeFileSync(strictTarget, text.slice(0, brace + 1) + inserted + rest, { encoding: 'utf8' })
    }
    return { ok: true, action: 'insert', path: rel }
  })
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.apply.test.mjs`
Expected: PASS — 신규 9개를 포함한 모든 테스트 통과

- [ ] **Step 5: 의존성 불변식이 깨지지 않았는지 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.isolation.test.mjs`
Expected: PASS — `apply.mjs`는 `node:fs`·`node:path`와 상대 경로만 import한다

- [ ] **Step 6: 커밋한다**

```bash
git add agent-installer/lib/bootstrap/apply.mjs agent-installer/test/bootstrap.apply.test.mjs
git commit -F - <<'EOF'
feat(bootstrap): JSON 최상위 키 보장 실행기 추가

기존 파일을 보존한 채 최상위 키 하나를 넣는 ensureJsonKeys를 만들었다.
부트스트랩은 외부 의존성을 쓸 수 없어 파싱 대신 텍스트 삽입으로
처리하며, 키가 이미 있으면 값과 무관하게 손대지 않는다.
EOF
```

---

## Task 2: 매니페스트·템플릿 확장과 flow 배선

부트스트랩이 두 Copilot의 프로젝트 파일을 만들고, VS Code 설정 키를 보장하도록 선언을 추가한다.

**Files:**
- Modify: `agent-installer/lib/bootstrap/templates.mjs` (템플릿 3개 추가, 안내 문구 2곳)
- Modify: `agent-installer/lib/bootstrap/manifest.mjs` (전체 교체)
- Modify: `agent-installer/lib/bootstrap/flow.mjs:4,22-26`
- Test: `agent-installer/test/bootstrap.manifest.test.mjs`, `agent-installer/test/bootstrap.flow.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `ensureJsonKeys(root, entries, ctx)`
- Produces: `MANIFEST.settings` 배열 — 각 원소는 `{ path, key, value }`. `MANIFEST.tools`는 11개 문자열.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/bootstrap.manifest.test.mjs`의 마지막 테스트를 아래로 교체하고, 그 뒤에 `settings` 검증을 추가한다:

```js
test('11개 도구의 설정 파일이 모두 선언되어 있다', () => {
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
    '.github/mcp.json',
    '.github/copilot/settings.json',
    '.vscode/mcp.json',
  ]) {
    assert.ok(files.includes(expected), `누락: ${expected}`)
  }
})

test('settings 항목은 path·key·value를 모두 갖는다', () => {
  assert.ok(Array.isArray(MANIFEST.settings) && MANIFEST.settings.length > 0)
  for (const s of MANIFEST.settings) {
    assert.equal(typeof s.path, 'string')
    assert.ok(s.path.trim().length > 0, `빈 경로 금지: ${JSON.stringify(s)}`)
    assert.equal(typeof s.key, 'string')
    assert.ok(s.key.trim().length > 0, `빈 키 금지: ${s.path}`)
    assert.notEqual(s.value, undefined, `${s.path}: value 누락`)
  }
})

test('VS Code가 AGENTS.md를 읽도록 설정 키를 보장한다', () => {
  const entry = MANIFEST.settings.find((s) => s.path === '.vscode/settings.json')
  assert.ok(entry, '.vscode/settings.json 항목이 있어야 한다')
  assert.equal(entry.key, 'chat.useAgentsMdFile')
  assert.equal(entry.value, true)
})
```

같은 파일의 경로 중복 검사 테스트(`경로는 저장소 상대 경로이고 중복이 없다`)에서 `paths` 배열에 `settings` 경로도 포함시킨다:

```js
  const paths = [
    ...MANIFEST.dirs,
    ...MANIFEST.files.map((f) => f.path),
    ...MANIFEST.blocks.map((b) => b.path),
    ...MANIFEST.adapters.map((a) => a.path),
    ...MANIFEST.settings.map((s) => s.path),
  ]
```

`agent-installer/test/bootstrap.flow.test.mjs`에는 다음 테스트를 추가하고, 멱등성 테스트의 액션 목록에 `'insert'`를 넣는다:

```js
test('두 번 실행해도 두 번째는 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const second = runBootstrap(root, { log() {} })

  const created = second.results.filter((r) => ['create', 'append', 'copy', 'insert'].includes(r.action))
  assert.deepEqual(created.map((r) => r.path), [], '멱등하지 않다')
  assert.deepEqual(second.failed, [])
})

test('settings 선언대로 VS Code 설정 키를 넣는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })

  const text = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  assert.deepEqual(JSON.parse(text), { 'chat.useAgentsMdFile': true })
})

test('기존 .vscode/settings.json의 다른 키를 보존한다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '{\n  "editor.tabSize": 2\n}\n')

  runBootstrap(root, { log() {} })

  const parsed = JSON.parse(readFileSync(join(root, '.vscode/settings.json'), 'utf8'))
  assert.equal(parsed['editor.tabSize'], 2)
  assert.equal(parsed['chat.useAgentsMdFile'], true)
})
```

`bootstrap.flow.test.mjs` 상단 import에 `mkdirSync`를 추가한다:

```js
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.manifest.test.mjs test/bootstrap.flow.test.mjs`
Expected: FAIL — `MANIFEST.settings`가 undefined, `.github/mcp.json` 누락

- [ ] **Step 3: 템플릿을 추가한다**

`agent-installer/lib/bootstrap/templates.mjs`의 `KIMI_MCP_CONFIG` 아래에 추가한다:

```js
export const COPILOT_MCP_CONFIG = `{
  "mcpServers": {}
}`

// 모델·추론 강도·컨텍스트 티어를 저장소 단위로 고정하는 공유 설정 자리.
// 구체적인 값은 팀이 정한다. 개인 오버라이드는 settings.local.json이며
// .gitignore 대상이다.
export const COPILOT_SETTINGS = `{}`

// VS Code는 최상위 키가 servers다 (Copilot CLI의 mcpServers와 다르다).
export const VSCODE_MCP_CONFIG = `{
  "servers": {}
}`
```

같은 파일의 `SKILL_README` 마지막 문단을 교체한다:

```js
Claude Code, Kiro, and Grok Build receive these skills through project-local
adapters at \`.claude/skills\`, \`.kiro/skills\`, and \`.grok/skills\`. Codex,
Gemini CLI, OpenCode, Kilo Code, Kimi Code, Antigravity, GitHub Copilot CLI,
and VS Code Copilot discover \`.agents/skills\` directly.`
```

`AGENT_KIT_README`의 마지막 두 항목을 교체한다:

```js
- expose \`.agents/skills\` to Claude Code, Kiro, and Grok Build through
  local adapters;
- add \`chat.useAgentsMdFile\` to \`.vscode/settings.json\` only when the key
  is absent, so VS Code Copilot reads the shared \`AGENTS.md\`;
- rely on the native support of Kilo Code, Kimi Code, Antigravity, GitHub
  Copilot CLI, and VS Code Copilot for \`AGENTS.md\` and \`.agents/skills\`.`
```

- [ ] **Step 4: 매니페스트를 확장한다**

`agent-installer/lib/bootstrap/manifest.mjs`를 아래 내용으로 교체한다:

```js
import {
  AGENTS_TEMPLATE, CLAUDE_BLOCK, GEMINI_BLOCK, SKILL_README, EXAMPLE_SKILL,
  AGENT_KIT_README, CLAUDE_SETTINGS, CODEX_CONFIG, GEMINI_SETTINGS, GROK_CONFIG,
  OPENCODE_CONFIG, KILO_CONFIG, KIRO_MCP_CONFIG, KIMI_MCP_CONFIG,
  COPILOT_MCP_CONFIG, COPILOT_SETTINGS, VSCODE_MCP_CONFIG,
} from './templates.mjs'

// 저장소 부트스트랩이 만들 대상 선언.
// 도구 추가 = dirs 한 줄 + files 한 줄. 실행 로직은 apply.mjs·adapter.mjs에 있다.
export const MANIFEST = {
  // 완료 리포트에 그대로 나열되는 도구 이름. 순서가 출력 순서다.
  tools: [
    'Claude Code', 'Codex', 'Gemini CLI', 'OpenCode', 'Kilo Code',
    'Kiro', 'Kimi Code', 'Grok Build', 'Antigravity',
    'GitHub Copilot CLI', 'VS Code Copilot',
  ],

  dirs: [
    '.agents/skills', '.agent-kit', '.claude', '.codex',
    '.gemini', '.grok', '.kiro/settings', '.kimi-code',
    '.github/copilot', '.vscode',
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
    { path: '.github/mcp.json', template: COPILOT_MCP_CONFIG },
    { path: '.github/copilot/settings.json', template: COPILOT_SETTINGS },
    { path: '.vscode/mcp.json', template: VSCODE_MCP_CONFIG },
  ],

  // 마커가 없을 때만 덧붙인다. 파일이 없으면 블록만으로 생성한다.
  blocks: [
    { path: 'CLAUDE.md', block: CLAUDE_BLOCK },
    { path: 'GEMINI.md', block: GEMINI_BLOCK },
  ],

  // 기존 파일을 보존한 채 최상위 키만 보장한다. 키가 이미 있으면 손대지 않는다.
  // VS Code Copilot은 이 키가 있어야 루트 AGENTS.md를 읽는다.
  settings: [
    { path: '.vscode/settings.json', key: 'chat.useAgentsMdFile', value: true },
  ],

  // .agents/skills 를 가리키는 도구별 어댑터
  // 두 Copilot은 .agents/skills를 네이티브로 탐색하므로 여기에 없다.
  adapters: [
    { tool: 'Claude Code', path: '.claude/skills' },
    { tool: 'Kiro', path: '.kiro/skills' },
    { tool: 'Grok Build', path: '.grok/skills' },
  ],

  // !.vscode/mcp.json은 널리 쓰이는 VisualStudio.gitignore가 .vscode/*를
  // 무시하기 때문에 필요하다. 부정 항목이 없으면 팀 공유가 깨진다.
  // .vscode/*가 없는 저장소에서는 무해한 no-op이다.
  ignore: [
    '.claude/skills', '.kiro/skills', '.grok/skills', '.kimi-code/local.toml',
    '.github/copilot/settings.local.json', '!.vscode/mcp.json',
  ],
}
```

- [ ] **Step 5: flow에 배선한다**

`agent-installer/lib/bootstrap/flow.mjs:4`의 import를 바꾼다:

```js
import { ensureBlocks, ensureDirs, ensureFiles, ensureIgnore, ensureJsonKeys } from './apply.mjs'
```

`flow.mjs:22-26`의 results 배열을 바꾼다. `settings`가 없는 커스텀 매니페스트(테스트용)도 받아들이도록 `?? []`로 방어한다:

```js
  const results = [
    ...ensureDirs(root, manifest.dirs, ctx),
    ...ensureFiles(root, manifest.files, ctx),
    ...ensureJsonKeys(root, manifest.settings ?? [], ctx),
    ...ensureBlocks(root, manifest.blocks, ctx),
  ]
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

Run: `cd agent-installer && npm test`
Expected: PASS — 전체 통과

- [ ] **Step 7: 실제 저장소에서 dry-run으로 확인한다**

Run: `node agent-installer/install.mjs bootstrap --dry-run`
Expected: `.github/mcp.json`·`.github/copilot/settings.json`·`.vscode/mcp.json` 생성 예정으로 나오고, 이미 존재하는 `.vscode/settings.json`에는 `설정 키 추가: .vscode/settings.json — chat.useAgentsMdFile`이 출력된다. 완료 요약의 `적용 도구:` 줄에 두 Copilot이 포함된다.

- [ ] **Step 8: 커밋한다**

```bash
git add agent-installer/lib/bootstrap/ agent-installer/test/bootstrap.manifest.test.mjs agent-installer/test/bootstrap.flow.test.mjs
git commit -F - <<'EOF'
feat(bootstrap): GitHub Copilot 두 형태를 대상에 추가

Copilot CLI와 VS Code Copilot의 프로젝트 파일 3개를 만들고,
VS Code가 AGENTS.md를 읽도록 chat.useAgentsMdFile 키를 보장한다.
두 도구 모두 .agents/skills를 네이티브로 읽어 어댑터는 없다.
.vscode/mcp.json은 VisualStudio.gitignore에 가려지므로 부정
항목으로 되살린다.
EOF
```

---

## Task 3: MCP 등록 대상 2개 추가

설치기의 MCP 항목이 두 Copilot의 프로젝트 설정에도 등록되게 한다.

**Files:**
- Modify: `agent-installer/lib/clis.mjs` (`grok` 엔트리 뒤)
- Test: `agent-installer/test/clis.test.mjs` (파일 끝)

**Interfaces:**
- Consumes: `jsonAdapter(relFile, topKey, toEntry)` — `clis.mjs` 안에 이미 있다. 서버 객체는 `{ kind: 'http', url }` 또는 `{ kind: 'stdio', command, args }`.
- Produces: `CLIS.copilot`, `CLIS.vscode` (`label`/`has`/`add`/`remove`). `CLI_IDS`가 10개가 되며 `defineMcp`의 기본 `supports`가 자동으로 확장된다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/clis.test.mjs` 끝에 추가한다:

```js
test('copilot은 .github/mcp.json에 mcpServers + type:local을 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.copilot.add(repo, 'n', HTTP)
  CLIS.copilot.add(repo, 'c', STDIO)

  const servers = readJson(join(repo, '.github/mcp.json')).mcpServers
  assert.equal(servers.n.type, 'http')
  assert.equal(servers.n.url, HTTP.url)
  assert.equal(servers.c.type, 'local')
  assert.equal(servers.c.command, 'codebase-memory-mcp')
})

test('vscode는 .vscode/mcp.json에 servers 키 + type:stdio를 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.vscode.add(repo, 'n', HTTP)
  CLIS.vscode.add(repo, 'c', STDIO)

  const data = readJson(join(repo, '.vscode/mcp.json'))
  assert.equal(data.mcpServers, undefined, 'VS Code는 mcpServers가 아니라 servers를 쓴다')
  assert.equal(data.servers.n.type, 'http')
  assert.equal(data.servers.c.type, 'stdio')
  assert.deepEqual(data.servers.c.args, [])
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd agent-installer && node --test test/clis.test.mjs`
Expected: FAIL — `Cannot read properties of undefined (reading 'add')`

- [ ] **Step 3: 구현을 쓴다**

`agent-installer/lib/clis.mjs`의 `grok` 엔트리 뒤(`CLIS` 객체 안 마지막)에 추가한다:

```js
  copilot: {
    label: 'GitHub Copilot CLI',
    // Copilot CLI는 루트 .mcp.json도 읽지만(같은 이름이면 그쪽이 우선),
    // 도구마다 자기 파일을 갖는 이 저장소의 패턴을 따라 .github/mcp.json에 쓴다.
    ...jsonAdapter('.github/mcp.json', 'mcpServers', (s) =>
      s.kind === 'http'
        ? { type: 'http', url: s.url }
        : { type: 'local', command: s.command, args: s.args }),
  },
  vscode: {
    label: 'VS Code Copilot',
    // VS Code는 최상위 키가 servers이고 로컬 서버 타입이 stdio다.
    ...jsonAdapter('.vscode/mcp.json', 'servers', (s) =>
      s.kind === 'http'
        ? { type: 'http', url: s.url }
        : { type: 'stdio', command: s.command, args: s.args }),
  },
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `cd agent-installer && npm test`
Expected: PASS — `CLI_IDS` 루프가 도는 roundtrip 테스트 2개가 늘어나고 전부 통과

- [ ] **Step 5: 설치기 목록에서 확인한다**

Run: `node agent-installer/install.mjs --list`
Expected: MCP 항목들이 정상 출력된다(이미 설치된 항목이 있으면 `(일부 설치됨)`으로 표시될 수 있다 — 새 CLI 두 곳이 아직 비어 있기 때문이며 정상이다)

- [ ] **Step 6: 커밋한다**

```bash
git add agent-installer/lib/clis.mjs agent-installer/test/clis.test.mjs
git commit -F - <<'EOF'
feat(installer): MCP 등록 대상에 Copilot 두 곳 추가

Copilot CLI는 .github/mcp.json의 mcpServers에, VS Code는
.vscode/mcp.json의 servers에 등록한다. 로컬 서버 타입 표기가
각각 local과 stdio로 다르다.
EOF
```

---

## Task 4: 문서 갱신

**Files:**
- Modify: `AgentSetup-README.md` (7곳)
- Modify: `README.md:3-5`
- Modify: `AgentSetup-README-CHANGES.md` (맨 위에 항목 추가)
- Modify: `.agent-kit/README.md`, `.agents/skills/README.md` (템플릿과 동일하게 맞춘다)

**Interfaces:**
- Consumes: Task 2에서 정한 파일 경로와 도구 이름 문자열
- Produces: 없음(문서)

- [ ] **Step 1: `AgentSetup-README.md`를 갱신한다**

① 소개 문단(3-6행)을 교체한다:

```markdown
Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code,
Grok Build(xAI grok CLI), Antigravity(Google 에이전트 IDE/CLI),
GitHub Copilot CLI, VS Code Copilot을 한 저장소에서 함께 사용할 때 공통
지침과 공통 Agent Skills를 **저장소 범위로만** 초기화하는 스크립트입니다.
```

② 생성되는 구조 트리에 항목을 추가한다(`.gemini/` 앞에 `.github/`, 끝에 `.vscode/`):

```text
├─ .gemini/
│  └─ settings.json
├─ .github/
│  ├─ mcp.json
│  └─ copilot/
│     └─ settings.json
├─ .grok/
```

```text
├─ .vscode/
│  ├─ mcp.json
│  └─ settings.json      # chat.useAgentsMdFile 키만 보장
└─ .agent-kit/
   └─ README.md
```

③ "도구별 연결 방식" 목록 끝에 두 항목을 추가한다:

```markdown
- **GitHub Copilot CLI:** 루트 `AGENTS.md`와 `.agents/skills`를 네이티브로
  읽습니다(import 배선·어댑터 불필요). 프로젝트 MCP는 `.github/mcp.json`에
  등록하며, 팀 공유 설정 자리로 `.github/copilot/settings.json`을 만듭니다.
  개인 오버라이드인 `.github/copilot/settings.local.json`은 `.gitignore`에
  추가됩니다.
- **VS Code Copilot:** `.agents/skills`를 네이티브로 읽고, 루트 `AGENTS.md`는
  `.vscode/settings.json`의 `chat.useAgentsMdFile` 키로 켭니다(키가 없을 때만
  추가하고 기존 값은 보존합니다). 프로젝트 MCP는 `.vscode/mcp.json`이며,
  최상위 키가 `servers`로 Copilot CLI와 형식이 다릅니다.
```

④ "안전 원칙" 목록의 gitignore 항목 뒤에 두 줄을 추가한다:

```markdown
- 개인 설정인 `.github/copilot/settings.local.json`도 `.gitignore`에 추가합니다.
- `.vscode/*`를 무시하는 `.gitignore`에서도 `.vscode/mcp.json`이 커밋되도록
  `!.vscode/mcp.json` 부정 항목을 추가합니다.
- `.vscode/settings.json`에는 `chat.useAgentsMdFile` 키가 **없을 때만**
  추가하며, 기존 키·주석·값은 그대로 둡니다.
```

⑤ "기존 파일 처리" 코드 블록에 세 줄을 추가한다:

```text
.github/mcp.json
.github/copilot/settings.json
.vscode/mcp.json
```

⑥ "설치 가능한 항목" 표의 MCP 행에서 `8개 CLI 프로젝트 설정에 동시 등록`을
`10개 CLI 프로젝트 설정에 동시 등록`으로 바꾼다.

⑦ "팀 저장소에 넣을 파일" 코드 블록에 세 줄을 추가한다:

```text
.github/mcp.json
.github/copilot/settings.json
.vscode/mcp.json
```

- [ ] **Step 2: `README.md`를 갱신한다**

3-5행을 교체한다:

```markdown
멀티 CLI 코딩 에이전트(Claude Code, Codex, Gemini CLI, OpenCode,
Kilo Code, Kiro, Kimi Code, Grok Build, Antigravity, GitHub Copilot CLI,
VS Code Copilot)를 한 저장소에서 함께 쓰기 위한 저장소 범위 부트스트랩
스크립트와 선택 항목 설치기입니다.
```

- [ ] **Step 3: `AgentSetup-README-CHANGES.md`에 항목을 추가한다**

3행("최신 항목이 위에 옵니다…") 다음, `## Antigravity 지원 (2026-07-18)` 앞에 넣는다:

```markdown
## GitHub Copilot 지원 (2026-07-29)

- GitHub Copilot CLI와 VS Code Copilot을 지원 도구에 추가. 두 도구 모두
  루트 `AGENTS.md`와 `.agents/skills`를 네이티브로 읽어 import 배선과
  스킬 어댑터가 필요 없음.
- 프로젝트 MCP는 Copilot CLI가 `.github/mcp.json`(`mcpServers`, 로컬 서버는
  `type: "local"`), VS Code가 `.vscode/mcp.json`(`servers`, 로컬 서버는
  `type: "stdio"`). 설치기의 MCP 등록 대상이 8개에서 10개로 늘어남.
- 팀 공유 설정 자리로 `.github/copilot/settings.json`을 만들고, 개인
  오버라이드 `.github/copilot/settings.local.json`은 `.gitignore` 처리.
- VS Code는 `chat.useAgentsMdFile` 설정이 있어야 `AGENTS.md`를 읽으므로
  `.vscode/settings.json`에 키가 없을 때만 추가(기존 값은 보존).
  이를 위해 부트스트랩에 `ensureJsonKeys` 실행기를 추가 — 외부 의존성
  없이 텍스트 삽입으로 처리해 주석·포맷을 보존함.
- `VisualStudio.gitignore`가 `.vscode/*`를 무시하므로 `!.vscode/mcp.json`
  부정 항목을 함께 추가.
- 클라우드 코딩 에이전트는 범위 밖 — 지침은 `AGENTS.md`로 이미 커버되고,
  MCP는 저장소 파일이 아니라 GitHub 웹 설정에서 구성됨.
```

- [ ] **Step 4: 생성 문서의 저장소 사본을 템플릿과 맞춘다**

`.agents/skills/README.md`의 마지막 문단을 교체한다:

```markdown
Claude Code, Kiro, and Grok Build receive these skills through project-local
adapters at `.claude/skills`, `.kiro/skills`, and `.grok/skills`. Codex,
Gemini CLI, OpenCode, Kilo Code, Kimi Code, Antigravity, GitHub Copilot CLI,
and VS Code Copilot discover `.agents/skills` directly.
```

`.agent-kit/README.md`의 마지막 두 항목을 교체한다(본문 첫 줄 "The bootstrap scripts:"는 그대로 둔다 — 이 저장소 사본의 기존 표현이다):

```markdown
- expose `.agents/skills` to Claude Code, Kiro, and Grok Build through
  local adapters;
- add `chat.useAgentsMdFile` to `.vscode/settings.json` only when the key
  is absent, so VS Code Copilot reads the shared `AGENTS.md`;
- rely on the native support of Kilo Code, Kimi Code, Antigravity, GitHub
  Copilot CLI, and VS Code Copilot for `AGENTS.md` and `.agents/skills`.
```

- [ ] **Step 5: 문서에 남은 옛 숫자·목록이 없는지 확인한다**

Run: `grep -rn "8개 CLI\|9개 도구" --include="*.md" --include="*.mjs" . | grep -v node_modules | grep -v docs/superpowers`
Expected: 출력 없음

- [ ] **Step 6: 커밋한다**

```bash
git add AgentSetup-README.md README.md AgentSetup-README-CHANGES.md .agent-kit/README.md .agents/skills/README.md
git commit -F - <<'EOF'
docs(installer): GitHub Copilot 지원을 문서에 반영

도구 목록, 생성 구조, 도구별 연결 방식, 안전 원칙, 팀 공유 파일
목록에 Copilot CLI와 VS Code Copilot을 추가하고 MCP 등록 대상
수를 10개로 고쳤다. 변경 이력에 근거와 제외 범위를 남겼다.
EOF
```

---

## Task 5: 전체 검증

`AGENTS.md`가 규정한 전체 검증을 수행하고, 결과를 보고한다.

**Files:**
- 변경 없음 (검증만)

**Interfaces:**
- Consumes: Task 1-4의 모든 변경
- Produces: 검증 결과 보고

- [ ] **Step 1: 전체 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS — 실패 0

- [ ] **Step 2: 런처 문법을 검사한다**

Run: `bash -n ./setup-agents.sh`
Expected: 출력 없음(정상)

- [ ] **Step 3: 스크래치 저장소를 만들어 bash 런처를 두 번 돌린다**

```bash
SCRATCH="$(mktemp -d)"
git init -q "$SCRATCH"
cd "$SCRATCH" && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m "Initial commit"
bash /d/sources/github/Agent-Setup/setup-agents.sh
bash /d/sources/github/Agent-Setup/setup-agents.sh
```

Expected: 두 번째 실행 출력에 `파일 생성`·`설정 키 추가`가 없고 `기존 파일 유지`·`설정 키 확인`만 나온다

- [ ] **Step 4: 스크래치 저장소의 git 상태를 확인한다**

```bash
cd "$SCRATCH" && git add -A && git status --short
```

Expected:
- `.github/mcp.json`, `.github/copilot/settings.json`, `.vscode/mcp.json`이 스테이징된다
- `.claude/skills`, `.kiro/skills`, `.grok/skills` 항목은 하나도 없다
- `.github/copilot/settings.local.json`은 생성되지 않는다(존재하지 않음)

- [ ] **Step 5: PowerShell 런처도 스크래치 저장소에서 두 번 돌린다**

```powershell
$scratch = Join-Path ([System.IO.Path]::GetTempPath()) ("scratch-" + [guid]::NewGuid())
New-Item -ItemType Directory $scratch | Out-Null
git init -q $scratch
Set-Location $scratch
pwsh -File D:\sources\github\Agent-Setup\setup-agents.ps1
pwsh -File D:\sources\github\Agent-Setup\setup-agents.ps1
git add -A; git status --short
```

Expected: bash 런처와 동일한 결과(같은 파일 집합, 두 번째 실행은 멱등)

- [ ] **Step 6: 이 저장소 자신에도 적용하고 diff를 확인한다**

Run: `cd /d/sources/github/Agent-Setup && node agent-installer/install.mjs bootstrap && git status --short && git diff .vscode/settings.json`
Expected:
- `.github/mcp.json`, `.github/copilot/settings.json`, `.vscode/mcp.json`이 새로 생기고
- `.vscode/settings.json`에는 `"chat.useAgentsMdFile": true` 한 줄만 추가되며 기존 `github.copilot.chat.commitMessageGeneration.instructions` 블록과 한국어 문자열이 그대로 남는다
- `.gitignore`에 `.github/copilot/settings.local.json`과 `!.vscode/mcp.json`이 추가된다

- [ ] **Step 7: 결과를 커밋한다**

```bash
git add .github .vscode .gitignore
git commit -F - <<'EOF'
chore(repo): Copilot 프로젝트 설정 파일 생성

부트스트랩을 이 저장소에 적용해 .github/mcp.json,
.github/copilot/settings.json, .vscode/mcp.json을 만들고
.vscode/settings.json에 chat.useAgentsMdFile을 추가했다.
EOF
```

- [ ] **Step 8: 검증되지 않은 항목을 보고한다**

다음은 이 계획으로 검증할 수 없는 항목이다. 완료 보고에 명시한다:

- 실제 `copilot` CLI를 설치해 `.github/mcp.json`의 MCP 서버가 붙는지 확인하는 것 (폴더 신뢰 승인이 필요한 대화형 절차)
- 실제 VS Code에서 `AGENTS.md`가 컨텍스트에 들어가는지 확인하는 것
- 위 둘은 공식 문서 규약에 맞춰 파일을 만드는 것까지만 자동 검증했다는 사실을 보고한다

---

## Self-Review

**스펙 커버리지**

| 스펙 요구사항 | 구현 태스크 |
|---|---|
| `tools`에 두 도구 추가 | Task 2 Step 4 |
| `dirs`에 `.github/copilot`·`.vscode` | Task 2 Step 4 |
| `files` 3개 + 템플릿 3개 | Task 2 Step 3-4 |
| `settings` 신규 섹션 | Task 2 Step 4 |
| `ignore` 2개 항목 | Task 2 Step 4 |
| 어댑터 변경 없음 | Task 2 Step 4 (주석으로 명시) |
| `ensureJsonKeys` 계약 6가지 | Task 1 Step 1-3 (create/skip/insert/warn/dry-run/경로 검사) |
| `flow.mjs` 배선 위치 | Task 2 Step 5 |
| `clis.mjs` 2개 엔트리 | Task 3 Step 3 |
| 테스트 계획 5행 | Task 1 Step 1, Task 2 Step 1, Task 3 Step 1 |
| 문서 5종 | Task 4 |
| 전체 검증 절차 | Task 5 |

**타입·이름 일관성**: `ensureJsonKeys`(Task 1 정의 → Task 2 사용), `MANIFEST.settings`의 `{ path, key, value }`(Task 2 정의 → Task 1 테스트의 `SETTING`과 동일 형태), `CLIS.copilot`/`CLIS.vscode`(Task 3 정의 → 기존 `defineMcp`가 `CLI_IDS`로 자동 소비), 액션 문자열 `insert`(Task 1 반환 → Task 2 멱등성 테스트 필터). 모두 일치한다.

**스펙에 있었으나 계획에서 뺀 것**: 없음.
