# agent-installer 다국어(i18n) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `agent-installer`의 사용자 노출 문자열 전부를 영어 기준으로 옮기고, OS 언어 감지·TUI 언어 전환·설치 기록 지속을 붙여 한국어를 모르는 사람도 쓸 수 있게 만든다.

**Architecture:** `lib/i18n/`에 의존성 0인 로케일 카탈로그와 `t` 팩토리를 두고, 이미 존재하는 옵션 주머니(`{ dryRun, log }`, `render(state, opts)`)에 `t`를 얹어 명시적으로 주입한다. 전역 싱글턴을 쓰지 않으므로 `state.mjs`는 계속 아무것도 import 하지 않는다. 옵션 주머니가 없는 곳(`context.mjs`, `record.mjs`)은 `LocalizedError`를, 데이터 계층이 만들어 나중에 표시되는 문구(`detect()`의 `detail`, `unsupported` 사유)는 `msg(key, params)` 구조체를 써서 렌더 시점에 번역한다.

**Tech Stack:** Node.js 20+, ESM, `node:test` + `node:assert/strict`. 새 npm 의존성 없음.

**설계 문서:** `docs/superpowers/specs/2026-07-30-installer-i18n-design.md`

## Global Constraints

- Node `>=20`. `agent-installer/package.json`의 `engines`를 바꾸지 않는다.
- **새 npm 의존성 0개.** `dependencies`는 `jsonc-parser`, `smol-toml` 그대로.
- `lib/i18n/**`, `lib/args.mjs`, `lib/context.mjs`, `lib/bootstrap/**`, `install.mjs`는 **`node:` 내장만** 정적 import 한다. `test/bootstrap.isolation.test.mjs`가 이 불변식을 강제한다.
- 기준 언어는 **영어**(`en`). 한국어(`ko`)는 두 번째 카탈로그이며, 지원 목록은 `LOCALES = ['en', 'ko']`이고 이 배열 순서가 곧 언어 메뉴 순환 순서다.
- 카탈로그 값은 **문자열 또는 문자열 배열**만 허용한다. 함수 값을 두지 않는다.
- 행 라벨(`action.*.label`)과 탭 이름(`section.*`)의 표시 폭은 **`render.mjs`의 `LABEL_WIDTH`(24) 이하**여야 한다.
- 설치 기록 `.agent-kit/agent-setup.json`의 `formatVersion`은 **1을 유지한다.** `lang`은 선택 필드 추가다.
- 소스 코드 주석은 **한국어**로 쓴다. 기존 파일의 주석 밀도와 어투를 따른다.
- 커밋 메시지는 `.gitmessage.txt` 형식: `<type>(<scope>): <subject>`. 제목은 한국어 50자 이내, 마침표 없음. 본문은 한국어 72자 줄바꿈. 모든 커밋 본문 끝에 다음 줄을 붙인다:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- 모든 작업 디렉터리 기준은 `agent-installer/`다. 테스트는 `cd agent-installer && npm test`로 돈다.

## File Structure

**신규**

| 파일 | 책임 |
|---|---|
| `lib/i18n/detect.mjs` | OS 언어 감지. 순수 — `env`와 Intl 로케일 문자열을 인자로 받는다 |
| `lib/i18n/index.mjs` | `LOCALES`·`resolveLocale`·`createT`·`LocalizedError`·`msg`·`toText` |
| `lib/i18n/catalog/en.mjs` | 기준 카탈로그. 모든 키의 원본 |
| `lib/i18n/catalog/ko.mjs` | 한국어 카탈로그 |
| `test/i18n.test.mjs` | 카탈로그 구조·폴백·우선순위·감지 검증 |
| `test/i18n.en.test.mjs` | 영어 로케일 출력에 한글이 없음을 강제하는 회귀 검사 |

**수정** — 책임은 그대로 두고 문구만 카탈로그로 옮긴다.

| 파일 | 변경 |
|---|---|
| `install.mjs` | 로케일 확정 흐름, `t` 주입, `LocalizedError` 렌더 |
| `lib/args.mjs` | `USAGE` 상수 5종 → 함수, `--lang` 플래그, `preScanLang` |
| `lib/context.mjs` | 오류 → `LocalizedError` |
| `lib/bootstrap/record.mjs` | `lang` 필드, `writeLang`, 오류 → `LocalizedError` |
| `lib/bootstrap/flow.mjs` | `t` 주입, 기록 쓸 때 `lang` 보존 |
| `lib/bootstrap/apply.mjs` | `t` 주입 |
| `lib/bootstrap/adapter.mjs` | `t` 주입 |
| `lib/engine.mjs` | `scan`의 실패 `detail` → `msg` |
| `lib/catalog.mjs` | `unsupported`·`detail`·설치 메시지 → `msg` |
| `lib/items/*.mjs` (7개) | `note` → 카탈로그 키 |
| `lib/status.mjs` | `formatStatus`에 `t` |
| `lib/update.mjs` | `t` 주입 |
| `lib/deps.mjs` | 오류 → `LocalizedError` |
| `lib/design-md/{flow,catalog,scan,open}.mjs` | `t` 주입, `기타`·`사내` → 카테고리 id |
| `lib/design-md/providers/awesome-design-md.mjs` | `UNCATEGORIZED` → 카테고리 id |
| `lib/tui/rows.mjs` | 섹션·그룹 id화, `t`로 라벨 조립, 언어 행 |
| `lib/tui/render.mjs` | `opts.t`, `LABEL_WIDTH` export |
| `lib/tui/run.mjs` | 언어 전환, `t` 교체, 선택 보존 재조립 |
| `test/helpers.mjs` | `runInstaller`에 `env` 옵션 |
| `setup-agents.sh` / `.ps1` | 영·한 병기 오류 문구, `.ps1`에 `-Lang` |

---

### Task 1: i18n 코어 — 감지·해석·카탈로그

**Files:**
- Create: `agent-installer/lib/i18n/detect.mjs`
- Create: `agent-installer/lib/i18n/index.mjs`
- Create: `agent-installer/lib/i18n/catalog/en.mjs`
- Create: `agent-installer/lib/i18n/catalog/ko.mjs`
- Test: `agent-installer/test/i18n.test.mjs`

**Interfaces:**
- Consumes: 없음 (잎 모듈)
- Produces:
  - `LOCALES: string[]` — `['en', 'ko']`
  - `detectLocale(env?: object, intlLocale?: string|null) → string|null` — 기본 서브태그 또는 null
  - `baseTag(raw: unknown) → string|null`
  - `resolveLocale({ flag?, env?, record?, detected? }) → 'en'|'ko'`
  - `createT(locale: string) → t`, `t(key: string, params?: object) → string`, `t.locale: string`
  - `class LocalizedError extends Error` — `.key`, `.params`, `.message`(영어)
  - `msg(key: string, params?: object) → { key, params }`
  - `toText(t, value: string|{key,params}|null|undefined) → string|null|undefined`

- [ ] **Step 1: 감지 테스트를 먼저 쓴다**

`agent-installer/test/i18n.test.mjs`를 만든다.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { baseTag, detectLocale } from '../lib/i18n/detect.mjs'

// ── OS 언어 감지 ──────────────────────────────────────────────────

test('baseTag는 로케일 표기에서 기본 서브태그만 남긴다', () => {
  assert.equal(baseTag('ko_KR.UTF-8'), 'ko')
  assert.equal(baseTag('ko-KR'), 'ko')
  assert.equal(baseTag('en_US'), 'en')
  assert.equal(baseTag('de'), 'de')
  assert.equal(baseTag('en_US:en'), 'en')
})

test('baseTag는 로케일 미지정 값을 null로 본다', () => {
  assert.equal(baseTag('C'), null)
  assert.equal(baseTag('POSIX'), null)
  assert.equal(baseTag('c.UTF-8'), null)
  assert.equal(baseTag(''), null)
  assert.equal(baseTag('   '), null)
  assert.equal(baseTag(undefined), null)
  assert.equal(baseTag(42), null)
})

test('detectLocale은 LC_ALL을 가장 먼저 본다', () => {
  const env = { LC_ALL: 'ko_KR.UTF-8', LC_MESSAGES: 'de_DE', LANG: 'fr_FR' }
  assert.equal(detectLocale(env, 'en-US'), 'ko')
})

test('detectLocale은 환경변수 순서를 지킨다', () => {
  assert.equal(detectLocale({ LC_MESSAGES: 'de_DE', LANG: 'fr_FR' }, 'en-US'), 'de')
  assert.equal(detectLocale({ LANG: 'fr_FR', LANGUAGE: 'ko' }, 'en-US'), 'fr')
  assert.equal(detectLocale({ LANGUAGE: 'ko:en' }, 'en-US'), 'ko')
})

test('detectLocale은 환경변수가 비면 Intl 로케일로 내려간다', () => {
  // Windows에서 실제로 걷는 경로다 — LANG 계열이 비어 있다.
  assert.equal(detectLocale({}, 'ko-KR'), 'ko')
  assert.equal(detectLocale({ LANG: 'C' }, 'ko-KR'), 'ko')
})

