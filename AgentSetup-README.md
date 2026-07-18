# Repository-local AI agent bootstrap

Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code,
Grok Build(xAI grok CLI), Antigravity(Google 에이전트 IDE/CLI)를 한
저장소에서 함께 사용할 때 공통 지침과 공통 Agent Skills를 **저장소 범위로만**
초기화하는 스크립트입니다.

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
├─ .grok/
│  ├─ config.toml
│  └─ skills/          # .agents/skills 링크 또는 관리되는 복제본
├─ .kiro/
│  ├─ skills/          # .agents/skills 링크 또는 관리되는 복제본
│  └─ settings/
│     └─ mcp.json
├─ .kimi-code/
│  └─ mcp.json
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
  프로젝트 로컬 `kilo.jsonc`를 생성합니다.
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

## 안전 원칙

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
- 반복 실행할 수 있습니다.

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

실제 변경 없이 확인:

```powershell
pwsh -File .\setup-agents.ps1 -DryRun
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

실제 변경 없이 확인:

```bash
./setup-agents.sh --dry-run
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
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
opencode.jsonc
kilo.jsonc
```

`CLAUDE.md`와 `GEMINI.md`는 파일이 존재하더라도 agent-kit 관리 블록이 없으면
공통 지침 import 블록만 추가합니다.

## 선택 항목 설치기 (agent-installer)

플러그인·MCP·스킬을 체크박스로 골라 설치/제거하는 콘솔 도구입니다.
체크하고 Submit하면 설치되고, 다시 실행하면 실제 환경을 스캔해 설치된
항목이 미리 체크되어 표시되며, 체크를 해제하면 제거됩니다.
대화형으로 실행하면 첫 화면에서 **에이전트 설치**와 **design.md 라이브러리**
중 무엇을 관리할지 먼저 고릅니다.

```bash
cd agent-installer && npm install && cd ..    # 최초 1회 (의존성 설치)

node agent-installer/install.mjs              # 대화형: 체크 = 설치, 해제 = 제거
node agent-installer/install.mjs --list       # 현재 상태만 출력
node agent-installer/install.mjs --dry-run    # 변경 없이 수행 내용 확인
node agent-installer/install.mjs --set mcp.notion,plugin.bkit
                                              # 비대화형: 지정 집합을 목표 상태로
node agent-installer/install.mjs --set ""     # 전체 제거 (빈 값은 반드시 명시,
                                              #  값을 생략하면 오류로 종료)
```

### 설치 가능한 항목

| 구분 | 항목 | 비고 |
|---|---|---|
| 플러그인 | `plugin.superpowers`, `plugin.bkit`, `plugin.mattpocock-skills` | Claude Code 전용, `--scope project` 설치. claude 명령이 없으면 `.claude/settings.json`에 기록만 하고 다음 Claude Code 실행 시 다운로드됩니다 |
| MCP | `mcp.notion`, `mcp.supabase`, `mcp.vercel` | 원격 URL을 8개 CLI 프로젝트 설정에 동시 등록. 인증(OAuth)은 각 CLI 첫 사용 시 진행되며 시크릿은 커밋되지 않습니다 |
| MCP | `mcp.codebase-memory` | stdio 방식 — PATH에 `codebase-memory-mcp` 바이너리가 필요합니다 (미설치 시 항목 note에 설치 안내 표시) |
| 스킬 | `skill.gsd` | `npx @opengsd/gsd-core --claude --local` 프로젝트 로컬 설치 |
| 스킬 | `skill.gstack` | 저장소 내부 `.claude/skills/gstack`에 clone + setup (bash 필요, `.gitignore` 자동 처리) |

### 동작 원칙

- 상태 파일이 없습니다 — 실행할 때마다 실제 설정 파일을 스캔해 판정하므로
  수동으로 설치·제거해도 항상 정확히 반영됩니다.
- 일부 CLI에만 등록된 MCP는 `(일부 설치됨)`으로 표시되고, 체크를 유지한 채
  Submit하면 누락된 CLI에만 보완 설치됩니다.
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

대화형 흐름: **카테고리(탭)로 둘러보기 · 이름/키워드 검색 · 미리보기(브라우저)
· 동기화** 중에서 고릅니다. 검색·카테고리 화면은 보이는 목록 안에서만
설치/제거를 반영하므로 화면 밖 항목을 실수로 지우지 않습니다.

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
- **오프라인 번들**: 74개 DESIGN.md가 `agent-installer/lib/design-md/cache/<제공자>/`에
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

```text
setup-agents.ps1
setup-agents.sh
agent-installer/          # node_modules 제외 (.gitignore 처리됨)
AGENTS.md
CLAUDE.md
GEMINI.md
.agents/skills/
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.grok/config.toml
.kiro/settings/mcp.json
.kimi-code/mcp.json
opencode.jsonc
kilo.jsonc
```

`.claude/skills`, `.kiro/skills`, `.grok/skills`가 로컬 Junction 또는 심볼릭
링크라면 Git과 운영체제에 따라 다르게 처리될 수 있습니다(Windows에서 git은
Junction을 일반 디렉터리로 취급해 스킬이 중복 커밋됩니다). 이를 막기 위해
스크립트가 세 어댑터 경로를 `.gitignore`에 자동 추가합니다. 즉
`.agents/skills`만 커밋하고 각 개발자가 bootstrap 스크립트를 실행해
어댑터들을 만드는 방식입니다.
