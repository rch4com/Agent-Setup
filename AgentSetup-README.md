# Repository-local AI agent bootstrap

Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code,
Grok Build(xAI grok CLI), Antigravity(Google 에이전트 IDE/CLI),
GitHub Copilot CLI, VS Code Copilot을 한 저장소에서 함께 사용할 때 공통
지침과 공통 Agent Skills를 **저장소 범위로만** 초기화하는 스크립트입니다.

## 생성되는 구조

```text
repository/
├─ AGENTS.md
├─ CLAUDE.md
├─ GEMINI.md
├─ opencode.jsonc
├─ kilo.jsonc
├─ .agents/
│  └─ skills/
│     └─ repository-check/
│        └─ SKILL.md
├─ .claude/
│  ├─ settings.json
│  └─ skills/          # .agents/skills 링크 또는 관리되는 복제본
├─ .codex/
│  └─ config.toml
├─ .gemini/
│  └─ settings.json
├─ .github/
│  ├─ mcp.json
│  └─ copilot/
│     └─ settings.json
├─ .grok/
│  ├─ config.toml
│  └─ skills/          # .agents/skills 링크 또는 관리되는 복제본
├─ .kiro/
│  ├─ skills/          # .agents/skills 링크 또는 관리되는 복제본
│  └─ settings/
│     └─ mcp.json
├─ .kimi-code/
│  └─ mcp.json
├─ .vscode/
│  ├─ mcp.json
│  └─ settings.json      # chat.useAgentsMdFile 키만 보장
└─ .agent-kit/
   └─ README.md
```

## 도구별 연결 방식

- **Claude Code:** `CLAUDE.md`가 `AGENTS.md`를 가져오며,
  `.claude/skills`가 `.agents/skills`에 연결됩니다.
- **Codex:** 루트 `AGENTS.md`와 `.agents/skills`를 사용합니다.
- **Gemini CLI:** `GEMINI.md`가 `AGENTS.md`를 가져오며,
  `.agents/skills`를 사용합니다.
- **OpenCode:** 루트 `AGENTS.md`, `.agents/skills`, `opencode.jsonc`를 사용합니다.
- **Kilo Code:** 루트 `AGENTS.md`와 `.agents/skills`를 직접 사용하며,
  프로젝트 로컬 `kilo.jsonc`를 생성합니다. 프로젝트 MCP 파일은 별도 경로인
  `.kilocode/mcp.json`이며, 부트스트랩이 아니라 설치기가 MCP 항목을 등록할 때
  만듭니다.
- **Kiro:** 루트 `AGENTS.md`를 직접 사용하며,
  `.kiro/skills`가 `.agents/skills`에 연결됩니다.
  프로젝트 MCP 파일은 `.kiro/settings/mcp.json`에만 생성됩니다.
- **Kimi Code:** 루트 `AGENTS.md`와 `.agents/skills`를 직접 사용합니다.
  프로젝트 MCP 파일은 `.kimi-code/mcp.json`에 생성되며, 머신별 설정인
  `.kimi-code/local.toml`은 `.gitignore`에 추가됩니다.
- **Grok Build (xAI grok CLI):** 루트 `AGENTS.md`를 직접 읽습니다
  (커밋 메시지 규약 포함, import 배선 불필요). 프로젝트 설정과 MCP는
  `.grok/config.toml`(`[mcp_servers.<name>]` 테이블)에 두며, 프로젝트
  스킬 탐색 경로가 `.grok/skills`라서 `.agents/skills`에 연결됩니다.
  플러그인은 `.grok/plugins/`에서 로드됩니다.
- **Antigravity (Google 에이전트 IDE/CLI):** 루트 `AGENTS.md`와 `.agents/`
  디렉터리를 네이티브로 인식하므로 `AGENTS.md`와 `.agents/skills`를 그대로
  사용합니다(import 배선·어댑터 불필요, 신규 파일 없음). MCP는 홈 글로벌
  (`~/.gemini/config/mcp_config.json`)에서만 설정하고 프로젝트 스코프 MCP
  파일이 없어 이 스크립트가 관리하는 범위 밖입니다.
- **GitHub Copilot CLI:** 루트 `AGENTS.md`와 `.agents/skills`를 네이티브로
  읽습니다(import 배선·어댑터 불필요). 프로젝트 MCP는 `.github/mcp.json`에
  등록하며, 팀 공유 설정 자리로 `.github/copilot/settings.json`을 만듭니다.
  개인 오버라이드인 `.github/copilot/settings.local.json`은 `.gitignore`에
  추가됩니다. Copilot CLI는 `.github/mcp.json`과 함께 루트 `.mcp.json`(Claude
  Code가 쓰는 파일)도 읽으며, 같은 이름의 서버가 양쪽에 있으면 `.mcp.json`이
  우선합니다. 원격(HTTP) 서버는 두 파일에 같은 내용(`type: "http"`)이 들어가
  차이가 없지만, **stdio 서버는 형식이 다릅니다** — `.mcp.json`에는 Claude
  Code 형식인 `type: "stdio"`가, `.github/mcp.json`에는 Copilot 형식인
  `type: "local"`이 기록됩니다. 우선순위 때문에 Copilot CLI가 보는 것은
  `.mcp.json` 쪽이므로, stdio MCP(`mcp.codebase-memory`)가 Copilot CLI에서
  붙지 않으면 `.mcp.json`의 해당 항목을 `type: "local"`로 바꾸거나 지우고
  `.github/mcp.json`만 남기세요.
