# 설치 기록과 갱신 엔진 2단계 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 저장소에 커밋되는 설치 기록(`.agent-kit/agent-setup.json`)을 도입해, 한 번 생성된 파일이 절대 갱신되지 않던 상태를 고친다. `update`는 우리가 쓴 그대로인 파일만 새 템플릿으로 바꾸고 사용자가 고친 파일은 드리프트로 보고한다.

**Architecture:** 기록은 "의도", 스캔은 여전히 "실제"다. 갱신 판정 근거는 파일별 해시이며, 해시는 파일을 쓸 때 쓰는 `normalizeBody`를 통과한 문자열에 대해 계산한다. 생성 경로(`ensureFiles`·`ensureBlocks`)는 손대지 않고 갱신 경로(`updateFiles`·`updateBlocks`)를 새로 만든다 — 잘 검증된 생성 경로를 흔들지 않고 4분기 논리를 분리한다.

**Tech Stack:** Node.js 20+, ESM, `node:crypto`(sha256), `node --test`.

**설계 문서:** `docs/superpowers/specs/2026-07-30-npx-distribution-design.md`
**선행 단계:** `docs/superpowers/plans/2026-07-30-npx-publish-phase1.md` (완료, `@rch4com/agent-setup@1.0.0` 발행됨)

**이 계획의 범위:** 스펙 3단계 중 **2단계만** 다룬다. 기존 명령(`bootstrap`·`--list`·`--set`·`design`)은 그대로 두고 `update`·`status`·`--adopt`를 **더한다**. 명령 전면 재편은 3단계다.

## 스펙에서 의도적으로 벗어나는 한 곳

스펙은 "`apply`는 버전 엄격이다 — 실행 중 버전이 `pinnedVersion`과 다르면 아무것도 쓰지 않고 중단한다"고 정했다. 그런데 `apply`는 3단계에 생기는 명령이다.

2단계에서 그 엄격 검사를 `bootstrap`에 붙이면 **기존 사용자의 `npx @rch4com/agent-setup bootstrap`이 오류로 죽는다.** 그것은 파괴적 변경이고 `1.1.0`이라는 마이너 번호와 어긋난다. 그래서 2단계의 `bootstrap`·`update`·`status`는 버전 차이를 **보고만** 하고, 중단은 `apply`가 등장하는 3단계(`2.0.0`)로 넘긴다. 스펙의 의도(고정이 거짓말하지 않게 한다)는 `update`가 성공할 때만 `pinnedVersion`을 갱신하는 것으로 2단계에서도 지켜진다.

## Global Constraints

- Node.js **20 이상**. `engines.node`는 `>=20`을 유지한다.
- ESM 전용. `require`를 새로 쓰지 않는다.
- **부트스트랩 모듈 그래프의 외부 의존성은 0이다.** `test/bootstrap.isolation.test.mjs`가 강제한다. 이 단계에서 새로 만드는 `lib/bootstrap/text.mjs`와 `lib/bootstrap/record.mjs`는 **그 그래프 안에 들어가므로 `node:` 내장 모듈만** 쓸 수 있다. `jsonc-parser`·`smol-toml`을 import하면 테스트가 실패한다.
- `install.mjs`의 **정적 import는 의존성 없는 모듈만** (`install.mjs:10` 주석). 의존성이 필요한 모듈은 `withDeps(() => import(...))`로 동적 로드한다.
- 프로덕션 의존성을 추가하지 않는다(`AGENTS.md` 규칙).
- 테스트는 `node --test`, 파일명 `test/*.test.mjs`.
- **텍스트 비교와 해시는 반드시 `normalizeBody`를 통과한 문자열에 대해 한다.** `.gitattributes:9`가 `* text=auto`라 워킹트리 줄바꿈이 플랫폼마다 다르다. 원시 바이트를 해시하면 Windows 체크아웃에서 모든 파일이 드리프트로 뜬다.
- 기존 파일을 덮어쓰지 않는다는 원칙은 **생성 경로에서 그대로 유지**한다. 갱신은 해시가 일치할 때(= 우리가 쓴 그대로일 때)만 한다.
- 저장소 루트 밖에 쓰지 않는다. 모든 쓰기 경로는 `repoPathStrict`를 지난다.
- 코드 주석은 한국어로, **무엇이 아니라 왜**를 적는다.
- 커밋 메시지는 `.gitmessage.txt` 템플릿을 따른다 — `<type>(<scope>): <subject>`, 제목 50자 이내 한국어, 마침표 없음, 본문 72자 이내.
- 이 단계의 발행 버전은 **`1.1.0`**이다(기능 추가, 기존 명령 유지).

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `lib/bootstrap/text.mjs` | `normalizeBody`와 `hashBody`. 쓰기와 해시가 같은 정규화를 쓰도록 강제하는 단일 출처 | 신규 |
| `lib/bootstrap/record.mjs` | 설치 기록 읽기·쓰기, 실행 중 도구 버전, 관리 파일 해시 수집(채택 규칙) | 신규 |
| `lib/bootstrap/apply.mjs` | `updateFiles`·`updateBlocks` 추가. 기존 `ensureFiles`·`ensureBlocks`는 그대로 | 수정 |
| `lib/bootstrap/flow.mjs` | 배선 후 기록 쓰기, `--adopt`면 배선을 건너뛴다 | 수정 |
| `lib/update.mjs` | `update` 흐름 — 갱신·드리프트 보고·`--force`·워킹트리 검사 | 신규 |
| `lib/status.mjs` | 3자 비교(의도/실제/가용)와 `--json` 직렬화 | 신규 |
| `lib/args.mjs` | `--adopt`·`--force`·`--json` 플래그, `update`·`status` 사용법 | 수정 |
| `install.mjs` | `update`·`status` 라우팅 | 수정 |

`text.mjs`를 따로 두는 이유는 **순환 의존**이다. `record.mjs`는 해시를 계산하려고 `normalizeBody`가 필요하고, `apply.mjs`는 기록을 참조해야 한다. `normalizeBody`가 `apply.mjs`에 남아 있으면 두 모듈이 서로를 import하게 된다. 정규화를 최하위 모듈로 내리면 양쪽이 한 방향으로만 의존한다.

`record.mjs`를 `lib/` 대신 `lib/bootstrap/` 아래 두는 이유는 부트스트랩 흐름이 직접 쓰기 때문이다. 그 자리에 있으면 의존성 0 불변식이 자동으로 적용되어, 나중에 누가 `jsonc-parser`를 끌어와도 격리 테스트가 잡는다.

---

## Task 1: 정규화와 해시의 단일 출처

**Files:**
- Create: `agent-installer/lib/bootstrap/text.mjs`
- Create: `agent-installer/test/text.test.mjs`
- Modify: `agent-installer/lib/bootstrap/apply.mjs:19-30` (비공개 `normalizeBody` 제거, import로 대체)

**Interfaces:**
- Consumes: 없음 (첫 작업)
- Produces: `normalizeBody(text) -> string`, `hashBody(text) -> 'sha256:<hex>'`. Task 2·3·5·6이 이 두 함수를 import한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/text.test.mjs`:

```js
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { hashBody, normalizeBody } from '../lib/bootstrap/text.mjs'

test('normalizeBody: CRLF를 LF로 바꾸고 끝 개행을 하나로 만든다', () => {
  assert.equal(normalizeBody('a\r\nb'), 'a\nb\n')
  assert.equal(normalizeBody('a\nb\n\n\n'), 'a\nb\n')
  assert.equal(normalizeBody('  a\nb  '), 'a\nb\n')
})

test('hashBody: 같은 내용의 LF본과 CRLF본이 같은 해시를 낸다', () => {
  // .gitattributes가 text=auto라 워킹트리 줄바꿈이 플랫폼마다 다르다.
  // 원시 바이트를 해시하면 Windows 체크아웃에서 전부 드리프트로 뜬다.
  const lf = 'line one\nline two\n'
  const crlf = 'line one\r\nline two\r\n'
  assert.equal(hashBody(lf), hashBody(crlf))
})

test('hashBody: 끝 개행 개수와 앞뒤 공백은 해시를 바꾸지 않는다', () => {
  assert.equal(hashBody('x\n'), hashBody('x'))
  assert.equal(hashBody('x\n'), hashBody('\n\nx\n\n'))
})

