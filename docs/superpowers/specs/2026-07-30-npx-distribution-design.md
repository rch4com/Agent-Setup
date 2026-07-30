# npx 배포와 설치 기록 기반 동기화 설계 문서

작성일: 2026-07-30
상태: 사용자 검토 대기

## 목적

지금 이 저장소를 다른 저장소에서 쓰려면 `setup-agents.sh`·`setup-agents.ps1`과
`agent-installer/` 전체(약 3.9MB)를 복사해 커밋해야 한다. 이 벤더링을 없애고
**npm에 발행해 `npx`로 설치·갱신**하며, **커밋된 설치 기록으로 팀원이 동일한 설정을
재현**할 수 있게 한다.

## 현재 상태에서 출발하는 두 가지 사실

### 1. "쉬운 설치"는 배포 채널 문제다

`AgentSetup-README.md:419`의 "팀 저장소에 넣을 파일" 목록에 `agent-installer/`가
들어 있다. 즉 소비 저장소마다 설치기 사본과 DESIGN.md 번들 2.3MB가 커밋된다.
`agent-installer/`가 이미 자기완결이라(`AgentSetup-README.md:345`) 그 성질을
그대로 npm 패키지로 옮기면 해결된다.

### 2. "동기화 갱신"은 설계 공백이다

`lib/bootstrap/manifest.mjs:24`가 `files:`를 **"없을 때만 생성한다. 이미 있으면
내용을 보지 않고 보존한다"**로 못박고 있다. `blocks:`는 마커가 없을 때만 덧붙이고
(`apply.mjs:62` `ensureBlocks`), `settings:`는 키 보장만, `ignore:`는 항목 추가만
한다. 결과적으로 **한 번 생성된 파일은 어떤 경우에도 갱신되지 않는다.**

버전 표식도 없다. `.agent-kit/README.md`는 정적 문서일 뿐이라 어느 버전이 이
저장소를 배선했는지 알 방법이 없다.

부수 효과로 좋은 점도 하나 있다 — `files:`가 생성 전용이므로 **새 도구 지원이
추가되면 재실행만으로 누락 파일이 생성된다**. 갱신 엔진은 이 경로를 깨지 않고
"파일 없음 → 생성" 분기로 흡수한다.

## 확정된 결정 사항

| 결정 | 내용 | 근거 |
|---|---|---|
| 배포 채널 | npm 공개 패키지 + GitHub 저장소 공개 | semver로 버전 고정·롤백이 되고, tarball만 받아 빠르며 로컬에 git이 필요 없다. `npx github:` 방식은 semver가 없고 매 실행 clone이 든다 |
| 패키지 이름 | `@rch4com/agent-setup` **하나** | 스코프 없는 `agent-setup`은 발행이 **불가능하다**(아래 참조). `bin` 이름은 `agent-setup`으로 두어 설치 후 실행 명령은 짧게 유지한다 |
| 발행 루트 | `agent-installer/` | 이미 자기완결이다. 저장소 루트를 발행 루트로 올리면 루트에 실제로 존재하는 `.claude/`·`.codex/`·`.vscode/` 산출물이 `files` 실수 한 번에 패키지로 새어 나간다 |
| 갱신 근거 | 커밋되는 설치 기록 `.agent-kit/agent-setup.json` | 사용자가 고친 파일을 덮어쓰지 않으려면 "우리가 쓴 그대로인가"를 판정할 근거가 필요하다. 버전 고정도 같은 파일이 담는다 |
| 갱신 방식 | 기존 4범주(`files`/`blocks`/`settings`/`ignore`)별 처리를 상속 | 범주마다 안전한 갱신 방식이 다르다. 새 분류 체계를 만들 필요가 없다 |
| 명령 표면 | 전면 재편 (`init`/`apply`/`add`/`remove`/`update`/`status`/`design`) | 사용자 결정. 옛 이름(`bootstrap`, `--list`, `--set`)은 제거한다 |
| 라이선스 | MIT | npm 발행과 공개 저장소에 필요하다. 현재 LICENSE 파일이 없다 |
| 단계 분할 | 3단계 (발행 → 갱신 엔진 → 명령 재편) | 1단계만으로 벤더링 없는 설치가 즉시 가능하다. 순서를 뒤집으면 아무도 못 쓰는 기능을 먼저 만든다 |

