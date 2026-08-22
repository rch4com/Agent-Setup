# 플러그인 설치 범위(저장소/전역) 구분 UI 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TUI의 PLUGIN 탭을 '저장소 범위'와 '머신 전역' 그룹으로 갈라 보여 주고,
라벨·힌트·검토·진행·결과 화면 전부에서 설치 범위가 명확히 드러나게 한다.

**Architecture:** 표시 계층만 바꾼다. 항목의 데이터 모델(`scope`·`group`)과
설치/제거 동작은 불변이고, `rows.mjs`가 plugin 행의 그룹을 scope로 오버라이드하며,
새 잎 모듈 `lib/labels.mjs`의 `scopedLabel(item, t)`이 라벨을 찍는 모든 자리에서
로케일 범위 접미사를 붙인다. 순수 리듀서(`state.mjs`)와 상세 패널(`detail.mjs`)은
건드리지 않는다.

**Tech Stack:** Node.js 표준 라이브러리만. 테스트는 `node:test` + `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-22-plugin-scope-ui-design.md`

## Global Constraints

- 새 프로덕션 의존성 금지 (AGENTS.md).
- `install.mjs`의 정적 import는 의존성 없는 모듈만 — `bootstrap.isolation.test.mjs`가
  검증한다. 새 모듈 `lib/labels.mjs`는 **import가 하나도 없어야** 한다.
- i18n: `en.mjs`와 `ko.mjs`의 키 집합·플레이스홀더 이름이 일치해야 한다
  (`i18n.test.mjs`가 검증). 키는 항상 양쪽에 같이 넣는다.
- 커밋 메시지: `.gitmessage.txt` 형식 — `<type>(<scope>): <제목>`, 제목·본문은
  한국어, 제목 50자 이내, 현재형, 마침표 없음. 트레일러
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` 포함.
- 테스트 실행 위치는 항상 `agent-installer/` 안이다: `cd agent-installer`.
- 기존 코드의 주석 밀도·서술형 한국어 주석 스타일을 따른다. 주석은 코드가
  말하지 못하는 제약만 적는다.

---

### Task 1: `scopedLabel` 헬퍼와 라벨 접미사 키

**Files:**
- Create: `agent-installer/lib/labels.mjs`
- Modify: `agent-installer/lib/i18n/catalog/ko.mjs` (362행 `'item.location.user'` 근처)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs` (375행 `'item.location.user'` 근처)
- Test: `agent-installer/test/labels.test.mjs` (신규)

**Interfaces:**
- Consumes: `createT(locale)` — `lib/i18n/index.mjs` (기존)
- Produces: `scopedLabel(item, t): string` — Task 3·4·5·6이 import한다.
  plugin 카테고리면 `` `${item.label} ${t(`label.scope.${item.scope ?? 'project'}`)}` ``,
  아니면 `item.label` 그대로. i18n 키 `label.scope.project` / `label.scope.user`.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/labels.test.mjs` 신규 작성:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { scopedLabel } from '../lib/labels.mjs'
import { createT } from '../lib/i18n/index.mjs'

test('plugin 항목은 범위 접미사가 붙는다 — 두 로케일 모두', () => {
  const project = { category: 'plugin', label: 'superpowers', scope: 'project' }
  const user = { category: 'plugin', label: 'superpowers', scope: 'user' }
  assert.equal(scopedLabel(project, createT('ko')), 'superpowers (저장소)')
  assert.equal(scopedLabel(user, createT('ko')), 'superpowers (전역)')
  assert.equal(scopedLabel(project, createT('en')), 'superpowers (repo)')
  assert.equal(scopedLabel(user, createT('en')), 'superpowers (global)')
})

test('plugin이 아닌 항목은 라벨 그대로다', () => {
  const t = createT('ko')
  assert.equal(scopedLabel({ category: 'skill', label: 'GSD', scope: 'project' }, t), 'GSD')
  assert.equal(scopedLabel({ category: 'mcp', label: 'Notion' }, t), 'Notion')
})

test('scope가 없는 plugin은 저장소 범위로 본다', () => {
  assert.equal(scopedLabel({ category: 'plugin', label: 'X' }, createT('ko')), 'X (저장소)')
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/labels.test.mjs`
Expected: FAIL — `Cannot find module ... lib/labels.mjs`

- [ ] **Step 3: 구현**

`agent-installer/lib/labels.mjs` 신규 작성:

```js
// 플러그인 항목 라벨에 설치 범위 접미사를 붙인다. 목록 밖(검토·진행·결과
// 화면)에는 범위 그룹 헤더가 없어, 같은 이름의 두 판(superpowers 저장소/전역)을
// 이 접미사만이 가른다. import가 없는 잎 모듈이어야 한다 — install.mjs가
// 정적으로 당기므로, 의존성이 들어오면 npm install 없이 도는 부트스트랩
// (bootstrap.isolation.test.mjs)이 깨진다.
export function scopedLabel(item, t) {
  if (item?.category !== 'plugin') return item?.label ?? ''
  return `${item.label} ${t(`label.scope.${item.scope ?? 'project'}`)}`
}
```