- **VS Code Copilot:** `.agents/skills`를 네이티브로 읽고, 루트 `AGENTS.md`는
  `.vscode/settings.json`의 `chat.useAgentsMdFile` 키로 켭니다(키가 없을 때만
  추가하고 기존 값은 보존합니다). 프로젝트 MCP는 `.vscode/mcp.json`이며,
  최상위 키가 `servers`로 Copilot CLI와 형식이 다릅니다.

## 부트스트랩 실행 방법

가장 짧은 길은 npx입니다. 이 저장소의 파일을 복사하지 않아도 됩니다.

```bash
npx @rch4com/agent-setup bootstrap
npx @rch4com/agent-setup bootstrap --dry-run
npx @rch4com/agent-setup bootstrap --help
```

패키지 이름은 스코프가 붙은 `@rch4com/agent-setup` 하나입니다. 스코프 없는
`agent-setup`은 npm의 유사 이름 제한에 걸립니다 — 기존 패키지 `agentsetup`과
정규화하면 같아져 발행이 403으로 거부됩니다. 설치 후 실행 명령은 `agent-setup`
이므로 타이핑이 길어지는 것은 npx로 직접 부를 때뿐입니다.

런처(`./setup-agents.sh`, `pwsh -File ./setup-agents.ps1`)를 저장소에 두고 쓰는
방식도 그대로 동작합니다 — 오프라인 환경이나, 팀원이 커밋된 진입점을 선호할 때
쓰면 됩니다. 두 런처는 실제 로직을 담고 있지 않은 얇은 실행기이며, 부트스트랩
로직은 전부 `agent-installer/lib/bootstrap/`에 있습니다. 새 도구를 추가하려면
`agent-installer/lib/bootstrap/manifest.mjs`에 항목을 추가하고, 도구별
설정 파일이 필요하면 `agent-installer/lib/bootstrap/templates.mjs`에
템플릿을 더합니다.

대화형 화면은 `--tui`(Linux) / `-Tui`(Windows)로 켜며, **이때만**
`npm install --prefix agent-installer`가 내부적으로 먼저 실행됩니다(의존성이
이미 설치돼 있으면 즉시 통과합니다). `--menu` / `-Menu`는 옛 이름이며 그대로
동작합니다. 그 밖의 모든 실행(기본 부트스트랩, `-DryRun`, `-Help` 등)은
Node.js 표준 라이브러리만으로 동작하며 `npm install`이 필요 없습니다.

`--skill-mode` / `-SkillMode`는 대화형 화면에도 전달되어, 화면 안의
`부트스트랩 실행` 작업이 같은 연결 방식을 씁니다.

부트스트랩은 동기 파일 작업이라 진행 바 대신 로그 각 줄 앞에
`[3/39]` 꼴의 단계 번호를 붙입니다 — 작업이 이벤트 루프를 막는 동안에는
화면을 다시 그릴 수 없기 때문입니다.

`--lang` / `-Lang`도 마찬가지로 전달되어 이번 실행의 화면 언어를 정합니다
(`en`|`ko`). 지정하지 않으면 OS 언어를 따르고, 지원하지 않는 언어면
영어로 갑니다. 대화형 화면의 첫 행(언어)에서 `Enter`로 바꿀 수도 있고,
고른 언어는 `.agent-kit/agent-setup.json`에 저장되어 다음 실행에 이어집니다.
`AGENT_SETUP_LANG` 환경 변수도 같은 우선순위로 동작합니다.

설치기를 거치지 않고 직접 부를 수도 있습니다.

```bash
node agent-installer/install.mjs bootstrap --dry-run
node agent-installer/install.mjs bootstrap --help
```

## 최신으로 갱신하기

```bash
npx @rch4com/agent-setup@latest update             # 관리 파일을 최신 템플릿으로
npx @rch4com/agent-setup@latest update --dry-run   # 무엇이 바뀔지만 확인
npx @rch4com/agent-setup@latest status             # 의도 / 실제 / 버전 비교
```

`update`는 **우리가 쓴 그대로인 파일만** 바꿉니다. 판정 근거는 설치 기록에 남은
파일별 해시입니다.

| 상황 | 처리 |
|---|---|
| 기록된 해시와 일치 | 새 템플릿으로 교체 |
| 해시가 다름 | 사용자가 고쳤음 → **건드리지 않고** 드리프트로 보고 |
| 파일이 없음 | 새로 생성 (새 도구 지원이 이 경로로 들어옵니다) |
| 기록에 해시가 없음 | 출처 불명 → 건드리지 않음 |

`CLAUDE.md`·`GEMINI.md`의 관리 블록은 마커(`<!-- agent-kit:begin -->`) 사이만
교체하므로 주변에 쓴 내용은 그대로 남습니다.

