import test from 'node:test'
import assert from 'node:assert/strict'
import { render, bodyHeight, panelHeight } from '../lib/tui/render.mjs'
import { createState, move } from '../lib/tui/state.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'

const T = createT('ko')

function row(id, label, supports) {
  return {
    kind: 'item', id, section: 'mcp', group: null, label,
    hint: '미설치', fullHint: '미설치', statusDetail: null, status: 'absent',
    previewTarget: null, searchText: `${id} ${label}`.toLowerCase(),
    item: { id, category: 'mcp', label, scope: 'project', supports, unsupported: {} },
  }
}

const ROWS = [row('mcp.a', 'Alpha', ['claude']), row('mcp.b', 'Bravo', ['claude', 'codex'])]

// 커서를 옮길 때마다 패널 높이가 변하면 목록이 위아래로 출렁인다.
// 아코디언을 기각한 이유가 바로 그것이라, 높이는 터미널 크기로만 정한다.
test('패널 높이는 커서 위치와 무관하다', () => {
  const a = createState(ROWS)
  const b = move(a, 1)
  const at = (s) => render(s, { width: 80, height: 30, t: T }).length
  assert.equal(at(a), at(b))
  assert.equal(panelHeight(30), panelHeight(30))
})

test('지면이 넉넉하면 목록과 패널이 화면을 나눠 갖는다', () => {
  assert.ok(panelHeight(30) >= 4)
  assert.equal(bodyHeight(30) + panelHeight(30), 30 - 6)
})

// 목록이 3줄 밑으로 내려가는 쪽이 패널이 사라지는 것보다 나쁘다.
test('낮은 터미널에서는 패널이 사라지고 목록이 지면을 다 쓴다', () => {
  assert.equal(panelHeight(12), 0)
  assert.equal(bodyHeight(12), 12 - 6)
})

test('패널을 펼치면 목록 자리를 전부 가져간다', () => {
  assert.equal(bodyHeight(30, true), 0)
  assert.equal(panelHeight(30, true), 30 - 6)
})

test('화면 줄 수는 터미널 높이를 넘지 않고 어느 줄도 폭을 넘지 않는다', () => {
  const lines = render(createState(ROWS), { width: 60, height: 30, t: T })
  // 위아래 경계를 모두 잡는다 — 상한만 두면 빈 화면이 통과한다.
  assert.equal(lines.length, 30, `줄 수 ${lines.length}`)
  for (const line of lines) assert.ok(width(line) <= 60, `넘침: ${line}`)
})

test('커서 항목의 상세가 화면에 담긴다', () => {
  const text = render(createState(ROWS), { width: 60, height: 30, t: T }).join('\n')
  assert.match(text, /Alpha/)
  assert.match(text, /claude/)
})

test('고를 항목이 없으면 안내를 낸다', () => {
  const text = render(createState([]), { width: 60, height: 30, t: T }).join('\n')
  assert.match(text, /커서를 항목 위에/)
})
