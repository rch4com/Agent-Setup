// 순수 리듀서 — 아무것도 import 하지 않는다. 터미널도 파일시스템도 모른다.
// 모든 전이는 새 상태를 돌려준다. 키 시퀀스를 넣고 결과를 검증할 수 있게 하기 위해서다.

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n
}

// 탭 = 섹션. 순서는 행 배열의 등장 순서를 그대로 따른다 —
// buildRows가 이미 SECTION_ORDER로 정렬해 주므로 여기서 순서를 다시 알 필요가 없다.
export function tabsOf(rows) {
  const out = []
  for (const row of rows) if (!out.includes(row.section)) out.push(row.section)
  return out
}

// 포커스는 두 곳 중 하나에 있다: 'search'(검색 입력칸) 또는 'list'(항목 목록).
// 어느 쪽이 포커스인지가 Space·타이핑의 뜻을 가른다 — 검색칸에서는 글자가
// 검색어(스페이스 포함)로, 목록에서는 Space가 선택으로 동작한다.
// 흔한 TUI의 두-존(zone) 모델이다.
export function createState(rows, { selectedIds = [], query = '', tabIndex = 0, focus = 'list', cliFilter = null } = {}) {
  const tabs = tabsOf(rows)
  const index = clamp(tabIndex, 0, Math.max(0, tabs.length - 1))
  return {
    rows,
    tabs,
    tabIndex: index,
    focus,
    query,
    cliFilter,
    filtered: visibleRows(rows, query, tabs[index], cliFilter),
    selected: new Set(selectedIds),
    cursor: 0,
    offset: 0,
  }
}

// 포커스를 검색칸/목록으로 옮긴다. 커서·선택·검색어는 건드리지 않는다.
export function setFocus(state, focus) {
  return focus === state.focus ? state : { ...state, focus }
}

// 공백으로 나눈 토큰 AND 부분일치.
// 빈 검색어는 전체 통과다 — 여기서는 빈 검색어가 곧 초기 화면이다.
// 필터는 selected를 건드리지 않으므로, 빈 검색어가 전체 선택으로 새는 일이 없다.
export function filterRows(rows, query) {
  const tokens = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return rows
  return rows.filter((row) => tokens.every((tok) => row.searchText.includes(tok)))
}

// CLI 필터 통과 판정. 액션 행은 CLI 개념이 없고(설치가 아니라 실행이다),
// design.md는 모든 CLI가 함께 읽는 문서라 supports를 갖지 않는다.
// 둘을 걸러 내면 필터를 건 순간 화면에서 길이 끊긴다.
export function matchesCli(row, cliFilter) {
  if (!cliFilter) return true
  if (row.kind !== 'item') return true
  const supports = row.item?.supports
  if (!supports) return true
  return supports.includes(cliFilter)
}

// 화면에 실제로 보이는 행 = 활성 탭 ∩ 검색 결과 ∩ CLI 필터.
// 검색은 탭 안으로 스코프하되, 다른 탭의 적중 수는 tabCounts로 함께 보여 준다 —
// 그래야 "어느 탭에 있는지" 를 잃지 않으면서도 Tab 키가 늘 의미를 갖는다.
function visibleRows(rows, query, tab, cliFilter) {
  return filterRows(rows, query).filter((row) => row.section === tab && matchesCli(row, cliFilter))
}

export function activeTab(state) {
  return state.tabs[state.tabIndex] ?? null
}

// 탭별 적중 수 — 검색·필터 중에도 어느 탭에 결과가 있는지 한눈에 보이게 한다.
// total은 필터를 타지 않는다: 분모가 함께 줄면 "이 탭에서 몇 개가 걸러졌나"를
// 알 수 없다.
export function tabCounts(state) {
  const hits = filterRows(state.rows, state.query).filter((r) => matchesCli(r, state.cliFilter))
  return state.tabs.map((tab) => ({
    tab,
    shown: hits.filter((r) => r.section === tab).length,
    total: state.rows.filter((r) => r.section === tab).length,
  }))
}