드리프트 파일까지 반영하려면 `update --force`를 씁니다. git이 유일한 되돌리기
수단이므로 **워킹트리가 깨끗할 때만** 동작합니다.

해시는 줄바꿈을 LF로 정규화한 내용에 대해 계산합니다 — Windows에서 CRLF로
체크아웃해도 드리프트로 오판하지 않습니다.

### 이미 쓰던 저장소 끌어오기

설치기를 복사해 쓰던 저장소에는 기록이 없습니다.

```bash
npx @rch4com/agent-setup bootstrap --adopt
```

파일을 만들지 않고 기록만 만듭니다. 이때 **이 버전의 템플릿과 같은 파일만**
관리 대상으로 채택합니다 — 이미 고쳐 둔 파일에 해시를 박으면 다음 `update`가
그 수정을 날려버리기 때문입니다. 채택되지 않은 파일은 `status`에 나오고,
원할 때 `update --force`로 들여올 수 있습니다.

## 안전 원칙

아래는 **부트스트랩**(`setup-agents.sh` / `.ps1`)이 지키는 규칙입니다.
선택 항목 설치기가 네트워크와 외부 명령을 쓰는 범위는 그 아래
[설치기가 실행하는 것](#설치기가-실행하는-것)에 따로 적었습니다.

- 반드시 Git 저장소 안에서만 실행됩니다.
- `git rev-parse --show-toplevel`로 저장소 루트를 찾습니다.
- 저장소 루트 밖의 경로에는 쓰기를 거부합니다.
- 홈 디렉터리의 글로벌 설정을 읽거나 수정하지 않습니다.
- 기존 설정 파일은 덮어쓰지 않습니다.
- `CLAUDE.md`와 `GEMINI.md`에는 관리 블록이 없을 때만 추가합니다.
- 기존 `.claude/skills`, `.kiro/skills`, `.grok/skills`가 사용자 관리
  경로이면 보존합니다.
- `.claude/skills`, `.kiro/skills`, `.grok/skills`를 `.gitignore`에
  추가해 어댑터(링크/복제본)가 커밋되지 않도록 합니다.
- 머신별 설정인 `.kimi-code/local.toml`도 `.gitignore`에 추가합니다.
- 개인 설정인 `.github/copilot/settings.local.json`도 `.gitignore`에 추가합니다.
- `.vscode/*`를 무시하는 `.gitignore`에서도 `.vscode/mcp.json`과
  `.vscode/settings.json`이 커밋되도록 `!.vscode/mcp.json`,
  `!.vscode/settings.json` 부정 항목을 추가합니다. `settings.json`이
  무시되면 `chat.useAgentsMdFile`을 넣어도 팀에 전파되지 않습니다.
- `.vscode/settings.json`에는 `chat.useAgentsMdFile` 키가 **없을 때만**
  추가하며, 기존 키·주석·값은 그대로 둡니다.
- 반복 실행할 수 있습니다.

## 설치기가 실행하는 것

부트스트랩과 달리 선택 항목 설치기는 네트워크를 쓰고 외부 명령을 실행합니다.
무엇을 고르면 무엇이 실행되는지 미리 알 수 있도록 적어 둡니다.

| 항목 | 실행되는 것 |
|---|---|
| `plugin.*` | `claude plugin marketplace add <repo>` + `claude plugin install`. `claude` 명령이 없으면 `.claude/settings.json`에 기록만 하고, 다음 Claude Code 실행 시 다운로드됩니다 |
| `skill.gsd` | `npx -y @opengsd/gsd-core@latest` — 확인 프롬프트 없이(`-y`) 최신 버전을 내려받아 실행합니다 |
| `skill.gstack` | `github.com/garrytan/gstack` 기본 브랜치를 shallow clone한 뒤 저장소 안에서 `bash ./setup`을 실행합니다. 커밋을 고정하거나 무결성을 검증하지는 않습니다 |
| `config.gitmessage.*` | `git config --local commit.template .gitmessage.txt` — 저장소의 `.git/config`만 고칩니다(네트워크 없음). 전역·시스템 설정은 읽지도 쓰지도 않습니다 |
| design.md | `raw.githubusercontent.com`에서 `DESIGN.md`를 내려받습니다(문서 파일이며 실행되지 않습니다). 동봉 번들에 있으면 네트워크를 쓰지 않습니다 |

- 항목을 고르기 전에 대상 저장소·패키지를 신뢰할 수 있는지 확인하세요.
  세 항목 모두 제3자 코드를 이 저장소 안에서 실행합니다.
- 네트워크 호출에는 20초 시간 제한과 8MiB 응답 본문 상한이 걸려 있습니다
  (데이터가 계속 오는 응답은 시간 제한에 걸리지 않으므로 크기도 함께 막습니다).
- `--dry-run`을 붙이면 무엇이 실행·기록될지만 출력하고 아무것도 바꾸지
  않습니다.
- MCP 항목은 설정 파일에 URL·명령만 기록합니다. 인증(OAuth)은 각 CLI를
  처음 쓸 때 진행되며 토큰은 이 저장소에 저장되지 않습니다.

## Windows

이 파일들을 저장소의 아무 위치에 두고 PowerShell에서 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-agents.ps1
```

PowerShell 7:

```powershell
pwsh -File .\setup-agents.ps1
```

Claude, Kiro, Grok Build의 스킬 어댑터 방식:

```powershell
# Junction 우선, 실패하면 복사
pwsh -File .\setup-agents.ps1 -SkillMode Auto

# Junction만 사용
pwsh -File .\setup-agents.ps1 -SkillMode Link

# 복사만 사용
pwsh -File .\setup-agents.ps1 -SkillMode Copy
```

표시 언어 선택 (기본은 OS 언어, 지원하지 않으면 영어):

```powershell
pwsh -File .\setup-agents.ps1 -Lang en
pwsh -File .\setup-agents.ps1 -Lang ko
```

실제 변경 없이 확인:

```powershell
pwsh -File .\setup-agents.ps1 -DryRun
```

사용법 확인 (파일을 만들지 않습니다):

```powershell
pwsh -File .\setup-agents.ps1 -Help   # -h로 축약 가능
```

## Linux

```bash
chmod +x ./setup-agents.sh
./setup-agents.sh
```

Claude, Kiro, Grok Build의 스킬 어댑터 방식:

```bash
# 심볼릭 링크 우선, 실패하면 복사
./setup-agents.sh --skill-mode auto

# 심볼릭 링크만 사용
./setup-agents.sh --skill-mode link

# 복사만 사용
./setup-agents.sh --skill-mode copy
```

표시 언어 선택 (기본은 OS 언어, 지원하지 않으면 영어):

```bash
./setup-agents.sh --lang en
./setup-agents.sh --lang ko
```

실제 변경 없이 확인:

```bash
./setup-agents.sh --dry-run
```

사용법 확인 (파일을 만들지 않습니다):

```bash
./setup-agents.sh --help   # -h도 동일
```

## 기존 파일 처리

다음 파일이 이미 있으면 그대로 보존합니다.

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.github/mcp.json
.github/copilot/settings.json
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
.vscode/mcp.json
opencode.jsonc
kilo.jsonc
```

`CLAUDE.md`와 `GEMINI.md`는 파일이 존재하더라도 agent-kit 관리 블록이 없으면
공통 지침 import 블록만 추가합니다.

## 선택 항목 설치기 (agent-installer)

플러그인·MCP·스킬·저장소 설정·design.md를 체크박스로 골라 설치/제거하는 콘솔
도구입니다. 체크하고 제출하면 설치되고, 다시 실행하면 실제 환경을 스캔해 설치된
항목이 미리 체크되어 표시되며, 체크를 해제하면 제거됩니다.

대화형 화면은 **검색칸 + 탭 목록**의 단일 리스트입니다. 작업·PLUGIN·MCP·
SKILL·CONFIG·DESIGN.MD 탭을 오가며 고르고, 마지막에 한 번 제출해
**일괄 적용**합니다.

포커스는 **검색칸**과 **목록** 두 곳을 오갑니다 — 타이핑하면 자연스럽게 검색칸으로
올라가고(입력 커서 `▌` 표시), `↓`를 누르면 목록으로 내려갑니다. 목록 맨 위에서
`↑`를 누르면 다시 검색칸으로 돌아갑니다. **`Space`의 뜻은 포커스가 가릅니다.**

| 키 | 하는 일 |
|---|---|
| 아무 글자 · `/` | 검색칸으로 올라가 검색 시작 (검색칸에서는 `Space`도 검색어 → **여러 단어 검색 가능**) |
| `↓` / `Enter` (검색칸) | 목록으로 내려간다 (첫 결과가 커서) |
| `↑` / `↓` / `PgUp` `PgDn` (목록) | 커서 이동. 맨 위에서 `↑`는 검색칸으로 복귀 |
| `Space` (목록) | 커서 항목 선택/해제 |
| `Tab` / `Shift+Tab` / `←` `→` | 탭 이동 (선택은 탭을 넘나들며 누적됩니다) |
| `Enter` (목록) | 작업 탭에서는 그 작업 실행, 그 밖에는 **제출**(검토 화면 → 일괄 적용) |
| `Ctrl+A` | 지금 탭에서 보이는 항목 전체 선택/해제 |
| `Ctrl+O` | 커서 항목 미리보기 (design.md는 브라우저) |
| `Ctrl+F` / `Ctrl+B` | CLI 필터를 앞 / 뒤로 돌리기 (전체 → CLI 하나씩 순환) |
| `Ctrl+D` | 상세 패널을 전체 화면으로 펼치기/접기 |
| `Esc` | 검색어 지우기 → 목록으로 → 한 번 더 누르면 종료 |

`Ctrl+F`·`Ctrl+B`·`Ctrl+D`는 검색칸·목록 어느 포커스에서도 통합니다 —
검색으로 좁힌 직후가 CLI 필터를 겹쳐 걸고 싶은 순간이기 때문입니다. `c`·`d`
같은 글자 키를 쓰지 않은 것은 의도적입니다: 목록 포커스에서 아무 글자나
누르면 검색칸으로 올라가므로, `c`를 필터에 배정하면 `codex`를 검색어로 칠
수 없게 됩니다.

- **항목마다 `CLI n/10`이 상태 바로 뒤에 붙습니다** — 그 항목이 지원 도구 10개
  가운데 몇 개에 실제로 배선되는지입니다. 전부 되는 항목도 `CLI 10/10`을
  찍습니다 — 표시가 없는 것과 "전부 된다"는 뜻이 다르기 때문입니다. CONFIG
  탭의 항목은 CLI 배선이 아니라 저장소 규약이라 이 표시가 없고, CLI 필터에도
  걸러지지 않습니다.
- **한 파일을 두고 다투는 항목은 하나만 켜집니다** — 커밋 템플릿의 영어판·
  한국어판이 그렇습니다. 하나를 켜면 형제가 자동으로 꺼지고(검색으로 가려져
  있어도 꺼집니다), `Ctrl+A` 전체 선택도 묶음에서 하나만 켭니다. 이미 고른
  판이 있으면 그 선택을 이깁니다.
- **목록 아래 상세 패널이 커서 항목의 전문을 폅니다** — 어느 CLI에 실제로
  배선됐는지(MCP는 설정 파일 경로까지), 안 된 CLI는 무엇이고 왜인지(같은
  사유끼리 묶어서 `미배선 9곳: codex·gemini·… — 사유`처럼), 항목의 note·
  설명까지 여러 줄로 보여 줍니다. 예전에는 이 전부가 한 줄 힌트에 이어 붙어
  80칸 터미널에서 뒤쪽이 통째로 잘렸습니다 — 그래서 힌트에는 상태와 커버리지만
  남기고 나머지는 패널로 옮겼습니다. 패널 높이는 **터미널 크기로만** 정해지고
  커서 위치와는 무관합니다 — 커서를 옮길 때마다 높이가 바뀌면 목록이
  출렁이기 때문입니다. 터미널이 낮으면 패널은 통째로 사라집니다. `Ctrl+D`로
  패널을 전체 화면까지 펼쳐 긴 배선표를 한 번에 볼 수 있습니다.
- **`Ctrl+F`/`Ctrl+B`로 CLI 필터를 걸면** 그 CLI에 배선되지 않는 항목이
  목록에서 통째로 빠집니다. 상세 패널의 배선표가 항목 하나를 깊이 보여
  준다면, 이 필터는 반대 방향에서 같은 질문("이 CLI에서 뭐가 되나")에
  답합니다.
- **탭 안쪽은 성격으로 묶입니다** — 토큰 절감 · 코드 이해 · 디자인 감각 ·
  작업 방식 · 외부 서비스 순으로 소분류 헤더가 붙고 개수가 함께 나옵니다.
  탭(PLUGIN·MCP·SKILL)은 "무엇으로 설치되는가"라 고를 때 비교가 되지 않습니다 —
  같은 탭에 토큰을 아끼는 것과 디자인을 봐 주는 것이 섞여 있기 때문입니다.
- 검색과 CLI 필터는 모두 활성 탭 안에서 걸리지만, **탭 줄에 탭별 적중 수**가
  함께 표시되어 다른 탭의 결과를 놓치지 않습니다(`DESIGN.MD 19/76`). 여러
  단어는 AND로 좁힙니다.
- 제출하면 적용 직전에 **무엇이 설치/보완/제거되는지 검토 화면**으로 확인한
  뒤 `Enter`로 일괄 적용합니다. 일부만 되는 항목은 이 화면에서도 커버리지를
  한 번 더 보여 줍니다. `Esc`로 되돌아갈 수 있습니다.
- **적용 중에는 진행 바가 실시간으로 돕니다** — 지금 실행 중인 항목과 명령,
  경과 시간, `완료/전체` 개수를 100ms 간격으로 갱신합니다. 외부 명령 실행이
  비동기라 이벤트 루프가 막히지 않으므로 경과 시간이 실제로 흐릅니다.
  `Ctrl+C`는 **중단을 요청**할 뿐입니다 — 지금 실행 중인 항목은 끝까지 마친
  뒤에 멈춥니다. 패키지 설치를 명령 중간에 죽이면 반쯤 설치된 상태가 남기
  때문입니다. 아직 시작하지 않았던 항목은 "건너뜀"으로 표시됩니다.
  건너뜀은 실패로 세지 않습니다 — 실패 집계와 종료 코드 모두에서 제외됩니다.
  의도적으로 멈춘 것과 무언가 잘못된 것은 다르기 때문입니다.
- **비대화형(`--set`)과 CI(비TTY)에서는 바 대신 평문 진행 줄**이 항목마다
  한 줄씩 나옵니다 — ANSI 제어 문자로 로그를 더럽히지 않기 위해서입니다.
- `Ctrl+A`는 **보이는 항목만** 건드립니다 — 화면 밖 설치본이 휩쓸리지 않습니다.

```bash
cd agent-installer && npm install && cd ..    # 최초 1회 (의존성 설치)

node agent-installer/install.mjs              # 대화형: 체크 = 설치, 해제 = 제거
node agent-installer/install.mjs --help       # 사용법 (design·bootstrap도 --help 지원)
node agent-installer/install.mjs --list       # 현재 상태만 출력
node agent-installer/install.mjs --set mcp.notion,plugin.bkit
                                              # 비대화형: 지정 집합을 목표 상태로
node agent-installer/install.mjs --set ""     # 전체 제거 (빈 값은 반드시 명시,
                                              #  값을 생략하면 오류로 종료)
node agent-installer/install.mjs --list --dry-run
                                              # --dry-run은 다른 플래그를 수식합니다.
                                              #  단독으로 주면 dry-run 상태의
                                              #  대화형 화면이 열립니다
node agent-installer/install.mjs --design-dir 사내=//nas/design --list
                                              # design.md 소스 추가 (반복 지정 가능)
node agent-installer/install.mjs --lang en    # 이번 실행만 표시 언어 지정
                                              #  (en|ko, 기본은 OS 언어 → 영어 순 폴백)
```

값을 받는 플래그는 `--set a,b`와 `--set=a,b` 두 형식을 모두 받습니다.
모르는 인자나 오타(`--dryrun`)는 조용히 무시하지 않고 사용법과 함께
오류로 종료합니다. 같은 이유로 동작을 고르는 플래그를 겹쳐 주는 것도
거부합니다 — 루트는 `--list`·`--set`, `design`은 `--list`·`--set`·
`--preview`·`--sync` 중 하나만 지정하세요(`--dry-run`·`--design-dir`처럼
동작을 수식하는 플래그는 함께 쓸 수 있습니다).

### 설치 가능한 항목

| 구분 | 항목 | 비고 |
|---|---|---|
| 플러그인 | `plugin.superpowers`, `plugin.bkit`, `plugin.mattpocock-skills` | Claude Code 플러그인 기구로 `--scope project` 설치. superpowers는 상류가 Codex·Antigravity 등 11개 하니스를 하니스별 설치로, bkit은 Codex·Gemini를 별도 배포판(bkit-codex·bkit-gemini)으로 지원하지만 이 항목이 배선하는 것은 Claude 판뿐입니다 — CLI별 사유는 상세 패널에 표시. claude 명령이 없으면 `.claude/settings.json`에 기록만 하고 다음 Claude Code 실행 시 다운로드됩니다 |
| 플러그인 | `plugin.ponytail` | Claude Code 플러그인과 OpenCode `opencode.jsonc`의 `plugin` 배열에 동시 배선(둘 다 프로젝트 스코프). 기존 `plugin` 항목은 보존하고 끝에만 덧붙입니다. 나머지 CLI는 상류 설치가 사용자 스코프이거나(Codex·Copilot·Gemini) 플러그인 기구가 없어 항목 note에 사유를 표시합니다 |
| MCP | `mcp.notion`, `mcp.supabase`, `mcp.vercel` | 원격 URL을 10개 CLI 프로젝트 설정에 동시 등록. 인증(OAuth)은 각 CLI 첫 사용 시 진행되며 시크릿은 커밋되지 않습니다 |
| MCP | `mcp.codebase-memory` | stdio 방식 — PATH에 `codebase-memory-mcp` 바이너리가 필요합니다 (미설치 시 항목 note에 설치 안내 표시) |
| MCP | `mcp.graphify` | stdio 방식 — PATH에 `graphify-mcp`가 필요합니다 (`uv tool install "graphifyy[mcp]"`). 인자 없이 실행 디렉터리의 `graphify-out/graph.json`을 읽으므로 그래프도 저장소 안에 남습니다 |
| MCP | `mcp.headroom` | stdio 방식 — PATH에 `headroom`이 필요합니다 (`uv tool install --python 3.13 "headroom-ai[proxy,mcp]"`). 상류 `server.json`과 같은 `headroom mcp serve` 계약으로 등록합니다 |
| 플러그인 | `plugin.ecc`, `plugin.impeccable`, `plugin.understand-anything` | Claude Code 마켓플레이스 플러그인, `--scope project`. 세 도구 모두 다른 CLI용 설치 경로가 있지만 사용자 스코프이거나(ECC·Understand Anything) 이 저장소의 `.agents/skills` 연결을 끊어서(impeccable) 쓰지 않습니다 — 항목 note에 사유가 나옵니다 |
| 스킬 | `skill.caveman`, `skill.taste`, `skill.karpathy` | `npx skills add … --agent universal --copy`로 공유 `.agents/skills`에 **복사**합니다. 그 경로를 10개 CLI가 함께 보므로 한 번 설치로 전부 적용되고, 커밋해서 팀과 나눌 수 있습니다 |
| 스킬 | `skill.gsd` | `npx @opengsd/gsd-core --claude --local` 프로젝트 로컬 설치. 상류는 `--codex`·`--antigravity` 등 18개 런타임을 지원하지만 이 항목은 `--claude`만 배선합니다 |
| 스킬 | `skill.gstack` | 저장소 내부 `.claude/skills/gstack`에 clone + setup (bash 필요, `.gitignore` 자동 처리). 상류 setup은 `--host`로 Codex·Kiro·OpenCode도 지원하지만 이 항목은 기본값(Claude)으로만 실행합니다 |
| 설정 | `config.gitmessage.en`, `config.gitmessage.ko` | 커밋 메시지 템플릿 `.gitmessage.txt`를 저장소 루트에 쓰고 `git config --local commit.template`이 그것을 가리키게 합니다. **영어판과 한국어판 중 하나만** 고를 수 있습니다 — 대상 파일이 하나라 둘을 함께 켜면 나중 것이 앞선 것을 덮어쓰기 때문입니다(TUI는 형제를 자동으로 끄고, `--set`에 둘 다 주면 오류로 거절합니다). 도구가 쓴 두 판 사이의 전환만 덮어쓰기로 보고, 손으로 쓴 템플릿이 이미 있으면 거절합니다 |

### 동작 원칙

- **실제 상태의 근거는 스캔입니다** — 실행할 때마다 실제 설정 파일을 스캔해
  판정하므로 수동으로 설치·제거해도 항상 정확히 반영됩니다.
- **설치 기록(`.agent-kit/agent-setup.json`)은 의도입니다** — 어느 버전으로
  배선했는지, 어떤 항목을 고르려 했는지, 관리 파일이 우리가 쓴 그대로인지를
  담습니다. 판정을 대체하지 않고 재현성과 버전 고정을 더합니다. 커밋 대상이라
  팀원이 같은 결과를 얻습니다.
- `status`가 둘의 차이를 `기록에만 있음` / `저장소에만 있음`으로 보여줍니다.
- 일부 CLI에만 등록된 MCP는 `(일부 설치됨)`으로 표시되고, 체크를 유지한 채
  Submit하면 누락된 CLI에만 보완 설치됩니다.
- MCP 항목이 쓰는 파일은 CLI별로 다릅니다 — `.mcp.json`(Claude Code),
  `.codex/config.toml`, `.gemini/settings.json`, `opencode.jsonc`,
  `.kilocode/mcp.json`(Kilo Code), `.kiro/settings/mcp.json`,
  `.kimi-code/mcp.json`, `.grok/config.toml`, `.github/mcp.json`(Copilot CLI),
  `.vscode/mcp.json`. 이 가운데 `.mcp.json`과 `.kilocode/mcp.json`은
  부트스트랩이 만들지 않으므로 MCP를 처음 고를 때 새로 생깁니다(둘 다 커밋
  대상입니다).
- 기존 설정 파일의 다른 키·주석은 보존하며, 변경 내용은 `git diff`로
  확인할 수 있습니다.
- 새 항목 추가 = `agent-installer/lib/items/`에 파일 1개
  (`defineMcp`/`definePlugin`/`defineSkill` 팩토리 사용, MCP는 5줄이면 충분).
- `agent-installer/` 폴더는 자기완결이라 다른 저장소에 복사해도 동작합니다.

### design.md 라이브러리

AI 에이전트가 읽어 일관된 UI를 생성하는 DESIGN.md 문서를
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md)에서 골라
`design-md/<제공자>/<이름>/DESIGN.md`로 내려받고, 동기화하고, 브라우저
미리보기로 확인합니다. 다운로드본은 git 커밋 대상이라 팀과 공유됩니다.
목록·캐시·설치 경로가 모두 제공자별로 스코프되어, 같은 이름을 여러 제공자에서
받아도 충돌 없이 공존합니다.

