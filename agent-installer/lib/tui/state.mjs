// 순수 리듀서 — 아무것도 import 하지 않는다. 터미널도 파일시스템도 모른다.
// 모든 전이는 새 상태를 돌려준다. 키 시퀀스를 넣고 결과를 검증할 수 있게 하기 위해서다.

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n
}

export function createState(rows, { selectedIds = [], query = '' } = {}) {
  return {
    rows,
    query,
    filtered: filterRows(rows, query),
    selected: new Set(selectedIds),
    cursor: 0,
    offset: 0,
  }
}

// 공백으로 나눈 토큰 AND 부분일치.
// 빈 검색어는 전체 통과다 — 여기서는 빈 검색어가 곧 초기 화면이다.
// 필터는 selected를 건드리지 않으므로, 빈 검색어가 전체 선택으로 새는 일이 없다.
export function filterRows(rows, query) {
  const tokens = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return rows
  return rows.filter((row) => tokens.every((tok) => row.searchText.includes(tok)))
}

export function currentRow(state) {
  return state.filtered[state.cursor] ?? null
}

// 검색어를 바꾸면 커서는 첫 행으로 돌아간다.
// selected는 절대 건드리지 않는다 — 화면 밖 설치본이 조용히 사라지지 않게 하는 핵심 규칙이다.
export function setQuery(state, query) {
  return { ...state, query, filtered: filterRows(state.rows, query), cursor: 0, offset: 0 }
}

// 양 끝에서 멈춘다(순환 없음) — 74개 목록에서 한 칸 지나쳤을 때 반대편으로 튀면 길을 잃는다.
export function move(state, delta) {
  if (state.filtered.length === 0) return state
  const cursor = clamp(state.cursor + delta, 0, state.filtered.length - 1)
  return cursor === state.cursor ? state : { ...state, cursor }
}

// 커서가 항목 행일 때만 뒤집는다. 액션 행은 제거 개념이 없어 체크 대상이 아니다.
export function toggle(state) {
  const row = currentRow(state)
  if (row?.kind !== 'item') return state
  const selected = new Set(state.selected)
  if (selected.has(row.id)) selected.delete(row.id)
  else selected.add(row.id)
  return { ...state, selected }
}

// 행을 갈아끼운다(적용·액션 실행 뒤 재스캔). 검색어는 유지하고 선택은 새 설치 상태로 재초기화한다.
export function replaceRows(state, rows, selectedIds) {
  const filtered = filterRows(rows, state.query)
  return {
    ...state,
    rows,
    filtered,
    selected: new Set(selectedIds),
    cursor: clamp(state.cursor, 0, Math.max(0, filtered.length - 1)),
    offset: 0,
  }
}

// 필터 결과에 섹션 헤더를 끼워 넣는다.
// 비는 섹션은 헤더째 빠진다 — 필터 결과가 곧 목록이라 따로 걸러낼 것이 없다.
export function displayList(state) {
  const totals = new Map()
  for (const row of state.rows) totals.set(row.section, (totals.get(row.section) ?? 0) + 1)

  const out = []
  let header = null
  state.filtered.forEach((row, index) => {
    if (!header || header.section !== row.section) {
      header = { type: 'header', section: row.section, shown: 0, total: totals.get(row.section) ?? 0 }
      out.push(header)
    }
    header.shown++
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
  // 커서 바로 위 섹션 헤더까지 같이 보이게 한다 — 어느 섹션을 보고 있는지 잃지 않게.
  const top = lines[line - 1]?.type === 'header' ? line - 1 : line
  if (top < offset) offset = top
  else if (line >= offset + height) offset = line - height + 1
  offset = clamp(offset, 0, Math.max(0, lines.length - height))
  return offset === state.offset ? state : { ...state, offset }
}
