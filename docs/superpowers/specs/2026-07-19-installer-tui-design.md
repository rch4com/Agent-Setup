# agent-installer TUI 설계 문서

작성일: 2026-07-19
상태: 사용자 승인 완료 (진행)

## 목적

`agent-installer`의 대화형 경로를 **중첩 메뉴**에서 **단일 리스트 TUI**로 바꾼다.
사용자는 한 화면에서 검색하고, 선택하고, 브라우저로 확인하고, 적용한다.

현재는 목적지에 닿기까지 select가 3~5번 중첩된다.

```
모드 선택 → (design) 어떻게 찾을까요 → 제공자 → 카테고리 → 멀티셀렉트 → 미리볼까요
```

바꾼 뒤에는 화면이 하나다. 타이핑하면 걸러지고, Tab으로 고르고, Ctrl+O로 열어 보고,
Enter로 적용한다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 범위 | **전체 통합.** 부트스트랩·에이전트(plugin/mcp/skill)·design.md가 한 리스트에 섹션으로 공존. 모드 선택 메뉴 삭제 |
| 구현 | **Node 표준 라이브러리만.** `readline` raw 모드 + ANSI. 새 의존성 0개 |
| 부트스트랩 | 리스트 최상단 **액션 행**. 체크박스가 아니라 즉시 실행 — 제거 개념이 없는 작업을 체크 해제로 오해할 여지를 없앤다 |
| 동기화 | 3작업(설치본 업데이트·카탈로그 새로고침·오래된 항목 확인)도 같은 **액션 행**. 검색에도 걸린다 |
| diff 기준 | **전체 집합 + 지속 선택.** 선택 집합은 시작 시 설치 상태로 초기화되고 필터가 바뀌어도 유지된다. 체크를 푸는 행위만 제거가 된다 |
| 적용 | Enter는 곧바로 적용하지 않고 설치/제거 요약을 먼저 보여주고 확인받는다 |
| 검색 | 타이핑이 곧 검색어. 섹션을 가로질러 걸리고 다중 토큰 AND |
| 단축키 | 글자 키는 전부 검색에 양보하고 Tab·Ctrl+O·Enter·Esc만 쓴다 (fzf 관례) |
| 비TTY | raw 모드가 불가능하므로 목록만 출력하고 종료. CI·파이프 안전 |

## 아키텍처

```text
agent-installer/
├─ install.mjs              # 인자 파싱 + 라우팅만 (모드 select·groupMultiselect 삭제)
└─ lib/
   ├─ engine.mjs            # scan → planChanges → apply (변경 없음)
   ├─ catalog.mjs           # loadItems (변경 없음)
   ├─ bootstrap/flow.mjs    # runBootstrap (변경 없음)
   ├─ design-md/flow.mjs    # 비대화형 코어 + runSync 유지, interactiveLoop 계열 삭제
   └─ tui/
      ├─ rows.mjs           # 세 갈래를 공통 행 모델로 통합
      ├─ state.mjs          # 순수 리듀서: 검색·커서·선택
      ├─ render.mjs         # 순수 렌더: 상태 → 화면 문자열
      └─ run.mjs            # raw 키 루프 + 액션 실행 + 적용 (유일한 부수효과 지점)
```

**의존 방향은 한쪽이다.** `state.mjs`와 `render.mjs`는 아무것도 import 하지 않는
순수 함수 모듈이고, `rows.mjs`는 도메인만 알고 화면을 모르며, `run.mjs`만 셋을
조립하고 터미널·파일시스템에 닿는다. 순수 부분이 전체 로직의 대부분이라, 지금까지
테스트가 하나도 없던 대화형 경로를 처음으로 검증할 수 있게 된다.

### 행 모델 (rows.mjs)

두 종류뿐이다.

```js
// 액션 행 — 토글 대상이 아니다. 즉시 실행하고 결과를 로그로 남긴다.
{ kind: 'action', id, section, label, hint, run(ctx) }

// 항목 행 — 체크박스. planChanges의 입력이 된다.
{ kind: 'item', id, section, label, hint, status, previewTarget, searchText, item }
```