## 명령 표면

```
npx agent-setup                      인자 없으면 대화형 화면(TUI)
npx agent-setup init                 설치 기록 생성 + 저장소 배선
npx agent-setup init --adopt         파일을 쓰지 않고 현재 상태로 기록만 생성
npx agent-setup apply                설치 기록대로 저장소를 수렴시킨다
npx agent-setup add <id...>          기록에 항목 추가 후 수렴
npx agent-setup remove <id...>       기록에서 항목 제거 후 수렴
npx agent-setup update               고정 버전을 최신으로 올리고 관리 파일 재생성
npx agent-setup status               의도 / 실제 / 가용 3자 비교
npx agent-setup design <...>         DESIGN.md 라이브러리 (기존 서브액션 유지)
```

공통 플래그: `--dry-run`, `--skill-mode auto|link|copy`, `--design-dir <이름>=<경로>`,
`--json`(`status` 전용), `--force`(`update` 전용).

`apply`가 수렴시키는 대상은 배선(`files`/`blocks`/`settings`/`ignore`/`adapters`),
`items`, `design` **셋 모두**다. `add`/`remove`는 **항목 id만** 받는다 — DESIGN.md는
`design` 서브명령이 다루고, 그 명령이 설치 기록의 `design` 필드도 함께 갱신한다.
한 명령이 두 종류의 id를 받으면 같은 이름이 양쪽에 있을 때 어느 쪽인지 판정할 수 없다.

### `--set`이 사라지는 자리

`--set a,b`는 "이 집합을 목표 상태로"라는 **선언적** 의미론이었다. `add`/`remove`만으로
대체하면 그 의미론이 사라진다. `apply`가 그 역할을 받는다 — 목표 집합이 플래그가
아니라 **커밋된 설치 기록**에 있으므로, 팀원은 `git pull` 후 `npx agent-setup apply`
한 줄로 동일한 설정을 얻는다. 이것이 "다른 저장소에서 쉽게 설치하고 동기화"의 실제 답이다.

### `init`은 `bootstrap`의 별칭이 아니다

`init`은 배선 + 설치 기록 생성 + (대화형이면) 항목 선택까지 한 번에 끝내는 상위 명령이다.
`bootstrap`이 하던 배선은 그 안의 한 단계가 된다.

## 문서화된 원칙 하나가 바뀐다

`AgentSetup-README.md:330`은 이렇게 못박고 있다.

> 상태 파일이 없습니다 — 실행할 때마다 실제 설정 파일을 스캔해 판정하므로
> 수동으로 설치·제거해도 항상 정확히 반영됩니다.

설치 기록을 도입하면 이 문장이 더는 사실이 아니다. 다만 **강점은 버리지 않고 역할을
나눈다**.

- **실제 상태**의 유일한 근거는 계속 스캔이다. 수동 설치·제거는 그대로 정확히 잡힌다.
- **설치 기록은 의도**일 뿐이며 판정을 대체하지 않는다.
- `status`가 둘의 차이를 `기록에만 있음` / `저장소에만 있음`으로 보여준다.

즉 기록이 추가하는 것은 판정 능력이 아니라 **재현성과 버전 고정**이다. 문서도 이
표현으로 고친다.

## 설치 기록 `.agent-kit/agent-setup.json`

### 이름 충돌 정리

설치기 안에 이미 `lib/bootstrap/manifest.mjs`(무엇을 생성할지 선언)가 있다. 저장소에
커밋되는 파일을 또 "manifest"라 부르면 코드와 문서가 계속 헷갈린다. 커밋되는 쪽은
**설치 기록(`.agent-kit/agent-setup.json`)**으로 부른다. `.agent-kit/`는 이미 커밋
대상 디렉터리다.