**여러 개를 동시에 설치할 수 있습니다.** 설치 경로가 `제공자/이름`으로
갈라지므로 몇 개를 받아도 서로 덮어쓰지 않습니다. DESIGN.MD 탭 안에서는
카테고리별로 묶여 보이고, 분류가 없는 항목은 `기타`로 맨 뒤에 모입니다.

**동봉 번들의 라이선스.** 오프라인 설치를 위해 awesome-design-md의 DESIGN.md
사본을 패키지에 함께 담습니다. 상류는 MIT이며, MIT는 재배포를 허용하되 사본에
저작권 고지와 허가 문구를 함께 담을 것을 요구합니다. 그 원문을
`agent-installer/lib/design-md/cache/awesome-design-md/LICENSE.md`에 두었고,
발행물에서 빠지지 않도록 pack 검사가 파일 존재와 내용을 함께 확인합니다.

동기화·카탈로그 갱신은 **작업 탭**의 항목을 `Enter`로 실행합니다.

```bash
node agent-installer/install.mjs design --list        # 카탈로그 + 설치 상태
node agent-installer/install.mjs design --set stripe,vercel   # 목표 집합 설치
node agent-installer/install.mjs design --preview stripe      # getdesign.md 미리보기 오픈
node agent-installer/install.mjs design --sync=installed  # 설치본을 원본 최신으로
node agent-installer/install.mjs design --sync=catalog   # 사용 가능 목록·카테고리 갱신
node agent-installer/install.mjs design --sync=stale     # 원본과 달라진 설치본 감지
```

