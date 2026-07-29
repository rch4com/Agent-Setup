# GitHub Copilot 지원 추가 설계 문서

작성일: 2026-07-29
상태: 사용자 검토 대기

## 목적

저장소 부트스트랩과 선택 항목 설치기가 다루는 도구 목록에 **GitHub Copilot CLI**와
**VS Code Copilot**을 추가한다. 기존 9개 도구와 같은 원칙 — 공통 지침은 루트
`AGENTS.md` 하나, 공통 스킬은 `.agents/skills` 하나, 도구별 파일은 저장소 범위로만
생성 — 을 그대로 따른다.

## 조사 결과 (2026-07-29, 공식 문서 기준)

| 항목 | Copilot CLI | VS Code Copilot |
|---|---|---|
| 지침 | 루트 `AGENTS.md` 네이티브 (`CLAUDE.md`·`GEMINI.md`·`.github/copilot-instructions.md`도 함께 읽음) | 워크스페이스 루트 `AGENTS.md` 네이티브. `chat.useAgentsMdFile` 설정으로 켠다 |
| 스킬 | `.agents/skills` 네이티브 (`.github/skills`, `.claude/skills`도 동일 취급) | `.agents/skills` 네이티브 (동일 3경로, 별도 플래그 없음) |
| MCP | `.github/mcp.json`, `.mcp.json` (`.vscode/mcp.json`은 **읽지 않음**). 폴더 신뢰 확인 후 로드 | `.vscode/mcp.json`. 최상위 키가 `servers` |
| 프로젝트 설정 | `.github/copilot/settings.json`(공유·커밋), `.github/copilot/settings.local.json`(개인·gitignore) | `.vscode/settings.json` |

