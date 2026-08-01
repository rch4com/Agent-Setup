# agent-installer 상세 패널·CLI 필터·진행율 설계 문서

작성일: 2026-08-01
상태: 사용자 승인 완료 (진행)

## 목적

TUI를 실제로 써 보고 드러난 세 가지 문제를 함께 고친다.

1. **설명이 잘린다.** 항목 행이 한 줄 고정이라, 미배선 사유처럼 뒤에 붙는
   정보가 통째로 사라진다.
2. **어떤 CLI에 무엇이 들어가는지 확인하기 어렵다.** `CLI 7/10` 숫자만 보이고
   *어느* CLI인지는 잘려 나간 자리에 있다. 반대 방향("내 CLI엔 뭐가 들어가나")은
   아예 볼 방법이 없다.
3. **설치 중 화면이 멎는다.** 진행 상황을 알 수 없다.

2026-07-19 TUI 설계는 "항목 상세 패널(스플릿 뷰) — 힌트 한 줄로 충분한지 먼저
확인한다"를 범위에서 뺐다. 이 문서가 그 확인의 답이다: **충분하지 않았다.**

### 현재 상태

`render.mjs:125`가 항목 한 줄을 이렇게 만든다.

```js
cut(`${here ? '❯' : ' '} ${checkbox(...)} ${pad(row.label, LABEL_WIDTH)} ${cut(row.hint, hintWidth)}`, w)
```

`hintWidth = w - LABEL_WIDTH - 6`. 80칸 터미널이면 힌트에 49칸, 한글로는 24자다.
그 자리에 `agentHint`가 상태 · CLI 커버리지 · detail · 설치 위치 · note ·
미배선 사유를 전부 ` · `로 이어 붙인다. Ponytail의 실제 힌트는 이렇다.

```
설치됨 · CLI 2/10 · 미배선 8곳: codex·copilot·gemini — 상류 설치 경로가 사용자
스코프입니다 (codex·copilot 플러그인, gemini 확장) / kilo·kiro·kimi·grok·vscode —
플러그인 기구가 없습니다 — 규칙을 AGENTS.md에 직접 옮겨 적으세요
```

49칸에서 살아남는 것은 `설치됨 · CLI 2/10 · 미배선 8곳: codex·copilo…`까지다.
사유는 한 글자도 보이지 않는다.

진행율 쪽은 `catalog.mjs:73`의 `execFileSync`가 근원이다. 동기 실행이 이벤트
루프를 통째로 막아, `npx -y skills@latest add …`가 도는 수십 초 동안 어떤 화면
갱신도 물리적으로 불가능하다. `engine.mjs:apply()`는 전부 끝난 뒤에야 결과
배열을 돌려주고, `run.mjs`는 그때 한꺼번에 로그를 찍는다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 설명 표시 | **하단 상세 패널.** 목록 아래 고정 패널에 커서 항목의 전문을 여러 줄로 편다. 아코디언(행 펼침)·별도 화면·힌트 줄바꿈은 기각 |
| 패널 높이 | **터미널 크기로만 정한다.** 커서 이동으로 변하지 않는다 — 목록이 출렁이면 아코디언을 기각한 이유가 무의미해진다 |
| CLI 방향 | **양방향.** 항목→CLI는 패널의 배선표가, CLI→항목은 상시 필터 줄이 맡는다 |
| 필터 기구 | **상시 필터 줄 + Ctrl+F 순환.** 전용 탭·검색어 토큰(`cli:`)은 기각 |
| 진행율 범위 | **전 구간.** TUI 적용·부트스트랩·비대화형 `--set`이 같은 렌더러를 쓴다 |
| 진행율 충실도 | **실시간.** `makeExec`를 비동기로 바꿔 긴 외부 명령 중에도 경과 시간이 흐른다 |
| 중단 | Ctrl+C는 **현재 항목을 마친 뒤** 멈춘다. 외부 명령을 중간에 죽이면 반쯤 설치된 상태가 남는다 |
| 비TTY | 진행 바를 그리지 않고 `[3/8] 설치 GSD … ✔ 21.8초` 평문으로 흘린다 |

## 아키텍처

의존 방향은 지금 그대로다. 순수 모듈은 계속 순수하고, `run.mjs`만 부수효과에
닿는다. 커진 책임만 새 파일로 뗀다.

