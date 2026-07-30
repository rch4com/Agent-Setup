# agent-installer 다국어(i18n) 설계 문서

작성일: 2026-07-30
상태: 사용자 승인 완료 (진행)

## 목적

npm에 발행된 `@rch4com/agent-setup`을 한국어를 모르는 사람도 쓸 수 있게 만든다.

지금은 사용자에게 보이는 문자열 약 289곳이 전부 한국어다. 외국 사용자는
`npx @rch4com/agent-setup --help`를 친 첫 순간에 막힌다. 도구가 무엇을 하는지
읽을 수 없으면 그 뒤는 없다.

바꾼 뒤에는 **영어가 기준 언어**이고 한국어가 선택지다. OS 언어가 한국어면
한국어로 시작하고, 그렇지 않으면 영어로 시작한다. TUI 첫 화면 맨 위 행에서
언제든 바꿀 수 있고, 고른 언어는 저장소에 기록되어 다음 실행에도 유지된다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 표시 방식 | **단일 언어 전환.** 한 번에 한 언어만 보인다. 영·한 병기하지 않는다 — 화면 폭과 목록 밀도를 지켜야 한다 |
| 기준 언어 | **영어.** 모든 키의 원본이자 폴백. 한국어는 두 번째 카탈로그 |
| 지원 언어 | `en`, `ko` 두 개. 메뉴 표시 순서도 이 순서 |
| 번역 범위 | **사용자에게 보이는 전부.** TUI + `--help` 5종 + 부트스트랩·설치 로그 + 오류 메시지 + `status`/`update` 출력 |
| 구현 | **로케일 카탈로그 + 명시적 주입.** 전역 싱글턴을 쓰지 않는다 |
| 의존성 | **새 의존성 0개.** `node:` 내장만 (`bootstrap.isolation.test.mjs`가 강제) |
| 언어 메뉴 | **작업 탭 맨 위 상주 액션 행.** Enter로 순환. 최초 실행 마법사를 따로 두지 않는다 |
| 지속 위치 | **`.agent-kit/agent-setup.json`의 `lang` 필드.** 저장소 설치 기록에 함께 |
| 덮어쓰기 | `--lang` 플래그와 `AGENT_SETUP_LANG` 환경변수. 커밋되는 파일이라 개인용 탈출구가 필요하다 |
| 기록 형식 | `FORMAT_VERSION`은 **1 유지.** `lang`은 선택 필드 추가라 구버전 도구가 무시할 뿐이다 |
| 테스트 | 기존 단언은 **`ko` 고정**으로 살리고, 카탈로그 구조 검증과 영어 전면 스모크를 더한다 |
| 주석·커밋 | **한국어 유지.** 유지보수자용이고 `.gitmessage.txt`가 한국어 본문을 요구한다 |

## 아키텍처

```text
setup-agents.sh            # 인자 통과 (이미 됨) + 영·한 병기 오류 문구
setup-agents.ps1           # -Lang 파라미터 추가 + 영·한 병기 오류 문구
agent-installer/
├─ install.mjs              # 로케일 확정 → t 생성 → 각 경로에 주입
└─ lib/
   ├─ i18n/
   │  ├─ index.mjs          # resolveLocale · createT · LocalizedError (의존성 0)
   │  ├─ detect.mjs         # OS 언어 감지 (순수 — env와 Intl 결과를 인자로 받음)
   │  └─ catalog/
   │     ├─ en.mjs          # 기준 카탈로그 — 모든 키의 원본
   │     └─ ko.mjs          # 한국어 카탈로그
   ├─ args.mjs              # USAGE 상수 5종 → 함수로 (로드 시점엔 로케일을 모른다)
   ├─ context.mjs           # 오류를 LocalizedError로
   ├─ bootstrap/            # 옵션 주머니에 t 추가
   ├─ status.mjs            # formatStatus만 지역화 — collectStatus는 이미 순수 데이터
   └─ tui/
      ├─ rows.mjs           # 섹션·그룹을 id로, t로 라벨 조립
      ├─ state.mjs          # 변경 없음 — 여전히 아무것도 import 하지 않는다
      ├─ render.mjs         # opts.t로 크롬 문구
      └─ run.mjs            # 언어 행 처리 + t 교체 + 기록 쓰기
```

