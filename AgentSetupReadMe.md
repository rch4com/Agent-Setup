# Repository-local AI agent bootstrap

Claude Code, Codex, Gemini CLI, OpenCode를 한 저장소 안에서 함께 사용할 때
공통 지침과 공통 Agent Skills를 **저장소 범위로만** 초기화하는 스크립트입니다.

## 생성되는 구조

```text
repository/
├─ AGENTS.md
├─ CLAUDE.md
├─ GEMINI.md
├─ opencode.jsonc
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
└─ .agent-kit/
   └─ README.md
```

## 안전 원칙

- 반드시 Git 저장소 안에서만 실행됩니다.
- `git rev-parse --show-toplevel`로 저장소 루트를 찾습니다.
- 저장소 루트 밖의 경로에는 쓰기를 거부합니다.
- 홈 디렉터리의 글로벌 설정을 읽거나 수정하지 않습니다.
- 기존 설정 파일은 덮어쓰지 않습니다.
- `CLAUDE.md`와 `GEMINI.md`에는 관리 블록이 없을 때만 추가합니다.
- 반복 실행할 수 있습니다.

## Windows

이 파일들을 저장소의 아무 위치에 두고 PowerShell에서 실행합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-agents.ps1
```

PowerShell 7을 사용한다면:

```powershell
pwsh -File .\setup-agents.ps1
```

Claude 스킬 어댑터 방식:

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

Claude 스킬 어댑터 방식:

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

## 동작 방식

- Codex, Gemini CLI, OpenCode는 공통 스킬 원본인 `.agents/skills`를 사용합니다.
- Claude Code에는 `.claude/skills` 어댑터를 만듭니다.
- `CLAUDE.md`는 `AGENTS.md`를 가져옵니다.
- `GEMINI.md`도 `AGENTS.md`를 가져옵니다.
- 기존 `AGENTS.md` 또는 도구별 설정이 있으면 그대로 보존합니다.

## 팀 저장소에 넣을 파일

두 스크립트와 생성된 공통 설정을 저장소에 커밋하는 방식을 권장합니다.

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
opencode.jsonc
```

`.claude/skills`가 로컬 Junction 또는 심볼릭 링크라면 Git 처리 방식은 팀 환경에
따라 다를 수 있습니다. 가장 이식성 높은 운영 방식은 `.agents/skills`만 커밋하고,
각 개발자가 bootstrap 스크립트를 실행해 `.claude/skills`를 만드는 것입니다.