export function currentRow(state) {
  return state.filtered[state.cursor] ?? null
}

function refocus(state, patch) {
  const next = { ...state, ...patch }
  return { ...next, filtered: visibleRows(next.rows, next.query, activeTab(next), next.cliFilter), cursor: 0, offset: 0 }
}

// 검색어를 바꾸면 커서는 첫 행으로 돌아간다.
// selected는 절대 건드리지 않는다 — 화면 밖 설치본이 조용히 사라지지 않게 하는 핵심 규칙이다.
export function setQuery(state, query) {
  return refocus(state, { query })
}

// 탭 이동은 순환한다 — 탭은 대여섯 개뿐이라 끝에서 막히면 오히려 불편하다.
// 검색어는 유지한다: 같은 검색어로 탭을 훑는 것이 탭 UI의 본래 쓸모다.
export function moveTab(state, delta) {
  if (state.tabs.length === 0) return state
  const n = state.tabs.length
  const tabIndex = (((state.tabIndex + delta) % n) + n) % n
  return tabIndex === state.tabIndex ? state : refocus(state, { tabIndex })
}

export function setTab(state, index) {
  if (state.tabs.length === 0) return state
  const tabIndex = clamp(index, 0, state.tabs.length - 1)
  return tabIndex === state.tabIndex ? state : refocus(state, { tabIndex })
}

// 필터를 바꾸면 커서는 첫 행으로 돌아간다. selected는 절대 건드리지 않는다 —
// setQuery와 같은 규칙이다. 화면 밖 설치본이 조용히 사라지지 않게 하는 핵심이다.
export function setCliFilter(state, cliFilter) {
  return cliFilter === state.cliFilter ? state : refocus(state, { cliFilter })
}

// 순환 대상은 [null, ...CLI_IDS]다. 이 모듈은 아무것도 import 하지 않으므로
// 목록을 인자로 받는다 — 그 규칙이 이 파일을 순수하게 지켜 준다.
export function cycleCliFilter(state, delta, options) {
  if (!options || options.length === 0) return state
  const at = options.indexOf(state.cliFilter ?? null)
  const n = options.length
  const next = options[((((at === -1 ? 0 : at) + delta) % n) + n) % n]
  return setCliFilter(state, next ?? null)
}

// 양 끝에서 멈춘다(순환 없음) — 76개 목록에서 한 칸 지나쳤을 때 반대편으로 튀면 길을 잃는다.
export function move(state, delta) {
  if (state.filtered.length === 0) return state
  const cursor = clamp(state.cursor + delta, 0, state.filtered.length - 1)
  return cursor === state.cursor ? state : { ...state, cursor }
}

// row.exclusive는 "이 항목들은 같은 파일 하나를 두고 다툰다"는 표시다
// (.gitmessage.txt의 영어판·한국어판). 하나를 켜면 나머지는 꺼진다 — 둘을 함께
// 고르면 나중에 적용된 쪽이 앞선 쪽을 조용히 덮어써, 화면의 체크 두 개가
// 디스크의 한 파일을 가리키는 거짓말이 된다.
//
// 화면 밖(검색·CLI 필터로 가려진) 형제도 끈다. 보이는 것만 건드린다는 이
// 모듈의 규칙에서 유일하게 벗어나는 자리인데, 여기서는 그래야 한다 —
// 가려진 형제를 남겨 두면 사용자가 방금 명시적으로 고른 판이 적용 순서에
// 따라 뒤집힐 수 있다.
function dropSiblings(rows, selected, row) {
  if (!row.exclusive) return
  for (const other of rows) {
    if (other.id !== row.id && other.exclusive === row.exclusive) selected.delete(other.id)
  }
}

// 형제 중 하나라도 이미 켜져 있는가. 배타 묶음은 "전부 켜짐"이 불가능하므로
// 전체 토글의 방향 판정도 이 기준으로 봐야 한다 — 아니면 Ctrl+A가 영원히
// 켜기만 하고 끄지 못한다.
function groupCovered(items, selected, row) {
  return items.some((other) => other.exclusive === row.exclusive && selected.has(other.id))
}