**의존 방향은 여전히 한쪽이다.** `i18n/`은 잎(leaf) 모듈이라 아무것도 import 하지
않고, 나머지 전부가 `i18n/`을 향한다. `state.mjs`만은 예외로 남는다 — 섹션을
표시 문자열에서 id로 바꾸면 상태 계층에는 사용자 문자열이 하나도 없어지므로,
"아무것도 import 하지 않는 순수 리듀서"라는 기존 불변식을 그대로 지킬 수 있다.

### 공개 API (lib/i18n/index.mjs)

```js
export const LOCALES = ['en', 'ko']   // 언어 메뉴 표시 순서 = 이 배열 순서

export function resolveLocale({ flag, env, record, detected }) → 'en' | 'ko'
export function createT(locale) → t(key, params?) → string
export class LocalizedError extends Error   // .key, .params, .message(영어)
```

### 로케일 결정

우선순위는 앞이 이긴다.

1. `--lang <en|ko>` 플래그
2. `AGENT_SETUP_LANG` 환경변수
3. 설치 기록 `.agent-kit/agent-setup.json`의 `lang`
4. OS 감지 (`detect.mjs`)
5. `'en'`

**OS 감지**(`detect.mjs`)는 순수 함수이고 원시 재료를 인자로 받는다.

1. `LC_ALL` → `LC_MESSAGES` → `LANG` → `LANGUAGE` 순으로 첫 유효값
   (Windows에서는 보통 비어 있다)
2. 비었으면 `Intl.DateTimeFormat().resolvedOptions().locale`
   (Node 20+는 full-icu가 기본이라 Windows에서도 OS 언어를 반영한다)
3. 기본 서브태그로 자른다: `ko-KR` → `ko`, `ko_KR.UTF-8` → `ko`
4. `LOCALES`에 없으면 `'en'`

`C`와 `POSIX`는 로케일 미지정으로 보고 건너뛴다.

### t의 동작

키를 문자열로 바꾸고 `{name}` 자리를 채운다.

- 활성 카탈로그에 키가 없으면 **영어로 폴백**한다. 번역 누락이 화면을 깨뜨리면 안 된다.
- 영어 카탈로그에도 없으면 **throw**한다. 그건 번역 누락이 아니라 개발자 오타이고,
  조용히 넘기면 화면에 `log.file.creat`가 그대로 찍힌다.
- 문구가 요구하는 자리에 `params` 값이 없으면 **throw**한다. 같은 이유다 —
  `12 of undefined files`가 화면에 남는 것보다 즉시 실패가 낫다.
- 값은 문자열 하나 또는 문자열 배열(여러 줄 도움말)이다. **함수 값은 두지 않는다** —
  카탈로그가 데이터여야 완전성 검사가 가능하다.

### LocalizedError

옵션 주머니가 없어 `t`를 꿸 수 없는 곳(`context.mjs`의 `repoPath`,
`record.mjs`의 `readRecord`)에서 쓴다.

생성 시 영어 카탈로그로 `.message`를 즉시 채우므로 스택 트레이스가 그대로 읽히고,
`install.mjs`의 `main().catch()` 한 곳이 `err.key`를 보고 활성 로케일로 다시 렌더한다.

```js
catch (err) {
  console.error(err.key ? t(err.key, err.params) : err.message)
  process.exit(1)
}
```

## 데이터 흐름

### 진입점의 닭-달걀 문제

인자 오류(`알 수 없는 인자입니다`)와 저장소 탐지 오류(`git 저장소 안에서
실행해야 합니다`)는 로케일이 정해지기 *전에* 던져질 수 있다. `install.mjs`의
`main()`은 이 순서로 시작한다.

```js
const argv = process.argv.slice(2)

// 1. 관대한 사전 스캔 — 실패해도 던지지 않고 null. 정식 검증은 파서가 한다.
const flagLang = preScanLang(argv)

// 2. 저장소와 기록을 "있으면 쓴다"로만 읽는다. 여기서 던지지 않는다.
const root = tryFindRepoRoot()                      // 없으면 null
const record = root ? tryReadRecord(root) : null    // 못 읽으면 null

// 3. 로케일 확정 → t 확정. 이 시점부터 모든 문구가 지역화된다.
const locale = resolveLocale({
  flag: flagLang,
  env: process.env,
  record,
  detected: detectLocale(process.env),
})
const t = createT(locale)

// 4. 이제 미뤄 둔 오류를 지역화해 던진다.
if (root === null) throw new LocalizedError('error.notGitRepo')
```

