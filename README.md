# Agent-Setup

멀티 CLI 코딩 에이전트(Claude Code, Codex, Gemini CLI, OpenCode,
Kilo Code, Kiro, Kimi Code, Grok Build, Antigravity, GitHub Copilot CLI,
VS Code Copilot)를 한 저장소에서 함께 쓰기 위한 저장소 범위 부트스트랩
스크립트와 선택 항목 설치기입니다.

- 사용법·생성 구조·안전 원칙: [AgentSetup-README.md](AgentSetup-README.md)
- 변경 이력: [AgentSetup-README-CHANGES.md](AgentSetup-README-CHANGES.md)

## 빠른 시작

Git 저장소 안에서 실행합니다. 파일을 복사할 필요가 없습니다.

```bash
npx @rch4com/agent-setup bootstrap            # 배선
npx @rch4com/agent-setup bootstrap --dry-run  # 무엇이 만들어질지만 확인
npx @rch4com/agent-setup                      # 플러그인·MCP·스킬·design.md 선택 화면
```

한 번 설치하면 실행 명령은 `agent-setup`으로 짧아집니다.

저장소에 런처를 두고 쓰고 싶다면 `setup-agents.sh`·`setup-agents.ps1`을
복사하는 방식도 그대로 동작합니다.

```powershell
pwsh -File .\setup-agents.ps1   # Windows
```

```bash
./setup-agents.sh               # Linux / macOS
```