test('hashBody: 내용이 다르면 해시가 다르고 접두사가 붙는다', () => {
  assert.notEqual(hashBody('a'), hashBody('b'))
  assert.match(hashBody('a'), /^sha256:[0-9a-f]{64}$/)
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/text.test.mjs"`

Expected: FAIL — `Cannot find module ... lib/bootstrap/text.mjs`

- [ ] **Step 3: text.mjs를 만든다**

`agent-installer/lib/bootstrap/text.mjs`:

```js
// 정규화와 해시의 단일 출처.
//
// 파일을 쓸 때와 "우리가 쓴 그대로인가"를 판정할 때 같은 정규화를 써야 한다.
// 둘이 갈리면 갓 쓴 파일조차 드리프트로 보고된다. 그래서 이 모듈을 최하위에
// 두고 apply.mjs(쓰기)와 record.mjs(판정)가 함께 import한다 — 한쪽에만
// 정규화 규칙을 두면 두 모듈이 서로를 import하는 순환이 생긴다.
//
// 부트스트랩 그래프에 속하므로 node: 내장 모듈만 쓴다.
import { createHash } from 'node:crypto'

// 두 OS가 같은 파일을 만들도록 항상 LF + 끝 개행 1개로 정규화한다.
export function normalizeBody(text) {
  return text.replace(/\r\n/g, '\n').trim() + '\n'
}

// 정규화한 내용의 해시. 워킹트리 줄바꿈이 CRLF든 LF든 같은 값이 나온다.
export function hashBody(text) {
  return `sha256:${createHash('sha256').update(normalizeBody(text), 'utf8').digest('hex')}`
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/text.test.mjs"`

Expected: PASS 4건.

- [ ] **Step 5: apply.mjs가 같은 함수를 쓰도록 바꾼다**

`agent-installer/lib/bootstrap/apply.mjs`에서 비공개 `normalizeBody`(19~24행의 주석과 함수)를 지우고 import로 바꾼다. `import { dirname } from 'node:path'` 아래에 추가한다.

```js
import { normalizeBody } from './text.mjs'
```

지우는 대상은 이 블록이다.

```js
// 두 OS가 같은 파일을 만들도록 항상 LF + 끝 개행 1개로 정규화한다.
// writeText(새 파일)와 ensureBlocks의 덧붙이기(기존 파일) 양쪽에서 쓴다 —
// 덧붙이기도 이 정규화를 거치지 않으면 CRLF가 LF 파일에 새어 들어간다.
function normalizeBody(text) {
  return text.replace(/\r\n/g, '\n').trim() + '\n'
}
```

`writeText`와 `ensureBlocks`의 `appendFileSync` 호출은 그대로 둔다 — 같은 이름의 함수를 import로 받으므로 호출부를 고칠 필요가 없다.

- [ ] **Step 6: 전체 테스트로 회귀와 격리를 확인한다**

Run: `cd agent-installer && npm test`

Expected: 전부 PASS. 특히 두 가지를 확인한다.

- `bootstrap.apply.test.mjs` — 쓰기 동작이 바뀌지 않았다(같은 정규화를 쓴다).
- `bootstrap.isolation.test.mjs` — `text.mjs`가 외부 의존성을 끌어오지 않았다.

- [ ] **Step 7: 커밋**

```bash
git add agent-installer/lib/bootstrap/text.mjs agent-installer/lib/bootstrap/apply.mjs agent-installer/test/text.test.mjs
git commit -F- <<'EOF'
add: 정규화와 해시의 단일 출처

파일을 쓸 때와 "우리가 쓴 그대로인가"를 판정할 때 같은 정규화를
써야 한다. 둘이 갈리면 갓 쓴 파일조차 드리프트로 보고된다.

normalizeBody를 apply.mjs에서 최하위 모듈로 내린다 — 한쪽에만
두면 apply와 record가 서로를 import하는 순환이 생긴다.

해시는 정규화 후 계산한다. gitattributes가 text=auto라 워킹트리
줄바꿈이 플랫폼마다 다르고, 원시 바이트를 해시하면 Windows
체크아웃에서 모든 파일이 드리프트로 뜬다.
EOF
```

---

## Task 2: 설치 기록 읽기와 쓰기

**Files:**
- Create: `agent-installer/lib/bootstrap/record.mjs`
- Create: `agent-installer/test/record.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `hashBody`(다음 작업에서 쓴다).
- Produces:
  - `RECORD_REL = '.agent-kit/agent-setup.json'`
  - `FORMAT_VERSION = 1`
  - `toolVersion() -> string` — 실행 중 패키지 버전
  - `emptyRecord({ skillMode }) -> record`
  - `readRecord(root) -> record | null` — 파일이 없으면 `null`, `formatVersion`이 다르면 throw
  - `writeRecord(root, record, { dryRun, log }) -> { ok, action, path }`
  - 기록 형태: `{ formatVersion, pinnedVersion, skillMode, items: string[], design: string[], managed: Record<string, string|null> }`

Task 3이 `managed`를 채우고, Task 4가 `writeRecord`를, Task 6·7이 `readRecord`를 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/record.test.mjs`:

```js
import { strict as assert } from 'node:assert'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  FORMAT_VERSION, RECORD_REL, emptyRecord, readRecord, toolVersion, writeRecord,
} from '../lib/bootstrap/record.mjs'
import { makeCapture, makeTempRepo } from './helpers.mjs'

function putRecord(root, obj) {
  mkdirSync(join(root, '.agent-kit'), { recursive: true })
  writeFileSync(join(root, RECORD_REL), JSON.stringify(obj, null, 2))
}

test('toolVersion: package.json의 버전을 읽는다', () => {
  assert.match(toolVersion(), /^\d+\.\d+\.\d+/)
})

test('기록이 없으면 null이다', () => {
  assert.equal(readRecord(makeTempRepo()), null)
})

test('쓰고 읽으면 같은 값이 돌아온다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const record = emptyRecord({ skillMode: 'copy' })
  record.items = ['mcp.notion']
  record.managed['AGENTS.md'] = 'sha256:abc'

  writeRecord(root, record, { dryRun: false, log: cap.log })
  const back = readRecord(root)

  assert.equal(back.formatVersion, FORMAT_VERSION)
  assert.equal(back.pinnedVersion, toolVersion())
  assert.equal(back.skillMode, 'copy')
  assert.deepEqual(back.items, ['mcp.notion'])
  assert.equal(back.managed['AGENTS.md'], 'sha256:abc')
})

test('dryRun이면 파일을 만들지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  writeRecord(root, emptyRecord({ skillMode: 'auto' }), { dryRun: true, log: cap.log })
  assert.equal(readRecord(root), null)
  // 무엇이 바뀔지는 보고해야 한다 — dry-run이 조용하면 확인 도구가 아니다.
  assert.match(cap.text(), /agent-setup\.json/)
})

test('formatVersion이 다르면 진단 가능한 오류를 던진다', () => {
  const root = makeTempRepo()
  putRecord(root, { formatVersion: 99, pinnedVersion: '1.1.0', managed: {} })
  assert.throws(() => readRecord(root), /형식 버전/)
})

test('깨진 JSON은 진단 가능한 오류를 던진다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.agent-kit'), { recursive: true })
  writeFileSync(join(root, RECORD_REL), '{ not json')
  assert.throws(() => readRecord(root), /읽을 수 없습니다/)
})

test('필드가 없어도 기본값으로 읽힌다', () => {
  // 손으로 편집한 기록이 필드를 빠뜨려도 죽지 않아야 한다.
  const root = makeTempRepo()
  putRecord(root, { formatVersion: FORMAT_VERSION })
  const back = readRecord(root)
  assert.deepEqual(back.items, [])
  assert.deepEqual(back.design, [])
  assert.deepEqual(back.managed, {})
  assert.equal(back.skillMode, 'auto')
})

test('사람이 읽을 수 있게 들여쓰기하고 끝 개행을 둔다', () => {
  const root = makeTempRepo()
  writeRecord(root, emptyRecord({ skillMode: 'auto' }), { dryRun: false, log: makeCapture().log })
  const text = readFileSync(join(root, RECORD_REL), 'utf8')
  // 커밋되어 git diff로 읽는 파일이다. 한 줄 JSON이면 diff가 무의미하다.
  assert.match(text, /\n {2}"formatVersion"/)
  assert.ok(text.endsWith('\n'))
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/record.test.mjs"`

Expected: FAIL — `Cannot find module ... lib/bootstrap/record.mjs`

- [ ] **Step 3: record.mjs를 만든다**

`agent-installer/lib/bootstrap/record.mjs`:

```js
// 저장소에 커밋되는 설치 기록.
//
// 이 파일은 "의도"다 — 실제 상태의 근거는 여전히 스캔이다. 기록이 더하는
// 것은 재현성(팀원이 같은 결과를 얻는다)과 버전 고정, 그리고 "우리가 쓴
// 그대로인가"를 판정할 해시다.
//
// 설치기 안의 manifest.mjs(무엇을 생성할지 선언)와 이름이 겹치지 않게
// 저장소 쪽 파일은 '설치 기록'이라 부른다.
//
// 부트스트랩 그래프에 속하므로 node: 내장 모듈만 쓴다.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'

export const RECORD_REL = '.agent-kit/agent-setup.json'
export const FORMAT_VERSION = 1

// 발행된 패키지에도 package.json은 항상 들어간다(npm이 무조건 포함한다).
// createRequire 대신 URL로 읽어 의존성 0을 유지한다.
let cachedVersion
export function toolVersion() {
  if (!cachedVersion) {
    const url = new URL('../../package.json', import.meta.url)
    cachedVersion = JSON.parse(readFileSync(url, 'utf8')).version
  }
  return cachedVersion
}

export function emptyRecord({ skillMode = 'auto' } = {}) {
  return {
    formatVersion: FORMAT_VERSION,
    pinnedVersion: toolVersion(),
    skillMode,
    items: [],
    design: [],
    managed: {},
  }
}

// 없으면 null. 있으면 필드를 채워 돌려준다 — 손으로 편집해 필드가 빠져도
// 죽지 않아야 한다. 형식 버전이 다르면 추측하지 않고 던진다.
export function readRecord(root) {
  const target = repoPath(root, RECORD_REL)
  let text
  try {
    text = readFileSync(target, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw new Error(`${RECORD_REL}을 읽을 수 없습니다 (${err.code ?? err.message})`)
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    throw new Error(`${RECORD_REL}을 읽을 수 없습니다 — JSON이 아닙니다 (${err.message})`)
  }

  if (parsed.formatVersion !== FORMAT_VERSION) {
    throw new Error(
      `${RECORD_REL}의 형식 버전이 ${parsed.formatVersion}입니다. ` +
      `이 도구는 ${FORMAT_VERSION}을 씁니다 — 도구를 올리거나 기록을 다시 만드세요.`,
    )
  }

  return {
    formatVersion: parsed.formatVersion,
    pinnedVersion: parsed.pinnedVersion ?? null,
    skillMode: parsed.skillMode ?? 'auto',
    items: Array.isArray(parsed.items) ? parsed.items : [],
    design: Array.isArray(parsed.design) ? parsed.design : [],
    managed: parsed.managed && typeof parsed.managed === 'object' ? parsed.managed : {},
  }
}

// pinnedVersion은 여기서 실행 중 버전으로 맞춘다 — 기록을 쓰는 명령만
// 버전을 옮길 수 있어야 고정이 거짓말하지 않는다.
export function writeRecord(root, record, { dryRun = false, log } = {}) {
  const target = repoPathStrict(root, RECORD_REL)
  const body = `${JSON.stringify({ ...record, pinnedVersion: toolVersion() }, null, 2)}\n`
  log?.(`설치 기록 기록: ${RECORD_REL}`)
  if (!dryRun) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body, { encoding: 'utf8' })
  }
  return { ok: true, action: dryRun ? 'skip' : 'write', path: RECORD_REL }
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/record.test.mjs"`

Expected: PASS 8건.

- [ ] **Step 5: 격리 불변식을 확인한다**

Run: `cd agent-installer && node --test "test/bootstrap.isolation.test.mjs"`

Expected: PASS. `record.mjs`가 `node:` 내장과 `../context.mjs`만 import했다.

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/lib/bootstrap/record.mjs agent-installer/test/record.test.mjs
git commit -F- <<'EOF'
add: 설치 기록 읽기와 쓰기

.agent-kit/agent-setup.json을 커밋해 버전 고정과 드리프트 감지의
근거를 만든다. 이 파일은 의도이고, 실제 상태의 근거는 여전히
스캔이다 — 기록이 더하는 것은 재현성과 해시다.

형식 버전이 다르면 추측하지 않고 던진다. 필드가 빠진 기록은
기본값으로 읽어 손으로 편집해도 죽지 않게 한다.

pinnedVersion은 writeRecord만 옮긴다. 아무 명령이나 버전을 쓰면
고정이 거짓말을 하게 된다.
EOF
```

---

## Task 3: 관리 파일 해시 수집 — 채택 규칙

`init`과 `--adopt`가 공유하는 단 하나의 규칙이다. **현재 내용이 실행 중 버전의 템플릿과 정규화 후 일치하는 파일만** 해시를 기록하고, 나머지는 키만 남긴다(값 `null`). 현재 내용을 그대로 해시로 박으면 사용자가 이미 고쳐 둔 파일이 "우리가 쓴 그대로"로 위장되어 다음 `update`에 날아간다.

**Files:**
- Modify: `agent-installer/lib/bootstrap/record.mjs`
- Modify: `agent-installer/test/record.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `hashBody`, Task 2의 모듈. `MANIFEST`의 `files`(`{path, template}[]`)와 `blocks`(`{path, block}[]`).
- Produces:
  - `BLOCK_SUFFIX = '#agent-kit'`
  - `managedKey(rel, isBlock) -> string` — 블록은 `'CLAUDE.md#agent-kit'`
  - `extractBlock(text) -> string | null` — 마커 사이 본문. 마커가 없으면 `null`
  - `collectManaged(root, manifest) -> Record<string, string|null>`

Task 4가 `collectManaged`를, Task 6이 `extractBlock`·`managedKey`를 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/record.test.mjs` 끝에 추가한다. 파일 위쪽 import에 `collectManaged, extractBlock, managedKey`를 더한다.

```js
test('extractBlock: 마커 사이 본문만 돌려준다', () => {
  const text = '사용자 서문\n\n<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->\n뒷말\n'
  assert.equal(extractBlock(text), '@AGENTS.md\n')
  assert.equal(extractBlock('마커 없는 파일\n'), null)
})

test('managedKey: 블록은 접미사로 파일 전체와 구분한다', () => {
  assert.equal(managedKey('AGENTS.md', false), 'AGENTS.md')
  assert.equal(managedKey('CLAUDE.md', true), 'CLAUDE.md#agent-kit')
})

test('collectManaged: 템플릿과 일치하는 파일만 해시를 남긴다', () => {
  const root = makeTempRepo()
  const manifest = {
    files: [
      { path: 'same.md', template: '내용\n' },
      { path: 'edited.md', template: '내용\n' },
      { path: 'missing.md', template: '내용\n' },
    ],
    blocks: [],
  }
  writeFileSync(join(root, 'same.md'), '내용\n')
  writeFileSync(join(root, 'edited.md'), '사용자가 고친 내용\n')

  const managed = collectManaged(root, manifest)

  assert.equal(managed['same.md'], hashBody('내용\n'))
  // 고친 파일에 해시를 박으면 다음 update가 사용자 수정을 날려버린다.
  assert.equal(managed['edited.md'], null)
  // 없는 파일도 관리 대상이다 — update가 생성 분기로 처리한다.
  assert.equal(managed['missing.md'], null)
})

test('collectManaged: CRLF로 체크아웃된 파일도 일치로 본다', () => {
  const root = makeTempRepo()
  const manifest = { files: [{ path: 'a.md', template: 'x\ny\n' }], blocks: [] }
  writeFileSync(join(root, 'a.md'), 'x\r\ny\r\n')
  assert.equal(collectManaged(root, manifest)['a.md'], hashBody('x\ny\n'))
})

test('collectManaged: 블록은 마커 사이 본문으로 비교한다', () => {
  const root = makeTempRepo()
  const block = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'
  const manifest = { files: [], blocks: [{ path: 'CLAUDE.md', block }] }
  // 사용자 본문이 앞뒤에 있어도 블록 본문이 같으면 일치다.
  writeFileSync(join(root, 'CLAUDE.md'), `내 메모\n\n${block}\n`)

  const managed = collectManaged(root, manifest)
  assert.equal(managed['CLAUDE.md#agent-kit'], hashBody('@AGENTS.md\n'))
})

test('collectManaged: 블록 안쪽을 고치면 채택하지 않는다', () => {
  const root = makeTempRepo()
  const block = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'
  const manifest = { files: [], blocks: [{ path: 'CLAUDE.md', block }] }
  writeFileSync(join(root, 'CLAUDE.md'),
    '<!-- agent-kit:begin -->\n@AGENTS.md\n내가 넣은 줄\n<!-- agent-kit:end -->\n')

  assert.equal(collectManaged(root, manifest)['CLAUDE.md#agent-kit'], null)
})
```

파일 위쪽 import에 `hashBody`도 더한다.

```js
import { hashBody } from '../lib/bootstrap/text.mjs'
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/record.test.mjs"`

Expected: FAIL 6건 — `collectManaged`·`extractBlock`·`managedKey`가 export되지 않았다.

- [ ] **Step 3: record.mjs에 세 함수를 더한다**

`record.mjs` 위쪽 import에 `hashBody`를 더한다.

```js
import { hashBody, normalizeBody } from './text.mjs'
```

파일 끝에 추가한다.

```js
// 마커는 apply.mjs의 ensureBlocks(생성)와 updateBlocks(갱신), 그리고 여기의
// extractBlock(판정)이 함께 쓴다. 정의가 둘로 갈리면 한쪽만 고치는 회귀가
// 생기므로 이 모듈이 단일 출처가 되고 apply.mjs가 import한다.
export const BEGIN_MARKER = '<!-- agent-kit:begin -->'
export const END_MARKER = '<!-- agent-kit:end -->'

// 블록은 파일 전체가 아니라 마커 사이 본문만 관리 대상이다. 파일 전체 해시와
// 섞이지 않게 키에 접미사를 붙인다.
export const BLOCK_SUFFIX = '#agent-kit'

export function managedKey(rel, isBlock) {
  return isBlock ? `${rel}${BLOCK_SUFFIX}` : rel
}

// 마커 사이 본문을 정규화해 돌려준다. 마커가 없거나 순서가 뒤집혀 있으면 null.
export function extractBlock(text) {
  const begin = text.indexOf(BEGIN_MARKER)
  if (begin === -1) return null
  const end = text.indexOf(END_MARKER, begin + BEGIN_MARKER.length)
  if (end === -1) return null
  return normalizeBody(text.slice(begin + BEGIN_MARKER.length, end))
}

function readOrNull(root, rel) {
  try {
    return readFileSync(repoPath(root, rel), 'utf8')
  } catch {
    return null
  }
}

// 채택 규칙: 현재 내용이 이 버전의 템플릿과 정규화 후 일치하는 것만 해시를
// 남긴다. 그러지 않으면 사용자가 이미 고쳐 둔 파일이 "우리가 쓴 그대로"로
// 위장되어 다음 update에 날아간다. 값이 null인 키는 update가 절대 덮어쓰지
// 않으며, 없는 파일도 키를 남겨 update의 생성 분기가 집어간다.
export function collectManaged(root, manifest) {
  const managed = {}

  for (const { path: rel, template } of manifest.files ?? []) {
    const text = readOrNull(root, rel)
    const wanted = hashBody(template)
    managed[rel] = text !== null && hashBody(text) === wanted ? wanted : null
  }

  for (const { path: rel, block } of manifest.blocks ?? []) {
    const text = readOrNull(root, rel)
    const wanted = hashBody(extractBlock(block) ?? block)
    const current = text === null ? null : extractBlock(text)
    managed[managedKey(rel, true)] = current !== null && hashBody(current) === wanted ? wanted : null
  }

  return managed
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/record.test.mjs"`

Expected: PASS 14건.

- [ ] **Step 5: 실제 매니페스트로 손검증한다**

이 저장소는 스스로 부트스트랩된 상태라 관리 파일이 전부 있다. 채택이 실제 파일에서 어떻게 나오는지 눈으로 본다.

Run:

```bash
cd agent-installer && node -e "
const { MANIFEST } = await import('./lib/bootstrap/manifest.mjs')
const { collectManaged } = await import('./lib/bootstrap/record.mjs')
const m = collectManaged(process.cwd() + '/..', MANIFEST)
const adopted = Object.entries(m).filter(([, v]) => v).length
console.log('전체', Object.keys(m).length, '· 채택', adopted, '· 미채택', Object.keys(m).length - adopted)
for (const [k, v] of Object.entries(m)) if (!v) console.log('  미채택:', k)
"
```

Expected: 전체 17개(`files` 15 + `blocks` 2). 이 저장소의 `AGENTS.md`·`CLAUDE.md`는 프로젝트 고유 내용이라 미채택으로 나오는 것이 **정상**이다. 채택이 0이면 정규화나 키 계산이 잘못된 것이므로 멈추고 원인을 찾는다.

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/lib/bootstrap/record.mjs agent-installer/test/record.test.mjs
git commit -F- <<'EOF'
add: 관리 파일 해시 수집과 채택 규칙

init과 --adopt가 공유하는 단 하나의 규칙이다. 현재 내용이 이 버전의
템플릿과 정규화 후 일치하는 파일만 해시를 남기고 나머지는 키만
남긴다.

현재 내용을 그대로 해시로 박으면 사용자가 이미 고쳐 둔 파일이
"우리가 쓴 그대로"로 위장되어 다음 update에 날아간다.

블록은 파일 전체가 아니라 마커 사이 본문으로 비교한다 — 주변
사용자 본문이 무엇이든 관리 영역만 판정 대상이다.
EOF
```

---

## Task 4: bootstrap이 기록을 남기고 `--adopt`를 받는다

**Files:**
- Modify: `agent-installer/lib/bootstrap/flow.mjs`
- Modify: `agent-installer/lib/args.mjs` (`BOOTSTRAP_SPEC`, `parseBootstrapArgs`, `BOOTSTRAP_USAGE`)
- Modify: `agent-installer/test/bootstrap.flow.test.mjs`
- Modify: `agent-installer/test/args.test.mjs`

**Interfaces:**
- Consumes: Task 2의 `emptyRecord`·`readRecord`·`writeRecord`·`toolVersion`, Task 3의 `collectManaged`.
- Produces: `runBootstrap(root, { dryRun, skillMode, adopt, log, manifest })`. `adopt: true`면 배선을 건너뛰고 기록만 만든다. 반환값에 `record`가 더해진다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/args.test.mjs`에 추가한다.

```js
test('parseBootstrapArgs: --adopt를 받는다', () => {
  assert.equal(parseBootstrapArgs(['--adopt']).adopt, true)
  assert.equal(parseBootstrapArgs([]).adopt, false)
  // 값을 받는 플래그가 아니다.
  assert.throws(() => parseBootstrapArgs(['--adopt=x']), /값을 줄 수 없습니다/)
})
```

`agent-installer/test/bootstrap.flow.test.mjs`에 추가한다. 파일 위쪽 import에 `readRecord`, `toolVersion`을 더한다.

```js
test('bootstrap이 설치 기록을 남긴다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })

  const record = readRecord(root)
  assert.equal(record.pinnedVersion, toolVersion())
  assert.equal(record.skillMode, 'auto')
  // 갓 만든 파일은 정의상 템플릿과 같으므로 전부 채택된다.
  const values = Object.values(record.managed)
  assert.ok(values.length >= 17, `관리 항목이 ${values.length}개뿐이다`)
  assert.equal(values.filter((v) => v === null).length, 0, '갓 만든 파일이 미채택으로 잡혔다')
})

test('bootstrap 재실행은 기록을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  const first = readFileSync(join(root, RECORD_REL), 'utf8')
  runBootstrap(root, { log: () => {} })
  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), first)
})

test('--adopt는 파일을 만들지 않고 기록만 만든다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { adopt: true, log: () => {} })

  assert.equal(existsSync(join(root, 'AGENTS.md')), false, 'adopt가 파일을 만들었다')
  const record = readRecord(root)
  assert.ok(record, '기록이 없다')
  // 파일이 없으니 채택된 것도 없어야 한다.
  assert.equal(Object.values(record.managed).filter((v) => v).length, 0)
})

test('--adopt는 템플릿과 같은 파일만 채택한다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })            // 정상 배선
  writeFileSync(join(root, 'AGENTS.md'), '팀이 고친 지침\n')
  runBootstrap(root, { adopt: true, log: () => {} })

  const record = readRecord(root)
  assert.equal(record.managed['AGENTS.md'], null, '고친 파일이 채택됐다')
  assert.ok(record.managed['.codex/config.toml'], '손대지 않은 파일이 미채택됐다')
})

test('dry-run은 기록도 쓰지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { dryRun: true, log: () => {} })
  assert.equal(readRecord(root), null)
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/args.test.mjs" "test/bootstrap.flow.test.mjs"`

Expected: FAIL — `adopt`가 `undefined`이고 기록이 만들어지지 않는다.

- [ ] **Step 3: args.mjs에 --adopt를 더한다**

`BOOTSTRAP_SPEC`에 한 줄을 더한다.

```js
const BOOTSTRAP_SPEC = { ...HELP_SPEC, '--dry-run': 'bool', '--adopt': 'bool', '--skill-mode': 'value' }
```

`parseBootstrapArgs`의 두 반환 지점에 `adopt`를 더한다.

```js
export function parseBootstrapArgs(argv) {
  if (wantsHelp(argv)) return { dryRun: false, skillMode: 'auto', adopt: false, help: true }
  assertKnownArgs(argv, BOOTSTRAP_SPEC, BOOTSTRAP_USAGE)
  return {
    dryRun: argv.includes('--dry-run'),
    adopt: argv.includes('--adopt'),
    skillMode: parseSkillMode(argv, BOOTSTRAP_USAGE),
    help: false,
  }
}
```

`BOOTSTRAP_USAGE`의 옵션 목록에서 `--dry-run` 줄 위에 넣는다.

```
  --adopt                      파일을 만들지 않고, 이미 있는 파일 중 이 버전의
                               템플릿과 같은 것만 관리 대상으로 기록합니다.
```

- [ ] **Step 4: flow.mjs가 기록을 쓰게 한다**

import에 record 모듈을 더한다.

```js
import { collectManaged, emptyRecord, readRecord, writeRecord } from './record.mjs'
```

`runBootstrap`의 옵션 구조 분해에 `adopt`를 더하고, 배선 블록과 완료 보고 사이를 이렇게 바꾼다.

```js
export function runBootstrap(root, opts = {}) {
  const { dryRun = false, skillMode = 'auto', adopt = false, log = console.log, manifest = MANIFEST } = opts

  if (!SKILL_MODES.includes(skillMode)) {
    throw new Error(`--skill-mode는 ${SKILL_MODES.join(', ')} 중 하나여야 합니다: ${skillMode}`)
  }

  const say = (message) => log(`[agent-setup] ${message}`)
  const ctx = { dryRun, log: say }

  say(`저장소 루트: ${root}`)
  say('글로벌 설정 경로는 읽거나 수정하지 않습니다.')

  // --adopt는 이미 있는 저장소를 기록 체계로 끌어오는 용도라 파일을 만들지
  // 않는다. 벤더링해서 쓰던 저장소가 여기로 들어온다.
  const results = adopt ? [] : [
    ...ensureDirs(root, manifest.dirs, ctx),
    ...ensureFiles(root, manifest.files, ctx),
    ...ensureJsonKeys(root, manifest.settings ?? [], ctx),
    ...ensureBlocks(root, manifest.blocks, ctx),
  ]

  if (!adopt) {
    // 어댑터는 항목별로 실패를 격리한다 — 하나가 실패해도 나머지를 계속한다.
    for (const entry of manifest.adapters) {
      try {
        results.push(configureAdapter(root, entry, { ...ctx, skillMode }))
      } catch (err) {
        results.push({ ok: false, action: 'link', path: entry.path, message: err.message })
      }
    }
    results.push(...ensureIgnore(root, manifest.ignore, ctx))
  }

  // 기존 기록의 items·design은 보존한다 — 부트스트랩은 배선만 다루므로
  // 사용자가 고른 설치 항목을 지울 권한이 없다.
  const previous = dryRun ? null : readRecord(root)
  const record = {
    ...emptyRecord({ skillMode }),
    items: previous?.items ?? [],
    design: previous?.design ?? [],
    managed: collectManaged(root, manifest),
  }
  results.push(writeRecord(root, record, ctx))

  const failed = results.filter((r) => !r.ok)
  ...
```

완료 보고의 마지막 줄 뒤에 한 줄을 더한다.

```js
  say(`설치 기록: ${RECORD_REL}`)
```

`RECORD_REL`도 import 목록에 더한다. 반환값에 `record`를 더한다.

```js
  return { results, failed, record }
```

**중요:** `collectManaged`는 실제 파일을 읽으므로 `dryRun`일 때는 아직 파일이 없어 전부 `null`이 된다. `writeRecord`가 `dryRun`에서 쓰지 않으므로 문제가 되지 않지만, `readRecord`를 `dryRun`에서 부르지 않는 이유는 **깨진 기록이 dry-run을 죽이지 않게** 하기 위해서다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/args.test.mjs" "test/bootstrap.flow.test.mjs"`

Expected: PASS.

- [ ] **Step 6: 전체 테스트와 실제 실행을 확인한다**

Run: `cd agent-installer && npm test`

Expected: 전부 PASS.

스크래치 저장소에서 실제로 돌려 기록이 커밋 대상으로 잡히는지 본다.

```bash
D=$(mktemp -d) && git -C "$D" init -q && (cd "$D" && node /d/Sources/github/Agent-Setup/agent-installer/install.mjs bootstrap >/dev/null) && git -C "$D" add -A && git -C "$D" status --short | grep agent-setup.json
```

Expected: `A  .agent-kit/agent-setup.json` — 기록은 커밋되어야 팀원이 같은 결과를 얻는다.

- [ ] **Step 7: 커밋**

```bash
git add agent-installer/lib/bootstrap/flow.mjs agent-installer/lib/args.mjs agent-installer/test/args.test.mjs agent-installer/test/bootstrap.flow.test.mjs
git commit -F- <<'EOF'
feat(installer): bootstrap이 설치 기록을 남기고 --adopt를 받는다

배선 후 관리 파일 해시를 기록해 이후 update가 갱신 대상을 판정할
근거를 만든다. 갓 만든 파일은 정의상 템플릿과 같으므로 전부
채택된다.

--adopt는 파일을 만들지 않고 기록만 만든다. 벤더링해서 쓰던
저장소를 기록 체계로 끌어오는 용도이며, 템플릿과 같은 파일만
채택해 이미 고쳐 둔 파일을 보호한다.

items·design은 기존 기록에서 보존한다 — 부트스트랩은 배선만
다루므로 사용자가 고른 설치 항목을 지울 권한이 없다.
EOF
```

---

## Task 5: 갱신 프리미티브 — updateFiles와 updateBlocks

생성 경로(`ensureFiles`·`ensureBlocks`)는 손대지 않는다. 잘 검증된 "덮어쓰지 않는다"는 계약을 흔들지 않고, 4분기 논리를 별도 함수로 분리한다.

**Files:**
- Modify: `agent-installer/lib/bootstrap/apply.mjs`
- Create: `agent-installer/test/bootstrap.update.test.mjs`

**Interfaces:**
- Consumes: Task 1의 `normalizeBody`·`hashBody`, Task 3의 `extractBlock`·`managedKey`.
- Produces:
  - `updateFiles(root, files, { managed, dryRun, force, log }) -> results[]`
  - `updateBlocks(root, blocks, { managed, dryRun, force, log }) -> results[]`
  - 결과 `action`: `'update'`(교체) · `'create'`(없어서 생성) · `'drift'`(사용자 수정, 건드리지 않음) · `'skip'`(이미 최신) · `'warn'`(읽기 실패)
  - 각 결과에 `hash` 필드를 담는다 — 호출자가 기록을 갱신할 때 쓴다. `drift`는 `hash`를 담지 않는다.

Task 6이 두 함수를 호출하고 결과의 `hash`로 기록을 갱신한다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/bootstrap.update.test.mjs`:

```js
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { updateBlocks, updateFiles } from '../lib/bootstrap/apply.mjs'
import { hashBody } from '../lib/bootstrap/text.mjs'
import { makeCapture, makeTempRepo } from './helpers.mjs'

const OLD = '옛 템플릿\n'
const NEW = '새 템플릿\n'

function runFiles(root, managed, opts = {}) {
  return updateFiles(root, [{ path: 'a.md', template: NEW }], {
    managed, log: makeCapture().log, ...opts,
  })
}

test('해시가 일치하면 새 템플릿으로 교체한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), OLD)
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) })

  assert.equal(r.action, 'update')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), NEW)
  assert.equal(r.hash, hashBody(NEW))
})