- 미리보기는 `https://getdesign.md/<이름>/design-md` 페이지를 OS 기본 브라우저로
  엽니다(사이트 자체 라이트/다크 제공, 다운로드 불필요).
- 카탈로그는 `agent-installer/lib/design-md/catalog.json`에 캐시되어 오프라인에서도
  즉시 동작하며, `--sync=catalog`(또는 동기화 메뉴)로 갱신합니다.
- **오프라인 번들**: 76개 DESIGN.md가 `agent-installer/lib/design-md/cache/<제공자>/`에
  동봉되어 설치 시 네트워크 없이 즉시 복사됩니다(번들에 없으면 네트워크 폴백).
  `--sync=installed`와 오래된 항목 업데이트는 번들을 건너뛰고 원본 최신을 받습니다.
  번들 재생성은 `cd agent-installer && npm run refresh-bundle`.
- **중복 처리**: `--set`·`--preview`는 `이름` 또는 `제공자/이름`을 받습니다. 같은 이름이
  여러 제공자에 있으면 `제공자/이름`으로 지정해야 합니다.
- 소스 추가 = `agent-installer/lib/design-md/providers/`에 프로바이더 1개 등록.
  다만 아래처럼 **디렉터리만 놓아도** 프로바이더 없이 목록에 오릅니다.

