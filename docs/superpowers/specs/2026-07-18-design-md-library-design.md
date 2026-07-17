# design.md 라이브러리 설계 문서

작성일: 2026-07-18
상태: 사용자 승인 완료 (진행)

## 목적

`agent-installer`에 **design.md 라이브러리** 모드를 추가한다. AI 에이전트가 읽어
일관된 UI를 생성하는 DESIGN.md 문서를 원격 소스에서 골라 내려받고, 동기화하고,
브라우저 미리보기로 확인해 선택을 쉽게 한다.

- 소스: [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
  (getdesign.md의 원본). 각 디자인 폴더는 `design-md/<name>/DESIGN.md` +
  `README.md`뿐 (총 74개, 평면 구조, manifest 없음). **리포지토리에
  preview.html은 없다** — 렌더된 미리보기는 getdesign.md 웹페이지
  `https://getdesign.md/<name>/design-md`에만 존재.
- 카테고리는 README `## Collection`의 `### <카테고리>` 표에만 존재.
  README 링크 URL `getdesign.md/<name>/design-md`의 `<name>`이 곧 GitHub 폴더명.
- **소스는 추가될 수 있다** — 프로바이더 추상화로 확장한다.

## 확정된 결정 사항

| 결정 | 내용 |
|---|---|
| 노출 방식 | **전용 모드 분리.** `install.mjs` 첫 화면에 모드 선택 추가(에이전트 설치 / design.md 라이브러리). 기존 plugin·mcp·skill 흐름 보존 |
| 저장 위치 | **제공자 스코프** `design-md/<provider>/<name>/DESIGN.md`. git 커밋 대상(팀 공유) |
| 중복 처리 | id·cache·설치 경로를 모두 `<provider>/<name>`로 스코프 → 동명 항목이 여러 제공자에 있어도 공존. `--set`/`--preview`는 `name` 또는 `provider/name`을 받고, 이름이 중복되면 제공자 지정을 요구 |
| 카탈로그 획득 | **번들 캐시 인덱스 + 동기화 갱신.** `catalog.json`을 동봉, "카탈로그 새로고침"이 소스에서 재생성 |
| 동기화 | 3작업: 설치본 업데이트 · 카탈로그 새로고침 · 오래된 항목 감지/알림 |
| 탐색 UI | 탭(카테고리 select) + 검색(텍스트→매칭 멀티셀렉트). 보이는 집합 안에서만 diff |
| 미리보기 | **브라우저로 getdesign.md 페이지 오픈(OS 레벨).** `https://getdesign.md/<name>/design-md` (사이트 자체 라이트/다크·Live Preview 제공). 다운로드 불필요 |
| 항목 모델 | design.md도 item 인터페이스(`detect/install/uninstall`)를 따르되 `lib/items/`가 아니라 캐시 인덱스에서 런타임 생성 → `engine.mjs` 재사용 |
| 오프라인 번들 | 74개 DESIGN.md를 `lib/design-md/cache/<provider>/<name>/DESIGN.md`에 동봉. 설치는 번들 우선(네트워크 0), 없으면 폴백. 업데이트/동기화는 `fresh`로 네트워크 최신. `npm run refresh-bundle`로 재생성 |

## 아키텍처

```text
agent-installer/
├─ install.mjs                     # 모드 선택 + design 서브커맨드/플래그 (기존 흐름 보존)
└─ lib/
   ├─ engine.mjs                   # scan → planChanges → apply (재사용, 변경 없음)
   ├─ context.mjs                  # repoPath 안전 가드 (재사용)
   └─ design-md/
      ├─ catalog.json              # 번들 캐시 인덱스 (동봉·커밋, 새로고침이 덮어씀)
      ├─ catalog.mjs               # 인덱스 로드/저장, defineDesignMd(entry, provider)
      ├─ flow.mjs                  # 대화형 UI: 탭/검색/미리보기/동기화 (@clack/prompts)
      ├─ open.mjs                  # makeOpener(주입 가능) + openPreview(webUrl)
      ├─ cache/<provider>/<name>/DESIGN.md  # 오프라인 번들 (동봉·커밋, npm run refresh-bundle)
      └─ providers/
         ├─ index.mjs              # 프로바이더 레지스트리 (소스 확장 지점)
         └─ awesome-design-md.mjs  # 1호 프로바이더 (GitHub raw + README 파싱 + bundledText)
   scripts/
      └─ refresh-bundle.mjs        # 번들 (재)생성 유지보수 스크립트
```

### 프로바이더 인터페이스

```js
// DesignMdProvider
{
  id: 'awesome-design-md',
  label: 'awesome-design-md (VoltAgent)',
  files: ['DESIGN.md'],              // 소스에 있는 파일(preview 없음)
  async fetchCatalog(fetch),         // → [{ name, label, category, description }]
  fileUrl(name, file),               // raw URL
  async fetchFile(fetch, name, file),// → string | null (404 등은 null)
  webUrl(name),                      // 웹 미리보기 URL (getdesign.md/<name>/design-md)
}
```

- 1호 = **awesome-design-md**: raw 파일 다운로드 + README 표 파싱으로 카테고리 부여.
  tree엔 있으나 README에 없는 항목은 `기타`.
- getdesign.md 등은 같은 인터페이스로 추후 추가(v1 범위 밖).
- `fetch`는 **주입 가능**(기본 전역 fetch) → 테스트에서 가짜로 대체, 실네트워크 없음.

### 캐시 인덱스 (`catalog.json`)

```jsonc
{
  "updatedAt": "2026-07-18T...",
  "providers": {
    "awesome-design-md": {
      "entries": [
        { "name": "stripe", "label": "Stripe",
          "category": "Fintech & Crypto", "description": "..." }
      ]
    }
  }
}
```

초기 `catalog.json`은 실제 소스에서 생성해 동봉한다(오프라인 즉시 동작).

## 대화형 흐름

```text
$ node install.mjs
◆ 무엇을 관리할까요?
│ ○ 에이전트 설치 (plugin · mcp · skill)   ← 기존 흐름 그대로
│ ● design.md 라이브러리
└
┌ design.md — 소스 awesome-design-md · 설치 N / 카탈로그 M
◆ 어떻게 찾을까요?
│ ○ 🗂  카테고리(탭)로 둘러보기
│ ○ 🔍 이름/키워드로 검색
│ ○ 🖼  미리보기로 둘러보기 (브라우저)
│ ○ ↻  동기화
└
```

- **카테고리(탭)**: 카테고리 select → 해당 항목 멀티셀렉트(설치본 미리 체크) →
  설치 전 "먼저 미리볼래요?"(선택) → 적용.
- **검색**: 텍스트 입력 → 이름·라벨·카테고리·설명 매칭 → 멀티셀렉트 → 적용.
- **미리보기**: 후보 좁히기 → 볼 항목 멀티셀렉트 → getdesign.md 페이지 브라우저 오픈 →
  "방금 본 항목 설치할까요?"로 설치 흐름 연결.
- **동기화**: [설치본 업데이트 / 카탈로그 새로고침 / 오래된 항목 확인] 중 선택.

**안전 규칙:** 검색·카테고리 뷰는 `planChanges(visibleStates, selected)`로
**보이는 항목 집합 안에서만** diff한다 — 화면 밖 설치본을 실수로 제거하지 않는다.

## 항목 메커니즘 (defineDesignMd)

- **id**: `design.<provider>.<name>` — 제공자별로 유일해 동명 항목이 붕괴하지 않는다.
- **detect**: `design-md/<provider>/<name>/DESIGN.md` 존재 → `installed`, 없으면 `absent`.
- **install**: 동봉 번들(`provider.bundledText`) 우선 → 없으면 프로바이더로 다운로드 →
  `design-md/<provider>/<name>/DESIGN.md` 저장. `fresh:true`(업데이트·오래된 항목 갱신)는
  번들을 건너뛰고 항상 네트워크 최신을 받는다.
- **uninstall**: `design-md/<provider>/<name>/` 디렉터리만 삭제.
- 경로는 `repoPath(root, ...)`로 저장소 밖 쓰기 차단. `provider`/`name`에 경로 구분자 금지.

## 미리보기 (open.mjs)

렌더된 미리보기는 getdesign.md 웹페이지에만 있으므로, 프로바이더의 `webUrl(name)`을
브라우저로 연다(라이트/다크·Live Preview는 사이트가 제공). 로컬 다운로드 없음.

```text
openPreview(opener, provider, name):
  url = provider.webUrl(name)     // https://getdesign.md/<name>/design-md
  url 없으면 → 안내(미리보기 미제공)
  있으면 opener(url)              // 실패 시 URL 출력해 수동 오픈 폴백
```

```js
export function makeOpener(dryRun, log) {
  return (target) => {
    if (dryRun) { log(`  [dry-run] open ${target}`); return { ok: true } }
    const [cmd, args] =
      process.platform === 'win32'  ? ['cmd', ['/c', 'start', '', target]] :
      process.platform === 'darwin' ? ['open', [target]] :
                                      ['xdg-open', [target]]
    try { execFileSync(cmd, args, { stdio: 'ignore' }); return { ok: true } }
    catch (err) { return { ok: false, output: err.message } }
  }
}
```

- 헤드리스/오픈 실패 시 URL을 출력해 수동 오픈 폴백.
- `--dry-run`: 실제로 열지 않고 대상 URL만 리포트.

## 동기화 3작업

- **설치본 업데이트**: 설치된 각 항목 파일을 원본 최신으로 재다운로드. `git diff`로 확인.
- **카탈로그 새로고침**: `fetchCatalog()` → `catalog.json` 재생성(덮어쓰기).
  신규 항목·새 소스·카테고리 반영.
- **오래된 항목 확인**: 설치본 `DESIGN.md`를 원본과 **해시 비교**해 변경분만 목록화 →
  골라서 업데이트. 폴더에 별도 메타파일을 남기지 않아 소스 트리와 동일 유지.

## 비대화형 (테스트/CI)

기존 `--list/--set/--dry-run`과 일관되게 design 서브커맨드에 부여:

- `node install.mjs design --list` (제공자별 그룹 출력)
- `node install.mjs design --set stripe,vercel` (목표 집합; `name` 또는 `provider/name`,
  이름 중복 시 `provider/name` 필요)
- `node install.mjs design --sync=installed|catalog|stale`
- `node install.mjs design --preview stripe,vercel` (getdesign.md 페이지 오픈)
- `--dry-run`

## 오류 처리·안전

- 네트워크 실패: 항목별 실패 후 나머지 계속, 마지막에 실패 리포트(기존 apply 패턴).
  카탈로그 없이 오프라인이면 "온라인에서 새로고침 필요" 안내.
- `repoPath` 저장소 밖 쓰기 차단(기존 원칙 재사용).
- 별도 백업 없음 — `design-md/`가 git 추적 대상이라 `git diff`가 안전망.
- `--dry-run`: 네트워크 쓰기·파일 쓰기·브라우저 오픈 없이 예정 동작만 리포트.

## 테스트

- **실네트워크 없음** — 프로바이더 `fetch`·`makeOpener`를 주입해 대체.
- 단위:
  - README 파싱 → 카테고리 인덱스 (fixture)
  - `defineDesignMd` detect/install/uninstall (임시 git 저장소 쓰기·삭제)
  - 검색/카테고리 diff가 보이는 집합에만 적용
  - 오래된 항목 해시 비교
  - `openPreview`가 `webUrl`로 opener 호출, webUrl 없으면 안내
  - `makeOpener` 올바른 target 호출, dry-run 미오픈
- E2E: 임시 저장소에서 `design --set stripe` → detect installed → `--set ""` 제거 →
  absent, `--dry-run` 무변경.
- 기존 `agent-installer/test/*.test.mjs` (`node --test`)·`helpers.mjs` 재사용.

## 범위 제외 (v1)

- getdesign.md 스크래핑 프로바이더(인터페이스만 열어둠)
- 사용자 글로벌 설치, 항목별 대상 CLI 선택(design.md는 CLI 무관 마크다운)
- preview 스크린샷/썸네일 생성