test('CRLF로 체크아웃된 파일도 일치로 보고 교체한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), '옛 템플릿\r\n')
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) })
  assert.equal(r.action, 'update')
})

test('해시가 다르면 건드리지 않고 드리프트로 보고한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), '사용자가 고친 내용\n')
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) })

  assert.equal(r.action, 'drift')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), '사용자가 고친 내용\n')
  assert.equal(r.hash, undefined, '드리프트가 해시를 돌려주면 기록이 오염된다')
})

test('기록에 해시가 없으면 출처 불명이라 건드리지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), OLD)
  const [r] = runFiles(root, { 'a.md': null })
  assert.equal(r.action, 'drift')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), OLD)
})

test('파일이 없으면 새로 만든다 — 새 도구 지원이 이 경로로 들어온다', () => {
  const root = makeTempRepo()
  const [r] = runFiles(root, {})
  assert.equal(r.action, 'create')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), NEW)
  assert.equal(r.hash, hashBody(NEW))
})

test('이미 새 템플릿과 같으면 아무것도 하지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), NEW)
  const [r] = runFiles(root, { 'a.md': hashBody(NEW) })
  assert.equal(r.action, 'skip')
  assert.equal(r.hash, hashBody(NEW))
})

test('force는 드리프트까지 덮어쓴다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), '사용자가 고친 내용\n')
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) }, { force: true })
  assert.equal(r.action, 'update')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), NEW)
})

