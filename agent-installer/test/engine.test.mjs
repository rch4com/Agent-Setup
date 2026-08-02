import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { planChanges, apply } from '../lib/engine.mjs'
import { defineMcp } from '../lib/catalog.mjs'
import { createT, toText, LocalizedError } from '../lib/i18n/index.mjs'
import { makeTempRepo, makeCapture } from './helpers.mjs'

function fake(id, status) {
  return { item: { id, label: id }, status }
}

test('planChanges: absent+체크=install, installed+해제=uninstall', () => {
  const states = [fake('a', 'absent'), fake('b', 'installed'), fake('c', 'installed')]
  const changes = planChanges(states, new Set(['a', 'c']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['a', 'install'], ['b', 'uninstall']],
  )
})

test('planChanges: partial+체크 유지=complete, partial+해제=uninstall', () => {
  const states = [fake('p1', 'partial'), fake('p2', 'partial')]
  const changes = planChanges(states, new Set(['p1']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['p1', 'complete'], ['p2', 'uninstall']],
  )
})

test('planChanges: 변경 없으면 빈 배열', () => {
  const states = [fake('a', 'installed'), fake('b', 'absent')]
  assert.deepEqual(planChanges(states, new Set(['a'])), [])
})

// 파일을 직접 쓰는 항목은 exec를 거치지 않는다. log를 넘기지 않으면 dry-run이
// "✔ 설치"라고만 찍고 무엇이 바뀔지는 하나도 알려 주지 않는다.
test('apply dry-run: 파일을 쓰는 항목도 예정 동작을 보고하고 아무것도 만들지 않는다', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const item = defineMcp({
    id: 'mcp.demo', label: 'Demo MCP',
    server: { kind: 'http', url: 'https://example.com/mcp' },
  })

  // apply()의 t 기본값은 영어다 — 이 단언은 기존 한국어 문구를 그대로
  // 검사하므로 한국어를 명시로 고정한다.
  const results = await apply(root, [{ item, action: 'install' }], { dryRun: true, log: cap.log, t: createT('ko') })

  assert.equal(results[0].ok, true)
  assert.match(cap.text(), /\[dry-run\] Claude Code 설정에 demo 등록/)
  assert.match(cap.text(), /\[dry-run\] VS Code Copilot 설정에 demo 등록/)
  assert.equal(existsSync(join(root, '.mcp.json')), false, 'dry-run은 파일을 만들지 않는다')
})

// 회귀: apply()의 catch가 LocalizedError를 그냥 err.message로 되돌리면
// (또는 partial의 detail이 평문 템플릿으로 되돌아가면) 이 테스트만으로는
// 안 잡히는 게 아니라 정확히 이 테스트가 잡아야 한다 — Task 6이 막으려던
// [object Object] 버그의 핵심 지점이다.
test('apply: install이 LocalizedError를 던지면 message가 구조화 메시지로 남고 렌더된다', async () => {
  const root = makeTempRepo()
  const item = {
    id: 'fake.err', label: 'Fake',
    async install() { throw new LocalizedError('error.itemReasonMissing', { id: 'fake.err', cli: 'codex' }) },
    async uninstall() {},
  }

  const results = await apply(root, [{ item, action: 'install' }], { dryRun: false })

  assert.equal(results[0].ok, false)
  // 문자열로 되돌아가면(err.message) 이 두 단언이 깨진다 — LocalizedError.message는
  // 항상 영어 문자열이라 typeof는 여전히 'string'이지만 .key가 없다.
  assert.equal(typeof results[0].message, 'object')
  assert.equal(results[0].message.key, 'error.itemReasonMissing')
  assert.deepEqual(results[0].message.params, { id: 'fake.err', cli: 'codex' })

  // 구조체이기만 하고 못 풀리면 소용없다 — 실제로 활성 로케일로 렌더되는지까지 본다.
  const ko = toText(createT('ko'), results[0].message)
  assert.match(ko, /codex/)
  assert.match(ko, /사유/)
  const en = toText(createT('en'), results[0].message)
  assert.match(en, /codex/)
  assert.match(en, /reason/)
})

// 짝을 이루는 반대 분기: 키 없는 일반 오류는 여전히 문자열로 남아야 한다 —
// 전부 msg()로 감싸 버리면 toText가 깨지진 않지만 err.params가 없어 다른
// 방식으로 깨진다. 두 분기를 갈라서 확인한다.
test('apply: 키 없는 일반 오류는 message가 문자열로 남는다', async () => {
  const root = makeTempRepo()
  const item = {
    id: 'fake.plain', label: 'Fake2',
    async install() { throw new Error('그냥 실패') },
    async uninstall() {},
  }

  const results = await apply(root, [{ item, action: 'install' }], { dryRun: false })

  assert.equal(results[0].ok, false)
  assert.equal(typeof results[0].message, 'string')
  assert.equal(results[0].message, '그냥 실패')
})

function fakeItem(id, { fails = false, runs = null } = {}) {
  return {
    id, label: id, category: 'mcp', scope: 'project', supports: ['claude'], unsupported: {},
    async detect() { return { status: 'absent' } },
    async install(ctx) {
      if (runs) await ctx.exec(runs[0], runs.slice(1))
      if (fails) throw new Error('boom')
    },
    async uninstall() {},
  }
}

