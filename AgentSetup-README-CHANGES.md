# 변경 이력

최신 항목이 위에 옵니다. 상세 사용법은 `AgentSetup-README.md`를 참조하세요.

## 설치 기록과 갱신 (2026-07-30, 1.1.0)

**한 번 생성된 파일이 절대 갱신되지 않던 상태를 고쳤다.** `manifest.mjs`의
`files`는 "없을 때만 생성"이고 `blocks`는 마커가 없을 때만 덧붙였으므로,
템플릿이 개선되어도 기존 저장소에 전달될 길이 없었다.

- **설치 기록 `.agent-kit/agent-setup.json`.** 커밋 대상이며 배선 버전,
  고른 항목, 관리 파일별 해시를 담는다. 문서화된 "상태 파일이 없습니다"
  원칙이 둘로 갈렸다 — **스캔은 실제, 기록은 의도**다. 기록은 판정을
  대체하지 않고 재현성과 버전 고정을 더한다.
- **`update`.** 기록된 해시와 일치하는 파일만 최신 템플릿으로 옮기고,
  사용자가 고친 파일은 건드리지 않고 드리프트로 보고한다. 파일이 없으면
  생성하므로 새 도구 지원이 이 경로로 전달된다. `--force`는 드리프트까지
  덮어쓰지만 **워킹트리가 깨끗할 때만** 허용한다 — git이 유일한 되돌리기
  수단이다.
- **`status`.** 의도·실제·버전을 나란히 보여주고 `--json`으로 CI에서 쓸 수
  있다. 갱신 판정은 `update`와 같은 함수를 dry-run으로 불러 얻으므로 두
  명령이 다른 답을 낼 수 없다.
- **`bootstrap --adopt`.** 설치기를 복사해 쓰던 저장소를 기록 체계로
  끌어온다. 파일을 만들지 않고, **템플릿과 같은 파일만** 채택한다. 현재
  내용을 그대로 해시로 박으면 이미 고쳐 둔 파일이 "우리가 쓴 그대로"로
  위장되어 다음 `update`에 날아간다.
- **해시는 줄바꿈을 LF로 정규화한 뒤 계산한다.** `.gitattributes`가
  `text=auto`라 Windows 워킹트리는 CRLF다. 원시 바이트를 해시하면 그
  환경에서 모든 파일이 드리프트로 뜬다.
- **블록은 마커 사이만 교체한다.** `CLAUDE.md`·`GEMINI.md`에 사용자가 쓴
  주변 내용은 그대로 남는다.

기존 명령(`bootstrap`, `--list`, `--set`, `design`)은 그대로 동작한다.
버전 불일치는 보고만 하며, 중단시키는 엄격 검사는 명령 표면을 재편하는
다음 단계로 미뤘다 — 여기서 중단하면 기존 사용자의 실행이 죽는다.

### 발행물에서 이물질 제거

`1.1.0` 발행 로그에서 `lib/items/.omc/state/sessions/…/pre-tool-advisory-throttle.json`
이 tarball에 실려 있는 것을 발견해 제거했다. 로컬 도구가 만든 세션 상태
파일이며 `1.0.0`에도 들어갔다(116 파일 중 1개). 내용은 훅 스로틀 타임스탬프와
조언 문구뿐이라 비밀값은 없다.

원인은 **`package.json`의 `files`가 `.gitignore`보다 우선**한다는 것이다.
`.gitignore:435`의 `.omc/`가 git에서는 정상 작동해 추적되지 않았지만,
`files`에 `lib/`를 나열했으므로 npm은 그 아래 전부를 무조건 담았다.
`.npmignore`로도 막을 수 없다.

pack 검증 테스트가 최상위 경로만 보고 있어 `lib/` 하위에 낀 것을 놓쳤다.
두 가지를 더했다.

- 경로의 **어느 구간이든 `.`으로 시작하면** 실패
- `.mjs`·`.json`·`.md`와 `LICENSE` 외의 확장자가 있으면 실패

`1.1.0`은 119 파일로 발행된다.

## npm 발행 (2026-07-30)

파일을 복사하지 않고 쓸 수 있게 됐다. 설치기를 `@rch4com/agent-setup`으로
npm에 발행한다.

이름에 스코프가 붙은 이유는 **스코프 없는 `agent-setup`을 쓸 수 없어서**다.
npm은 유사 이름을 차단하고, `agent-setup`은 기존 패키지 `agentsetup`과
정규화하면 같아져 발행이 403으로 거부된다. `npm view agent-setup`이 404를
돌려주는 것만으로는 발행 가능을 확인할 수 없다 — 이 제한은 발행 시점에만
걸린다. `bin` 이름은 `agent-setup`으로 두었으므로 설치 후 실행 명령은 짧다.

- **`npx @rch4com/agent-setup bootstrap`으로 배선.** 기존 명령(`bootstrap`,
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
