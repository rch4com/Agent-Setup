# 변경 이력

최신 항목이 위에 옵니다. 상세 사용법은 `AgentSetup-README.md`를 참조하세요.

## Antigravity 지원 (2026-07-18)

- Antigravity(Google 에이전트 IDE/CLI)를 지원 도구에 추가.
  루트 `AGENTS.md`와 `.agents/` 디렉터리를 네이티브로 인식하므로
  기존 공유 `AGENTS.md`·`.agents/skills`를 그대로 사용 —
  import 배선·어댑터·신규 파일이 필요 없음.
- MCP는 홈 글로벌(`~/.gemini/config/mcp_config.json`)에서만 설정되고
  프로젝트 스코프 MCP 파일이 없어 스크립트 관리 범위 밖 →
  agent-installer의 프로젝트 MCP 등록 대상에서도 제외.
- 생성 문서 문구와 완료 요약의 도구 목록에만 반영(구조 변화 없음).
- 프로젝트 루트 `.mcp.json` 적용 요청은 반려 — Google 공식 포럼 확인 결과
  Antigravity는 프로젝트 스코프 MCP를 미지원(기능 요청 상태)이며 루트
  `.mcp.json`을 읽지 않음(해당 주장은 비공식 brain 노트의 오류).

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