### 스키마

```json
{
  "formatVersion": 1,
  "pinnedVersion": "1.4.0",
  "skillMode": "auto",
  "items": ["mcp.notion", "plugin.bkit"],
  "design": ["awesome-design-md/stripe"],
  "managed": {
    "AGENTS.md": "sha256:…",
    ".agents/skills/repository-check/SKILL.md": "sha256:…",
    ".codex/config.toml": "sha256:…",
    "CLAUDE.md#agent-kit": "sha256:…"
  }
}
```

| 필드 | 뜻 |
|---|---|
| `formatVersion` | 기록 파일 형식 버전. 미래에 스키마가 바뀔 때 마이그레이션 판단에 쓴다 |
| `pinnedVersion` | 이 저장소를 배선한 패키지 버전. `init`과 `update`만 이 값을 쓴다 |
| `skillMode` | 어댑터 방식. `apply`가 재실행할 때 같은 방식을 쓴다 |
| `items` | 의도한 설치 항목 id 집합 |
| `design` | 의도한 DESIGN.md 집합 (`제공자/이름` 형식) |
| `managed` | 관리 파일별 해시. **`files:` 15개와 `blocks:` 2개만** 들어간다 |

`settings:`(키 보장), `ignore:`(항목 추가), `adapters:`(링크 재검증)는 해시가 필요 없다.
현행 멱등 로직을 그대로 재실행하면 되고, 사용자가 `chat.useAgentsMdFile`을 일부러
`false`로 바꾼 경우를 되돌리지 않는 기존 원칙도 유지된다.

`blocks:`는 마커 사이 본문만 해시하므로 키에 `#agent-kit`을 붙여 파일 전체 해시와
구분한다.

### 해시는 정규화 후 계산한다 — 필수

`.gitattributes:9`가 `* text=auto`이므로 워킹트리는 각자의 `core.autocrlf`에 따라
CRLF일 수 있다. **원시 바이트를 해시하면 Windows 체크아웃에서 모든 파일이 드리프트로
뜬다.**

`apply.mjs:22`의 `normalizeBody`가 이미 정확한 정규화를 한다.

```js
function normalizeBody(text) {
  return text.replace(/\r\n/g, '\n').trim() + '\n'
}
```

해시는 **반드시 이 함수를 통과한 문자열**에 대해 계산한다. `writeText`가 파일을 쓸 때
쓰는 것과 동일한 함수이므로, 갓 쓴 파일은 정의상 해시가 일치한다.

## 버전 고정을 실제로 지키기

`apply`는 **버전 엄격**이다. 실행 중 버전이 `pinnedVersion`과 다르면 아무것도 쓰지
않고 중단한다.

```
고정 버전 1.4.0, 실행 중 1.6.0 — 결과가 달라질 수 있어 중단했습니다.
  재현하려면      npx agent-setup@1.4.0 apply
  최신을 받으려면  npx agent-setup@latest update
```

느슨하게 진행시키면 고정의 의미가 사라진다. 새 템플릿으로 파일을 쓰면서 기록에는 옛
버전이 남아 **기록이 거짓말을 하게 된다**. 오류 메시지가 두 갈래를 그대로 주므로
해결은 복사·붙여넣기 한 번이다.

- `status`와 `--dry-run`은 이 경우에도 중단하지 않고 차이를 보고한다.
- `pinnedVersion`을 쓰는 명령은 `init`과 `update` **둘뿐**이다.
- `add`/`remove`는 항목 목록만 고치고 수렴 단계에서 `apply`와 같은 엄격 검사를 받는다.

## `update`의 파일별 처리

