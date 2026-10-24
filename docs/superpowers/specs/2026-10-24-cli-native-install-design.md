# CLI 네이티브 명령 기반 설치 구조 설계 문서

작성일: 2026-10-24
상태: 설계 승인됨 · 스펙 검토 대기

## 목적

선택 항목 설치기(agent-installer)가 지금은 각 CLI의 설정 파일(`.mcp.json`,
`.codex/config.toml`, `opencode.jsonc` 등)을 **직접 편집**해 설치를 대신한다.
이를 각 LLM CLI가 공식으로 제공하는 설치 명령(`claude plugin install`,
`codex plugin add`, `claude mcp add`, `agy mcp add` 등)을 부르는 구조로 바꾼다.
같은 명령 목록을 실행할 수도, 출력만 해서 사용자가 직접 실행할 수도 있게 한다.

동시에 지원 CLI를 **Claude Code, Codex, OpenCode, Antigravity** 네 개로 줄인다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 실행 주체 | **실행 + 출력 둘 다.** 기본은 설치기가 명령을 실행하고, `--print`(TUI는 검토 화면의 "명령 보기")는 같은 명령을 출력만 한다 |
| "명령"의 범위 | CLI 네이티브 명령이 우선. 없으면 범용 설치 명령(`npx skills add`, `git clone`, 상류 설치기)도 같은 명령 목록으로 취급한다. 파일 생성류(부트스트랩, `config.gitmessage.*`, design.md)는 지금 방식을 유지한다 |
| 범위 선택 | **실행당 하나.** 기본 `project`, `--global`이면 `user`. 지원하지 않는 항목·CLI 조합은 사유를 표시하고 건너뛴다 |
| 구조 | **선언형 레시피 + 단일 실행기.** 항목은 CLI·범위별 명령 목록(데이터)이고, 실행과 출력이 같은 데이터에서 나온다 |
| OpenCode MCP | `opencode mcp add`가 대화형뿐이라 `opencode run "<지시문>"`으로 OpenCode 에이전트에게 설정 편집을 맡기고, 설정 파일을 다시 읽어 검증한다 |
| 지원 CLI 축소 | Gemini CLI, Kilo Code, Kiro, Kimi Code, Grok Build, GitHub Copilot CLI, VS Code Copilot을 부트스트랩·어댑터·항목·문서에서 제거한다. 사용자 저장소에 이미 생성된 파일은 건드리지 않는다 |
| 버전 | 하위 호환이 깨지므로 **2.0.0**. 발행은 기존대로 `v*` 태그 워크플로 |

## 사실 관계 — CLI별 명령과 범위 (2026-10-24 이 머신 실측)

실측 버전: Claude Code 2.1.304, codex-cli 0.163.0, agy(Antigravity CLI),
skills CLI(npx skills@latest). OpenCode는 이 머신에서 바이너리가 실행되지 않아
(Windows 호환 오류) 공식 문서(opencode.ai/docs/cli)로 확인했다.

| CLI | 플러그인 | MCP | 스킬 |
|---|---|---|---|
| Claude | `claude plugin marketplace add <repo> --scope project\|user` + `claude plugin install <id> --scope project\|user` | `claude mcp add -s project\|user` | `npx skills add` |
| Codex | `codex plugin marketplace add <repo>` + `codex plugin add <id>` — 범위 플래그 없음, **전역만** | `codex mcp add <name> -- <cmd>` / `--url` — **전역만** | `npx skills add` |
| OpenCode | `opencode plugin <module> [-g]` — 프로젝트·전역 | `opencode mcp add`는 **대화형만** → `opencode run` | `npx skills add` |
| Antigravity | `agy plugin install <target>` — 범위 플래그 없음, **전역만** | `agy mcp add [--type] <name> <cmd\|url> [args]` — **전역만** | `npx skills add` |

`npx skills add`: 프로젝트는 플래그 없이, 전역은 `-g`. 에이전트 ID는
`claude-code`, `codex`, `opencode`, `antigravity`(`antigravity-cli`도 있음).

감지에 쓸 목록 명령(출력 형식 실측):