`tryFindRepoRoot`와 `tryReadRecord`는 `install.mjs`의 지역 헬퍼다. 각각
`findRepoRoot`·`readRecord`를 `try/catch`로 감싸 `null`을 돌려줄 뿐이다.

`tryReadRecord`가 삼킨 오류(깨진 JSON, 형식 버전 불일치)는 사라지지 않는다.
실제로 기록을 쓰는 명령(`update`·`status`·부트스트랩)이 `readRecord`를 정식으로
다시 불러 그때 지역화된 오류로 던진다. 언어를 정하려다 명령이 죽는 일만 막는다.

`preScanLang`은 `args.mjs`가 내보낸다 — `install.mjs`가 정적으로 import 하는
의존성 0 모듈이라 부트스트랩 격리 제약에 걸리지 않는다. `--lang xx` 같은 미지원
값에는 `null`을 돌려준다. 정식 파서가 지원 목록을 담은 오류를 내므로, 오류 경로가
둘로 갈리지 않는다.

### args.mjs — USAGE 상수를 함수로

모듈 로드 시점에는 로케일을 모르므로 상수로 둘 수 없다.

```js
export const BOOTSTRAP_USAGE = `사용법: …`     // 이전
export function bootstrapUsage(t) { … }         // 이후
export function parseRootArgs(argv, t = createT('en')) { … }
```

기본 인자를 영어 `t`로 둔다. 영어가 기준 언어이므로 정직한 기본값이고,
`args.test.mjs`의 순수 파서 테스트가 인자 하나 추가 없이 그대로 돈다.

파서에는 `--lang` 플래그를 더한다: `ROOT_SPEC`, `DESIGN_SPEC`, `BOOTSTRAP_SPEC`,
`UPDATE_SPEC`, `STATUS_SPEC` 모두 `'--lang': 'value'`.

### t가 흐르는 경로

새 매개변수를 만들지 않고 이미 있는 옵션 주머니에 얹는다.

| 경로 | 전달 방법 |
|---|---|
| `runBootstrap(root, opts)` | `opts.t` |
| `apply.mjs`의 `ensureFile`/`ensureBlocks`/`updateFiles`/`updateBlocks` | 이미 받는 `{ dryRun, log }` 주머니에 `t` 추가 |
| `render(state, opts)` | `opts.t` (이미 `color`·`dryRun`·`repo`를 받는다) |
| `buildRows`/`buildActions`/`collectRows` | `opts.t` |
| `runTui(root, opts)` | `opts.t`, 언어 전환 시 교체 |
| `runStatus`/`runUpdate`/`runDesign` | `opts.t` |
| 옵션 주머니가 없는 곳 (`context.mjs`, `record.mjs`) | `LocalizedError` — 진입점이 번역 |

### 카탈로그 키 이름 규칙

점 구분, `<영역>.<대상>.<변형>`.

```
usage.bootstrap          도움말 본문 (여러 줄 → 문자열 배열)
usage.root
usage.design
usage.update
usage.status
section.action           탭 이름
section.plugin
section.mcp
section.skill
section.design
category.other           design.md catch-all 그룹 이름
action.language.label    행 라벨
action.language.hint     행 힌트
action.bootstrap.label
status.installed         설치 상태 라벨
status.partial
status.absent
change.install           변경 동작 라벨
change.complete
change.uninstall
log.file.create          부트스트랩 진행 로그
log.block.add
error.unknownArg         오류
error.notGitRepo
item.mcp.notion.note     항목 데이터에 붙은 한국어 주석 7곳
locale.en                언어의 자기 이름
locale.ko
```

`locale.en`·`locale.ko`는 두 카탈로그에서 값이 같다 (`English`, `한국어`).
언어 이름은 어떤 화면에서 보든 자기 언어로 쓴다.