test('detectLocale은 아무것도 못 얻으면 null을 돌려준다', () => {
  assert.equal(detectLocale({}, null), null)
  assert.equal(detectLocale({ LANG: 'POSIX' }, ''), null)
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `cd agent-installer && node --test test/i18n.test.mjs`
Expected: FAIL — `Cannot find module '../lib/i18n/detect.mjs'`

- [ ] **Step 3: detect.mjs를 구현한다**

`agent-installer/lib/i18n/detect.mjs`:

```js
// OS 언어 감지. 순수 함수다 — env와 Intl 결과를 인자로 받는다.
// 여기서 지원 여부를 판단하지 않는다: OS가 뭐라고 하는지만 그대로 보고하고,
// 그중 무엇을 쓸지는 resolveLocale이 정한다. 둘을 섞으면 "감지는 됐는데
// 지원하지 않아 영어로 갔다"와 "감지 자체가 실패했다"를 구별할 수 없다.

// POSIX 관례상 뒤에 오는 것이 앞을 덮지 않는다 — 먼저 잡히는 것이 이긴다.
const ENV_KEYS = ['LC_ALL', 'LC_MESSAGES', 'LANG', 'LANGUAGE']

// 로케일을 지정하지 않았다는 뜻의 값. 여기서 멈추면 Intl로 내려가지 못한다.
const NEUTRAL = new Set(['c', 'posix'])

// `ko_KR.UTF-8` · `en_US:en` · `ko-KR` 을 모두 `ko`/`en`으로 줄인다.
// `.`은 인코딩, `@`는 변형(modifier), `:`은 LANGUAGE의 목록 구분자다.
export function baseTag(raw) {
  if (typeof raw !== 'string') return null
  const head = raw.trim().split(/[.:@]/)[0]
  if (!head) return null
  if (NEUTRAL.has(head.toLowerCase())) return null
  const tag = head.replace(/_/g, '-').split('-')[0].toLowerCase()
  return tag || null
}

// Node 20+는 full-icu가 기본이라 Windows에서도 OS 언어를 반영한다.
// 축소 빌드에서는 'en-US'로 고정되는데, 그때는 영어로 시작하는 것이 맞다.
function intlLocale() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale
  } catch {
    return null
  }
}

export function detectLocale(env = {}, intl = intlLocale()) {
  for (const key of ENV_KEYS) {
    const tag = baseTag(env[key])
    if (tag) return tag
  }
  return baseTag(intl)
}
```

- [ ] **Step 4: 감지 테스트가 통과하는지 확인한다**

Run: `cd agent-installer && node --test test/i18n.test.mjs`
Expected: PASS (6 tests)

- [ ] **Step 5: 카탈로그와 t 테스트를 더한다**

`test/i18n.test.mjs` 상단 import를 바꾸고 아래 블록을 파일 끝에 이어 붙인다.

```js
import { LOCALES, createT, resolveLocale, LocalizedError, msg, toText } from '../lib/i18n/index.mjs'
import EN from '../lib/i18n/catalog/en.mjs'
import KO from '../lib/i18n/catalog/ko.mjs'
import { LABEL_WIDTH, width } from '../lib/tui/render.mjs'
```

```js
// ── 카탈로그 구조 ─────────────────────────────────────────────────
//
// 번역 누락은 "어디를 빠뜨렸는지 모른다"가 본질이다. 아래 네 검사가
// 카탈로그 차원의 누락을 전부 잡는다.

const CATALOGS = { en: EN, ko: KO }
const PLACEHOLDER = /\{(\w+)\}/g

function slots(value) {
  const text = Array.isArray(value) ? value.join('\n') : value
  return new Set([...String(text).matchAll(PLACEHOLDER)].map((m) => m[1]))
}

test('모든 로케일이 같은 키 집합을 갖는다', () => {
  const base = Object.keys(EN).sort()
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(CATALOGS[locale]).sort(), base, `${locale} 카탈로그의 키가 다르다`)
  }
})

test('키마다 자리 집합이 로케일 사이에서 같다', () => {
  for (const key of Object.keys(EN)) {
    const want = slots(EN[key])
    for (const locale of LOCALES) {
      assert.deepEqual([...slots(CATALOGS[locale][key])].sort(), [...want].sort(), `${locale}:${key}의 자리가 다르다`)
    }
  }
})

test('키마다 값 타입이 로케일 사이에서 같다', () => {
  for (const key of Object.keys(EN)) {
    for (const locale of LOCALES) {
      assert.equal(Array.isArray(CATALOGS[locale][key]), Array.isArray(EN[key]), `${locale}:${key}의 타입이 다르다`)
    }
  }
})

test('카탈로그 값에 함수를 두지 않는다', () => {
  for (const locale of LOCALES) {
    for (const [key, value] of Object.entries(CATALOGS[locale])) {
      const ok = typeof value === 'string' || (Array.isArray(value) && value.every((v) => typeof v === 'string'))
      assert.ok(ok, `${locale}:${key}가 문자열도 문자열 배열도 아니다`)
    }
  }
})

test('행 라벨과 탭 이름이 LABEL_WIDTH 안에 든다', () => {
  // 상수 24를 베끼지 않는다 — 두 값이 따로 놀면 규칙이 조용히 무의미해진다.
  for (const locale of LOCALES) {
    const t = createT(locale)
    for (const key of Object.keys(EN)) {
      if (!/^(action\..*\.label|section\.)/.test(key)) continue
      const text = t(key, { current: 'English' })
      assert.ok(width(text) <= LABEL_WIDTH, `${locale}:${key} 폭 ${width(text)} > ${LABEL_WIDTH} — "${text}"`)
    }
  }
})

// ── t ─────────────────────────────────────────────────────────────

test('t는 자리를 채운다', () => {
  const t = createT('en')
  assert.equal(t('locale.en'), 'English')
  assert.equal(t('error.notGitRepo'), 'Run this inside a Git repository.')
})

test('t는 모르는 키에 던진다', () => {
  const t = createT('en')
  assert.throws(() => t('nope.not.here'), /nope\.not\.here/)
})

test('t는 자리에 값이 없으면 던진다', () => {
  const t = createT('en')
  assert.throws(() => t('error.pathOutsideRepo', {}), /\{path\}/)
})

test('t는 활성 카탈로그에 없는 키를 영어로 폴백한다', () => {
  const t = createT('ko')
  const saved = KO['locale.en']
  delete KO['locale.en']
  try {
    assert.equal(t('locale.en'), EN['locale.en'])
  } finally {
    KO['locale.en'] = saved
  }
})

test('t.locale은 실제로 쓰이는 로케일이다', () => {
  assert.equal(createT('ko').locale, 'ko')
  assert.equal(createT('sw').locale, 'en')
})

// ── resolveLocale ─────────────────────────────────────────────────

test('resolveLocale은 플래그 > 환경변수 > 기록 > 감지 순으로 고른다', () => {
  const all = { flag: 'ko', env: { AGENT_SETUP_LANG: 'en' }, record: { lang: 'en' }, detected: 'en' }
  assert.equal(resolveLocale(all), 'ko')
  assert.equal(resolveLocale({ ...all, flag: null }), 'en')
  assert.equal(resolveLocale({ flag: null, env: {}, record: { lang: 'ko' }, detected: 'en' }), 'ko')
  assert.equal(resolveLocale({ flag: null, env: {}, record: null, detected: 'ko' }), 'ko')
})

test('resolveLocale은 지원하지 않는 값을 건너뛴다', () => {
  // 손으로 편집된 기록이나 환경에 남은 값 때문에 도구가 죽으면 안 된다.
  assert.equal(resolveLocale({ env: { AGENT_SETUP_LANG: 'de' }, record: { lang: 'ko' } }), 'ko')
  assert.equal(resolveLocale({ record: { lang: 'zz' }, detected: 'fr' }), 'en')
  assert.equal(resolveLocale({}), 'en')
})

// ── LocalizedError · msg ──────────────────────────────────────────

test('LocalizedError는 영어 메시지와 키를 함께 갖는다', () => {
  const err = new LocalizedError('error.pathOutsideRepo', { path: '/tmp/x' })
  assert.equal(err.key, 'error.pathOutsideRepo')
  assert.deepEqual(err.params, { path: '/tmp/x' })
  assert.equal(err.message, createT('en')('error.pathOutsideRepo', { path: '/tmp/x' }))
  assert.ok(err instanceof Error)
})

test('toText는 구조화 메시지만 번역하고 문자열은 그대로 둔다', () => {
  const t = createT('ko')
  assert.equal(toText(t, msg('locale.en')), 'English')
  assert.equal(toText(t, '이미 문자열'), '이미 문자열')
  assert.equal(toText(t, null), null)
  assert.equal(toText(t, undefined), undefined)
})
```

- [ ] **Step 6: 테스트가 실패하는지 확인한다**

Run: `cd agent-installer && node --test test/i18n.test.mjs`
Expected: FAIL — `Cannot find module '../lib/i18n/index.mjs'`

- [ ] **Step 7: 씨앗 카탈로그 두 벌을 만든다**

`agent-installer/lib/i18n/catalog/en.mjs`:

```js
// 기준 카탈로그 — 모든 키의 원본이자 폴백이다.
// ko.mjs는 이 키 집합을 그대로 따라야 한다. 키·자리·타입이 어긋나는 순간
// i18n.test.mjs가 실패한다.
//
// 값은 문자열 또는 문자열 배열(여러 줄)만 쓴다. 함수를 두면 카탈로그가
// 데이터가 아니게 되어 완전성 검사를 할 수 없다.
export default {
  // 언어 이름은 어떤 화면에서 보든 자기 언어로 쓴다 — 두 카탈로그에서 값이 같다.
  'locale.en': 'English',
  'locale.ko': '한국어',

  'error.notGitRepo': 'Run this inside a Git repository.',
  'error.pathOutsideRepo': 'Cannot write outside the repository: {path}',
}
```

`agent-installer/lib/i18n/catalog/ko.mjs`:

```js
// 한국어 카탈로그. 키 집합은 en.mjs를 그대로 따른다.
export default {
  'locale.en': 'English',
  'locale.ko': '한국어',

  'error.notGitRepo': 'git 저장소 안에서 실행해야 합니다.',
  'error.pathOutsideRepo': '저장소 밖의 경로에는 쓸 수 없습니다: {path}',
}
```

- [ ] **Step 8: index.mjs를 구현한다**

`agent-installer/lib/i18n/index.mjs`:

```js
// 로케일 해석과 문구 조회. 잎(leaf) 모듈이라 아무것도 import 하지 않는다 —
// args.mjs·context.mjs·bootstrap/*가 전부 여기에 닿으므로, 외부 의존성이
// 하나라도 들어오면 npm install 없이 도는 부트스트랩이 깨진다.
// bootstrap.isolation.test.mjs가 이 불변식을 지킨다.
//
// 전역 싱글턴을 두지 않는다. t는 만들어서 넘기는 값이다 — 그래야 순수
// 모듈(state.mjs)이 계속 아무것도 import 하지 않고, 테스트가 파일 병렬로
// 돌아도 로케일이 서로를 오염시키지 않는다.
import EN from './catalog/en.mjs'
import KO from './catalog/ko.mjs'

export const LOCALES = ['en', 'ko']

const CATALOGS = { en: EN, ko: KO }
const PLACEHOLDER = /\{(\w+)\}/g

// 자리에 값이 없으면 던진다. `12 of undefined files`가 화면에 남는 것보다
// 즉시 실패가 낫다 — 이건 번역 누락이 아니라 호출부의 버그다.
function fill(template, params, key) {
  return template.replace(PLACEHOLDER, (_, name) => {
    if (!Object.hasOwn(params, name)) {
      throw new Error(`i18n: '${key}'의 자리 {${name}}에 값이 없습니다`)
    }
    return String(params[name])
  })
}

// 활성 카탈로그 → 영어 폴백 → 예외.
// 번역 누락은 사용자 화면을 깨뜨리지 않아야 하지만, 영어에도 없는 키는
// 개발자 오타다. 조용히 넘기면 화면에 'log.file.creat'가 그대로 찍힌다.
function lookup(locale, key) {
  const value = CATALOGS[locale]?.[key]
  if (value !== undefined) return value
  const base = EN[key]
  if (base === undefined) throw new Error(`i18n: 알 수 없는 키입니다: ${key}`)
  return base
}

export function createT(locale) {
  const use = LOCALES.includes(locale) ? locale : 'en'
  const t = (key, params = {}) => {
    const value = lookup(use, key)
    return Array.isArray(value)
      ? value.map((line) => fill(line, params, key)).join('\n')
      : fill(value, params, key)
  }
  t.locale = use
  return t
}

// 앞이 이긴다: 플래그 > 환경변수 > 설치 기록 > OS 감지 > 영어.
// 지원하지 않는 값은 조용히 건너뛴다 — 손으로 편집된 기록이나 환경에 남은
// 값 때문에 도구가 죽으면 안 된다. 사용자가 --lang으로 명시한 경우만
// args.mjs가 따로 거부한다.
export function resolveLocale({ flag = null, env = {}, record = null, detected = null } = {}) {
  for (const value of [flag, env.AGENT_SETUP_LANG, record?.lang, detected]) {
    if (typeof value === 'string' && LOCALES.includes(value)) return value
  }
  return 'en'
}

// 옵션 주머니가 없어 t를 꿸 수 없는 곳(context.mjs의 repoPath,
// record.mjs의 readRecord)이 쓴다. .message는 영어로 즉시 채워 스택
// 트레이스가 그대로 읽히게 하고, 진입점이 .key를 보고 다시 렌더한다.
export class LocalizedError extends Error {
  constructor(key, params = {}) {
    super(createT('en')(key, params))
    this.name = 'LocalizedError'
    this.key = key
    this.params = params
  }
}

// 데이터 계층이 만들어 나중에 표시되는 문구용. detect()의 detail이나
// unsupported 사유는 만들어지는 시점에 로케일을 모른다 — 키를 담아 두고
// 렌더 시점에 toText로 푼다.
export function msg(key, params = {}) {
  return { key, params }
}

export function toText(t, value) {
  if (value === null || value === undefined) return value
  return typeof value === 'string' ? value : t(value.key, value.params)
}
```

- [ ] **Step 9: render.mjs에서 LABEL_WIDTH를 내보낸다**

`lib/tui/render.mjs:13`의 `const LABEL_WIDTH = 24`를 `export const LABEL_WIDTH = 24`로 바꾼다. 테스트가 상수를 베끼지 않고 import 하게 하기 위한 것이다.

- [ ] **Step 10: 테스트를 돌린다**

Run: `cd agent-installer && node --test test/i18n.test.mjs`
Expected: PASS (18 tests)

- [ ] **Step 11: 격리 불변식이 살아 있는지 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.isolation.test.mjs`
Expected: PASS (3 tests)

- [ ] **Step 12: 커밋**

```bash
cd agent-installer
git add lib/i18n test/i18n.test.mjs lib/tui/render.mjs
git commit -F - <<'EOF'
add: 로케일 카탈로그와 t 팩토리

전역 싱글턴 대신 만들어 넘기는 t를 택한다. 순수 모듈이 계속
아무것도 import 하지 않아야 하고, 테스트가 파일 병렬로 돌아도
로케일이 서로를 오염시키면 안 되기 때문이다.

영어를 기준 카탈로그로 두고 누락은 영어로 폴백한다. 영어에도
없는 키는 개발자 오타이므로 던진다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: args.mjs — 도움말 함수화와 `--lang`

**Files:**
- Modify: `agent-installer/lib/args.mjs` (전면)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs` (키 추가)
- Test: `agent-installer/test/args.test.mjs` (기존 단언 조정)

**Interfaces:**
- Consumes: `createT`, `LOCALES`, `LocalizedError` (Task 1)
- Produces:
  - `preScanLang(argv: string[]) → 'en'|'ko'|null`
  - `bootstrapUsage(t) → string`, `rootUsage(t) → string`, `designUsage(t) → string`, `updateUsage(t) → string`, `statusUsage(t) → string`
  - `parseRootArgs(argv, t?) → { help, dryRun, listOnly, setArg, skillMode, designDirs, lang, interactive }`
  - `parseBootstrapArgs(argv, t?) → { help, dryRun, adopt, skillMode, lang }`
  - `parseDesignArgs(argv, t?) → { help, dryRun, list, set, preview, sync, designDirs, lang, interactive }`
  - `parseUpdateArgs(argv, t?) → { help, dryRun, force, lang }`
  - `parseStatusArgs(argv, t?) → { help, json, lang }`
  - 모든 파서의 `t` 기본값은 `createT('en')`

- [ ] **Step 1: 실패 테스트를 쓴다**

`test/args.test.mjs` 끝에 이어 붙인다.

```js
import { preScanLang, rootUsage, bootstrapUsage } from '../lib/args.mjs'
import { createT } from '../lib/i18n/index.mjs'

test('preScanLang은 두 표기를 모두 읽는다', () => {
  assert.equal(preScanLang(['--lang', 'ko']), 'ko')
  assert.equal(preScanLang(['--lang=ko']), 'ko')
  assert.equal(preScanLang(['bootstrap', '--dry-run', '--lang', 'en']), 'en')
  assert.equal(preScanLang([]), null)
})

test('preScanLang은 지원하지 않는 값에 던지지 않는다', () => {
  // 정식 파서가 지원 목록을 담은 오류를 낸다. 여기서 던지면 오류 경로가 둘로 갈린다.
  assert.equal(preScanLang(['--lang', 'zz']), null)
  assert.equal(preScanLang(['--lang']), null)
})

test('파서는 --lang을 받아들이고 값을 돌려준다', () => {
  assert.equal(parseRootArgs(['--lang', 'ko']).lang, 'ko')
  assert.equal(parseBootstrapArgs(['--lang=en']).lang, 'en')
  assert.equal(parseStatusArgs(['--json', '--lang', 'ko']).lang, 'ko')
  assert.equal(parseRootArgs([]).lang, null)
})

test('--lang에 지원하지 않는 값을 주면 거부한다', () => {
  // 명시한 값이 조용히 무시되면 안 된다.
  assert.throws(() => parseRootArgs(['--lang', 'zz']), /en, ko/)
  assert.throws(() => parseRootArgs(['--lang']), /en, ko/)
})

test('--lang은 대화형 여부를 바꾸지 않는다', () => {
  assert.equal(parseRootArgs(['--lang', 'ko']).interactive, true)
})

test('사용법은 t를 받아 로케일에 맞게 나온다', () => {
  assert.match(rootUsage(createT('en')), /Usage:/)
  assert.match(rootUsage(createT('ko')), /사용법:/)
  assert.match(bootstrapUsage(createT('en')), /--skill-mode/)
})
```

기존 테스트에서 `BOOTSTRAP_USAGE` 등 상수를 import 하던 줄이 있으면 함수 호출로 바꾼다. `grep -n "USAGE" test/args.test.mjs`로 찾는다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/args.test.mjs`
Expected: FAIL — `preScanLang is not a function`

- [ ] **Step 3: 카탈로그에 도움말과 인자 오류 키를 더한다**

`lib/i18n/catalog/en.mjs`에 추가:

```js
  'usage.bootstrap': [
    'Usage: npx @rch4com/agent-setup bootstrap [--skill-mode auto|link|copy] [--dry-run]',
    '       node install.mjs bootstrap [options]   # when the installer lives in the repo',
    '',
    'Options:',
    '  --skill-mode auto|link|copy  How skills are wired up. (default: auto)',
    '                                  auto: try a symlink first, fall back to copying.',
    '                                  link: symlink only. Exit with an error if it fails.',
    '                                  copy: always make copies.',
    '  --adopt                      Create nothing. Record only the existing files that',
    '                               already match this version of the templates.',
    '  --lang en|ko                 Display language for this run.',
    '  --dry-run                    Change nothing; print what would happen.',
    '  -h, --help                   Print this help and exit.',
    '',
    'The launchers work too:',
    '  ./setup-agents.sh [options]',
    '  pwsh -File ./setup-agents.ps1 [options]',
    '  Pass --tui (or -Tui) to install dependencies and open the interactive screen,',
    '  where bootstrap, agents, and design.md live in one searchable list.',
  ],
  'usage.root': [
    'Usage: npx @rch4com/agent-setup [options]',
    '       npx @rch4com/agent-setup bootstrap [options]',
    '       npx @rch4com/agent-setup update [options]',
    '       npx @rch4com/agent-setup status [options]',
    '       npx @rch4com/agent-setup design [options]',
    '',
    'When the installer lives in the repo, use node install.mjs in place of',
    'npx @rch4com/agent-setup.',
    '',
    'With no options this opens the interactive screen, where bootstrap, agents,',
    'and design.md live in one searchable list.',
    '',
    'Options:',
    '  --list                       Print the current install state and exit.',
    '  --set <list>                 Converge on a comma-separated set of items.',
    '                               Use --set "" to remove everything.',
    '  --skill-mode auto|link|copy  How the bootstrap launched from the interactive',
    '                               screen wires up skills. (default: auto)',
    '  --design-dir <path>          Add a design.md source. Accepts <source-id>=<path>',
    '                               and may be repeated.',
    '  --lang en|ko                 Display language for this run.',
    '  --dry-run                    Change nothing; print what would happen.',
    '  -h, --help                   Print this help and exit.',
    '',
    '--list and --set both choose an action, so they cannot be combined.',
    '',
    'Subcommand help: npx @rch4com/agent-setup bootstrap --help',
    '                 npx @rch4com/agent-setup update --help',
    '                 npx @rch4com/agent-setup status --help',
    '                 npx @rch4com/agent-setup design --help',
  ],
  'usage.design': [
    'Usage: npx @rch4com/agent-setup design [options]',
    '       node install.mjs design [options]   # when the installer lives in the repo',
    '',
    'With no options this opens the interactive screen, where the DESIGN.MD tab lives.',
    '',
    'Options:',
    '  --list                 Print the catalog and install state.',
    '  --set <list>           Converge on a comma-separated set of items.',
    '                         A token is <name> or <provider>/<name>.',
    '                         Use --set "" to remove everything.',
    '  --preview <list>       Open previews.',
    '  --sync=installed       Refetch installed copies from their sources.',
    '  --sync=catalog         Rebuild the available list and categories from sources.',
    '  --sync=stale           Compare installed copies against their sources by hash.',
    '  --design-dir <path>    Add a design.md source. Accepts <source-id>=<path>',
    '                         and may be repeated.',
    '  --lang en|ko           Display language for this run.',
    '  --dry-run              Change nothing; print what would happen.',
    '  -h, --help             Print this help and exit.',
    '',
    '--list, --set, --preview, and --sync each choose an action, so only one',
    'may be given at a time.',
  ],
  'usage.update': [
    'Usage: npx @rch4com/agent-setup update [options]',
    '',
    'Compares hashes against the install record and refreshes only the managed',
    'files that are still exactly as we wrote them. Files you edited are left',
    'alone and reported as drift.',
    '',
    'Options:',
    '  --force      Overwrite drifted files too. The working tree must be clean',
    '               (git is the only way back).',
    '  --lang en|ko Display language for this run.',
    '  --dry-run    Change nothing; print what would happen.',
    '  -h, --help   Print this help and exit.',
  ],
  'usage.status': [
    'Usage: npx @rch4com/agent-setup status [options]',
    '',
    'Shows intent (the install record), reality (a scan of the repository), and',
    'the running tool version side by side. Changes nothing.',
    '',
    'Options:',
    '  --json       Print machine-readable output (for CI checks).',
    '  --lang en|ko Display language for this run.',
    '  -h, --help   Print this help and exit.',
  ],

  'error.unknownArg': 'Unknown argument: {token}\n\n{usage}',
  'error.flagTakesNoValue': '{name} takes no value: {token}\n\n{usage}',
  'error.singleAction': 'Cannot be combined: {given} — give only one action flag at a time.\n\n{usage}',
  'error.badSkillMode': '--skill-mode must be one of {list}: {value}\n\n{usage}',
  'error.skillModeNeedsValue': '--skill-mode needs a value ({list}).\n\n{usage}',
  'error.badLang': '--lang must be one of {list}: {value}\n\n{usage}',
  'error.langNeedsValue': '--lang needs a value ({list}).\n\n{usage}',
  'error.needsValue': '{name} needs a value.',
  'error.setNeedsValue': '--set needs an item list. Use --set "" to remove everything.',
  'error.badSync': 'Use --sync=installed|catalog|stale.',
```

`lib/i18n/catalog/ko.mjs`에는 **기존 `args.mjs`의 한국어 원문을 그대로** 같은 키로 옮긴다. `usage.*`는 현재 템플릿 리터럴을 줄 단위 배열로 쪼개고, `--lang en|ko  이번 실행에 쓸 표시 언어입니다.` 한 줄씩을 각 옵션 목록에 더한다. 오류 키는 다음과 같다:

```js
  'error.unknownArg': '알 수 없는 인자입니다: {token}\n\n{usage}',
  'error.flagTakesNoValue': '{name}에는 값을 줄 수 없습니다: {token}\n\n{usage}',
  'error.singleAction': '함께 쓸 수 없습니다: {given} — 동작 플래그는 한 번에 하나만 지정하세요.\n\n{usage}',
  'error.badSkillMode': '--skill-mode는 {list} 중 하나여야 합니다: {value}\n\n{usage}',
  'error.skillModeNeedsValue': '--skill-mode 뒤에 값이 필요합니다 ({list} 중 하나).\n\n{usage}',
  'error.badLang': '--lang은 {list} 중 하나여야 합니다: {value}\n\n{usage}',
  'error.langNeedsValue': '--lang 뒤에 값이 필요합니다 ({list} 중 하나).\n\n{usage}',
  'error.needsValue': '{name} 뒤에 값이 필요합니다.',
  'error.setNeedsValue': '--set 뒤에 항목 목록이 필요합니다. 전체 제거는 --set "" 로 명시하세요.',
  'error.badSync': '--sync=installed|catalog|stale 형식으로 지정하세요.',
```

- [ ] **Step 4: args.mjs를 고친다**

파일 맨 위 import를 더한다.

```js
import { LOCALES, LocalizedError, createT } from './i18n/index.mjs'
```

`export const BOOTSTRAP_USAGE = ...` 다섯 상수를 지우고 함수로 바꾼다.

```js
// 사용법은 모듈 로드 시점에 로케일을 모르므로 상수가 될 수 없다.
export const bootstrapUsage = (t) => t('usage.bootstrap')
export const rootUsage = (t) => t('usage.root')
export const designUsage = (t) => t('usage.design')
export const updateUsage = (t) => t('usage.update')
export const statusUsage = (t) => t('usage.status')
```

각 SPEC에 `--lang`을 더한다.

```js
const HELP_SPEC = { '-h': 'bool', '--help': 'bool', '--lang': 'value' }
```

`HELP_SPEC`이 다섯 SPEC 모두에 펼쳐지므로 이 한 줄로 끝난다. `--lang`이 모든 서브커맨드에서 통해야 한다는 요구와 정확히 맞는다.

`throw new Error(...)`를 전부 `LocalizedError`로 바꾼다.

```js
export function assertKnownArgs(argv, spec, usage) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    const eq = token.startsWith('--') ? token.indexOf('=') : -1
    const name = eq > 0 ? token.slice(0, eq) : token
    const kind = spec[name]
    if (kind === undefined) throw new LocalizedError('error.unknownArg', { token, usage })
    if (kind === 'bool' && eq > 0) throw new LocalizedError('error.flagTakesNoValue', { name, token, usage })
    if (kind === 'value' && eq < 0) i++
  }
}

export function assertSingleAction(argv, names, usage) {
  const given = names.filter((name) => hasFlag(argv, name))
  if (given.length > 1) {
    // 조사를 붙이지 않는다 — 플래그 이름에 따라 은/는이 갈려 문장이 어색해진다.
    throw new LocalizedError('error.singleAction', { given: given.join(', '), usage })
  }
}
```

`checkSkillMode`·`parseSkillMode`도 같은 방식으로 바꾸고, 그 바로 옆에 `--lang` 쌍을 만든다.

```js
function checkLang(value, usage) {
  if (!LOCALES.includes(value)) {
    throw new LocalizedError('error.badLang', { list: LOCALES.join(', '), value, usage })
  }
  return value
}

// `--lang <값>`과 `--lang=<값>`을 모두 받는다. 없으면 null —
// 이 자리에서 기본값을 정하지 않는다. 우선순위 판단은 resolveLocale의 몫이다.
export function parseLang(argv, usage) {
  let lang = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new LocalizedError('error.langNeedsValue', { list: LOCALES.join(', '), usage })
      }
      lang = checkLang(value, usage)
      i++
    } else if (a.startsWith('--lang=')) {
      lang = checkLang(a.slice('--lang='.length), usage)
    }
  }
  return lang
}

// 진입점이 로케일을 정하기 **전에** 부르는 관대한 사전 스캔이다.
// 여기서 던지면 인자 오류가 늘 영어로 나온다 — 정식 파서가 지역화된
// 오류를 내도록 미지원 값은 조용히 null로 넘긴다.
export function preScanLang(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = a === '--lang' ? argv[i + 1] : a.startsWith('--lang=') ? a.slice('--lang='.length) : null
    if (typeof value === 'string' && LOCALES.includes(value)) return value
  }
  return null
}
```

`requireValue`·`collectValues`·`parseSetArg`의 오류도 `LocalizedError('error.needsValue', { name })` / `LocalizedError('error.setNeedsValue')`로 바꾼다.

다섯 파서에 `t` 매개변수와 `lang` 반환을 더한다. `parseRootArgs`를 본보기로 삼는다.

```js
export function parseRootArgs(argv, t = createT('en')) {
  const usage = rootUsage(t)
  if (wantsHelp(argv)) {
    return { help: true, dryRun: false, listOnly: false, setArg: null, skillMode: 'auto', designDirs: [], lang: null, interactive: false }
  }
  assertKnownArgs(argv, ROOT_SPEC, usage)
  assertSingleAction(argv, ['--list', '--set'], usage)
  const setArg = parseSetArg(argv)
  return {
    help: false,
    dryRun: argv.includes('--dry-run'),
    listOnly: argv.includes('--list'),
    setArg,
    skillMode: parseSkillMode(argv, usage),
    designDirs: collectValues(argv, '--design-dir'),
    lang: parseLang(argv, usage),
    // 목록·집합 지정이 없으면 대화형 화면으로 간다. --lang은 동작 플래그가
    // 아니므로 여기에 끼지 않는다.
    interactive: !argv.includes('--list') && setArg === null,
  }
}
```

`parseBootstrapArgs`·`parseDesignArgs`·`parseUpdateArgs`·`parseStatusArgs`도 같은 형태로 `t`를 받고 `lang: parseLang(argv, usage)`를 더한다. `wantsHelp` 분기의 반환 객체에도 `lang: null`을 넣는다.

- [ ] **Step 5: 테스트를 돌린다**

Run: `cd agent-installer && node --test test/args.test.mjs test/i18n.test.mjs`
Expected: PASS

- [ ] **Step 6: 영어 도움말 회귀 검사를 만든다**

`agent-installer/test/i18n.en.test.mjs`를 만든다. 이후 작업이 표면을 하나씩 이 목록에 더한다.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createT } from '../lib/i18n/index.mjs'
import { bootstrapUsage, rootUsage, designUsage, updateUsage, statusUsage } from '../lib/args.mjs'

// 번역 누락의 본질은 "어디를 빠뜨렸는지 모른다"이다.
// 영어 로케일 출력에 한글이 하나라도 있으면 그 자리가 누락이다.
const HANGUL = /[가-힣]/

export function assertNoHangul(text, what) {
  const m = HANGUL.exec(String(text))
  if (!m) return
  const at = Math.max(0, m.index - 40)
  assert.fail(`${what}에 한글이 남아 있습니다 (위치 ${m.index}): …${String(text).slice(at, m.index + 40)}…`)
}

test('영어 사용법 다섯 종에 한글이 없다', () => {
  const t = createT('en')
  for (const [name, fn] of Object.entries({ bootstrapUsage, rootUsage, designUsage, updateUsage, statusUsage })) {
    assertNoHangul(fn(t), name)
  }
})
```

- [ ] **Step 7: 회귀 검사를 돌린다**

Run: `cd agent-installer && node --test test/i18n.en.test.mjs`
Expected: PASS (1 test)

- [ ] **Step 8: 커밋**

```bash
cd agent-installer
git add lib/args.mjs lib/i18n/catalog test/args.test.mjs test/i18n.en.test.mjs
git commit -F - <<'EOF'
feat(installer): 도움말을 함수로 바꾸고 --lang을 받는다

사용법은 모듈 로드 시점에 로케일을 모르므로 상수일 수 없다.
다섯 종을 t를 받는 함수로 바꾸고 인자 오류를 LocalizedError로
옮긴다.

preScanLang은 진입점이 로케일을 정하기 전에 쓰는 관대한 스캔이라
미지원 값에 던지지 않는다. 지역화된 거부는 정식 파서가 맡는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: install.mjs 로케일 확정과 context.mjs 오류

**Files:**
- Modify: `agent-installer/install.mjs`
- Modify: `agent-installer/lib/context.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/context.test.mjs`, `agent-installer/test/install.cli.test.mjs`, `agent-installer/test/helpers.mjs`

**Interfaces:**
- Consumes: `preScanLang`·다섯 파서 (Task 2), `resolveLocale`·`createT`·`LocalizedError`·`detectLocale` (Task 1)
- Produces:
  - `install.mjs`가 모든 하위 경로에 `opts.t`와 `opts.localeForced`를 넘긴다
  - `runInstaller(cwd, args, { timeout?, input?, env? })` — `test/helpers.mjs`

- [ ] **Step 1: 실패 테스트를 쓴다**

먼저 `test/helpers.mjs`의 `runInstaller`에 `env`를 받는다.

```js
export function runInstaller(cwd, args, { timeout = 30000, input = '', env = {} } = {}) {
  return spawnSync(process.execPath, [INSTALL_MJS, ...args], {
    cwd, encoding: 'utf8', timeout, input,
    env: { ...process.env, ...env },
  })
}

// 이 저장소의 기존 테스트는 한국어 문구를 그대로 단언한다. 기본 로케일이
// 영어가 된 뒤에도 그 단언들이 뜻을 잃지 않도록 로케일을 못박아 돌린다.
export const KO = { AGENT_SETUP_LANG: 'ko' }
```

`test/install.cli.test.mjs`에 더한다.

```js
import { makeTempRepo, runInstaller, KO } from './helpers.mjs'

test('로케일이 없으면 영어로 나온다', () => {
  const root = makeTempRepo()
  // LANG 계열을 비우고 Intl까지 영어로 고정한다 — 개발 기계의 OS 언어가
  // 테스트 결과를 바꾸면 CI와 로컬이 갈린다.
  const r = runInstaller(root, ['--help'], {
    env: { AGENT_SETUP_LANG: '', LC_ALL: 'C', LC_MESSAGES: '', LANG: 'C', LANGUAGE: '', LC_TIME: 'C' },
  })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Usage:/)
})

test('AGENT_SETUP_LANG=ko면 한국어로 나온다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--help'], { env: KO })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /사용법:/)
})

test('--lang이 환경변수를 이긴다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--help', '--lang', 'en'], { env: KO })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Usage:/)
})

test('git 저장소가 아니면 선택한 언어로 거부한다', () => {
  const outside = mkdtempSync(join(tmpdir(), 'agent-installer-nogit-'))
  const en = runInstaller(outside, ['--list'], { env: { AGENT_SETUP_LANG: 'en' } })
  assert.equal(en.status, 1)
  assert.match(en.stderr, /Git repository/)

  const ko = runInstaller(outside, ['--list'], { env: KO })
  assert.equal(ko.status, 1)
  assert.match(ko.stderr, /git 저장소/)
})
```

`mkdtempSync`·`tmpdir`·`join` import가 파일에 없으면 더한다.

기존 테스트 중 한국어를 단언하는 것들(`/\[작업\]/`, `/대화형 화면은 터미널에서만/` 등)은 `{ env: KO }`를 붙인다. `install.cli.test.mjs`·`bootstrap.cli.test.mjs`·`pack.test.mjs`의 모든 `runInstaller` 호출이 대상이다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/install.cli.test.mjs`
Expected: FAIL — `--help`가 여전히 한국어이고 `--lang` 미인식

- [ ] **Step 3: context.mjs의 오류를 옮긴다**

```js
import { LocalizedError } from './i18n/index.mjs'
```

세 군데를 바꾼다.

```js
  } catch {
    throw new LocalizedError('error.notGitRepo')
  }