test('dryRun은 보고만 하고 파일을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), OLD)
  const cap = makeCapture()
  const [r] = updateFiles(root, [{ path: 'a.md', template: NEW }], {
    managed: { 'a.md': hashBody(OLD) }, dryRun: true, log: cap.log,
  })
  assert.equal(r.action, 'update')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), OLD)
  assert.match(cap.text(), /a\.md/)
})

const BLOCK_OLD = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'
const BLOCK_NEW = '<!-- agent-kit:begin -->\n@AGENTS.md\n@EXTRA.md\n<!-- agent-kit:end -->'

test('블록은 마커 사이만 바뀌고 앞뒤 사용자 본문이 보존된다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), `앞말\n\n${BLOCK_OLD}\n\n뒷말\n`)
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: { 'CLAUDE.md#agent-kit': hashBody('@AGENTS.md\n') }, log: makeCapture().log,
  })

  assert.equal(r.action, 'update')
  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.match(text, /^앞말/)
  assert.match(text, /뒷말/)
  assert.match(text, /@EXTRA\.md/)
})

test('블록 안쪽을 고쳤으면 드리프트로 보고한다', () => {
  const root = makeTempRepo()
  const edited = '<!-- agent-kit:begin -->\n내가 넣은 줄\n<!-- agent-kit:end -->'
  writeFileSync(join(root, 'CLAUDE.md'), `${edited}\n`)
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: { 'CLAUDE.md#agent-kit': hashBody('@AGENTS.md\n') }, log: makeCapture().log,
  })

  assert.equal(r.action, 'drift')
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /내가 넣은 줄/)
})

test('블록 대상 파일이 없으면 블록만으로 만든다', () => {
  const root = makeTempRepo()
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: {}, log: makeCapture().log,
  })
  assert.equal(r.action, 'create')
  assert.ok(existsSync(join(root, 'CLAUDE.md')))
})