- `searchText`는 `이름 + 라벨 + 카테고리 + 설명 + 섹션명`을 미리 소문자로 합쳐 둔다.
  83개 규모라 키 입력마다 전체를 다시 걸러도 체감 지연이 없다.
- `previewTarget`은 design.md 항목만 갖는다(`webUrl ?? previewPath`). 없으면 Ctrl+O가
  안내만 하고 아무것도 열지 않는다.
- 섹션 순서: `작업` → `PLUGIN` → `MCP` → `SKILL` → `DESIGN.MD`.
- design.md 제공자가 둘 이상일 때만 힌트에 제공자명을 붙인다(단일 소스에서 잡음 방지).

### 상태와 리듀서 (state.mjs)

```js
{ rows, query, cursor, selected: Set<id>, offset }
```

- `filter(rows, query)` — 토큰 AND 매칭. 빈 검색어는 **전체 통과**다(빈 검색어가 곧
  초기 화면이므로). 옛 `matchSearch`는 반대로 빈 검색어를 전체 불일치로 봐야 했는데,
  거기서는 검색 결과가 곧 멀티셀렉트 후보라 빈 Enter가 전체 선택으로 샜기 때문이다.
  여기서는 필터가 `selected`를 건드리지 않아 그 경로 자체가 없다. 그래서 `matchSearch`는
  이관하지 않고 삭제했다.
- `visibleRows(state)` — 필터 결과에 섹션 헤더를 끼워 넣은 렌더 목록. 비는 섹션은
  헤더째 빠진다.
- `move(state, delta)` — 커서 이동. **섹션 헤더는 건너뛴다.** 양 끝에서 멈춘다(순환 없음).
- `toggle(state)` — 커서가 항목 행일 때만 `selected`를 뒤집는다. 액션 행은 무시.
- `setQuery(state, q)` — 검색어를 바꾸고 커서를 첫 선택 가능한 행으로 되돌린다.
  **`selected`는 건드리지 않는다** — 이것이 안전 규칙의 핵심이다.

### 렌더 (render.mjs)

```text
agent-installer (dry-run)   저장소: D:\sources\github\Agent-Setup
검색 > dark

  작업
  [>] 부트스트랩 실행          지침·스킬·도구별 설정
  [>] 설치본 업데이트          design.md 7개 설치됨

  DESIGN.MD (12/74)
> [x] linear                web · Productivity · 설치됨
  [ ] vercel                web · Dev Tools
  [ ] raycast               web · Productivity

  Tab 선택  Ctrl+O 브라우저  Enter 적용  Esc 종료
```

- 터미널 높이에 맞춰 잘라내고, 커서가 창 밖으로 나가면 `offset`을 민다.
- 라벨·힌트는 터미널 폭에 맞춰 자른다. 폭은 코드포인트가 아니라 **표시 칸 수**로 센다:
  한글·한자·가나·전각 구간만 2칸으로 보는 거친 판정이다. 전체 wcwidth 표는 들이지
  않는다. 액션 행 라벨이 전부 한글이라, 이 계산이 없으면 첫 화면부터 열이 어긋난다.
- 색은 `NO_COLOR`가 없고 TTY일 때만 쓴다.

### 실행 루프 (run.mjs)

```text
scan → 초기 상태 → 렌더 → 키 대기 → 리듀서 → 렌더 → ...
                                   ├ Tab(액션)  → run() → 재스캔 → 행 갱신
                                   ├ Ctrl+O     → openPreview
                                   └ Enter      → planChanges → 요약 → 확인 → apply → 재스캔
```

- 액션 실행과 적용은 TUI를 잠시 벗어나 일반 출력으로 로그를 흘리고, 끝나면 다시
  리스트로 돌아온다. 로그를 화면 안에 우겨넣지 않는다 — 실패 메시지가 길고, 잘리면
  진단이 불가능해진다.
- 적용 후에는 `scan`을 다시 돌려 상태·힌트를 갱신하고 `selected`를 새 설치 상태로
  재초기화한다.