| 상황 | 처리 |
|---|---|
| 현재 해시 == 기록된 해시 | 우리가 쓴 그대로 → 새 템플릿으로 교체, 기록 갱신 |
| 해시 불일치 | 사용자가 고쳤음 → **건드리지 않고** 드리프트로 보고 + 최신 템플릿과의 차이 제시 |
| 파일 없음 | 새로 생성. 새 도구 지원이 이 경로로 들어온다 |
| 기록에 해시 없음 | 출처 불명 → 영구히 사용자 소유. `--force`로만 채택 |

`blocks:`는 마커(`<!-- agent-kit:begin -->` / `<!-- agent-kit:end -->`,
`templates.mjs:35`) 사이 본문 해시가 일치하면 그 구간만 교체한다. 주변 사용자 본문은
어떤 내용이든 보존된다. 마커 안쪽을 사용자가 고쳤다면 드리프트로 보고하고 건드리지
않는다.

`settings`·`ignore`·`adapters`는 현행 보장 로직을 재실행한다(멱등).

`items`·`design`은 기록의 목표 집합으로 수렴한다(`apply`와 동일).

마지막에 `pinnedVersion`을 실행 중 버전으로 갱신하고 요약을 출력한다.

```
갱신 3건 · 신규 1건 · 드리프트 1건 · 변경 없음 12건

드리프트 (건드리지 않았습니다)
  .agents/skills/repository-check/SKILL.md
    최신 템플릿과 12줄 차이 — 반영하려면 update --force
```

### `--force`

드리프트 파일까지 덮어쓴다. git이 안전망이므로 백업 파일은 만들지 않는다. 대신
**워킹트리가 깨끗하지 않으면 거부한다** — 되돌릴 수 없는 상태에서 덮어쓰는 것을 막는
유일한 장치가 그것이다.

## 기존 벤더링 저장소 흡수 — `init --adopt`

`agent-installer/`를 복사해 쓰던 저장소에는 설치 기록이 없다. `status`·`update`가
기록 부재를 감지하면 `init --adopt`를 안내한다.

`--adopt`는 파일을 새로 쓰지 않고 기록만 만든다. 여기서 **현재 내용을 그대로 해시로
박으면 안 된다** — 사용자가 이미 고쳐 둔 파일이 "우리가 쓴 그대로"로 위장되어 다음
`update`에 날아간다.

그래서 채택 규칙은 이렇다.

- 현재 내용이 **실행 중 버전의 템플릿과 정규화 후 일치**하는 파일만 `managed`에 해시를
  기록한다.
- 일치하지 않는 파일은 **해시 없이 키만** 남긴다. `update`가 절대 덮어쓰지 않는다.
- `status`가 그런 파일을 "관리되지 않음 — 최신 템플릿과 차이 있음"으로 보여주고,
  사용자가 원할 때만 `update --force`로 관리 대상에 들어온다.
- `items`·`design`은 스캔 결과를 그대로 채운다(실제 설치 상태가 곧 의도라고 본다).

## `status`는 3자를 비교한다

의도(설치 기록) / 실제(저장소 스캔) / 가용(최신 패키지)이다.

```
agent-setup   1.4.0 고정 · 최신 1.6.0        → update 가능
배선          11개 도구 전부 정상
관리 파일     17개 중 15 최신 · 1 갱신 대기 · 1 사용자 수정
항목          설치됨       mcp.notion, plugin.bkit
              기록에만     mcp.vercel        → apply 필요
              저장소에만   skill.gsd         → add 또는 제거
design        stripe 최신 · vercel 원본과 다름
```

- 최신 버전 조회는 `agent-setup` 한쪽만 기준으로 한다. 두 이름의 내용이 동일하므로
  기록에 어느 이름으로 설치했는지 남기지 않는다.
- 네트워크가 없으면 "최신 버전 확인 실패"로 그 줄만 축약하고 나머지는 정상 출력한다.
- `--json`을 붙이면 CI에서 판정에 쓸 수 있다.

## 발행

### `agent-installer/package.json`

현재 `version` 필드가 **아예 없고** `private: true`가 걸려 있다.

