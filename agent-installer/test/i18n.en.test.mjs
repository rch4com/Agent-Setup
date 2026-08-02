import test from 'node:test'
import assert from 'node:assert/strict'
import { createT } from '../lib/i18n/index.mjs'
import { bootstrapUsage, rootUsage, designUsage, updateUsage, statusUsage } from '../lib/args.mjs'
import { itemRows, makeTempRepo, nameColumn, runInstaller } from './helpers.mjs'

// 번역 누락의 본질은 "어디를 빠뜨렸는지 모른다"이다.
// 영어 로케일 출력에 한글이 하나라도 있으면 그 자리가 누락이다.
const HANGUL = /[가-힣]/

export function assertNoHangul(text, what) {
  const m = HANGUL.exec(String(text))
  if (!m) return
  const at = Math.max(0, m.index - 40)
  assert.fail(`${what}에 한글이 남아 있습니다 (위치 ${m.index}): …${String(text).slice(at, m.index + 40)}…`)
}

test('영어 사용법 다섯 종에 한글이 없다', () => {
  const t = createT('en')
  for (const [name, fn] of Object.entries({ bootstrapUsage, rootUsage, designUsage, updateUsage, statusUsage })) {
    assertNoHangul(fn(t), name)
  }
})

const EN = { AGENT_SETUP_LANG: 'en' }

test('영어 부트스트랩 dry-run 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['bootstrap', '--dry-run'], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  assertNoHangul(r.stdout, 'bootstrap --dry-run stdout')
  assertNoHangul(r.stderr, 'bootstrap --dry-run stderr')
})

test('영어 부트스트랩 실제 실행 출력에 한글이 없다', () => {
  // dry-run은 "파일 생성" 분기만 밟는다. 두 번 돌려 "기존 파일 유지"·
  // "관리 블록 확인" 같은 멱등 분기까지 훑어야 누락이 드러난다.
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const second = runInstaller(root, ['bootstrap'], { env: EN })
  assert.equal(second.status, 0, second.stderr)
  assertNoHangul(second.stdout, 'bootstrap 2회차 stdout')
})

test('영어 status와 --list 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  for (const args of [['status'], ['--list']]) {
    const r = runInstaller(root, args, { env: EN })
    assert.equal(r.status, 0, r.stderr)
    assertNoHangul(r.stdout, args.join(' '))
  }
})

// design --list는 assertNoHangul을 걸지 않는다: 항목 라벨·설명·카테고리는
// design.md 데이터에서 온다(예: 사내 소스로 번들된 실제 한국어 디자인
// 시스템 문서). 데이터는 어떤 언어든 담을 수 있고 그건 번역 누락이 아니다
// — 그래서 "한글이 없다"가 아니라 "우리 문구가 영어로 나온다"를 본다.
//
// 항목을 하나 설치해 두고 본다. 빈 저장소에서는 모든 항목이 absent라
// 'Installed'와 'Not installed'가 나란히 찍힌 적이 한 번도 없었고, 그래서
// 두 라벨의 길이 차이에서 오는 열 어긋남이 이 스위트를 그대로 통과했다.
test('영어 design --list의 UI 문구가 영어로 나오고 열이 맞는다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  assert.equal(runInstaller(root, ['design', '--set', 'stripe'], { env: EN }).status, 0)

  const r = runInstaller(root, ['design', '--list'], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  for (const ours of ['미설치', '설치됨', '일부 설치됨', '기타', '사내']) {
    assert.doesNotMatch(r.stdout, new RegExp(ours), `우리 문구가 한국어로 남았습니다: ${ours}`)
  }

  // 두 상태가 실제로 함께 찍혔는가 — 이게 아니면 아래 정렬 검사는 공회전이다.
  const installed = itemRows(r.stdout, 'Installed')
  const absent = itemRows(r.stdout, 'Not installed')
  assert.ok(installed.length > 0, "'Installed' 행이 없다 — design --set이 듣지 않았다")
  assert.ok(absent.length > 0, "'Not installed' 행이 없다")

  // 'Installed'(9칸)와 'Not installed'(13칸)는 길이가 다르다. 상태 열 폭이
  // 라벨보다 좁으면(padEnd(4)) 채움이 아예 일어나지 않아 이름 열이 어긋난다.
  const columns = new Set([...installed, ...absent].map(nameColumn))
  assert.equal(columns.size, 1, `이름 열이 행마다 다른 칸에서 시작한다: ${[...columns].join(', ')}`)
})