```text
agent-installer/lib/
├─ width.mjs           # + wrap(text, limit)          — 의존성 0 유지
├─ clis.mjs            # + file 필드 (설정 파일 경로)
├─ catalog.mjs         # makeExec → 비동기
├─ engine.mjs          # apply(…, { onProgress })
└─ tui/
   ├─ state.mjs        # + cliFilter 축                — import 0 유지
   ├─ rows.mjs         # unsupportedText → unsupportedGroups
   ├─ detail.mjs       # 신규 · 순수 — 상세 패널 줄 생성
   ├─ progress.mjs     # 신규 · 순수 — 진행 화면 줄 생성
   ├─ render.mjs       # 레이아웃 배치만, 내용은 detail.mjs에 위임
   └─ run.mjs          # + Ctrl+F/Ctrl+B/Ctrl+D 키, 적용 중 리페인트 루프
```

`detail.mjs`·`progress.mjs`를 뗀 이유는 `render.mjs`가 이미 170줄이고 세 기능을
다 넣으면 400줄을 넘기 때문이다. 셋 다 순수 함수라 각각 독립적으로 테스트된다.

### width.mjs — wrap 추가

`cut`은 자르고 `pad`는 채우지만 접는 함수는 없다. 상세 패널은 접어야 한다.

```js
export function wrap(text, limit)   // → string[]
```

`charWidth` 판정을 그대로 쓴다. 공백이 있으면 공백에서 끊고(영문), 한 낱말이
`limit`보다 길거나 공백이 없으면(한글) 표시 폭 기준으로 끊는다. `limit <= 0`이면
빈 배열을 돌려준다 — 호출부가 폭을 잘못 계산해도 무한 루프에 빠지지 않게.

### clis.mjs — file 필드

각 CLI 어댑터에 자기가 쓰는 설정 파일 경로를 문자열로 붙인다.

```js
claude: { label: 'Claude Code', file: '.mcp.json', ...jsonAdapter('.mcp.json', …) }
```

지금 그 경로는 어댑터 클로저 안에만 있어 밖에서 읽을 수 없다. 상세 패널이
"이 항목이 **어디에** 쓰이나"를 보여 주려면 필요하다. 경로 문자열은
`jsonAdapter`/`hasSection` 호출에 넘기는 값과 **같은 상수 하나**를 쓴다 —
두 곳에 따로 적으면 갈릴 수 있다.

### tui/detail.mjs — 상세 패널 (신규, 순수)

```js
export function detailLines(row, { width, height, t }) // → string[]
```

행 한 개와 지면 크기를 받아 줄 배열을 돌려준다. 색도 커서도 모른다.

에이전트 항목:

```text
────────────────────────────────────────────────
Ponytail   plugin · 저장소 스코프 · 설치됨
토큰을 아끼는 규칙 묶음
배선   ✔ claude    .claude/settings.json
       ✔ opencode  opencode.jsonc
미배선 ✖ codex·copilot·gemini
        └ 상류 설치 경로가 사용자 스코프입니다
       ✖ kilo·kiro·kimi·grok·vscode
        └ 플러그인 기구가 없습니다 — 규칙을
          AGENTS.md에 직접 옮겨 적으세요
```

- 파일 경로는 `category === 'mcp'`일 때만 붙인다. 그때만 `clis.mjs` 어댑터가
  경로의 유일한 진실이다. plugin·skill은 설치 경로가 항목마다 달라(플러그인
  레지스트리, `.agents/skills/<이름>`) 어댑터가 알지 못하므로 scope 표시로 갈음한다.
- 설명은 에이전트 항목이면 `t(item.note)`, design.md 항목이면 `item.description`.
  둘 다 `wrap`으로 접는다.
- 사유 그룹은 `rows.mjs`의 그룹핑을 재사용한다(아래).

design.md 항목:

```text
────────────────────────────────────────────────
linear   design · Productivity · 설치됨
공급자   awesome-design-md
미리보기 https://linear.app
Linear의 디자인 시스템 문서. 타이포그래피·간격·모션
규칙을 담고 있으며 …
```

지면을 넘치면 마지막 줄에 `…외 N줄`을 찍는다. Ctrl+D로 패널을 전체 화면까지
넓힐 수 있어(아래) 아무리 긴 설명도 결국 볼 수 있다.

### rows.mjs — 사유 그룹핑 분리

지금 `unsupportedText`는 그룹핑과 문자열 합치기를 한 함수에서 한다. 패널은
구조체가 필요하다.