```json
{
  "name": "agent-setup",
  "version": "1.0.0",
  "description": "여러 코딩 에이전트 CLI를 한 저장소에서 함께 쓰기 위한 저장소 범위 부트스트랩",
  "type": "module",
  "engines": { "node": ">=20" },
  "bin": { "agent-setup": "install.mjs" },
  "files": ["install.mjs", "lib/", "README.md", "LICENSE"],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/rch4com/Agent-Setup.git",
    "directory": "agent-installer"
  },
  "license": "MIT",
  "scripts": { "test": "node --test \"test/*.test.mjs\"", "refresh-bundle": "node scripts/refresh-bundle.mjs" }
}
```

`bin` 이름이 패키지명과 같아야 `npx agent-setup`이 그대로 동작한다. `install.mjs`에는
이미 `#!/usr/bin/env node`가 있다.

의존성(`jsonc-parser`, `smol-toml`)은 손대지 않는다. npx가 두 패키지를 무조건 함께
받지만 둘 다 작아서 실무상 무의미하고, 격리 불변식
(`test/bootstrap.isolation.test.mjs`)은 **오프라인·벤더링 사용에서** 여전히 유효하므로
테스트를 남긴다.

### 검증해야 할 위험 둘

**패키지 크기 — 실측으로 해소됨.** DESIGN.md 번들이 2.3MB지만 markdown이라 압축이 잘
든다. `files: ["install.mjs","lib/","README.md","LICENSE"]`로 `npm pack --dry-run --json`을
실측한 결과다.

| 항목 | 값 |
|---|---|
| tarball | **0.58 MB** |
| 압축 해제 | 2.24 MB |
| 항목 수 | 114 |
| 최상위 경로 | `install.mjs`, `lib`, `package.json` |

npx 첫 실행에 문제 없는 크기이므로 **번들을 분리하지 않는다.** 회귀 방어로 pack 검증
테스트에 tarball 2MiB 상한을 넣어, 번들이 커지면 조용히 통과하지 않게 한다.

같은 실측에서 확인된 것 하나 더 — 현재 `package.json`으로는 `npm pack` 자체가
`Invalid package, must have name and version`으로 **실패한다**. `version` 필드 부재가
발행 경로를 이미 막고 있다.

**`files` 화이트리스트 오류.** 발행 루트를 `agent-installer/`로 둔 것이 한 겹이지만
충분하지 않다. `npm pack --dry-run --json`의 파일 목록을 **테스트로 검사**해 예상 밖
파일이 섞이면 실패하게 한다. 발행은 되돌릴 수 없으므로 사람 눈에 맡기지 않는다.

### 스코프 없는 이름은 쓸 수 없다 — 발행 시도로 확인됨

`agent-setup`으로 발행을 시도하면 **403으로 거부된다**.

```
403 Forbidden - PUT https://registry.npmjs.org/agent-setup
Package name too similar to existing package agentsetup;
try renaming your package to '@rch4com/agent-setup'
```

npm은 유사 이름을 차단하며, 판정은 대략 **소문자화 + `-`·`_`·`.` 제거 후 충돌**이다.
`agent-setup` → `agentsetup`이고 그 패키지가 이미 존재한다(0.0.1).

**교훈: `npm view <이름>`이 404를 돌려주는 것은 발행 가능을 뜻하지 않는다.** 이
제한은 발행 시점에만 걸린다. 사전에 예측하려면 정규화한 형태를 조회해야 한다.
같은 방법으로 확인한 결과 `agent-kit`도 쓸 수 없다(`agentkit` 0.0.0 존재).

발행 가능했을 대안은 `setup-agents`·`agent-setup-cli`·`multi-agent-setup`·
`agents-md-setup`·`agent-bootstrap`이었으나, 사용자 결정으로 **스코프 이름 하나만**
쓴다. `bin`을 `agent-setup`으로 두었으므로 설치 후 명령은 짧고, 길어지는 것은 npx로
직접 부를 때뿐이다.

### GitHub Actions