| 대상 | 근거 |
|---|---|
| Claude 플러그인 | `claude plugin list --json` — 배열, 원소에 `id`·`scope`(`user`/`project`)·`enabled`·`projectPath`(project일 때) |
| Claude MCP | `claude mcp list`는 서버마다 연결 검사를 해 느리고 네트워크를 탄다 → 프로젝트 `.mcp.json`, 전역 `~/.claude.json`의 `mcpServers`를 **읽기만** 한다 |
| Codex 플러그인 | `codex plugin list --json` — `{ installed: [{ pluginId, installed, enabled, ... }] }` |
| Codex MCP | `codex mcp list --json` — 배열, 원소에 `name`·`enabled` |
| Antigravity 플러그인 | `agy plugin list --json` — 배열, 원소에 `name`·`enabled` |
| Antigravity MCP | `agy mcp list` — 표(`NAME TYPE STATUS COMMAND/URL`), JSON 없음 → 첫 열 파싱 |
| OpenCode 플러그인·MCP | 목록 명령 없음(플러그인) / 연결 검사(MCP) → `opencode.jsonc`(프로젝트), `~/.config/opencode/opencode.json[c]`(전역)의 `plugin`·`mcp` 키를 **읽기만** 한다 |
| 스킬 (프로젝트) | 지금처럼 `.agents/skills` 디렉터리 스캔(`findSkillDir`) |
| 스킬 (전역) | `npx skills list -g --json` — 배열, 원소에 `name`·`agents` |

## 아키텍처

### 1. CLI 표 (`lib/clis.mjs`)

어댑터 11개(`jsonAdapter`·`tomlAdapter`)를 지우고 네 줄 표로 바꾼다.

```js
export const CLIS = {
  claude:      { label: 'Claude Code', bin: 'claude' },
  codex:       { label: 'Codex',       bin: 'codex' },
  opencode:    { label: 'OpenCode',    bin: 'opencode' },
  antigravity: { label: 'Antigravity', bin: 'agy' },
}
export const CLI_IDS = Object.keys(CLIS)
```

`MCP_CLI_IDS`는 없어진다(모든 CLI가 어떤 범위에선 MCP 명령을 가진다).

### 2. 레시피 항목 모델 (`lib/recipe.mjs`)

항목 정의는 범위와 무관한 데이터다.

```js
defineRecipe({
  id, category, label, group, exclusive, note, verified,
  hooks: false,            // true면 활성화 안내에 CLI별 "훅 신뢰" 단계를 붙인다
  postInstall: null,       // 항목 고유 안내(i18n 키)
  recipes: {
    <cli>: {
      project?: { install: Step[], uninstall: Step[] },
      user?:    { install: Step[], uninstall: Step[] },
    },
  },
  // 한 단계 묶음이 네 CLI를 한꺼번에 덮을 때(프로젝트 스킬의 `.agents/skills`)는
  // CLI 키 대신 `shared`를 쓴다: { shared: { project: {...} } }. 그 범위의
  // supports는 네 CLI 전부이고, 단계는 CLI마다 반복하지 않고 한 번 실행·출력한다.
  detect: { <cli>: Probe },   // 감지 질의 (아래 4절)
  reasons: { <cli>: msgKey }, // 상류 경로 자체가 없을 때만. 범위만 없으면 자동 사유
})
```

`Step`은 세 가지다.

| 형태 | 실행 모드 | 출력 모드 |
|---|---|---|
| `['claude', 'plugin', ...]` (argv 배열) | `exec`로 실행. 실패하면 그 CLI 중단 | OS 셸 인용으로 한 줄 |
| `{ argv, tolerateFail: true }` | 실패해도 계속 (마켓플레이스 "이미 등록됨") | 한 줄 |
| `{ fn, describe }` | 저장소 안 파일 정리 함수 실행 (레지스트리 스킬 제거 잔재 등) | `# <describe>` 주석 한 줄 |

**범위 바인딩.** `bindScope(def, scope)`가 정의를 지금 엔진·TUI가 쓰는 항목
모양으로 만든다 — `{ id, category, label, scope, supports, unsupported,
detect, install, uninstall, steps }`. 그래서 `engine.mjs`·TUI의 항목 인터페이스는
유지된다.