```

```js
    throw new LocalizedError('error.pathOutsideRepo', { path: abs })
```

```js
    throw new LocalizedError('error.pathUnresolvable', { path: probe, code: err.code ?? err.message })
```
```js
    throw new LocalizedError('error.pathUnresolvable', { path: root, code: err.code ?? err.message })
```
```js
    throw new LocalizedError('error.pathEscapesViaLink', { path: probe, real: realProbe })
```

카탈로그에 더한다 — `en.mjs`:

```js
  'error.pathUnresolvable': 'Cannot resolve path: {path} ({code})',
  'error.pathEscapesViaLink': 'This in-repo path escapes through an external link: {path} -> {real}',
```

`ko.mjs`:

```js
  'error.pathUnresolvable': '경로를 확인할 수 없습니다: {path} ({code})',
  'error.pathEscapesViaLink': '저장소 내부 경로가 외부 링크를 통해 이탈합니다: {path} -> {real}',
```

- [ ] **Step 4: install.mjs의 진입 흐름을 바꾼다**

import를 바꾼다.

```js
import { findRepoRoot } from './lib/context.mjs'
import { runBootstrap } from './lib/bootstrap/flow.mjs'
import { readRecord } from './lib/bootstrap/record.mjs'
import { withDeps } from './lib/deps.mjs'
import { LocalizedError, createT, resolveLocale } from './lib/i18n/index.mjs'
import { detectLocale } from './lib/i18n/detect.mjs'
import {
  bootstrapUsage, designUsage, rootUsage, statusUsage, updateUsage,
  parseBootstrapArgs, parseDesignArgs, parseRootArgs, parseStatusArgs, parseUpdateArgs, preScanLang,
} from './lib/args.mjs'
```

모듈 상단의 `STATUS_LABEL`·`ACTION_LABEL` 상수를 지운다 — 이제 `t`로 만든다.

`main()`을 바꾼다.

```js
// 저장소 탐지와 기록 읽기는 "있으면 쓴다"로만 한다. 여기서 던지면 언어를
// 정하기도 전에 죽어, 한국어를 모르는 사람이 한국어 오류를 보게 된다.
// 삼킨 오류는 사라지지 않는다 — 기록을 실제로 쓰는 명령이 readRecord를
// 정식으로 다시 불러 그때 지역화된 오류로 던진다.
function tryFindRepoRoot() {
  try { return findRepoRoot() } catch { return null }
}

function tryReadRecord(root) {
  try { return readRecord(root) } catch { return null }
}

async function main() {
  const argv = process.argv.slice(2)

  const flag = preScanLang(argv)
  const root = tryFindRepoRoot()
  const record = root === null ? null : tryReadRecord(root)
  const locale = resolveLocale({ flag, env: process.env, record, detected: detectLocale(process.env) })
  const t = createT(locale)
  // 플래그·환경변수가 로케일을 강제하면 TUI의 언어 전환이 이번 실행에
  // 반영되지 않는다. 조용히 안 먹는 대신 화면이 그 사실을 알리게 한다.
  const localeForced = Boolean(flag) || Boolean(process.env.AGENT_SETUP_LANG)

  if (root === null) throw new LocalizedError('error.notGitRepo')

  if (argv[0] === 'bootstrap') {
    const opts = parseBootstrapArgs(argv.slice(1), t)
    if (opts.help) { console.log(bootstrapUsage(t)); return }
    const { failed } = runBootstrap(root, { ...opts, t })
    if (failed.length > 0) process.exitCode = 1
    return
  }

  if (argv[0] === 'update') {
    const opts = parseUpdateArgs(argv.slice(1), t)
    if (opts.help) { console.log(updateUsage(t)); return }
    const { runUpdate } = await withDeps(() => import('./lib/update.mjs'), t)
    await runUpdate(root, { ...opts, t })
    return
  }

  if (argv[0] === 'status') {
    const opts = parseStatusArgs(argv.slice(1), t)
    if (opts.help) { console.log(statusUsage(t)); return }
    const { runStatus } = await withDeps(() => import('./lib/status.mjs'), t)
    await runStatus(root, { ...opts, t })
    return
  }

  if (argv[0] === 'design') {
    const opts = parseDesignArgs(argv.slice(1), t)
    if (opts.help) { console.log(designUsage(t)); return }
    if (opts.interactive) return openTui(root, { ...opts, t, localeForced })
    const { runDesign } = await withDeps(() => import('./lib/design-md/flow.mjs'), t)
    await runDesign(root, { ...opts, t })
    return
  }

  const opts = parseRootArgs(argv, t)
  if (opts.help) { console.log(rootUsage(t)); return }
  if (opts.interactive) return openTui(root, { ...opts, t, localeForced })
  await runClassic(root, { ...opts, t })
}

// 오류는 한 곳에서 지역화한다. LocalizedError의 .message는 영어라
// 스택 트레이스가 읽히고, 여기서 활성 로케일로 다시 렌더한다.
main().catch((err) => {
  const t = createT(resolveLocale({ env: process.env, detected: detectLocale(process.env) }))
  console.error(err.key ? t(err.key, err.params) : err.message)
  process.exit(1)
})
```

`main()`의 `t`를 catch에서 다시 못 쓰므로 catch가 로케일을 한 번 더 푼다. 기록은 못 읽지만 플래그·환경변수·OS는 그대로 반영된다 — 오류 경로에서 기록까지 다시 읽을 이유는 없다.

`openTui`와 `runClassic` 시그니처를 바꾼다.

```js
async function openTui(root, { dryRun, skillMode, designDirs, t, localeForced }) {
  const { runTui } = await withDeps(() => import('./lib/tui/run.mjs'), t)
  await runTui(root, { dryRun, skillMode, designDirs, t, localeForced })
}

async function runClassic(root, { dryRun, listOnly, setArg, t }) {
  const { loadItems } = await withDeps(() => import('./lib/catalog.mjs'), t)
  const { scan, planChanges, apply } = await withDeps(() => import('./lib/engine.mjs'), t)
  const items = await loadItems()
  const states = await scan(root, items)

  if (listOnly) {
    for (const s of states) {
      const detail = toText(t, s.detail)
      console.log(`${t(`status.${s.status}`).padEnd(7)} ${s.item.id} — ${s.item.label}${detail ? ` (${detail})` : ''}`)
    }
    return
  }

  const selectedIds = new Set(setArg.split(',').map((s) => s.trim()).filter(Boolean))
  const known = new Set(items.map((i) => i.id))
  for (const id of selectedIds) if (!known.has(id)) throw new LocalizedError('error.unknownItem', { id })

  const changes = planChanges(states, selectedIds)
  if (changes.length === 0) { console.log(t('apply.noChanges')); return }

  const results = await apply(root, changes, { dryRun, t })
  for (const r of results) {
    console.log(`${r.ok ? '✔' : '✖'} ${t(`change.${r.action}`)} ${r.item.label}${r.message ? ` — ${toText(t, r.message)}` : ''}`)
  }

  const after = await scan(root, items)
  console.log(`\n${t('apply.finalState')}`)
  for (const s of after) console.log(`  ${t(`status.${s.status}`).padEnd(7)} ${s.item.label}`)
  console.log(`\n${t('apply.seeGitDiff')}`)
  if (results.some((r) => !r.ok)) process.exitCode = 1
}
```

`toText`를 import에 더한다. `padEnd(7)`은 한국어 라벨 기준이었으므로 영어에서는 `t('status.installed')`가 `Installed`(9자)라 어긋난다. `padEnd(7)`을 지우고 `padEnd(12)`로 넓힌다 — 두 언어 모두 12칸 안에 든다.

- [ ] **Step 5: 카탈로그에 상태·변경·적용 키를 더한다**

`en.mjs`:

```js
  'status.installed': 'Installed',
  'status.partial': 'Partial',
  'status.absent': 'Not installed',

  'change.install': 'Install',
  'change.complete': 'Complete',
  'change.uninstall': 'Remove',

  'apply.noChanges': 'Nothing to change.',
  'apply.finalState': 'Final state:',
  'apply.seeGitDiff': 'Use git diff to review the config changes.',
  'error.unknownItem': 'Unknown item: {id}',
