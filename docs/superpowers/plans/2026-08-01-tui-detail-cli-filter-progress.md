# TUI 상세 패널·CLI 필터·진행율 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TUI에서 항목 설명이 잘리지 않게 하고, 어떤 CLI에 무엇이 배선되는지 양방향으로 확인할 수 있게 하며, 설치 중 실시간 진행율을 보여 준다.

**Architecture:** 기존 3층 구조(순수 `state`/`render` → 부수효과 `run`)를 그대로 지킨다. 커진 책임만 순수 모듈 두 개(`tui/detail.mjs`, `tui/progress.mjs`)로 뗀다. 진행율의 근원 문제인 동기 `execFileSync`를 비동기로 바꿔 이벤트 루프를 풀어 준다.

**Tech Stack:** Node 20+ 표준 라이브러리만. 새 의존성 0개. 테스트는 `node --test`.

**설계 문서:** `docs/superpowers/specs/2026-08-01-tui-detail-cli-filter-progress-design.md`

## Global Constraints

- 새 production 의존성 금지. `agent-installer/package.json`의 `dependencies`는 `jsonc-parser`, `smol-toml` 두 개로 유지한다.
- `lib/width.mjs`, `lib/i18n/index.mjs`, `lib/i18n/catalog/*`는 **아무것도 import 하지 않는다**. `bootstrap.isolation.test.mjs`가 이 불변식을 지킨다.
- `lib/tui/state.mjs`는 **아무것도 import 하지 않는다**. 상수가 필요하면 인자로 받는다.
- i18n 키는 `en.mjs`와 `ko.mjs`에 **동시에** 넣는다. `i18n.test.mjs`의 파리티 테스트와 자리표시자 일치 테스트가 강제한다.
- 영어 카탈로그에 한글을 넣지 않는다. `i18n.en.test.mjs`가 막는다.
- 커밋 메시지는 `.gitmessage.txt` 규약을 따른다: `<type>(<scope>): <subject>`, 타입은 소문자 영어, 제목·본문은 한국어, 제목 50자 이내·마침표 없음, 본문 72자 줄바꿈.
- 셸에서 여러 줄 커밋 메시지를 넘길 때는 heredoc(`<<'EOF'`)을 쓴다. PowerShell here-string(`@'…'@`)은 Git Bash에서 `@`가 그대로 새어 들어간다.
- 각 태스크의 검증은 `cd agent-installer && npm test`로 한다. 전체 검증은 Task 13에서 한다.
- 폭 계산은 반드시 `lib/width.mjs`를 거친다. `String.padEnd`·`.length`로 열을 맞추면 한글에서 어긋난다.

---

### Task 1: width.wrap — 표시 폭 인식 줄바꿈

상세 패널과 진행 화면이 긴 글을 여러 줄로 접으려면 접기 함수가 필요하다. `cut`은 잘라 버리고 `pad`는 채우기만 한다.

**Files:**
- Modify: `agent-installer/lib/width.mjs` (파일 끝에 추가)
- Test: `agent-installer/test/width.test.mjs` (신규)

**Interfaces:**
- Consumes: `charWidth`, `width` (같은 파일의 기존 함수)
- Produces: `wrap(text: string, limit: number): string[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/width.test.mjs`를 만든다.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { wrap, width } from '../lib/width.mjs'

test('영문은 공백에서 끊는다', () => {
  assert.deepEqual(wrap('abc def ghi', 7), ['abc def', 'ghi'])
})

test('공백이 없으면 표시 폭에서 끊는다', () => {
  assert.deepEqual(wrap('abcdefgh', 3), ['abc', 'def', 'gh'])
})

// 한글은 한 글자가 두 칸이다. 코드 유닛으로 세면 한 줄에 두 배가 들어가
// 터미널에서 줄이 넘친다.
test('한글은 표시 폭 두 칸으로 센다', () => {
  assert.deepEqual(wrap('가나다라마', 4), ['가나', '다라', '마'])
})

test('한글과 영문이 섞여도 공백 우선으로 끊는다', () => {
  assert.deepEqual(wrap('한글 abc', 6), ['한글', 'abc'])
})

test('어느 줄도 limit을 넘지 않는다', () => {
  const text = '플러그인 기구가 없습니다 — 규칙을 AGENTS.md에 직접 옮겨 적으세요'
  for (const line of wrap(text, 30)) assert.ok(width(line) <= 30, `넘침: ${line}`)
})

test('줄바꿈은 문단 경계로 보존한다', () => {
  assert.deepEqual(wrap('ab\ncd', 10), ['ab', 'cd'])
})