`lib/i18n/catalog/ko.mjs`의 `'item.location.user'` 줄(362행) 바로 아래에 추가:

```js
  'label.scope.project': '(저장소)',
  'label.scope.user': '(전역)',
```

`lib/i18n/catalog/en.mjs`의 `'item.location.user'` 줄(375행) 바로 아래에 추가:

```js
  'label.scope.project': '(repo)',
  'label.scope.user': '(global)',
```

- [ ] **Step 4: 통과 확인**

Run: `cd agent-installer && node --test test/labels.test.mjs && node --test test/i18n.test.mjs test/bootstrap.isolation.test.mjs`
Expected: PASS (i18n 키 패리티·격리 불변식 포함)

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/labels.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/test/labels.test.mjs
git commit -m "$(cat <<'EOF'
feat(installer): 범위 접미사 라벨 헬퍼를 넣는다

목록 밖 화면(검토·진행·결과)에는 범위 그룹 헤더가 없어, 같은 이름의
두 판(superpowers 저장소/전역)을 라벨 접미사만이 가른다. import 없는
잎 모듈로 두어 install.mjs가 정적으로 당겨도 부트스트랩 격리를 지킨다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 항목 라벨의 수기 접미사 제거

**Files:**
- Modify: `agent-installer/lib/items/plugin.superpowers.mjs:16`
- Modify: `agent-installer/lib/items/global.superpowers.mjs:29`
- Modify: `agent-installer/lib/items/global.ponytail.mjs:31`
- Modify: `agent-installer/lib/items/plugin.mattpocock-skills.mjs:10`
- Modify: `agent-installer/lib/i18n/catalog/ko.mjs:230`, `agent-installer/lib/i18n/catalog/en.mjs:237`
- Test: `agent-installer/test/items.test.mjs` (테스트 추가)

