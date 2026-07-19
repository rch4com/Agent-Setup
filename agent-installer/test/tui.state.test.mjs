import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createState, filterRows, setQuery, move, toggle, currentRow, displayList, scroll, replaceRows,
} from '../lib/tui/state.mjs'

function item(id, section, label, hint = '') {
  return { kind: 'item', id, section, label, hint, status: 'absent', searchText: `${label} ${hint} ${section}`.toLowerCase() }
}
function action(id, label) {
  return { kind: 'action', id, section: '작업', label, hint: '', searchText: `${label} 작업`.toLowerCase() }
}

const ROWS = [
  action('action.bootstrap', '부트스트랩 실행'),
  item('plugin.a', 'PLUGIN', 'Superpowers', 'claude 전용'),
  item('mcp.b', 'MCP', 'Supabase', 'dark postgres'),
  item('design.stripe', 'DESIGN.MD', 'Stripe', 'fintech dark'),
  item('design.linear', 'DESIGN.MD', 'Linear', 'productivity'),
]

test('빈 검색어는 전체 통과한다 — 초기 화면이 곧 빈 검색어다', () => {
  assert.equal(filterRows(ROWS, '').length, ROWS.length)
  assert.equal(filterRows(ROWS, undefined).length, ROWS.length)
  assert.equal(filterRows(ROWS, '   ').length, ROWS.length)
})

test('검색은 섹션을 가로지르고 토큰을 AND로 묶는다', () => {
  assert.deepEqual(filterRows(ROWS, 'dark').map((r) => r.id), ['mcp.b', 'design.stripe'])
  assert.deepEqual(filterRows(ROWS, 'dark fintech').map((r) => r.id), ['design.stripe'])
  assert.deepEqual(filterRows(ROWS, 'zzz').map((r) => r.id), [])
})

test('액션 행도 검색에 걸린다', () => {
  assert.deepEqual(filterRows(ROWS, '부트스트랩').map((r) => r.id), ['action.bootstrap'])
})

test('커서는 양 끝에서 멈춘다 — 순환하면 74개 목록에서 길을 잃는다', () => {
  let s = createState(ROWS)
  assert.equal(move(s, -1).cursor, 0)
  s = move(s, 99)
  assert.equal(s.cursor, ROWS.length - 1)
  assert.equal(move(s, 1).cursor, ROWS.length - 1)
})

test('커서는 필터 결과의 행만 가리킨다 — 섹션 헤더에는 설 수 없다', () => {
  const s = createState(ROWS)
  for (let i = 0; i < ROWS.length; i++) {
    assert.equal(currentRow(move(s, i)).kind !== undefined, true)
    assert.notEqual(currentRow(move(s, i)).type, 'header')
  }
})

test('필터를 바꿔도 선택이 유지된다 — 화면 밖 설치본이 조용히 사라지면 안 된다', () => {
  let s = createState(ROWS, { selectedIds: ['plugin.a'] })
  s = setQuery(s, 'stripe')
  s = toggle(s) // 필터된 화면에서 stripe를 켠다
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'plugin.a'])

  s = setQuery(s, 'linear')
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'plugin.a'])

  s = setQuery(s, '')
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'plugin.a'])
})

test('액션 행은 토글되지 않는다 — 제거 개념이 없는 작업이다', () => {
  const s = createState(ROWS)
  assert.equal(currentRow(s).kind, 'action')
  assert.equal(toggle(s).selected.size, 0)
})

test('토글은 같은 행에서 켜고 끈다', () => {
  let s = move(createState(ROWS), 1)
  s = toggle(s)
  assert.deepEqual([...s.selected], ['plugin.a'])
  s = toggle(s)
  assert.deepEqual([...s.selected], [])
})

test('검색어를 바꾸면 커서가 첫 행으로 돌아간다', () => {
  let s = move(createState(ROWS), 3)
  assert.equal(s.cursor, 3)
  s = setQuery(s, 'design')
  assert.equal(s.cursor, 0)
})

test('displayList: 비는 섹션은 헤더째 사라지고, 남은 섹션은 부분 개수를 보인다', () => {
  const s = setQuery(createState(ROWS), 'dark')
  const list = displayList(s)
  const headers = list.filter((e) => e.type === 'header')
  assert.deepEqual(headers.map((h) => h.section), ['MCP', 'DESIGN.MD'])
  assert.deepEqual(headers.map((h) => [h.shown, h.total]), [[1, 1], [1, 2]])
})

test('scroll: 커서가 창 밖으로 나가면 offset이 따라가고, 안에 있으면 그대로 둔다', () => {
  let s = createState(ROWS)
  assert.equal(scroll(s, 20).offset, 0)

  s = move(s, ROWS.length - 1)
  const scrolled = scroll(s, 3)
  assert.ok(scrolled.offset > 0)
  const line = displayList(scrolled).findIndex((e) => e.type === 'row' && e.index === scrolled.cursor)
  assert.ok(line >= scrolled.offset && line < scrolled.offset + 3)
})

test('replaceRows: 검색어는 유지하고 선택은 새 설치 상태로 재초기화한다', () => {
  let s = createState(ROWS, { selectedIds: ['plugin.a'] })
  s = setQuery(s, 'design')
  s = replaceRows(s, ROWS, ['design.stripe'])
  assert.equal(s.query, 'design')
  assert.deepEqual([...s.selected], ['design.stripe'])
})