```js
export function unsupportedGroups(item, t)  // → [{ clis: string[], why: string }]
export function unsupportedText(item, t)    // 위를 합쳐 한 줄로 (기존 호출부용)
```

그룹핑 규칙은 한 곳에만 남는다.

**항목 행의 힌트는 짧아진다.** 미배선 사유·detail·note를 패널로 옮기고 행에는
`상태 · CLI n/10`만 남긴다. 잘릴 것이 없어지는 것이 이번 변경의 핵심이다.
`printPlain`(비TTY 목록)은 화면 폭 제약이 없으므로 지금의 긴 힌트를 계속 쓴다 —
비대화형 사용자에게는 한 줄에 다 담기는 편이 낫다.

### tui/state.mjs — cliFilter 축

```js
{ rows, tabs, tabIndex, focus, query, cliFilter, filtered, selected, cursor, offset }
```

- `cliFilter`는 `null`(전체) 또는 CLI id. 순환 순서는 `[null, ...CLI_IDS]`이고
  `state.mjs`는 그 배열을 인자로 받는다 — import 0 규칙을 지키기 위해서다.
- `visibleRows(rows, query, tab, cliFilter)` — 탭 ∩ 검색 ∩ CLI.
- 통과 규칙: `kind === 'action'`은 항상 통과(CLI 개념이 없다).
  `item.supports`가 없으면 통과(design.md는 모든 CLI가 함께 읽는 문서다).
  있으면 `supports.includes(cliFilter)`.
- `tabCounts`도 같은 필터를 탄다 — 탭 줄이 `PLUGIN 1/7`로 나와, 필터를 건
  상태에서도 다른 탭에 무엇이 남았는지 잃지 않는다.
- `setCliFilter(state, cli)`는 `refocus`를 거친다(커서·오프셋 초기화). `selected`는
  건드리지 않는다 — `setQuery`와 같은 안전 규칙이다.

**선택 안전성은 이미 보장된다.** `planChanges`는 `state.rows`(전체)를 보고
`toggleVisible`은 보이는 행만 건드린다. 필터로 숨긴 설치본이 조용히 제거되는
경로가 없다. 2026-07-19 설계가 세운 불변식이 새 축에서도 그대로 성립한다.

### tui/render.mjs — 레이아웃

지면 배분이 바뀐다.

```js
const CHROME = 6                       // 머리글·탭·검색·빈 줄·빈 줄·바닥글
panelHeight = clamp(round((height - CHROME) * 0.4), 4, 12)
listHeight  = height - CHROME - panelHeight
```

- `height - CHROME < 7`이면 패널을 숨긴다(`panelHeight = 0`). 목록이 3줄 밑으로
  내려가는 쪽이 더 나쁘다.
- Ctrl+D로 패널을 전체 화면(`panelHeight = height - CHROME`)과 기본 높이 사이에서
  토글한다. 긴 design.md 설명을 볼 유일한 경로다. 전체 화면에서는 목록이 사라지지만
  패널 첫 줄이 항목 이름이라 어디에 있는지 잃지 않는다.
- 패널 높이는 커서 위치와 무관하다. 커서를 옮겨도 목록 행이 제자리에 있다.

필터 줄은 검색줄 오른쪽에 붙인다 — 새 줄을 만들면 `CHROME`이 늘어 목록이 준다.

```text
검색 › dark                              CLI › codex (3/11) ▸
```

- 폭이 모자라면 검색줄이 이기고 필터는 `CLI›codex`로 줄인다. 그마저 모자라면
  필터 표시를 버린다(탭 줄의 `1/7` 표기가 필터가 걸려 있음을 이미 알린다).
- **검색칸에 포커스가 있을 때 반전(REVERSE)은 검색 부분까지만 칠한다.** 지금
  `searchLine`은 `pad(text, limit)`로 줄 끝까지 채워 반전시키는데, 그대로 두면
  오른쪽 필터 표시까지 반전에 먹힌다. 반전 구간을 검색 영역으로 좁히고 필터
  세그먼트는 `RESET` 뒤에 붙인다.

### tui/progress.mjs — 진행 화면 (신규, 순수)

```js
export function progressLines(progress, { width, height, color, dryRun, t })
```

`progress`는 평범한 객체다. **시각은 인자로 받는다** — 모듈 안에서 `Date.now()`를
부르면 테스트가 시간에 묶인다.

