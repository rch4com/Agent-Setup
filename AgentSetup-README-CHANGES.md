# 변경 이력

최신 항목이 위에 옵니다. 상세 사용법은 `AgentSetup-README.md`를 참조하세요.

## Matt Pocock skills 플러그인 항목 (2026-07-17)

- agent-installer에 `plugin.mattpocock-skills` 추가 — Claude Code
  마켓플레이스 `mattpocock/skills`에서 `mattpocock-skills@mattpocock`
  플러그인(엔지니어링·생산성 스킬 22종)을 프로젝트 범위로 설치.

## Grok Build 지원 (2026-07-17)

- Grok Build(xAI grok CLI)를 지원 도구에 추가.
  루트 `AGENTS.md`를 네이티브로 읽으므로 import 배선이 필요 없음.
- 프로젝트 설정 `.grok/config.toml` 생성
  (프로젝트 스코프는 mcp_servers·plugins·permission rules만).
- `.grok/skills`를 `.agents/skills`의 Junction/링크/복제본으로 구성하고
  `.gitignore`에 자동 추가.
- agent-installer에 grok MCP 어댑터 추가 — MCP 항목이 8개 CLI
  프로젝트 설정에 동시 등록됨.
- 공식 MiniMax CLI(`mmx`)는 코딩 에이전트가 아니어서(프로젝트 규약
  없음) 지원 대상에서 제외. 스킬 설치 항목도 검토 후 롤백함.

## agent-installer 추가 (2026-07-17)

- 플러그인·MCP·스킬을 체크박스로 골라 설치/제거하는 자기완결 콘솔
  도구 `agent-installer/` 추가. 상태 파일 없이 실제 설정 파일을
  스캔해 판정하며 `--list`, `--dry-run`, `--set` 비대화형 모드 지원.

## Kimi Code 지원

- 루트 `AGENTS.md`와 `.agents/skills`를 네이티브로 사용.
- 프로젝트 MCP 파일 `.kimi-code/mcp.json` 생성.
- 머신별 설정 `.kimi-code/local.toml`을 `.gitignore`에 추가.

## Kilo Code / Kiro 지원

- 프로젝트 로컬 `kilo.jsonc`와 `.kiro/settings/mcp.json` 생성.
- `.kiro/skills`를 `.agents/skills`의 Junction/링크/복제본으로 구성.
- 사용자 홈이나 전역 에이전트 설정은 쓰지 않음.
