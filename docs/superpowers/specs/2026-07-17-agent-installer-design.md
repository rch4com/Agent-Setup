# Agent Installer 설계 문서

작성일: 2026-07-17
상태: 사용자 승인 대기

## 목적

plugin, MCP, skill을 체크박스로 골라 설치하는 콘솔 대화 도구를 만든다.

- 항목을 체크하고 Submit하면 설치한다.
- 다시 실행하면 **실제 환경을 스캔**해서 설치된 항목이 미리 체크되어 표시된다.
- 체크를 해제하고 Submit하면 제거한다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 설치 범위 | 프로젝트 로컬 (플러그인은 `--scope project`, MCP는 저장소 안 설정 파일) |
| MCP 등록 대상 | 8개 CLI 프로젝트 설정에 동시 등록 (Claude Code, Codex, Gemini CLI, OpenCode, Kilo Code, Kiro, Kimi Code, Grok Build) |
| 구현 기술 | Node.js + @clack/prompts (체크박스 멀티셀렉트 UI) |
| 상태 유지 | **순수 환경 스캔(stateless)** — 상태 파일 없음, 실제 설정 파일이 곧 상태 |
| 플러그인 설치 | claude CLI 호출(A) 시도 → 실패 시 `.claude/settings.json` 직접 기록(B)으로 폴백. 폴백 시 실제 다운로드는 다음 Claude Code 실행 때 이루어짐을 리포트에 명시 |
| 독립 실행 | `agent-installer/` 폴더 하나가 자기완결 — 다른 저장소에 통째로 복사해도 동작 |

## 초기 카탈로그 항목

플러그인 (category: plugin, 지원: claude 전용)

- superpowers — https://github.com/obra/superpowers
- bkit — https://github.com/popup-studio-ai/bkit-claude-code
- GSD — https://github.com/open-gsd/gsd-core
- gstack — https://github.com/garrytan/gstack

MCP (category: mcp, 기본 지원: 8개 CLI 전체, 항목별 축소 가능)

