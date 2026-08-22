# 플러그인 설치 범위(저장소/전역) 구분 UI 설계 문서

작성일: 2026-08-22
상태: 사용자 승인 대기

## 목적

TUI의 PLUGIN 탭에서 항목이 **이 저장소에만** 설치되는지, **이 컴퓨터 전체**(머신
전역)에 설치되는지를 화면 구조로 드러내고, 사용자가 그 사실을 알고 골라서
적용까지 확인할 수 있게 한다.

현재는 같은 상류가 두 행으로 나온다 — `superpowers (plugin)`(저장소 범위,
Claude 전용)과 `superpowers (global)`(머신 전역, codex·gemini·opencode·copilot).
범위 구분은 라벨 접미사와 상세 패널 힌트에만 있어, 목록·검토·진행 화면 어디에서도
"이 체크가 저장소 밖을 건드린다"가 명확히 보이지 않는다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 작업 범위 | **표시·선택 UI만 명확화.** 새 설치 경로(예: Claude 전역)는 추가하지 않는다 |
| 화면 구성 | **범위별 그룹 헤더** — PLUGIN 탭을 '저장소 범위'와 '머신 전역' 두 그룹으로 갈라 배치 |
| 선택 방식 | 지금처럼 행 단위 Space 토글. 모달·팔레트 없음 |
| 확인 방식 | 적용 직전 검토 화면이 범위를 갈라 보여 주고, 전역 변경이 있으면 경고 한 줄. 확정은 Enter 한 번 유지 |

## 사실 관계 — CLI별 가능한 범위 (2026-08-22 기준)

| CLI | 저장소 범위 | 머신 전역 |
|---|---|---|
| Claude | ✅ 사용 중 (`--scope project`) | 상류는 지원하나 이 도구 범위 밖 (이번 작업에서 추가하지 않음) |
| codex·copilot·gemini·opencode | ❌ 상류에 없음 | ✅ 사용 중 (`global.*` 항목) |
| grok·kimi 등 | ❌ | ❌ (헤드리스 경로 없음) |

user 스코프 항목은 `global.superpowers`·`global.ponytail` 둘뿐이고 전부 PLUGIN
탭에 있다. 다른 탭(MCP·SKILL·CONFIG)은 전부 저장소 범위라 이번 변경의 영향이
없다.

## 설계

### 1. 목록 화면 — 범위별 그룹 헤더

- `lib/tui/rows.mjs`의 `buildRows`가 **plugin 카테고리 행의 group을
  `item.scope` 기반으로 덮어쓴다**: `project` → `__scope-project`,
  `user` → `__scope-user`. 표시 계층의 오버라이드다 — 항목 파일의 데이터
  모델(`scope`·`group` 필드)은 그대로 둔다.
- `GROUP_ORDER`에 `__scope-project`, `__scope-user`를 추가한다. 저장소 범위가
  항상 위, 머신 전역이 아래다.
- 헤더 문구는 기존 `categoryLabel` 규칙(`__x` → `t('category.x')`)을 그대로
  탄다. 새 키: `category.scope-project` = "저장소 범위 — 이 저장소에만 적용",
  `category.scope-user` = "머신 전역 — 이 컴퓨터 전체에 적용" (영어판 동일 취지).
- 트레이드오프: PLUGIN 탭의 기존 성격 그룹(`__flow`·`__token`)은 이 탭에서
  보이지 않게 된다. 항목이 9개뿐이라 범위 축이 더 값있다. 항목 파일의 `group`
  필드는 성격의 진실로 남겨 둔다 — 뷰 관심사를 데이터에 역류시키지 않는다.
- 그룹 헤더·스크롤 동행·검색 중 헤더 유지는 기존 기구(`displayList`·`scroll`)가
  그대로 처리한다. `state.mjs`는 무변경.

### 2. 행 라벨 — `scopedLabel` 헬퍼

- 새 순수 모듈 `lib/labels.mjs`(import 없음)에 `scopedLabel(item, t)`를 둔다:
  plugin 카테고리이고 `scope`가 있으면 `label` 뒤에 로케일 접미사를 붙인다.
  새 키: `label.scope.project` = "(저장소)", `label.scope.user` = "(전역)"
  (영어 "(repo)" / "(global)").
