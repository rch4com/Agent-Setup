// 순수 렌더 — 상태와 크기를 받아 화면 줄 배열을 돌려준다.
// 커서 이동·지우기 같은 제어 시퀀스는 run.mjs가 맡는다.
import { displayList, tabCounts, activeTab } from './state.mjs'

const ESC = String.fromCharCode(27)
const DIM = `${ESC}[2m`
const BOLD = `${ESC}[1m`
const REVERSE = `${ESC}[7m`
const RESET = `${ESC}[0m`

// 머리글·탭줄·검색줄·구분 공백·바닥글이 차지하는 줄 수.
const CHROME = 6
const LABEL_WIDTH = 24

export function bodyHeight(height) {
  return Math.max(3, height - CHROME)
}

// 동아시아 글자는 터미널에서 두 칸을 차지한다. 전체 wcwidth 표 대신
// 실제로 쓰이는 구간(한글·한자·가나·전각)만 넓게 센다 — 액션 행 라벨이 전부 한글이라
// 한 칸씩 밀리면 첫 화면부터 열이 어긋난다.
function charWidth(cp) {
  return (cp >= 0x1100 && cp <= 0x115f) // 한글 자모
    || (cp >= 0x2e80 && cp <= 0xa4cf) // 한자 부수·가나·한자
    || (cp >= 0xac00 && cp <= 0xd7a3) // 한글 음절
    || (cp >= 0xf900 && cp <= 0xfaff) // 한자 호환
    || (cp >= 0xfe30 && cp <= 0xfe6f) // 전각 형태
    || (cp >= 0xff00 && cp <= 0xff60) // 전각 영숫자
    || (cp >= 0xffe0 && cp <= 0xffe6)
    ? 2 : 1
}

export function width(text) {
  let w = 0
  for (const ch of String(text ?? '')) w += charWidth(ch.codePointAt(0))
  return w
}

// 색 코드는 폭에 포함되면 안 되므로, 자르기는 항상 색을 입히기 **전에** 한다.
export function cut(text, limit) {
  if (limit <= 0) return ''
  const s = String(text ?? '')
  if (width(s) <= limit) return s
  let out = ''
  let w = 0
  for (const ch of s) {
    const cw = charWidth(ch.codePointAt(0))
    if (w + cw > limit - 1) break
    out += ch
    w += cw
  }
  return `${out}…`
}

function pad(text, limit) {
  const s = cut(text, limit)
  return s + ' '.repeat(Math.max(0, limit - width(s)))
}

const MARK = { action: '▶', on: '×', off: ' ' }

function checkbox(row, selected) {
  if (row.kind === 'action') return `[${MARK.action}]`
  return `[${selected.has(row.id) ? MARK.on : MARK.off}]`
}

// 탭 줄. 검색 중이면 탭마다 적중 수를 보여 준다 —
// 검색은 활성 탭 안으로만 걸리므로, 다른 탭에 결과가 있다는 사실을 여기서 알린다.
// 폭이 모자라면 활성 탭 하나 + 위치 표시로 줄인다(줄바꿈은 화면을 무너뜨린다).
export function tabBar(state, { width: limit, color = false, searching = false } = {}) {
  const counts = tabCounts(state)
  if (counts.length === 0) return ''
  const active = activeTab(state)

  const segs = counts.map(({ tab, shown, total }) => ({
    tab,
    text: searching ? `${tab} ${shown}/${total}` : `${tab} ${total}`,
    active: tab === active,
    empty: searching && shown === 0,
  }))

  const SEP = '  '
  const plain = segs.map((s) => s.text).join(SEP)
  if (width(plain) > limit) {
    const i = segs.findIndex((s) => s.active)
    const compact = `‹ ${segs[i]?.text ?? ''} ›  ${i + 1}/${segs.length}`
    return color ? `${BOLD}${cut(compact, limit)}${RESET}` : cut(compact, limit)
  }
  if (!color) return segs.map((s) => (s.active ? `[${s.text}]` : ` ${s.text} `)).join('')
  return segs
    .map((s) => (s.active ? `${REVERSE} ${s.text} ${RESET}` : s.empty ? `${DIM} ${s.text} ${RESET}` : ` ${s.text} `))
    .join('')
}