test('항목마다 시작과 끝을 알린다', async () => {
  const changes = [
    { item: fakeItem('a'), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
  ]
  const events = []
  await apply('/tmp/x', changes, { dryRun: true, log: () => {}, onProgress: (e) => events.push(e) })
  assert.deepEqual(events.map((e) => `${e.phase}:${e.item.id}`), ['start:a', 'done:a', 'start:b', 'done:b'])
  assert.deepEqual(events.filter((e) => e.phase === 'start').map((e) => e.index), [0, 1])
  assert.equal(events[0].total, 2)
})

test('실패해도 다음 항목으로 이어지고 done이 그 사실을 담는다', async () => {
  const changes = [
    { item: fakeItem('a', { fails: true }), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
  ]
  const events = []
  const results = await apply('/tmp/x', changes, { dryRun: true, log: () => {}, onProgress: (e) => events.push(e) })
  assert.equal(events.find((e) => e.phase === 'done' && e.item.id === 'a').ok, false)
  assert.equal(results.length, 2)
})

// 화면이 "지금 무엇이 도는가"를 보여 줄 수 있는 유일한 경로다.
test('실행 직전에 명령을 알린다', async () => {
  const changes = [{ item: fakeItem('a', { runs: ['npx', '-y', 'thing'] }), action: 'install' }]
  const events = []
  await apply('/tmp/x', changes, { dryRun: true, log: () => {}, onProgress: (e) => events.push(e) })
  const cmd = events.find((e) => e.phase === 'command')
  assert.equal(cmd.command, 'npx -y thing')
})

// 외부 명령을 중간에 죽이면 반쯤 설치된 상태가 남는다. 그래서 항목 경계에서만 멈춘다.
// skipped는 실패가 아니다 — 소비자가 실제로 쓰는 필터(!r.ok && !r.skipped)까지 직접 확인한다.
test('중단 요청은 현재 항목을 마친 뒤 나머지를 건너뛴다', async () => {
  const changes = [
    { item: fakeItem('a'), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
    { item: fakeItem('c'), action: 'install' },
  ]
  let seen = 0
  const results = await apply('/tmp/x', changes, {
    dryRun: true, log: () => {},
    onProgress: (e) => { if (e.phase === 'done') seen++ },
    shouldStop: () => seen >= 1,
  })
  // a는 취소 전에 이미 시작해 방해 없이 끝까지 돈다 — skipped 필드 자체가 없다.
  assert.equal(results[0].item.id, 'a')
  assert.equal(results[0].ok, true)
  assert.equal(results[0].skipped, undefined)
  // b·c는 시도조차 하지 않았다 — 원래 순서 그대로 skipped: true로 남는다.
  assert.equal(results[1].item.id, 'b')
  assert.equal(results[1].skipped, true)
  assert.equal(results[2].item.id, 'c')
  assert.equal(results[2].skipped, true)
  assert.equal(results.filter((r) => r.skipped).length, 2)
  // 취소로 건너뛴 항목은 "진짜 실패"가 아니다 — 소비자가 exitCode·✖ 표시에 쓰는
  // 필터로 걸러도 0이어야 한다.
  assert.equal(results.filter((r) => !r.ok && !r.skipped).length, 0)
})

test('onProgress 없이도 예전과 같이 동작한다', async () => {
  const changes = [{ item: fakeItem('a'), action: 'install' }]
  const results = await apply('/tmp/x', changes, { dryRun: true, log: () => {} })
  assert.equal(results.length, 1)
  assert.equal(results[0].ok, true)
})

// onProgress는 훗날 실제 렌더러가 될 자리다(Task 11) — 렌더링 버그가 설치를
// 망가뜨리거나 결과를 삼키면 안 된다. command 단계(exec 안)까지 던지게 해서
// 세 단계(start/command/done) 전부가 감싸져 있는지 함께 확인한다.
test('onProgress가 던져도 결과 배열은 온전히 반환된다', async () => {
  const changes = [
    { item: fakeItem('a', { runs: ['npx', '-y', 'thing'] }), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
  ]
  const results = await apply('/tmp/x', changes, {
    dryRun: true, log: () => {},
    onProgress: () => { throw new Error('렌더러 버그') },
  })
  assert.equal(results.length, 2)
  assert.equal(results[0].ok, true)
  assert.equal(results[1].ok, true)
})

// shouldStop이 던지면 "멈추지 않음"으로 취급해야 한다 — UI 술어의 버그로
// 설치 전체가 중단되면, 알림 하나 놓치는 것보다 훨씬 나쁘다.
test('shouldStop이 던져도 계속 진행한다', async () => {
  const changes = [
    { item: fakeItem('a'), action: 'install' },
    { item: fakeItem('b'), action: 'install' },
  ]
  const results = await apply('/tmp/x', changes, {
    dryRun: true, log: () => {},
    shouldStop: () => { throw new Error('술어 버그') },
  })
  assert.equal(results.length, 2)
  assert.equal(results.filter((r) => r.skipped).length, 0)
  assert.equal(results.every((r) => r.ok), true)
})
