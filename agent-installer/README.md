# agent-setup

Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code,
Grok Build, Antigravity, GitHub Copilot CLI, VS Code Copilot을 **한 저장소에서
함께** 쓰기 위한 저장소 범위 부트스트랩과 선택 항목 설치기입니다.

공통 지침은 루트 `AGENTS.md` 하나, 공통 스킬은 `.agents/skills` 하나로 두고,
도구별 설정 파일만 각 도구가 읽는 위치에 만듭니다.

## 사용법

Git 저장소 안에서 실행합니다.

```bash
# 배선 — 공통 지침·스킬·도구별 설정 파일을 만든다
npx @rch4com/agent-setup bootstrap

# 무엇이 만들어질지만 확인한다
npx @rch4com/agent-setup bootstrap --dry-run

# 플러그인·MCP·스킬·DESIGN.md를 골라 설치하는 대화형 화면
npx @rch4com/agent-setup
```

설치하면 실행 명령은 `agent-setup`으로 짧아집니다. 이름에 스코프가 붙은 것은
스코프 없는 `agent-setup`이 npm의 유사 이름 제한에 걸리기 때문입니다.

## 안전 원칙

- 반드시 Git 저장소 안에서만 실행되며, 저장소 루트 밖에는 쓰지 않습니다.
- 홈 디렉터리의 글로벌 설정을 읽거나 수정하지 않습니다.
- 기존 설정 파일을 덮어쓰지 않습니다.
- 반복 실행할 수 있습니다.

## 요구 사항

Node.js 20 이상.

## 문서

생성되는 구조, 도구별 연결 방식, 설치 가능한 항목, DESIGN.md 라이브러리 등
상세 문서는 GitHub에 있습니다.

- [사용법과 생성 구조](https://github.com/rch4com/Agent-Setup/blob/main/AgentSetup-README.md)
- [저장소](https://github.com/rch4com/Agent-Setup)

## 라이선스

MIT