// TTY가 아니면 TUI는 목록만 찍고 끝난다 — CI가 늘 밟는 경로다. 이 목록에는
// design.md 항목의 실제 라벨·설명도 섞이는데, 그건 데이터라 어떤 언어든
// 담을 수 있다(예: 이 저장소에 번들된 한국어 회사의 디자인 시스템 문서) —
// design --list 테스트와 같은 이유로 assertNoHangul 대신 "우리 문구가
// 영어로 나온다"만 확인한다.
test('영어 비대화형 목록 출력의 UI 문구가 영어로 나온다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, [], { env: EN })
  assert.equal(r.status, 0, r.stderr)

  // 섹션 헤더 여섯 개 전부. PLUGIN·MCP·SKILL·CONFIG·DESIGN.MD는 두 로케일 값이 같아서
  // 아래 한국어 부재 검사로는 raw id(`[mcp]`) 유출조차 잡히지 않는다 — 긍정
  // 단언으로만 잡힌다.
  for (const header of ['[ACTION]', '[PLUGIN]', '[MCP]', '[SKILL]', '[CONFIG]', '[DESIGN.MD]']) {
    assert.ok(r.stdout.includes(header), `섹션 헤더 없음: ${header}`)
  }

  // 액션 라벨 네 개와 힌트 네 개 전부 — 이 문구는 design.md 데이터가 아니라
  // 우리 카탈로그 값이라 전수 검사해도 데이터 위험이 없다.
  for (const label of ['Run bootstrap', 'Update installed', 'Refresh catalog', 'Check stale']) {
    assert.ok(r.stdout.includes(label), `액션 라벨 없음: ${label}`)
  }
  for (const hint of ['per-tool config', 'refetch installed', 'rebuild the design.md list', 'compare installed copies']) {
    assert.ok(r.stdout.includes(hint), `액션 힌트 없음: ${hint}`)
  }

  assert.match(r.stdout, /interactive screen only opens in a terminal/)

  // 한국어 부재 — 두 로케일에서 값이 갈리는 문구만 의미가 있다.
  // PLUGIN·MCP·SKILL·DESIGN.MD는 로케일이 같은 값이라 여기 넣어도 무의미하다.
  for (const ours of [
    '[작업]', '부트스트랩 실행', '설치본 업데이트', '카탈로그 새로고침', '오래된 항목 확인',
    '도구별 설정', '원본 최신으로 다시 받는다', '목록·카테고리를 소스에서', '설치본을 원본과 해시 비교한다',
    '대화형 화면은 터미널에서만',
  ]) {
    assert.equal(r.stdout.includes(ours), false, `우리 문구가 한국어로 남았습니다: ${ours}`)
  }
})

test('영어 update dry-run 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const r = runInstaller(root, ['update', '--dry-run'], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  assertNoHangul(r.stdout, 'update --dry-run')
})

// 오류 경로는 design.md 데이터를 찍지 않는다 — 사용법 텍스트·인자 검증
// 메시지·기록 오류뿐이라 전부 우리 카탈로그 문구다. assertNoHangul을
// 그대로 걸어도 데이터 오탐 위험이 없다.
test('영어 오류 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  const cases = [
    ['--dryrun'],                    // 알 수 없는 인자
    ['--list', '--set', 'x'],        // 동작 플래그 중복
    ['--skill-mode', 'nope'],        // 잘못된 값
    ['--lang', 'zz'],                // 지원하지 않는 로케일
    ['--set', 'no.such.item'],       // 알 수 없는 항목
    ['design', '--sync=nope'],       // 잘못된 sync
    ['update'],                      // 기록 없음(부트스트랩 전이라 없다)
  ]
  for (const args of cases) {
    const r = runInstaller(root, args, { env: EN })
    assert.notEqual(r.status, 0, `${args.join(' ')}는 실패해야 한다`)
    assertNoHangul(r.stderr, `${args.join(' ')} stderr`)
    assertNoHangul(r.stdout, `${args.join(' ')} stdout`)
  }
})

// --set이 다루는 항목(mcp.notion 등)은 lib/items의 우리 카탈로그 라벨이다
// — design.md처럼 외부 문서에서 온 데이터가 아니므로 여기도 안전하게
// assertNoHangul을 건다.
test('영어 --set 적용 출력에 한글이 없다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const on = runInstaller(root, ['--set', 'mcp.notion'], { env: EN })
  assert.equal(on.status, 0, on.stderr)
  assertNoHangul(on.stdout, '--set 설치')
  const off = runInstaller(root, ['--set', ''], { env: EN })
  assert.equal(off.status, 0, off.stderr)
  assertNoHangul(off.stdout, '--set 제거')
})