## TUI 계층

### 섹션·그룹의 id화

지금 `SECTION_ORDER = ['작업', 'PLUGIN', 'MCP', 'SKILL', 'DESIGN.MD']`는 정렬
키이자 탭 이름이자 `state.tabs`의 원소다. 번역하면 정렬이 깨진다.

```js
// rows.mjs
export const SECTION_ORDER = ['action', 'plugin', 'mcp', 'skill', 'design']
export const CATCH_ALL_CATEGORY = '__other'
```

- `state.mjs`는 그대로 아무것도 import 하지 않는다. 탭은 id 배열이 되고,
  리듀서는 문자열의 뜻을 몰라도 된다.
- 표시는 `render.mjs`의 `tabBar`가 `t('section.action')`으로 변환한다.
- `row.searchText`에는 **id + 영어 라벨 + 활성 로케일 라벨**을 모두 넣는다.
  한국어 화면에서도 `plugin`을 쳐서 찾을 수 있어야 한다.
- `design-md/scan.mjs`의 `BUNDLE_CATEGORY`가 `'기타'`로 같은 값을 공유하므로 함께
  `'__other'`로 옮기고, 표시 시점에만 `t('category.other')`로 바꾼다.
  카탈로그의 나머지 카테고리는 공급자가 준 영어 데이터라 번역하지 않는다.

`AGENT_SECTION` 매핑(`{ plugin: 'PLUGIN', mcp: 'MCP', skill: 'SKILL' }`)은
`item.category`가 이미 소문자 id이므로 그대로 쓰면 된다 — 대문자 변환을 지운다.

### 언어 행

`buildActions()`가 만드는 첫 액션 행이다.

```
❯ [▶] Language          English · Enter to change
```

- 힌트는 현재 로케일의 자기 이름(`English`, `한국어`)이다.
- Enter를 누르면 `LOCALES` 순서로 **순환**한다 (en → ko → en). 둘뿐이라 팝업
  화면을 하나 더 만들 이유가 없고, 순환이면 읽을 수 없는 언어에 갇혀도 Enter만
  반복해 빠져나올 수 있다. 셋 이상이 되면 그때 팝업으로 바꾼다.
- 다른 액션 행과 달리 화면을 벗어나지 않는다 (`suspend` 없음). `t`를 새 로케일로
  갈아끼우고 `collectRows`로 행을 다시 조립한 뒤 즉시 다시 그린다.
- 선택 집합(`state.selected`)은 항목 id 기반이라 언어가 바뀌어도 그대로 살아남는다.

### 지속

선택 즉시 `.agent-kit/agent-setup.json`의 `lang`에 쓴다.

- 기록이 없으면 `emptyRecord()` + `lang`으로 **새로 만든다**. 그래야 부트스트랩
  전에 언어를 골라도 유지된다.
- 파일이 생기거나 바뀐 사실은 상태줄로 알린다: `Saved to .agent-kit/agent-setup.json`.
- `--dry-run`에서는 쓰지 않고 세션에만 적용하며, 상태줄에 그 사실을 밝힌다.
- `--lang`이나 `AGENT_SETUP_LANG`으로 로케일이 강제된 상태에서 언어 행을 바꾸면,
  기록에는 쓰되 상태줄에 "이번 실행은 플래그/환경변수가 이깁니다"를 알린다.
  조용히 안 먹는 것보다 낫다.

### 기록 스키마

`FORMAT_VERSION`은 **1을 유지한다.** `lang`은 선택 필드 추가라 구버전 도구가
읽어도 무시할 뿐이고, 버전을 올리면 기존 기록을 가진 저장소가 전부 에러로 막힌다.

```js
// record.mjs
export function emptyRecord({ skillMode = 'auto', lang = null } = {}) {
  return { formatVersion: 1, pinnedVersion: …, skillMode, lang, items: [], design: [], managed: {} }
}

// readRecord
return { …, lang: parsed.lang ?? null }
```

`lang` 값이 `LOCALES`에 없으면 `resolveLocale`이 무시하고 다음 단계로 내려간다.
손으로 편집된 기록 때문에 도구가 죽지 않아야 한다.

### 라벨 폭