```

`ko.mjs`:

```js
  'status.installed': '설치됨',
  'status.partial': '일부 설치됨',
  'status.absent': '미설치',

  'change.install': '설치',
  'change.complete': '보완 설치',
  'change.uninstall': '제거',

  'apply.noChanges': '변경할 항목이 없습니다.',
  'apply.finalState': '최종 상태:',
  'apply.seeGitDiff': '설정 파일 변경 내용은 git diff로 확인할 수 있습니다.',
  'error.unknownItem': '알 수 없는 항목: {id}',
```

- [ ] **Step 6: deps.mjs가 t를 받게 한다**

`withDeps(fn, t)` 시그니처로 바꾸고 안내 문구를 카탈로그로 옮긴다.

```js
import { LocalizedError } from './i18n/index.mjs'

export async function withDeps(load, t) {
  try {
    return await load()
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') throw new LocalizedError('error.depsMissing')
    throw err
  }
}
```

실제 `deps.mjs`의 현재 구현에 맞춰 조건 분기는 그대로 두고 메시지만 `LocalizedError('error.depsMissing')`으로 바꾼다. `t` 인자는 쓰지 않아도 시그니처에 남겨 둔다 — 호출부가 이미 넘기고 있고, 나중에 지역화된 안내가 늘어날 자리다.

`en.mjs` / `ko.mjs`:

```js
  'error.depsMissing': [
    'This feature needs dependencies. Run one of:',
    '  npm install --prefix agent-installer',
    '  ./setup-agents.sh --tui',
  ],
```
```js
  'error.depsMissing': [
    '이 기능에는 의존성이 필요합니다. 다음 중 하나를 실행하세요:',
    '  npm install --prefix agent-installer',
    '  ./setup-agents.sh --tui',
  ],
```

기존 `deps.mjs`의 안내 문구 본문을 그대로 옮기되, 실제 파일의 명령 줄을 확인해 맞춘다.

- [ ] **Step 7: 테스트를 돌린다**

Run: `cd agent-installer && node --test test/install.cli.test.mjs test/context.test.mjs test/args.test.mjs test/i18n.test.mjs test/deps.test.mjs`
Expected: PASS

`context.test.mjs`·`deps.test.mjs`가 한국어 메시지를 단언한다면 영어로 바꾼다 — 이 두 파일은 `LocalizedError`의 `.message`(영어)를 보게 되므로 `{ env: KO }`가 통하지 않는다.

- [ ] **Step 8: 격리 불변식을 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.isolation.test.mjs`
Expected: PASS — `install.mjs`가 새로 정적 import 하는 `record.mjs`·`i18n/*`은 모두 의존성 0이다

- [ ] **Step 9: 커밋**

```bash
cd agent-installer
git add install.mjs lib/context.mjs lib/deps.mjs lib/i18n/catalog test/helpers.mjs test/install.cli.test.mjs test/context.test.mjs test/deps.test.mjs
git commit -F - <<'EOF'
feat(installer): 진입점이 로케일을 정하고 오류를 지역화한다

인자 오류와 저장소 탐지 오류는 로케일이 정해지기 전에 던져질 수
있다. 저장소와 기록을 "있으면 쓴다"로만 읽어 로케일을 먼저 확정한
뒤 미뤄 둔 오류를 던진다.

삼킨 기록 오류는 사라지지 않는다. 기록을 실제로 쓰는 명령이
readRecord를 정식으로 다시 부른다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: 설치 기록의 `lang` 필드

**Files:**
- Modify: `agent-installer/lib/bootstrap/record.mjs`
- Modify: `agent-installer/lib/bootstrap/flow.mjs` (기록 쓸 때 `lang` 보존)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/record.test.mjs`

**Interfaces:**
- Consumes: `LOCALES`·`LocalizedError` (Task 1)
- Produces:
  - `emptyRecord({ skillMode?, lang? }) → { formatVersion, pinnedVersion, skillMode, lang, items, design, managed }`
  - `readRecord(root) → { …, lang: 'en'|'ko'|null } | null`
  - `writeRecord(root, record, { dryRun?, log?, t? }) → { ok, action, path }`
  - `writeLang(root, lang, { dryRun?, log?, t? }) → { ok, action, path }`

- [ ] **Step 1: 실패 테스트를 쓴다**

`test/record.test.mjs`에 이어 붙인다.

```js
import { emptyRecord, readRecord, writeLang, writeRecord } from '../lib/bootstrap/record.mjs'

test('emptyRecord의 lang 기본값은 null이다', () => {
  assert.equal(emptyRecord().lang, null)
  assert.equal(emptyRecord({ lang: 'ko' }).lang, 'ko')
})

test('readRecord는 지원하지 않는 lang을 null로 떨어뜨린다', () => {
  const root = makeTempRepo()
  writeRecord(root, { ...emptyRecord(), lang: 'zz' })
  assert.equal(readRecord(root).lang, null)
})

test('readRecord는 lang이 없는 옛 기록을 그대로 읽는다', () => {
  const root = makeTempRepo()
  const old = emptyRecord()
  delete old.lang
  writeRecord(root, old)
  // formatVersion을 올리지 않았으므로 옛 기록이 막히면 안 된다.
  assert.equal(readRecord(root).lang, null)
})

test('writeLang은 기록이 없으면 새로 만든다', () => {
  const root = makeTempRepo()
  writeLang(root, 'ko')
  assert.equal(readRecord(root).lang, 'ko')
})

test('writeLang은 기존 기록의 나머지를 보존한다', () => {
  const root = makeTempRepo()
  writeRecord(root, { ...emptyRecord({ skillMode: 'copy' }), items: ['mcp.notion'] })
  writeLang(root, 'ko')
  const after = readRecord(root)
  assert.equal(after.lang, 'ko')
  assert.equal(after.skillMode, 'copy')
  assert.deepEqual(after.items, ['mcp.notion'])
})

test('writeLang은 dry-run에서 아무것도 쓰지 않는다', () => {
  const root = makeTempRepo()
  writeLang(root, 'ko', { dryRun: true })
  assert.equal(readRecord(root), null)
})
```

`makeTempRepo` import가 없으면 `./helpers.mjs`에서 가져온다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/record.test.mjs`
Expected: FAIL — `writeLang is not a function`

- [ ] **Step 3: record.mjs를 고친다**

import를 더한다.

```js
import { LOCALES, LocalizedError } from '../i18n/index.mjs'
```

```js
export function emptyRecord({ skillMode = 'auto', lang = null } = {}) {
  return {
    formatVersion: FORMAT_VERSION,
    pinnedVersion: toolVersion(),
    skillMode,
    lang,
    items: [],
    design: [],
    managed: {},
  }
}
```

`readRecord`의 오류를 옮기고 `lang`을 채운다.

```js
    throw new LocalizedError('error.recordUnreadable', { path: RECORD_REL, code: err.code ?? err.message })
```
```js
    throw new LocalizedError('error.recordNotJson', { path: RECORD_REL, message: err.message })
```
```js
    throw new LocalizedError('error.recordVersion', { path: RECORD_REL, found: parsed.formatVersion, expected: FORMAT_VERSION })
```
```js
  return {
    formatVersion: parsed.formatVersion,
    pinnedVersion: parsed.pinnedVersion ?? null,
    skillMode: parsed.skillMode ?? 'auto',
    // 손으로 편집된 값 때문에 도구가 죽으면 안 된다. 모르는 값은 없는 것으로 본다.
    lang: LOCALES.includes(parsed.lang) ? parsed.lang : null,
    items: Array.isArray(parsed.items) ? parsed.items : [],
    design: Array.isArray(parsed.design) ? parsed.design : [],
    managed: parsed.managed && typeof parsed.managed === 'object' ? parsed.managed : {},
  }
```

`writeRecord`의 로그를 지역화하고, `writeLang`을 더한다.

```js
export function writeRecord(root, record, { dryRun = false, log, t } = {}) {
  const target = repoPathStrict(root, RECORD_REL)
  const body = `${JSON.stringify({ ...record, pinnedVersion: toolVersion() }, null, 2)}\n`
  log?.(t ? t('log.record.write', { path: RECORD_REL }) : `record: ${RECORD_REL}`)
  if (!dryRun) {
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, body, { encoding: 'utf8' })
  }
  return { ok: true, action: dryRun ? 'skip' : 'write', path: RECORD_REL }
}

// 언어만 바꾼다. 기록이 없으면 만든다 — 부트스트랩 전에 언어를 골라도
// 유지되어야 하기 때문이다. 나머지 필드는 있는 그대로 옮긴다.
export function writeLang(root, lang, { dryRun = false, log, t } = {}) {
  const previous = readRecord(root)
  return writeRecord(root, { ...(previous ?? emptyRecord()), lang }, { dryRun, log, t })
}
```

- [ ] **Step 4: flow.mjs가 lang을 보존하게 한다**

`lib/bootstrap/flow.mjs`의 기록 조립부를 바꾼다. **이 한 줄이 없으면 부트스트랩이 사용자가 고른 언어를 지운다.**

```js
  const record = {
    ...emptyRecord({ skillMode }),
    // 부트스트랩은 배선만 다룬다. 사용자가 고른 언어·항목을 지울 권한이 없다.
    lang: previous?.lang ?? null,
    items: previous?.items ?? [],
    design: previous?.design ?? [],
    managed: collectManaged(root, manifest),
  }
```

- [ ] **Step 5: 카탈로그에 기록 키를 더한다**

`en.mjs`:

```js
  'log.record.write': 'install record written: {path}',
  'error.recordUnreadable': 'Cannot read {path} ({code})',
  'error.recordNotJson': 'Cannot read {path} — not JSON ({message})',
  'error.recordVersion': '{path} has format version {found}. This tool uses {expected} — upgrade the tool or recreate the record.',
```

`ko.mjs`:

```js
  'log.record.write': '설치 기록 기록: {path}',
  'error.recordUnreadable': '{path}을 읽을 수 없습니다 ({code})',
  'error.recordNotJson': '{path}을 읽을 수 없습니다 — JSON이 아닙니다 ({message})',
  'error.recordVersion': '{path}의 형식 버전이 {found}입니다. 이 도구는 {expected}을 씁니다 — 도구를 올리거나 기록을 다시 만드세요.',
```

- [ ] **Step 6: 테스트를 돌린다**

Run: `cd agent-installer && node --test test/record.test.mjs test/bootstrap.flow.test.mjs test/status.test.mjs test/update.test.mjs`
Expected: PASS

`bootstrap.flow.test.mjs`가 기록 모양 전체를 `deepEqual`로 단언한다면 `lang: null`을 기대값에 더한다.

- [ ] **Step 7: 언어가 부트스트랩을 넘어 살아남는지 확인한다**

`test/record.test.mjs`에 더한다.

```js
test('부트스트랩은 기록의 lang을 지우지 않는다', () => {
  const root = makeTempRepo()
  writeLang(root, 'ko')
  runBootstrap(root, { log: () => {} })
  assert.equal(readRecord(root).lang, 'ko')
})
```

`runBootstrap` import를 `../lib/bootstrap/flow.mjs`에서 가져온다.

Run: `cd agent-installer && node --test test/record.test.mjs`
Expected: PASS

- [ ] **Step 8: 커밋**

```bash
cd agent-installer
git add lib/bootstrap/record.mjs lib/bootstrap/flow.mjs lib/i18n/catalog test/record.test.mjs test/bootstrap.flow.test.mjs
git commit -F - <<'EOF'
feat(installer): 설치 기록에 lang을 남긴다

선택 필드 추가라 formatVersion은 1을 유지한다. 버전을 올리면 기존
기록을 가진 저장소가 전부 막힌다.

부트스트랩이 기록을 다시 쓸 때 lang을 보존한다. 배선만 다루는
명령이 사용자가 고른 언어를 지울 권한은 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: 부트스트랩 로그 지역화

**Files:**
- Modify: `agent-installer/lib/bootstrap/flow.mjs`
- Modify: `agent-installer/lib/bootstrap/apply.mjs`
- Modify: `agent-installer/lib/bootstrap/adapter.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/bootstrap.apply.test.mjs`, `bootstrap.flow.test.mjs`, `bootstrap.adapter.test.mjs`, `bootstrap.cli.test.mjs`, `test/i18n.en.test.mjs`

**Interfaces:**
- Consumes: `createT`·`LocalizedError` (Task 1)
- Produces:
  - `runBootstrap(root, { dryRun?, skillMode?, adopt?, log?, manifest?, t? })` — `t` 기본값 `createT('en')`
  - `apply.mjs`의 모든 `ensure*`/`update*`가 `{ dryRun, log, t }` 주머니를 받는다
  - 결과 객체의 `message`는 **구조화 메시지**(`msg(key, params)`) 또는 문자열

- [ ] **Step 1: 영어 스모크에 부트스트랩을 더한다**

`test/i18n.en.test.mjs`에 이어 붙인다.

```js
import { makeTempRepo, runInstaller } from './helpers.mjs'

const EN = { AGENT_SETUP_LANG: 'en' }

test('영어 부트스트랩 dry-run 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['bootstrap', '--dry-run'], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  assertNoHangul(r.stdout, 'bootstrap --dry-run stdout')
  assertNoHangul(r.stderr, 'bootstrap --dry-run stderr')
})

test('영어 부트스트랩 실제 실행 출력에 한글이 없다', () => {
  // dry-run은 "파일 생성" 분기만 밟는다. 두 번 돌려 "기존 파일 유지"·
  // "관리 블록 확인" 같은 멱등 분기까지 훑어야 누락이 드러난다.
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const second = runInstaller(root, ['bootstrap'], { env: EN })
  assert.equal(second.status, 0, second.stderr)
  assertNoHangul(second.stdout, 'bootstrap 2회차 stdout')
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/i18n.en.test.mjs`
Expected: FAIL — `bootstrap --dry-run stdout에 한글이 남아 있습니다`

- [ ] **Step 3: 카탈로그에 부트스트랩 키를 더한다**

`en.mjs`에 추가한다. 오른쪽은 기존 한국어 원문이 `ko.mjs`로 그대로 간다.

| 키 | 영어 | 한국어(기존 원문) |
|---|---|---|
| `log.repoRoot` | `repository root: {path}` | `저장소 루트: {path}` |
| `log.noGlobalWrites` | `Global config paths are never read or modified.` | `글로벌 설정 경로는 읽거나 수정하지 않습니다.` |
| `log.dir.create` | `create directory: {path}` | `디렉터리 생성: {path}` |
| `log.file.keep` | `keep existing file: {path}` | `기존 파일 유지: {path}` |
| `log.file.create` | `create file: {path}` | `파일 생성: {path}` |
| `log.file.update` | `update file: {path}` | `파일 갱신: {path}` |
| `log.file.userEdited` | `edited by you — left alone: {path}` | `사용자 수정 — 건드리지 않음: {path}` |
| `log.block.keep` | `managed block present: {path}` | `관리 블록 확인: {path}` |
| `log.block.add` | `add managed block: {path}` | `관리 블록 추가: {path}` |
| `log.block.update` | `update managed block: {path}` | `관리 블록 갱신: {path}` |
| `log.block.missing` | `no managed block — left alone: {path}` | `관리 블록 없음 — 건드리지 않음: {path}` |
| `log.block.userEdited` | `block edited by you — left alone: {path}` | `블록 사용자 수정 — 건드리지 않음: {path}` |
| `log.json.keep` | `config key present: {path} — {key}` | `설정 키 확인: {path} — {key}` |
| `log.json.add` | `add config key: {path} — {key}` | `설정 키 추가: {path} — {key}` |
| `log.ignore.keep` | `.gitignore entries present: {entries}` | `.gitignore 항목 확인: {entries}` |
| `log.ignore.add` | `add .gitignore entries: {entries}` | `.gitignore 항목 추가: {entries}` |
| `log.warn.unreadable` | `warning: cannot read {path}, skipping ({code})` | `경고: {path}을 읽을 수 없어 건너뜁니다 ({code})` |
| `log.warn.noRootObject` | `warning: no root object in {path}, skipping` | `경고: {path}에서 루트 객체를 찾지 못해 건너뜁니다` |
| `log.warn.ignoreShadowed` | `warning: "{parent}" in .gitignore excludes the whole directory, so the "{entry}" negation has no effect. Change it to "{parent}/*" to include it again.` | `경고: .gitignore의 "{parent}"가 디렉터리 전체를 제외해 "{entry}" 부정 항목이 무효화됩니다. "{parent}/*" 형태로 바꾸면 다시 포함됩니다.` |
| `log.skill.linkOk` | `{tool} skill link present: {path}` | `{tool} 스킬 링크 확인: {path}` |
| `log.skill.linkCreate` | `{tool} skill link created: {path} -> {target}` | `{tool} 스킬 링크 생성: {path} -> {target}` |
| `log.skill.copyCreate` | `{tool} skill copy created: {path}` | `{tool} 스킬 복제본 생성: {path}` |
| `log.skill.copySync` | `{tool} skill copy synced: {path}` | `{tool} 스킬 복제본 동기화: {path}` |
| `log.skill.plan` | `{tool} skill adapter to be created: {path} ({mode})` | `{tool} 스킬 어댑터 생성 예정: {path} ({mode})` |
| `log.skill.warnForeignLink` | `warning: {path} is a link pointing elsewhere. Leaving it alone.` | `경고: {path} 경로가 다른 위치를 가리키는 링크입니다. 변경하지 않습니다.` |
| `log.skill.warnUnmanaged` | `warning: {path} already exists and is not managed by agent-kit. Leaving it alone.` | `경고: {path} 경로가 이미 존재하며 agent-kit 관리 대상이 아닙니다. 변경하지 않습니다.` |
| `log.skill.linkFellBack` | `warning: {tool} link creation failed; falling back to copying.` | `경고: {tool} 링크 생성에 실패하여 복사 방식으로 전환합니다.` |
| `msg.readFailed` | `read failed` | `읽기 실패` |
| `msg.noRootObject` | `no root object` | `루트 객체 없음` |
| `msg.foreignLink` | `link pointing elsewhere` | `다른 위치를 가리키는 링크` |
| `msg.unmanagedExisting` | `existing entry not under management` | `관리 대상이 아닌 기존 항목` |
| `msg.noManagedBlock` | `no managed block` | `관리 블록 없음` |
| `msg.linkFailed` | `link creation failed: {message}` | `링크 생성 실패: {message}` |
| `bootstrap.failures` | `{count} failed:` | `실패 {count}건:` |
| `bootstrap.done` | `done.` | `완료되었습니다.` |
| `bootstrap.sharedGuide` | `shared guide: AGENTS.md` | `공통 지침: AGENTS.md` |
| `bootstrap.sharedSkills` | `shared skills: .agents/skills/` | `공통 스킬: .agents/skills/` |
| `bootstrap.tools` | `tools covered: {list}` | `적용 도구: {list}` |
| `bootstrap.repoOnly` | `Every per-tool config was created inside this repository only.` | `도구별 설정은 모두 현재 저장소 안에만 생성되었습니다.` |
| `bootstrap.noOverwrite` | `No existing config file was overwritten.` | `기존 설정 파일은 덮어쓰지 않았습니다.` |
| `bootstrap.record` | `install record: {path}` | `설치 기록: {path}` |
| `error.badSkillModeRuntime` | `--skill-mode must be one of {list}: {value}` | `--skill-mode는 {list} 중 하나여야 합니다: {value}` |