```js
{
  total, done, aborted,
  startedAt, now,                      // ms
  entries: [{ item, action, state, ok, ms, command }]
  //         state: 'pending' | 'running' | 'done' | 'skipped'
}
```

```text
적용 중 — 변경 8건

[████████████░░░░░░░░░░░░░░░░]  3/8  38%   1분12초

✔ 설치   codebase-memory     0.4초
✔ 설치   graphify            0.3초
▸ 설치   GSD                 14초 경과
         npx -y @opengsd/gsd-core@latest --claude --local
  설치   gstack
  설치   Ponytail
  제거   caveman
  …외 2건

Ctrl+C 중단 (현재 항목까지 마치고 멈춥니다)
```

지면이 모자라면 완료 항목을 위에서부터 접고 실행 중 항목을 항상 보이게 둔다 —
지금 무엇이 도는지가 가장 알고 싶은 정보다.

### catalog.mjs — makeExec 비동기화

```js
export function makeExec(dryRun, log) {
  return async (cmd, args, opts = {}) => { … }   // → { ok, output }
}
```

`execFileSync` → `node:child_process`의 `execFile` + `promisify`. `shellQuote`
규칙과 Windows shell 경유 판정은 그대로 옮긴다. 반환 형태도 그대로다.

호출부 13곳에 `await`를 더한다.

| 파일 | 호출 수 |
|---|---|
| `lib/catalog.mjs` (definePlugin·defineRegistrySkill) | 5 |
| `lib/items/skill.gstack.mjs` | 3 |
| `lib/items/plugin.ponytail.mjs` | 3 |
| `lib/items/skill.gsd.mjs` | 2 |

모든 `install`/`uninstall`은 이미 `async`이므로 시그니처는 바뀌지 않는다.
`await`를 빠뜨린 곳은 `{ ok, output }` 대신 Promise를 받아 `r.ok`가 `undefined`가
되므로 조용히 성공으로 읽힌다 — 그래서 아래 테스트에서 명시적으로 막는다.

### engine.mjs — onProgress

```js
export async function apply(root, changes, { dryRun, log, t, onProgress, shouldStop } = {})
```

- 항목마다 `onProgress({ index, total, item, action, phase: 'start' })`,
  끝나면 `phase: 'done'`(+`ok`, `ms`, `message`).
- `ctx.exec`를 감싸 실행 직전 `onProgress({ phase: 'command', command })`를 흘린다.
  화면이 지금 도는 명령을 보여 줄 수 있게 하는 유일한 경로다.
- `shouldStop()`이 참을 돌려주면 **현재 항목을 끝낸 뒤** 남은 항목을
  `{ skipped: true }`로 결과에 담고 멈춘다. 항목 경계에서만 본다.
  `AbortSignal`을 쓰지 않는 이유가 여기 있다 — 이름이 즉시 중단을 약속하는데
  실제 동작은 경계까지 기다리는 것이라 규약이 어긋난다.
- `onProgress`를 안 넘기면 지금과 완전히 같이 동작한다. 비대화형 기존 테스트가
  그대로 통과한다.

### 부트스트랩과 비대화형

- `runBootstrap(root, { onProgress })` — 동기 파일 작업이라 단계 바만 돈다.
  의존성 0 제약(`bootstrap.isolation.test.mjs`)은 `width.mjs`가 의존성 0이라
  유지된다. `progress.mjs`는 `width.mjs`와 i18n만 쓴다.
- 비대화형 `--set`은 같은 `onProgress`를 받아, TTY면 바를, 아니면 평문 줄을 낸다.

```text
[1/8] 설치 codebase-memory … ✔ 0.4초
[2/8] 설치 graphify … ✔ 0.3초
[3/8] 설치 GSD … ✔ 21.8초
```

ANSI 제어문자로 CI 로그를 더럽히지 않는다.

## 키

| 키 | 동작 | 상태 |
|---|---|---|
| Ctrl+F / Ctrl+B | CLI 필터 앞뒤 순환 | 신규 |
| Ctrl+D | 상세 패널 기본 ↔ 전체 화면 | 신규 |
| Ctrl+C (적용 중) | 현재 항목까지 마치고 중단 | 신규 |
| 나머지 | 2026-07-19 설계 그대로 | — |