태그 푸시를 트리거로 발행한다.

```
npm publish --provenance
```

- 스코프 패키지는 기본이 restricted다. `package.json`의
  `publishConfig.access: "public"`으로 고정해 `--access` 플래그를 잊는 사고를 막는다.
- `--provenance`는 공개 저장소 + Actions 조합에서 붙는 공급망 서명이다.
- **Trusted Publishing(토큰 없는 OIDC 발행)은 첫 발행에 쓸 수 없다.** npmjs.com의
  *패키지 설정* 화면에서 구성하므로 패키지가 먼저 존재해야 하고, npm CLI 11.5.1+ 와
  Node 22.14.0+ 를 요구한다. 발행 잡의 Node를 22로 올리고 `npm install -g npm@latest`를
  넣어 이후 릴리스에서 토큰을 걷어낼 수 있게 바닥을 맞춘다. 발행 잡이 22 전용이 되면
  선언한 하한(`engines: >=20`)이 검증되지 않으므로 `test` 잡을 20·22 매트릭스로 떼어
  분리하고 `publish`가 그것에 의존한다.
- 계정 2FA가 `auth-and-writes`이면 로컬 `npm publish`가 OTP를 요구한다. CI 발행은
  Granular Access Token으로 그 프롬프트를 우회한다.
- npm Trusted Publishing(OIDC)을 쓰면 토큰을 저장소 시크릿에 두지 않아도 된다.
- 워크플로는 발행 전에 `npm test`와 pack 목록 검사를 통과해야 진행한다.

### npm 페이지용 README

npm 패키지 페이지에 뜨는 것은 `agent-installer/README.md`인데 현재 없다. 23KB짜리
`AgentSetup-README.md`를 복사하면 두 벌 관리가 되므로, **설치·명령·링크만 담은 짧은
문서**를 새로 쓰고 상세는 GitHub 문서로 링크한다.

## 공개 전환 점검

추적 파일은 전부 빈 템플릿이고(`.claude/settings.json`은 `{}`), 이력에서 삭제된 파일도
코드 두 개(`skill.minimax.mjs`, `verify-templates.mjs`)뿐이다. 다만 공개는 되돌릴 수
없으므로 전환 **전에** 확인한다.

- 97개 커밋 전체를 비밀값 패턴으로 훑는다. 워킹트리만 깨끗한 것으로는 부족하다.
- `docs/superpowers/` 아래 스펙·플랜 8건이 공개돼도 되는 내용인지 확인한다.
- 추적되지 않는 `debug.log`, `.omc/`, `.bkit/`, `.superpowers/`가 `.gitignore`로 확실히
  막혀 있는지 재확인한다.
- LICENSE(MIT)를 추가한다.

## 단계 분할

3단계가 옛 명령 이름을 제거하므로 **파괴적 변경**이다. `pinnedVersion` 엄격 검사가
버전 차이를 실제로 막는 만큼 semver를 정직하게 매긴다.

| 단계 | 발행 버전 | 성격 |
|---|---|---|
| 1 | `1.0.0` | 최초 발행 |
| 2 | `1.1.0` | 기능 추가. `bootstrap` 등 옛 명령은 그대로 동작한다 |
| 3 | `2.0.0` | `bootstrap`·`--list`·`--set` 제거 |

`1.x`로 배선한 저장소가 `npx agent-setup@latest update`를 돌리면 2.0.0을 만난다.
`update`는 기록의 `formatVersion`으로 마이그레이션을 판단하고, 옛 명령을 스크립트에
박아 둔 사용자를 위해 **2.0.0의 `bootstrap`은 "제거됨 — `init`을 쓰세요"라는 오류로
남긴다**. 조용히 사라지면 CI가 알 수 없는 이유로 깨진다.

### 1단계 — 발행 가능하게

`package.json` 정비, `bin`, LICENSE, npm용 README, pack 목록 검증 테스트, 공개 전환,
이중 발행 워크플로.