- `supports` = 그 범위의 레시피가 있는 CLI.
- `unsupported` = 나머지 CLI. 다른 범위엔 레시피가 있으면 자동 사유
  ("Codex 플러그인은 전역 전용" 같은 `item.unsupported.scopeOnly`), 어느 범위에도
  없으면 `reasons[cli]`(없으면 로드 오류 — 지금의 `assertReasons` 규칙 유지).
- 어느 CLI에도 그 범위 레시피가 없는 항목은 그 범위 목록에서 빠진다.
- `steps(action, present)` = 설치면 `present`에 없는 CLI의 install 단계,
  제거면 `present`에 있는 CLI의 uninstall 단계. **`install`·`uninstall`·출력
  모드가 모두 이 함수 하나에서 단계를 얻는다** — 실행과 출력이 어긋날 수 없다.

### 3. 레시피 헬퍼 (`lib/recipe.mjs`)

항목 파일 대부분은 헬퍼 호출 한두 개로 끝난다.

- `marketplacePlugin({ repo, id, clis })` — `clis`에 넣은 CLI만 레시피를 만든다.
  - claude: project·user 모두 `marketplace add --scope <s>`(tolerateFail) +
    `plugin install <id> --scope <s>` / `plugin uninstall <id> --scope <s>`
  - codex: user만. `plugin marketplace add <repo>`(tolerateFail) + `plugin add <id>` /
    `plugin remove <id>`
  - antigravity: user만. `agy plugin install <target>` / `agy plugin uninstall <name>`
    (target 형식은 계획 1단계 실측으로 고정)
  - opencode: `opencode plugin <module> [-g]` / 제거 명령이 없으면 `opencode run`
    지시문으로 `plugin` 배열에서 빼게 하고 재감지로 검증
- `mcpServer({ name, server })` — `server`는 지금의 `{ kind: 'stdio', command, args }`
  또는 `{ kind: 'http', url }`.
  - claude: project·user. `claude mcp add -s <s> [-t http] <name> <cmd|url> [-- args]` /
    `claude mcp remove -s <s> <name>`
  - codex: user. `codex mcp add <name> -- <cmd> <args>` / `--url <url>`;
    `codex mcp remove <name>`
  - antigravity: user. `agy mcp add <name> <cmd|url> [-- args]`; `agy mcp remove <name>`
  - opencode: project·user. 아래 5절의 `opencode run` 단계
- `skillsAdd({ source, skill, anchor })` — 지금의 `defineRegistrySkill`을 대체.
  - project: `npx -y skills@latest add <source> --skill <s> --agent universal --yes --copy`
    (지금과 같다 — `.agents/skills`에 실물, Claude는 부트스트랩 Junction으로 본다).
    네 CLI 모두 같은 단계 하나를 공유한다. 제거 뒤 남는 디렉터리·잠금 항목 정리는
    지금의 로직을 `{ fn, describe }` 단계로 옮긴다.
  - user: `npx -y skills@latest add <source> --skill <s> -g -a claude-code codex opencode antigravity --yes`
    (전역엔 공용 경로가 없어 에이전트를 명시한다. Antigravity 에이전트 ID는 계획
    1단계에서 `agy`가 실제로 읽는 쪽으로 고정)

### 4. 감지 (`lib/probe.mjs`)

- 스캔 한 번에 CLI·질의별로 명령을 최대 한 번만 실행하고 결과를 캐시한다
  (`createProbe({ root, scope, exec })`). 항목 `detect`는 캐시만 조회한다.
- PATH에 실행 파일이 없는 CLI는 감지에서 빠지고 `excluded`로 보고한다
  (지금 전역 항목이 쓰는 필드를 그대로 쓴다). 실패가 아니다.
- 상태 = 대상 CLI(지원 ∩ 설치됨)가 전부 있으면 `installed`, 일부면 `partial`,
  없으면 `absent`. `present` 목록을 state에 함께 싣는다(`steps`가 쓴다).
- Claude 프로젝트 플러그인은 `scope === 'project'`이고 `projectPath`가 저장소
  루트와 같은 원소만 센다.
