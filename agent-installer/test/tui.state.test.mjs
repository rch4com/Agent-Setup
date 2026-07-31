import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createState, filterRows, setQuery, setFocus, move, moveTab, setTab, toggle, toggleVisible,
  currentRow, displayList, scroll, replaceRows, tabsOf, tabCounts, activeTab,
} from '../lib/tui/state.mjs'

function item(id, section, label, hint = '', group = null) {
  return {
    kind: 'item', id, section, group, label, hint, status: 'absent',
    searchText: `${label} ${hint} ${section}`.toLowerCase(),
  }
}
function action(id, label) {
  return { kind: 'action', id, section: 'action', group: null, label, hint: '', searchText: `${label} action`.toLowerCase() }
}

const ROWS = [
  action('action.bootstrap', '부트스트랩 실행'),
  item('plugin.a', 'plugin', 'Superpowers', 'claude 전용'),
  item('mcp.b', 'mcp', 'Supabase', 'dark postgres'),
  item('design.stripe', 'design', 'Stripe', 'fintech dark', 'Fintech'),
  item('design.wise', 'design', 'Wise', 'fintech', 'Fintech'),
  item('design.linear', 'design', 'Linear', 'productivity', 'Productivity'),
]

// design 탭(인덱스 3)으로 옮긴 상태를 만든다.
const onDesign = (s) => setTab(s, 3)

test('빈 검색어는 전체 통과한다 — 초기 화면이 곧 빈 검색어다', () => {
  assert.equal(filterRows(ROWS, '').length, ROWS.length)
  assert.equal(filterRows(ROWS, undefined).length, ROWS.length)
  assert.equal(filterRows(ROWS, '   ').length, ROWS.length)
})

test('filterRows는 탭을 가로지르고 토큰을 AND로 묶는다 — 탭별 적중 수의 근거다', () => {
  assert.deepEqual(filterRows(ROWS, 'dark').map((r) => r.id), ['mcp.b', 'design.stripe'])
  assert.deepEqual(filterRows(ROWS, 'dark fintech').map((r) => r.id), ['design.stripe'])
  assert.deepEqual(filterRows(ROWS, 'zzz').map((r) => r.id), [])
})

// ── 탭 ────────────────────────────────────────────────────────────

test('탭은 행 등장 순서를 따르고, 처음에는 첫 탭이 활성이다', () => {
  assert.deepEqual(tabsOf(ROWS), ['action', 'plugin', 'mcp', 'design'])
  const s = createState(ROWS)
  assert.equal(activeTab(s), 'action')
  assert.deepEqual(s.filtered.map((r) => r.id), ['action.bootstrap'])
})

test('보이는 목록은 활성 탭으로 스코프된다 — 다른 탭 항목은 섞이지 않는다', () => {
  const s = onDesign(createState(ROWS))
  assert.deepEqual(s.filtered.map((r) => r.id), ['design.stripe', 'design.wise', 'design.linear'])
})

test('탭 이동은 순환한다 — 탭은 몇 개뿐이라 끝에서 막히면 오히려 불편하다', () => {
  const s = createState(ROWS)
  assert.equal(activeTab(moveTab(s, -1)), 'design')
  assert.equal(activeTab(moveTab(s, 1)), 'plugin')
  assert.equal(activeTab(moveTab(moveTab(s, 1), -1)), 'action')
})

test('탭을 옮겨도 검색어는 유지된다 — 같은 검색어로 탭을 훑는 것이 탭의 쓸모다', () => {
  let s = setQuery(createState(ROWS), 'dark')
  assert.deepEqual(s.filtered.map((r) => r.id), []) // 작업 탭에는 없다
  s = moveTab(s, 2) // MCP
  assert.equal(s.query, 'dark')
  assert.deepEqual(s.filtered.map((r) => r.id), ['mcp.b'])
})

test('tabCounts: 검색 중 어느 탭에 결과가 있는지 알려 준다', () => {
  const s = setQuery(createState(ROWS), 'fintech')
  assert.deepEqual(tabCounts(s), [
    { tab: 'action', shown: 0, total: 1 },
    { tab: 'plugin', shown: 0, total: 1 },
    { tab: 'mcp', shown: 0, total: 1 },
    { tab: 'design', shown: 2, total: 3 },
  ])
})

test('탭을 옮기면 커서는 첫 행으로 돌아간다', () => {
  let s = onDesign(createState(ROWS))
  s = move(s, 2)
  assert.equal(s.cursor, 2)
  assert.equal(moveTab(s, 1).cursor, 0)
})

// ── 포커스(검색칸/목록) ───────────────────────────────────────────

test('처음에는 목록에 포커스가 있다 — 곧바로 이동·선택·실행이 되게', () => {
  assert.equal(createState(ROWS).focus, 'list')
})

test('setFocus는 포커스만 바꾸고 커서·선택·검색어는 건드리지 않는다', () => {
  let s = setQuery(move(createState(ROWS, { selectedIds: ['plugin.a'] }), 0), '')
  s = setTab(s, 1)
  s = toggle(s) // plugin.a 해제
  const before = { cursor: s.cursor, query: s.query, tab: activeTab(s), sel: [...s.selected] }
  s = setFocus(s, 'search')
  assert.equal(s.focus, 'search')
  assert.equal(s.cursor, before.cursor)
  assert.equal(s.query, before.query)
  assert.equal(activeTab(s), before.tab)
  assert.deepEqual([...s.selected], before.sel)
})

