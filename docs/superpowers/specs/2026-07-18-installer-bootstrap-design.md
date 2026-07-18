# 부트스트랩 통합 설계 문서

작성일: 2026-07-18
상태: 사용자 승인 완료 (진행)

## 목적

`setup-agents.ps1`(599줄)과 `setup-agents.sh`(478줄)가 하는 저장소 부트스트랩 작업을
**전부 `agent-installer`로 옮긴다.** 두 스크립트는 Node를 확인하고 설치기를 부르는
약 20줄짜리 런처만 남긴다.

지금은 같은 로직이 PowerShell과 bash로 **글자 단위 중복**돼 있다. `AGENTS.md`
템플릿, 9개 도구 설정 문자열, 경로 방어, 어댑터 분기가 양쪽에 각각 존재한다.
이 저장소 유지보수의 대부분이 도구 추가·제거(최근 이력: Grok Build 추가,
Antigravity 추가, MiniMax 제거)인데, 그때마다 두 언어를 똑같이 고쳐야 하고
한쪽만 고쳐지면 두 OS가 다른 결과를 낸다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 의존성 | **부트스트랩 경로는 의존성 0.** node 표준 라이브러리만 쓴다. 갓 클론한 저장소에서 `npm install` 없이 오프라인으로 동작하는 현재 성질을 보존한다. `@clack/prompts`·`jsonc-parser`·`smol-toml`은 대화형 메뉴·MCP 등록·design.md 경로에서만 필요하다 |
| 노출 형태 | **전용 서브커맨드 + 세 번째 모드.** `node install.mjs bootstrap`, 대화형 첫 화면에 "저장소 부트스트랩" 추가 |
| 제거 의미론 | **추가 전용.** 부트스트랩은 파일을 지우지 않는다. 기존 스크립트의 안전 성질을 그대로 유지하며, 체크박스 모델(체크 해제=제거)에 편입하지 않는다 |
| 인자 처리 | **순수 패스스루 + `--menu`.** 스크립트는 node 유무만 확인하고 인자를 그대로 넘긴다. 플래그 검증·도움말은 설치기 한 곳에만 둔다. `--menu`일 때만 스크립트가 `npm install` 후 대화형을 연다 |
| 내부 구조 | **선언적 매니페스트 + 종류별 실행기.** 무엇을 만들지를 데이터로 선언한다. 도구 추가 = 매니페스트 몇 줄, 테스트는 선언을 순회해 검증하므로 새로 쓸 필요가 없다 |
| 줄바꿈 | 두 OS가 동일한 파일을 만들도록 **항상 LF**로 쓴다. 저장소의 `.gitattributes` 정책과 일치한다 (기존 `.ps1`은 `[Environment]::NewLine`을 써 Windows에서만 CRLF를 만들었다) |

## 아키텍처

`lib/design-md/`가 이미 자리잡은 패턴(데이터·실행·흐름 분리)을 그대로 따른다.

```text
agent-installer/
├─ install.mjs                  # 모드 3개 + bootstrap 서브커맨드
└─ lib/
   ├─ context.mjs               # repoPath (기존) + repoPathStrict (추가)
   ├─ gitignore.mjs             # ensureGitignoreEntries (기존 재사용)
   └─ bootstrap/
      ├─ manifest.mjs           # 무엇을 만들지 — 데이터 선언
      ├─ templates.mjs          # 템플릿 문자열 단일 출처
      ├─ apply.mjs              # dirs·files·blocks·ignore 실행기
      ├─ adapter.mjs            # 스킬 어댑터(링크/Junction/복사)
      └─ flow.mjs               # runBootstrap 진입점 + 결과 리포트
```

책임 경계는 한 줄로 답할 수 있게 자른다.

- `manifest` — **무엇을** 만드는가 (데이터만, 로직 없음)
- `templates` — 생성될 파일의 내용 (문자열만)
- `apply` / `adapter` — **어떻게** 만드는가
- `flow` — 순서와 보고

## 매니페스트 데이터 모델