- [ ] **Step 4: flow.mjs를 고친다**

```js
import { createT } from '../i18n/index.mjs'
import { LocalizedError } from '../i18n/index.mjs'
```

```js
export function runBootstrap(root, opts = {}) {
  const { dryRun = false, skillMode = 'auto', adopt = false, log = console.log, manifest = MANIFEST, t = createT('en') } = opts

  if (!SKILL_MODES.includes(skillMode)) {
    throw new LocalizedError('error.badSkillModeRuntime', { list: SKILL_MODES.join(', '), value: skillMode })
  }

  const say = (message) => log(`[agent-setup] ${message}`)
  const ctx = { dryRun, log: say, t }

  say(t('log.repoRoot', { path: root }))
  say(t('log.noGlobalWrites'))
```

꼬리 보고도 바꾼다.

```js
  const failed = results.filter((r) => !r.ok)
  log('')
  if (failed.length > 0) {
    say(t('bootstrap.failures', { count: failed.length }))
    for (const f of failed) say(`  ✖ ${f.path} — ${toText(t, f.message)}`)
  }
  say(t('bootstrap.done'))
  say(t('bootstrap.sharedGuide'))
  say(t('bootstrap.sharedSkills'))
  say(t('bootstrap.tools', { list: manifest.tools.join(', ') }))
  say(t('bootstrap.repoOnly'))
  say(t('bootstrap.noOverwrite'))
  say(t('bootstrap.record', { path: RECORD_REL }))
```

`toText`를 import에 더한다.

- [ ] **Step 5: apply.mjs와 adapter.mjs를 고친다**

두 파일의 모든 함수가 이미 `{ dryRun, log }`를 받는다. `t`를 더하고 `log(...)` 인자를 `t(key, params)`로 바꾼다. 결과 객체의 `message`는 `msg(key, params)`로 바꾼다 — 이 값은 `flow.mjs`·`status.mjs`·TUI가 나중에 렌더한다.

본보기 (`apply.mjs`의 `ensureFiles` 부근):

```js
export function ensureFiles(root, files, { dryRun = false, log = () => {}, t = createT('en') } = {}) {
  …
      log(t('log.file.keep', { path: rel }))
  …
      log(t('log.file.create', { path: rel }))
  …
      log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
      return { ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') }
```

`adapter.mjs`도 같은 방식이다.

```js
      log(t('log.skill.linkOk', { tool, path: rel }))
…
      log(t('log.skill.warnForeignLink', { path: rel }))
      return { ok: true, action: 'warn', path: rel, message: msg('msg.foreignLink') }
…
        return { ok: false, action: 'link', path: rel, message: msg('msg.linkFailed', { message: err.message }) }
…
      log(t('log.skill.linkCreate', { tool, path: rel, target: SOURCE_REL }))
```

`log.warn.ignoreShadowed`는 원래 두 줄로 나뉘어 있었다(`const message = …` 후 `log(경고: ${message}. …)`). 한 키로 합치고, 반환하는 `message`는 별도 키 없이 같은 키의 `msg`를 쓴다.

- [ ] **Step 6: 기존 테스트를 로케일 고정으로 옮긴다**

`bootstrap.apply.test.mjs`·`bootstrap.adapter.test.mjs`·`bootstrap.flow.test.mjs`는 함수를 직접 부르므로 `createT('ko')`를 주입한다.

```js
import { createT } from '../lib/i18n/index.mjs'
const t = createT('ko')
// 호출부: ensureFiles(root, files, { log, t })
```

`message` 단언은 구조체가 되었으므로 `toText(t, r.message)`로 풀어 비교하거나 `assert.equal(r.message.key, 'msg.readFailed')`로 바꾼다. **키 단언을 권한다** — 문자열 단언은 카탈로그를 두 번 쓰는 셈이다.

`bootstrap.cli.test.mjs`는 하위 프로세스이므로 `{ env: KO }`를 붙인다.

- [ ] **Step 7: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS (전체)

- [ ] **Step 8: 커밋**