**끝나면**: 옛 명령 그대로 `npx agent-setup@1.0.0 bootstrap`이 동작한다. 벤더링 없이
설치가 가능해지므로 요청의 절반이 즉시 해결된다.

### 2단계 — 설치 기록과 갱신 엔진

기록 스키마와 입출력 모듈, 해시 계산(`normalizeBody` 재사용), `ensureFiles` 해시 게이트,
`ensureBlocks` 마커 사이 교체, `update`·`--adopt`·버전 엄격 검사, `status` 3자 비교.

**끝나면**: 갱신과 드리프트 감지가 동작한다. 이 단계는 옛 명령 이름 위에 얹어도 되므로
3단계와 독립적이다.

### 3단계 — 명령 전면 재편

`init`/`apply`/`add`/`remove`/`update`/`status`/`design`으로 정리하고 `bootstrap`·
`--list`·`--set`을 제거한다. 런처 2개, 문서 4건, CLI 테스트 3건을 갱신한다.

**끝나면**: 최종 명령 표면이 완성된다.

## 변경 대상

### 재작성

| 파일 | 내용 |
|---|---|
| `lib/args.mjs` (261줄) | 서브명령 7개 + 공통 플래그 파서. 동작 플래그 상호배제 규칙(`args.mjs` 기존 원칙)을 서브명령 체계로 옮긴다 |
| `install.mjs` (83줄) | 라우팅. 정적 import는 의존성 없는 모듈만이라는 불변식(`install.mjs:10` 주석)을 유지한다 |

### 확장

| 파일 | 내용 |
|---|---|
| `lib/bootstrap/apply.mjs` | `ensureFiles`에 해시 게이트 4분기 추가, `ensureBlocks`에 마커 사이 교체 추가(현재는 append 전용), `normalizeBody`를 해시 계산에 재사용하도록 export |
| `lib/bootstrap/flow.mjs` (54줄) | 기록 읽기·쓰기 단계를 배선 전후에 끼운다 |
| `lib/engine.mjs` (44줄) | 목표 집합을 인자로 받는 현재 구조를 기록에서 읽도록 연결 |

### 신규

| 파일 | 내용 |
|---|---|
| `lib/record.mjs` | 설치 기록 읽기·쓰기·해시 계산. 부트스트랩 경로에서 쓰이므로 **의존성 0**이어야 한다 |
| `lib/update.mjs` | `update`·`--adopt` 흐름 |
| `lib/status.mjs` | 3자 비교 + `--json` 직렬화 |
| `agent-installer/README.md` | npm 페이지용 |
| `LICENSE` | MIT |
| `.github/workflows/publish.yml` | 태그 트리거 이중 발행 |

### 갱신

`setup-agents.sh`, `setup-agents.ps1`(서브명령 변경 반영), `AgentSetup-README.md`
(설치·갱신 절 재작성, "팀 저장소에 넣을 파일"에서 `agent-installer/`와 런처 2개 제거,
"상태 파일이 없습니다" 문단 수정), `README.md`(빠른 시작을 npx로),
`AgentSetup-README-CHANGES.md`, `AGENTS.md`(전체 검증 절의 런처 스모크 명령).

## 테스트 계획