#### 사내 오프라인 DESIGN.md 포함하기

프로바이더 코드를 쓰지 않고 **디렉터리 구조만으로** 검색·리스트업됩니다.
`DESIGN.md`가 든 폴더가 곧 하나의 항목이고, 그 위 경로가 카테고리입니다.

```text
<소스>/<카테고리…>/<이름>/DESIGN.md
```

두 가지 방법 중 편한 쪽을 쓰면 됩니다.

```bash
# 1) 번들 캐시에 그대로 넣기 — 인스톨러를 복사하면 함께 따라갑니다
agent-installer/lib/design-md/cache/사내/핀테크/checkout/DESIGN.md

# 2) 외부 경로 지정 — 사내 공유 드라이브·별도 저장소를 그대로 연결
node agent-installer/install.mjs design --list --design-dir 사내=//nas/design
export AGENT_INSTALLER_DESIGN_MD_DIRS="사내=//nas/design"   # 경로 구분자: Windows `;`, POSIX `:`
```

- 파일명은 `DESIGN.md`·`design.md` 어느 쪽이든 됩니다(대소문자 무시).
- 라벨·카테고리·설명은 **경로 + 파일 내용**에서 자동으로 채웁니다. frontmatter의
  `title`/`name`/`category`/`description`이 있으면 우선하고(디자인 토큰이 담긴 수 KB짜리
  frontmatter도 읽습니다), 없으면 첫 제목이 라벨, 첫 문단이 설명, 중간 경로가
  카테고리(없으면 `사내`)가 됩니다.