// 검색줄 = 하나의 입력칸이다. 포커스가 여기 있으면 입력 커서(▌)로 드러내고,
// 컬러에서는 줄 전체를 반전시켜 "지금 여기에 타이핑된다"를 분명히 한다 —
// 이 상태에서만 스페이스가 선택이 아니라 검색어로 들어가기 때문이다.
function searchLine(state, { limit, color, paint }) {
  const prefix = '검색 › '
  const room = Math.max(0, limit - width(prefix))
  if (state.focus === 'search') {
    const text = `${prefix}${cut(`${state.query}▌`, room)}`
    return color ? `${REVERSE}${pad(text, limit)}${RESET}` : text
  }
  if (state.query) return `${prefix}${cut(state.query, room)}`
  return `${prefix}${paint(DIM, cut('타이핑하면 검색 · ↓ 로 목록', room))}`
}

export function render(state, opts = {}) {
  // columns로 받는다 — width로 두면 모듈의 width() 함수를 함수 스코프 전체에서 가린다.
  const { width: columns = 80, height = 24, repo = '', dryRun = false, color = false, status = '' } = opts

  // 마지막 칸은 비워 둔다 — 폭을 꽉 채우면 터미널이 줄을 넘긴다.
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const items = state.rows.filter((r) => r.kind === 'item')
  const picked = items.filter((r) => state.selected.has(r.id)).length

  const title = `agent-installer${dryRun ? ' (dry-run)' : ''}`
  const counts = `선택 ${picked} / 전체 ${items.length}`
  const head = cut(`${title}  ${counts}  ${repo}`, w)
  const searching = String(state.query ?? '').trim() !== ''

  const lines = [
    color ? `${BOLD}${title}${RESET}${cut(`  ${counts}  ${repo}`, Math.max(0, w - width(title)))}` : head,
    tabBar(state, { width: w, color, searching }),
    searchLine(state, { limit: w, color, paint }),
    '',
  ]

  const body = bodyHeight(height)
  const all = displayList(state)

  if (all.length === 0) {
    lines.push(paint(DIM, cut(searching ? '  이 탭에는 일치하는 항목이 없습니다. Tab으로 다른 탭을 보세요.' : '  항목이 없습니다.', w)))
    for (let i = 1; i < body; i++) lines.push('')
  } else {
    const window = all.slice(state.offset, state.offset + body)
    for (const entry of window) {
      if (entry.type === 'header') {
        const count = entry.shown === entry.total ? `${entry.total}` : `${entry.shown}/${entry.total}`
        lines.push(paint(DIM, cut(`  ${entry.section} (${count})`, w)))
        continue
      }
      const { row, index } = entry
      const here = index === state.cursor
      const hintWidth = Math.max(0, w - LABEL_WIDTH - 6)
      const text = cut(`${here ? '❯' : ' '} ${checkbox(row, state.selected)} ${pad(row.label, LABEL_WIDTH)} ${cut(row.hint, hintWidth)}`, w)
      lines.push(here ? paint(REVERSE, text) : text)
    }
    for (let i = window.length; i < body; i++) lines.push('')
  }

  const hint = state.focus === 'search'
    ? '입력=검색어(스페이스 포함)   ↓ 목록으로   Tab 탭이동   Esc 검색해제'
    : 'Space 선택   ↑↓ 이동(맨 위 ↑=검색칸)   Tab 탭   Enter 실행/제출   Ctrl+A 전체   Ctrl+O 미리보기'
  lines.push('')
  lines.push(paint(DIM, cut(status || hint, w)))
  return lines
}

const CHANGE_MARK = { install: '+', complete: '±', uninstall: '−' }
const CHANGE_LABEL = { install: '설치', complete: '보완 설치', uninstall: '제거' }

// 제출 검토 화면 — 적용 직전에 무엇이 바뀌는지만 보여 준다.
// 목록이 길면 잘라내고 남은 건수를 알린다(스크롤 대신) — 여기서 길을 잃을 이유는 없다.
export function renderReview(changes, opts = {}) {
  const { width: columns = 80, height = 24, dryRun = false, color = false } = opts
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const title = `제출 검토 — 변경 ${changes.length}건${dryRun ? ' (dry-run)' : ''}`
  const lines = [color ? `${BOLD}${cut(title, w)}${RESET}` : cut(title, w), '']

  const body = bodyHeight(height)
  const room = Math.max(1, body - 1)
  const shown = changes.slice(0, room)
  for (const c of shown) {
    lines.push(cut(`  ${CHANGE_MARK[c.action] ?? '?'} ${pad(CHANGE_LABEL[c.action] ?? c.action, 10)} ${c.item.label}`, w))
  }
  if (changes.length > shown.length) {
    lines.push(paint(DIM, cut(`  …외 ${changes.length - shown.length}건`, w)))
  } else {
    lines.push('')
  }
  for (let i = shown.length + 1; i < body; i++) lines.push('')

  lines.push('')
  lines.push(paint(DIM, cut('Enter 적용   Esc 취소', w)))
  return lines
}