```js
export const MANIFEST = {
  dirs: [
    '.agents/skills', '.agent-kit', '.claude', '.codex',
    '.gemini', '.grok', '.kiro/settings', '.kimi-code',
  ],

  // 없을 때만 생성한다. 이미 있으면 내용을 보지 않고 보존한다.
  files: [
    { path: 'AGENTS.md',                              template: AGENTS_TEMPLATE },
    { path: '.agents/skills/README.md',               template: SKILL_README },
    { path: '.agents/skills/repository-check/SKILL.md', template: EXAMPLE_SKILL },
    { path: '.agent-kit/README.md',                   template: AGENT_KIT_README },
    { path: '.claude/settings.json',                  template: CLAUDE_SETTINGS },
    { path: '.codex/config.toml',                     template: CODEX_CONFIG },
    { path: '.gemini/settings.json',                  template: GEMINI_SETTINGS },
    { path: '.grok/config.toml',                      template: GROK_CONFIG },
    { path: 'opencode.jsonc',                         template: OPENCODE_CONFIG },
    { path: 'kilo.jsonc',                             template: KILO_CONFIG },
    { path: '.kiro/settings/mcp.json',                template: KIRO_MCP_CONFIG },
    { path: '.kimi-code/mcp.json',                    template: KIMI_MCP_CONFIG },
  ],

  // 마커가 없을 때만 덧붙인다. 파일이 없으면 블록만으로 생성한다.
  blocks: [
    { path: 'CLAUDE.md', block: CLAUDE_BLOCK },  // @AGENTS.md
    { path: 'GEMINI.md', block: GEMINI_BLOCK },  // @./AGENTS.md
  ],

  // .agents/skills 를 가리키는 도구별 어댑터
  adapters: [
    { tool: 'Claude Code', path: '.claude/skills' },
    { tool: 'Kiro',        path: '.kiro/skills' },
    { tool: 'Grok Build',  path: '.grok/skills' },
  ],

  ignore: ['.claude/skills', '.kiro/skills', '.grok/skills', '.kimi-code/local.toml'],
}
```

도구 추가는 `dirs` 한 줄 + `files` 한 줄이 전부다. Antigravity처럼 별도 설정 없이
루트 `AGENTS.md`와 `.agents/skills`를 그대로 읽는 도구는 매니페스트에 아무것도
추가하지 않는다 — 현재 성질 그대로다.

## 실행기 (apply.mjs)

각 종류의 규칙은 기존 스크립트 동작을 그대로 옮긴다.

| 종류 | 규칙 |
|---|---|
| `dirs` | 없으면 생성(`recursive`), 있으면 통과 |
| `files` | **존재하면 무조건 보존**하고 `기존 파일 유지`로 보고. 깨진 심볼릭 링크도 "존재"로 친다(`lstat` 기준) — `existsSync`는 깨진 링크에 false를 반환해 덮어쓸 위험이 있다 |
| `blocks` | 파일에 `<!-- agent-kit:begin -->`가 있으면 통과. 없으면 끝에 덧붙인다(앞에 빈 줄 1개 보장). 파일 자체가 없으면 블록만으로 생성 |
| `ignore` | 기존 `ensureGitignoreEntries` 재사용. 없는 항목만 추가하고, 헤더 주석이 없을 때만 헤더를 함께 넣는다 |

템플릿은 앞뒤 공백을 다듬어 **LF + 끝 개행 1개**로 쓰고, 인코딩은 BOM 없는 UTF-8이다.

## 스킬 어댑터 (adapter.mjs)

기존 항목 처리 우선순위를 그대로 보존한다.

| 기존 상태 | 동작 |
|---|---|
| `.agents/skills`를 가리키는 올바른 링크 | 확인만 하고 통과 |
| 다른 곳을 가리키는 링크 | **보존**하고 경고 |
| `.agent-kit-managed-copy` 마커가 있는 복사본 | 삭제 후 재동기화 |
| 그 외 이미 존재 | **보존**하고 경고 |

생성 방식:

- Windows — `symlinkSync(절대경로, target, 'junction')`. Junction은 관리자 권한
  없이 만들어진다.
- POSIX — `symlinkSync('../.agents/skills', target)` 상대 링크.
- 판별 — `lstatSync().isSymbolicLink()` 후 `readlinkSync` 결과를 절대 경로로
  정규화해 원본과 비교한다. Node는 Junction도 심볼릭 링크로 보고한다.

모드별 동작: `auto`는 링크 우선·실패 시 복사 폴백, `link`는 실패 시 에러,
`copy`는 항상 복사. 복사본에는 `.agent-kit-managed-copy` 마커를 남긴다.