```bash
cd agent-installer
git add lib/bootstrap lib/i18n/catalog test
git commit -F - <<'EOF'
feat(installer): 부트스트랩 로그를 지역화한다

진행 로그와 결과 메시지를 카탈로그로 옮긴다. 결과 객체의 message는
만들어지는 시점에 로케일을 모르므로 키를 담은 구조체로 바꾸고,
표시하는 쪽이 toText로 푼다.

영어 스모크는 두 번 돌린 부트스트랩까지 훑는다. dry-run은 생성
분기만 밟아 멱등 분기의 누락을 놓친다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: 항목 계층 — `unsupported`·`detail`·`note`

**Files:**
- Modify: `agent-installer/lib/catalog.mjs`
- Modify: `agent-installer/lib/engine.mjs`
- Modify: `agent-installer/lib/items/*.mjs` (7개)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/items.test.mjs`, `catalog.test.mjs`, `engine.test.mjs`

**Interfaces:**
- Consumes: `msg`·`toText`·`createT` (Task 1)
- Produces:
  - 항목의 `note`가 **카탈로그 키 문자열**(`'item.mcp.notion.note'`)이 된다
  - `item.unsupported[cli]`가 `msg(key)` 구조체가 된다
  - `detect()`가 돌려주는 `detail`이 `msg(key, params)` 구조체가 된다
  - `apply(root, changes, { dryRun?, log?, t? })`, 결과 `message`는 구조체 또는 문자열

- [ ] **Step 1: 실패 테스트를 쓴다**

`test/items.test.mjs`에 이어 붙인다.

```js
import { createT } from '../lib/i18n/index.mjs'
import EN from '../lib/i18n/catalog/en.mjs'
import { loadItems } from '../lib/catalog.mjs'

test('항목의 note는 카탈로그에 있는 키다', async () => {
  // note를 문자열로 두면 어느 로케일에서도 그 언어로만 나온다.
  const t = createT('en')
  for (const item of await loadItems()) {
    if (!item.note) continue
    assert.ok(Object.hasOwn(EN, item.note), `${item.id}: note 키 '${item.note}'가 카탈로그에 없다`)
    assert.doesNotThrow(() => t(item.note))
  }
})

test('unsupported 사유는 구조화 메시지다', async () => {
  const t = createT('en')
  for (const item of await loadItems()) {
    for (const [cli, why] of Object.entries(item.unsupported ?? {})) {
      assert.equal(typeof why, 'object', `${item.id}/${cli}: 사유가 구조체가 아니다`)
      assert.doesNotThrow(() => t(why.key), `${item.id}/${cli}: 알 수 없는 키 ${why.key}`)
    }
  }
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/items.test.mjs`
Expected: FAIL — `note 키 '인증: 각 CLI 첫 사용 시 OAuth'가 카탈로그에 없다`

- [ ] **Step 3: 카탈로그에 항목 키를 더한다**

`en.mjs` / `ko.mjs` (한국어는 기존 원문 그대로):

```js
  'item.unsupported.claudePlugin': 'Claude Code plugin only',
  'item.unsupported.claudeSkill': 'Claude Code skill install',
  'item.mcp.partial': 'registered: {present} / missing: {missing}',
  'item.plugin.deferred': 'recorded in config — it downloads on the next Claude Code run',
  'item.scanFailed': 'detection failed: {message}',
  'log.mcp.add': '  [dry-run] register {name} in the {cli} config',
  'log.mcp.remove': '  [dry-run] remove {name} from the {cli} config',

  'item.mcp.notion.note': 'auth: OAuth on first use in each CLI',
  'item.mcp.vercel.note': 'auth: OAuth on first use (only approved clients can connect)',
  'item.mcp.supabase.note': 'auth: OAuth dynamic registration. Add ?project_ref=<id> to the URL to pin a project',
  'item.mcp.codebase-memory.note': 'needs the codebase-memory-mcp binary on PATH. Install: https://github.com/DeusData/codebase-memory-mcp (install.sh / install.ps1)',
  'item.plugin.superpowers.note': 'official marketplace plugin',
  'item.plugin.mattpocock-skills.note': '22 engineering and productivity skills (tdd, code-review, research, …)',
  'item.skill.gstack.note': 'repo-local clone + setup (needs bash; Git Bash on Windows). Runtime state (~/.gstack) may be created globally.',
  'item.skill.gsd.note': 'npx @opengsd/gsd-core, installed per project',
  'error.gstackClone': 'gstack clone failed: {output}',
  'error.gstackSetup': 'gstack setup failed: {output}',
  'error.gsdInstall': 'GSD install failed: {output}',
  'error.gsdUninstall': 'GSD uninstall failed: {output}',
  'error.itemFieldMissing': '{file}: {field} missing',
  'error.itemReasonMissing': '{id}: needs a reason for unsupported CLI \'{cli}\' (unsupported.{cli})',
  'error.shellQuote': 'The argument contains a double quote that cannot be passed to the shell: {value}',
```

`ko.mjs`는 각 키에 기존 원문을 넣는다. 예: `'item.mcp.notion.note': '인증: 각 CLI 첫 사용 시 OAuth'`.

- [ ] **Step 4: catalog.mjs를 고친다**

```js
import { LocalizedError, msg } from './i18n/index.mjs'
```

`validate`·`assertReasons`·`shellQuote`의 오류를 `LocalizedError`로 옮긴다.

`defineMcp`:

```js
    async detect({ root }) {
      const present = supports.filter((cli) => CLIS[cli].has(root, name))
      if (present.length === 0) return { status: 'absent' }
      if (present.length === supports.length) return { status: 'installed' }
      return {
        status: 'partial',
        detail: msg('item.mcp.partial', {
          present: present.join(', '),
          missing: supports.filter((c) => !present.includes(c)).join(', '),
        }),
      }
    },
    async install({ root, dryRun, log = () => {}, t }) {
      for (const cli of supports) {
        if (!CLIS[cli].has(root, name)) {
          if (dryRun) log(t('log.mcp.add', { cli: CLIS[cli].label, name }))
          else CLIS[cli].add(root, name, server)
        }
      }
    },
```

`uninstall`도 `log.mcp.remove`로 같게 한다.

`definePlugin`:

```js
  const unsupported = Object.fromEntries(
    CLI_IDS.filter((c) => c !== 'claude').map((c) => [c, msg('item.unsupported.claudePlugin')]),
  )
```
```js
        return { fallback: true, message: msg('item.plugin.deferred') }
```

`defineSkill`의 `unsupported`는 `msg('item.unsupported.claudeSkill')`로 바꾼다.

- [ ] **Step 5: engine.mjs를 고친다**

```js
import { createT, msg } from './i18n/index.mjs'

export async function scan(root, items) {
  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root })
      states.push({ item, status: r.status, detail: r.detail })
    } catch (err) {
      states.push({ item, status: 'absent', detail: msg('item.scanFailed', { message: err.message }) })
    }
  }
  return states
}

export async function apply(root, changes, { dryRun = false, log = console.log, t = createT('en') } = {}) {
  const exec = makeExec(dryRun, log)
  const results = []
  for (const { item, action } of changes) {
    const ctx = { root, dryRun, exec, log, t }
    …
```

`makeExec`의 `[dry-run]` 줄은 명령을 그대로 찍을 뿐이라 번역 대상이 아니다.

- [ ] **Step 6: 항목 7개의 note를 키로 바꾼다**

각 파일의 `note: '…'`를 카탈로그 키 문자열로 바꾼다.

```js
// lib/items/mcp.notion.mjs
  note: 'item.mcp.notion.note',
```

같은 방식으로 `mcp.vercel`, `mcp.supabase`, `mcp.codebase-memory`, `plugin.superpowers`, `plugin.mattpocock-skills`, `skill.gstack`, `skill.gsd`를 바꾼다. `skill.gstack.mjs`·`skill.gsd.mjs`의 `throw new Error('… 실패: …')`도 `LocalizedError`로 옮긴다.

- [ ] **Step 7: 표시하는 쪽이 note를 푼다**

`lib/tui/rows.mjs`의 `agentHint`는 Task 9에서 손댄다. 이 작업에서는 `install.mjs`의 `runClassic`만 확인한다 — `--list`는 `note`를 쓰지 않으므로 변경이 없다.

- [ ] **Step 8: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS

`catalog.test.mjs`·`engine.test.mjs`가 한국어 `detail`·`message`를 단언한다면 키 단언으로 바꾼다.

- [ ] **Step 9: 커밋**

```bash
cd agent-installer
git add lib/catalog.mjs lib/engine.mjs lib/items lib/i18n/catalog test
git commit -F - <<'EOF'
feat(installer): 항목 계층의 문구를 키로 옮긴다

note·unsupported 사유·detect의 detail은 만들어지는 시점에 로케일을
모른다. 문자열 대신 키를 담아 두고 표시하는 쪽이 푼다.

unsupported는 모듈 로드 시점에 계산되므로 특히 그렇다 — 지금 구조가
아니면 어떤 로케일에서도 한 언어로만 나온다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: status와 update 지역화

**Files:**
- Modify: `agent-installer/lib/status.mjs`
- Modify: `agent-installer/lib/update.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/status.test.mjs`, `update.test.mjs`, `bootstrap.update.test.mjs`, `test/i18n.en.test.mjs`

**Interfaces:**
- Consumes: `createT`·`toText`·`LocalizedError` (Task 1)
- Produces:
  - `formatStatus(report, t) → string`
  - `runStatus(root, { json?, log?, t? })`
  - `runUpdate(root, { dryRun?, force?, log?, t? })`
- `collectStatus`는 **바꾸지 않는다.** 이미 순수 데이터를 돌려주므로 `--json` 경로가 저절로 언어 중립이다.

- [ ] **Step 1: 영어 스모크와 JSON 중립 테스트를 쓴다**

`test/i18n.en.test.mjs`에 이어 붙인다.

```js
test('영어 status와 --list 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  for (const args of [['status'], ['--list'], ['design', '--list']]) {
    const r = runInstaller(root, args, { env: EN })
    assert.equal(r.status, 0, r.stderr)
    assertNoHangul(r.stdout, args.join(' '))
  }
})

test('영어 update dry-run 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const r = runInstaller(root, ['update', '--dry-run'], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  assertNoHangul(r.stdout, 'update --dry-run')
})
```

`test/status.test.mjs`에 더한다.

```js
test('--json 출력은 로케일과 무관하게 같다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: KO })
  const en = runInstaller(root, ['status', '--json'], { env: { AGENT_SETUP_LANG: 'en' } })
  const ko = runInstaller(root, ['status', '--json'], { env: KO })
  // 기계가 읽는 출력에 언어가 새면 CI 판정이 사람 설정에 흔들린다.
  assert.deepEqual(JSON.parse(en.stdout), JSON.parse(ko.stdout))
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/i18n.en.test.mjs test/status.test.mjs`
Expected: FAIL — status 출력에 한글이 남아 있음

- [ ] **Step 3: 카탈로그에 status·update 키를 더한다**

| 키 | 영어 | 한국어(기존 원문) |
|---|---|---|
| `status.noRecord` | `No install record.` | `설치 기록이 없습니다.` |
| `status.noRecord.hint1` | `  To bring this repository under the record, run bootstrap --adopt.` | `  이 저장소를 기록 체계로 끌어오려면 bootstrap --adopt 를 실행하세요.` |
| `status.noRecord.hint2` | `  It creates nothing and records only files that match the templates.` | `  파일을 만들지 않고, 템플릿과 같은 파일만 관리 대상으로 기록합니다.` |
| `status.row.tool` | `tool        {version}` | `도구        {version}` |
| `status.version.pinned` | `{pinned} pinned · running {running}` | `{pinned} 고정 · 실행 중 {running}` |
| `status.version.latest` | `{pinned} pinned · running {running} · latest {latest}` | `{pinned} 고정 · 실행 중 {running} · 최신 {latest}` |
| `status.hint.update` | `            → update can move the pinned version` | `            → update로 고정 버전을 옮길 수 있습니다` |
| `status.row.files` | `managed     {current} of {total} current · {pending} pending · {drift} edited by you` | `관리 파일   {total}개 중 {current} 최신 · {pending} 갱신 대기 · {drift} 사용자 수정` |
| `status.hint.pending` | `            → update` | `            → update` |
| `status.hint.drift` | `            → update leaves files you edited alone` | `            → 사용자 수정 파일은 update가 건드리지 않습니다` |
| `status.row.items` | `items       installed  {list}` | `항목        설치됨     {list}` |
| `status.row.recordOnly` | `            record only {list}` | `            기록에만   {list}` |
| `status.row.repoOnly` | `            repo only   {list}` | `            저장소에만 {list}` |
| `status.none` | `(none)` | `(없음)` |
| `update.versionMove` | `pinned {pinned} → running {running}` | `고정 {pinned} → 실행 중 {running}` |
| `update.summary` | `{updated} updated · {created} created · {drift} drifted` | `갱신 {updated}건 · 신규 {created}건 · 드리프트 {drift}건` |
| `update.driftHeader` | `drift (left alone)` | `드리프트 (건드리지 않았습니다)` |
| `update.driftHint` | `run update --force to take the latest templates (the working tree must be clean)` | `최신 템플릿을 반영하려면 update --force (워킹트리가 깨끗해야 합니다)` |
| `error.forceNeedsCleanTree` | `--force needs a clean working tree. git is the only way back, so overwriting uncommitted changes cannot be undone.` | `--force는 워킹트리가 깨끗할 때만 쓸 수 있습니다. git이 유일한 되돌리기 수단이라 커밋되지 않은 변경 위에 덮어쓰면 복구할 수 없습니다.` |
| `error.noRecordForUpdate` | `{path} does not exist. To bring this repository under the record, run bootstrap --adopt first — it creates nothing and only writes the record.` | `{path}이 없습니다. 이 저장소를 기록 체계로 끌어오려면 먼저 bootstrap --adopt를 실행하세요 — 파일을 만들지 않고 기록만 만듭니다.` |

**주의:** `status.row.*`는 정렬용 공백이 들어 있다. 영어 라벨(`tool`/`managed`/`items`)이 한국어(`도구`/`관리 파일`/`항목`)보다 길어 열이 어긋난다. 영어 값의 공백 개수를 직접 세어 `{version}`·`{list}`가 같은 열에서 시작하게 맞춘다. `status.test.mjs`에 열 정렬 단언을 더한다.

```js
test('status 표의 값이 두 로케일 모두에서 같은 열에서 시작한다', () => {
  for (const locale of ['en', 'ko']) {
    const t = createT(locale)
    const cols = [
      t('status.row.tool', { version: '|' }),
      t('status.row.files', { total: '', current: '', pending: '', drift: '' }),
      t('status.row.items', { list: '|' }),
    ].map((line) => width(line.slice(0, line.indexOf('|') === -1 ? undefined : line.indexOf('|'))))
    // tool과 items는 값 앞 여백이 같아야 한다. files는 자리 구조가 달라 제외한다.
    assert.equal(cols[0], cols[2], `${locale}: tool과 items의 값 시작 열이 다르다`)
  }
})
```

- [ ] **Step 4: status.mjs를 고친다**

```js
import { createT, toText } from './i18n/index.mjs'

export function formatStatus(report, t = createT('en')) {
  const lines = []
  const { tool, files, items } = report

  if (!report.hasRecord) {
    lines.push(t('status.noRecord'))
    lines.push(t('status.noRecord.hint1'))
    lines.push(t('status.noRecord.hint2'))
    return lines.join('\n')
  }

  const version = tool.latest && tool.latest !== tool.running
    ? t('status.version.latest', { pinned: tool.pinned, running: tool.running, latest: tool.latest })
    : t('status.version.pinned', { pinned: tool.pinned, running: tool.running })
  lines.push(t('status.row.tool', { version }))
  if (tool.pinned !== tool.running) lines.push(t('status.hint.update'))

  lines.push(t('status.row.files', files))
  if (files.pending > 0) lines.push(t('status.hint.pending'))
  if (files.drift > 0) lines.push(t('status.hint.drift'))

  lines.push(t('status.row.items', { list: items.installed.join(', ') || t('status.none') }))
  if (items.recordOnly.length) lines.push(t('status.row.recordOnly', { list: items.recordOnly.join(', ') }))
  if (items.repoOnly.length) lines.push(t('status.row.repoOnly', { list: items.repoOnly.join(', ') }))

  return lines.join('\n')
}

export async function runStatus(root, { json = false, log = console.log, t = createT('en') } = {}) {
  const { loadItems } = await import('./catalog.mjs')
  const report = await collectStatus(root, { items: await loadItems() })
  log(json ? JSON.stringify(report, null, 2) : formatStatus(report, t))
  return report
}
```

`collectStatus`는 **시그니처를 바꾸지 않는다.** `updateFiles`/`updateBlocks`를 `log: silent`로 부르므로 로그가 버려지고, `t`의 기본값(`createT('en')`)이 쓰여도 출력에 닿지 않는다. 여기에 `t`를 꿰면 쓰지 않는 인자만 늘어난다.

- [ ] **Step 5: update.mjs를 고친다**

`runUpdate(root, opts)`가 `t = createT('en')`을 받게 하고, 두 `throw new Error`를 `LocalizedError`로, `say(...)` 문구를 `t(...)`로 바꾼다. 드리프트 목록의 항목 줄은 경로만 찍으므로 그대로 둔다.

- [ ] **Step 6: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS

`status.test.mjs`·`update.test.mjs`가 함수를 직접 부르면 `createT('ko')`를 넘기고 기존 단언을 살린다.

- [ ] **Step 7: 커밋**

```bash
cd agent-installer
git add lib/status.mjs lib/update.mjs lib/i18n/catalog test
git commit -F - <<'EOF'
feat(installer): status와 update 출력을 지역화한다

collectStatus는 손대지 않는다. 이미 순수 데이터를 돌려주므로
--json 경로가 저절로 언어 중립이고, 그 분리가 이번에 값을 한다.

표의 값 시작 열은 라벨 길이에 따라 어긋난다. 영어 라벨이 더 길어
공백 개수를 다시 맞추고 테스트로 못박는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: design-md 경로 지역화

**Files:**
- Modify: `agent-installer/lib/design-md/flow.mjs`, `catalog.mjs`, `scan.mjs`, `open.mjs`
- Modify: `agent-installer/lib/design-md/providers/awesome-design-md.mjs`
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/design-md.*.test.mjs`

**Interfaces:**
- Consumes: `createT`·`msg`·`toText`·`LocalizedError` (Task 1)
- Produces:
  - `runDesign(root, { …, t? })`, `refreshCatalog({ …, t? })`, `updateInstalled(root, items, { …, t? })`, `findStale(root, items, { log?, t? })`
  - `discoverSources({ …, t? })`
  - `openPreview(opener, item, log, t?)`
  - **카테고리 id 상수 통일:** `scan.mjs`의 `BUNDLE_CATEGORY`와 `providers/awesome-design-md.mjs`의 `UNCATEGORIZED`가 모두 `'__other'`, `LOCAL_CATEGORY`가 `'__local'`이 된다

- [ ] **Step 1: 카테고리 id 테스트를 쓴다**

`test/design-md.scan.test.mjs`에 더한다.

```js
import { BUNDLE_CATEGORY, LOCAL_CATEGORY } from '../lib/design-md/scan.mjs'
import { UNCATEGORIZED } from '../lib/design-md/providers/awesome-design-md.mjs'

test('분류 못 한 항목의 카테고리는 표시 문자열이 아니라 id다', () => {
  // 카테고리는 정렬 키이자 그룹 헤더다. 표시 문자열을 그대로 쓰면
  // 번역하는 순간 정렬과 그룹 묶기가 어긋난다.
  assert.equal(BUNDLE_CATEGORY, '__other')
  assert.equal(UNCATEGORIZED, '__other')
  assert.equal(LOCAL_CATEGORY, '__local')
})
```

기존 테스트에서 `'기타'`·`'사내'`를 단언하던 곳을 이 id로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/design-md.scan.test.mjs`
Expected: FAIL — `'기타' !== '__other'`

- [ ] **Step 3: 카탈로그에 design-md 키를 더한다**

| 키 | 영어 | 한국어(기존 원문) |
|---|---|---|
| `category.other` | `Other` | `기타` |
| `category.local` | `In-house` | `사내` |
| `design.localSuffix` | `{id} (local)` | `{id} (로컬)` |
| `design.localTag` | `local` | `로컬` |
| `design.unknownItem` | `  unknown item: {token}` | `  알 수 없는 항목: {token}` |
| `design.ambiguous` | `  ambiguous name '{token}' — pick a provider: {options}` | `  중복된 이름 '{token}' — 제공자를 지정하세요: {options}` |
| `design.provider.count` | `  {label}: {count}` | `  {label}: {count}개` |
| `design.provider.failed` | `  {label}: failed — {message}` | `  {label}: 실패 — {message}` |
| `design.catalog.empty` | `Nothing fetched; leaving the catalog alone.` | `가져온 항목이 없어 카탈로그를 갱신하지 않습니다.` |
| `design.catalog.planned` | `  [dry-run] would refresh to {total} entries` | `  [dry-run] {total}개로 갱신 예정` |
| `design.catalog.updated` | `catalog refreshed: {total} entries` | `카탈로그 갱신됨: {total}개` |
| `design.none` | `No design.md is installed.` | `설치된 design.md가 없습니다.` |
| `design.updated` | `  ✔ updated {label}` | `  ✔ 업데이트 {label}` |
| `design.updateFailed` | `  ✖ update {label} — {message}` | `  ✖ 업데이트 {label} — {message}` |
| `design.sourceCheckFailed` | `  ? {label}: cannot reach the source` | `  ? {label}: 원본 확인 실패` |
| `design.allCurrent` | `All installed copies are current.` | `모든 설치본이 최신입니다.` |
| `design.staleList` | `{count} stale: {names}` | `오래된 항목 {count}개: {names}` |
| `design.staleConfirm` | `Update {count} now?` | `{count}개를 지금 업데이트할까요?` |
| `design.unknownSync` | `Unknown sync action: {action}` | `알 수 없는 동기화 작업: {action}` |
| `design.write` | `  [dry-run] write design-md/{provider}/{name}/DESIGN.md` | `  [dry-run] design-md/{provider}/{name}/DESIGN.md 작성` |
| `design.remove` | `  [dry-run] remove design-md/{provider}/{name}` | `  [dry-run] design-md/{provider}/{name} 제거` |
| `design.nameClash` | `  design.md names collide; using '{picked}': {path}` | `  design.md 이름이 겹쳐 '{picked}'로 구분합니다: {path}` |
| `design.sourceIdClash` | `  design.md source ids collide; using '{picked}': {path}` | `  design.md 소스 id가 겹쳐 '{picked}'로 사용합니다: {path}` |
| `design.noDesignFile` | `  no DESIGN.md in this design.md source: {path}` | `  design.md 소스에 DESIGN.md가 없습니다: {path}` |
| `design.pathMissing` | `  cannot find the design.md path: {path}` | `  design.md 경로를 찾을 수 없습니다: {path}` |
| `design.noPreviewUrl` | `  {label}: no preview URL.` | `  {label}: 미리보기 URL이 없습니다.` |
| `design.openFailed` | `  {label}: could not open — open it yourself: {target}` | `  {label}: 열기 실패 — 직접 여세요: {target}` |
| `design.notOpenable` | `not an openable target` | `열 수 있는 대상이 아닙니다` |
| `error.catalogUnreadable` | `Cannot read the design.md catalog: {path}\n{message}\nRebuild it with `design --sync=catalog`.` | `design.md 카탈로그를 읽을 수 없습니다: {path}\n{message}\n\`design --sync=catalog\`로 다시 만들 수 있습니다.` |
| `error.responseTooLarge` | `The response exceeded the {limit} byte cap: {url}` | `응답이 상한({limit} 바이트)을 넘었습니다: {url}` |
| `error.badDesignId` | `Invalid design.md identifier: {provider}/{name}` | `잘못된 design.md 식별자: {provider}/{name}` |
| `error.designDownload` | `{provider}/{name}: DESIGN.md download failed` | `{provider}/{name}: DESIGN.md 다운로드 실패` |
| `error.readmeFetch` | `README fetch failed: HTTP {status}` | `README 가져오기 실패: HTTP {status}` |

- [ ] **Step 4: 카테고리 상수를 id로 바꾼다**

`lib/design-md/scan.mjs`:

```js
// 카테고리는 정렬 키이자 그룹 헤더다. 표시 문자열을 그대로 쓰면 번역하는
// 순간 정렬과 그룹 묶기가 어긋나므로 id를 두고 표시할 때만 번역한다.
// tui/rows.mjs의 CATCH_ALL_CATEGORY와 같은 값이어야 한다.
export const BUNDLE_CATEGORY = '__other'
export const LOCAL_CATEGORY = '__local'
```

`lib/design-md/providers/awesome-design-md.mjs`의 `const UNCATEGORIZED = '기타'`를 `export const UNCATEGORIZED = '__other'`로 바꾼다. 세 곳이 같은 값을 공유해야 하므로 export 해 테스트가 확인하게 한다.

`scan.mjs`의 `label = bundled ? uid : `${uid} (로컬)``는 표시 문자열이다. `t`를 받아 `t('design.localSuffix', { id: uid })`로 바꾼다. `discoverSources`가 이미 `log`를 받으므로 `t`도 같은 주머니에 얹는다.

- [ ] **Step 5: 나머지 네 파일의 문구를 옮긴다**

`flow.mjs`의 `STATUS_LABEL`·`ACTION` 지역 상수를 지우고 `t('status.*')`·`t('change.*')`를 쓴다 — Task 3에서 이미 만든 키다. `design --list`의 상태 라벨이 TUI·`--list`와 한 벌이 된다.

`flow.mjs:25`의 `[${pid}${group[0].item.local ? ' · 로컬' : ''}]`는 `t('design.localTag')`를 쓴다.

`catalog.mjs`·`open.mjs`의 `throw new Error`를 `LocalizedError`로 옮기고 `log(...)`를 `t(...)`로 바꾼다. `open.mjs`의 `{ ok: false, output: '열 수 있는 대상이 아닙니다' }`는 `msg('design.notOpenable')`로 바꾸고, 표시하는 쪽이 `toText`로 푼다.

- [ ] **Step 6: 표시 지점에서 카테고리를 번역한다**

`design --list`(`flow.mjs`)가 카테고리를 찍는다면 `cat.startsWith('__') ? t(`category.${cat.slice(2)}`) : cat`로 감싼다. 헬퍼를 `flow.mjs`에 둔다.

```js
// 카탈로그의 카테고리는 공급자가 준 영어 데이터라 번역하지 않는다.
// 우리가 만든 catch-all(__other·__local)만 번역 대상이다.
export function categoryLabel(t, id) {
  return id.startsWith('__') ? t(`category.${id.slice(2)}`) : id
}
```

- [ ] **Step 7: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS

`design-md.*.test.mjs`가 함수를 직접 부르므로 `createT('ko')`를 넘겨 기존 한국어 단언을 살린다.

- [ ] **Step 8: 커밋**

```bash
cd agent-installer
git add lib/design-md lib/i18n/catalog test
git commit -F - <<'EOF'
feat(installer): design.md 경로를 지역화한다

catch-all 카테고리를 표시 문자열에서 id로 바꾼다. 카테고리는 정렬
키이자 그룹 헤더라, 번역하는 순간 정렬과 그룹 묶기가 어긋난다.

같은 값이 scan.mjs와 공급자 모듈에 따로 있었다. 둘 다 __other로
모으고 테스트가 어긋남을 잡는다.

공급자가 준 카테고리는 이미 영어라 번역하지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: TUI 섹션·그룹의 id화

이 작업은 **로케일과 무관한 구조 변경**이다. 탭 이름이 곧 정렬 키이자 `state.tabs`의 원소라, 번역하기 전에 먼저 갈라 놓아야 한다.

**Files:**
- Modify: `agent-installer/lib/tui/rows.mjs`
- Test: `agent-installer/test/tui.rows.test.mjs`, `tui.state.test.mjs`, `tui.run.test.mjs`

**Interfaces:**
- Consumes: `CATCH_ALL_CATEGORY`가 `design-md/scan.mjs`의 `BUNDLE_CATEGORY`(`'__other'`)와 같은 값이어야 한다 (Task 8)
- Produces:
  - `SECTION_ORDER = ['action', 'plugin', 'mcp', 'skill', 'design']`
  - `ACTION_SECTION = 'action'`, `CATCH_ALL_CATEGORY = '__other'`
  - 행의 `section`이 소문자 id가 된다. `state.mjs`는 바뀌지 않는다

- [ ] **Step 1: 실패 테스트를 쓴다**

`test/tui.rows.test.mjs`에 더한다.

```js
import { BUNDLE_CATEGORY } from '../lib/design-md/scan.mjs'

test('섹션은 표시 문자열이 아니라 id다', () => {
  assert.deepEqual(SECTION_ORDER, ['action', 'plugin', 'mcp', 'skill', 'design'])
  assert.equal(ACTION_SECTION, 'action')
})

test('catch-all 카테고리는 scan.mjs와 같은 값이다', () => {
  // 두 값이 갈리면 '기타' 그룹이 두 개로 쪼개져 나온다.
  assert.equal(CATCH_ALL_CATEGORY, BUNDLE_CATEGORY)
})

test('행의 section은 item.category를 그대로 쓴다', () => {
  const rows = buildRows({
    agentStates: [
      { item: { id: 'mcp.x', category: 'mcp', label: 'X' }, status: 'absent' },
      { item: { id: 'plugin.y', category: 'plugin', label: 'Y' }, status: 'absent' },
    ],
  })
  assert.deepEqual(rows.map((r) => r.section), ['plugin', 'mcp'])
})
```

`tui.state.test.mjs`에서 `'작업'`·`'PLUGIN'`을 단언하던 곳을 `'action'`·`'plugin'`으로 바꾼다.

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs`
Expected: FAIL — `SECTION_ORDER`가 여전히 한국어·대문자

- [ ] **Step 3: rows.mjs의 상수를 바꾼다**

```js
// 섹션은 탭 이름이자 정렬 키이자 state.tabs의 원소다. 표시 문자열을 그대로
// 쓰면 번역하는 순간 정렬이 깨진다 — id를 두고 render.mjs가 표시할 때만
// t로 바꾼다. 덕분에 state.mjs는 계속 아무것도 import 하지 않는다.
export const ACTION_SECTION = 'action'
// design-md/scan.mjs의 BUNDLE_CATEGORY와 같은 값이다 — 카테고리를 못 얻은
// 항목이 모이는 자리. 두 값이 갈리면 같은 그룹이 두 개로 쪼개진다.
export const CATCH_ALL_CATEGORY = '__other'
export const SECTION_ORDER = [ACTION_SECTION, 'plugin', 'mcp', 'skill', 'design']
```

`AGENT_SECTION` 매핑을 지운다. `item.category`가 이미 `'plugin'`·`'mcp'`·`'skill'`이므로 그대로 쓴다.

```js
  const agents = agentStates.map((s) =>
    itemRow({
      id: s.item.id,
      section: s.item.category,
      …
```

design 행의 `section: 'DESIGN.MD'`를 `section: 'design'`으로 바꾼다.

- [ ] **Step 4: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS

`tui.run.test.mjs`·`install.cli.test.mjs`가 `/\[작업\]/`를 단언한다. `printPlain`이 아직 섹션 id를 그대로 찍으므로 `/\[action\]/`으로 바꾼다 — Task 10에서 `t`로 다시 바뀐다.

- [ ] **Step 5: 커밋**

```bash
cd agent-installer
git add lib/tui/rows.mjs test
git commit -F - <<'EOF'
refactor(installer): 섹션과 그룹을 표시 문자열에서 id로 가른다

탭 이름이 곧 정렬 키이자 state.tabs의 원소였다. 번역하면 정렬이
깨지므로 id를 두고 표시할 때만 바꾼다.

덕분에 state.mjs는 계속 아무것도 import 하지 않는다 — 상태 계층에
사용자 문자열이 하나도 남지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 10: TUI 문구 지역화

**Files:**
- Modify: `agent-installer/lib/tui/render.mjs`
- Modify: `agent-installer/lib/tui/rows.mjs`
- Modify: `agent-installer/lib/tui/run.mjs` (`printPlain`·상태줄·적용 로그)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/tui.rows.test.mjs`, `tui.run.test.mjs`, `test/i18n.en.test.mjs`

**Interfaces:**
- Consumes: `createT`·`toText` (Task 1), 섹션 id (Task 9), 항목 구조화 메시지 (Task 6)
- Produces:
  - `render(state, { …, t? })`, `renderReview(changes, { …, t? })`, `tabBar(state, { …, t? })`
  - `agentHint(item, state, t)`, `designHint(state, t, multiProvider?)`
  - `buildActions(root, { designItems?, t? })`, `buildRows({ …, t? })`, `collectRows(root, { …, t? })`
  - `printPlain(rows, log, t)`

- [ ] **Step 1: 영어 스모크에 비대화형 목록을 더한다**

`test/i18n.en.test.mjs`에 더한다.

```js
test('영어 비대화형 목록 출력에 한글이 없다', () => {
  // TTY가 아니면 TUI는 목록만 찍고 끝난다 — CI가 늘 밟는 경로다.
  const root = makeTempRepo()
  const r = runInstaller(root, [], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  assertNoHangul(r.stdout, '비대화형 목록')
})
```

`test/tui.rows.test.mjs`에 더한다.

```js
test('힌트는 활성 로케일로 나온다', () => {
  const state = {
    item: { id: 'mcp.x', category: 'mcp', label: 'X', note: 'item.mcp.notion.note', supports: ['claude', 'codex'], unsupported: {} },
    status: 'partial',
    detail: msg('item.mcp.partial', { present: 'claude', missing: 'codex' }),
  }
  assert.match(agentHint(state.item, state, createT('en')), /Partial · registered: claude/)
  assert.match(agentHint(state.item, state, createT('ko')), /일부 설치됨 · 등록됨: claude/)
})

test('검색어는 섹션 id와 두 로케일 라벨에 모두 걸린다', () => {
  const rows = buildRows({
    agentStates: [{ item: { id: 'mcp.x', category: 'mcp', label: 'X' }, status: 'absent' }],
    t: createT('ko'),
  })
  // 한국어 화면에서도 영어 탭 이름으로 찾을 수 있어야 한다.
  assert.match(rows[0].searchText, /mcp/)
})
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs test/i18n.en.test.mjs`
Expected: FAIL — `agentHint`가 `t`를 받지 않음

- [ ] **Step 3: 카탈로그에 TUI 키를 더한다**

| 키 | 영어 | 한국어 |
|---|---|---|
| `section.action` | `ACTION` | `작업` |
| `section.plugin` | `PLUGIN` | `PLUGIN` |
| `section.mcp` | `MCP` | `MCP` |
| `section.skill` | `SKILL` | `SKILL` |
| `section.design` | `DESIGN.MD` | `DESIGN.MD` |
| `tui.counts` | `selected {picked} / {total}` | `선택 {picked} / 전체 {total}` |
| `tui.search.prefix` | `Search › ` | `검색 › ` |
| `tui.search.placeholder` | `type to search · ↓ for the list` | `타이핑하면 검색 · ↓ 로 목록` |
| `tui.empty.filtered` | `  Nothing matches in this tab. Press Tab to try another.` | `  이 탭에는 일치하는 항목이 없습니다. Tab으로 다른 탭을 보세요.` |
| `tui.empty.none` | `  Nothing here.` | `  항목이 없습니다.` |
| `tui.hint.search` | `type=query (space included)   ↓ to list   Tab switch tab   Esc clear` | `입력=검색어(스페이스 포함)   ↓ 목록으로   Tab 탭이동   Esc 검색해제` |
| `tui.hint.list` | `Space select   ↑↓ move (↑ at top = search)   Tab tab   Enter run/submit   Ctrl+A all   Ctrl+O preview` | `Space 선택   ↑↓ 이동(맨 위 ↑=검색칸)   Tab 탭   Enter 실행/제출   Ctrl+A 전체   Ctrl+O 미리보기` |
| `tui.review.title` | `Review — {count} change(s)` | `제출 검토 — 변경 {count}건` |
| `tui.review.more` | `  …and {count} more` | `  …외 {count}건` |
| `tui.review.hint` | `Enter apply   Esc cancel` | `Enter 적용   Esc 취소` |
| `tui.notItemRow` | `Press Enter to run this row.` | `이 행은 Enter로 실행합니다.` |
| `tui.noPreview` | `This item has no preview.` | `이 항목은 미리보기를 제공하지 않습니다.` |
| `tui.opened` | `Opened: {target}` | `열었습니다: {target}` |
| `tui.noChanges` | `Nothing to change.` | `변경할 항목이 없습니다.` |
| `tui.submitCancelled` | `Submission cancelled.` | `제출을 취소했습니다.` |
| `tui.toggledAll` | `Selected every visible item in the {tab} tab.` | `{tab} 탭의 보이는 항목을 모두 선택했습니다.` |
| `tui.toggledNone` | `Cleared every visible item in the {tab} tab.` | `{tab} 탭의 보이는 항목을 모두 해제했습니다.` |
| `tui.nonInteractive` | `The interactive screen only opens in a terminal. --list and --set work too.` | `대화형 화면은 터미널에서만 열립니다. --list · --set 으로도 다룰 수 있습니다.` |
| `tui.applyHeader` | `{count} change(s) to apply{suffix}:` | `적용할 변경 {count}건{suffix}:` |
| `tui.pressAnyKey` | `Press any key to continue…` | `계속하려면 아무 키나 누르세요…` |
| `tui.confirmSuffix` | ` [y/N] ` | ` [y/N] ` |
| `item.location.user` | `installs to: user global` | `설치 위치: 사용자 글로벌` |
| `item.unsupportedList` | `unsupported: {list}` | `미지원: {list}` |
| `item.claudeOnly` | `Claude Code only` | `Claude Code 전용` |
| `action.bootstrap.label` | `Run bootstrap` | `부트스트랩 실행` |
| `action.bootstrap.hint` | `guides · skills · per-tool config · {present} of {total} files exist` | `지침 · 스킬 · 도구별 설정 · 파일 {total}개 중 {present}개 존재` |
| `action.sync.installed.label` | `Update installed` | `설치본 업데이트` |
| `action.sync.installed.hint` | `refetch installed design.md from their sources` | `design.md 설치본을 원본 최신으로 다시 받는다` |
| `action.sync.catalog.label` | `Refresh catalog` | `카탈로그 새로고침` |
| `action.sync.catalog.hint` | `rebuild the design.md list and categories from sources` | `design.md 목록·카테고리를 소스에서 다시 만든다` |
| `action.sync.stale.label` | `Check stale` | `오래된 항목 확인` |
| `action.sync.stale.hint` | `compare installed copies against their sources by hash` | `설치본을 원본과 해시 비교한다` |

`action.*.label` 넷과 `section.*` 다섯은 Task 1의 폭 테스트가 `LABEL_WIDTH`(24) 이하를 강제한다. 위 값은 모두 통과한다(`Update installed` 16, `부트스트랩 실행` 14).

- [ ] **Step 4: render.mjs를 고친다**

`render`·`renderReview`·`tabBar`가 `opts.t`를 받게 하고 기본값을 `createT('en')`으로 둔다. `tabBar`는 섹션 id를 라벨로 바꾼다.

```js
  const segs = counts.map(({ tab, shown, total }) => {
    const name = t(`section.${tab}`)
    return {
      tab,
      text: searching ? `${name} ${shown}/${total}` : `${name} ${total}`,
      active: tab === active,
      empty: searching && shown === 0,
    }
  })
```

`CHANGE_LABEL` 지역 상수를 지우고 `t(`change.${c.action}`)`을 쓴다. `CHANGE_MARK`는 기호라 그대로 둔다.

`searchLine`의 `const prefix = '검색 › '`를 `t('tui.search.prefix')`로, 안내 문구를 `t('tui.search.placeholder')`로 바꾼다.

- [ ] **Step 5: rows.mjs를 고친다**

```js
import { createT, toText } from '../i18n/index.mjs'

export function agentHint(item, state, t = createT('en')) {
  const parts = []
  if (state.status !== 'absent') parts.push(t(`status.${state.status}`))
  const detail = toText(t, state.detail)
  if (detail) parts.push(detail)
  if (item.scope === 'user') parts.push(t('item.location.user'))
  const un = Object.entries(item.unsupported ?? {})
  if (item.category === 'mcp' && un.length > 0) {
    parts.push(t('item.unsupportedList', {
      list: un.map(([cli, why]) => `${cli}(${toText(t, why)})`).join(', '),
    }))
  }
  if (item.supports?.length === 1 && item.supports[0] === 'claude') parts.push(t('item.claudeOnly'))
  // note는 이제 카탈로그 키다.
  if (item.note) parts.push(t(item.note))
  return parts.join(' · ')
}
```

`designHint`는 **인자 순서가 바뀐다**: `designHint(state, multiProvider)` → `designHint(state, t, multiProvider = false)`. `DESIGN_STATUS` 지역 상수를 지우고 `t(`status.${state.status}`)`를 쓰며, `designCategory`는 `categoryLabel(t, …)`(Task 8)로 감싼다. `test/tui.rows.test.mjs`에 `designHint`를 두 인자로 부르는 곳이 있으면 함께 고친다 — `grep -n "designHint" test/tui.rows.test.mjs`로 찾는다.

`buildActions(root, { designItems = [], t = createT('en') })`가 네 액션의 라벨·힌트를 `t`로 만든다.

```js
function bootstrapHint(root, t) {
  const present = MANIFEST.files.filter((f) => existsSync(join(root, f.path))).length
  return t('action.bootstrap.hint', { present, total: MANIFEST.files.length })
}
```

`itemRow`의 `searchText`에 섹션 id와 두 로케일 라벨을 넣는다.

```js
const EN_T = createT('en')

function sectionTerms(t, section) {
  const here = t(`section.${section}`)
  const base = EN_T(`section.${section}`)
  return here === base ? `${section} ${base}` : `${section} ${base} ${here}`
}
```

`itemRow`/`actionRow`가 `t`와 `section`을 받아 `searchText: `${label} ${hint} ${sectionTerms(t, section)} ${extra}`.toLowerCase()`로 만든다.

`buildRows`와 `collectRows`도 `t`를 받아 아래로 넘긴다. `collectRows`는 `discoverSources`에도 `t`를 넘긴다 (Task 8).

- [ ] **Step 6: run.mjs의 비대화형·상태줄 문구를 옮긴다**

`printPlain(rows, log, t)`가 섹션 헤더를 `t`로 찍는다.

```js
function printPlain(rows, log, t) {
  let section = null
  for (const row of rows) {
    if (row.section !== section) { section = row.section; log(`[${t(`section.${section}`)}]`) }
    const mark = row.kind === 'action' ? '▶' : row.status === 'absent' ? ' ' : '×'
    log(`  [${mark}] ${row.label}${row.hint ? ` — ${row.hint}` : ''}`)
  }
}
```

`ACTION_LABEL` 지역 상수를 지우고 `t(`change.${…}`)`을 쓴다. `runTui`의 나머지 리터럴(`'변경할 항목이 없습니다.'`, `'제출을 취소했습니다.'`, `'계속하려면 아무 키나 누르세요…'`, `'\n적용할 변경 …'`, `'\n설정 파일 변경 내용은 git diff로…'`)을 위 표의 키로 바꾼다.

`Ctrl+A` 상태줄은 켬/끔이 갈리므로 두 키를 쓴다.

```js
        state = toggleVisible(state)
        const key = state.selected.size >= before ? 'tui.toggledAll' : 'tui.toggledNone'
        status = t(key, { tab: t(`section.${activeTab(state)}`) })
```

`runTui`가 `opts.t`를 받고 `collectRows`·`render`·`renderReview`·`printPlain`에 넘긴다. **`t`는 `let`으로 선언한다** — Task 11의 언어 전환이 갈아끼운다.

- [ ] **Step 7: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS

`tui.rows.test.mjs`는 `createT('ko')`를 넘겨 기존 단언을 살린다. `install.cli.test.mjs`의 `/\[action\]/`은 `{ env: KO }`와 함께 `/\[작업\]/`으로 되돌린다.

**`tui.run.test.mjs`의 `drive` 헬퍼를 먼저 고쳐야 한다.** 이 헬퍼는 `frames.filter((f) => f.includes('검색 ›'))`로 목록 화면을 골라내 포커스 검증에 쓴다. `render.mjs`의 검색줄 접두사가 `t('tui.search.prefix')`로 바뀌는 순간, `t`를 안 넘기면 기본값 영어가 쓰여 `lastListFrame`이 빈 문자열이 되고 기존 포커스 테스트가 통째로 조용히 무의미해진다. `drive`의 기본 opts에 로케일을 못박는다.

```js
  const done = runTui(opts.root ?? makeTempRepo(), {
    dryRun: true, log: cap.log, env: { NO_COLOR: '1' }, stdin, stdout, t: createT('ko'), ...opts,
  })
```

`import { createT } from '../lib/i18n/index.mjs'`를 파일 상단에 더한다.

- [ ] **Step 8: 커밋**

```bash
cd agent-installer
git add lib/tui lib/i18n/catalog test
git commit -F - <<'EOF'
feat(installer): TUI 문구를 지역화한다

탭 이름은 섹션 id를 t로 바꿔 표시한다. 검색어에는 id와 두 로케일
라벨을 모두 넣어, 한국어 화면에서도 plugin으로 찾을 수 있게 한다.

항목 힌트는 note·unsupported·detail을 toText로 푼다. 이들은
만들어지는 시점에 로케일을 모르는 값이다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 11: TUI 언어 행과 지속

**Files:**
- Modify: `agent-installer/lib/tui/rows.mjs` (언어 행)
- Modify: `agent-installer/lib/tui/run.mjs` (전환·저장·선택 보존)
- Modify: `agent-installer/lib/i18n/catalog/en.mjs`, `ko.mjs`
- Test: `agent-installer/test/tui.run.test.mjs`, `tui.rows.test.mjs`

**Interfaces:**
- Consumes: `LOCALES`·`createT` (Task 1), `writeLang`·`RECORD_REL` (Task 4), `buildActions` (Task 10)
- Produces:
  - 작업 탭 첫 행이 `id: 'action.language'`, `run: null`인 액션 행
  - `runTui(root, { …, t?, localeForced? })`

- [ ] **Step 1: 실패 테스트를 쓴다**

`test/tui.rows.test.mjs`에 더한다.

```js
test('언어 행이 작업 탭 맨 위에 있다', () => {
  const rows = buildRows({ actions: buildActions(root, { t: createT('en') }), t: createT('en') })
  assert.equal(rows[0].id, 'action.language')
  assert.equal(rows[0].kind, 'action')
  assert.equal(rows[0].section, 'action')
  assert.match(rows[0].hint, /English/)
})

test('언어 행 힌트는 현재 로케일의 자기 이름이다', () => {
  const ko = buildActions(root, { t: createT('ko') })[0]
  // 어떤 화면에서 보든 언어 이름은 자기 언어로 쓴다.
  assert.match(ko.hint, /한국어/)
})
```

`test/tui.run.test.mjs`의 기존 헬퍼는 `drive(keys, opts)`다. Task 10에서 기본 `t: createT('ko')`는 이미 넣었다. 남은 두 가지를 맞춘다.

1. `drive`는 `dryRun: true`가 **기본값**이다. 기록에 쓰이는지 보는 테스트는 `dryRun: false`를 명시해야 한다.
2. 키는 `{ name: 'return' }` 형태의 객체다. 파일 상단의 `TAB` 옆에 넷을 더한다.

```js
const ENTER = { name: 'return' }
const ESC = { name: 'escape' }
const SPACE = { name: 'space' }
const LEFT = { name: 'left' }
```

그 다음 아래 테스트를 더한다.

```js
import { readRecord } from '../lib/bootstrap/record.mjs'

test('언어 행에서 Enter를 누르면 화면 언어가 바뀐다', async () => {
  // 커서는 첫 행(언어)에 있다. Enter로 en → ko, 그 뒤 Esc로 종료.
  const { screen } = await drive([ENTER, ESC], { t: createT('en') })
  assert.match(screen, /한국어/, '두 번째 로케일로 넘어가지 않았다')
})

test('언어 전환이 설치 기록에 남는다', async () => {
  const root = makeTempRepo()
  await drive([ENTER, ESC], { root, t: createT('en'), dryRun: false })
  assert.equal(readRecord(root).lang, 'ko')
})

test('dry-run에서는 언어를 기록하지 않는다', async () => {
  const root = makeTempRepo()
  await drive([ENTER, ESC], { root, t: createT('en') })
  assert.equal(readRecord(root), null)
})

test('언어 전환은 순환한다', async () => {
  // en → ko → en. 읽을 수 없는 언어에 갇혀도 Enter만 반복해 빠져나온다.
  const root = makeTempRepo()
  await drive([ENTER, ENTER, ESC], { root, t: createT('en'), dryRun: false })
  assert.equal(readRecord(root).lang, 'en')
})

test('언어 전환이 선택 집합을 보존한다', async () => {
  // Tab으로 다음 탭에 가서 Space로 하나 고르고, 다시 작업 탭으로 돌아와 Enter.
  const { result } = await drive([TAB, SPACE, LEFT, ENTER, ESC], { t: createT('en') })
  assert.equal(result.state.selected.size, 1, '언어를 바꾸자 선택이 날아갔다')
})
```

마지막 테스트를 위해 `runTui`가 반환 객체에 `state`를 담아야 한다 (Step 5에서 함께 바꾼다).

- [ ] **Step 2: 실패를 확인한다**

Run: `cd agent-installer && node --test test/tui.rows.test.mjs test/tui.run.test.mjs`
Expected: FAIL — `rows[0].id`가 `'action.bootstrap'`

- [ ] **Step 3: 카탈로그에 언어 행 키를 더한다**

| 키 | 영어 | 한국어 |
|---|---|---|
| `action.language.label` | `Language` | `언어` |
| `action.language.hint` | `{current} · Enter to change` | `{current} · Enter로 변경` |
| `tui.lang.saved` | `Saved to {path}` | `{path}에 저장했습니다` |
| `tui.lang.dryRun` | `dry-run — applied to this session only` | `dry-run — 이번 세션에만 적용했습니다` |
| `tui.lang.saveFailed` | `Could not save the language: {message}` | `언어를 저장하지 못했습니다: {message}` |
| `tui.lang.overridden` | `--lang / AGENT_SETUP_LANG wins for this run.` | `이번 실행은 --lang / AGENT_SETUP_LANG이 이깁니다.` |

- [ ] **Step 4: rows.mjs에 언어 행을 더한다**

`actionRow`가 `run`을 선택 인자로 받게 하고(`run = null`), `buildActions`의 배열 맨 앞에 넣는다.

```js
export function buildActions(root, { designItems = [], t = createT('en') } = {}) {
  return [
    // 맨 위 상주 행. 실행은 run.mjs가 특수 처리한다 — 화면을 벗어나지 않고
    // 그 자리에서 t를 갈아끼워야 하므로 다른 액션과 흐름이 다르다.
    actionRow({
      id: 'action.language',
      label: t('action.language.label'),
      hint: t('action.language.hint', { current: t(`locale.${t.locale}`) }),
      t,
    }),
    actionRow({
      id: 'action.bootstrap',
      label: t('action.bootstrap.label'),
      hint: bootstrapHint(root, t),
      t,
      run: ({ dryRun, skillMode, log, t: rt }) => runBootstrap(root, { dryRun, skillMode, log, t: rt }),
    }),
    …
```

나머지 세 액션도 라벨·힌트를 `t`로 바꾸고 `run`에 `t`를 흘린다.

- [ ] **Step 5: run.mjs에 전환과 저장을 붙인다**

import를 더한다.

```js
import { LOCALES, createT } from '../i18n/index.mjs'
import { RECORD_REL, writeLang } from '../bootstrap/record.mjs'
```

`runTui`에서 `t`를 `let`으로 잡고, 재조립 헬퍼를 선택 보존 여부로 가른다.

```js
  let { t = createT('en'), localeForced = false } = opts
```

```js
  // 언어 전환은 선택을 보존해야 한다. 적용·액션 실행 뒤 재스캔은 그 반대로
  // 실제 설치 상태로 되돌려야 한다 — 둘을 한 함수로 묶으면 언어를 바꿀 때
  // 사용자가 고르던 항목이 조용히 날아간다.
  const rebuild = async (keepSelection) => {
    collected = await collectRows(root, { fetchImpl, designDirs, env, catalogFile, t, log: () => {} })
    const ids = keepSelection ? [...state.selected] : installedIds(collected.rows)
    state = replaceRows(state, collected.rows, ids)
  }
  const recollect = () => rebuild(false)

  const cycleLanguage = async () => {
    const next = LOCALES[(LOCALES.indexOf(t.locale) + 1) % LOCALES.length]
    t = createT(next)
    let note
    try {
      writeLang(root, next, { dryRun, log: () => {}, t })
      note = dryRun ? t('tui.lang.dryRun') : t('tui.lang.saved', { path: RECORD_REL })
    } catch (err) {
      // 언어는 부수적 설정이다. 저장에 실패했다고 화면이 죽으면 설치기를 못 쓴다.
      note = t('tui.lang.saveFailed', { message: err.message })
    }
    if (localeForced) note = `${note} ${t('tui.lang.overridden')}`
    await rebuild(true)
    return note
  }
```

Enter 처리에서 언어 행을 먼저 가른다.

```js
      if (key.name === 'return' || key.name === 'enter') {
        const row = currentRow(state)
        // 언어 행은 화면을 벗어나지 않는다 — 그 자리에서 t를 갈아끼우고 다시 그린다.
        if (row?.id === 'action.language') { status = await cycleLanguage(); continue }
        if (row?.kind === 'action') {
          await suspend(async () => {
            await row.run({ root, dryRun, skillMode, fetchImpl, catalogFile, log, confirm, t })
            await pause()
          })
          await recollect()
          continue
        }
        …
```

비TTY 폴백과 `runTui` 반환에도 손댄다.

```js
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    printPlain(collected.rows, log, t)
    log(`\n${t('tui.nonInteractive')}`)
    return { interactive: false }
  }
```
```js
  return { interactive: true, state }
```

`paint()`와 `review()`가 `render`/`renderReview`에 `t`를 넘기게 한다. `t`가 `let`이라 호출 시점의 값이 자동으로 쓰인다.

- [ ] **Step 6: 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS

- [ ] **Step 7: 손으로 확인한다**

```bash
cd /d/Sources/github/Agent-Setup
node agent-installer/install.mjs
```

첫 행이 `Language`(또는 `언어`)인지, Enter로 화면 전체가 바뀌는지, 종료 후 다시 열었을 때 그 언어로 시작하는지, `git diff .agent-kit/agent-setup.json`에 `lang`만 늘었는지 본다.

- [ ] **Step 8: 커밋**

```bash
cd agent-installer
git add lib/tui lib/i18n/catalog test
git commit -F - <<'EOF'
feat(installer): 작업 탭 맨 위에 언어 행을 둔다

Enter로 순환한다. 둘뿐이라 팝업을 하나 더 만들 이유가 없고,
순환이면 읽을 수 없는 언어에 갇혀도 Enter만 반복해 빠져나온다.

전환은 선택 집합을 보존한다. 적용 뒤 재스캔과 반대 규칙이라
재조립을 두 갈래로 가른다 — 한 함수로 묶으면 언어를 바꿀 때
고르던 항목이 조용히 날아간다.

저장 실패는 화면을 죽이지 않고 상태줄로만 알린다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 12: 런처 두 개

**Files:**
- Modify: `setup-agents.sh` (저장소 루트)
- Modify: `setup-agents.ps1` (저장소 루트)

**Interfaces:**
- Consumes: `--lang` (Task 2)
- Produces: `./setup-agents.sh --lang <값>`과 `pwsh -File ./setup-agents.ps1 -Lang <값>`이 모두 통한다

- [ ] **Step 1: 런처 오류 문구를 병기로 바꾼다**

`setup-agents.sh:10`:

```bash
command -v node >/dev/null 2>&1 || {
  # Node가 없으면 i18n 기계장치가 아예 돌지 못한다. 런처에 로케일 감지
  # 분기를 넣는 대신 이 한 문장만 병기한다.
  echo "Node.js 20 or later is required / Node.js 20 이상이 필요합니다: https://nodejs.org" >&2
  exit 1
}
```

`setup-agents.ps1:23`:

```powershell
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js 20 or later is required / Node.js 20 이상이 필요합니다: https://nodejs.org"
    exit 1
}
```

- [ ] **Step 2: .ps1에 -Lang을 더한다**

`param(...)`에 더한다.

```powershell
    [string]$SkillMode,

    # .sh는 "$@"로 인자를 그대로 넘기지만 여기는 명명 파라미터라
    # --lang이 저절로 닿지 않는다. 값 검증은 install.mjs 한 곳에 맡긴다.
    [string]$Lang,

    [switch]$DryRun,
```

TUI 분기와 bootstrap 분기 양쪽에 얹는다.

```powershell
    $tuiArgs = @()
    if ($SkillMode) { $tuiArgs += @("--skill-mode", $SkillMode.ToLower()) }
    if ($Lang) { $tuiArgs += @("--lang", $Lang.ToLower()) }
    if ($DryRun) { $tuiArgs += "--dry-run" }
```

```powershell
$nodeArgs = @((Join-Path $installer "install.mjs"), "bootstrap")
if ($Help) { $nodeArgs += "--help" }
if ($SkillMode) { $nodeArgs += @("--skill-mode", $SkillMode.ToLower()) }
if ($Lang) { $nodeArgs += @("--lang", $Lang.ToLower()) }
if ($DryRun) { $nodeArgs += "--dry-run" }
```

`.sh`는 `"$@"`로 이미 통과하므로 인자 전달 변경이 없다.

- [ ] **Step 3: 문법을 확인한다**

Run: `cd /d/Sources/github/Agent-Setup && bash -n ./setup-agents.sh`
Expected: 출력 없음 (종료 코드 0)

- [ ] **Step 4: 두 런처를 돌린다**

```bash
cd /d/Sources/github/Agent-Setup
bash ./setup-agents.sh --lang en --dry-run
pwsh -File ./setup-agents.ps1 -Lang en -DryRun
bash ./setup-agents.sh --lang ko --dry-run
pwsh -File ./setup-agents.ps1 -Lang ko -DryRun
```

Expected: 앞 둘은 영어, 뒤 둘은 한국어. 넷 다 종료 코드 0이고 아무 파일도 만들지 않는다.

- [ ] **Step 5: 커밋**

```bash
cd /d/Sources/github/Agent-Setup
git add setup-agents.sh setup-agents.ps1
git commit -F - <<'EOF'
feat: 런처가 --lang을 넘기고 오류를 병기한다

.sh는 "$@"로 이미 통과하지만 .ps1은 명명 파라미터라 --lang이
닿지 않았다. -Lang을 더해 두 분기 모두에 얹는다.

Node 부재 메시지는 i18n이 돌기 전에 찍힌다. 런처에 로케일 감지를
넣는 대신 그 한 문장만 영·한 병기로 둔다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 13: 최종 검증과 문서

**Files:**
- Modify: `agent-installer/test/i18n.en.test.mjs` (표면 완성)
- Modify: `agent-installer/README.md`, `AgentSetup-README.md` (`--lang` 문서화)

**Interfaces:**
- Consumes: 앞의 모든 작업

- [ ] **Step 1: 영어 스모크의 표면을 완성한다**

`test/i18n.en.test.mjs`에 남은 경로를 더한다.

```js
test('영어 오류 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  const cases = [
    ['--dryrun'],                    // 알 수 없는 인자
    ['--list', '--set', 'x'],        // 동작 플래그 중복
    ['--skill-mode', 'nope'],        // 잘못된 값
    ['--lang', 'zz'],                // 지원하지 않는 로케일
    ['--set', 'no.such.item'],       // 알 수 없는 항목
    ['design', '--sync=nope'],       // 잘못된 sync
    ['update'],                      // 기록 없음
  ]
  for (const args of cases) {
    const r = runInstaller(root, args, { env: EN })
    assert.notEqual(r.status, 0, `${args.join(' ')}는 실패해야 한다`)
    assertNoHangul(r.stderr, `${args.join(' ')} stderr`)
    assertNoHangul(r.stdout, `${args.join(' ')} stdout`)
  }
})

test('영어 --set 적용 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const on = runInstaller(root, ['--set', 'mcp.notion'], { env: EN })
  assertNoHangul(on.stdout, '--set 설치')
  const off = runInstaller(root, ['--set', ''], { env: EN })
  assertNoHangul(off.stdout, '--set 제거')
})
```

- [ ] **Step 2: 전체 테스트를 돌린다**

Run: `cd agent-installer && npm test`
Expected: PASS (전체)

한글이 남은 표면이 있으면 그 자리를 카탈로그로 옮기고 다시 돌린다. 이 검사가 실패하는 동안은 Task 13이 끝나지 않는다.

- [ ] **Step 3: 격리 불변식을 마지막으로 확인한다**

Run: `cd agent-installer && node --test test/bootstrap.isolation.test.mjs`
Expected: PASS — `lib/i18n/**`이 외부 패키지를 끌어오지 않았다

- [ ] **Step 4: 런처 전체 검증을 돌린다**

`AGENTS.md`의 절차를 그대로 밟는다.

```bash
cd /d/Sources/github/Agent-Setup
bash -n ./setup-agents.sh
bash ./setup-agents.sh --dry-run
pwsh -File ./setup-agents.ps1 -DryRun
```

스크래치 저장소에서 멱등성과 스테이징을 확인한다.

```bash
scratch=$(mktemp -d) && git init -q "$scratch"
cd "$scratch"
bash /d/Sources/github/Agent-Setup/setup-agents.sh
bash /d/Sources/github/Agent-Setup/setup-agents.sh
git add -A && git status --short
```

Expected:
- 두 번째 실행이 아무것도 새로 만들지 않는다
- `.claude/skills`·`.kiro/skills`·`.grok/skills`가 **스테이징되지 않는다**
- `.vscode/mcp.json`·`.vscode/settings.json`이 **스테이징된다** (둘 다 gitignore 부정 항목에 기대므로 하나만 빠져도 조용히 실패한다)

- [ ] **Step 5: 언어 지속을 손으로 확인한다**

```bash
cd "$scratch"
node /d/Sources/github/Agent-Setup/agent-installer/install.mjs
# 언어 행에서 Enter → Esc로 종료 → 다시 실행
node /d/Sources/github/Agent-Setup/agent-installer/install.mjs
git diff .agent-kit/agent-setup.json
```

Expected: 두 번째 실행이 바꾼 언어로 열리고, diff에 `lang` 한 줄만 늘어 있다.

- [ ] **Step 6: --lang을 문서에 더한다**

`agent-installer/README.md`와 `AgentSetup-README.md`의 옵션 목록에 한 줄씩 더한다.

```
--lang en|ko    Display language for this run (default: your OS language, else English).
                The interactive screen's first row switches it and remembers the choice
                in .agent-kit/agent-setup.json. AGENT_SETUP_LANG works too.
```

`AgentSetup-README.md`는 한국어 문서이므로 같은 내용을 한국어로 쓴다.

- [ ] **Step 7: 커밋**

```bash
cd /d/Sources/github/Agent-Setup
git add agent-installer/test/i18n.en.test.mjs agent-installer/README.md AgentSetup-README.md
git commit -F - <<'EOF'
docs(installer): --lang을 문서화하고 영어 스모크를 마무리한다

영어 로케일로 오류·적용 경로까지 훑어 한글이 남지 않았음을
못박는다. 번역 누락은 "어디를 빠뜨렸는지 모른다"가 본질이라
이 검사가 그 자리를 짚어 준다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## 남은 판단

- **`padEnd` 계열의 열 정렬**: `install.mjs`의 `--list`와 `status.mjs`의 표는 라벨 길이에 기대 정렬한다. 영어 라벨이 한국어보다 길어 값이 밀린다. Task 3과 Task 7에서 각각 폭을 다시 잡고 테스트로 못박았지만, 다른 로케일이 늘면 다시 볼 자리다.
- **`design-md` 카테고리**: 공급자가 준 영어 데이터라 번역하지 않는다. 한국어 화면에서 카테고리만 영어로 남는다 — 의도한 결과다. 번역하려면 76개 항목의 카테고리 매핑을 따로 들여야 하고, 그건 이번 범위가 아니다.
- **`AGENT_SETUP_LANG`이 빈 문자열일 때**: `resolveLocale`이 `LOCALES.includes('')`로 걸러 다음 단계로 내려간다. `install.cli.test.mjs`가 이 경로를 밟는다.

