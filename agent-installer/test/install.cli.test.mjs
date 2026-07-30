import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, runInstaller } from './helpers.mjs'

// 프로세스 레벨에서만 드러나는 계약을 검증한다: 종료 코드, 스트림 분리,
// 실패했을 때 아무것도 남기지 않는 것, 그리고 멈추지 않는 것.
// 인자 파싱 자체는 args.test.mjs가 훨씬 싸게 덮는다.

function untouched(root) {
  // git init 직후의 저장소에는 .git만 있다.
  return readdirSync(root).filter((n) => n !== '.git')
}

// ── 멈춤 방지 ─────────────────────────────────────────────────────

// 이 저장소에서 가장 값비싼 회귀다. TUI가 비TTY를 감지하지 못하면
// `node install.mjs`가 키 입력을 기다리며 영원히 멈추고, CI 전체가 함께 멈춘다.
test('인자 없이 비TTY로 실행하면 목록만 내고 즉시 끝난다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, [], { timeout: 30000 })

  assert.notEqual(r.status, null, '시간 초과 — 설치기가 입력을 기다리며 멈췄다')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\[작업\]/)
  assert.match(r.stdout, /대화형 화면은 터미널에서만/)
  assert.deepEqual(untouched(root), [], '읽기만 해야 하는데 파일이 생겼다')
})

test('--dry-run도 비TTY에서 멈추지 않고 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--dry-run'])

  assert.notEqual(r.status, null, '시간 초과')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(untouched(root), [])
})

// ── 종료 코드 ─────────────────────────────────────────────────────

// 같은 사용자 오류가 경로에 따라 다른 코드로 끝나면 스크립트가 분기할 수 없다.
// 예전에는 최상위 --set만 exit 2였다.
test('--set 값 누락은 최상위와 design에서 같은 코드로 끝난다', () => {
  const root = makeTempRepo()
  const top = runInstaller(root, ['--set'])
  const design = runInstaller(root, ['design', '--set'])

  assert.equal(top.status, design.status, `최상위 ${top.status} vs design ${design.status}`)
  assert.equal(top.status, 1)
  for (const r of [top, design]) assert.match(r.stderr, /Use --set "" to remove everything/)
  assert.deepEqual(untouched(root), [])
})

test('실패는 모두 exit 1이고 메시지는 stderr로 나간다', () => {
  const root = makeTempRepo()
  const cases = [
    [['--set', 'does-not-exist'], /알 수 없는 항목/],
    [['design', '--sync=nope'], /--sync=installed\|catalog\|stale/],
    [['design', '--preview'], /needs a value/],
    [['bootstrap', '--totally-unknown'], /Unknown argument/],
  ]
  for (const [args, pattern] of cases) {
    const r = runInstaller(root, args)
    assert.equal(r.status, 1, `${args.join(' ')} → ${r.status}`)
    assert.match(r.stderr, pattern, args.join(' '))
    assert.equal(r.stdout, '', `${args.join(' ')}: 실패인데 stdout에 출력이 있다`)
  }
  assert.deepEqual(untouched(root), [], '실패했는데 파일이 생겼다')
})

// ── 성공 경로 ─────────────────────────────────────────────────────

test('--list는 상태와 함께 목록을 내고 아무것도 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--list'])

  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /미설치\s+mcp\.notion/)
  assert.deepEqual(untouched(root), [])
})

test('design --list는 제공자별로 묶어 낸다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['design', '--list'])

  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\[awesome-design-md\]/)
  assert.match(r.stdout, /stripe — Stripe/)
  assert.deepEqual(untouched(root), [])
})

test('design --set은 파일을 만들고 --set ""은 되돌린다', () => {
  const root = makeTempRepo()
  const target = join(root, 'design-md', 'awesome-design-md', 'stripe', 'DESIGN.md')

  assert.equal(runInstaller(root, ['design', '--set', 'stripe']).status, 0)
  assert.ok(existsSync(target), 'design --set이 파일을 만들지 않았다')

  assert.equal(runInstaller(root, ['design', '--set', '']).status, 0)
  assert.equal(existsSync(target), false, 'design --set ""이 되돌리지 않았다')
})

test('design --set --dry-run은 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['design', '--set', 'stripe', '--dry-run'])

  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(untouched(root), [])
})