`render.mjs`의 `LABEL_WIDTH`는 24이고 `charWidth()`가 이미 CJK 2칸을 처리한다.
영어 라벨이 오히려 짧아지므로 폭 문제는 줄지만, `Update installed design.md`처럼
길어질 여지가 있는 라벨이 생긴다. 카탈로그 규칙으로 **행 라벨의 표시 폭은
`LABEL_WIDTH` 이하**를 못박고 테스트가 강제한다.

테스트는 상수 24를 베끼지 않고 `render.mjs`에서 `LABEL_WIDTH`를 import 해 쓴다.
두 값이 따로 놀면 규칙이 조용히 무의미해진다. 이를 위해 `LABEL_WIDTH`를 export 한다.

## 런처 두 개

두 런처는 얇게 유지하되, 두 군데를 손대야 한다.

**`setup-agents.ps1`에 `-Lang` 파라미터를 더한다.** `.sh`는 `"$@"`로 인자를 그대로
넘기므로 `--lang`이 저절로 통하지만, `.ps1`은 `-SkillMode`·`-DryRun`·`-Tui`·`-Help`만
받는 명명 파라미터 방식이라 `--lang`이 닿지 않는다. `-SkillMode`와 같은 방식으로
`$nodeArgs`/`$tuiArgs`에 `--lang <값>`을 얹는다. 값 검증은 지금처럼 `install.mjs`
한 곳에 맡긴다.

**런처 자체의 오류 문구는 영·한 병기로 예외를 둔다.**

```
Node.js 20 or later is required / Node.js 20 이상이 필요합니다: https://nodejs.org
```

이 메시지는 Node가 없을 때 찍히므로 i18n 기계장치가 아예 돌지 못한다. 런처에
로케일 감지 분기를 넣는 것은 "런처는 얇게"라는 기존 방침에 어긋나고, 대상은
런처당 문자열 하나뿐이다. 두 문장을 한 줄에 붙이는 편이 정직하다.

## 오류 처리

### 폴백 3단

1. `t(key)`에서 활성 카탈로그에 키가 없으면 → 영어 카탈로그
2. 영어에도 없으면 → **throw** (개발자 오타)
3. 로케일 태그가 미지원이면 → `'en'`

**단, 사용자가 `--lang xx`로 명시한 경우는 예외다.** 지원 목록을 담은 오류를 낸다.
명시한 값이 조용히 무시되면 안 된다. `AGENT_SETUP_LANG`은 환경에 남아 있을 수
있는 값이라 조용히 폴백한다.

### 언어 저장 실패

기록 쓰기가 실패해도(권한, 읽기 전용 체크아웃) TUI를 죽이지 않는다. 세션에는
새 언어를 적용하고 상태줄에 실패 사유를 남긴다. 언어는 부수적 설정이고,
여기서 화면이 죽으면 설치기 자체를 못 쓴다.

## 테스트

### 기존 테스트

`ko` 고정으로 살린다.

- 하위 프로세스로 CLI를 돌리는 테스트(`install.cli`, `bootstrap.cli`, `pack`)는
  `env`에 `AGENT_SETUP_LANG=ko`를 넣는다. `test/helpers.mjs`에 유틸을 둔다.
- 함수를 직접 부르는 테스트(`tui.rows`, `bootstrap.apply` 등)는 `createT('ko')`를
  명시적으로 넘긴다. 전역이 없으므로 병렬 실행에도 안전하다.
- 예외: 섹션 id화 때문에 `'작업'`·`'PLUGIN'`을 단언하던 `tui.rows`/`tui.state`
  테스트는 id 단언(`'action'`·`'plugin'`)으로 바꾼다. 로케일과 무관한 구조 변경이다.

### 새 테스트 — test/i18n.test.mjs

- en·ko 키 집합이 완전히 같다
- 키마다 `{자리}` 집합이 양쪽에서 같다
- 값 타입이 양쪽에서 같다 (문자열 ↔ 배열)
- 미지 키에 `t()`가 throw 한다
- 자리에 대응하는 `params` 값이 없으면 `t()`가 throw 한다
- ko에 없는 키가 en으로 폴백한다
- 두 로케일 모두에서 `action.*.label`·`section.*`의 표시 폭이 `LABEL_WIDTH` 이하다
  (`render.mjs`의 `width()`와 `LABEL_WIDTH`를 import 해 검사)