// 호출부가 폭을 잘못 계산해도 무한 루프에 빠지지 않아야 한다.
test('limit이 0 이하이거나 빈 글이면 빈 배열이다', () => {
  assert.deepEqual(wrap('abc', 0), [])
  assert.deepEqual(wrap('abc', -5), [])
  assert.deepEqual(wrap('', 10), [])
  assert.deepEqual(wrap(null, 10), [])
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/width.test.mjs
```

기대: `wrap is not a function`으로 전부 실패.

- [ ] **Step 3: 최소 구현을 쓴다**

`agent-installer/lib/width.mjs`의 `labelWidth` **앞에** 추가한다.

```js
// 접기. cut은 넘치는 글을 버리고 pad는 모자란 폭을 채우지만, 상세 패널과
// 진행 화면은 넘치는 글을 다음 줄로 이어 가야 한다.
//
// 공백이 있으면 마지막 공백에서 끊고(영문), 한 낱말이 limit보다 길거나
// 공백이 없으면(한글) 표시 폭에서 끊는다. limit이 0 이하면 빈 배열을
// 돌려준다 — 호출부가 폭을 잘못 계산했을 때 무한 루프에 빠지지 않게 한다.
export function wrap(text, limit) {
  const s = String(text ?? '')
  if (limit <= 0 || s === '') return []
  const out = []
  for (const para of s.split('\n')) {
    let line = ''
    let w = 0
    let breakAt = -1 // line 안에서 마지막으로 본 공백의 위치
    for (const ch of para) {
      const cw = charWidth(ch.codePointAt(0))
      if (w + cw > limit) {
        // 공백을 봤으면 거기서 끊는다. 뒤에 남는 것은 그 공백 이후이므로
        // 공백이 없다 — breakAt을 -1로 되돌려도 정보가 사라지지 않는다.
        if (breakAt > 0) {
          out.push(line.slice(0, breakAt))
          line = line.slice(breakAt + 1)
        } else {
          out.push(line)
          line = ''
        }
        w = width(line)
        breakAt = -1
      }
      if (ch === ' ') breakAt = line.length
      line += ch
      w += cw
    }
    out.push(line)
  }
  return out
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && node --test test/width.test.mjs
```

기대: 7개 전부 PASS.

- [ ] **Step 5: 전체 테스트를 돌린다**

```bash
cd agent-installer && npm test
```

기대: 기존 테스트 전부 통과(회귀 없음).

- [ ] **Step 6: 커밋한다**

```bash
git add agent-installer/lib/width.mjs agent-installer/test/width.test.mjs
git commit -F - <<'EOF'
feat(installer): 표시 폭을 아는 줄바꿈을 더한다

상세 패널과 진행 화면이 긴 글을 여러 줄로 접어야 한다. cut은 넘치는
글을 버리고 pad는 채우기만 해 접는 함수가 없었다.

영문은 공백에서, 한글은 표시 폭에서 끊는다. limit이 0 이하면 빈
배열을 돌려줘 호출부의 폭 계산 실수가 무한 루프가 되지 않게 한다.
EOF
```

---

### Task 2: clis.mjs — 설정 파일 경로 노출

상세 패널이 "이 항목이 **어디에** 쓰이나"를 보여 주려면 각 CLI의 설정 파일 경로가 필요하다. 지금 그 경로는 어댑터 클로저 안에만 있어 밖에서 읽을 수 없다.

**Files:**
- Modify: `agent-installer/lib/clis.mjs:9-22` (`jsonAdapter`), `:41-45`·`:77-82` (codex·grok), `:32-100` (`CLIS`)
- Test: `agent-installer/test/clis.test.mjs` (기존 파일에 추가)

**Interfaces:**
- Produces: `CLIS[cliId].file: string` — 저장소 루트 기준 상대 경로

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/clis.test.mjs` 끝에 추가한다.

```js
// 상세 패널이 "이 항목이 어디에 쓰이나"를 보여 주는 근거다. 경로를 어댑터와
// 따로 적으면 갈릴 수 있으므로, 실제로 쓴 파일이 그 자리에 생기는지 본다.
test('모든 CLI가 자기 설정 파일 경로를 밝힌다', () => {
  for (const cli of CLI_IDS) {
    assert.equal(typeof CLIS[cli].file, 'string', `${cli}: file이 없다`)
    assert.ok(CLIS[cli].file.length > 0, `${cli}: file이 비었다`)
  }
})

test('밝힌 경로가 실제로 쓰이는 파일이다', () => {
  const root = makeTempRepo()
  const server = { kind: 'http', url: 'https://example.test/mcp' }
  for (const cli of CLI_IDS) {
    CLIS[cli].add(root, 'probe', server)
    assert.ok(existsSync(join(root, CLIS[cli].file)), `${cli}: ${CLIS[cli].file}가 없다`)
  }
})
```

같은 파일 위쪽 import에 필요한 것을 더한다.

```js
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo } from './helpers.mjs'
```

이미 있는 import는 중복해 넣지 않는다 — 먼저 파일 머리를 읽고 없는 것만 더한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/clis.test.mjs
```

기대: `claude: file이 없다`로 실패.

- [ ] **Step 3: 구현한다**

`agent-installer/lib/clis.mjs`의 `jsonAdapter`에 `file`을 더한다.

```js
function jsonAdapter(relFile, topKey, toEntry) {
  return {
    // 경로를 밖으로 낸다 — 상세 패널이 "이 항목이 어디에 쓰이나"를 보여 준다.
    // 어댑터가 실제로 쓰는 값과 같은 변수라 두 곳이 갈릴 수 없다.
    file: relFile,
    has(root, name) {
      const data = readJson(repoPath(root, relFile))
      return getIn(data, [topKey, name]) !== undefined
    },
    add(root, name, server) {
      setKey(repoPathStrict(root, relFile), [topKey, name], toEntry(server))
    },
    remove(root, name) {
      removeKey(repoPathStrict(root, relFile), [topKey, name])
    },
  }
}
```

`tomlLines` 바로 아래에 TOML 어댑터를 더한다. codex·grok이 각자 경로를 세 번씩 적던 중복도 함께 없앤다.

```js
// codex·grok은 TOML을 쓴다. jsonAdapter와 같은 이유로 경로를 한 번만 적는다.
function tomlAdapter(file) {
  return {
    file,
    has: (root, name) => hasSection(repoPath(root, file), name),
    add: (root, name, s) => appendSection(repoPathStrict(root, file), name, tomlLines(s)),
    remove: (root, name) => removeSection(repoPathStrict(root, file), name),
  }
}
```

`CLIS`의 codex·grok 항목을 바꾼다.

```js
  codex: {
    label: 'Codex',
    ...tomlAdapter('.codex/config.toml'),
  },
```

```js
  grok: {
    label: 'Grok Build',
    ...tomlAdapter('.grok/config.toml'),
  },
```

나머지 8개는 `jsonAdapter`를 쓰므로 손대지 않는다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && node --test test/clis.test.mjs && npm test
```

기대: 신규 2개 PASS, 기존 전부 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add agent-installer/lib/clis.mjs agent-installer/test/clis.test.mjs
git commit -F - <<'EOF'
feat(installer): CLI가 자기 설정 파일 경로를 밝힌다

상세 패널이 "이 항목이 어디에 쓰이나"를 보여 주려면 경로가 필요한데,
지금은 어댑터 클로저 안에만 있어 밖에서 읽을 수 없었다.

어댑터가 실제로 쓰는 값과 같은 변수를 그대로 내보내 두 곳이 갈릴 수
없게 했다. codex·grok이 경로를 세 번씩 적던 중복도 함께 없앴다.
EOF
```

---

### Task 3: 사유 그룹 분리와 짧은 힌트

상세 패널은 미배선 사유를 구조체로 받아야 표로 그릴 수 있다. 동시에 목록 행의 힌트를 짧게 줄여 잘릴 것을 없앤다.

**Files:**
- Create: `agent-installer/lib/tui/detail.mjs` (`unsupportedGroups`만 먼저)
- Modify: `agent-installer/lib/tui/rows.mjs:56-98` (힌트), `:102-115` (`itemRow`), `:196-238` (`buildRows`)
- Modify: `agent-installer/lib/tui/run.mjs:48-55` (`printPlain`)
- Test: `agent-installer/test/tui.rows.test.mjs` (추가)

**Interfaces:**
- Produces:
  - `unsupportedGroups(item, t): Array<{ clis: string[], why: string }>` (`tui/detail.mjs`)
  - `agentShortHint(item, state, t): string` (`tui/rows.mjs`)
  - `designShortHint(state, multiProvider, t): string` (`tui/rows.mjs`)
  - 행에 `fullHint: string`, `statusDetail: string | null` 필드 추가
- Consumes: `toText` (i18n), `CLI_IDS` (clis)

**왜 `detail.mjs`에 두나:** `render.mjs`가 상세 패널을 그리려면 이 함수가 필요하다. `rows.mjs`에 두면 `render → detail → rows → engine → catalog`로 무거운 의존성이 순수 렌더 층까지 딸려 온다. 반대로 두면 `detail.mjs`는 i18n·width·clis만 아는 잎 모듈로 남는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.rows.test.mjs` 끝에 추가한다.

```js
import { unsupportedGroups } from '../lib/tui/detail.mjs'
import { agentShortHint, designShortHint } from '../lib/tui/rows.mjs'

const PONYTAIL = {
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', scope: 'project',
  supports: ['claude', 'opencode'],
  unsupported: {
    codex: msg('item.unsupported.ponytailUser'),
    gemini: msg('item.unsupported.ponytailUser'),
    kilo: msg('item.unsupported.ponytailRules'),
  },
}

// 사유 하나가 CLI 여럿에 그대로 반복되면 줄만 길어지고 "무엇이 왜 빠졌는가"가
// 묻힌다. 같은 사유끼리 묶어 갈래가 보이게 한다.
test('미배선 사유를 같은 사유끼리 묶어 구조체로 돌려준다', () => {
  const t = createT('en')
  const groups = unsupportedGroups(PONYTAIL, t)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].clis, ['codex', 'gemini'])
  assert.deepEqual(groups[1].clis, ['kilo'])
  assert.equal(typeof groups[0].why, 'string')
})

test('미배선이 없으면 빈 배열이다', () => {
  assert.deepEqual(unsupportedGroups({ unsupported: {} }, createT('en')), [])
  assert.deepEqual(unsupportedGroups({}, createT('en')), [])
})

// 목록 행에서 잘릴 것을 없애는 것이 이번 변경의 핵심이다. 사유·note·detail은
// 상세 패널로 옮기고 행에는 상태와 커버리지만 남긴다.
test('짧은 힌트는 상태와 CLI 커버리지만 담는다', () => {
  const t = createT('en')
  const hint = agentShortHint(PONYTAIL, { item: PONYTAIL, status: 'installed' }, t)
  assert.match(hint, /Installed/)
  assert.match(hint, /CLI 2\/10/)
  assert.doesNotMatch(hint, /upstream/)
})

test('긴 힌트는 그대로 남아 검색과 비대화형 목록이 쓴다', () => {
  const t = createT('en')
  const full = agentHint(PONYTAIL, { item: PONYTAIL, status: 'installed' }, t)
  assert.match(full, /upstream/)
})

test('항목 행은 짧은 힌트와 긴 힌트를 함께 들고 긴 쪽으로 검색된다', () => {
  const rows = buildRows({ agentStates: [{ item: PONYTAIL, status: 'installed' }] })
  const row = rows.find((r) => r.id === 'plugin.ponytail')
  assert.notEqual(row.hint, row.fullHint)
  assert.ok(row.searchText.includes('agents.md'))
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.rows.test.mjs
```

기대: `Cannot find module '../lib/tui/detail.mjs'`로 실패.

- [ ] **Step 3: `detail.mjs`를 만든다**

`agent-installer/lib/tui/detail.mjs`:

```js
// 상세 패널 — 커서가 놓인 항목의 전문을 여러 줄로 편다.
// 순수 함수 모듈이다. 색도 커서도 터미널도 모른다 — render.mjs가 배치하고 칠한다.
//
// rows.mjs를 import 하지 않는 것이 규칙이다. render.mjs가 이 모듈을 쓰므로,
// 여기서 rows를 끌어오면 render → detail → rows 방향이 생겨 rows.mjs가 순수
// 렌더 층의 의존성이 된다. 그래서 사유 그룹핑이 rows가 아니라 여기 있고,
// rows.mjs가 반대로 여기서 가져다 쓴다.
//
// design-md/flow.mjs는 가볍지 않지만(engine을 끌어온다) render.mjs가 이미
// categoryLabel 때문에 의존하고 있어, 여기서 쓰는 것이 그래프를 넓히지 않는다.
import { toText } from '../i18n/index.mjs'

// 미배선 사유를 **같은 사유끼리** 묶는다. 사유 하나가 CLI 아홉 개에 그대로
// 반복되면 줄만 길어지고 "무엇이 왜 빠졌는가"는 오히려 묻힌다.
// 사유가 둘 이상이면(ponytail처럼) 갈래가 그대로 보인다.
export function unsupportedGroups(item, t) {
  const entries = Object.entries(item?.unsupported ?? {})
  if (entries.length === 0) return []
  const byReason = new Map()
  for (const [cli, why] of entries) {
    const text = toText(t, why)
    if (!byReason.has(text)) byReason.set(text, [])
    byReason.get(text).push(cli)
  }
  return [...byReason].map(([why, clis]) => ({ clis, why }))
}
```

- [ ] **Step 4: `rows.mjs`를 고친다**

`agent-installer/lib/tui/rows.mjs:56-67`의 `unsupportedText`를 아래로 갈아 끼운다(그룹핑을 detail.mjs에 위임한다).

```js
// 그룹핑은 detail.mjs가 한다 — 상세 패널과 규칙을 한 곳에 둔다.
export function unsupportedText(item, t) {
  const groups = unsupportedGroups(item, t)
  if (groups.length === 0) return null
  const count = groups.reduce((n, g) => n + g.clis.length, 0)
  const text = groups
    .map((g) => t('item.unsupportedGroup', { clis: g.clis.join('·'), why: g.why }))
    .join(' / ')
  return t('item.unsupportedList', { count, groups: text })
}
```

파일 위쪽 import에 더한다.

```js
import { unsupportedGroups } from './detail.mjs'
```

`agentHint`(`:70-87`)는 **손대지 않는다** — 비대화형 목록과 검색이 계속 쓴다. 그 아래에 짧은 힌트를 더한다.

```js
// 목록 행에 실제로 찍히는 힌트. 80칸 터미널이면 힌트 자리는 49칸(한글 24자)뿐이라,
// 예전처럼 사유까지 이어 붙이면 뒤쪽이 통째로 잘렸다. 사유·note·detail은
// 상세 패널이 여러 줄로 편다 — 여기 남는 것은 잘릴 일이 없는 두 가지뿐이다.
export function agentShortHint(item, state, t = createT('en')) {
  const parts = []
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  if (item.supports) parts.push(t('item.cliCoverage', { covered: item.supports.length, total: CLI_IDS.length }))
  return parts.join(' · ')
}

// design.md도 같은 이유로 줄인다. 설명 전문은 상세 패널이 맡는다.
export function designShortHint(state, multiProvider = false, t = createT('en')) {
  const parts = []
  if (multiProvider) parts.push(state.item.providerId)
  parts.push(categoryLabel(t, state.item.designCategory))
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  return parts.filter(Boolean).join(' · ')
}
```

`itemRow`(`:102-115`)가 두 힌트와 상태 상세를 함께 들게 한다.

```js
function itemRow({ id, section, label, hint, fullHint = hint, statusDetail = null, status, previewTarget = null, item, extra = '', group = null, t = createT('en') }) {
  return {
    kind: 'item',
    id,
    section,
    group,
    label,
    hint,
    // 화면에 안 찍히는 긴 힌트. 비대화형 목록(printPlain)과 검색이 쓴다 —
    // 짧은 힌트로 검색하면 'AGENTS.md'로 ponytail을 찾을 수 없게 된다.
    fullHint,
    statusDetail,
    status,
    previewTarget,
    item,
    searchText: `${label} ${fullHint} ${sectionTerms(t, section)} ${extra}`.toLowerCase(),
  }
}
```

`actionRow`(`:117-130`)에도 같은 두 필드를 더한다(값은 같다).

```js
function actionRow({ id, label, hint, run = null, t = createT('en') }) {
  return {
    kind: 'action',
    id,
    section: ACTION_SECTION,
    group: null,
    label,
    hint,
    fullHint: hint,
    statusDetail: null,
    status: 'absent',
    previewTarget: null,
    run,
    searchText: `${label} ${hint} ${sectionTerms(t, ACTION_SECTION)}`.toLowerCase(),
  }
}
```

`buildRows`(`:196-238`)에서 두 힌트를 모두 넘긴다.

```js
  const agents = agentStates
    .map((s) =>
      itemRow({
        id: s.item.id,
        section: s.item.category,
        group: s.item.group ?? null,
        label: s.item.label,
        hint: agentShortHint(s.item, s, t),
        fullHint: agentHint(s.item, s, t),
        statusDetail: toText(t, s.detail) ?? null,
        status: s.status,
        item: s.item,
        extra: s.item.id,
        t,
      }),
    )
```

```js
  const designs = designStates
    .map((s) =>
      itemRow({
        id: s.item.id,
        section: 'design',
        group: s.item.designCategory || CATCH_ALL_CATEGORY,
        label: s.item.label,
        hint: designShortHint(s, multiProvider, t),
        fullHint: designHint(s, multiProvider, t),
        status: s.status,
        previewTarget: s.item.webUrl ?? s.item.previewPath ?? null,
        item: s.item,
        extra: `${s.item.name} ${s.item.providerId}`,
        t,
      }),
    )
```

두 `.sort(...)` 호출은 그대로 둔다.

- [ ] **Step 5: `printPlain`이 긴 힌트를 쓰게 한다**

`agent-installer/lib/tui/run.mjs:48-55`:

```js
function printPlain(rows, log, t = createT('en')) {
  let section = null
  for (const row of rows) {
    if (row.section !== section) { section = row.section; log(`[${t(`section.${section}`)}]`) }
    const mark = row.kind === 'action' ? '▶' : row.status === 'absent' ? ' ' : '×'
    // 화면 폭 제약이 없는 자리다 — 여기서는 긴 힌트가 낫다.
    const hint = row.fullHint ?? row.hint
    log(`  [${mark}] ${row.label}${hint ? ` — ${hint}` : ''}`)
  }
}
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 5개 PASS. 기존 `tui.rows.test.mjs`의 `agentHint`·`designHint` 단언은 두 함수를 안 건드렸으므로 그대로 통과한다.

- [ ] **Step 7: 커밋한다**

```bash
git add agent-installer/lib/tui/detail.mjs agent-installer/lib/tui/rows.mjs agent-installer/lib/tui/run.mjs agent-installer/test/tui.rows.test.mjs
git commit -F - <<'EOF'
refactor(installer): 사유 그룹을 떼고 목록 힌트를 줄인다

80칸 터미널에서 힌트 자리는 49칸(한글 24자)뿐인데 상태·커버리지·설치
위치·note·미배선 사유를 전부 이어 붙여, 사유가 한 글자도 보이지
않았다.

행에는 상태와 커버리지만 남기고 나머지는 상세 패널이 맡는다. 긴 힌트는
fullHint로 남겨 검색과 비대화형 목록이 계속 쓴다 — 짧은 힌트로 검색하면
AGENTS.md로 ponytail을 찾을 수 없다.
EOF
```

---

### Task 4: 상세 패널 본문

**Files:**
- Modify: `agent-installer/lib/tui/detail.mjs` (Task 3에서 만든 파일에 추가)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `agent-installer/lib/i18n/catalog/ko.mjs`
- Test: `agent-installer/test/tui.detail.test.mjs` (신규)

**Interfaces:**
- Consumes: `unsupportedGroups` (Task 3), `wrap`·`cut`·`pad`·`width` (Task 1 포함, `lib/width.mjs`), `CLIS[cli].file` (Task 2)
- Produces: `detailLines(row, { width, height, t }): string[]`

- [ ] **Step 1: i18n 키를 더한다**

`agent-installer/lib/i18n/catalog/en.mjs`의 `'item.unsupportedGroup'` 줄 아래에 넣는다.

```js
  'detail.wired': 'wired',
  'detail.unwired': 'unwired',
  'detail.provider': 'source',
  'detail.preview': 'preview',
  'detail.scope.project': 'repo scope',
  'detail.scope.user': 'user global',
  'detail.more': '  …and {count} more line(s) — Ctrl+D to expand',
  'detail.empty': '  Move the cursor onto an item to see its details.',
```

`agent-installer/lib/i18n/catalog/ko.mjs`의 같은 자리에 넣는다.

```js
  'detail.wired': '배선',
  'detail.unwired': '미배선',
  'detail.provider': '공급자',
  'detail.preview': '미리보기',
  'detail.scope.project': '저장소 스코프',
  'detail.scope.user': '사용자 전역',
  'detail.more': '  …외 {count}줄 — Ctrl+D로 펼치기',
  'detail.empty': '  커서를 항목 위에 올리면 상세가 보입니다.',
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.detail.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { detailLines } from '../lib/tui/detail.mjs'
import { createT, msg } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'

const T = createT('ko')

function itemRow(item, status = 'installed', extra = {}) {
  return { kind: 'item', id: item.id, label: item.label, status, item, statusDetail: null, previewTarget: null, ...extra }
}

const PONYTAIL = itemRow({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', scope: 'project',
  supports: ['claude', 'opencode'],
  unsupported: {
    codex: msg('item.unsupported.ponytailUser'),
    gemini: msg('item.unsupported.ponytailUser'),
    kilo: msg('item.unsupported.ponytailRules'),
  },
  note: 'item.plugin.ponytail.note',
})

const SUPABASE = itemRow({
  id: 'mcp.supabase', category: 'mcp', label: 'Supabase', scope: 'project',
  supports: ['claude', 'codex'], unsupported: {},
}, 'absent')

const DESIGN = itemRow({
  id: 'design.a.linear', category: 'design', label: 'Linear', providerId: 'awesome-design-md',
  designCategory: 'Productivity', description: 'Linear의 디자인 시스템 문서.', webUrl: 'https://linear.app',
}, 'installed', { previewTarget: 'https://linear.app' })

test('머리줄에 이름·종류·스코프·상태를 담는다', () => {
  const [head] = detailLines(PONYTAIL, { width: 60, height: 20, t: T })
  assert.match(head, /Ponytail/)
  assert.match(head, /plugin/)
  assert.match(head, /저장소 스코프/)
  assert.match(head, /설치됨/)
})

test('배선된 CLI를 이름째 보여 준다', () => {
  const text = detailLines(PONYTAIL, { width: 60, height: 20, t: T }).join('\n')
  assert.match(text, /claude/)
  assert.match(text, /opencode/)
})

// 커버리지 숫자만으로는 "내가 쓰는 CLI에서 되나"에 답할 수 없다.
test('미배선 CLI와 사유를 같은 사유끼리 묶어 보여 준다', () => {
  const text = detailLines(PONYTAIL, { width: 60, height: 20, t: T }).join('\n')
  assert.match(text, /codex·gemini/)
  assert.match(text, /kilo/)
  assert.match(text, /사용자 스코프/)
  assert.match(text, /AGENTS\.md/)
})

// MCP만 어댑터가 경로의 유일한 진실이다. plugin·skill은 설치 경로가 항목마다
// 달라 어댑터가 알지 못하므로 경로를 지어내지 않는다.
test('MCP 항목만 설정 파일 경로를 붙인다', () => {
  const mcp = detailLines(SUPABASE, { width: 60, height: 20, t: T }).join('\n')
  assert.match(mcp, /\.mcp\.json/)
  assert.match(mcp, /\.codex\/config\.toml/)
  const plugin = detailLines(PONYTAIL, { width: 60, height: 20, t: T }).join('\n')
  assert.doesNotMatch(plugin, /\.mcp\.json/)
})

test('design 항목은 공급자·미리보기·설명을 보여 준다', () => {
  const text = detailLines(DESIGN, { width: 60, height: 20, t: T }).join('\n')
  assert.match(text, /awesome-design-md/)
  assert.match(text, /https:\/\/linear\.app/)
  assert.match(text, /디자인 시스템/)
})

test('어느 줄도 폭을 넘지 않는다', () => {
  const lines = detailLines(PONYTAIL, { width: 40, height: 20, t: T })
  // 빈 배열 위를 도는 루프는 무엇을 반환하든 통과한다. 내용이 있다는 것을 먼저 못박는다.
  assert.ok(lines.length > 0, '상세가 비면 폭 검사가 공허해진다')
  for (const line of lines) assert.ok(width(line) <= 40, `넘침(${width(line)}): ${line}`)
})

// 지면을 넘치면 남은 줄 수를 알리고 펼치는 길을 안내한다 — 조용히 자르면
// 이번에 고치려던 문제가 그대로 되돌아온다.
test('지면을 넘치면 마지막 줄이 남은 줄 수를 알린다', () => {
  const lines = detailLines(PONYTAIL, { width: 40, height: 4, t: T })
  assert.equal(lines.length, 4)
  assert.match(lines[3], /외 \d+줄/)
})

test('지면이 없거나 행이 없으면 빈 배열이다', () => {
  assert.deepEqual(detailLines(PONYTAIL, { width: 40, height: 0, t: T }), [])
  assert.deepEqual(detailLines(null, { width: 40, height: 10, t: T }), [])
})

test('액션 행도 그린다', () => {
  const row = { kind: 'action', id: 'action.bootstrap', label: '부트스트랩 실행', hint: '지침 · 스킬', status: 'absent' }
  const text = detailLines(row, { width: 60, height: 10, t: T }).join('\n')
  assert.match(text, /부트스트랩 실행/)
  assert.match(text, /지침/)
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.detail.test.mjs
```

기대: `detailLines is not a function`으로 실패.

- [ ] **Step 4: `detailLines`를 구현한다**

`agent-installer/lib/tui/detail.mjs`의 import를 넓히고 파일 끝에 추가한다.

```js
import { toText, createT } from '../i18n/index.mjs'
import { CLIS } from '../clis.mjs'
import { categoryLabel } from '../design-md/flow.mjs'
import { cut, pad, width, wrap } from '../width.mjs'
```

```js
// '배선  ' / '미배선 ' 라벨 자리. 로케일마다 길이가 달라 상수로 박으면 열이
// 어긋난다 — 그 로케일의 실제 라벨에서 폭을 뽑는다.
function leadWidth(t) {
  return Math.max(width(t('detail.wired')), width(t('detail.unwired'))) + 1
}

function headLine(row, w, t) {
  const item = row.item
  const bits = [item.category, t(`detail.scope.${item.scope}`), t(`status.${row.status}`)]
  return cut(`${item.label}   ${bits.filter(Boolean).join(' · ')}`, w)
}

function wiredLines(item, w, lead, t) {
  const supports = item.supports ?? []
  if (supports.length === 0) return []
  // 경로는 MCP에서만 붙인다. 그때만 clis.mjs 어댑터가 경로의 유일한 진실이다 —
  // plugin·skill은 설치 자리가 항목마다 달라 어댑터가 알지 못한다.
  const showFile = item.category === 'mcp'
  const nameWidth = Math.max(...supports.map((c) => width(c)))
  return supports.map((cli, i) => {
    const head = i === 0 ? pad(t('detail.wired'), lead) : ' '.repeat(lead)
    const file = showFile && CLIS[cli]?.file ? `  ${CLIS[cli].file}` : ''
    return cut(`${head}✔ ${pad(cli, nameWidth)}${file}`, w)
  })
}

function unwiredLines(item, w, lead, t) {
  const out = []
  unsupportedGroups(item, t).forEach((group, i) => {
    const head = i === 0 ? pad(t('detail.unwired'), lead) : ' '.repeat(lead)
    out.push(cut(`${head}✖ ${group.clis.join('·')}`, w))
    // 사유는 한 칸 더 들여 이어 붙인다. 첫 줄만 └를 달아 어느 CLI 묶음의
    // 사유인지 눈으로 잇는다.
    wrap(group.why, Math.max(1, w - lead - 3)).forEach((line, j) => {
      out.push(cut(`${' '.repeat(lead + 1)}${j === 0 ? '└ ' : '  '}${line}`, w))
    })
  })
  return out
}

function agentLines(row, w, t) {
  const item = row.item
  const lead = leadWidth(t)
  const out = [headLine(row, w, t)]
  if (item.note) out.push(...wrap(t(item.note), w))
  if (row.statusDetail) out.push(...wrap(row.statusDetail, w))
  out.push(...wiredLines(item, w, lead, t))
  out.push(...unwiredLines(item, w, lead, t))
  return out
}

function designLines(row, w, t) {
  const item = row.item
  const lead = leadWidth(t)
  const bits = [item.category, categoryLabel(t, item.designCategory), t(`status.${row.status}`)]
  const out = [cut(`${item.label}   ${bits.filter(Boolean).join(' · ')}`, w)]
  if (item.providerId) out.push(cut(`${pad(t('detail.provider'), lead)}${item.providerId}`, w))
  const target = row.previewTarget ?? item.webUrl ?? item.previewPath
  if (target) out.push(cut(`${pad(t('detail.preview'), lead)}${target}`, w))
  if (item.description) out.push(...wrap(item.description, w))
  return out
}

// 액션 행은 체크 대상이 아니라 실행 대상이다 — 배선표가 없다.
function actionLines(row, w) {
  return [cut(row.label, w), ...wrap(row.fullHint ?? row.hint ?? '', w)]
}

// 행 하나와 지면 크기를 받아 줄 배열을 돌려준다. 색도 커서도 모른다.
export function detailLines(row, { width: columns = 80, height = 8, t = createT('en') } = {}) {
  if (!row || height <= 0) return []
  const w = Math.max(20, columns)
  const lines = row.kind === 'action'
    ? actionLines(row, w)
    : row.item?.category === 'design' ? designLines(row, w, t) : agentLines(row, w, t)

  if (lines.length <= height) return lines
  // 넘치면 조용히 자르지 않는다 — 남은 줄 수와 펼치는 길을 함께 알린다.
  const room = Math.max(1, height - 1)
  return [...lines.slice(0, room), cut(t('detail.more', { count: lines.length - room }), w)]
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 9개 PASS. i18n 파리티 테스트도 통과(en·ko에 같은 키를 넣었다).

- [ ] **Step 6: 커밋한다**

```bash
git add agent-installer/lib/tui/detail.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/test/tui.detail.test.mjs
git commit -F - <<'EOF'
feat(installer): 항목 상세를 여러 줄로 펴는 순수 모듈을 더한다

CLI 커버리지 숫자만으로는 "내가 쓰는 CLI에서 되나"에 답할 수 없다.
배선된 CLI를 이름째, 미배선은 같은 사유끼리 묶어 보여 준다.

설정 파일 경로는 MCP에서만 붙인다 — 그때만 어댑터가 경로의 유일한
진실이고, plugin·skill은 설치 자리가 항목마다 달라 어댑터가 모른다.
EOF
```

---

### Task 5: 렌더 레이아웃 — 패널 자리 배분

**Files:**
- Modify: `agent-installer/lib/tui/render.mjs:20-26` (지면 계산), `:82-135` (`render`)
- Test: `agent-installer/test/tui.render.test.mjs` (신규)

**Interfaces:**
- Consumes: `detailLines` (Task 4), `currentRow` (state.mjs 기존 export)
- Produces:
  - `panelHeight(height, expanded = false): number`
  - `bodyHeight(height, expanded = false): number` — 시그니처 확장(기존 1인자 호출은 그대로 동작)
  - `render(state, opts)` — `opts.detailExpanded: boolean` 추가

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.render.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { render, bodyHeight, panelHeight } from '../lib/tui/render.mjs'
import { createState, move } from '../lib/tui/state.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'

const T = createT('ko')

function row(id, label, supports) {
  return {
    kind: 'item', id, section: 'mcp', group: null, label,
    hint: '미설치', fullHint: '미설치', statusDetail: null, status: 'absent',
    previewTarget: null, searchText: `${id} ${label}`.toLowerCase(),
    item: { id, category: 'mcp', label, scope: 'project', supports, unsupported: {} },
  }
}

const ROWS = [row('mcp.a', 'Alpha', ['claude']), row('mcp.b', 'Bravo', ['claude', 'codex'])]

// 커서를 옮길 때마다 패널 높이가 변하면 목록이 위아래로 출렁인다.
// 아코디언을 기각한 이유가 바로 그것이라, 높이는 터미널 크기로만 정한다.
test('패널 높이는 커서 위치와 무관하다', () => {
  const a = createState(ROWS)
  const b = move(a, 1)
  const at = (s) => render(s, { width: 80, height: 30, t: T }).length
  assert.equal(at(a), at(b))
  assert.equal(panelHeight(30), panelHeight(30))
})

test('지면이 넉넉하면 목록과 패널이 화면을 나눠 갖는다', () => {
  assert.ok(panelHeight(30) >= 4)
  assert.equal(bodyHeight(30) + panelHeight(30), 30 - 6)
})

// 목록이 3줄 밑으로 내려가는 쪽이 패널이 사라지는 것보다 나쁘다.
test('낮은 터미널에서는 패널이 사라지고 목록이 지면을 다 쓴다', () => {
  assert.equal(panelHeight(12), 0)
  assert.equal(bodyHeight(12), 12 - 6)
})

test('패널을 펼치면 목록 자리를 전부 가져간다', () => {
  assert.equal(bodyHeight(30, true), 0)
  assert.equal(panelHeight(30, true), 30 - 6)
})

test('화면 줄 수는 터미널 높이를 넘지 않고 어느 줄도 폭을 넘지 않는다', () => {
  const lines = render(createState(ROWS), { width: 60, height: 30, t: T })
  // 위아래 경계를 모두 잡는다 — 상한만 두면 빈 화면이 통과한다.
  assert.equal(lines.length, 30, `줄 수 ${lines.length}`)
  for (const line of lines) assert.ok(width(line) <= 60, `넘침: ${line}`)
})

test('커서 항목의 상세가 화면에 담긴다', () => {
  const text = render(createState(ROWS), { width: 60, height: 30, t: T }).join('\n')
  assert.match(text, /Alpha/)
  assert.match(text, /claude/)
})

test('고를 항목이 없으면 안내를 낸다', () => {
  const text = render(createState([]), { width: 60, height: 30, t: T }).join('\n')
  assert.match(text, /커서를 항목 위에/)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.render.test.mjs
```

기대: `panelHeight is not a function`으로 실패.

- [ ] **Step 3: 구현한다**

`agent-installer/lib/tui/render.mjs:20-26`을 갈아 끼운다.

```js
// 머리글·탭줄·검색줄·구분 공백·바닥글이 차지하는 줄 수.
const CHROME = 6
export const LABEL_WIDTH = 24

// 상세 패널은 목록과 화면을 나눠 갖는다. 높이를 커서가 아니라 **터미널
// 크기로만** 정하는 것이 핵심이다 — 커서를 옮길 때마다 높이가 변하면
// 목록이 출렁이고, 그것이 아코디언(행 펼침)을 기각한 이유였다.
const PANEL_SHARE = 0.4
const PANEL_MIN = 4
const PANEL_MAX = 12
// 목록이 3줄 밑으로 내려가는 쪽이 패널이 사라지는 것보다 나쁘다.
const PANEL_FLOOR = PANEL_MIN + 3

export function panelHeight(height, expanded = false) {
  const room = Math.max(0, height - CHROME)
  if (expanded) return room
  if (room < PANEL_FLOOR) return 0
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(room * PANEL_SHARE)))
}

export function bodyHeight(height, expanded = false) {
  const room = Math.max(0, height - CHROME)
  const panel = panelHeight(height, expanded)
  // 패널이 없을 때는 예전과 같이 최소 3줄을 보장한다.
  return panel === 0 ? Math.max(3, room) : room - panel
}
```

`render`(`:82-135`)의 옵션과 본문을 고친다. 옵션 구조 분해에 `detailExpanded`를 더한다.

```js
  const { width: columns = 80, height = 24, repo = '', dryRun = false, color = false, status = '', detailExpanded = false, t = createT('en') } = opts
```

목록을 그리는 블록(`:105-129`)의 `const body = bodyHeight(height)`를 바꾸고, 뒤에 패널을 붙인다.

```js
  const body = bodyHeight(height, detailExpanded)
  const all = displayList(state)

  if (all.length === 0) {
    if (body > 0) lines.push(paint(DIM, cut(searching ? t('tui.empty.filtered') : t('tui.empty.none'), w)))
    for (let i = 1; i < body; i++) lines.push('')
  } else {
    const window = all.slice(state.offset, state.offset + body)
    for (const entry of window) {
      if (entry.type === 'header') {
        const count = entry.shown === entry.total ? `${entry.total}` : `${entry.shown}/${entry.total}`
        lines.push(paint(DIM, cut(`  ${categoryLabel(t, entry.section)} (${count})`, w)))
        continue
      }
      const { row, index } = entry
      const here = index === state.cursor
      const hintWidth = Math.max(0, w - LABEL_WIDTH - 6)
      const text = cut(`${here ? '❯' : ' '} ${checkbox(row, state.selected)} ${pad(row.label, LABEL_WIDTH)} ${cut(row.hint, hintWidth)}`, w)
      lines.push(here ? paint(REVERSE, text) : text)
    }
    for (let i = window.length; i < body; i++) lines.push('')
  }

  // 상세 패널 — 목록 아래 고정 자리. 높이가 커서와 무관하므로 목록이
  // 출렁이지 않는다. 지면이 모자라면 panelHeight가 0을 돌려 통째로 빠진다.
  const panel = panelHeight(height, detailExpanded)
  if (panel > 0) {
    lines.push(paint(DIM, '─'.repeat(w)))
    const room = panel - 1
    const detail = detailLines(currentRow(state), { width: w, height: room, t })
    const shown = detail.length > 0 ? detail : [paint(DIM, cut(t('detail.empty'), w))]
    for (const line of shown.slice(0, room)) lines.push(line)
    for (let i = shown.length; i < room; i++) lines.push('')
  }
```

파일 위쪽 import를 넓힌다.

```js
import { displayList, tabCounts, activeTab, currentRow } from './state.mjs'
import { detailLines } from './detail.mjs'
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 7개 PASS. 기존 `bodyHeight(height)` 1인자 호출부(`run.mjs`)는 `expanded`가 기본 `false`라 그대로 동작한다.

- [ ] **Step 5: 커밋한다**

```bash
git add agent-installer/lib/tui/render.mjs agent-installer/test/tui.render.test.mjs
git commit -F - <<'EOF'
feat(installer): 목록 아래에 상세 패널 자리를 만든다

패널 높이를 커서가 아니라 터미널 크기로만 정한다. 커서를 옮길 때마다
높이가 변하면 목록이 출렁이는데, 그것이 행 펼침(아코디언)을 기각한
이유였다.

지면이 모자라면 패널을 통째로 뺀다 — 목록이 3줄 밑으로 내려가는 쪽이
더 나쁘다.
EOF
```

---

### Task 6: state.mjs — CLI 필터 축

**Files:**
- Modify: `agent-installer/lib/tui/state.mjs:20-34` (`createState`), `:50-69` (`visibleRows`·`tabCounts`), `:75-99` (`refocus` 계열), `:134-148` (`replaceRows`)
- Test: `agent-installer/test/tui.state.test.mjs` (추가)

**Interfaces:**
- Produces:
  - 상태에 `cliFilter: string | null` 필드
  - `setCliFilter(state, cli): state`
  - `cycleCliFilter(state, delta, options): state` — `options`는 `[null, ...CLI_IDS]` 배열
  - `matchesCli(row, cliFilter): boolean`
- **`state.mjs`는 계속 아무것도 import 하지 않는다.** CLI 목록은 인자로 받는다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.state.test.mjs` 끝에 추가한다.

```js
import { setCliFilter, cycleCliFilter, matchesCli } from '../lib/tui/state.mjs'

const CLI_ROWS = [
  { kind: 'action', id: 'action.bootstrap', section: 'action', group: null, label: '부트스트랩', hint: '', status: 'absent', searchText: '부트스트랩' },
  { kind: 'item', id: 'mcp.a', section: 'mcp', group: null, label: 'Alpha', hint: '', status: 'absent', searchText: 'alpha', item: { supports: ['claude'] } },
  { kind: 'item', id: 'mcp.b', section: 'mcp', group: null, label: 'Bravo', hint: '', status: 'absent', searchText: 'bravo', item: { supports: ['claude', 'codex'] } },
  { kind: 'item', id: 'design.x', section: 'design', group: 'Web', label: 'Xray', hint: '', status: 'absent', searchText: 'xray', item: { category: 'design' } },
]

const OPTIONS = [null, 'claude', 'codex']

test('필터가 없으면 전부 보인다', () => {
  const s = createState(CLI_ROWS)
  assert.equal(s.cliFilter, null)
  assert.equal(s.filtered.length, 1) // action 탭
})

test('필터는 그 CLI가 지원하는 항목만 남긴다', () => {
  const s = setTab(setCliFilter(createState(CLI_ROWS), 'codex'), 1)
  assert.deepEqual(s.filtered.map((r) => r.id), ['mcp.b'])
})

// 액션 행은 CLI 개념이 없고, design.md는 모든 CLI가 함께 읽는 문서다.
// 둘 다 필터에서 사라지면 화면에서 길이 끊긴다.
test('액션 행과 design 항목은 항상 통과한다', () => {
  assert.equal(matchesCli(CLI_ROWS[0], 'codex'), true)
  assert.equal(matchesCli(CLI_ROWS[3], 'codex'), true)
  assert.equal(matchesCli(CLI_ROWS[1], 'codex'), false)
})

test('탭 개수도 필터를 반영한다', () => {
  const s = setCliFilter(createState(CLI_ROWS), 'codex')
  const mcp = tabCounts(s).find((c) => c.tab === 'mcp')
  assert.equal(mcp.shown, 1)
  assert.equal(mcp.total, 2)
})

test('필터는 앞뒤로 순환한다', () => {
  let s = createState(CLI_ROWS)
  s = cycleCliFilter(s, 1, OPTIONS)
  assert.equal(s.cliFilter, 'claude')
  s = cycleCliFilter(s, 1, OPTIONS)
  assert.equal(s.cliFilter, 'codex')
  s = cycleCliFilter(s, 1, OPTIONS)
  assert.equal(s.cliFilter, null)
  s = cycleCliFilter(s, -1, OPTIONS)
  assert.equal(s.cliFilter, 'codex')
})

// setQuery와 같은 안전 규칙이다. 필터로 숨긴 설치본이 조용히 사라지면 안 된다.
test('필터를 걸어도 선택은 그대로다', () => {
  const s = createState(CLI_ROWS, { selectedIds: ['mcp.a', 'mcp.b'] })
  const filtered = setCliFilter(s, 'codex')
  assert.deepEqual([...filtered.selected].sort(), ['mcp.a', 'mcp.b'])
})

test('필터 중 전체 토글은 보이는 항목만 건드린다', () => {
  const s = setTab(setCliFilter(createState(CLI_ROWS, { selectedIds: ['mcp.a', 'mcp.b'] }), 'codex'), 1)
  const off = toggleVisible(s, false)
  assert.deepEqual([...off.selected], ['mcp.a'])
})

test('행을 갈아끼워도 필터가 유지된다', () => {
  const s = setCliFilter(createState(CLI_ROWS), 'codex')
  assert.equal(replaceRows(s, CLI_ROWS, []).cliFilter, 'codex')
})
```

파일 위쪽 import에 `toggleVisible`, `replaceRows`, `tabCounts`, `setTab`이 없으면 더한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.state.test.mjs
```

기대: `setCliFilter is not a function`으로 실패.

- [ ] **Step 3: 구현한다**

`agent-installer/lib/tui/state.mjs`의 `createState`(`:20-34`)를 고친다.

```js
export function createState(rows, { selectedIds = [], query = '', tabIndex = 0, focus = 'list', cliFilter = null } = {}) {
  const tabs = tabsOf(rows)
  const index = clamp(tabIndex, 0, Math.max(0, tabs.length - 1))
  return {
    rows,
    tabs,
    tabIndex: index,
    focus,
    query,
    cliFilter,
    filtered: visibleRows(rows, query, tabs[index], cliFilter),
    selected: new Set(selectedIds),
    cursor: 0,
    offset: 0,
  }
}
```

`visibleRows`(`:53-55`) 앞에 판정을 두고 함께 고친다.

```js
// CLI 필터 통과 판정. 액션 행은 CLI 개념이 없고(설치가 아니라 실행이다),
// design.md는 모든 CLI가 함께 읽는 문서라 supports를 갖지 않는다.
// 둘을 걸러 내면 필터를 건 순간 화면에서 길이 끊긴다.
export function matchesCli(row, cliFilter) {
  if (!cliFilter) return true
  if (row.kind !== 'item') return true
  const supports = row.item?.supports
  if (!supports) return true
  return supports.includes(cliFilter)
}

// 화면에 실제로 보이는 행 = 활성 탭 ∩ 검색 결과 ∩ CLI 필터.
function visibleRows(rows, query, tab, cliFilter) {
  return filterRows(rows, query).filter((row) => row.section === tab && matchesCli(row, cliFilter))
}
```

`tabCounts`(`:62-69`)가 같은 필터를 타게 한다.

```js
// 탭별 적중 수 — 검색·필터 중에도 어느 탭에 결과가 있는지 한눈에 보이게 한다.
// total은 필터를 타지 않는다: 분모가 함께 줄면 "이 탭에서 몇 개가 걸러졌나"를
// 알 수 없다.
export function tabCounts(state) {
  const hits = filterRows(state.rows, state.query).filter((r) => matchesCli(r, state.cliFilter))
  return state.tabs.map((tab) => ({
    tab,
    shown: hits.filter((r) => r.section === tab).length,
    total: state.rows.filter((r) => r.section === tab).length,
  }))
}
```

`refocus`(`:75-78`)가 필터를 함께 넘기게 한다.

```js
function refocus(state, patch) {
  const next = { ...state, ...patch }
  return { ...next, filtered: visibleRows(next.rows, next.query, activeTab(next), next.cliFilter), cursor: 0, offset: 0 }
}
```

`setTab`(`:95-99`) 아래에 필터 전이를 더한다.

```js
// 필터를 바꾸면 커서는 첫 행으로 돌아간다. selected는 절대 건드리지 않는다 —
// setQuery와 같은 규칙이다. 화면 밖 설치본이 조용히 사라지지 않게 하는 핵심이다.
export function setCliFilter(state, cliFilter) {
  return cliFilter === state.cliFilter ? state : refocus(state, { cliFilter })
}

// 순환 대상은 [null, ...CLI_IDS]다. 이 모듈은 아무것도 import 하지 않으므로
// 목록을 인자로 받는다 — 그 규칙이 이 파일을 순수하게 지켜 준다.
export function cycleCliFilter(state, delta, options) {
  if (!options || options.length === 0) return state
  const at = options.indexOf(state.cliFilter ?? null)
  const n = options.length
  const next = options[((((at === -1 ? 0 : at) + delta) % n) + n) % n]
  return setCliFilter(state, next ?? null)
}
```

`replaceRows`(`:134-148`)가 필터를 유지하게 한다.

```js
export function replaceRows(state, rows, selectedIds) {
  const tabs = tabsOf(rows)
  const tabIndex = clamp(tabs.indexOf(activeTab(state)), 0, Math.max(0, tabs.length - 1))
  const filtered = visibleRows(rows, state.query, tabs[tabIndex], state.cliFilter)
  return {
    ...state,
    rows,
    tabs,
    tabIndex,
    filtered,
    selected: new Set(selectedIds),
    cursor: clamp(state.cursor, 0, Math.max(0, filtered.length - 1)),
    offset: 0,
  }
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 8개 PASS.

- [ ] **Step 5: state.mjs가 여전히 아무것도 import 하지 않는지 확인한다**

```bash
grep -n "^import" agent-installer/lib/tui/state.mjs
```

기대: 출력 없음.

- [ ] **Step 6: 커밋한다**

```bash
git add agent-installer/lib/tui/state.mjs agent-installer/test/tui.state.test.mjs
git commit -F - <<'EOF'
feat(installer): 목록에 CLI 필터 축을 더한다

"내 CLI엔 뭐가 들어가나"를 볼 방법이 없었다. 활성 탭 ∩ 검색에 CLI를
한 축으로 더해 그 CLI가 받는 항목만 남긴다.

액션 행과 design.md는 항상 통과시킨다 — 전자는 CLI 개념이 없고 후자는
모든 CLI가 함께 읽는 문서다. 탭 개수의 분모는 필터를 타지 않는다:
함께 줄면 몇 개가 걸러졌는지 알 수 없다.

state.mjs는 계속 아무것도 import 하지 않는다. 순환 목록은 인자로 받는다.
EOF
```

---

### Task 7: 필터 줄과 키 배선

**Files:**
- Modify: `agent-installer/lib/tui/render.mjs:71-80` (`searchLine`), `:98-103` (머리 줄)
- Modify: `agent-installer/lib/tui/run.mjs:102-106` (`paint`), `:181-281` (키 루프)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/tui.render.test.mjs`, `agent-installer/test/tui.run.test.mjs` (추가)

**Interfaces:**
- Consumes: `cycleCliFilter`·`matchesCli` (Task 6), `panelHeight` (Task 5), `CLI_IDS` (clis.mjs)
- Produces: `filterSegment(state, { width, color, t }): string` (`render.mjs`)

- [ ] **Step 1: i18n 키를 더한다**

`en.mjs`의 `'tui.lang.overridden'` 아래:

```js
  'tui.filter.prefix': 'CLI › ',
  'tui.filter.all': 'all',
  'tui.filter.position': '{current}/{total}',
  'tui.filter.empty': '  Nothing in this tab is wired for {cli}.',
  'tui.hint.list': 'Space select   ↑↓ move (↑ at top = search)   Tab tab   Enter run/submit   Ctrl+A all   Ctrl+O preview   Ctrl+F CLI   Ctrl+D detail',
  'tui.hint.search': 'type to search (spaces included)   ↓ to list   Tab tab   Esc clear   Ctrl+F CLI   Ctrl+D detail',
```

`tui.hint.list`·`tui.hint.search`는 **기존 키를 갈아 끼우는 것**이다. 새로 더하지 말고 기존 줄을 바꾼다.

`ko.mjs`의 같은 자리:

```js
  'tui.filter.prefix': 'CLI › ',
  'tui.filter.all': '전체',
  'tui.filter.position': '{current}/{total}',
  'tui.filter.empty': '  이 탭에는 {cli}에 배선되는 항목이 없습니다.',
  'tui.hint.list': 'Space 선택   ↑↓ 이동   Tab 탭   Enter 실행/제출   Ctrl+A 전체   Ctrl+O 미리보기   Ctrl+F CLI   Ctrl+D 상세',
  'tui.hint.search': '입력=검색어   ↓ 목록으로   Tab 탭이동   Esc 검색해제   Ctrl+F CLI   Ctrl+D 상세',
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.render.test.mjs` 끝에 추가한다.

```js
import { setCliFilter, setFocus, setQuery } from '../lib/tui/state.mjs'
import { CLI_IDS } from '../lib/clis.mjs'

// 순환 목록은 [null, ...CLI_IDS]다 — codex는 세 번째(전체·claude 다음)다.
test('필터가 걸리면 검색줄 오른쪽에 CLI와 위치가 보인다', () => {
  const s = setCliFilter(createState(ROWS), 'codex')
  const text = render(s, { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] }).join('\n')
  assert.match(text, /CLI › codex/)
  assert.ok(text.includes(`3/${CLI_IDS.length + 1}`), '순환 위치가 보여야 한다')
})

// 검색칸 반전이 줄 끝까지 칠하면 오른쪽 필터 표시가 반전에 먹힌다.
test('검색칸 포커스에서도 필터 표시가 반전 밖에 남는다', () => {
  const s = setFocus(setCliFilter(createState(ROWS), 'codex'), 'search')
  const line = render(s, { width: 80, height: 30, color: true, t: T, cliOptions: [null, ...CLI_IDS] })[2]
  const RESET = `${String.fromCharCode(27)}[0m`
  const at = line.indexOf('CLI › codex')
  assert.ok(at !== -1, '필터 표시가 있어야 한다')
  const resetBefore = line.lastIndexOf(RESET, at)
  assert.ok(resetBefore !== -1 && resetBefore < at, '필터는 반전이 끝난 뒤에 와야 한다')
})

// 폭이 모자라면 검색이 이긴다 — 타이핑 중인 글자가 사라지면 안 된다.
test('좁은 폭에서는 필터 표시를 버리고 검색칸을 남긴다', () => {
  const s = setQuery(setCliFilter(createState(ROWS), 'codex'), 'alp')
  const lines = render(s, { width: 26, height: 30, t: T, cliOptions: [null, ...CLI_IDS] })
  const text = lines.join('\n')
  // 버렸다는 것을 직접 못박는다 — 폭 검사만으로는 필터가 그려졌는지 알 수 없다.
  assert.ok(!text.includes('CLI › codex'), '좁은 폭에서는 필터를 버려야 한다')
  assert.ok(text.includes('alp'), '검색어는 남아야 한다')
  for (const line of lines) assert.ok(width(line) <= 26, `넘침: ${line}`)
})

test('필터로 탭이 비면 그 사실을 알린다', () => {
  const s = setCliFilter(createState(ROWS), 'kiro')
  const text = render(s, { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] }).join('\n')
  assert.match(text, /kiro에 배선되는 항목이 없습니다/)
})
```

`agent-installer/test/tui.run.test.mjs` 끝에 추가한다. 이 파일에는 이미 가짜 TTY 하네스 `drive(keys, opts)`가 있고 `{ result, frames, screen, lastListFrame, log }`를 돌려준다. 키 상수(`TAB`·`ESC`·`SPACE`·`ENTER`·`ANY`)와 `type(text)` 헬퍼도 파일 위쪽에 있다 — 그대로 쓴다.

```js
const CTRL_F = { name: 'f', ctrl: true }

// 글자 키는 전부 검색에 양보한다는 규칙이 이 TUI의 뼈대다. c를 필터에
// 배정하면 codex·claude를 검색어로 칠 수 없다.
// ESC 세 번: 검색어 지우기 → 목록으로 → 종료.
test('c와 d는 필터 키가 아니라 검색어로 들어간다', async () => {
  const { screen } = await drive([...type('cd'), ESC, ESC, ESC])
  assert.ok(screen.includes('검색 › cd'), 'cd가 검색어로 들어가야 한다')
  assert.ok(!screen.includes('CLI › c'), 'CLI 필터가 걸리면 안 된다')
})

test('Ctrl+F가 CLI 필터를 돌린다', async () => {
  const { screen } = await drive([CTRL_F, ESC])
  assert.ok(screen.includes('CLI › claude'), '첫 순환은 claude여야 한다')
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.render.test.mjs test/tui.run.test.mjs
```

기대: 필터 관련 4~5개 실패.

- [ ] **Step 4: `render.mjs`에 필터 줄을 붙인다**

`searchLine`(`:71-80`)을 갈아 끼운다.

```js
// 필터 표시. 검색줄 오른쪽 끝에 붙는다 — 새 줄을 만들면 CHROME이 늘어
// 목록이 그만큼 준다. 필터가 없으면 아무것도 내지 않는다(잡음 방지).
export function filterSegment(state, { color = false, t = createT('en'), options = [] } = {}) {
  if (!state.cliFilter) return ''
  const at = options.indexOf(state.cliFilter)
  const pos = at === -1 ? '' : ` (${t('tui.filter.position', { current: at + 1, total: options.length })})`
  const text = `${t('tui.filter.prefix')}${state.cliFilter}${pos}`
  return color ? `${BOLD}${text}${RESET}` : text
}

// 검색줄 = 하나의 입력칸이다. 포커스가 여기 있으면 입력 커서(▌)로 드러내고,
// 컬러에서는 입력 영역을 반전시켜 "지금 여기에 타이핑된다"를 분명히 한다 —
// 이 상태에서만 스페이스가 선택이 아니라 검색어로 들어가기 때문이다.
//
// 반전은 **입력 영역까지만** 칠한다. 줄 끝까지 채워 반전시키면 오른쪽 필터
// 표시가 반전에 먹혀 읽히지 않는다.
function searchLine(state, { limit, color, paint, t, filter = '' }) {
  const prefix = t('tui.search.prefix')
  const tail = filter ? `  ${filter}` : ''
  // 색 코드는 폭에 들어가면 안 되므로 색을 입히기 전 문자열로 잰다.
  const tailWidth = filter ? width(filter) + 2 : 0
  const room = Math.max(0, limit - width(prefix) - tailWidth)

  // 필터를 넣을 자리가 없으면 필터를 버린다 — 타이핑 중인 글자가 사라지는
  // 쪽이 더 나쁘다. 탭 줄의 shown/total 표기가 필터가 걸려 있음을 이미 알린다.
  if (room < 8) return searchLine(state, { limit, color, paint, t, filter: '' })

  if (state.focus === 'search') {
    const field = `${prefix}${cut(`${state.query}▌`, room)}`
    const body = color ? `${REVERSE}${pad(field, limit - tailWidth)}${RESET}` : field
    return `${body}${tail}`
  }
  const body = state.query
    ? `${prefix}${cut(state.query, room)}`
    : `${prefix}${paint(DIM, cut(t('tui.search.placeholder'), room))}`
  return `${body}${tail}`
}
```

`render`의 옵션에 `cliOptions`를 더하고 검색줄 호출을 고친다.

```js
  const { width: columns = 80, height = 24, repo = '', dryRun = false, color = false, status = '', detailExpanded = false, cliOptions = [], t = createT('en') } = opts
```

```js
  const filter = filterSegment(state, { color, t, options: cliOptions })
  const lines = [
    color ? `${BOLD}${title}${RESET}${cut(`  ${counts}  ${repo}`, Math.max(0, w - width(title)))}` : head,
    tabBar(state, { width: w, color, searching, t }),
    searchLine(state, { limit: w, color, paint, t, filter }),
    '',
  ]
```

빈 목록 안내를 필터 상황까지 구분한다(`:108-110`).

```js
  if (all.length === 0) {
    const empty = state.cliFilter
      ? t('tui.filter.empty', { cli: state.cliFilter })
      : searching ? t('tui.empty.filtered') : t('tui.empty.none')
    if (body > 0) lines.push(paint(DIM, cut(empty, w)))
    for (let i = 1; i < body; i++) lines.push('')
  } else {
```

- [ ] **Step 5: `run.mjs`에 키를 배선한다**

`agent-installer/lib/tui/run.mjs` 위쪽 import에 더한다.

```js
import { CLI_IDS } from '../clis.mjs'
import {
  createState, setQuery, setFocus, move, moveTab, toggle, toggleVisible, scroll, currentRow, replaceRows, activeTab,
  cycleCliFilter,
} from './state.mjs'
```

`runTui` 안, `let status = ''` 근처에 더한다.

```js
  // 순환 대상: 전체(null) + CLI 10개. state.mjs는 아무것도 import 하지 않으므로
  // 목록을 여기서 만들어 넘긴다.
  const CLI_OPTIONS = [null, ...CLI_IDS]
  let detailExpanded = false
```

`paint`(`:102-106`)를 고친다.

```js
  const paint = () => {
    const height = stdout.rows ?? 24
    state = scroll(state, bodyHeight(height, detailExpanded))
    draw(render(state, {
      width: stdout.columns ?? 80, height, repo: root, dryRun, color, status, t,
      detailExpanded, cliOptions: CLI_OPTIONS,
    }))
  }
```

키 루프에서 **검색칸 분기와 목록 분기 양쪽보다 앞에** 공통 처리를 둔다. `if (key.ctrl && key.name === 'c') break` 바로 아래에 넣는다.

```js
      // Ctrl 조합은 두 포커스에서 모두 통한다 — 검색으로 좁힌 직후가 CLI
      // 필터를 겹쳐 걸고 싶은 순간이다. 글자 키(c·d)를 쓰지 않는 이유는
      // 목록 포커스에서 아무 글자나 누르면 검색칸으로 올라가기 때문이다:
      // c를 필터에 배정하면 codex·claude를 검색어로 칠 수 없다.
      if (key.ctrl && (key.name === 'f' || key.name === 'b')) {
        state = cycleCliFilter(state, key.name === 'f' ? 1 : -1, CLI_OPTIONS)
        continue
      }
      if (key.ctrl && key.name === 'd') { detailExpanded = !detailExpanded; continue }
```

`pageup`/`pagedown`의 `bodyHeight(stdout.rows ?? 24)` 두 곳(`:224-225`)에 `detailExpanded`를 넘긴다.

```js
      if (key.name === 'pageup') { state = move(state, -bodyHeight(stdout.rows ?? 24, detailExpanded)); continue }
      if (key.name === 'pagedown') { state = move(state, bodyHeight(stdout.rows ?? 24, detailExpanded)); continue }
```

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 5개 PASS, 기존 전부 통과.

- [ ] **Step 7: 커밋한다**

```bash
git add agent-installer/lib/tui/render.mjs agent-installer/lib/tui/run.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/test/tui.render.test.mjs agent-installer/test/tui.run.test.mjs
git commit -F - <<'EOF'
feat(installer): CLI 필터 줄과 상세 펼치기를 배선한다

Ctrl+F/Ctrl+B로 CLI를 앞뒤로 돌리고 Ctrl+D로 상세를 전체 화면까지
펼친다. 글자 키를 쓰지 않는 이유는 목록에서 아무 글자나 누르면
검색칸으로 올라가는 규칙 때문이다 — c를 배정하면 codex를 검색할 수 없다.

필터는 검색줄 오른쪽에 붙인다. 새 줄을 만들면 목록이 그만큼 준다.
검색칸 반전을 입력 영역까지로 좁혀 필터 표시가 먹히지 않게 했다.
EOF
```

---

### Task 8: makeExec 비동기화

진행율의 근원 문제다. `execFileSync`가 이벤트 루프를 통째로 막아, `npx`가 도는 수십 초 동안 어떤 화면 갱신도 물리적으로 불가능하다.

**Files:**
- Modify: `agent-installer/lib/catalog.mjs:1-8` (import), `:61-84` (`makeExec`), `:131-145`·`:196-212` (호출부 5곳)
- Modify: `agent-installer/lib/items/skill.gstack.mjs:22,24,37`
- Modify: `agent-installer/lib/items/plugin.ponytail.mjs:70,71,89`
- Modify: `agent-installer/lib/items/skill.gsd.mjs:18,22`
- Test: `agent-installer/test/catalog.test.mjs:79,109,119` (비동기화), 신규 회귀 테스트

**Interfaces:**
- Produces: `makeExec(dryRun, log): (cmd, args, opts) => Promise<{ ok: boolean, output: string }>`
- 모든 항목의 `install`/`uninstall`은 이미 `async`라 시그니처는 바뀌지 않는다.

- [ ] **Step 1: 회귀 테스트를 먼저 쓴다**

`agent-installer/test/catalog.test.mjs` 끝에 추가한다.

```js
// await를 빠뜨린 자리는 { ok, output } 대신 Promise를 받는다. r.ok가
// undefined라 `if (!r.ok)` 폴백이 늘 돌고, 실패가 성공으로 읽힌다.
// 사람 눈으로는 놓치기 쉬워 소스에서 직접 잡는다.
test('exec 호출은 전부 await한다', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const lib = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib')
  const files = [
    join(lib, 'catalog.mjs'),
    ...readdirSync(join(lib, 'items')).map((f) => join(lib, 'items', f)),
  ]
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      // 정의부(`(cmd, args, opts)` 꼴)와 주석은 건너뛴다.
      if (!/\bexec\(/.test(line) || /^\s*\/\//.test(line) || /=>/.test(line)) return
      assert.match(line, /await exec\(/, `${file}:${i + 1} — await 없는 exec: ${line.trim()}`)
    })
  }
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/catalog.test.mjs
```

기대: `await 없는 exec`로 13곳 중 첫 번째에서 실패.

- [ ] **Step 3: `makeExec`를 비동기로 바꾼다**

`agent-installer/lib/catalog.mjs:4`의 import를 바꾼다.

```js
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
```

(`execFileSync` import는 지운다.)

`:61-84`의 `makeExec`를 갈아 끼운다.

```js
const execFileAsync = promisify(execFile)

// 비동기다. 동기 실행은 이벤트 루프를 통째로 막아, npx가 도는 수십 초 동안
// 진행 화면을 한 번도 다시 그릴 수 없었다. 반환 형태({ ok, output })는
// 그대로라 호출부는 await만 더하면 된다.
export function makeExec(dryRun, log = console.log) {
  return async (cmd, args, opts = {}) => {
    if (dryRun) {
      log(`  [dry-run] ${cmd} ${args.join(' ')}`)
      return { ok: true, output: '' }
    }
    // Windows에서는 npx/claude가 .cmd 심이라 shell 경유가 필요하다.
    const shell = opts.shell ?? process.platform === 'win32'
    // shell + 인자 배열을 함께 넘기면 Node가 DEP0190으로 경고한다(인자가 quote 없이 이어붙기 때문).
    // 어차피 우리가 직접 quote하므로, 완성된 한 줄 명령을 넘기고 인자 배열은 비운다.
    const [file, fileArgs] = shell ? [[cmd, ...args].map((s) => shellQuote(s)).join(' '), []] : [cmd, args]
    try {
      const { stdout } = await execFileAsync(file, fileArgs, {
        encoding: 'utf8',
        ...opts,
        shell,
      })
      return { ok: true, output: stdout }
    } catch (err) {
      return { ok: false, output: String(err.stderr ?? err.message) }
    }
  }
}
```

`stdio` 옵션은 넘기지 않는다 — `execFile`은 기본으로 stdout·stderr를 버퍼에 담는다.

- [ ] **Step 4: 호출부 13곳에 await를 더한다**

`agent-installer/lib/catalog.mjs`:

```js
    async install(ctx) {
      const { root, dryRun, exec } = ctx
      if (marketplace) await exec('claude', ['plugin', 'marketplace', 'add', marketplace.repo], { cwd: root })
      const r = await exec('claude', ['plugin', 'install', installId, '--scope', 'project'], { cwd: root })
      if (!r.ok) {
        if (!dryRun) enablePlugin(root, installId, marketplace)
        return { fallback: true, message: msg('item.plugin.deferred') }
      }
    },
    async uninstall(ctx) {
      const { root, dryRun, exec } = ctx
      const r = await exec('claude', ['plugin', 'uninstall', installId], { cwd: root })
      if (!r.ok && !dryRun) disablePlugin(root, detectIds)
    },
```

```js
    async install({ root, exec }) {
      const r = await exec('npx', ['-y', 'skills@latest', 'add', source, '--skill', skill, '--agent', 'universal', '--yes', '--copy'], { cwd: root })
      if (!r.ok) throw new LocalizedError('error.registrySkillInstall', { skill, output: r.output })
    },
    async uninstall({ root, dryRun, exec }) {
      await exec('npx', ['-y', 'skills@latest', 'remove', skill, '--agent', 'universal', '--yes'], { cwd: root })
      if (dryRun) return
      const dir = findSkillDir(root, skill)
      if (dir) rmSync(repoPathStrict(root, `${SHARED_SKILLS}/${dir}`), { recursive: true, force: true })
    },
```

`agent-installer/lib/items/plugin.ponytail.mjs:70,71,89` — 세 `exec(` 앞에 `await`를 넣는다.
`agent-installer/lib/items/skill.gsd.mjs:18,22` — 두 곳.
`agent-installer/lib/items/skill.gstack.mjs:22,24,37` — 세 곳.

각 파일에서 `exec(`를 찾아 `await exec(`로 바꾼다. 함수는 이미 `async`이므로 다른 변경은 없다.

- [ ] **Step 5: 기존 exec 테스트를 비동기로 고친다**

`agent-installer/test/catalog.test.mjs:79,109,119`의 세 곳을 고친다. 테스트 함수에 `async`를 달고 호출에 `await`를 넣는다.

```js
  const r = await exec(process.execPath, ['-e', 'console.log(process.argv[1])', 'a b c'])
```

```js
  const r = await exec(process.execPath, ['-e', 'console.log(process.argv[1])', nasty], { shell: true })
```

```js
    const r = await exec(process.execPath, ['-e', 'console.log(process.argv[1])', 'a b c'], { shell: true })
```

각 호출을 감싼 `test(...)` 콜백이 `async`인지 확인하고, 아니면 `async`를 단다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 전부 통과. 특히 `exec 호출은 전부 await한다`가 PASS.

- [ ] **Step 7: 커밋한다**

```bash
git add agent-installer/lib/catalog.mjs agent-installer/lib/items agent-installer/test/catalog.test.mjs
git commit -F - <<'EOF'
refactor(installer): 외부 명령 실행을 비동기로 바꾼다

execFileSync가 이벤트 루프를 통째로 막아, npx가 도는 수십 초 동안
화면을 한 번도 다시 그릴 수 없었다. 진행율을 실시간으로 보여 주려면
여기가 먼저 풀려야 한다.

반환 형태는 그대로라 호출부 13곳에 await만 더했다. await를 빠뜨리면
r.ok가 undefined가 되어 실패가 조용히 성공으로 읽히므로, 소스에서
직접 잡는 회귀 테스트를 함께 둔다.
EOF
```

---

### Task 9: engine.apply — 진행 알림과 중단

**Files:**
- Modify: `agent-installer/lib/engine.mjs:28-48` (`apply`)
- Test: `agent-installer/test/engine.test.mjs` (추가)

**Interfaces:**
- Consumes: 비동기 `exec` (Task 8)
- Produces: `apply(root, changes, { dryRun, log, t, onProgress, shouldStop })`
  - `onProgress({ index, total, item, action, phase })` — `phase`는 `'start' | 'command' | 'done'`
  - `'command'`일 때 `command: string` 추가, `'done'`일 때 `ok: boolean`·`ms: number`·`message` 추가
  - `shouldStop(): boolean` — **항목 경계에서만** 본다
  - 결과 원소에 `skipped: true`가 붙을 수 있다

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/engine.test.mjs` 끝에 추가한다.

```js
function fakeItem(id, { fails = false, runs = null } = {}) {
  return {
    id, label: id, category: 'mcp', scope: 'project', supports: ['claude'], unsupported: {},
    async detect() { return { status: 'absent' } },
    async install(ctx) {
      if (runs) await ctx.exec(runs[0], runs.slice(1))
      if (fails) throw new Error('boom')
    },
    async uninstall() {},
  }
}

test('항목마다 시작과 끝을 알린다', async () => {
  const changes = [
    { item: fakeItem('a'), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
  ]
  const events = []
  await apply('/tmp/x', changes, { dryRun: true, log: () => {}, onProgress: (e) => events.push(e) })
  assert.deepEqual(events.map((e) => `${e.phase}:${e.item.id}`), ['start:a', 'done:a', 'start:b', 'done:b'])
  assert.deepEqual(events.filter((e) => e.phase === 'start').map((e) => e.index), [0, 1])
  assert.equal(events[0].total, 2)
})

test('실패해도 다음 항목으로 이어지고 done이 그 사실을 담는다', async () => {
  const changes = [
    { item: fakeItem('a', { fails: true }), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
  ]
  const events = []
  const results = await apply('/tmp/x', changes, { dryRun: true, log: () => {}, onProgress: (e) => events.push(e) })
  assert.equal(events.find((e) => e.phase === 'done' && e.item.id === 'a').ok, false)
  assert.equal(results.length, 2)
})

// 화면이 "지금 무엇이 도는가"를 보여 줄 수 있는 유일한 경로다.
test('실행 직전에 명령을 알린다', async () => {
  const changes = [{ item: fakeItem('a', { runs: ['npx', '-y', 'thing'] }), action: 'install' }]
  const events = []
  await apply('/tmp/x', changes, { dryRun: true, log: () => {}, onProgress: (e) => events.push(e) })
  const cmd = events.find((e) => e.phase === 'command')
  assert.equal(cmd.command, 'npx -y thing')
})

// 외부 명령을 중간에 죽이면 반쯤 설치된 상태가 남는다. 그래서 항목 경계에서만 멈춘다.
test('중단 요청은 현재 항목을 마친 뒤 나머지를 건너뛴다', async () => {
  const changes = [
    { item: fakeItem('a'), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
    { item: fakeItem('c'), action: 'install' },
  ]
  let seen = 0
  const results = await apply('/tmp/x', changes, {
    dryRun: true, log: () => {},
    onProgress: (e) => { if (e.phase === 'done') seen++ },
    shouldStop: () => seen >= 1,
  })
  assert.equal(results.filter((r) => r.skipped).length, 2)
  assert.equal(results[0].skipped, undefined)
})

test('onProgress 없이도 예전과 같이 동작한다', async () => {
  const changes = [{ item: fakeItem('a'), action: 'install' }]
  const results = await apply('/tmp/x', changes, { dryRun: true, log: () => {} })
  assert.equal(results.length, 1)
  assert.equal(results[0].ok, true)
})
```

파일 위쪽 import에 `apply`가 없으면 더한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/engine.test.mjs
```

기대: `onProgress is not a function` 또는 이벤트 배열이 비어 실패.

- [ ] **Step 3: 구현한다**

`agent-installer/lib/engine.mjs:28-48`의 `apply`를 갈아 끼운다.

```js
export async function apply(root, changes, { dryRun = false, log = console.log, t = createT('en'), onProgress = null, shouldStop = null } = {}) {
  const baseExec = makeExec(dryRun, log)
  const results = []
  const total = changes.length
  const notify = (event) => { if (onProgress) onProgress({ total, ...event }) }

  for (let index = 0; index < total; index++) {
    const { item, action } = changes[index]

    // 중단은 **항목 경계에서만** 본다. 외부 명령을 중간에 죽이면 반쯤 설치된
    // 상태가 남는다 — 그래서 AbortSignal이 아니라 술어(predicate)다.
    if (shouldStop && shouldStop()) {
      results.push({ item, action, ok: false, skipped: true })
      continue
    }

    notify({ index, item, action, phase: 'start' })
    const startedAt = Date.now()

    // 화면이 "지금 무엇이 도는가"를 보여 줄 수 있는 유일한 경로다.
    const exec = async (cmd, args, opts) => {
      notify({ index, item, action, phase: 'command', command: [cmd, ...args].join(' ') })
      return baseExec(cmd, args, opts)
    }

    // log까지 넘긴다 — 파일을 직접 쓰는 항목(MCP·design.md)은 exec를 거치지
    // 않아 dry-run에서 아무것도 보고하지 못했다.
    const ctx = { root, dryRun, exec, log, t }
    let result
    try {
      const fn = action === 'uninstall' ? item.uninstall : item.install
      const r = await fn.call(item, ctx)
      result = { item, action, ok: true, message: r?.message }
    } catch (err) {
      // LocalizedError는 .key를 들고 있다 — 구조체로 옮겨 담아야 표시하는
      // 쪽에서 toText로 활성 로케일에 맞게 다시 렌더할 수 있다.
      result = { item, action, ok: false, message: err.key ? msg(err.key, err.params) : err.message }
    }
    results.push(result)
    notify({ index, item, action, phase: 'done', ok: result.ok, ms: Date.now() - startedAt, message: result.message })
  }
  return results
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 5개 PASS, 기존 전부 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add agent-installer/lib/engine.mjs agent-installer/test/engine.test.mjs
git commit -F - <<'EOF'
feat(installer): 적용이 진행 상황을 알리게 한다

항목마다 시작·끝을, 외부 명령은 실행 직전에 알린다. 화면이 "지금
무엇이 도는가"를 보여 줄 수 있는 유일한 경로다.

중단은 항목 경계에서만 본다 — 외부 명령을 중간에 죽이면 반쯤 설치된
상태가 남기 때문이다. 그래서 AbortSignal이 아니라 술어로 받는다.
onProgress를 안 넘기면 예전과 완전히 같이 동작한다.
EOF
```

---

### Task 10: tui/progress.mjs — 진행 화면

**Files:**
- Create: `agent-installer/lib/tui/progress.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/tui.progress.test.mjs` (신규)

**Interfaces:**
- Consumes: `cut`·`pad`·`width` (`lib/width.mjs`)
- Produces:
  - `createProgress(changes): Progress` — `{ total, entries, startedAt: null, aborted: false }`
  - `applyEvent(progress, event, now): Progress` — 순수. `Task 9`의 이벤트를 받는다
  - `progressLines(progress, { width, height, color, dryRun, now, t }): string[]`
  - `plainLine(progress, event, t): string | null` — 비TTY용 한 줄

- [ ] **Step 1: i18n 키를 더한다**

`en.mjs`:

```js
  'progress.title': 'Applying — {count} change(s){suffix}',
  'progress.counter': '{done}/{total}  {percent}%',
  'progress.elapsed': '{seconds}s',
  'progress.elapsedMin': '{minutes}m{seconds}s',
  'progress.running': '{seconds}s elapsed',
  'progress.more': '  …and {count} more',
  'progress.abortHint': 'Ctrl+C stops after the current item',
  'progress.aborted': 'Stopped — {count} item(s) skipped',
  'progress.skipped': 'skipped',
  'progress.done': 'Done — {ok} succeeded, {failed} failed{skippedSuffix}',
  'progress.doneSkipped': ', {count} skipped',
  'progress.plain': '[{index}/{total}] {action} {label}',
  'progress.plainDone': '      {mark} {seconds}s',
```

`ko.mjs`:

```js
  'progress.title': '적용 중 — 변경 {count}건{suffix}',
  'progress.counter': '{done}/{total}  {percent}%',
  'progress.elapsed': '{seconds}초',
  'progress.elapsedMin': '{minutes}분{seconds}초',
  'progress.running': '{seconds}초 경과',
  'progress.more': '  …외 {count}건',
  'progress.abortHint': 'Ctrl+C 중단 (현재 항목까지 마칩니다)',
  'progress.aborted': '중단했습니다 — {count}건 건너뜀',
  'progress.skipped': '건너뜀',
  'progress.done': '끝났습니다 — 성공 {ok}건, 실패 {failed}건{skippedSuffix}',
  'progress.doneSkipped': ', 건너뜀 {count}건',
  'progress.plain': '[{index}/{total}] {action} {label}',
  'progress.plainDone': '      {mark} {seconds}초',
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.progress.test.mjs`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgress, applyEvent, progressLines, plainLine } from '../lib/tui/progress.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'

const T = createT('ko')
const CHANGES = [
  { item: { id: 'a', label: 'Alpha' }, action: 'install' },
  { item: { id: 'b', label: 'Bravo' }, action: 'install' },
  { item: { id: 'c', label: 'Caesar' }, action: 'uninstall' },
]

function feed(events, now = 1000) {
  let p = createProgress(CHANGES)
  for (const e of events) p = applyEvent(p, { total: CHANGES.length, ...e }, now)
  return p
}

test('시작 전에는 0%다', () => {
  const text = progressLines(createProgress(CHANGES), { width: 60, height: 20, now: 0, t: T }).join('\n')
  assert.match(text, /0\/3/)
  assert.match(text, /변경 3건/)
})

test('완료 수만큼 백분율이 오른다', () => {
  const p = feed([
    { index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' },
    { index: 0, phase: 'done', item: CHANGES[0].item, action: 'install', ok: true, ms: 400 },
  ])
  const text = progressLines(p, { width: 60, height: 20, now: 2000, t: T }).join('\n')
  assert.match(text, /1\/3/)
  assert.match(text, /33%/)
})

// 지금 무엇이 도는지가 가장 알고 싶은 정보다.
test('실행 중 항목과 명령을 보여 준다', () => {
  const p = feed([
    { index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' },
    { index: 0, phase: 'command', item: CHANGES[0].item, action: 'install', command: 'npx -y thing' },
  ], 1000)
  const text = progressLines(p, { width: 60, height: 20, now: 15000, t: T }).join('\n')
  assert.match(text, /Alpha/)
  assert.match(text, /npx -y thing/)
  assert.match(text, /14초 경과/)
})

test('실패는 실패로 표시된다', () => {
  const p = feed([
    { index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' },
    { index: 0, phase: 'done', item: CHANGES[0].item, action: 'install', ok: false, ms: 100 },
  ])
  assert.match(progressLines(p, { width: 60, height: 20, now: 2000, t: T }).join('\n'), /✖/)
})

test('중단하면 건너뛴 건수를 알린다', () => {
  let p = feed([{ index: 0, phase: 'done', item: CHANGES[0].item, action: 'install', ok: true, ms: 10 }])
  p = { ...p, aborted: true }
  assert.match(progressLines(p, { width: 60, height: 20, now: 2000, t: T }).join('\n'), /건너뜀/)
})

test('어느 줄도 폭을 넘지 않고 높이를 넘지 않는다', () => {
  const p = feed([{ index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' }])
  const lines = progressLines(p, { width: 40, height: 8, now: 2000, t: T })
  // 상한만 두면 빈 배열이 통과한다 — 실제로 그렸는지도 함께 못박는다.
  assert.ok(lines.length > 0 && lines.length <= 8, `줄 수 ${lines.length}`)
  assert.ok(lines.join('\n').includes('Alpha'), '실행 중 항목이 그려져야 한다')
  for (const line of lines) assert.ok(width(line) <= 40, `넘침: ${line}`)
})

// 지면이 모자라면 완료된 것을 접는다 — 지금 도는 것이 사라지면 안 된다.
test('지면이 모자라면 실행 중 항목이 살아남는다', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ item: { id: `i${i}`, label: `Item${i}` }, action: 'install' }))
  let p = createProgress(many)
  for (let i = 0; i < 25; i++) {
    p = applyEvent(p, { total: 30, index: i, phase: 'done', item: many[i].item, action: 'install', ok: true, ms: 10 }, 1000)
  }
  p = applyEvent(p, { total: 30, index: 25, phase: 'start', item: many[25].item, action: 'install' }, 1000)
  const text = progressLines(p, { width: 60, height: 8, now: 2000, t: T }).join('\n')
  assert.match(text, /Item25/)
})

// CI 로그에 ANSI 제어문자를 흘리지 않는다.
test('비TTY 평문은 항목마다 한 줄씩만 낸다', () => {
  const start = plainLine({ index: 0, total: 3, phase: 'start', item: CHANGES[0].item, action: 'install' }, T)
  assert.match(start, /\[1\/3\]/)
  assert.match(start, /Alpha/)
  assert.ok(!start.includes(String.fromCharCode(27)), 'ANSI 제어문자가 없어야 한다')
  // 명령 알림은 평문에서 버린다 — 한 항목이 여러 줄로 흩어지면 로그가 읽히지 않는다.
  assert.equal(plainLine({ index: 0, total: 3, phase: 'command', command: 'x' }, T), null)
  assert.match(plainLine({ index: 0, total: 3, phase: 'done', ok: true, ms: 21800 }, T), /21\.8초/)
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.progress.test.mjs
```

기대: `Cannot find module '../lib/tui/progress.mjs'`.

- [ ] **Step 4: 구현한다**

`agent-installer/lib/tui/progress.mjs`:

```js
// 진행 화면 — 순수 함수 모듈이다. 터미널도 시계도 모른다.
//
// 시각을 인자로 받는 것이 핵심이다. 모듈 안에서 Date.now()를 부르면 테스트가
// 실제 시간에 묶여 "14초 경과"를 검증할 방법이 없다.
import { createT } from '../i18n/index.mjs'
import { cut, pad, width } from '../width.mjs'

const ESC = String.fromCharCode(27)
const DIM = `${ESC}[2m`
const BOLD = `${ESC}[1m`
const RESET = `${ESC}[0m`

const MARK = { done: '✔', failed: '✖', running: '▸', pending: ' ', skipped: '–' }

export function createProgress(changes) {
  return {
    total: changes.length,
    startedAt: null,
    aborted: false,
    entries: changes.map(({ item, action }) => ({
      item, action, state: 'pending', ok: null, ms: 0, command: null, startedAt: null,
    })),
  }
}

// 이벤트 하나를 접어 넣는다. 새 상태를 돌려준다 — 화면은 이 값만 보고 그린다.
export function applyEvent(progress, event, now) {
  const entries = progress.entries.slice()
  const at = entries[event.index]
  if (!at) return progress
  if (event.phase === 'start') entries[event.index] = { ...at, state: 'running', startedAt: now }
  else if (event.phase === 'command') entries[event.index] = { ...at, command: event.command }
  else if (event.phase === 'done') {
    entries[event.index] = { ...at, state: event.ok ? 'done' : 'failed', ok: event.ok, ms: event.ms ?? 0 }
  }
  return { ...progress, entries, startedAt: progress.startedAt ?? now }
}

function seconds(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1).replace(/\.0$/, '')
}

function elapsedText(ms, t) {
  const total = Math.floor(Math.max(0, ms) / 1000)
  return total >= 60
    ? t('progress.elapsedMin', { minutes: Math.floor(total / 60), seconds: total % 60 })
    : t('progress.elapsed', { seconds: total })
}

function bar(done, total, room) {
  if (room <= 2) return ''
  const inner = room - 2
  const filled = total === 0 ? 0 : Math.round((done / total) * inner)
  return `[${'█'.repeat(filled)}${'░'.repeat(Math.max(0, inner - filled))}]`
}

// 항목 한 개가 차지하는 줄. 실행 중이면 경과와 명령을 함께 낸다.
function entryLines(entry, w, actionWidth, now, t) {
  let tail = ''
  if (entry.state === 'running') {
    const ran = Math.floor(Math.max(0, now - (entry.startedAt ?? now)) / 1000)
    tail = `  ${t('progress.running', { seconds: ran })}`
  } else if (entry.state === 'done' || entry.state === 'failed') {
    tail = `  ${t('progress.elapsed', { seconds: seconds(entry.ms) })}`
  } else if (entry.state === 'skipped') {
    tail = `  ${t('progress.skipped')}`
  }
  const mark = MARK[entry.state] ?? ' '
  const out = [cut(`${mark} ${pad(t(`change.${entry.action}`), actionWidth)} ${entry.item.label}${tail}`, w)]
  // 명령은 실행 중일 때만. 끝난 뒤에도 남기면 화면이 명령 목록이 된다.
  if (entry.state === 'running' && entry.command) out.push(cut(`      ${entry.command}`, w))
  return out
}

export function progressLines(progress, opts = {}) {
  const { width: columns = 80, height = 24, color = false, dryRun = false, now = 0, t = createT('en') } = opts
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const done = progress.entries.filter((e) => e.state === 'done' || e.state === 'failed').length
  const skipped = progress.entries.filter((e) => e.state === 'skipped').length
  const percent = progress.total === 0 ? 100 : Math.round((done / progress.total) * 100)
  const counter = t('progress.counter', { done, total: progress.total, percent })
  const elapsed = progress.startedAt === null ? '' : `   ${elapsedText(now - progress.startedAt, t)}`

  const title = t('progress.title', { count: progress.total, suffix: dryRun ? ' (dry-run)' : '' })
  const lines = [paint(BOLD, cut(title, w)), '']

  const meta = `  ${counter}${elapsed}`
  lines.push(cut(`${bar(done, progress.total, Math.max(0, w - width(meta)))}${meta}`, w))
  lines.push('')

  const actionWidth = Math.max(...['install', 'complete', 'uninstall'].map((a) => width(t(`change.${a}`))))
  const body = Math.max(1, height - lines.length - 2)

  // 지면이 모자라면 **완료된 것부터** 접는다. 지금 무엇이 도는지가 가장 알고
  // 싶은 정보라, 실행 중 항목은 언제나 화면에 남는다.
  //
  // 실행 중 항목(없으면 마지막으로 끝난 항목)을 기준점으로 잡고 지면이
  // 허락하는 만큼만 위로 거슬러 올라간다. 기준점에서 시작하므로 그 줄이
  // 잘려 나갈 수 없다 — "완료분부터 접는다"를 규칙이 아니라 구조로 보장한다.
  const blocks = progress.entries.map((e) => entryLines(e, w, actionWidth, now, t))
  const running = progress.entries.findIndex((e) => e.state === 'running')
  const anchor = running === -1 ? Math.max(0, done - 1) : running

  let from = anchor
  let used = blocks.slice(anchor).reduce((n, b) => n + b.length, 0)
  while (from > 0 && used + blocks[from - 1].length <= body - 1) {
    from--
    used += blocks[from].length
  }
  const shown = blocks.slice(from).flat().slice(0, Math.max(0, body - (from > 0 ? 1 : 0)))
  if (from > 0) lines.push(paint(DIM, cut(t('progress.more', { count: from }), w)))
  for (const line of shown) lines.push(line)
  for (let i = lines.length; i < height - 2; i++) lines.push('')

  lines.push('')
  const foot = progress.aborted
    ? t('progress.aborted', { count: skipped })
    : done < progress.total
      ? t('progress.abortHint')
      : t('progress.done', {
        ok: progress.entries.filter((e) => e.state === 'done').length,
        failed: progress.entries.filter((e) => e.state === 'failed').length,
        skippedSuffix: skipped > 0 ? t('progress.doneSkipped', { count: skipped }) : '',
      })
  lines.push(paint(DIM, cut(foot, w)))
  return lines.slice(0, height)
}

// 비TTY(CI·파이프)용. 바를 그리지 않고 항목마다 한 줄씩 흘린다 —
// ANSI 제어문자로 CI 로그를 더럽히지 않는다.
export function plainLine(event, t = createT('en')) {
  if (event.phase === 'start') {
    return t('progress.plain', {
      index: event.index + 1,
      total: event.total,
      action: t(`change.${event.action}`),
      label: event.item.label,
    })
  }
  if (event.phase === 'done') {
    return t('progress.plainDone', { mark: event.ok ? '✔' : '✖', seconds: seconds(event.ms ?? 0) })
  }
  return null
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 8개 PASS.

- [ ] **Step 6: 커밋한다**

```bash
git add agent-installer/lib/tui/progress.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/test/tui.progress.test.mjs
git commit -F - <<'EOF'
feat(installer): 진행 화면을 그리는 순수 모듈을 더한다

시각을 인자로 받는다 — 모듈 안에서 Date.now를 부르면 테스트가 실제
시간에 묶여 경과 표시를 검증할 수 없다.

지면이 모자라면 완료된 항목부터 접는다. 지금 무엇이 도는지가 가장
알고 싶은 정보라 실행 중 항목은 언제나 화면에 남는다. 비TTY에는 바
대신 평문 한 줄씩을 흘려 CI 로그를 더럽히지 않는다.
EOF
```

---

### Task 11: 적용 중 실시간 화면과 중단

**Files:**
- Modify: `agent-installer/lib/tui/run.mjs:26-39` (`keyReader`에 `hasAbort` 추가), `:246-281` (Enter 분기의 적용 블록)
- Test: `agent-installer/test/tui.run.test.mjs` (추가)

**Interfaces:**
- Consumes: `createProgress`·`applyEvent`·`progressLines` (Task 10), `apply(…, { onProgress, shouldStop })` (Task 9)
- Produces: `keys.hasAbort(): boolean` — 큐를 **소비하지 않고** Ctrl+C만 들여다본다

**왜 감시 코루틴을 쓰지 않나:** `keys.next()`를 기다리는 두 번째 소비자를 두면, 적용이 끝난 직후 눌린 키가 본 루프 대신 그 대기로 흘러 사라진다(적용 뒤 "아무 키나" 대기가 영원히 멈춘다). 큐를 통째로 비워도 같은 문제가 생긴다. 그래서 Ctrl+C가 **있을 때만** 거기까지를 버리고, 없으면 큐를 그대로 둔다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/tui.run.test.mjs` 끝에 추가한다. 기존 `drive` 하네스와 키 상수를 그대로 쓴다.

```js
// 적용 중에는 alt 화면을 떠나지 않는다. 예전에는 화면을 벗어나 로그를
// 한꺼번에 찍었고, 그 사이 사용자는 아무것도 볼 수 없었다.
// TAB으로 항목 탭에 들어가 하나 고르고, Enter(제출) → Enter(적용) →
// 아무 키(계속) → ESC(종료).
test('적용 중 화면이 진행 바를 그린다', async () => {
  const { screen } = await drive([TAB, SPACE, ENTER, ENTER, ANY, ESC])
  assert.ok(screen.includes('적용 중'), '진행 화면이 그려져야 한다')
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/tui.run.test.mjs
```

기대: `적용 중`이 없어 실패.

- [ ] **Step 3: 구현한다**

`agent-installer/lib/tui/run.mjs` 위쪽 import에 더한다.

```js
import { createProgress, applyEvent, progressLines } from './progress.mjs'
```

`keyReader`(`:26-39`)에 큐를 소비하지 않는 Ctrl+C 조회를 더한다.

```js
  return {
    next: () => (queue.length > 0 ? Promise.resolve(queue.shift()) : new Promise((r) => { waiting = r })),
    // 적용 중 중단 감시용. 큐를 **소비하지 않고** Ctrl+C만 들여다본다.
    // next()로 기다리는 두 번째 소비자를 두면 적용이 끝난 뒤 눌린 키가
    // 그 대기로 흘러 사라지고, 본 루프의 "아무 키나" 대기가 멈춘다.
    // Ctrl+C가 있을 때만 거기까지를 버린다.
    hasAbort: () => {
      const at = queue.findIndex((k) => k.ctrl && k.name === 'c')
      if (at === -1) return false
      queue.splice(0, at + 1)
      return true
    },
    stop: () => stdin.off('keypress', onKey),
  }
```

`runTui` 안, `review` 함수 아래에 적용 실행기를 둔다.

```js
  // 적용 중에는 alt 화면을 떠나지 않는다. exec가 비동기가 된 덕에 이벤트
  // 루프가 살아 있어, 100ms 타이머가 경과 시간을 실제로 흘려 준다.
  const runApply = async (changes) => {
    let progress = { ...createProgress(changes), startedAt: Date.now() }
    let stopRequested = false

    // 중단 요청은 큐를 엿봐서 안다. 한 번 서면 되돌리지 않는다.
    const checkAbort = () => {
      if (!stopRequested && keys.hasAbort()) stopRequested = true
      return stopRequested
    }
    const drawProgress = () => draw(progressLines(progress, {
      width: stdout.columns ?? 80, height: stdout.rows ?? 24, color, dryRun, now: Date.now(), t,
    }))

    drawProgress()
    const timer = setInterval(() => { checkAbort(); drawProgress() }, 100)
    // 타이머가 프로세스를 붙잡지 않게 한다 — 화면 갱신은 종료를 미룰 이유가 없다.
    timer.unref?.()

    try {
      const results = await apply(root, changes, {
        dryRun,
        log: () => {}, // 로그는 진행 화면이 대신한다
        t,
        shouldStop: checkAbort,
        onProgress: (event) => {
          progress = applyEvent(progress, event, Date.now())
          drawProgress()
        },
      })
      // 건너뛴 항목을 화면에도 반영하고 마지막 상태를 한 번 더 그린다.
      const entries = progress.entries.map((e, i) => (results[i]?.skipped ? { ...e, state: 'skipped' } : e))
      progress = { ...progress, entries, aborted: stopRequested }
      drawProgress()
      if (results.some((r) => !r.ok && !r.skipped)) process.exitCode = 1
      return results
    } finally {
      clearInterval(timer)
    }
  }
```

Enter 분기의 적용 블록(`:267-279`)을 갈아 끼운다.

```js
        const results = await runApply(changes)

        // 실패·건너뜀이 있으면 자세한 사연을 화면 밖에서 보여 준다 —
        // 실패 메시지는 길고, 화면 안에서 잘리면 진단이 불가능해진다.
        const notable = results.filter((r) => !r.ok)
        await suspend(async () => {
          if (notable.length > 0) {
            log('')
            for (const r of notable) {
              const message = r.skipped ? t('progress.skipped') : toText(t, r.message)
              log(`  ✖ ${t(`change.${r.action}`)} ${r.item.label}${message ? ` — ${message}` : ''}`)
            }
          }
          log(`\n${t('apply.seeGitDiff')}`)
          await pause()
        })
        await recollect()
        continue
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 1개 PASS, 기존 `tui.run.test.mjs` 전부 통과.

- [ ] **Step 5: 커밋한다**

```bash
git add agent-installer/lib/tui/run.mjs agent-installer/test/tui.run.test.mjs
git commit -F - <<'EOF'
feat(installer): 적용 중 진행 바를 실시간으로 그린다

예전에는 화면을 벗어나 로그를 한꺼번에 찍어, 설치가 도는 동안 사용자가
아무것도 볼 수 없었다. exec가 비동기가 된 덕에 이벤트 루프가 살아 있어
100ms 타이머가 경과 시간을 실제로 흘려 준다.

Ctrl+C는 중단 요청으로 받아 현재 항목까지 마친 뒤 멈춘다. 실패 사연은
화면 밖에서 보여 준다 — 길고, 잘리면 진단이 불가능하다.
EOF
```

---

### Task 12: 부트스트랩과 비대화형 진행율

**Files:**
- Modify: `agent-installer/lib/bootstrap/flow.mjs:12-32` (`runBootstrap`)
- Modify: `agent-installer/install.mjs:52-84` (`runClassic`)
- Test: `agent-installer/test/bootstrap.flow.test.mjs`, `agent-installer/test/install.cli.test.mjs` (추가)

**Interfaces:**
- Consumes: `plainLine` (Task 10), `apply(…, { onProgress })` (Task 9)
- Produces: `runBootstrap(root, { onProgress })` — `onProgress({ done, total, path })`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`agent-installer/test/bootstrap.flow.test.mjs` 끝에 추가한다.

```js
test('부트스트랩이 단계 진행을 알린다', () => {
  const root = makeTempRepo()
  const events = []
  runBootstrap(root, { log: () => {}, onProgress: (e) => events.push(e) })
  assert.ok(events.length > 0)
  assert.equal(events.at(-1).done, events.at(-1).total)
  assert.ok(events.every((e) => e.done <= e.total))
})
```

`agent-installer/test/install.cli.test.mjs` 끝에 추가한다.

```js
// CI 로그에 ANSI 제어문자를 흘리지 않는다. 비TTY에서는 평문 한 줄씩만 낸다.
test('비대화형 --set은 평문 진행 줄을 낸다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--set', 'mcp.notion', '--dry-run'], { env: KO })
  assert.equal(r.status, 0)
  assert.match(r.stdout, /\[1\/1\]/)
  assert.ok(!r.stdout.includes(String.fromCharCode(27)), 'CI 로그에 ANSI 제어문자가 없어야 한다')
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd agent-installer && node --test test/bootstrap.flow.test.mjs test/install.cli.test.mjs
```

기대: `events.length > 0` 실패, `[1/1]` 없음으로 실패.

- [ ] **Step 3: 부트스트랩에 진행 알림을 넣는다**

`agent-installer/lib/bootstrap/flow.mjs:12-32`:

```js
export function runBootstrap(root, opts = {}) {
  const { dryRun = false, skillMode = 'auto', adopt = false, log = console.log, manifest = MANIFEST, onProgress = null, t = createT('en') } = opts

  if (!SKILL_MODES.includes(skillMode)) {
    throw new LocalizedError('error.badSkillModeRuntime', { list: SKILL_MODES.join(', '), value: skillMode })
  }

  const say = (message) => log(`[agent-setup] ${message}`)
  const ctx = { dryRun, log: say, t }

  say(t('log.repoRoot', { path: root }))
  say(t('log.noGlobalWrites'))

  // 총 단계 수. 동기 파일 작업이라 단계 바만 돌지만, 무엇이 남았는지는
  // 알려 줄 수 있다. adopt는 파일을 만들지 않으므로 기록 쓰기 한 단계뿐이다.
  const total = adopt
    ? 1
    : manifest.dirs.length + manifest.files.length + (manifest.settings ?? []).length
      + manifest.blocks.length + manifest.adapters.length + manifest.ignore.length + 1
  let done = 0
  const step = (results) => {
    const list = Array.isArray(results) ? results : [results]
    for (const r of list) {
      done++
      if (onProgress) onProgress({ done, total, path: r?.path ?? null })
    }
    return list
  }

  const results = adopt ? [] : [
    ...step(ensureDirs(root, manifest.dirs, ctx)),
    ...step(ensureFiles(root, manifest.files, ctx)),
    ...step(ensureJsonKeys(root, manifest.settings ?? [], ctx)),
    ...step(ensureBlocks(root, manifest.blocks, ctx)),
  ]

  if (!adopt) {
    for (const entry of manifest.adapters) {
      results.push(...step(configureAdapterSafe(root, entry, { ...ctx, skillMode })))
    }
    results.push(...step(ensureIgnore(root, manifest.ignore, ctx)))
  }
```

`results.push(writeRecord(root, record, ctx))`를 아래로 바꾼다.

```js
  results.push(...step(writeRecord(root, record, ctx)))
```

`done`이 `total`과 어긋날 수 있다(`ensureDirs` 등이 manifest 항목당 정확히 하나를 돌려주지 않으면). 마지막에 맞춘다 — `say(t('bootstrap.done'))` 바로 앞에 넣는다.

```js
  // 실제 결과 수가 예측과 다르면 마지막 알림으로 100%를 맞춘다.
  // 진행 바가 87%에서 끝나면 사용자는 무엇이 실패했다고 읽는다.
  if (onProgress && done !== total) onProgress({ done: total, total, path: null })
```

- [ ] **Step 4: 비대화형 `--set`에 평문 진행을 넣는다**

`agent-installer/install.mjs:52-84`의 `runClassic`에서 `apply` 호출을 고친다.

```js
async function runClassic(root, { dryRun, listOnly, setArg, t }) {
  const { loadItems } = await withDeps(() => import('./lib/catalog.mjs'), t)
  const { scan, planChanges, apply } = await withDeps(() => import('./lib/engine.mjs'), t)
  const { plainLine } = await withDeps(() => import('./lib/tui/progress.mjs'), t)
  const items = await loadItems()
  const states = await scan(root, items)
  const statusWidth = labelWidth(t, STATUS_KEYS)

  if (listOnly) {
    for (const s of states) {
      const detail = toText(t, s.detail)
      console.log(`${pad(t(`status.${s.status}`), statusWidth)} ${s.item.id} — ${s.item.label}${detail ? ` (${detail})` : ''}`)
    }
    return
  }

  const selectedIds = new Set(setArg.split(',').map((s) => s.trim()).filter(Boolean))
  const known = new Set(items.map((i) => i.id))
  for (const id of selectedIds) if (!known.has(id)) throw new LocalizedError('error.unknownItem', { id })

  const changes = planChanges(states, selectedIds)
  if (changes.length === 0) { console.log(t('apply.noChanges')); return }

  // 비대화형 경로다 — 바를 그리지 않고 평문 한 줄씩 흘린다.
  // ANSI 제어문자로 CI 로그를 더럽히지 않기 위해서다.
  const results = await apply(root, changes, {
    dryRun,
    t,
    onProgress: (event) => {
      const line = plainLine(event, t)
      if (line) console.log(line)
    },
  })
  for (const r of results) {
    console.log(`${r.ok ? '✔' : '✖'} ${t(`change.${r.action}`)} ${r.item.label}${r.message ? ` — ${toText(t, r.message)}` : ''}`)
  }
```

이후 블록(최종 상태 출력)은 그대로 둔다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd agent-installer && npm test
```

기대: 신규 2개 PASS, 기존 전부 통과.

- [ ] **Step 6: 부트스트랩 의존성 격리를 확인한다**

```bash
cd agent-installer && node --test test/bootstrap.isolation.test.mjs
```

기대: PASS. `flow.mjs`는 새 import를 더하지 않았고, `install.mjs`의 `plainLine`은 `withDeps` 안의 동적 import라 정적 의존성이 아니다.

- [ ] **Step 7: 커밋한다**

```bash
git add agent-installer/lib/bootstrap/flow.mjs agent-installer/install.mjs agent-installer/test/bootstrap.flow.test.mjs agent-installer/test/install.cli.test.mjs
git commit -F - <<'EOF'
feat(installer): 부트스트랩과 비대화형에도 진행율을 붙인다

설치 진행을 알리는 자리가 TUI에만 있으면 반쪽이다. 부트스트랩은 단계
알림을, 비대화형 --set은 항목마다 평문 한 줄을 낸다.

비대화형이 바를 그리지 않는 이유는 CI 로그에 ANSI 제어문자를 흘리지
않기 위해서다. 부트스트랩의 진행 알림은 정적 의존성을 늘리지 않아
npm install 없이 도는 불변식이 유지된다.
EOF
```

---

### Task 13: 문서와 버전, 전체 검증

**Files:**
- Modify: `agent-installer/package.json:3` (버전)
- Modify: `agent-installer/README.md`, `AgentSetup-README.md`, `AgentSetup-README-CHANGES.md`

- [ ] **Step 1: 버전을 올린다**

`agent-installer/package.json`의 `"version": "1.4.0"`을 `"version": "1.5.0"`으로 바꾼다. 기능 추가이므로 minor다.

`usage.root`는 손대지 않는다. 확인해 보면 CLI 플래그만 안내하고 TUI 단축키는 다루지 않는다 — 단축키는 화면 바닥글(`tui.hint.list`·`tui.hint.search`)이 맡고, 그쪽은 Task 7에서 이미 갱신했다.

- [ ] **Step 2: 문서를 갱신한다**

`agent-installer/README.md`와 `AgentSetup-README.md`에서 TUI 화면을 설명하는 절을 찾아 다음을 반영한다.

- 목록 아래 상세 패널이 있고, 커서 항목의 배선된/안 된 CLI와 사유를 보여 준다
- `Ctrl+F`/`Ctrl+B`로 CLI 필터를 앞뒤로 돌린다
- `Ctrl+D`로 상세를 전체 화면까지 펼친다
- 적용 중 진행 바가 돌고 `Ctrl+C`는 현재 항목까지 마친 뒤 멈춘다
- 비대화형(`--set`)과 CI에서는 바 대신 평문 진행 줄이 나온다

`AgentSetup-README-CHANGES.md`는 최신 항목이 맨 위에 온다. `# 변경 이력` 머리말 바로 아래, 기존 1.4.0 절 **앞에** 새 절을 넣는다. 형식은 기존 절과 같다: `## <제목> (2026-08-01, 1.5.0)` 다음 줄에 굵은 한 문장으로 요점을 세우고, `- **<소제목>.**` 꼴 목록으로 근거를 단다.

담을 것: 목록 행이 잘리던 문제와 그것을 상세 패널로 옮긴 이유, CLI 양방향 확인(패널의 배선표 + Ctrl+F 필터), 진행율을 위해 외부 명령 실행을 비동기로 바꾼 것과 Ctrl+C가 항목 경계에서만 멈추는 이유.

- [ ] **Step 3: 전체 테스트를 돌린다**

```bash
cd agent-installer && npm test
```

기대: 전부 통과.

- [ ] **Step 4: 런처 문법과 스모크를 확인한다**

```bash
bash -n ./setup-agents.sh
bash ./setup-agents.sh --dry-run
pwsh -File ./setup-agents.ps1 -DryRun
```

기대: 문법 오류 없음, 두 런처 모두 정상 종료.

- [ ] **Step 5: 스크래치 저장소에서 멱등성을 확인한다**

```bash
repo=/d/Sources/github/Agent-Setup
scratch=$(mktemp -d) && git init -q "$scratch"
cd "$scratch"

bash "$repo/setup-agents.sh" > /tmp/run1.txt 2>&1
git add -A
git status --porcelain > /tmp/staged1.txt

bash "$repo/setup-agents.sh" > /tmp/run2.txt 2>&1
git add -A
git status --porcelain > /tmp/staged2.txt

diff /tmp/staged1.txt /tmp/staged2.txt && echo "멱등: 두 번째 실행이 아무것도 바꾸지 않았다"
```

`setup-agents.ps1`로도 같은 절차를 새 스크래치 저장소에서 반복한다.

```bash
grep -E '\.(claude|kiro|grok)/skills' /tmp/staged1.txt && echo "실패: 스킬 링크가 스테이징됐다" || echo "정상"
grep -q '\.vscode/mcp\.json' /tmp/staged1.txt && echo "정상" || echo "실패: .vscode/mcp.json이 빠졌다"
grep -q '\.vscode/settings\.json' /tmp/staged1.txt && echo "정상" || echo "실패: .vscode/settings.json이 빠졌다"
```

`.vscode` 두 파일은 gitignore 부정 항목에 기대는 자리라, 하나만 빠져도 조용히 실패한다. 그래서 둘을 따로 확인한다.

- [ ] **Step 6: 진행 바를 실제 터미널에서 눈으로 확인한다**

```bash
cd /d/Sources/github/Agent-Setup && node agent-installer/install.mjs
```

확인할 것:
- 상세 패널이 목록 아래 보이고, 커서를 옮겨도 목록이 출렁이지 않는다
- Ctrl+F로 CLI를 돌리면 탭 개수가 `1/7`처럼 바뀐다
- `c`·`d`를 누르면 검색어로 들어간다(필터가 아니다)
- 항목을 골라 Enter → Enter 하면 진행 바가 돌고 경과 시간이 실제로 흐른다

- [ ] **Step 7: 커밋한다**

```bash
git add agent-installer/package.json agent-installer/README.md AgentSetup-README.md AgentSetup-README-CHANGES.md
git commit -F - <<'EOF'
docs(installer): 1.5.0으로 올리고 새 화면을 문서에 담는다

상세 패널·CLI 필터·진행율을 README와 변경 이력에 반영한다.
기능 추가이므로 minor로 올린다.
EOF
```

---

## 태스크 의존 관계

```text
Task 1 (wrap) ─┬─→ Task 4 (detail 본문) ─→ Task 5 (렌더 배치) ─→ Task 7 (필터 줄·키)
Task 2 (file) ─┘         ↑                                            ↑
Task 3 (사유 그룹·짧은 힌트) ┘                        Task 6 (state 필터) ┘

Task 8 (exec 비동기) ─→ Task 9 (apply 알림) ─→ Task 11 (TUI 실시간) ─→ Task 12 (부트스트랩·비대화형)
                                    Task 10 (progress 렌더) ─┘

Task 13 (문서·검증) ← 전부
```

Task 1~7(화면)과 Task 8~12(진행율)는 서로 독립이다. 순서대로 하면 각 묶음이 끝나는 지점(Task 7, Task 12)에서 각각 동작하는 소프트웨어가 나온다.
