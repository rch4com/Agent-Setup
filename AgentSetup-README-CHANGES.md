# 변경 이력

최신 항목이 위에 옵니다. 상세 사용법은 `AgentSetup-README.md`를 참조하세요.

## npm 발행 (2026-07-30)

파일을 복사하지 않고 쓸 수 있게 됐다. 설치기를 `agent-setup`과
`@rch4com/agent-setup` 두 이름으로 npm에 발행하며, 소스는 하나이고 발행
시점에 `name`만 바꾼다 — 래퍼 패키지를 두면 npx가 tarball을 두 번 받고
버전 고정 의미가 흐려진다.

- **`npx agent-setup bootstrap`으로 배선.** 기존 명령(`bootstrap`,
  `--list`, `--set`, `design`)이 그대로 동작한다. 이 단계에서 CLI 표면은
  바뀌지 않았다.
- **팀 저장소 커밋 대상에서 벤더링이 빠졌다.** `agent-installer/`와 런처 2개는
  선택 사항이 됐다. 오프라인 환경이나 커밋된 진입점이 필요하면 기존처럼
  함께 커밋하는 방식도 그대로 동작한다.
- **tarball 내용물을 테스트가 지킨다.** 발행은 되돌릴 수 없으므로 최상위 경로
  화이트리스트, `test/`·`scripts/` 누출 금지, DESIGN.md 번들 존재, 2MiB
  상한을 `npm pack --dry-run --json`으로 검사한다. 실측 tarball은 0.58MB라
  76개 DESIGN.md 번들을 그대로 동봉한다.
- **MIT 라이선스 추가.** `files`가 패키지 디렉터리 밖에 닿을 수 없어 루트와
  `agent-installer/`에 사본을 두고, 두 파일이 갈라지지 않도록 동일성을
  테스트로 묶었다.

## 2차 점검 반영 (2026-07-30)

앞선 점검에서 남았던 항목을 반영. 동작이 바뀐 것은 아래 넷.

- **MCP·플러그인 쓰기 경로의 링크 이탈 검사.** 부트스트랩·design.md·gstack만
  realpath 검사를 하고 있었고, 정작 가장 넓은 쓰기 경로인 10개 CLI의 MCP
  등록·제거와 `.claude/settings.json` 플러그인 기록이 어휘적 검사에 머물러
  있었다. 저장소 안 `.codex`·`.claude`가 홈을 가리키는 Junction이면 항목
  하나를 고르는 것으로 글로벌 설정이 생성·수정됐다.
- **Windows 셸 인용.** 공백이 있을 때만 감싸던 것을 항상 감싸도록 바꿨다.
  `D:\R&D\repo` 아래에서는 gstack clone 명령이 `&`에서 둘로 쪼개졌다.
  POSIX 쪽도 작은따옴표로 바꿔 `$(...)`·백틱까지 막는다.
- **원격 응답 크기 상한(8MiB).** 시간 제한은 "데이터가 계속 오는" 응답을
  막지 못해, 끝나지 않는 본문을 메모리가 다 찰 때까지 읽었다. 번들 재생성
  스크립트도 맨 `fetch`에서 `netFetch`로 옮겨 두 제한을 함께 받는다.
- **상호 배타 플래그 거부.** `--list --set a`는 `--set`을, `design --preview x
  --set y`는 `--set`을 조용히 버렸다. 모르는 인자를 거부하는 것과 같은 이유로
  거부한다.

그 밖에 화면에 나가는 원격 텍스트에서 bidi 오버라이드·폭 없는 유니코드
서식문자를 함께 걷어내고, 미사용 의존성 `@clack/prompts`를 지웠으며(TUI는 Node
표준 라이브러리만 쓴다), 문서에 없던 `.kilocode/mcp.json`과 번들 개수(76)를
바로잡았다.

## 코드·문서 점검 반영 (2026-07-29)

전체 점검에서 나온 항목을 반영. 동작이 바뀐 것은 아래 넷.

- **미리보기 명령 주입 차단.** Windows 오프너가 `cmd /c start`를 써서,
  원격 README에서 온 이름에 `&`가 섞이면 그대로 명령이 실행됐다. webUrl
  인코딩 + 카탈로그 이름 검증 + 셸을 거치지 않는 rundll32로 세 겹을 막고,
  http(s) URL이나 실제로 존재하는 경로만 열도록 제한.
- **`.vscode/settings.json` 부정 항목 추가.** `chat.useAgentsMdFile`이 사는
  파일인데 `.vscode/*`를 무시하는 저장소에서 커밋되지 않아 팀에 전파되지
  않았다.
- **인자 처리.** 루트·design 파서가 모르는 인자를 무시하던 것을 거부로
  바꾸고, 값 플래그가 `--flag=값` 형식도 받도록 통일. 루트에 `--help`를
  붙이고, 버려지던 `--skill-mode`를 대화형 화면까지 전달.
- **설치기 쓰기 경로의 링크 이탈 검사.** design.md 설치·제거, gstack
  clone·삭제, `.gitignore` 쓰기가 어휘적 검사만 하고 있었다.

그 밖에 dry-run이 MCP·design.md 변경을 보고하도록 하고, 네트워크 호출에
20초 제한을 걸었으며, 원격 텍스트의 제어문자를 화면에 내보내지 않도록 했다.
문서는 `--tui` 명칭, Copilot의 stdio MCP 형식 차이, 설치기가 실행하는
제3자 명령을 바로잡거나 새로 적었다.

## GitHub Copilot 지원 (2026-07-29)

- GitHub Copilot CLI와 VS Code Copilot을 지원 도구에 추가. 두 도구 모두
  루트 `AGENTS.md`와 `.agents/skills`를 네이티브로 읽어 import 배선과
  스킬 어댑터가 필요 없음.
- 프로젝트 MCP는 Copilot CLI가 `.github/mcp.json`(`mcpServers`, 로컬 서버는
  `type: "local"`), VS Code가 `.vscode/mcp.json`(`servers`, 로컬 서버는
  `type: "stdio"`). 설치기의 MCP 등록 대상이 8개에서 10개로 늘어남.
- 팀 공유 설정 자리로 `.github/copilot/settings.json`을 만들고, 개인
  오버라이드 `.github/copilot/settings.local.json`은 `.gitignore` 처리.
- VS Code는 `chat.useAgentsMdFile` 설정이 있어야 `AGENTS.md`를 읽으므로
  `.vscode/settings.json`에 키가 없을 때만 추가(기존 값은 보존).
  이를 위해 부트스트랩에 `ensureJsonKeys` 실행기를 추가 — 외부 의존성
  없이 텍스트 삽입으로 처리해 주석·포맷을 보존함.
- `VisualStudio.gitignore`가 `.vscode/*`를 무시하므로 `!.vscode/mcp.json`
  부정 항목을 함께 추가.
- 클라우드 코딩 에이전트는 범위 밖 — 지침은 `AGENTS.md`로 이미 커버되고,
  MCP는 저장소 파일이 아니라 GitHub 웹 설정에서 구성됨.

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