| 대상 | 검증 |
|---|---|
| `record.test.mjs` (신규) | 기록 읽기·쓰기 왕복. `formatVersion` 불일치 시 진단 가능한 오류. 필드 누락 시 기본값 |
| 해시 정규화 (신규) | 같은 내용의 LF본과 CRLF본이 **동일한 해시**를 낸다. 끝 개행 유무·앞뒤 공백 차이도 동일 해시 |
| `update` 4분기 (신규) | 해시 일치 → 교체 / 불일치 → 무변경 + 드리프트 보고 / 파일 없음 → 생성 / 해시 없음 → 무변경 |
| `blocks` 마커 교체 (신규) | 마커 사이만 바뀌고 앞뒤 사용자 본문 보존. 마커 안쪽 수정본은 드리프트로 보고 |
| `--adopt` 채택 규칙 (신규) | 템플릿과 일치하는 파일만 해시 기록. 다른 파일은 키만 남고 이후 `update`가 건드리지 않음 |
| 버전 엄격 (신규) | `apply`가 버전 불일치 시 **아무 파일도 쓰지 않고** 종료. `status`·`--dry-run`은 중단하지 않음 |
| `--force` 안전장치 (신규) | 워킹트리가 더러우면 거부. 깨끗하면 드리프트 파일 덮어씀 |
| `status --json` (신규) | 3자 비교 결과가 스키마대로 직렬화 |
| pack 목록 (신규) | `npm pack --dry-run --json`에 `test/`·`node_modules/`·저장소 루트 산출물이 없음. 예상 밖 경로가 있으면 실패 |
| `args.test.mjs` | 서브명령 7개 파싱, 상호배제 규칙, 오타는 조용히 무시하지 않고 사용법과 함께 오류 종료(기존 원칙 유지) |
| 제거된 명령 안내 (3단계, 신규) | `bootstrap`·`--list`·`--set`이 "제거됨 — 대신 <새 명령>" 오류로 종료한다. 알 수 없는 인자와 구분되는 메시지여야 한다 |
| `install.cli.test.mjs`·`bootstrap.cli.test.mjs` | 새 서브명령 기준으로 갱신 |
| `bootstrap.isolation.test.mjs` | 그대로 통과해야 한다. `lib/record.mjs`가 외부 의존성을 끌어오지 않았다는 회귀 방어 |

전체 검증은 `AGENTS.md` 규정대로 `cd agent-installer && npm test` 후 두 런처를 스크래치
저장소에서 2회씩 돌려 멱등성과 `git status`를 확인한다. 이번에는 `.agent-kit/agent-setup.json`이
스테이징되고 2회차에 내용이 변하지 않는지도 확인한다.

## 남기는 주의점

- `pinnedVersion` 엄격 검사는 `npx agent-setup` 무인자 실행(TUI)에도 적용된다. TUI 안의
  적용 작업이 `apply`와 같은 경로를 타므로 화면에서 버전 불일치를 먼저 안내해야 한다.
- 두 이름으로 발행하므로 `npm view` 조회 대상을 `agent-setup`으로 고정한다. 사용자가
  스코프 이름으로 설치했더라도 버전 번호가 같으므로 비교는 유효하다.
- `design`의 `--sync=installed`는 이미 원본 최신을 받는 독자적 갱신 경로다. 설치 기록의
  `design` 필드는 **어느 문서를 설치했는지**만 담고 내용 해시는 담지 않는다 — DESIGN.md는
  사용자가 고쳐 쓰는 문서가 아니라 참조본이고, 이미 `--sync=stale`이 차이를 감지한다.

## 범위 밖

- **글로벌 설치.** `npm i -g agent-setup`도 동작하지만 권장 경로로 문서화하지 않는다.
  저장소마다 고정 버전이 다를 수 있고 `npx`가 그것을 자연히 처리한다.
- **DESIGN.md 번들 분리.** 실측 후 필요하면 별도 작업으로 다룬다.
- **설정 파일 키 단위 병합.** MCP 항목이 들어간 `.codex/config.toml` 같은 파일은 해시
  불일치로 드리프트가 되어 템플릿 개선이 자동 전파되지 않는다. 키 단위 병합은 파일
  포맷별 로직과 "무엇을 관리 키로 볼지"라는 판단을 새로 요구하므로 이번 범위에서
  제외한다. 드리프트 보고가 차이를 보여주므로 수동 반영이 가능하다.
- **기존 소비 저장소 자동 정리.** 벤더링된 `agent-installer/`와 런처 삭제는 사용자가
  직접 커밋한다. 설치기가 자기 사본을 지우는 것은 위험하고, `--adopt` 안내문에
  삭제 대상을 명시하는 것으로 충분하다.