test('마커가 없는 기존 파일은 드리프트다 — append는 생성 경로의 일이다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '마커 없는 사용자 파일\n')
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: {}, log: makeCapture().log,
  })
  assert.equal(r.action, 'drift')
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), '마커 없는 사용자 파일\n')
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/bootstrap.update.test.mjs"`

Expected: FAIL — `updateFiles`·`updateBlocks`가 export되지 않았다.

- [ ] **Step 3: apply.mjs에 두 함수를 더한다**

import에 해시와 블록 도구를 더한다. **마커 상수도 `record.mjs`에서 받아** 60행의 지역 `const BEGIN_MARKER = ...` 선언을 **지운다** — 같은 문자열을 두 곳에 두면 한쪽만 고치는 회귀가 생긴다. `ensureBlocks`는 이름이 같은 값을 import로 받으므로 호출부를 고칠 필요가 없다.

```js
import { hashBody, normalizeBody } from './text.mjs'
import { BEGIN_MARKER, END_MARKER, extractBlock, managedKey } from './record.mjs'
```

파일 끝에 추가한다.

```js
// 갱신 경로. 생성 경로(ensureFiles·ensureBlocks)와 분리한 이유는 계약이
// 반대이기 때문이다 — 생성은 "있으면 손대지 않는다", 갱신은 "우리가 쓴
// 그대로면 바꾼다". 한 함수에 두 계약을 넣으면 어느 쪽도 읽히지 않는다.
//
// managed[key]가 우리가 마지막으로 쓴 내용의 해시다.
//   현재 == managed  → 우리가 쓴 그대로 → 교체
//   현재 != managed  → 사용자가 고쳤다 → 건드리지 않는다(force면 교체)
//   managed 없음/null → 출처 불명 → 건드리지 않는다(force면 교체)
//   파일 없음         → 생성 (새 도구 지원이 이 경로로 들어온다)
function decide(current, recorded, force) {
  if (current === null) return 'create'
  if (recorded && hashBody(current) === recorded) return 'update'
  return force ? 'update' : 'drift'
}

function readOrNull(target) {
  try {
    return readFileSync(target, 'utf8')
  } catch {
    return null
  }
}

export function updateFiles(root, files, { managed = {}, dryRun = false, force = false, log }) {
  return files.map(({ path: rel, template }) => {
    const current = pathExists(repoPath(root, rel)) ? readOrNull(repoPath(root, rel)) : null
    if (current === null && pathExists(repoPath(root, rel))) {
      log(`경고: ${rel}을 읽을 수 없어 건너뜁니다`)
      return { ok: true, action: 'warn', path: rel, message: '읽기 실패' }
    }

    const wanted = hashBody(template)
    // 이미 새 템플릿과 같으면 쓰지 않는다 — 무의미한 mtime 변경과
    // "갱신 N건" 과대 보고를 막는다.
    if (current !== null && hashBody(current) === wanted) {
      return { ok: true, action: 'skip', path: rel, hash: wanted }
    }

    const verdict = decide(current, managed[rel], force)
    if (verdict === 'drift') {
      log(`사용자 수정 — 건드리지 않음: ${rel}`)
      return { ok: true, action: 'drift', path: rel }
    }

    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(verdict === 'create' ? `파일 생성: ${rel}` : `파일 갱신: ${rel}`)
    if (!dryRun) writeText(target, template)
    return { ok: true, action: verdict, path: rel, hash: wanted }
  })
}

export function updateBlocks(root, blocks, { managed = {}, dryRun = false, force = false, log }) {
  return blocks.map(({ path: rel, block }) => {
    const key = managedKey(rel, true)
    const wantedBody = extractBlock(block) ?? block
    const wanted = hashBody(wantedBody)

    if (!pathExists(repoPath(root, rel))) {
      const target = repoPathStrict(root, rel)
      log(`파일 생성: ${rel}`)
      if (!dryRun) writeText(target, block)
      return { ok: true, action: 'create', path: rel, hash: wanted }
    }

    const text = readOrNull(repoPath(root, rel))
    if (text === null) {
      log(`경고: ${rel}을 읽을 수 없어 건너뜁니다`)
      return { ok: true, action: 'warn', path: rel, message: '읽기 실패' }
    }

    const current = extractBlock(text)
    // 마커가 없는 기존 파일은 갱신 대상이 아니다. 블록을 처음 붙이는 것은
    // 생성 경로(ensureBlocks)의 일이고, 갱신이 append까지 하면 사용자가
    // 일부러 지운 블록을 되살리게 된다.
    if (current === null) {
      log(`관리 블록 없음 — 건드리지 않음: ${rel}`)
      return { ok: true, action: 'drift', path: rel, message: '관리 블록 없음' }
    }

    if (hashBody(current) === wanted) return { ok: true, action: 'skip', path: rel, hash: wanted }

    if (hashBody(current) !== managed[key] && !force) {
      log(`블록 사용자 수정 — 건드리지 않음: ${rel}`)
      return { ok: true, action: 'drift', path: rel }
    }

    const target = repoPathStrict(root, rel)
    log(`관리 블록 갱신: ${rel}`)
    if (!dryRun) {
      // 마커를 포함한 구간을 통째로 새 블록으로 바꾼다. 앞뒤 사용자 본문은
      // 손대지 않으므로 줄바꿈 스타일도 그대로 남는다.
      const begin = text.indexOf(BEGIN_MARKER)
      const end = text.indexOf(END_MARKER, begin) + END_MARKER.length
      const next = text.slice(0, begin) + normalizeBody(block).trimEnd() + text.slice(end)
      writeFileSync(target, next, { encoding: 'utf8' })
    }
    return { ok: true, action: 'update', path: rel, hash: wanted }
  })
}
```

- [ ] **Step 4: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/bootstrap.update.test.mjs"`

Expected: PASS 13건.

- [ ] **Step 5: 전체 테스트와 격리를 확인한다**

Run: `cd agent-installer && npm test`

Expected: 전부 PASS. `bootstrap.apply.test.mjs`가 통과해야 한다 — 생성 경로는 건드리지 않았다.

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/lib/bootstrap/apply.mjs agent-installer/test/bootstrap.update.test.mjs
git commit -F- <<'EOF'
add: 갱신 프리미티브 updateFiles·updateBlocks

생성 경로와 계약이 반대라 함수를 분리한다 — 생성은 "있으면 손대지
않는다", 갱신은 "우리가 쓴 그대로면 바꾼다". 한 함수에 두 계약을
넣으면 어느 쪽도 읽히지 않는다.

기록된 해시와 일치할 때만 교체하고, 사용자가 고친 파일은 드리프트로
보고한다. 파일이 없으면 생성한다 — 새 도구 지원이 이 경로로
들어온다.

블록은 마커를 포함한 구간만 바꿔 앞뒤 사용자 본문을 보존한다.
마커가 없는 기존 파일은 갱신하지 않는다. 갱신이 append까지 하면
사용자가 일부러 지운 블록을 되살리게 된다.
EOF
```

---

## Task 6: update 명령

**Files:**
- Create: `agent-installer/lib/update.mjs`
- Create: `agent-installer/test/update.test.mjs`
- Modify: `agent-installer/lib/args.mjs` (`UPDATE_USAGE`, `parseUpdateArgs`)
- Modify: `agent-installer/install.mjs` (라우팅)
- Modify: `agent-installer/test/args.test.mjs`

**Interfaces:**
- Consumes: Task 2의 `readRecord`·`writeRecord`·`toolVersion`·`RECORD_REL`, Task 5의 `updateFiles`·`updateBlocks`, 기존 `ensureIgnore`·`ensureJsonKeys`·`configureAdapter`.
- Produces: `runUpdate(root, { dryRun, force, log, manifest }) -> { results, drift, record }`
- `parseUpdateArgs(argv) -> { help, dryRun, force }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/args.test.mjs`에 추가한다.

```js
test('parseUpdateArgs: --dry-run과 --force를 받고 모르는 인자를 거부한다', () => {
  assert.equal(parseUpdateArgs([]).force, false)
  assert.equal(parseUpdateArgs(['--force']).force, true)
  assert.equal(parseUpdateArgs(['--dry-run']).dryRun, true)
  assert.equal(parseUpdateArgs(['--help']).help, true)
  assert.throws(() => parseUpdateArgs(['--forcee']), /알 수 없는 인자/)
})
```

`agent-installer/test/update.test.mjs`:

```js
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { RECORD_REL, readRecord } from '../lib/bootstrap/record.mjs'
import { runUpdate } from '../lib/update.mjs'
import { makeCapture, makeTempRepo } from './helpers.mjs'

// 템플릿이 개선된 다음 릴리스를 흉내낸다.
function bumpedManifest(base) {
  return {
    ...base,
    files: base.files.map((f) =>
      f.path === '.agent-kit/README.md' ? { ...f, template: '새 안내 문서\n' } : f),
  }
}

function commitAll(root) {
  execFileSync('git', ['-C', root, 'add', '-A'])
  execFileSync('git', ['-C', root, '-c', 'user.email=t@e.com', '-c', 'user.name=t',
    'commit', '-q', '-m', 'init'])
}

test('템플릿이 개선되면 손대지 않은 파일이 갱신된다', async () => {
  const root = makeTempRepo()
  const { record } = runBootstrap(root, { log: () => {} })
  const { MANIFEST } = await import('../lib/bootstrap/manifest.mjs')

  const cap = makeCapture()
  const r = await runUpdate(root, { manifest: bumpedManifest(MANIFEST), log: cap.log })

  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '새 안내 문서\n')
  assert.equal(r.drift.length, 0)
  // 기록의 해시도 새 내용으로 옮겨져야 다음 update가 또 갱신하지 않는다.
  assert.notEqual(readRecord(root).managed['.agent-kit/README.md'],
    record.managed['.agent-kit/README.md'])
})

test('사용자가 고친 파일은 건드리지 않고 드리프트로 보고한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  writeFileSync(join(root, '.agent-kit/README.md'), '팀이 고친 안내\n')
  const { MANIFEST } = await import('../lib/bootstrap/manifest.mjs')

  const cap = makeCapture()
  const r = await runUpdate(root, { manifest: bumpedManifest(MANIFEST), log: cap.log })

  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '팀이 고친 안내\n')
  assert.deepEqual(r.drift.map((d) => d.path), ['.agent-kit/README.md'])
  assert.match(cap.text(), /드리프트|사용자 수정/)
})

test('기록이 없으면 --adopt를 안내하고 아무것도 쓰지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  execFileSync('git', ['-C', root, 'rm', '-q', '-f', RECORD_REL])

  const cap = makeCapture()
  await assert.rejects(() => runUpdate(root, { log: cap.log }), /--adopt/)
})

test('두 번 돌리면 두 번째는 변경이 없다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  const { MANIFEST } = await import('../lib/bootstrap/manifest.mjs')
  const m = bumpedManifest(MANIFEST)

  await runUpdate(root, { manifest: m, log: () => {} })
  const after1 = readFileSync(join(root, RECORD_REL), 'utf8')
  const r2 = await runUpdate(root, { manifest: m, log: () => {} })

  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), after1)
  assert.equal(r2.results.filter((x) => x.action === 'update').length, 0)
})