- `resolveLocale` 우선순위 표: 플래그 > 환경변수 > 기록 > 감지 > en
- 기록의 `lang`이 미지원 값이면 무시된다
- `detectLocale`: `ko_KR.UTF-8`, `ko-KR`, `en_US`, `C`, `POSIX`, 빈 문자열, 미지원 태그

### 새 테스트 — test/i18n.en.test.mjs

가장 중요한 회귀 검사다.

> 영어 로케일로 모든 CLI 표면을 실행하고 출력에 한글 코드포인트
> (`[가-힣]`)가 **하나도 없음**을 단언한다.

대상: `--help` 5종, `--list`, `status`, `design --list`, `bootstrap --dry-run`,
비대화형 `printPlain`. 두 런처의 Node 부재 메시지는 의도적 병기라 대상이 아니다.

번역 누락의 본질은 "어디를 빠뜨렸는지 모른다"이다. 이 검사는 빠뜨린 곳을 정확히
짚어 준다.

### 새 테스트 — TUI 언어 전환

`tui.run.test.mjs`에 키 시퀀스 케이스를 더한다.

- 언어 행에서 Enter → 라벨이 다른 로케일로 바뀐다
- 언어 행에서 Enter → 기록에 `lang`이 쓰인다 (없던 기록이면 새로 만들어진다)
- `--dry-run`에서는 기록이 쓰이지 않는다
- 선택 집합이 언어 전환 뒤에도 유지된다

### 손대지 않는 테스트

`bootstrap.isolation.test.mjs`는 그대로 둔다. i18n 모듈이 의존성 0이어야 한다는
제약을 이 테스트가 그대로 지켜 준다 — `lib/i18n/`이 외부 패키지를 import 하는
순간 실패한다.

## 검증

`AGENTS.md`의 전체 검증 절차를 따른다.

1. `cd agent-installer && npm test`
2. `bash -n ./setup-agents.sh`
3. `bash ./setup-agents.sh --dry-run`, `pwsh -File ./setup-agents.ps1 -DryRun`
4. 스크래치 Git 저장소에서 두 런처를 두 번씩 돌려 두 번째 실행이 멱등인지 확인
5. `git status`가 `.claude/skills`·`.kiro/skills`·`.grok/skills`를 스테이징하지
   않고, `.vscode/mcp.json`·`.vscode/settings.json`은 스테이징하는지 확인

추가로 이 작업 고유의 확인:

6. `AGENT_SETUP_LANG=ko`와 `AGENT_SETUP_LANG=en`으로 TUI를 각각 열어 화면이
   무너지지 않는지 (특히 열 정렬 — 영어 라벨로 바뀌면서 `LABEL_WIDTH` 안에 드는지)
7. 언어 행 Enter → 종료 → 재실행에서 언어가 유지되는지
8. `git diff`로 `.agent-kit/agent-setup.json`에 `lang`만 추가됐는지
9. `./setup-agents.sh --lang en --dry-run`과
   `pwsh -File ./setup-agents.ps1 -Lang en -DryRun`이 모두 영어로 출력하는지

## 범위 밖 (비목표)

- 소스 코드 주석과 커밋 메시지는 한국어를 유지한다. 유지보수자용이고
  `.gitmessage.txt`가 한국어 본문을 요구한다.
- `design-md/cache/`의 76개 `DESIGN.md` 본문은 공급자 원본이라 번역하지 않는다.
  `catalog.json`의 설명도 이미 영어다.
- 세 번째 언어는 이번 범위 밖이다. 구조는 `LOCALES` 배열에 태그를 더하고 카탈로그
  파일 하나를 추가하면 되게 열어 둔다.
- `README.md`·`AgentSetup-README.md` 문서 번역은 별도 작업이다. npm README는
  이미 영어 우선으로 재구성되어 있다.
- 복수형 처리(plural rules)와 날짜·숫자 형식은 다루지 않는다. 지금 필요한 문구에
  복수 분기가 없고, 숫자는 전부 `12 of 14` 같은 자리 채움이다.