**Interfaces:**
- Consumes: 없음 (Task 1과 독립적으로 통과하지만, 순서대로 실행한다)
- Produces: plugin 카테고리 항목의 `label`에 `(plugin)`/`(global)` 접미사가 없다는
  불변식. Task 3의 `scopedLabel` 적용이 이 불변식 위에서 이중 접미사 없이 돈다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/items.test.mjs` 끝에 추가 (`loadItems`는 이미 import되어 있다):

```js
// 접미사는 scopedLabel이 로케일에 맞춰 붙인다 — 정적 라벨에 수기 접미사가
// 남으면 화면에 'superpowers (plugin) (저장소)'처럼 이중으로 찍힌다.
test('plugin 항목 라벨에 수기 범위 접미사가 없다', async () => {
  const items = await loadItems()
  for (const item of items.filter((i) => i.category === 'plugin')) {
    assert.doesNotMatch(item.label, /\((plugin|global)\)/, `${item.id}: 라벨에 수기 접미사가 남았다`)
  }
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/items.test.mjs`
Expected: FAIL — plugin.superpowers·global.superpowers·global.ponytail·plugin.mattpocock-skills 4건이 걸린다

- [ ] **Step 3: 라벨 4건과 i18n 문구 2건 수정**

각 파일에서 `label` 값만 바꾼다 (다른 필드는 손대지 않는다):

- `plugin.superpowers.mjs:16` — `label: 'superpowers (plugin)'` → `label: 'superpowers'`
- `global.superpowers.mjs:29` — `label: 'superpowers (global)'` → `label: 'superpowers'`
- `global.ponytail.mjs:31` — `label: 'Ponytail (global)'` → `label: 'Ponytail'`
- `plugin.mattpocock-skills.mjs:10` — `label: 'Matt Pocock (plugin)'` → `label: 'Matt Pocock'`

옛 라벨을 문장에 담은 i18n 문구를 새 표기로 갱신:

- `ko.mjs:230` — `'item.unsupported.superpowersGlobalClaude': '프로젝트 스코프 항목 superpowers (plugin)이 담당합니다'`
  → `'item.unsupported.superpowersGlobalClaude': '저장소 범위 항목 superpowers (저장소)가 담당합니다'`
- `en.mjs:237` — `'item.unsupported.superpowersGlobalClaude': 'covered by the project-scope item superpowers (plugin)'`
  → `'item.unsupported.superpowersGlobalClaude': 'covered by the repo-scope item superpowers (repo)'`

- [ ] **Step 4: 통과 확인**

Run: `cd agent-installer && node --test test/items.test.mjs && npm test`
Expected: PASS. 전체 스위트도 통과 — 어떤 테스트도 옛 라벨 문자열을 단언하지
않는다(사전 확인 완료). 실패하면 그 단언을 새 라벨로 갱신한다.

- [ ] **Step 5: 잔존 접미사 없음 확인**

Run: `grep -rn "superpowers (plugin)\|superpowers (global)\|Ponytail (global)\|Matt Pocock (plugin)" agent-installer/lib agent-installer/test`
Expected: 출력 없음

- [ ] **Step 6: 커밋**

```bash
git add agent-installer/lib/items/plugin.superpowers.mjs agent-installer/lib/items/global.superpowers.mjs agent-installer/lib/items/global.ponytail.mjs agent-installer/lib/items/plugin.mattpocock-skills.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/test/items.test.mjs
git commit -m "$(cat <<'EOF'
refactor(installer): 플러그인 라벨의 수기 범위 접미사를 뗀다

접미사는 이제 scopedLabel이 로케일에 맞춰 붙인다. 정적 라벨에 남으면
이중으로 찍히므로 4개 항목에서 떼고, 옛 라벨을 문장에 담은
superpowersGlobalClaude 문구도 새 표기로 맞춘다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: PLUGIN 탭 범위 그룹·라벨·힌트

**Files:**
- Modify: `agent-installer/lib/tui/rows.mjs` (GROUP_ORDER 32행, buildRows 232-251행, agentShortHint 109-114행, import 구획)
- Modify: `agent-installer/lib/i18n/catalog/ko.mjs` (400행 `'category.service'` 근처), `en.mjs` (415행 근처)
- Test: `agent-installer/test/tui.rows.test.mjs`

**Interfaces:**
- Consumes: `scopedLabel(item, t)` — `lib/labels.mjs` (Task 1)
- Produces: plugin 행의 `row.group`이 `'__scope-project'` 또는 `'__scope-user'`,
  `row.label`이 접미사 포함 라벨이라는 화면 계약. i18n 키 `category.scope-project` /
  `category.scope-user` (Task 4의 검토 화면 소제목도 이 키를 재사용한다).

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/tui.rows.test.mjs`에 추가 (`buildRows`·`agentShortHint`·`render`·`createState`·`createT`는 이미 import되어 있다):

```js
// ── 플러그인 범위 그룹 ────────────────────────────────────────────

// plugin 탭은 성격이 아니라 설치 범위로 가른다 — 같은 상류의 두 판이
// 무엇을 건드리는지가 이 탭에서 고르는 기준이다. 항목의 group 필드(성격)는
// 표시에서만 덮이고 데이터로는 남는다.
test('plugin 행은 성격 그룹 대신 범위 그룹을 단다 — 저장소가 전역보다 앞', () => {
  const states = [
    { item: { id: 'global.sp', category: 'plugin', label: 'superpowers', scope: 'user', group: '__flow', supports: ['codex'], unsupported: {} }, status: 'absent' },
    { item: { id: 'plugin.sp', category: 'plugin', label: 'superpowers', scope: 'project', group: '__flow', supports: ['claude'], unsupported: {} }, status: 'absent' },
  ]
  const rows = buildRows({ agentStates: states })
  assert.deepEqual(rows.map((r) => r.group), ['__scope-project', '__scope-user'])
})

test('plugin 행 라벨은 로케일 범위 접미사를 달고 그 접미사로 검색된다', () => {
  const states = [
    { item: { id: 'plugin.sp', category: 'plugin', label: 'superpowers', scope: 'project', supports: ['claude'], unsupported: {} }, status: 'absent' },
    { item: { id: 'global.sp', category: 'plugin', label: 'superpowers', scope: 'user', supports: ['codex'], unsupported: {} }, status: 'absent' },
  ]
  const rows = buildRows({ agentStates: states, t: createT('ko') })
  assert.deepEqual(rows.map((r) => r.label), ['superpowers (저장소)', 'superpowers (전역)'])
  assert.ok(rows[1].searchText.includes('전역'))
})

test('plugin 행 짧은 힌트는 커버리지 수 대신 CLI 이름을 나열한다', () => {
  const item = { id: 'global.sp', category: 'plugin', label: 'superpowers', scope: 'user', supports: ['codex', 'gemini', 'opencode', 'copilot'], unsupported: {} }
  const hint = agentShortHint(item, { item, status: 'installed' }, createT('ko'))
  assert.match(hint, /설치됨 · codex·gemini·opencode·copilot/)
  assert.doesNotMatch(hint, /CLI 4\/10/)
})

test('범위 그룹 헤더는 로케일 라벨로 그려진다 — raw id가 새지 않는다', () => {
  const states = [
    { item: { id: 'plugin.sp', category: 'plugin', label: 'superpowers', scope: 'project', supports: ['claude'], unsupported: {} }, status: 'absent' },
    { item: { id: 'global.sp', category: 'plugin', label: 'superpowers', scope: 'user', supports: ['codex'], unsupported: {} }, status: 'absent' },
  ]
  const rows = buildRows({ agentStates: states, t: createT('ko') })
  const ko = render(createState(rows), { width: 100, height: 24, t: createT('ko') }).join('\n')
  assert.match(ko, /저장소 범위 — 이 저장소에만 적용/)
  assert.match(ko, /머신 전역 — 이 컴퓨터 전체에 적용/)
  assert.doesNotMatch(ko, /__scope/)
})
```

그리고 기존 테스트 `'짧은 힌트는 상태와 CLI 커버리지만 담는다'`(419행 부근)를
새 동작에 맞게 갱신한다 — PONYTAIL 픽스처는 plugin 카테고리라 이제 CLI 이름을
나열한다:

```js
// 목록 행에서 잘릴 것을 없애는 것이 이 힌트의 취지다. 사유·note·detail은
// 상세 패널로 옮기고 행에는 상태와 커버리지만 남긴다 — 단 plugin은 수 대신
// 이름을 나열한다(어느 CLI에 설치되는가가 곧 고르는 기준이라서).
test('짧은 힌트는 상태와 CLI 커버리지만 담는다', () => {
  const t = createT('en')
  const hint = agentShortHint(PONYTAIL, { item: PONYTAIL, status: 'installed' }, t)
  assert.match(hint, /Installed/)
  assert.match(hint, /claude·opencode/)
  assert.doesNotMatch(hint, /upstream/)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs`
Expected: FAIL — 새 테스트 4건 실패 (그룹이 `undefined`/성격 그룹, 라벨에 접미사
없음, 힌트가 `CLI 4/10`, 헤더 문구 없음)

- [ ] **Step 3: rows.mjs 구현**

import 구획(14행 `unsupportedGroups` 근처)에 추가:

```js
import { scopedLabel } from '../labels.mjs'
```

32행 `GROUP_ORDER`를 교체 (범위 그룹은 PLUGIN 탭 전용이지만 순서표는 하나다):

```js
export const GROUP_ORDER = ['__scope-project', '__scope-user', '__token', '__context', '__style', '__flow', '__commit', '__service']
```

`buildRows`의 agents 매핑(233행 부근)에서 `group`·`label` 두 줄을 교체:

```js
      itemRow({
        id: s.item.id,
        section: s.item.category,
        // plugin 탭은 성격이 아니라 설치 범위로 가른다 — 같은 상류의 두 판
        // (저장소/전역)이 무엇을 건드리는지가 이 탭에서 고르는 기준이다.
        // 표시 계층의 오버라이드다: 항목의 group 필드는 성격의 진실로 남는다.
        group: s.item.category === 'plugin'
          ? (s.item.scope === 'user' ? '__scope-user' : '__scope-project')
          : s.item.group ?? null,
        label: scopedLabel(s.item, t),
        hint: agentShortHint(s.item, s, t),
        fullHint: agentHint(s.item, s, t),
        statusDetail: toText(t, s.detail) ?? null,
        status: s.status,
        item: s.item,
        extra: s.item.id,
        t,
      }),
```

`agentShortHint`(109행 부근)를 교체:

```js
// 목록 행에 실제로 찍히는 힌트. 80칸 터미널이면 힌트 자리는 49칸(한글 24자)뿐이라,
// 예전처럼 사유까지 이어 붙이면 뒤쪽이 통째로 잘렸다. 사유·note·detail은
// 상세 패널이 여러 줄로 편다 — 여기 남는 것은 잘릴 일이 없는 두 가지뿐이다.
export function agentShortHint(item, state, t = createT('en')) {
  const parts = []
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  // plugin은 수 대신 이름을 나열한다 — 어느 CLI에 설치되는가가 이 탭에서
  // 고르는 기준이고, 가장 긴 나열(codex·gemini·opencode·copilot)도 자리에 든다.
  if (item.category === 'plugin' && item.supports?.length) parts.push(item.supports.join('·'))
  else if (item.supports) parts.push(t('item.cliCoverage', { covered: item.supports.length, total: CLI_IDS.length }))
  return parts.join(' · ')
}
```

`ko.mjs`의 `'category.service'` 줄(400행) 바로 아래에 추가:

```js
  // PLUGIN 탭 전용 범위 그룹 — 검토 화면(renderReview)의 소제목도 같은 키를 쓴다.
  'category.scope-project': '저장소 범위 — 이 저장소에만 적용',
  'category.scope-user': '머신 전역 — 이 컴퓨터 전체에 적용',
```

`en.mjs`의 `'category.service'` 줄(415행) 바로 아래에 추가:

```js
  // PLUGIN 탭 전용 범위 그룹 — 검토 화면(renderReview)의 소제목도 같은 키를 쓴다.
  'category.scope-project': 'Repo scope — this repository only',
  'category.scope-user': 'Machine global — applies to this whole computer',
```

- [ ] **Step 4: 통과 확인**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs && npm test`
Expected: PASS. 전체 스위트에서 다른 파일이 실패하면 원인을 확인한다 —
plugin 픽스처를 쓰는 테스트가 라벨·그룹을 단언하고 있을 수 있다(그 단언을 새
동작으로 갱신하는 것이 맞는지 픽스처의 의도를 읽고 판단한다).

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/tui/rows.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/test/tui.rows.test.mjs
git commit -m "$(cat <<'EOF'
feat(installer): PLUGIN 탭을 설치 범위 그룹으로 가른다

같은 상류의 두 판(저장소/전역)이 무엇을 건드리는지가 이 탭에서 고르는
기준인데, 지금은 라벨 접미사와 상세 힌트로만 구분된다. 그룹 헤더로
범위를 화면 구조에 드러내고, 라벨에 로케일 접미사를, 힌트에 대상 CLI
이름을 싣는다. 항목 데이터 모델은 불변 — 표시 계층 오버라이드다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: 검토 화면 범위 분할과 전역 경고

**Files:**
- Modify: `agent-installer/lib/tui/render.mjs` (renderReview 239-268행, import 구획)
- Modify: `agent-installer/lib/i18n/catalog/ko.mjs` (323행 `'tui.review.hint'` 근처), `en.mjs` (333행 근처)
- Test: `agent-installer/test/tui.rows.test.mjs` (renderReview 테스트는 이 파일에 있다)

**Interfaces:**
- Consumes: `scopedLabel(item, t)` (Task 1), `category.scope-project`/`category.scope-user` 키 (Task 3)
- Produces: 없음 (말단 화면). 프레임 높이 계약 `lines.length === reviewBodyHeight(height) + 4`는 유지된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/tui.rows.test.mjs`의 `── 제출 검토 ──` 구획에 추가:

```js
test('renderReview: 전역 변경이 있으면 범위별 소제목과 경고가 붙는다', () => {
  const changes = [
    { action: 'install', item: { category: 'plugin', label: 'bkit', scope: 'project', supports: ['claude'] } },
    { action: 'install', item: { category: 'plugin', label: 'superpowers', scope: 'user', supports: ['codex', 'gemini'] } },
  ]
  const lines = renderReview(changes, { width: 90, height: 24, t: createT('ko') })
  const text = lines.join('\n')
  assert.match(text, /저장소 범위 — 이 저장소에만 적용/)
  assert.match(text, /머신 전역 — 이 컴퓨터 전체에 적용/)
  assert.match(text, /superpowers \(전역\)/)
  assert.match(text, /머신 전역 변경 1건/)
  // 저장소 묶음이 전역 묶음보다 먼저다 — 목록 화면과 같은 순서.
  assert.ok(text.indexOf('저장소 범위 —') < text.indexOf('머신 전역 —'))
  assert.equal(lines.length, reviewBodyHeight(24) + 4)
})

test('renderReview: 전역 변경이 없으면 소제목·경고 없이 기존 화면 그대로다', () => {
  const text = renderReview(CHANGES, { width: 80, height: 24, t: createT('ko') }).join('\n')
  assert.doesNotMatch(text, /저장소 범위 —/)
  assert.doesNotMatch(text, /머신 전역/)
})

test('renderReview: 범위 분할 화면도 넘치면 잘라내고 남은 건수를 알린다', () => {
  const many = [
    ...Array.from({ length: 40 }, (_, i) => ({ action: 'install', item: { category: 'plugin', label: `p${i}`, scope: 'project', supports: [...CLI_IDS] } })),
    { action: 'install', item: { category: 'plugin', label: 'g', scope: 'user', supports: [...CLI_IDS] } },
  ]
  const lines = renderReview(many, { width: 80, height: 12, t: createT('ko') })
  assert.ok(lines.join('\n').includes('…외'), '남은 건수 안내 없음')
  assert.match(lines.join('\n'), /머신 전역 변경 1건/)
  assert.equal(lines.length, reviewBodyHeight(12) + 4)
  for (const line of lines) assert.ok(width(line) <= 79, `너무 김: ${line}`)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs`
Expected: FAIL — 새 테스트 3건 중 1·3번 실패 (소제목·경고 없음). 2번은 통과한다
(현재 화면에도 그 문구가 없다) — 회귀 가드로 남긴다.

- [ ] **Step 3: renderReview 구현**

`render.mjs` import 구획에 추가:

```js
import { scopedLabel } from '../labels.mjs'
```

`renderReview` 전체(239-268행)를 교체:

```js
// 제출 검토 화면 — 적용 직전에 무엇이 바뀌는지만 보여 준다.
// 목록이 길면 잘라내고 남은 건수를 알린다(스크롤 대신) — 여기서 길을 잃을 이유는 없다.
export function renderReview(changes, opts = {}) {
  const { width: columns = 80, height = 24, dryRun = false, color = false, t = createT('en') } = opts
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const title = `${t('tui.review.title', { count: changes.length })}${dryRun ? ' (dry-run)' : ''}`
  const lines = [color ? `${BOLD}${cut(title, w)}${RESET}` : cut(title, w), '']

  // 적용 직전 마지막 화면이다. 일부 CLI에만 들어가는 항목은 여기서도 그 사실을
  // 밝힌다 — 목록에서 지나쳤더라도 되돌릴 수 있는 마지막 지점이다.
  // 전부 지원하는 항목은 조용히 둔다: 경고가 흔해지면 아무도 읽지 않는다.
  const changeLine = (c) => {
    const partial = c.item.supports && c.item.supports.length < CLI_IDS.length
    const cov = partial ? ` · ${t('item.cliCoverage', { covered: c.item.supports.length, total: CLI_IDS.length })}` : ''
    return cut(`  ${CHANGE_MARK[c.action] ?? '?'} ${pad(t(`change.${c.action}`), 10)} ${scopedLabel(c.item, t)}${cov}`, w)
  }

  // 전역 변경이 있을 때만 범위로 가른다 — 전부 저장소 범위인 흔한 경우에
  // 소제목은 잡음이다. 가를 때는 저장소 묶음이 먼저다(목록 화면과 같은 순서).
  const globals = changes.filter((c) => c.item.scope === 'user')
  const split = globals.length > 0
  const groups = split
    ? [
      { header: t('category.scope-project'), list: changes.filter((c) => c.item.scope !== 'user') },
      { header: t('category.scope-user'), list: globals },
    ].filter((g) => g.list.length > 0)
    : [{ header: null, list: changes }]

  // 소제목·경고 줄이 목록 지면을 갉아먹는다 — 그만큼 떼어 두지 않으면
  // "…외 N건" 판정이 어긋나 화면이 넘친다.
  const body = reviewBodyHeight(height)
  const overhead = split ? groups.length + 1 : 0
  const room = Math.max(1, body - 1 - overhead)

  let quota = room
  for (const g of groups) {
    // 지면이 다해도 소제목은 낸다 — 전역 묶음이 통째로 잘리더라도 그 평면이
    // 있다는 사실은 화면에 남아야 한다(경고 줄이 건수를 마저 말한다).
    if (g.header !== null) lines.push(paint(DIM, cut(`  ${g.header}`, w)))
    for (const c of g.list) {
      if (quota <= 0) break
      lines.push(changeLine(c))
      quota--
    }
  }
  const shown = room - quota
  if (changes.length > shown) {
    lines.push(paint(DIM, cut(t('tui.review.more', { count: changes.length - shown }), w)))
  } else {
    lines.push('')
  }
  if (split) lines.push(paint(DIM, cut(t('tui.review.globalWarning', { count: globals.length }), w)))
  while (lines.length < 2 + body) lines.push('')

  lines.push('')
  lines.push(paint(DIM, cut(t('tui.review.hint'), w)))
  return lines
}
```

`ko.mjs`의 `'tui.review.hint'` 줄(323행) 바로 아래에 추가:

```js
  'tui.review.globalWarning': '머신 전역 변경 {count}건 — 이 저장소 밖 설정(~/.codex 등)이 바뀝니다',
```

`en.mjs`의 `'tui.review.hint'` 줄(333행) 바로 아래에 추가:

```js
  'tui.review.globalWarning': '{count} machine-global change(s) — settings outside this repo (~/.codex etc.) will change',
```

- [ ] **Step 4: 통과 확인**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs && npm test`
Expected: PASS — 기존 renderReview 테스트 3건(건수·커버리지·잘림)도 그대로
통과해야 한다. 비분할 경로는 산식이 기존과 동일하다(overhead 0, room = body-1).

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/tui/render.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/test/tui.rows.test.mjs
git commit -m "$(cat <<'EOF'
feat(installer): 검토 화면이 전역 변경을 갈라 경고한다

적용 직전 마지막 화면인데 저장소 안팎 변경이 한 목록에 섞여 있었다.
전역 변경이 있을 때만 범위 소제목으로 가르고 경고 한 줄을 더한다 —
전부 저장소 범위인 흔한 경우에 소제목은 잡음이라 붙이지 않는다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 전역 항목 토글 안내와 결과 라벨

**Files:**
- Modify: `agent-installer/lib/tui/run.mjs` (select 176-187행, notable 출력 376행, import 구획)
- Modify: `agent-installer/lib/i18n/catalog/ko.mjs` (328행 `'tui.submitCancelled'` 근처), `en.mjs` (대응 위치)
- Test: `agent-installer/test/tui.run.test.mjs`

**Interfaces:**
- Consumes: `scopedLabel(item, t)` (Task 1), 항목 `scope` 필드 (기존)
- Produces: 없음 (말단 동작). i18n 키 `tui.selectedGlobal`.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/tui.run.test.mjs`에 추가. 파일 상단의 `drive`·`type`·`TAB`·
`DOWN`·`SPACE`·`CC` 헬퍼를 재사용한다 (`SPACE = { str: ' ', name: 'space' }`,
`CC = { name: 'c', ctrl: true }`로 이미 정의되어 있다):

```js
// 전역 항목은 이 체크 하나가 저장소 밖(~/.codex 등)을 건드린다 — 켜는 순간
// 상태줄이 그 사실을 말해야 한다. isolateGlobalHome()이 파일 상단에서 가짜
// 홈을 깔아 두므로 global.superpowers는 항상 미설치로 시작한다.
// 검색은 활성 탭 안으로만 걸리므로 TAB으로 PLUGIN 탭(작업 다음)에 먼저 간다.
test('전역 플러그인을 켜면 상태줄이 머신 전역임을 알린다', async () => {
  const { screen } = await drive([TAB, ...type('global.superpowers'), DOWN, SPACE, CC])
  assert.ok(screen.includes('머신 전역 항목 — 이 컴퓨터 전체에 적용됩니다'), '전역 안내 없음')
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/tui.run.test.mjs`
Expected: FAIL — '전역 안내 없음' (i18n 키도 아직 없다)

- [ ] **Step 3: run.mjs 구현**

import 구획(10행 `CLI_IDS` 근처)에 추가:

```js
import { scopedLabel } from '../labels.mjs'
```

`select()`(176행 부근)에서 `dropped` 분기 뒤, `return ''` 앞에 한 분기 추가:

```js
    if (dropped.length > 0) return t('tui.exclusiveSwitched', { kept: row.label, dropped: dropped.map((r) => r.label).join(', ') })
    // 전역 항목을 막 켰다면 알린다 — 이 체크 하나가 저장소 밖을 건드린다.
    // 배타 전환 메시지가 우선한다: 상태줄은 한 줄뿐이고 선택이 뒤집힌 쪽이 급하다.
    if (row.item?.scope === 'user' && state.selected.has(row.id) && !before.has(row.id)) return t('tui.selectedGlobal')
    return ''
```

notable 출력(376행)의 `r.item.label`을 교체:

```js
              log(`  ${r.ok ? '✔' : '✖'} ${t(`change.${r.action}`)} ${scopedLabel(r.item, t)}${message ? ` — ${message}` : ''}`)
```

`ko.mjs`의 `'tui.submitCancelled'` 줄(328행) 바로 아래에 추가:

```js
  'tui.selectedGlobal': '머신 전역 항목 — 이 컴퓨터 전체에 적용됩니다',
```

`en.mjs`의 `'tui.submitCancelled'` 줄 바로 아래에 추가:

```js
  'tui.selectedGlobal': 'Machine-global item — applies to this whole computer',
```

- [ ] **Step 4: 통과 확인**

Run: `cd agent-installer && node --test test/tui.run.test.mjs && node --test test/i18n.test.mjs`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/tui/run.mjs agent-installer/lib/i18n/catalog/ko.mjs agent-installer/lib/i18n/catalog/en.mjs agent-installer/test/tui.run.test.mjs
git commit -m "$(cat <<'EOF'
feat(installer): 전역 항목을 켜면 상태줄이 범위를 알린다

전역 항목은 체크 하나가 저장소 밖을 건드리는데 켜는 순간에는 아무
안내가 없었다. 켤 때 상태줄 한 줄로 알리고, 적용 결과 출력의 라벨도
scopedLabel을 거쳐 범위 접미사를 싣는다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 진행 화면·비대화형 출력 라벨

**Files:**
- Modify: `agent-installer/lib/tui/progress.mjs` (entryLines 69행, plainLine 153행, import 구획)
- Modify: `agent-installer/install.mjs` (63행 목록, 100행 결과, 105행 최종 상태, import 구획)
- Test: `agent-installer/test/tui.progress.test.mjs`

**Interfaces:**
- Consumes: `scopedLabel(item, t)` (Task 1)
- Produces: 없음 (말단 출력). install.mjs의 정적 import 목록에 `lib/labels.mjs`가
  는다 — import 없는 잎 모듈이라 부트스트랩 격리 불변식이 유지된다.

- [ ] **Step 1: 실패하는 테스트 작성**

`agent-installer/test/tui.progress.test.mjs`에 추가 (`createProgress`·`applyEvent`·
`progressLines`·`plainLine`·`createT`는 이미 import되어 있다):

```js
// 진행·평문 화면에는 그룹 헤더가 없다 — 전역 판이 도는 중임을 라벨 접미사가
// 말해야 한다.
test('진행 줄은 플러그인 라벨에 범위 접미사를 단다', () => {
  const changes = [{ action: 'install', item: { category: 'plugin', label: 'superpowers', scope: 'user' } }]
  let p = createProgress(changes)
  p = applyEvent(p, { index: 0, phase: 'start' }, 0)
  const text = progressLines(p, { width: 90, height: 24, now: 0, t: createT('ko') }).join('\n')
  assert.match(text, /superpowers \(전역\)/)
})

test('평문 진행 줄도 범위 접미사를 단다', () => {
  const line = plainLine(
    { phase: 'start', index: 0, total: 1, action: 'install', item: { category: 'plugin', label: 'superpowers', scope: 'user' } },
    createT('ko'),
  )
  assert.match(line, /superpowers \(전역\)/)
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd agent-installer && node --test test/tui.progress.test.mjs`
Expected: FAIL — 접미사 없는 `superpowers`만 찍힌다

- [ ] **Step 3: 구현**

`progress.mjs` import 구획(6행 근처)에 추가:

```js
import { scopedLabel } from '../labels.mjs'
```

`entryLines`(69행)의 `entry.item.label`을 교체:

```js
  const out = [cut(`${mark} ${pad(t(`change.${entry.action}`), actionWidth)} ${scopedLabel(entry.item, t)}${tail}`, w)]
```

`plainLine`(153행)의 `event.item.label`을 교체:

```js
      label: scopedLabel(event.item, t),
```

`install.mjs` import 구획(8행 `labelWidth` 근처)에 추가 — labels.mjs는 import가
없는 모듈이라 정적 import가 격리 불변식을 지킨다:

```js
import { scopedLabel } from './lib/labels.mjs'
```

`runClassic`의 세 자리를 교체 (63·100·105행):

```js
      console.log(`${pad(t(`status.${s.status}`), statusWidth)} ${s.item.id} — ${scopedLabel(s.item, t)}${detail ? ` (${detail})` : ''}`)
```

```js
    console.log(`${r.ok ? '✔' : '✖'} ${t(`change.${r.action}`)} ${scopedLabel(r.item, t)}${r.message ? ` — ${toText(t, r.message)}` : ''}`)
```

```js
  for (const s of after) console.log(`  ${pad(t(`status.${s.status}`), statusWidth)} ${scopedLabel(s.item, t)}`)
```

- [ ] **Step 4: 통과 확인**

Run: `cd agent-installer && node --test test/tui.progress.test.mjs && node --test test/bootstrap.isolation.test.mjs && node --test test/install.cli.test.mjs`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add agent-installer/lib/tui/progress.mjs agent-installer/install.mjs agent-installer/test/tui.progress.test.mjs
git commit -m "$(cat <<'EOF'
feat(installer): 진행·비대화형 출력에 범위 접미사를 단다

진행 화면과 --list/--set 출력에는 범위 그룹 헤더가 없어, 전역 판이
도는 중임을 라벨 접미사가 말해야 한다. 라벨을 찍는 남은 자리를 전부
scopedLabel로 통일한다.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 전체 검증과 스펙 상태 갱신

**Files:**
- Modify: `docs/superpowers/specs/2026-08-22-plugin-scope-ui-design.md` (상태 줄)

**Interfaces:**
- Consumes: Task 1-6 전체
- Produces: 검증 완료 상태

- [ ] **Step 1: 전체 테스트**

Run: `cd agent-installer && npm test`
Expected: 전체 PASS

- [ ] **Step 2: 런처 스모크**

Run (저장소 루트에서):
```bash
bash -n ./setup-agents.sh
bash ./setup-agents.sh --dry-run
pwsh -File ./setup-agents.ps1 -DryRun
```
Expected: 세 명령 모두 오류 없이 종료. dry-run 출력의 plugin 항목 라벨에
`(저장소)`/`(전역)`(또는 영어 로케일이면 `(repo)`/`(global)`) 접미사가 보인다.

- [ ] **Step 3: 잔존 문자열 최종 확인**

Run: `grep -rn "superpowers (plugin)\|superpowers (global)\|Ponytail (global)\|Matt Pocock (plugin)" agent-installer/lib agent-installer/test`
Expected: 출력 없음 (수기 접미사·옛 문구가 남아 있지 않다 — 새 i18n 값
`'(global)'` 자체는 정당한 키 값이라 검사 대상이 아니다)

- [ ] **Step 4: 스펙 상태 갱신과 커밋**

`docs/superpowers/specs/2026-08-22-plugin-scope-ui-design.md`의
`상태: 사용자 승인 대기` 줄을 다음으로 교체:

```markdown
상태: 승인됨 · 구현 완료 (계획: docs/superpowers/plans/2026-08-22-plugin-scope-ui.md)
```

```bash
git add docs/superpowers/specs/2026-08-22-plugin-scope-ui-design.md
git commit -m "$(cat <<'EOF'
docs(installer): 범위 UI 스펙을 구현 완료로 표시한다

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: 검증 결과 보고**

실행한 명령과 결과(통과/실패/미실행 사유)를 그대로 보고한다. 특히 pwsh 런처를
실행할 수 없는 환경이면 그 사실을 명시한다 — 조용히 건너뛰지 않는다.