출처: GitHub Docs — Copilot CLI의
[custom instructions](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions),
[agent skills](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-skills),
[MCP servers](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/add-mcp-servers),
[configuration directory](https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference);
VS Code Docs —
[Agent Skills](https://code.visualstudio.com/docs/agent-customization/agent-skills),
[custom instructions](https://code.visualstudio.com/docs/agent-customization/custom-instructions),
[MCP servers](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

핵심 귀결 두 가지.

- **어댑터 불필요.** 두 도구 모두 `.agents/skills`를 직접 탐색한다. Codex·Gemini·
  OpenCode·Kilo·Kimi·Antigravity와 같은 네이티브 그룹이며, `.claude/skills`·
  `.kiro/skills`·`.grok/skills` 같은 링크/복제본을 새로 만들 필요가 없다.
- **import 배선 불필요.** 두 도구 모두 루트 `AGENTS.md`를 직접 읽는다.
  `CLAUDE.md`·`GEMINI.md`처럼 관리 블록을 덧붙일 대상이 아니다.

## 확정된 결정 사항

| 결정 | 내용 | 근거 |
|---|---|---|
| Copilot CLI의 MCP 등록 위치 | `.github/mcp.json` 전용 파일 | 도구마다 자기 프로젝트 파일을 갖는 기존 패턴과 대칭. 설치기가 도구별 설치 상태를 독립적으로 판정·표시할 수 있다 |
| 생성 파일 범위 | `.github/mcp.json`, `.github/copilot/settings.json`, `.vscode/mcp.json` | 팀 공유 대상이며 커밋된다. `settings.json`은 모델·추론 강도·컨텍스트 티어를 리포 단위로 고정하는 자리 |
| `chat.useAgentsMdFile` 주입 | **키가 없을 때만 추가.** 이미 값이 있으면(`true`든 `false`든) 보존 | "기존 설정 파일을 덮어쓰지 않는다"는 부트스트랩 안전 원칙. 사용자가 일부러 끈 경우를 되돌리지 않는다 |
| 지원 대상 | Copilot CLI + VS Code Copilot | 사용자 결정. 클라우드 코딩 에이전트는 이번 범위 밖 |
| 어댑터 | 추가하지 않음 | 두 도구 모두 `.agents/skills` 네이티브 |

## 변경 대상

### 1. `lib/bootstrap/manifest.mjs`

```js
tools: [ ...기존 9개, 'GitHub Copilot CLI', 'VS Code Copilot' ]

dirs:  [ ...기존, '.github/copilot', '.vscode' ]

files: [ ...기존,
  { path: '.github/mcp.json',              template: COPILOT_MCP_CONFIG },
  { path: '.github/copilot/settings.json', template: COPILOT_SETTINGS },
  { path: '.vscode/mcp.json',              template: VSCODE_MCP_CONFIG },
]

// 신규 섹션 — 기존 파일을 보존한 채 최상위 키 하나를 보장한다.
settings: [
  { path: '.vscode/settings.json', key: 'chat.useAgentsMdFile', value: true },
]

ignore: [ ...기존, '.github/copilot/settings.local.json', '!.vscode/mcp.json' ]

adapters: 변경 없음
blocks:   변경 없음
```

`!.vscode/mcp.json`을 넣는 이유: 널리 쓰이는 `VisualStudio.gitignore`(이 저장소 포함)가
`.vscode/*`를 무시하고 `settings.json`·`tasks.json` 등만 화이트리스트로 되살린다.
부정 항목을 추가하지 않으면 `.vscode/mcp.json`이 커밋되지 않아 팀 공유가 깨진다.
`ensureGitignoreEntries`는 파일 끝에 덧붙이므로 `.vscode/*` 규칙보다 뒤에 놓여
의도대로 동작한다. `.vscode/*`가 없는 저장소에서는 무해한 no-op이다.

### 2. `lib/bootstrap/templates.mjs`

```js
export const COPILOT_MCP_CONFIG = `{
  "mcpServers": {}
}`

export const COPILOT_SETTINGS = `{}`

export const VSCODE_MCP_CONFIG = `{
  "servers": {}
}`
```

`SKILL_README`와 `AGENT_KIT_README`의 도구 나열 문구도 갱신한다 — 두 Copilot은
어댑터가 아니라 네이티브 탐색 그룹에 들어간다.

### 3. `lib/bootstrap/apply.mjs` — 신규 primitive `ensureJsonKeys`

부트스트랩 모듈 그래프는 외부 의존성 0이 불변식이고
(`test/bootstrap.isolation.test.mjs`가 강제한다), `jsonc-parser`를 쓰는
`lib/jsonfile.mjs`의 `setKey`는 설치기 경로 전용이다. 따라서 stdlib만으로 구현한다.

계약:

- 파일이 없으면 `{\n  "<key>": <value>\n}\n`로 **생성**한다 → `create`
- 파일에 `"<key>"`가 이미 있으면 **아무것도 하지 않는다** → `skip`
  (주석 안에 있어도 건드리지 않는다. 사용자가 언급한 키를 스크립트가 덮어쓰지 않는 편이 안전하다)
- 그 외에는 루트 객체의 여는 `{` 바로 뒤에 한 줄을 **삽입**한다 → `insert`
  - 여는 `{` 다음 비공백 문자가 `}`이면 콤마 없이, 아니면 뒤에 콤마를 붙여 유효 JSON을 유지한다
  - 기존 줄바꿈·들여쓰기·주석은 그대로 둔다(정규화하지 않는다 — 기존 파일 보존 원칙)
- 루트 `{`를 찾지 못하면 경고만 남기고 건너뛴다 → `warn`
- `dryRun`이면 로그만 남기고 쓰지 않는다. 경로 검사(`repoPathStrict`)는 기존
  `ensureFiles`·`ensureBlocks`와 같은 순서로 dry-run 여부와 무관하게 수행한다

`flow.mjs`는 `ensureFiles` 다음, `ensureBlocks` 앞에 `ensureJsonKeys`를 끼운다.

### 4. `lib/clis.mjs` — MCP 등록 대상 8 → 10

```js
copilot: {
  label: 'GitHub Copilot CLI',
  ...jsonAdapter('.github/mcp.json', 'mcpServers', (s) =>
    s.kind === 'http'
      ? { type: 'http', url: s.url }
      : { type: 'local', command: s.command, args: s.args }),
},
vscode: {
  label: 'VS Code Copilot',
  ...jsonAdapter('.vscode/mcp.json', 'servers', (s) =>
    s.kind === 'http'
      ? { type: 'http', url: s.url }
      : { type: 'stdio', command: s.command, args: s.args }),
},
```

`defineMcp`의 `supports` 기본값이 `CLI_IDS` 전체이므로 기존 MCP 항목
(`mcp.notion`·`mcp.supabase`·`mcp.vercel`·`mcp.codebase-memory`)은 자동으로 두
도구까지 등록된다. `definePlugin`·`defineSkill`은 `claude` 외 전부를
`unsupported`로 채우므로 자동으로 제외된다.

### 5. 문서

- `AgentSetup-README.md` — 소개 문장, 생성 구조 트리, 도구별 연결 방식 2항목 추가,
  안전 원칙(gitignore 항목 2개), 기존 파일 처리 목록, 팀 저장소 파일 목록,
  "8개 CLI 프로젝트 설정에 동시 등록" → "10개"
- `README.md` — 도구 나열
- `.agent-kit/README.md`·`.agents/skills/README.md`는 템플릿에서 생성되는 파일이라
  템플릿 수정과 함께 이 저장소의 사본도 갱신한다

## 테스트 계획

기존 테스트는 선언을 순회하므로 대부분 자동으로 확장된다. 새로 필요한 것:

| 대상 | 검증 |
|---|---|
| `bootstrap.manifest.test.mjs` | 신규 파일 3개가 선언 목록에 있음. 도구 수 문구 갱신. `settings` 항목이 `path`/`key`/`value`를 모두 가짐 |
| `bootstrap.apply.test.mjs` (신규 케이스) | 파일 없음 → 생성 / `{}` → 콤마 없이 삽입 후 `JSON.parse` 성공 / 기존 키·주석 보존 / 이미 키 있으면 값이 `false`여도 불변 / 2회 실행 멱등 / `dryRun`이면 파일 무변경 |
| `bootstrap.isolation.test.mjs` | 그대로 통과해야 함 — 신규 코드가 외부 의존성을 끌어오지 않았다는 회귀 방어 |
| `clis.test.mjs` | `copilot`은 `.github/mcp.json`의 `mcpServers`에 `type: "local"`/`"http"`로, `vscode`는 `.vscode/mcp.json`의 `servers`에 `type: "stdio"`/`"http"`로 기록 |
| `bootstrap.apply.test.mjs` (`ensureIgnore`) | `!.vscode/mcp.json` 부정 항목이 `.vscode/*` 규칙 뒤에 추가되고, 재실행 시 중복되지 않음 |

전체 검증은 `AGENTS.md` 규정대로 `cd agent-installer && npm test` 후 두 런처를
스크래치 저장소에서 2회씩 돌려 멱등성과 `git status`를 확인한다. 이번에는
`.github/mcp.json`이 스테이징되고 `.vscode/mcp.json`이 부정 항목 덕에 함께
보이는지도 확인한다.

## 남기는 주의점

- Copilot CLI는 `.github/mcp.json`과 함께 루트 `.mcp.json`(Claude Code가 쓰는 파일)도
  읽는다. 같은 서버가 양쪽에 있으면 `.mcp.json`이 우선하지만, 설치기가 두 파일에
  같은 내용을 쓰므로 동작 차이는 없다.
- 프로젝트 스코프 MCP는 폴더 신뢰(folder trust)를 확인한 뒤에만 로드된다. 첫 실행에서
  신뢰를 승인해야 서버가 붙는다.
- 두 Copilot은 `.agents/skills`와 어댑터 `.claude/skills`를 모두 읽으므로 같은 스킬이
  이중으로 탐색된다. OpenCode·Kilo Code에 이미 존재하는 동일한 성질이며, 어댑터는
  Claude Code를 위해 필요하므로 제거 대상이 아니다.

## 범위 밖

### Copilot 클라우드 코딩 에이전트

GitHub Actions 위에서 실행되는 비동기 에이전트다. 이슈를 Copilot에게 할당하면 GitHub가
임시 개발 환경을 띄워 저장소를 클론하고 변경을 만든 뒤 초안 PR을 연다. 터미널의
Copilot CLI, 편집기의 VS Code Copilot과 달리 실행 위치가 사용자 기기가 아니다.

이번 범위에서 제외하는 이유는 **이 저장소가 관리할 수 있는 파일이 사실상 없기 때문**이다.

- 지침은 이미 해결돼 있다 — 클라우드 에이전트도 루트 `AGENTS.md`를 읽는다. 부트스트랩이
  이미 만드는 파일이라 추가 작업이 발생하지 않는다.
- MCP는 파일이 아니다 — 저장소 **Settings → Copilot → Cloud agent** 화면에 JSON을 입력하는
  방식이다([공식 문서](https://docs.github.com/copilot/how-tos/agents/copilot-coding-agent/extending-copilot-coding-agent-with-mcp)).
  "저장소 범위 파일만 생성한다"는 이 저장소의 원칙으로는 다룰 수 없다.
- 남는 `.github/workflows/copilot-setup-steps.yml`(에이전트 실행 전 의존성 설치 워크플로)은
  프로젝트마다 빌드 절차가 달라 공용 템플릿으로 찍어낼 수 없다.

즉 클라우드 에이전트는 별도 조치 없이 `AGENTS.md`의 혜택을 받고, 나머지는 GitHub 웹
설정이라 스크립트 대상이 아니다.

### 그 밖에 만들지 않는 것

- `.github/agents/`(커스텀 에이전트), `.github/hooks/`, `.github/allowed_models.txt` —
  `AGENTS.md` 단일 출처 원칙과 중복되거나 팀별 선택 사항이다
- `.github/copilot-instructions.md` — `AGENTS.md`를 네이티브로 읽으므로 불필요
- `.github/copilot/settings.json`에 구체적 값(모델·추론 강도) 채우기 — 팀이 정할 몫이라
  빈 객체로 자리만 만든다
