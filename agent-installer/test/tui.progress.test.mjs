import test from 'node:test'
import assert from 'node:assert/strict'
import { createProgress, applyEvent, progressLines, plainLine } from '../lib/tui/progress.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'

const T = createT('ko')
const CHANGES = [
  { item: { id: 'a', label: 'Alpha' }, action: 'install' },
  { item: { id: 'b', label: 'Bravo' }, action: 'install' },
  { item: { id: 'c', label: 'Caesar' }, action: 'uninstall' },
]

function feed(events, now = 1000) {
  let p = createProgress(CHANGES)
  for (const e of events) p = applyEvent(p, { total: CHANGES.length, ...e }, now)
  return p
}

test('시작 전에는 0%다', () => {
  const text = progressLines(createProgress(CHANGES), { width: 60, height: 20, now: 0, t: T }).join('\n')
  assert.match(text, /0\/3/)
  assert.match(text, /변경 3건/)
})

test('완료 수만큼 백분율이 오른다', () => {
  const p = feed([
    { index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' },
    { index: 0, phase: 'done', item: CHANGES[0].item, action: 'install', ok: true, ms: 400 },
  ])
  const text = progressLines(p, { width: 60, height: 20, now: 2000, t: T }).join('\n')
  assert.match(text, /1\/3/)
  assert.match(text, /33%/)
})

// 지금 무엇이 도는지가 가장 알고 싶은 정보다.
test('실행 중 항목과 명령을 보여 준다', () => {
  const p = feed([
    { index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' },
    { index: 0, phase: 'command', item: CHANGES[0].item, action: 'install', command: 'npx -y thing' },
  ], 1000)
  const text = progressLines(p, { width: 60, height: 20, now: 15000, t: T }).join('\n')
  assert.match(text, /Alpha/)
  assert.match(text, /npx -y thing/)
  assert.match(text, /14초 경과/)
})

test('실패는 실패로 표시된다', () => {
  const p = feed([
    { index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' },
    { index: 0, phase: 'done', item: CHANGES[0].item, action: 'install', ok: false, ms: 100 },
  ])
  assert.match(progressLines(p, { width: 60, height: 20, now: 2000, t: T }).join('\n'), /✖/)
})

test('중단하면 건너뛴 건수를 알린다', () => {
  let p = feed([{ index: 0, phase: 'done', item: CHANGES[0].item, action: 'install', ok: true, ms: 10 }])
  p = { ...p, aborted: true }
  assert.match(progressLines(p, { width: 60, height: 20, now: 2000, t: T }).join('\n'), /건너뜀/)
})

test('어느 줄도 폭을 넘지 않고 높이를 넘지 않는다', () => {
  const p = feed([{ index: 0, phase: 'start', item: CHANGES[0].item, action: 'install' }])
  const lines = progressLines(p, { width: 40, height: 8, now: 2000, t: T })
  // 상한만 두면 빈 배열이 통과한다 — 실제로 그렸는지도 함께 못박는다.
  assert.ok(lines.length > 0 && lines.length <= 8, `줄 수 ${lines.length}`)
  assert.ok(lines.join('\n').includes('Alpha'), '실행 중 항목이 그려져야 한다')
  for (const line of lines) assert.ok(width(line) <= 40, `넘침: ${line}`)
})

// 지면이 모자라면 완료된 것을 접는다 — 지금 도는 것이 사라지면 안 된다.
test('지면이 모자라면 실행 중 항목이 살아남는다', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ item: { id: `i${i}`, label: `Item${i}` }, action: 'install' }))
  let p = createProgress(many)
  for (let i = 0; i < 25; i++) {
    p = applyEvent(p, { total: 30, index: i, phase: 'done', item: many[i].item, action: 'install', ok: true, ms: 10 }, 1000)
  }
  p = applyEvent(p, { total: 30, index: 25, phase: 'start', item: many[25].item, action: 'install' }, 1000)
  const text = progressLines(p, { width: 60, height: 8, now: 2000, t: T }).join('\n')
  assert.match(text, /Item25/)
})

// CI 로그에 ANSI 제어문자를 흘리지 않는다.
test('비TTY 평문은 항목마다 한 줄씩만 낸다', () => {
  const start = plainLine({ index: 0, total: 3, phase: 'start', item: CHANGES[0].item, action: 'install' }, T)
  assert.match(start, /\[1\/3\]/)
  assert.match(start, /Alpha/)
  assert.ok(!start.includes(String.fromCharCode(27)), 'ANSI 제어문자가 없어야 한다')
  // 명령 알림은 평문에서 버린다 — 한 항목이 여러 줄로 흩어지면 로그가 읽히지 않는다.
  assert.equal(plainLine({ index: 0, total: 3, phase: 'command', command: 'x' }, T), null)
  assert.match(plainLine({ index: 0, total: 3, phase: 'done', ok: true, ms: 21800 }, T), /21\.8초/)
})