**이번 통합으로 개선되는 점:** 현재 bash 경로는 MSYS(Git Bash)에서 `ln -s`가
링크 대신 복사를 만들어 Windows에서 링크 모드가 사실상 항상 복사로 떨어진다.
Node는 MSYS를 거치지 않고 Win32 API를 직접 호출하므로 Windows에서도 Junction이
정상 생성된다.

## 안전 성질

**추가 전용.** 부트스트랩 모듈에는 삭제 경로를 두지 않는다. 유일한 예외는
관리 마커가 붙은 복사본의 재동기화이며, 마커가 없으면 절대 지우지 않는다.

**경로 방어.** `context.mjs`에 `repoPathStrict(root, rel)`를 추가한다. 기존
`repoPath`의 어휘적 검사에 더해, **가장 가까운 존재하는 조상의 `realpath`**가
저장소 안인지 확인한다. 어휘적 검사만으로는 심볼릭 링크를 통한 이탈을 막지
못한다. bash의 `safe_path`와 pwsh의 부모 reparse point 순회가 노리던 위험이
같고, realpath 방식이 두 OS에서 모두 통한다. 부트스트랩만 strict를 쓰고 기존
`repoPath` 호출부는 변경하지 않는다.

**글로벌 경로 불가침.** 사용자 홈이나 시스템 전역 설정은 읽지도 쓰지도 않는다.

## 진입점

```text
$ node install.mjs                     # 대화형 — 모드 3개
◆ 무엇을 관리할까요?
│ ○ 저장소 부트스트랩 (지침 · 스킬 · 도구별 설정)
│ ○ 에이전트 설치 (plugin · mcp · skill)
│ ○ design.md 라이브러리

$ node install.mjs bootstrap [--skill-mode auto|link|copy] [--dry-run]
```

- `--skill-mode` 기본값 `auto`. 잘못된 값은 설치기가 검증해 안내한다.
- `--dry-run`은 파일 쓰기·링크 생성 없이 예정 동작만 출력한다.
- 출력은 기존 `[agent-setup] ...` 접두사와 한국어 메시지를 유지해 기존 문서·기대와
  어긋나지 않게 한다.

### 의존성 격리

`bootstrap`이 `npm install` 없이 실행되려면 **해당 경로에서 도달 가능한 모듈
전체**가 표준 라이브러리만 써야 한다. 현재 `install.mjs`의 최상위 import 5개 중
4개가 의존성을 끌어온다.

```text
install.mjs
├─ @clack/prompts                                    ✗ 의존성
├─ lib/context.mjs            → node:* 만             ✓
├─ lib/catalog.mjs            → clis.mjs → jsonfile.mjs (jsonc-parser)
│                                        → tomlfile.mjs (smol-toml)   ✗
├─ lib/engine.mjs             → catalog.mjs → 위와 동일               ✗
└─ lib/design-md/flow.mjs     → @clack/prompts                        ✗
```

따라서 `install.mjs`는 **최상위에 `lib/context.mjs`와 `lib/bootstrap/*`만** 두고,
나머지는 각 분기 안에서 동적 `import()`한다.

```js
// 최상위: 표준 라이브러리 경로만
import { findRepoRoot } from './lib/context.mjs'
import { runBootstrap } from './lib/bootstrap/flow.mjs'

// 분기 안에서만 의존성 모듈을 끌어온다
if (argv[0] === 'bootstrap') { await runBootstrap(root, parseBootstrapArgs(argv.slice(1))); return }
const { loadItems } = await import('./lib/catalog.mjs')
const p = await import('@clack/prompts')
```

의존성 모듈을 찾지 못하면 `ERR_MODULE_NOT_FOUND`를 잡아
`npm install --prefix agent-installer`(또는 `--menu`)를 안내하고 종료한다.

## 얇아진 스크립트

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/agent-installer"

command -v node >/dev/null 2>&1 || {
  echo "Node.js 20 이상이 필요합니다: https://nodejs.org" >&2; exit 1; }

if [[ "${1-}" == "--menu" ]]; then
  npm install --prefix "$DIR" --silent
  exec node "$DIR/install.mjs" "${@:2}"
fi