- notion — 원격 URL (https://mcp.notion.com/mcp)
- supabase — 원격 또는 npx
- vercel — 원격 URL (https://mcp.vercel.com)
- codebase-memory-mcp — 로컬 npx 커맨드 (https://github.com/DeusData/codebase-memory-mcp)

## 아키텍처

```text
agent-installer/                  # 자기완결 폴더 (bootstrap 병합 대응)
├─ install.mjs                    # 엔트리포인트: node agent-installer/install.mjs
├─ package.json                   # 의존성: @clack/prompts, jsonc-parser, smol-toml
└─ lib/
   ├─ engine.mjs                  # 스캔 → UI → diff → 적용 → 재스캔 리포트
   ├─ writers.mjs                 # CLI 설정 파일 보존적 읽기/수정 (JSON·JSONC·TOML, 주석 유지)
   ├─ context.mjs                 # git root 탐지, 저장소 밖 쓰기 거부
   └─ items/                      # 항목 = 파일 1개, 폴더 자동 스캔으로 카탈로그 구성
      ├─ plugin.superpowers.mjs
      ├─ plugin.bkit.mjs
      ├─ plugin.gsd.mjs
      ├─ plugin.gstack.mjs
      ├─ mcp.notion.mjs
      ├─ mcp.supabase.mjs
      ├─ mcp.vercel.mjs
      └─ mcp.codebase-memory.mjs
```

### 항목 인터페이스 (유동적 관리)

`lib/items/*.mjs`는 자동 발견된다. 새 항목 추가 = 파일 1개 추가, 제거 = 파일 삭제.

```js
export default {
  id: 'mcp.notion',
  category: 'mcp',            // 'plugin' | 'mcp' | 'skill' (skill은 예약 카테고리 — v1 카탈로그에는 없음, GSD·gstack은 플러그인으로 설치)
  label: 'Notion MCP',
  supports: [...],            // 지원 CLI 목록
  unsupported: { kimi: '사유' },  // 미지원 CLI별 사유 (필수, 검증됨)
  detect(ctx),                // 'installed' | 'partial' | 'absent'
  install(ctx),
  uninstall(ctx),
}
```

같은 유형은 팩토리로 정의를 축약한다:

- `defineMcp({ id, label, server, supports?, unsupported? })` — 8개 CLI 등록·감지·제거 자동 처리. 새 MCP 추가는 실질적으로 5줄짜리 파일 1개.
- `definePlugin({ id, label, name, marketplace })` — claude CLI 호출 처리. supports는 `['claude']` 고정.

### 지원 CLI 선언 규칙

- `supports`: 항목이 지원하는 CLI 목록. 생략 시 카테고리 기본값(mcp = 8개 전체, plugin = claude).
- `unsupported`: supports에서 빠진 CLI마다 **사유 문자열 필수**. 카탈로그 로드 시 검증해 "말없이 빠지는" 항목이 없도록 강제한다.
- 반영 위치 3곳:
  1. 선택 UI hint: `지원: claude, codex, ... / 미지원: kimi(원격 OAuth MCP 미지원)`
  2. 상태 판정: installed/partial 계산의 분모에서 미지원 CLI 제외
  3. 적용 리포트: `등록: ... / 건너뜀: kimi (사유)`

## 실행 흐름

1. 저장소 안 어디서든 `node agent-installer/install.mjs` 실행. git root 탐지, git 저장소 밖이면 거부.
2. 스캔: 전 항목 `detect()` — 플러그인은 `.claude/settings.json`의 `enabledPlugins`, MCP는 8개 설정 파일의 서버 키 존재 여부.
3. UI: 멀티셀렉트 표시. installed는 미리 체크, partial은 체크 + `(일부 설치됨)` 표시.
4. Submit → diff:
   - 새로 체크 → install
   - 체크 해제 → uninstall
   - 체크 유지 + partial → 누락 CLI만 보완 설치
   - 체크 유지 + installed → 변경 없음
5. 적용 후 재스캔으로 최종 상태 리포트 (성공/실패/건너뜀 + 사유).

## 항목별 메커니즘

### 플러그인 (A: claude CLI 호출 → 실패 시 B: 설정 직접 기록 폴백)

- 설치(A, 기본): `claude plugin marketplace add <repo>` → `claude plugin install <name>@<marketplace> --scope project`. 다운로드·검증까지 즉시 완료.
- 설치(B, 폴백): claude 명령이 없거나 A가 실패하면 `.claude/settings.json`에 직접 기록:
  - `enabledPlugins`에 `<name>@<marketplace>` 추가
  - `extraKnownMarketplaces`에 마켓플레이스 GitHub 소스 추가
  - 리포트에 상태를 구분해 표시: `설정 기록됨 — 다음 Claude Code 실행 시 다운로드됩니다` (A 성공 시에는 `설치 완료`)
- 제거: claude 명령이 있으면 `claude plugin uninstall <name>@<marketplace>`, 없으면 `enabledPlugins`에서 항목 제거(해당 마켓플레이스를 쓰는 다른 플러그인이 없으면 `extraKnownMarketplaces` 항목도 제거).
- 감지: `.claude/settings.json`의 `enabledPlugins`에 `<name>@<marketplace>` 존재 여부 (A/B 어느 쪽으로 설치했든 동일하게 판정됨).
- B 폴백의 쓰기도 실패한 경우에만 항목 실패로 리포트. 다른 항목은 계속 진행.

### MCP (설정 파일 보존적 편집)

CLI별 프로젝트 설정 위치와 키:

| CLI | 파일 | 키 |
|---|---|---|
| Claude Code | `.mcp.json` | `mcpServers` |
| Gemini CLI | `.gemini/settings.json` | `mcpServers` |
| Codex | `.codex/config.toml` | `[mcp_servers.<name>]` |
| Kiro | `.kiro/settings/mcp.json` | `mcpServers` |
| Kimi Code | `.kimi-code/mcp.json` | `mcpServers` |
| OpenCode | `opencode.jsonc` | `mcp` (구현 시 확인) |
| Kilo Code | 구현 시 확인 | 구현 시 확인 |

- 설치: 해당 서버 항목만 병합. 기존 다른 항목·주석 보존 (jsonc-parser, smol-toml 사용).
- 제거: 해당 서버 키만 삭제.
- 인증(OAuth·토큰)은 각 CLI 첫 사용 시 처리. 인스톨러는 설정 등록까지만 책임진다.

## 오류 처리와 안전 원칙

- setup-agents와 동일 원칙: git root 기준 경로, 저장소 밖 쓰기 거부, 기존 설정의 다른 항목 불변.
- 한 항목 실패 시 나머지 계속, 마지막에 실패 목록 리포트.
- 별도 백업 없음 — 설정 파일이 git 추적 대상이므로 `git diff`가 안전망 (리포트에 안내).
- `--dry-run` 지원 (기존 스크립트와 일관).
- 비대화형 모드 `--set <id,id,...>` 지원 (CI·테스트용): 지정 항목 집합을 목표 상태로 적용.

## 테스트

- 스크래치 git 저장소 E2E: 비대화형 모드로 설치 → 재스캔 installed 판정 → 제거 → absent 판정.
- `node:test` 단위 테스트: writers(JSONC/TOML 보존 병합·삭제), detect 판정(installed/partial/absent), 카탈로그 검증(unsupported 사유 누락 시 오류), 플러그인 B 폴백 쓰기(enabledPlugins·extraKnownMarketplaces 추가/제거).
- 이 저장소에서 `--dry-run` 확인.

## 구현 단계에서 확인할 외부 사실

- 각 플러그인의 정확한 마켓플레이스 이름과 설치 식별자 (superpowers, bkit, GSD, gstack)
- OpenCode·Kilo의 프로젝트 MCP 설정 파일 경로와 스키마
- Kimi Code의 원격(HTTP/OAuth) MCP 지원 여부 → notion/vercel/supabase 항목의 supports/unsupported 확정
- supabase MCP의 권장 연결 방식 (원격 URL vs npx) 및 필요 파라미터
- codebase-memory-mcp의 실행 커맨드 (npx 인자)

## 범위 제외 (v1)

- 사용자 글로벌 설치, MCP별 대상 CLI 선택 UI, 설치 이력 manifest, bkit의 gemini/codex 변형 플러그인 → 필요 시 v2에서 확장.