- 목록 명령이 실패하면(로그인 만료 등) 그 CLI는 `absent`가 아니라 감지 실패로
  `detail`에 사유를 싣는다 — 이미 설치된 것을 다시 설치하려 들지 않게 한다.

### 5. OpenCode MCP — `opencode run`

```
opencode run "<지시문>"
```

- 지시문은 고정 영어 템플릿이다. 대상 파일 경로(프로젝트 `./opencode.jsonc`,
  전역 `~/.config/opencode/opencode.json`), 최상위 `mcp` 키, 넣을 항목의 JSON
  (지금 `clis.mjs`의 opencode 변환과 같은 모양 —
  `{ type: 'local', command: [...], enabled: true }` / `{ type: 'remote', url, enabled: true }`)을
  그대로 박고, "그 외는 바꾸지 말 것"을 명시한다. 사용자 입력이 섞이지 않는다
  (항목 정의의 상수만 들어간다).
- 제거도 같은 방식(“`mcp.<name>` 키만 지울 것”).
- 단계 직후 `{ fn }` 검증 단계가 설정 파일을 다시 읽어 항목 유무를 확인한다.
  기대와 다르면 실패로 보고한다. LLM 실행이라 결과가 비결정적이므로 이 검증이
  유일한 성공 근거다.
- 비대화형 실행이 권한 요청에서 멈추면 기존 타임아웃(`EXEC_TIMEOUT_MS`)이 끊고
  실패로 보고한다.

### 6. 실행기와 출력 모드

- 실행 모드: `engine.apply`는 그대로 항목의 `install`/`uninstall`을 부른다.
  바인딩된 `install`은 `steps('install', present)`를 차례로 실행한다. 한 CLI의
  단계가 실패하면 그 CLI만 중단하고 다음 CLI로 넘어간다. 결과 메시지에 CLI별
  `✔/✖`와 실패한 명령, 출력 마지막 몇 줄을 싣는다.
- 출력 모드: `planCommands(changes, states)`가 같은 `steps`로 CLI별 묶음을 만들고
  `formatCommands(groups, platform)`가 복사 가능한 텍스트로 바꾼다. 아무것도
  실행하거나 쓰지 않는다.

  ```
  # Codex (전역)
  codex plugin marketplace add DietrichGebert/ponytail
  codex plugin add ponytail@ponytail
  ```
- `--dry-run`은 `--print`의 별칭으로 남긴다(런처 `-DryRun`·`--dry-run` 호환).
  부트스트랩의 `--dry-run`은 지금 의미(파일 쓰지 않고 보고) 그대로다.
- 파일 생성류 함수 항목(`config.gitmessage.*`, design.md)은 출력 모드에서
  `# <항목>: 파일을 직접 생성 — 출력 모드에서는 건너뜀` 주석을 낸다.

### 7. 범위 선택

- CLI: `--global` 플래그. 없으면 `project`.
- TUI: 상단에 현재 범위 표시, `g` 키로 전환. 전환하면 선택을 비우고 재스캔한다.
  PLUGIN 탭의 범위별 그룹 헤더(2026-08-22 설계)는 실행당 범위로 대체되어 없앤다.
- `user` 범위의 `--set`은 설치만 한다. 목록 밖 항목을 제거하지 않는다(지금의
  `run.keepUserScope` 보호 규칙 유지). 전역 제거는 TUI에서 명시적으로 해제해 검토
  화면을 거친다. 검토 화면의 전역 변경 경고도 유지한다.
- `config.gitmessage.*`·design.md는 `project` 전용이다.

### 8. 활성화 안내 (`lib/activation.mjs`)

실행·출력 모두 끝에 붙는다. 이번 변경 계획에 포함된 설치만 대상이다.

1. **CLI 공통 블록** — 설치가 한 건이라도 있는 CLI마다 한 번:
   - Claude: 새 세션을 시작한다(필요하면 `/plugin`에서 활성 상태 확인).
   - Codex: `codex`를 실행해 새 세션을 시작한다.
   - OpenCode: OpenCode를 재시작한다.
   - Antigravity: Antigravity를 재시작한다.