**글자 키(`c`·`d`)를 쓰지 않는다.** 2026-07-19 설계가 "글자 키는 전부 검색에
양보한다"를 규칙으로 세웠고, `run.mjs:213`이 목록 포커스에서 아무 글자나 누르면
검색칸으로 올려 보낸다. `c`를 필터에 배정하면 `codex`·`claude`를 검색어로 칠 수
없다 — 첫 글자가 삼켜지기 때문이다. "검색칸이 비어 있을 때만"이라는 예외를 두면
같은 키가 상황에 따라 다르게 동작해 오히려 더 나쁘다. Ctrl 조합은 기존
Ctrl+O(미리보기)·Ctrl+A(전체 토글)와 같은 결이고 검색과 충돌하지 않는다.

Ctrl+D는 raw 모드(`stdin.setRawMode(true)`)에서 EOF가 아니라 키 이벤트로 들어온다.
Ctrl+B를 함께 두는 이유는 순환 대상이 11개(전체 + CLI 10개)라, 되돌아가는 길이
없으면 하나 지나쳤을 때 열 번을 더 눌러야 하기 때문이다.

두 키는 검색칸 포커스에서도 동작한다 — 검색으로 좁힌 직후가 CLI 필터를 겹쳐
걸고 싶은 순간이고, Ctrl 조합이라 검색어 입력과 겹치지 않는다.

## i18n

en·ko 카탈로그에 키를 함께 넣는다(`i18n.test.mjs`의 파리티 테스트가 강제한다).

- `detail.*` — 배선·미배선·공급자·미리보기 라벨, `…외 N줄`
- `filter.cli.*` — 필터 줄 라벨, 전체 표시, 빈 결과 안내
- `progress.*` — 제목, 경과, 남은 건수, 중단 안내, 건너뜀

`i18n.en.test.mjs`가 영어 카탈로그의 한글 유출을 막으므로 영어 문안을 따로 쓴다.

## 테스트

- `width.wrap` — 한글·영문·혼합·경계폭·`limit <= 0`
- `tui/detail.mjs` — 배선표(mcp는 경로 포함, plugin은 미포함) / 사유 그룹 두 갈래 /
  지면 초과 시 `…외 N줄` / 낮은 터미널에서 빈 배열
- `tui/state.mjs` — `cliFilter` 전이 / 액션·design 행은 필터를 통과한다 /
  `tabCounts`가 필터를 반영한다 / **필터 중 `toggleVisible`이 숨은 항목을 안 건드린다**
- `tui/render.mjs` — 패널 높이가 커서와 무관하다 / 낮은 터미널에서 패널이 사라진다 /
  좁은 폭에서 필터 표시가 검색줄에 양보한다
- `tui/progress.mjs` — 0%·중간·완료·실패·중단 / 지면 부족 시 실행 중 항목이 살아남는다
- `engine.apply` — `onProgress` 호출 순서 / `shouldStop`이 남은 항목을 건너뛴다 /
  `onProgress` 없이도 기존과 동일하다
- `catalog.makeExec` — 기존 shellQuote 테스트 3건을 비동기로 갱신 /
  **모든 항목의 install·uninstall이 exec 결과를 await한다**(Promise가 새면 실패)
- i18n — 신규 키 파리티

실네트워크·실브라우저 없음. `fetchImpl`·`opener` 주입 규약 그대로.

전체 검증: `cd agent-installer && npm test` → `bash ./setup-agents.sh --dry-run` →
`pwsh -File ./setup-agents.ps1 -DryRun` → 스크래치 저장소에서 두 런처를 2회씩 돌려
멱등성과 `.claude/skills`·`.kiro/skills`·`.grok/skills` 미스테이징,
`.vscode/mcp.json`·`.vscode/settings.json` 스테이징을 확인한다.

## 범위 제외

- 상세 패널 자체 스크롤 — Ctrl+D의 전체 화면 확대로 충분하다
- CLI 전용 탭 — 필터가 같은 목적을 달성하고, 탭은 분류이지 필터가 아니다
- 검색어 `cli:` 토큰 문법 — 필터 줄과 중복이다
- 개별 외부 명령의 세부 진행율 — `npx`·`claude plugin`이 알려 주지 않는다.
  경과 시간이 정직하게 낼 수 있는 최대치다
- 외부 명령의 즉시 강제 종료 — 반쯤 설치된 상태를 남긴다
- 창 크기 변경 실시간 대응 — 다음 리페인트에 반영된다(기존 규칙 유지)
