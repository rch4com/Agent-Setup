# Repository-local AI agent bootstrap

Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro를 한 저장소에서
함께 사용할 때 공통 지침과 공통 Agent Skills를 **저장소 범위로만**
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
├─ .kiro/
│  ├─ skills/          # .agents/skills 링크 또는 관리되는 복제본
│  └─ settings/
│     └─ mcp.json
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

## 안전 원칙

- 반드시 Git 저장소 안에서만 실행됩니다.
- `git rev-parse --show-toplevel`로 저장소 루트를 찾습니다.
- 저장소 루트 밖의 경로에는 쓰기를 거부합니다.
- 홈 디렉터리의 글로벌 설정을 읽거나 수정하지 않습니다.
- 기존 설정 파일은 덮어쓰지 않습니다.
- `CLAUDE.md`와 `GEMINI.md`에는 관리 블록이 없을 때만 추가합니다.
- 기존 `.claude/skills` 또는 `.kiro/skills`가 사용자 관리 경로이면 보존합니다.
- `.claude/skills`와 `.kiro/skills`를 `.gitignore`에 추가해
  어댑터(링크/복제본)가 커밋되지 않도록 합니다.
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

Claude와 Kiro의 스킬 어댑터 방식:

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

Claude와 Kiro의 스킬 어댑터 방식:

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
.kiro/settings/mcp.json
opencode.jsonc
kilo.jsonc
```

`CLAUDE.md`와 `GEMINI.md`는 파일이 존재하더라도 agent-kit 관리 블록이 없으면
공통 지침 import 블록만 추가합니다.

## 팀 저장소에 넣을 파일

```text
setup-agents.ps1
setup-agents.sh
AGENTS.md
CLAUDE.md
GEMINI.md
.agents/skills/
.claude/settings.json
.codex/config.toml
.gemini/settings.json
.kiro/settings/mcp.json
opencode.jsonc
kilo.jsonc
```

`.claude/skills`와 `.kiro/skills`가 로컬 Junction 또는 심볼릭 링크라면 Git과
운영체제에 따라 다르게 처리될 수 있습니다(Windows에서 git은 Junction을 일반
디렉터리로 취급해 스킬이 중복 커밋됩니다). 이를 막기 위해 스크립트가 두
어댑터 경로를 `.gitignore`에 자동 추가합니다. 즉 `.agents/skills`만 커밋하고
각 개발자가 bootstrap 스크립트를 실행해 두 어댑터를 만드는 방식입니다.