- 같은 이름이 카테고리만 다르게 있으면(`웹/버튼`, `모바일/버튼`) 뒤에 온 쪽에
  카테고리를 접두사로 붙여(`웹-버튼`) 둘 다 보존하고 그 사실을 알립니다.
- 로컬 정의는 네트워크를 쓰지 않습니다. 설치는 파일 복사이고, `--sync=installed`도
  같은 디렉터리를 원본으로 삼습니다. getdesign.md 페이지가 없으므로 미리보기는
  안내만 표시합니다.
- `--design-dir <경로>`처럼 이름을 생략하면 폴더명이 소스 id가 되고, 겹치거나
  등록된 제공자 id와 충돌하면 `-2` 같은 접미사가 붙습니다(사내 항목이 외부
  네트워크로 새지 않도록). `--sync=catalog`는 원격 제공자만 갱신하므로
  사내 항목을 지우지 않습니다.

## 팀 저장소에 넣을 파일

`npx @rch4com/agent-setup`을 쓰면 설치기 자체를 커밋할 필요가 없습니다. 커밋 대상은
배선 결과물뿐입니다.

```text
AGENTS.md
CLAUDE.md
GEMINI.md
.agents/skills/
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.github/mcp.json
.github/copilot/settings.json
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
.vscode/mcp.json
.vscode/settings.json
opencode.jsonc
kilo.jsonc
```

오프라인 환경이거나 커밋된 진입점이 필요하면 `setup-agents.ps1`,
`setup-agents.sh`, `agent-installer/`(node_modules 제외)를 함께 커밋하는
기존 방식도 그대로 동작합니다.

설치기로 MCP 항목을 등록하면 여기에 `.mcp.json`과 `.kilocode/mcp.json`이
더해집니다 — 부트스트랩이 만들지 않는 두 파일이며, 나머지 MCP 파일과 같이
팀과 공유하는 커밋 대상입니다.

`.claude/skills`, `.kiro/skills`, `.grok/skills`가 로컬 Junction 또는 심볼릭
링크라면 Git과 운영체제에 따라 다르게 처리될 수 있습니다(Windows에서 git은
Junction을 일반 디렉터리로 취급해 스킬이 중복 커밋됩니다). 이를 막기 위해
스크립트가 세 어댑터 경로를 `.gitignore`에 자동 추가합니다. 즉
`.agents/skills`만 커밋하고 각 개발자가 bootstrap 스크립트를 실행해
어댑터들을 만드는 방식입니다.