test('setFocus는 같은 값이면 상태를 새로 만들지 않는다', () => {
  const s = createState(ROWS)
  assert.equal(setFocus(s, 'list'), s)
})

test('탭·검색을 바꿔도 포커스는 유지된다', () => {
  let s = setFocus(createState(ROWS), 'search')
  assert.equal(setQuery(s, 'a').focus, 'search')
  assert.equal(moveTab(s, 1).focus, 'search')
  assert.equal(setTab(s, 2).focus, 'search')
})

// ── 커서·선택 ─────────────────────────────────────────────────────

test('커서는 활성 탭의 양 끝에서 멈춘다 — 순환하면 76개 목록에서 길을 잃는다', () => {
  let s = onDesign(createState(ROWS))
  assert.equal(move(s, -1).cursor, 0)
  s = move(s, 99)
  assert.equal(s.cursor, 2)
  assert.equal(move(s, 1).cursor, 2)
})

test('필터·탭을 바꿔도 선택이 유지된다 — 화면 밖 설치본이 조용히 사라지면 안 된다', () => {
  let s = createState(ROWS, { selectedIds: ['plugin.a'] })
  s = setQuery(onDesign(s), 'stripe')
  s = toggle(s)
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'plugin.a'])

  s = setQuery(s, 'linear')
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'plugin.a'])

  s = moveTab(setQuery(s, ''), 1)
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'plugin.a'])
})

test('액션 행은 토글되지 않는다 — 제거 개념이 없는 작업이다', () => {
  const s = createState(ROWS)
  assert.equal(currentRow(s).kind, 'action')
  assert.equal(toggle(s).selected.size, 0)
})

test('토글은 같은 행에서 켜고 끈다', () => {
  let s = setTab(createState(ROWS), 1)
  s = toggle(s)
  assert.deepEqual([...s.selected], ['plugin.a'])
  s = toggle(s)
  assert.deepEqual([...s.selected], [])
})

test('toggleVisible: 보이는 항목만 켜고 끈다 — 화면 밖은 건드리지 않는다', () => {
  let s = onDesign(createState(ROWS, { selectedIds: ['plugin.a'] }))
  s = setQuery(s, 'fintech')
  s = toggleVisible(s)
  assert.deepEqual([...s.selected].sort(), ['design.stripe', 'design.wise', 'plugin.a'])
  s = toggleVisible(s)
  assert.deepEqual([...s.selected], ['plugin.a']) // 화면 밖 plugin.a는 살아남는다
})

test('toggleVisible: 액션 행뿐인 탭에서는 아무 일도 하지 않는다', () => {
  const s = createState(ROWS)
  assert.equal(toggleVisible(s).selected.size, 0)
})

test('검색어를 바꾸면 커서가 첫 행으로 돌아간다', () => {
  let s = move(onDesign(createState(ROWS)), 2)
  assert.equal(s.cursor, 2)
  s = setQuery(s, 'stripe')
  assert.equal(s.cursor, 0)
})

// ── 표시 ──────────────────────────────────────────────────────────

test('displayList: design 탭은 카테고리 헤더로 갈라지고 부분 개수를 보인다', () => {
  const s = setQuery(onDesign(createState(ROWS)), 'fintech')
  const list = displayList(s)
  const headers = list.filter((e) => e.type === 'header')
  assert.deepEqual(headers.map((h) => h.section), ['Fintech'])
  assert.deepEqual(headers.map((h) => [h.shown, h.total]), [[2, 2]])
})

test('displayList: group이 없는 탭은 헤더 없이 평평하다', () => {
  const list = displayList(setTab(createState(ROWS), 1))
  assert.equal(list.filter((e) => e.type === 'header').length, 0)
  assert.deepEqual(list.map((e) => e.row.id), ['plugin.a'])
})

test('scroll: 커서가 창 밖으로 나가면 offset이 따라가고, 안에 있으면 그대로 둔다', () => {
  let s = onDesign(createState(ROWS))
  assert.equal(scroll(s, 20).offset, 0)

  s = move(s, 2)
  const scrolled = scroll(s, 2)
  assert.ok(scrolled.offset > 0)
  const line = displayList(scrolled).findIndex((e) => e.type === 'row' && e.index === scrolled.cursor)
  assert.ok(line >= scrolled.offset && line < scrolled.offset + 2)
})

test('replaceRows: 검색어와 활성 탭은 유지하고 선택은 새 설치 상태로 재초기화한다', () => {
  let s = onDesign(createState(ROWS, { selectedIds: ['plugin.a'] }))
  s = setQuery(s, 'stripe')
  s = replaceRows(s, ROWS, ['design.stripe'])
  assert.equal(s.query, 'stripe')
  assert.equal(activeTab(s), 'design')
  assert.deepEqual([...s.selected], ['design.stripe'])
})