## 키

| 키 | 동작 |
|---|---|
| 글자·숫자·공백 | 검색어에 누적 |
| Backspace | 검색어 한 글자 삭제 |
| Esc | 검색어 비우기. 이미 비어 있으면 종료 |
| ↑ ↓ / Ctrl+P Ctrl+N | 커서 이동 (섹션 헤더 건너뜀) |
| PageUp PageDown | 한 화면씩 이동 |
| Tab | 항목 체크 토글 · 액션 행 실행 |
| Ctrl+O | 커서 항목을 브라우저(또는 로컬 원본 파일)로 열기 |
| Enter | 변경 적용 (요약 → y/n 확인) |
| Ctrl+C | 즉시 종료 |

글자 키를 단축키로 쓰지 않는 이유: 타이핑이 곧 검색이라 `o`나 `q`를 단축키로 두면
"docker", "query"를 검색할 수 없다. Tab·Ctrl+O 조합은 fzf에서 검증된 관례다.

## 안전

- **선택 지속**: 필터를 바꿔도 `selected`가 유지되므로, 화면 밖 설치본이 조용히
  제거될 수 없다. 제거는 사용자가 그 행을 찾아 체크를 푸는 명시적 행위로만 일어난다.
  기존의 "보이는 집합 안에서만 diff" 규칙은 라이브 필터에서 위험하다 — 보이는 집합이
  타이핑마다 바뀌기 때문이다. 그래서 전체 집합 diff로 바꾼다.
- **적용 확인**: Enter는 설치 N건·제거 M건을 나열하고 y/n을 받는다. 변경 0건이면
  적용 화면에 들어가지 않고 리스트에 머문다.
- **--dry-run**: 헤더에 표시하고 파일 쓰기·브라우저 오픈을 모두 억제한다(기존
  `makeExec`/`makeOpener` 규약 그대로).
- **비TTY**: `process.stdin.isTTY`가 거짓이면 raw 모드를 켤 수 없다. 목록을 출력하고
  정상 종료한다.

## CLI 호환

비대화형 경로는 **하나도 바뀌지 않는다.** 테스트 15개가 여기에 걸려 있다.

```
node install.mjs                          # ← TUI (변경점)
node install.mjs --list | --set | --dry-run
node install.mjs bootstrap [--skill-mode] [--dry-run]
node install.mjs design --list | --set | --sync= | --preview | --design-dir
```

`install.mjs`의 `runClassic`은 `--list`/`--set` 전용 함수로 축소되고, 대화형 분기는
`lib/tui/run.mjs` 호출로 대체된다.

## 테스트

순수 모듈 덕분에 처음으로 대화형 로직을 검증한다.

- `rows.mjs`: 세 갈래가 하나의 행 배열로 합쳐진다 / 액션 행이 최상단이다 /
  design 제공자가 하나면 힌트에 제공자명이 없다
- `state.mjs`: 검색이 섹션을 가로지른다 / 빈 검색어는 전체 통과 /
  커서가 섹션 헤더를 건너뛴다 / 양 끝에서 멈춘다 /
  **필터를 바꿔도 선택이 유지된다** / 액션 행은 토글되지 않는다
- `render.mjs`: 비는 섹션은 헤더째 사라진다 / 커서가 창 밖이면 offset이 따라간다 /
  폭 초과 라벨이 잘린다
- `run.mjs`: 비TTY면 목록만 출력하고 종료한다
- 기존 비대화형 테스트 전부 그대로 통과

실네트워크·실브라우저 없음 — `fetchImpl`·`opener` 주입 규약을 그대로 쓴다.

## 범위 제외

- 마우스 입력, 창 크기 변경 실시간 대응(다음 키 입력 때 재계산으로 충분)
- 이모지·결합 문자까지 다루는 정밀 wcwidth (위의 거친 구간 판정으로 시작한다)
- 항목 상세 패널(스플릿 뷰) — 힌트 한 줄로 충분한지 먼저 확인한다
- 검색 히스토리·퍼지 매칭(부분 문자열 AND로 시작한다)