// 커서가 항목 행일 때만 뒤집는다. 액션 행은 제거 개념이 없어 체크 대상이 아니다.
export function toggle(state) {
  const row = currentRow(state)
  if (row?.kind !== 'item') return state
  const selected = new Set(state.selected)
  if (selected.has(row.id)) {
    selected.delete(row.id)
  } else {
    selected.add(row.id)
    dropSiblings(state.rows, selected, row)
  }
  return { ...state, selected }
}

// 지금 보이는 항목 행 전체를 켜거나 끈다.
// 보이는 것만 건드린다 — 화면 밖 설치본을 일괄 조작으로 날리지 않기 위해서다.
export function toggleVisible(state, on) {
  const items = state.filtered.filter((r) => r.kind === 'item')
  if (items.length === 0) return state
  const selected = new Set(state.selected)
  const turnOn = on ?? !items.every((r) => selected.has(r.id) || (r.exclusive && groupCovered(items, selected, r)))
  for (const row of items) {
    if (!turnOn) { selected.delete(row.id); continue }
    // 배타 묶음에서 이미 켜진 형제가 있으면 그 선택을 이긴다 — 전체 선택이
    // 사용자가 고른 언어판을 목록 순서로 뒤집으면 안 된다.
    if (row.exclusive && groupCovered(items, selected, row)) continue
    selected.add(row.id)
    dropSiblings(state.rows, selected, row)
  }
  return { ...state, selected }
}

// 행을 갈아끼운다(적용·액션 실행 뒤 재스캔). 검색어·활성 탭은 유지하고
// 선택은 새 설치 상태로 재초기화한다.
export function replaceRows(state, rows, selectedIds) {
  const tabs = tabsOf(rows)
  const tabIndex = clamp(tabs.indexOf(activeTab(state)), 0, Math.max(0, tabs.length - 1))
  const filtered = visibleRows(rows, state.query, tabs[tabIndex], state.cliFilter)
  return {
    ...state,
    rows,
    tabs,
    tabIndex,
    filtered,
    selected: new Set(selectedIds),
    cursor: clamp(state.cursor, 0, Math.max(0, filtered.length - 1)),
    offset: 0,
  }
}

// 활성 탭의 목록에 그룹 헤더를 끼워 넣는다.
// 그룹은 행의 group 필드다(design.md는 카테고리, 나머지는 없음) —
// 탭이 이미 섹션을 갈라 놓았으므로 섹션 헤더는 더 이상 필요 없다.
export function displayList(state) {
  const tab = activeTab(state)
  const totals = new Map()
  for (const row of state.rows) {
    if (row.section !== tab || !row.group) continue
    totals.set(row.group, (totals.get(row.group) ?? 0) + 1)
  }

  const out = []
  let header = null
  state.filtered.forEach((row, index) => {
    if (row.group && (!header || header.section !== row.group)) {
      header = { type: 'header', section: row.group, shown: 0, total: totals.get(row.group) ?? 0 }
      out.push(header)
    }
    if (!row.group) header = null
    if (header) header.shown++
    out.push({ type: 'row', row, index })
  })
  return out
}

// 커서가 창 밖으로 나가면 최소한으로 민다. 이미 보이면 그대로 둔다 — 목록이 덜 흔들린다.
export function scroll(state, height) {
  const lines = displayList(state)
  const line = lines.findIndex((e) => e.type === 'row' && e.index === state.cursor)
  if (line < 0) return state.offset === 0 ? state : { ...state, offset: 0 }

  let offset = state.offset
  // 커서 바로 위 그룹 헤더까지 같이 보이게 한다 — 어느 그룹을 보고 있는지 잃지 않게.
  const top = lines[line - 1]?.type === 'header' ? line - 1 : line
  if (top < offset) offset = top
  else if (line >= offset + height) offset = line - height + 1
  offset = clamp(offset, 0, Math.max(0, lines.length - height))
  return offset === state.offset ? state : { ...state, offset }
}