test('force는 워킹트리가 더러우면 거부한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  // 커밋하지 않은 상태 — 되돌릴 수 없는 덮어쓰기를 막아야 한다.
  await assert.rejects(
    () => runUpdate(root, { force: true, log: () => {} }),
    /워킹트리|커밋/,
  )
})

test('force는 워킹트리가 깨끗하면 드리프트를 덮어쓴다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  writeFileSync(join(root, '.agent-kit/README.md'), '팀이 고친 안내\n')
  commitAll(root)
  const { MANIFEST } = await import('../lib/bootstrap/manifest.mjs')

  await runUpdate(root, { manifest: bumpedManifest(MANIFEST), force: true, log: () => {} })
  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '새 안내 문서\n')
})

test('dry-run은 파일도 기록도 바꾸지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  const before = readFileSync(join(root, RECORD_REL), 'utf8')
  const { MANIFEST } = await import('../lib/bootstrap/manifest.mjs')

  const cap = makeCapture()
  await runUpdate(root, { manifest: bumpedManifest(MANIFEST), dryRun: true, log: cap.log })

  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), before)
  assert.notEqual(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '새 안내 문서\n')
  assert.match(cap.text(), /README\.md/)
})
```

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/args.test.mjs" "test/update.test.mjs"`

Expected: FAIL — `parseUpdateArgs`와 `lib/update.mjs`가 없다.

- [ ] **Step 3: args.mjs에 update 파서를 더한다**

`ROOT_USAGE`의 사용법 줄에 `update`를 더하고, 아래 상수와 파서를 추가한다.

```js
export const UPDATE_USAGE = `사용법: npx @rch4com/agent-setup update [옵션]

설치 기록에 남은 해시와 대조해, 우리가 쓴 그대로인 관리 파일만
최신 템플릿으로 갱신합니다. 사용자가 고친 파일은 건드리지 않고
드리프트로 보고합니다.

옵션:
  --force      드리프트 파일까지 덮어씁니다. 워킹트리가 깨끗해야 합니다
               (git이 유일한 되돌리기 수단이므로).
  --dry-run    아무것도 바꾸지 않고 예정된 동작만 출력합니다.
  -h, --help   이 도움말을 출력하고 종료합니다.`

const UPDATE_SPEC = { ...HELP_SPEC, '--dry-run': 'bool', '--force': 'bool' }

export function parseUpdateArgs(argv) {
  if (wantsHelp(argv)) return { help: true, dryRun: false, force: false }
  assertKnownArgs(argv, UPDATE_SPEC, UPDATE_USAGE)
  return { help: false, dryRun: argv.includes('--dry-run'), force: argv.includes('--force') }
}
```

- [ ] **Step 4: lib/update.mjs를 만든다**

```js
// update 흐름 — 관리 파일을 최신 템플릿으로 옮기고 드리프트를 보고한다.
//
// 설치 항목(items) 수렴은 스캔이 필요해 외부 의존성을 쓰는 모듈에 닿는다.
// 그래서 이 모듈은 install.mjs에서 동적 import로만 불린다.
import { execFileSync } from 'node:child_process'
import { MANIFEST } from './bootstrap/manifest.mjs'
import {
  configureAdapterSafe, ensureIgnore, ensureJsonKeys, updateBlocks, updateFiles,
} from './bootstrap/apply.mjs'
import { RECORD_REL, managedKey, readRecord, toolVersion, writeRecord } from './bootstrap/record.mjs'

// git이 유일한 되돌리기 수단이다. 커밋되지 않은 변경 위에 덮어쓰면 사용자가
// 잃은 것을 복구할 방법이 없다.
function assertCleanWorktree(root) {
  const out = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' })
  if (out.trim()) {
    throw new Error(
      '--force는 워킹트리가 깨끗할 때만 쓸 수 있습니다. ' +
      'git이 유일한 되돌리기 수단이라 커밋되지 않은 변경 위에 덮어쓰면 복구할 수 없습니다.',
    )
  }
}

export async function runUpdate(root, opts = {}) {
  const { dryRun = false, force = false, log = console.log, manifest = MANIFEST } = opts
  const say = (message) => log(`[agent-setup] ${message}`)

  const record = readRecord(root)
  if (!record) {
    throw new Error(
      `${RECORD_REL}이 없습니다. 이 저장소를 기록 체계로 끌어오려면 먼저 ` +
      '`bootstrap --adopt`를 실행하세요 — 파일을 만들지 않고 기록만 만듭니다.',
    )
  }

  if (force) assertCleanWorktree(root)

  const running = toolVersion()
  if (record.pinnedVersion && record.pinnedVersion !== running) {
    say(`고정 ${record.pinnedVersion} → 실행 중 ${running}`)
  }

  const ctx = { dryRun, force, log: say, managed: record.managed }
  const results = [
    ...updateFiles(root, manifest.files, ctx),
    ...updateBlocks(root, manifest.blocks, ctx),
    // 키 보장과 gitignore 항목 추가는 원래 멱등이라 그대로 재실행한다.
    ...ensureJsonKeys(root, manifest.settings ?? [], { dryRun, log: say }),
    ...ensureIgnore(root, manifest.ignore, { dryRun, log: say }),
  ]

  // 어댑터는 링크가 끊겼을 수 있어 재검증한다. 항목별로 실패를 격리한다.
  for (const entry of manifest.adapters) {
    results.push(configureAdapterSafe(root, entry, {
      dryRun, log: say, skillMode: record.skillMode,
    }))
  }

  // 성공한 것만 기록에 옮긴다. 드리프트는 hash를 담지 않으므로 옛 해시가
  // 남아, 사용자가 원복하면 다음 update가 다시 집어간다.
  const managed = { ...record.managed }
  for (const r of results) {
    if (!r.hash) continue
    const isBlock = manifest.blocks.some((b) => b.path === r.path)
    managed[managedKey(r.path, isBlock)] = r.hash
  }

  const drift = results.filter((r) => r.action === 'drift')
  const updated = results.filter((r) => r.action === 'update')
  const created = results.filter((r) => r.action === 'create')

  if (!dryRun) writeRecord(root, { ...record, managed }, { dryRun, log: say })

  log('')
  say(`갱신 ${updated.length}건 · 신규 ${created.length}건 · 드리프트 ${drift.length}건`)
  if (drift.length > 0) {
    say('드리프트 (건드리지 않았습니다)')
    for (const d of drift) say(`  ${d.path}${d.message ? ` — ${d.message}` : ''}`)
    say('최신 템플릿을 반영하려면 update --force (워킹트리가 깨끗해야 합니다)')
  }

  return { results, drift, record: { ...record, managed } }
}
```

`configureAdapterSafe`는 `flow.mjs`가 인라인으로 하던 try/catch를 재사용 가능하게 뺀 것이다. `apply.mjs`에 추가한다.

```js
// flow.mjs와 update.mjs가 같은 실패 격리를 쓴다 — 어댑터 하나가 실패해도
// 나머지를 계속해야 한다.
export function configureAdapterSafe(root, entry, ctx) {
  try {
    return configureAdapter(root, entry, ctx)
  } catch (err) {
    return { ok: false, action: 'link', path: entry.path, message: err.message }
  }
}
```

`apply.mjs`가 `configureAdapter`를 import해야 한다.

```js
import { configureAdapter } from './adapter.mjs'
```

`flow.mjs`의 어댑터 루프도 이 함수로 바꿔 중복을 없앤다.

```js
    for (const entry of manifest.adapters) {
      results.push(configureAdapterSafe(root, entry, { ...ctx, skillMode }))
    }
```

- [ ] **Step 5: install.mjs에 라우팅을 더한다**

`parseUpdateArgs`와 `UPDATE_USAGE`를 정적 import 목록에 더한다(`args.mjs`는 의존성이 없다). `design` 분기 뒤에 추가한다.

```js
  if (argv[0] === 'update') {
    const opts = parseUpdateArgs(argv.slice(1))
    if (opts.help) { console.log(UPDATE_USAGE); return }
    const { runUpdate } = await withDeps(() => import('./lib/update.mjs'))
    await runUpdate(root, opts)
    return
  }
```

- [ ] **Step 6: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/args.test.mjs" "test/update.test.mjs"`

Expected: PASS.

- [ ] **Step 7: 전체 테스트와 실제 실행을 확인한다**

Run: `cd agent-installer && npm test`

Expected: 전부 PASS. `bootstrap.isolation.test.mjs`도 통과해야 한다 — `update.mjs`는 부트스트랩 그래프가 아니지만 `apply.mjs`에 더한 `configureAdapter` import가 의존성을 끌어오지 않았는지 확인한다.

스크래치 저장소에서 실제로 돌린다.

```bash
D=$(mktemp -d) && git -C "$D" init -q \
  && (cd "$D" && node /d/Sources/github/Agent-Setup/agent-installer/install.mjs bootstrap >/dev/null) \
  && (cd "$D" && node /d/Sources/github/Agent-Setup/agent-installer/install.mjs update) \
  && echo "--- 기록 변경 여부 ---" && git -C "$D" status --porcelain
```

Expected: `갱신 0건 · 신규 0건 · 드리프트 0건`. 방금 배선한 저장소이므로 바꿀 것이 없어야 한다. 여기서 드리프트가 나오면 해시 정규화가 잘못된 것이다.

- [ ] **Step 8: 커밋**

```bash
git add agent-installer/lib/update.mjs agent-installer/lib/bootstrap/apply.mjs agent-installer/lib/bootstrap/flow.mjs agent-installer/lib/args.mjs agent-installer/install.mjs agent-installer/test/update.test.mjs agent-installer/test/args.test.mjs
git commit -F- <<'EOF'
feat(installer): update 명령 추가

한 번 생성된 파일이 절대 갱신되지 않던 상태를 고친다. 기록된
해시와 일치하는 파일만 최신 템플릿으로 옮기고, 사용자가 고친
파일은 건드리지 않고 드리프트로 보고한다.

성공한 것만 기록에 옮긴다. 드리프트는 옛 해시를 남겨, 사용자가
원복하면 다음 update가 다시 집어간다.

--force는 워킹트리가 깨끗할 때만 허용한다. git이 유일한 되돌리기
수단이라 커밋되지 않은 변경 위에 덮어쓰면 복구할 수 없다.

기록이 없으면 bootstrap --adopt를 안내하고 아무것도 쓰지 않는다.
EOF
```

---

## Task 7: status 명령 — 의도 / 실제 / 가용 3자 비교

**Files:**
- Create: `agent-installer/lib/status.mjs`
- Create: `agent-installer/test/status.test.mjs`
- Modify: `agent-installer/lib/args.mjs` (`STATUS_USAGE`, `parseStatusArgs`)
- Modify: `agent-installer/install.mjs`

**Interfaces:**
- Consumes: Task 2의 `readRecord`·`toolVersion`, Task 5의 `updateFiles`(dry-run으로 판정만), 기존 `scan`·`loadItems`.
- Produces:
  - `collectStatus(root, { manifest, items, latest }) -> report`
  - `formatStatus(report) -> string`
  - `runStatus(root, { json, log })`
  - `report` 형태: `{ tool: { pinned, running, latest }, files: { total, current, pending, drift, unmanaged }, items: { installed, recordOnly, repoOnly }, hasRecord }`
- `parseStatusArgs(argv) -> { help, json }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/status.test.mjs`:

```js
import { strict as assert } from 'node:assert'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { collectStatus, formatStatus } from '../lib/status.mjs'
import { makeTempRepo } from './helpers.mjs'

const NO_ITEMS = []

test('갓 배선한 저장소는 관리 파일이 전부 최신이다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  const report = await collectStatus(root, { items: NO_ITEMS })

  assert.equal(report.hasRecord, true)
  assert.equal(report.files.drift, 0)
  assert.equal(report.files.pending, 0)
  assert.ok(report.files.current >= 17)
})

test('사용자가 고친 파일은 드리프트로 센다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  writeFileSync(join(root, '.agent-kit/README.md'), '고친 내용\n')
  const report = await collectStatus(root, { items: NO_ITEMS })

  assert.equal(report.files.drift, 1)
})

test('기록이 없으면 hasRecord가 false이고 안내가 나온다', async () => {
  const root = makeTempRepo()
  const report = await collectStatus(root, { items: NO_ITEMS })

  assert.equal(report.hasRecord, false)
  assert.match(formatStatus(report), /--adopt/)
})

test('기록에만 있는 항목과 저장소에만 있는 항목을 갈라 센다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  // 기록에는 두 개, 실제로는 하나만 설치된 상황을 만든다.
  const record = JSON.parse(readFileSyncUtf8(join(root, '.agent-kit/agent-setup.json')))
  record.items = ['mcp.notion', 'mcp.vercel']
  writeFileSync(join(root, '.agent-kit/agent-setup.json'), JSON.stringify(record, null, 2) + '\n')

  const items = [
    { id: 'mcp.notion', label: 'Notion', detect: async () => ({ status: 'installed' }) },
    { id: 'mcp.vercel', label: 'Vercel', detect: async () => ({ status: 'absent' }) },
    { id: 'skill.gsd', label: 'GSD', detect: async () => ({ status: 'installed' }) },
  ]
  const report = await collectStatus(root, { items })

  assert.deepEqual(report.items.installed, ['mcp.notion', 'skill.gsd'])
  assert.deepEqual(report.items.recordOnly, ['mcp.vercel'])
  assert.deepEqual(report.items.repoOnly, ['skill.gsd'])
})

test('버전 차이를 보고한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  const report = await collectStatus(root, { items: NO_ITEMS, latest: '9.9.9' })

  assert.equal(report.tool.latest, '9.9.9')
  assert.match(formatStatus(report), /9\.9\.9/)
})

test('네트워크로 최신 버전을 못 받아도 나머지는 보고한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log: () => {} })
  const report = await collectStatus(root, { items: NO_ITEMS, latest: null })

  assert.equal(report.tool.latest, null)
  assert.doesNotMatch(formatStatus(report), /null/)
})

function readFileSyncUtf8(p) {
  return require('node:fs').readFileSync(p, 'utf8')
}
```

**주의:** 마지막 헬퍼는 ESM에서 `require`를 쓸 수 없다. `readFileSync`를 파일 위쪽 import에 더하고 헬퍼를 지운다.

```js
import { readFileSync, writeFileSync } from 'node:fs'
```

그리고 호출부를 `JSON.parse(readFileSync(..., 'utf8'))`로 바꾼다.

- [ ] **Step 2: 테스트를 돌려 실패를 확인한다**

Run: `cd agent-installer && node --test "test/status.test.mjs"`

Expected: FAIL — `lib/status.mjs`가 없다.

- [ ] **Step 3: lib/status.mjs를 만든다**

```js
// status — 의도(설치 기록) / 실제(스캔) / 가용(최신 패키지)을 나란히 보여준다.
//
// 실제 상태의 근거는 여전히 스캔이다. 기록은 의도일 뿐이므로 둘이 어긋나면
// 어느 쪽에만 있는지 갈라 보여준다 — 수동 설치·제거를 그대로 잡는다는
// 기존 강점을 기록이 가리지 않게 한다.
import { MANIFEST } from './bootstrap/manifest.mjs'
import { updateBlocks, updateFiles } from './bootstrap/apply.mjs'
import { readRecord, toolVersion } from './bootstrap/record.mjs'

export async function collectStatus(root, { manifest = MANIFEST, items = [], latest } = {}) {
  const record = readRecord(root)

  // dry-run으로 갱신 판정만 얻는다 — 판정 로직을 두 벌 두면 status와 update가
  // 다른 답을 내는 순간이 온다.
  const silent = () => {}
  const verdicts = record
    ? [
        ...updateFiles(root, manifest.files, { managed: record.managed, dryRun: true, log: silent }),
        ...updateBlocks(root, manifest.blocks, { managed: record.managed, dryRun: true, log: silent }),
      ]
    : []

  const count = (action) => verdicts.filter((v) => v.action === action).length

  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root })
      states.push({ id: item.id, status: r.status })
    } catch {
      states.push({ id: item.id, status: 'absent' })
    }
  }
  const installed = states.filter((s) => s.status !== 'absent').map((s) => s.id)
  const intended = new Set(record?.items ?? [])

  return {
    hasRecord: Boolean(record),
    tool: {
      pinned: record?.pinnedVersion ?? null,
      running: toolVersion(),
      latest: latest ?? null,
    },
    files: {
      total: verdicts.length,
      current: count('skip'),
      pending: count('update') + count('create'),
      drift: count('drift'),
    },
    items: {
      installed,
      recordOnly: [...intended].filter((id) => !installed.includes(id)),
      repoOnly: installed.filter((id) => !intended.has(id)),
    },
  }
}

export function formatStatus(report) {
  const lines = []
  const { tool, files, items } = report

  if (!report.hasRecord) {
    lines.push('설치 기록이 없습니다.')
    lines.push('  이 저장소를 기록 체계로 끌어오려면 bootstrap --adopt 를 실행하세요.')
    lines.push('  파일을 만들지 않고, 템플릿과 같은 파일만 관리 대상으로 기록합니다.')
    return lines.join('\n')
  }

  const version = tool.latest && tool.latest !== tool.running
    ? `${tool.pinned} 고정 · 실행 중 ${tool.running} · 최신 ${tool.latest}`
    : `${tool.pinned} 고정 · 실행 중 ${tool.running}`
  lines.push(`도구        ${version}`)
  if (tool.pinned !== tool.running) lines.push('            → update로 고정 버전을 옮길 수 있습니다')

  lines.push(`관리 파일   ${files.total}개 중 ${files.current} 최신 · ${files.pending} 갱신 대기 · ${files.drift} 사용자 수정`)
  if (files.pending > 0) lines.push('            → update')
  if (files.drift > 0) lines.push('            → 사용자 수정 파일은 update가 건드리지 않습니다')

  lines.push(`항목        설치됨     ${items.installed.join(', ') || '(없음)'}`)
  if (items.recordOnly.length) lines.push(`            기록에만   ${items.recordOnly.join(', ')}`)
  if (items.repoOnly.length) lines.push(`            저장소에만 ${items.repoOnly.join(', ')}`)

  return lines.join('\n')
}

export async function runStatus(root, { json = false, log = console.log } = {}) {
  const { loadItems } = await import('./catalog.mjs')
  const report = await collectStatus(root, { items: await loadItems() })
  log(json ? JSON.stringify(report, null, 2) : formatStatus(report))
  return report
}
```

`latest`는 이 단계에서 조회하지 않는다 — 네트워크 호출을 더하면 오프라인에서 `status`가 느려지고, 실패 처리 경로가 늘어난다. 인자로 받을 수 있게만 열어 두고 실제 조회는 3단계에서 붙인다. 테스트가 이 계약을 고정한다.

- [ ] **Step 4: args.mjs와 install.mjs에 status를 더한다**

```js
export const STATUS_USAGE = `사용법: npx @rch4com/agent-setup status [옵션]

설치 기록(의도) / 실제 저장소 상태(스캔) / 실행 중 도구 버전을
나란히 보여줍니다. 아무것도 바꾸지 않습니다.

옵션:
  --json       기계가 읽을 형태로 출력합니다 (CI 판정용).
  -h, --help   이 도움말을 출력하고 종료합니다.`

const STATUS_SPEC = { ...HELP_SPEC, '--json': 'bool' }

export function parseStatusArgs(argv) {
  if (wantsHelp(argv)) return { help: true, json: false }
  assertKnownArgs(argv, STATUS_SPEC, STATUS_USAGE)
  return { help: false, json: argv.includes('--json') }
}
```

`install.mjs`의 `update` 분기 뒤에 추가한다.

```js
  if (argv[0] === 'status') {
    const opts = parseStatusArgs(argv.slice(1))
    if (opts.help) { console.log(STATUS_USAGE); return }
    const { runStatus } = await withDeps(() => import('./lib/status.mjs'))
    await runStatus(root, opts)
    return
  }
```

`ROOT_USAGE`의 사용법 줄에 `status`를 더한다.

- [ ] **Step 5: 테스트를 돌려 통과를 확인한다**

Run: `cd agent-installer && node --test "test/status.test.mjs" "test/args.test.mjs"`

Expected: PASS.

- [ ] **Step 6: 전체 테스트와 실제 출력을 확인한다**

Run: `cd agent-installer && npm test`

Expected: 전부 PASS.

이 저장소에서 실제로 돌려 본다.

```bash
cd agent-installer && node install.mjs status
```

Expected: 설치 기록이 없으므로 `bootstrap --adopt` 안내가 나온다. 이 저장소는 아직 기록을 만들지 않았으므로 정상이다.

- [ ] **Step 7: 커밋**

```bash
git add agent-installer/lib/status.mjs agent-installer/lib/args.mjs agent-installer/install.mjs agent-installer/test/status.test.mjs agent-installer/test/args.test.mjs
git commit -F- <<'EOF'
feat(installer): status 명령 추가

설치 기록(의도) / 스캔(실제) / 실행 중 버전을 나란히 보여준다.
실제 상태의 근거는 여전히 스캔이라, 둘이 어긋나면 어느 쪽에만
있는지 갈라 보여준다 — 수동 설치·제거를 그대로 잡는다는 기존
강점을 기록이 가리지 않게 한다.

갱신 판정은 updateFiles를 dry-run으로 불러 얻는다. 판정 로직을
두 벌 두면 status와 update가 다른 답을 내는 순간이 온다.

최신 버전 조회는 아직 붙이지 않는다 — 인자로만 열어 둔다.
오프라인에서 status가 느려지고 실패 경로가 늘어난다.
EOF
```

---

## Task 8: 문서와 1.1.0 발행

**Files:**
- Modify: `agent-installer/package.json` (`version`)
- Modify: `AgentSetup-README.md`
- Modify: `agent-installer/README.md`
- Modify: `AgentSetup-README-CHANGES.md`
- Modify: `agent-installer/test/pack.test.mjs`

**Interfaces:**
- Consumes: Task 1~7 전부.
- Produces: 발행된 `@rch4com/agent-setup@1.1.0`.

- [ ] **Step 1: 문서화된 원칙을 고친다**

`AgentSetup-README.md`의 "동작 원칙" 절 첫 항목이 지금 이렇게 되어 있다.

```
- 상태 파일이 없습니다 — 실행할 때마다 실제 설정 파일을 스캔해 판정하므로
  수동으로 설치·제거해도 항상 정확히 반영됩니다.
```

이렇게 바꾼다.