2. **훅 블록** — `hooks: true` 항목이 있는 CLI에만:
   - Codex: `codex` 실행 → 대화창에서 `/hooks` → 해당 플러그인 훅을 Trust → 새 세션.
   - 다른 CLI는 상류가 별도 신뢰 단계를 안내하지 않으므로 블록을 내지 않는다.
3. **항목 고유 안내** — `postInstall` 키. 예:
   - Ponytail: Node.js가 PATH에 있어야 상시 활성화 훅이 동작한다.
   - ai-memory: 바이너리를 먼저 설치하고(`install.sh`/`install.ps1`)
     `ai-memory setup`으로 초기 설정, 세션 이어받기는 `ai-memory run <agent>`.

### 9. 항목 이전 (41 → 39)

| 현재 | 새 형태 | 비고 |
|---|---|---|
| `mcp.*` 7개 (codebase-memory, graft, graphify, headroom, notion, supabase, vercel) | `mcpServer()` | claude p/u · codex u · antigravity u · opencode p/u |
| `mcp.ai-memory` (커밋 안 된 작업) | `ai-memory` 플러그인 항목으로 대체 | claude p/u·codex u는 상류 마켓플레이스 플러그인(`akitaonrails/ai-memory`, `ai-memory@ai-memory`), opencode·antigravity는 `mcpServer()`의 `ai-memory mcp-bridge --no-session-id`. `hooks: true` |
| `plugin.*` 8개 + `global.ponytail`·`global.superpowers` | `marketplacePlugin()` | ponytail·superpowers는 각각 한 항목으로 병합. CLI별 지원은 계획 단계에서 상류 재검증 |
| `skill.*` 레지스트리 19개 | `skillsAdd()` | `exclusive` 쌍(impeccable·mattpocock·superpowers) 유지 |
| `skill.gsd` | 레시피(범용 명령) | `npx -y @opengsd/gsd-core@latest --claude --codex --opencode --antigravity --local\|--global`, 제거는 같은 플래그 + `--uninstall` |
| `skill.gstack` | 레시피(범용 명령) | `git clone` + `./setup --host <host>`; 지금 구현의 범위·호스트 규칙을 옮긴다 |
| `config.gitmessage.ko/en` | 함수형 유지 | project 전용 |
| design.md | 함수형 유지 | 변경 없음 |

항목 `id`는 그대로 둔다. 병합된 두 쌍은 `plugin.ponytail`·`plugin.superpowers`가
남고 `global.*`이 사라진다. ai-memory는 `plugin.ai-memory`가 된다. 그래서 기존
`--set` 사용자와 설치 기록이 유지된다.

### 10. 부트스트랩 축소

- 남김: `AGENTS.md`, `CLAUDE.md` 블록, `.agents/skills/*`, `.agent-kit`,
  `.claude/settings.json`, `.claude/skills` 어댑터, `.codex/config.toml`,
  `opencode.jsonc`.
- 지움: `GEMINI.md` 블록(Antigravity는 루트 `AGENTS.md`를 네이티브로 읽는다 —
  2026-07-18 검증), `.gemini`·`.grok`·`.kiro`·`.kimi-code`·`kilo.jsonc`·
  `.github/mcp.json`·`.github/copilot`·`.vscode/mcp.json` 템플릿,
  `chat.useAgentsMdFile` 설정 보장, `.kiro/skills`·`.grok/skills` 어댑터,
  대응 gitignore 항목.
- gitignore에 남는 것: `.claude/skills`, `!.vscode/settings.json`
  (`config.gitmessage.*`가 VS Code 커밋 템플릿을 배선하는 파일 — VS Code 편집기
  기능이지 Copilot 지원이 아니다).
- `MANIFEST.tools`: 네 개.
- 이 저장소 자체의 생성물도 맞춘다: `GEMINI.md`, `kilo.jsonc`, `.gemini/`,
  `.grok/`, `.kimi-code/`, `.kiro/`, `.github/mcp.json`, `.github/copilot/`,
  `.vscode/mcp.json`을 지우고 `.vscode/settings.json`에서 `chat.useAgentsMdFile`을
  뺀다. `.kiro/steering/commit-messages.md`의 커밋 규칙은 AGENTS.md에 이미 있다.

