# Agent-Setup

멀티 CLI 코딩 에이전트(Claude Code, Codex, Gemini CLI, OpenCode,
Kilo Code, Kiro, Kimi Code, Grok Build, Antigravity)를 한 저장소에서 함께
쓰기 위한 저장소 범위 부트스트랩 스크립트와 선택 항목 설치기입니다.

- 사용법·생성 구조·안전 원칙: [AgentSetup-README.md](AgentSetup-README.md)
- 변경 이력: [AgentSetup-README-CHANGES.md](AgentSetup-README-CHANGES.md)

## 빠른 시작

```powershell
# Windows
pwsh -File .\setup-agents.ps1
```

```bash
# Linux / macOS
./setup-agents.sh
```

```bash
# 플러그인·MCP·스킬 선택 설치 + design.md 라이브러리 (최초 1회 npm install 필요)
node agent-installer/install.mjs
```