```
- **실제 상태의 근거는 스캔입니다** — 실행할 때마다 실제 설정 파일을 스캔해
  판정하므로 수동으로 설치·제거해도 항상 정확히 반영됩니다.
- **설치 기록(`.agent-kit/agent-setup.json`)은 의도입니다** — 어느 버전으로
  배선했는지, 어떤 항목을 고르려 했는지, 관리 파일이 우리가 쓴 그대로인지를
  담습니다. 판정을 대체하지 않고 재현성과 버전 고정을 더합니다. 커밋 대상이라
  팀원이 같은 결과를 얻습니다.
- `status`가 둘의 차이를 `기록에만 있음` / `저장소에만 있음`으로 보여줍니다.
```

- [ ] **Step 2: 갱신 절을 새로 쓴다**

`AgentSetup-README.md`의 "부트스트랩 실행 방법" 절 뒤에 새 절을 넣는다.

````markdown
## 최신으로 갱신하기

```bash
npx @rch4com/agent-setup@latest update             # 관리 파일을 최신 템플릿으로
npx @rch4com/agent-setup@latest update --dry-run   # 무엇이 바뀔지만 확인
npx @rch4com/agent-setup@latest status             # 의도 / 실제 / 버전 비교
```

`update`는 **우리가 쓴 그대로인 파일만** 바꿉니다. 판정 근거는 설치 기록에 남은
파일별 해시입니다.

| 상황 | 처리 |
|---|---|
| 기록된 해시와 일치 | 새 템플릿으로 교체 |
| 해시가 다름 | 사용자가 고쳤음 → **건드리지 않고** 드리프트로 보고 |
| 파일이 없음 | 새로 생성 (새 도구 지원이 이 경로로 들어옵니다) |
| 기록에 해시가 없음 | 출처 불명 → 건드리지 않음 |

`CLAUDE.md`·`GEMINI.md`의 관리 블록은 마커(`<!-- agent-kit:begin -->`) 사이만
교체하므로 주변에 쓴 내용은 그대로 남습니다.

드리프트 파일까지 반영하려면 `update --force`를 씁니다. git이 유일한 되돌리기
수단이므로 **워킹트리가 깨끗할 때만** 동작합니다.

### 이미 쓰던 저장소 끌어오기

설치기를 복사해 쓰던 저장소에는 기록이 없습니다.

```bash
npx @rch4com/agent-setup bootstrap --adopt
```

파일을 만들지 않고 기록만 만듭니다. 이때 **이 버전의 템플릿과 같은 파일만**
관리 대상으로 채택합니다 — 이미 고쳐 둔 파일에 해시를 박으면 다음 `update`가
그 수정을 날려버리기 때문입니다. 채택되지 않은 파일은 `status`에 나오고,
원할 때 `update --force`로 들여올 수 있습니다.
````

- [ ] **Step 3: npm README에 갱신 명령을 더한다**

`agent-installer/README.md`의 사용법 코드 블록에 두 줄을 더한다.

```bash
# 관리 파일을 최신 템플릿으로 갱신한다 (사용자가 고친 파일은 건드리지 않는다)
npx @rch4com/agent-setup@latest update

# 의도 / 실제 / 버전을 비교한다
npx @rch4com/agent-setup status
```

- [ ] **Step 4: 버전을 올리고 pack 테스트를 맞춘다**

`agent-installer/package.json`의 `version`을 `1.1.0`으로 바꾼다.

`pack.test.mjs`에 한 줄을 더해 기록 파일이 발행물에 섞이지 않는지 확인한다.

```js
test('설치 기록은 발행되지 않는다', () => {
  // .agent-kit은 소비 저장소가 만드는 것이지 패키지에 담는 것이 아니다.
  const paths = packInfo().files.map((f) => f.path)
  assert.deepEqual(paths.filter((p) => p.startsWith('.agent-kit')), [])
})
```

- [ ] **Step 5: 변경 이력을 추가한다**

`AgentSetup-README-CHANGES.md` 맨 위에 항목을 넣는다. 담을 내용:

- 설치 기록 `.agent-kit/agent-setup.json` 도입 — 커밋 대상, 버전 고정과 드리프트 감지
- `update` 추가 — 우리가 쓴 그대로인 파일만 갱신, 드리프트 보고, `--force`는 워킹트리 검사
- `status` 추가 — 의도/실제/버전 3자 비교, `--json`
- `bootstrap --adopt` 추가 — 이미 쓰던 저장소 흡수, 템플릿과 같은 파일만 채택
- 문서화된 "상태 파일이 없습니다" 원칙이 "스캔은 실제, 기록은 의도"로 갈렸다
- 해시는 `normalizeBody` 후 계산 — CRLF 체크아웃에서 전부 드리프트로 뜨는 것을 막는다
- 기존 명령(`bootstrap`·`--list`·`--set`·`design`)은 그대로 동작한다

- [ ] **Step 6: 전체 검증을 돌린다**

Run: `cd agent-installer && npm test`

Expected: 전부 PASS.

```bash
bash -n ./setup-agents.sh
bash ./setup-agents.sh --dry-run
pwsh -File ./setup-agents.ps1 -DryRun
```

Expected: 세 명령 모두 오류 없이 끝난다.

스크래치 저장소에서 전체 흐름을 확인한다. **이것이 이 단계가 실제로 동작하는지 판정하는 증거다.**

```bash
D=$(mktemp -d) && git -C "$D" init -q && I=/d/Sources/github/Agent-Setup/agent-installer/install.mjs
(cd "$D" && node $I bootstrap >/dev/null && node $I status)
# 관리 파일 전부 최신, 드리프트 0

(cd "$D" && printf '팀이 고친 지침\n' > AGENTS.md && node $I status)
# 드리프트 1

(cd "$D" && node $I update)
# 갱신 0 · 신규 0 · 드리프트 1, AGENTS.md는 그대로

(cd "$D" && grep -c '팀이 고친 지침' AGENTS.md)
# 1 — update가 사용자 수정을 지키지 않았다면 여기서 0이 된다
```

- [ ] **Step 7: 커밋**

```bash
git add agent-installer/package.json agent-installer/README.md agent-installer/test/pack.test.mjs AgentSetup-README.md AgentSetup-README-CHANGES.md
git commit -F- <<'EOF'
docs: 설치 기록과 갱신을 문서화하고 1.1.0으로 올린다

"상태 파일이 없습니다"라는 문서화된 원칙을 "스캔은 실제, 기록은
의도"로 나눈다. 기록이 판정을 대체하지 않는다는 점이 문서에서
드러나야 수동 설치·제거가 여전히 잡힌다는 강점이 전달된다.

update·status·--adopt 사용법과 4분기 처리 표를 더한다.
EOF
```

- [ ] **Step 8: 발행**

`NPM_TOKEN`과 워크플로 스코프가 준비돼 있으면 태그를 밀어 CI가 발행한다.

```bash
git tag v1.1.0 && git push origin main && git push origin v1.1.0 && gh run watch
```

준비되지 않았으면 로컬 발행한다(2FA OTP 입력이 필요하다).

```bash
cd agent-installer && npm publish
```

발행 후 실제로 확인한다.

```bash
npm view @rch4com/agent-setup version   # 1.1.0
D=$(mktemp -d) && git -C "$D" init -q \
  && (cd "$D" && npx -y @rch4com/agent-setup@1.1.0 bootstrap >/dev/null && npx -y @rch4com/agent-setup@1.1.0 status)
```

Expected: `1.1.0`, 그리고 status가 관리 파일 전부 최신·드리프트 0으로 보고한다.

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 요구 | 담당 |
|---|---|
| 기록 스키마(`formatVersion`/`pinnedVersion`/`skillMode`/`items`/`design`/`managed`) | Task 2 |
| `managed`는 `files` 15 + `blocks` 2만 | Task 3 (`collectManaged`) |
| 해시는 `normalizeBody` 후 계산 | Task 1 (`hashBody`), 테스트로 CRLF 동일성 고정 |
| 블록 키 접미사 `#agent-kit` | Task 3 (`managedKey`) |
| `update` 4분기 | Task 5 (`decide`), Task 6 흐름 |
| `blocks` 마커 사이 교체 | Task 5 (`updateBlocks`) |
| `settings`·`ignore`·`adapters`는 현행 멱등 재실행 | Task 6 (`runUpdate`) |
| `--force`는 워킹트리 깨끗할 때만 | Task 6 (`assertCleanWorktree`) |
| `init --adopt` 채택 규칙 | Task 3 + Task 4 |
| `status` 3자 비교 + `--json` | Task 7 |
| 문서화된 "상태 파일 없음" 원칙 수정 | Task 8 |
| 버전 `1.1.0`(기능 추가, 기존 명령 유지) | Task 8 |
| `pinnedVersion`은 기록을 쓰는 명령만 옮긴다 | Task 2 (`writeRecord`) |

**의도적 미포함** — 스펙의 "`apply`는 버전 엄격"은 `apply`가 3단계 명령이라 여기서 구현하지 않는다. 이유는 계획 앞부분에 적었다. 스펙의 `status` 최신 버전 조회도 인자로만 열어 두고 실제 네트워크 호출은 3단계로 미룬다 — Task 7에 근거를 적었다.

**2. 플레이스홀더**

없다. 모든 코드·테스트·문서 블록이 그대로 붙여 쓸 수 있는 실제 내용이다. Task 8 Step 5만 "담을 내용"을 열거하는데, 기존 `AgentSetup-README-CHANGES.md` 형식을 따라야 하므로 7개 항목을 명시했다.

Task 7 Step 1의 테스트 코드에는 **의도적으로 ESM에서 동작하지 않는 `require` 헬퍼**를 남기고 바로 아래에 고치는 지시를 붙였다. 이는 실수가 아니라, 같은 함정을 실행자가 다시 만들지 않게 하려는 것이다.

**3. 타입·이름 일관성**

- `normalizeBody`·`hashBody` — Task 1이 정의, Task 3·5가 import.
- `RECORD_REL`·`FORMAT_VERSION`·`toolVersion`·`emptyRecord`·`readRecord`·`writeRecord` — Task 2 정의, Task 4·6·7 사용.
- `managedKey(rel, isBlock)`·`extractBlock`·`collectManaged`·`BLOCK_SUFFIX` — Task 3 정의, Task 5·6 사용.
- `BEGIN_MARKER`·`END_MARKER` — Task 3에서 `record.mjs`가 단일 출처가 되고, Task 5에서 `apply.mjs`의 지역 선언(`apply.mjs:60`)을 지워 import로 바꾼다. 같은 문자열이 두 곳에 있으면 한쪽만 고치는 회귀가 생긴다.
- `updateFiles`·`updateBlocks`의 옵션 이름 `{ managed, dryRun, force, log }` — Task 5 정의, Task 6·7 동일하게 호출.
- 결과 `action` 값 `'update'|'create'|'drift'|'skip'|'warn'` — Task 5 정의, Task 6이 집계, Task 7이 같은 값으로 센다.
- `configureAdapterSafe` — Task 6에서 `apply.mjs`에 추가하고 `flow.mjs`·`update.mjs` 양쪽이 쓴다.
- `parseUpdateArgs`·`parseStatusArgs`와 `UPDATE_USAGE`·`STATUS_USAGE` — Task 6·7 정의, `install.mjs` 라우팅과 짝이 맞는다.