### 11. 지우는 모듈·코드

- `lib/global-plugin.mjs`, `lib/claude-plugins.mjs`(설정 파일 폴백).
- `catalog.mjs`의 `defineMcp`·`definePlugin`·`defineSkill`·`defineRegistrySkill`
  (레지스트리 보조 함수 `findSkillDir`·잠금 정리는 `recipe.mjs`로 옮긴다).
- `lib/tomlfile.mjs`·`lib/jsonfile.mjs`는 남은 사용처가 없으면 지운다(계획에서 grep으로 판정).
- 지운 CLI·어댑터만 겨냥한 테스트(`items.superpowers-global`, CLI 어댑터 쓰기 테스트 등).

## 오류 처리

- 단계 실패 → 그 항목·CLI 중단, 남은 CLI는 계속. 항목 결과는 하나라도 실패하면 `✖`.
- `tolerateFail` 단계 실패는 무시하되, 다음 단계도 실패하면 둘 다 보고한다.
- CLI가 PATH에 없음 → 실패 아님, `excluded`.
- 감지 명령 실패 → 그 CLI는 감지 실패로 표시하고 변경 계획에서 뺀다.
- 레시피 형식 검증(로드 시): CLI 키는 네 개 중 하나, 범위 키는 `project`/`user`,
  단계는 문자열 argv 배열이거나 `{ argv }`/`{ fn, describe }`. 어긋나면 로드 오류
  (지금의 `error.itemFieldMissing` 패턴).

## 테스트

모두 `node --test`, 실제 CLI를 부르지 않는다(가짜 `exec`).

- 헬퍼: `marketplacePlugin`·`mcpServer`·`skillsAdd`가 CLI·범위별로 기대 argv를 낸다.
- 바인딩: 범위별 `supports`·자동 사유, 범위에 레시피가 없는 항목 제외.
- **불변식**: 같은 변경 계획에서 실행 모드가 부른 명령 목록 == 출력 모드가 낸 명령 목록.
- 출력 인용: Windows·POSIX 각각.
- 실행기: 단계 순서, `tolerateFail`, partial(빠진 CLI만), CLI 실패 격리.
- 감지: CLI별 목록 출력 픽스처(이 머신 실측을 잘라 저장) 파싱, Claude 프로젝트
  플러그인의 `projectPath` 대조, PATH에 없는 CLI의 `excluded`, 목록 명령 실패.
- OpenCode `run` 단계: 지시문에 경로·JSON이 들어가고, 검증 단계가 파일을 다시 읽는다.
- 활성화 안내: CLI 공통 블록 중복 제거, 훅 블록 조건, 항목 고유 안내.
- 부트스트랩: 네 도구 기준으로 갱신. `bootstrap.isolation.test.mjs`(부트스트랩 무의존)
  불변식 유지.

## 검증

1. `cd agent-installer && npm test`
2. `bash -n ./setup-agents.sh`
3. `bash ./setup-agents.sh --dry-run`, `pwsh -File ./setup-agents.ps1 -DryRun`
4. 스크래치 Git 저장소에서 두 런처를 두 번 실행 — 두 번째는 변경 없음,
   `git status`에 `.claude/skills` 없음, `.vscode/settings.json`은 (gitmessage
   항목 설치 시) 스테이징됨
5. 실측 왕복(이 머신): Ponytail·ai-memory를 Claude(project·user)·Codex(user)·
   Antigravity(user)로 설치 → 감지 → 제거, MCP 한 개(codebase-memory)를 같은 조합으로.
   OpenCode는 실행 불가 → 출력 모드와 단위 테스트만 하고 보고에 "미검증"으로 적는다.

AGENTS.md의 "Full verification" 절도 4번에 맞춰 고친다(`.kiro/skills`·`.grok/skills`·
`.vscode/mcp.json` 문구 제거).

## 범위 밖

- 사용자 저장소에 남은 옛 도구 파일의 자동 정리.
- OpenCode 실측(이 머신에서 실행 불가).
- 새 항목 추가. 이번 작업은 구조 전환과 축소만 한다.