exec node "$DIR/install.mjs" bootstrap "$@"
```

`setup-agents.ps1`도 같은 형태이며, `-Menu` 스위치와 나머지 인자 패스스루를
제공한다. 기존 호출 방식은 그대로 동작한다.

```bash
./setup-agents.sh --skill-mode copy --dry-run
pwsh -File ./setup-agents.ps1 -SkillMode Copy -DryRun
```

## 오류 처리

- **어댑터 루프만 항목 단위로 실패를 격리한다.** `flow.mjs`의 어댑터 순회에만
  `try/catch`가 있어, 도구 하나의 어댑터 구성이 실패해도 나머지 어댑터를 계속
  진행하고 마지막에 모아 보고한다.
- **`ensureDirs`·`ensureFiles`·`ensureBlocks`·`ensureIgnore`는 격리하지 않는다.**
  `repoPathStrict`가 경로 방어 위반(저장소 밖 이탈)을 던지면 `runBootstrap`
  전체가 즉시 중단된다. 이는 원본 bash의 `safe_path`가 `exit 1`로 죽던 동작,
  원본 `setup-agents.ps1`이 `$ErrorActionPreference = "Stop"`으로 전체를
  멈추던 동작과 동일하다 — 부트스트랩은 추가 전용이라 중단 시점까지 만든
  파일에 손상이 없고, 원인을 고치고 재실행하면 이어서 완성된다.
- 실패가 하나라도 있으면 종료 코드를 0이 아닌 값으로 둔다.
- Node 미설치는 스크립트가 설치 안내와 함께 종료한다.
- Git 저장소 밖 실행은 기존 `findRepoRoot`가 그대로 막는다.

## 테스트

`node --test`, 기존 `test/helpers.mjs`의 `makeTempRepo`를 재사용한다. 실네트워크
호출은 없다.

- 매니페스트가 선언한 `dirs`·`files`·`blocks`·`ignore`가 임시 저장소에 모두 생성된다
  (선언을 순회해 검증 — 도구가 늘어도 테스트를 새로 쓰지 않는다)
- **멱등성**: 두 번 실행해도 두 번째는 변경이 0이다
- **기존 파일 보존**: 내용이 있는 `AGENTS.md`를 두고 실행하면 그대로 남는다
- **깨진 심볼릭 링크**도 "존재"로 보아 덮어쓰지 않는다
- 관리 블록을 중복 추가하지 않는다. 파일이 없으면 블록만으로 생성한다
- 어댑터 5가지 기존 상태(없음 / 올바른 링크 / 다른 곳 링크 / 마커 있는 복사본 /
  마커 없는 디렉터리)가 각각 규칙대로 처리된다
- `--skill-mode copy`가 복사본과 마커를 만든다
- `--dry-run`이 파일시스템을 전혀 바꾸지 않는다
- 저장소 밖 경로와 링크를 통한 이탈이 차단된다
- 생성된 파일이 LF로 끝나고 BOM이 없다
- **의존성 격리 회귀 가드**: `install.mjs`의 부트스트랩 경로에서 도달 가능한 모듈
  그래프(`context.mjs`, `bootstrap/*`)를 순회해 모든 import가 상대 경로이거나
  `node:` 접두사임을 확인한다. 이 불변식은 최상위 import 한 줄로 조용히 깨지고,
  깨진 사실은 `node_modules`가 없는 환경에서만 드러나므로 구조로 고정한다

**스모크**: 두 스크립트의 dry-run이 Node로 인자를 제대로 넘기는지 확인한다.

## 문서 갱신

- `AGENTS.md`의 `Repository commands` — Test를 `cd agent-installer && npm test`로
  바꾸고, 두 스크립트 dry-run은 스모크로 남긴다. Full verification도 이에 맞춘다.
- `AgentSetup-README.md` — 부트스트랩 실행 방법과 `--menu`를 반영한다.
- `.agent-kit/README.md` 템플릿의 "bootstrap scripts" 설명을 설치기 기준으로
  다듬는다.

## 범위 제외

- 부트스트랩 대상의 제거(uninstall) 기능 — 추가 전용 원칙에 따라 두지 않는다
- 기존 설정 파일의 내용 병합·마이그레이션 — 지금처럼 보존만 한다
- 새 도구 지원 추가 — 이번 작업은 기존 9개 도구의 동작을 그대로 옮기는 데 한정한다
- `node_modules` 커밋이나 번들링
