import test from 'node:test'
import assert from 'node:assert/strict'
import { createT } from '../lib/i18n/index.mjs'
import { bootstrapUsage, rootUsage, designUsage, updateUsage, statusUsage } from '../lib/args.mjs'
import { makeTempRepo, runInstaller } from './helpers.mjs'

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
test('영어 design --list의 UI 문구가 영어로 나온다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: EN })
  const r = runInstaller(root, ['design', '--list'], { env: EN })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Not installed/)
  for (const ours of ['미설치', '설치됨', '일부 설치됨', '기타', '사내']) {
    assert.doesNotMatch(r.stdout, new RegExp(ours), `우리 문구가 한국어로 남았습니다: ${ours}`)
  }
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
  assert.match(r.stdout, /\[ACTION\]/)
  assert.match(r.stdout, /Run bootstrap/)
  assert.match(r.stdout, /interactive screen only opens in a terminal/)
  for (const ours of ['[작업]', '부트스트랩 실행', '대화형 화면은 터미널에서만']) {
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