- **모든 plugin 항목에 균일하게 붙인다** — bkit처럼 전역 판이 없는 항목도
  "(저장소)"를 단다. 검토·진행·결과 화면에는 그룹 헤더가 없어 접미사만이 범위를
  말해 주는데, "짝이 있는 항목만" 같은 조건 규칙은 헬퍼가 형제 목록을 알아야
  해 자기완결이 깨진다. 승인된 목업에서 bkit이 무접미사였던 것과 다른 지점이며,
  균일 규칙이 더 단순하고 요구("명확하게 확인")에 더 부합한다고 판단했다.
- 항목 파일의 정적 라벨에서 수기 접미사를 제거한다:
  `plugin.superpowers` 'superpowers (plugin)' → 'superpowers',
  `global.superpowers` 'superpowers (global)' → 'superpowers',
  `global.ponytail` 'Ponytail (global)' → 'Ponytail',
  `plugin.mattpocock-skills` 'Matt Pocock (plugin)' → 'Matt Pocock'
  (`plugin.ponytail`은 이미 'Ponytail'). `skill.superpowers`의
  'superpowers (skills)'와 'Matt Pocock (skills)'는 skill 카테고리라 헬퍼
  대상이 아니고 그대로 둔다.
- 옛 라벨을 문장 안에 담은 기존 문구
  `item.unsupported.superpowersGlobalClaude`("프로젝트 스코프 항목
  superpowers (plugin)이 담당합니다")도 새 표기("superpowers (저장소)")로
  갱신한다 — 화면 어디에도 옛 접미사가 남지 않아야 한다.
- 헬퍼 적용 지점 (plugin 항목 라벨이 찍히는 모든 자리):
  - `lib/tui/rows.mjs` — 목록 행 라벨(itemRow에 넘기는 label). searchText도
    이 라벨로 구성되므로 "저장소"·"전역" 검색이 걸린다
  - `lib/tui/render.mjs` `renderReview` — 검토 화면
  - `lib/tui/progress.mjs` — 진행 화면(`progressLines`)과 평문 진행(`plainLine`)
  - `lib/tui/run.mjs` — 적용 후 notable 결과 출력
  - `install.mjs` `runClassic` — `--list` 목록, `--set` 결과·최종 상태 출력
- `lib/tui/detail.mjs`는 무변경 — 상세 패널 머리줄이 이미
  `detail.scope.project/user`("저장소 스코프"/"사용자 전역")를 찍는다.

### 3. 행 힌트 — plugin 행은 CLI 이름 나열

- `agentShortHint`(짧은 힌트): plugin 카테고리 행은 `CLI n/10` 대신 **지원 CLI
  id를 나열**한다(`codex·gemini·opencode·copilot`). 상태 표기는 지금처럼 맨 앞.
  "각각의 CLI에 무엇이 설치되는가"가 요구의 핵심이고, 80칸 힌트 자리(49칸)에
  가장 긴 나열(28칸)이 들어간다. 다른 카테고리는 기존 `n/10` 유지.
- `agentHint`(긴 힌트·검색·상세)는 기존 구성 유지 — 커버리지 수·설치 위치·
  미배선 사유가 이미 있다.

### 4. 토글 시 상태 메시지

- `lib/tui/run.mjs`의 `select()`: user 스코프 행을 **켰을 때** 상태줄에 안내를
  낸다. 새 키 `tui.selectedGlobal` = "머신 전역 항목 — 이 컴퓨터 전체에
  적용됩니다". 배타 전환 메시지(`tui.exclusiveSwitched`)가 있으면 그쪽이
  우선한다 — 상태줄은 한 줄뿐이고, 선택이 뒤집힌 사실이 더 급하다.

### 5. 검토 화면 — 범위 분할과 경고

- `renderReview`: 변경 목록에 **user 스코프 변경이 하나라도 있으면** 범위별로
  갈라 그린다 — 저장소 범위 묶음 먼저, 머신 전역 묶음 다음, 각 묶음 위에 흐림
  처리된 소제목(목록 화면과 같은 `category.scope-*` 문구 재사용, 비어 있는
  묶음은 소제목 생략). 이어서 하단 힌트 위에 경고 한 줄, 새 키
  `tui.review.globalWarning` = "머신 전역 변경 {count}건 — 이 저장소 밖
  설정(~/.codex 등)이 바뀝니다".
- user 스코프 변경이 없으면 **지금 화면 그대로** — 전부 저장소 범위인 흔한
  경우에 소제목은 잡음이다.
- 소제목·경고가 차지하는 줄 수만큼 목록 표시 여력(`room`) 계산을 보정한다 —
  "…외 N건" 잘림 판정이 어긋나면 안 된다.
- 확정은 Enter 한 번 유지. 검토 화면 자체가 확인 단계이고, 전역에만 추가 키를
  요구하면 확인 피로로 오히려 읽지 않게 된다.

### 6. i18n 키 (ko/en 양쪽 카탈로그에 추가)

| 키 | 한국어 | 영어 |
|---|---|---|
| `category.scope-project` | 저장소 범위 — 이 저장소에만 적용 | Repo scope — this repository only |
| `category.scope-user` | 머신 전역 — 이 컴퓨터 전체에 적용 | Machine global — applies to this whole computer |
| `label.scope.project` | (저장소) | (repo) |
| `label.scope.user` | (전역) | (global) |
| `tui.selectedGlobal` | 머신 전역 항목 — 이 컴퓨터 전체에 적용됩니다 | Machine-global item — applies to this whole computer |
| `tui.review.globalWarning` | 머신 전역 변경 {count}건 — 이 저장소 밖 설정(~/.codex 등)이 바뀝니다 | {count} machine-global change(s) — settings outside this repo (~/.codex etc.) will change |

문구는 구현 시 다듬을 수 있으나 뜻은 유지한다.

### 7. 무변경 목록

- `lib/tui/state.mjs` — 순수 리듀서에 새 상태·모달 없음
- `lib/tui/detail.mjs` — 스코프 표기가 이미 있다
- `lib/status.mjs`·`lib/update.mjs` — 항목 라벨을 직접 찍지 않는다
- 항목의 `detect`/`install`/`uninstall` 동작, `--set` 의미론, engine — 전부 불변
- 항목 파일의 `group` 필드 — 성격의 진실로 유지 (표시만 오버라이드)

## 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| `lib/labels.mjs` (신규) | `scopedLabel(item, t)` 순수 헬퍼 |
| `lib/tui/rows.mjs` | plugin 그룹 오버라이드, `GROUP_ORDER` 2건 추가, 라벨 헬퍼 적용, plugin 짧은 힌트 CLI 나열 |
| `lib/tui/render.mjs` | `renderReview` 범위 분할·경고 줄·여력 보정 |
| `lib/tui/run.mjs` | user 스코프 켬 상태 메시지, notable 결과 라벨 헬퍼 |
| `lib/tui/progress.mjs` | 진행·평문 라벨 헬퍼 |
| `install.mjs` | `runClassic` 출력 라벨 헬퍼 |
| `lib/items/plugin.superpowers.mjs` 외 3개 항목 | 라벨 접미사 제거 (superpowers 2판·global.ponytail·plugin.mattpocock-skills) |
| `lib/i18n/catalog/ko.mjs`·`en.mjs` | 새 키 6종 + `item.unsupported.superpowersGlobalClaude` 문구 갱신 |

## 테스트 계획

- `tui.rows.test.mjs` — plugin 행 그룹이 scope로 잡히는지, 라벨 접미사, CLI
  나열 힌트, searchText에 "전역"/"global"이 들어가는지
- `tui.render.test.mjs` — user 스코프 변경 포함/미포함 각각의 `renderReview`
  (소제목·경고 줄·잘림 보정)
- `tui.run.test.mjs` — user 스코프 켬 상태 메시지
- 신규 `labels.test.mjs` — `scopedLabel` 카테고리·스코프 분기
- 기존 항목 테스트(`items.*-global` 등)의 라벨 단언은 새 라벨로 갱신
- i18n 키 패리티 테스트(`i18n.en`/`i18n.ko`)는 양쪽 카탈로그에 키를 넣으면 통과

## 검증 절차

1. `cd agent-installer && npm test`
2. `bash ./setup-agents.sh --dry-run` / `pwsh -File ./setup-agents.ps1 -DryRun` 스모크
3. 스크래치 Git 저장소에서 두 런처 2회 실행 — 멱등성과 gitignore 규칙(AGENTS.md
   전체 검증 절차) 확인
