// 순수 렌더 — 상태와 크기를 받아 화면 줄 배열을 돌려준다.
// 커서 이동·지우기 같은 제어 시퀀스는 run.mjs가 맡는다.
import { displayList, tabCounts, activeTab } from './state.mjs'
import { CLI_IDS } from '../clis.mjs'
import { createT } from '../i18n/index.mjs'
import { categoryLabel } from '../design-md/flow.mjs'
import { cut, pad, width } from '../width.mjs'

// 폭 계산은 화면 전용이 아니다 — 비대화형 목록도 같은 열 맞춤이 필요해
// lib/width.mjs에 있다. 여기서 다시 내보내는 것은 호출부(테스트 포함)가
// "화면 폭"을 render에서 찾는 기존 습관을 깨지 않기 위해서다.
export { cut, width }

const ESC = String.fromCharCode(27)
const DIM = `${ESC}[2m`
const BOLD = `${ESC}[1m`
const REVERSE = `${ESC}[7m`
const RESET = `${ESC}[0m`

// 머리글·탭줄·검색줄·구분 공백·바닥글이 차지하는 줄 수.
const CHROME = 6
export const LABEL_WIDTH = 24

export function bodyHeight(height) {
  return Math.max(3, height - CHROME)
}

const MARK = { action: '▶', on: '×', off: ' ' }

function checkbox(row, selected) {
  if (row.kind === 'action') return `[${MARK.action}]`
  return `[${selected.has(row.id) ? MARK.on : MARK.off}]`
}

// 탭 줄. 검색 중이면 탭마다 적중 수를 보여 준다 —
// 검색은 활성 탭 안으로만 걸리므로, 다른 탭에 결과가 있다는 사실을 여기서 알린다.
// 폭이 모자라면 활성 탭 하나 + 위치 표시로 줄인다(줄바꿈은 화면을 무너뜨린다).
// tab 자체는 rows.mjs가 만든 소문자 id다 — 화면에는 t로 번역한 이름만 낸다.
export function tabBar(state, { width: limit, color = false, searching = false, t = createT('en') } = {}) {
  const counts = tabCounts(state)
  if (counts.length === 0) return ''
  const active = activeTab(state)

  const segs = counts.map(({ tab, shown, total }) => ({
    tab,
    text: searching ? `${t(`section.${tab}`)} ${shown}/${total}` : `${t(`section.${tab}`)} ${total}`,
    active: tab === active,
    empty: searching && shown === 0,
  }))

  const SEP = '  '
  const plain = segs.map((s) => s.text).join(SEP)
  // 실제로 그려지는 줄은 plain보다 늘 2칸 더 넓다 — 세그먼트 사이의 구분 공백(SEP)이
  // 아니라 각 세그먼트 앞뒤의 표시(활성은 대괄호, 나머지는 공백)가 SEP 하나만큼을
  // 대체하고 그 위에 1칸씩 더 얹기 때문이다(세그먼트 수와 무관하게 항상 +2).
  // 이 2칸을 빼먹으면 영어처럼 긴 라벨에서 줄바꿈을 놓친다.
  if (width(plain) + 2 > limit) {
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
function searchLine(state, { limit, color, paint, t }) {
  const prefix = t('tui.search.prefix')
  const room = Math.max(0, limit - width(prefix))
  if (state.focus === 'search') {
    const text = `${prefix}${cut(`${state.query}▌`, room)}`
    return color ? `${REVERSE}${pad(text, limit)}${RESET}` : text
  }
  if (state.query) return `${prefix}${cut(state.query, room)}`
  return `${prefix}${paint(DIM, cut(t('tui.search.placeholder'), room))}`
}

export function render(state, opts = {}) {
  // columns로 받는다 — width로 두면 모듈의 width() 함수를 함수 스코프 전체에서 가린다.
  const { width: columns = 80, height = 24, repo = '', dryRun = false, color = false, status = '', t = createT('en') } = opts

  // 마지막 칸은 비워 둔다 — 폭을 꽉 채우면 터미널이 줄을 넘긴다.
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const items = state.rows.filter((r) => r.kind === 'item')
  const picked = items.filter((r) => state.selected.has(r.id)).length

  const title = `agent-installer${dryRun ? ' (dry-run)' : ''}`
  const counts = t('tui.counts', { picked, total: items.length })
  const head = cut(`${title}  ${counts}  ${repo}`, w)
  const searching = String(state.query ?? '').trim() !== ''

  const lines = [
    color ? `${BOLD}${title}${RESET}${cut(`  ${counts}  ${repo}`, Math.max(0, w - width(title)))}` : head,
    tabBar(state, { width: w, color, searching, t }),
    searchLine(state, { limit: w, color, paint, t }),
    '',
  ]

  const body = bodyHeight(height)
  const all = displayList(state)

  if (all.length === 0) {
    lines.push(paint(DIM, cut(searching ? t('tui.empty.filtered') : t('tui.empty.none'), w)))
    for (let i = 1; i < body; i++) lines.push('')
  } else {
    const window = all.slice(state.offset, state.offset + body)
    for (const entry of window) {
      if (entry.type === 'header') {
        const count = entry.shown === entry.total ? `${entry.total}` : `${entry.shown}/${entry.total}`
        // entry.section은 사실 row.group(디자인 카테고리) 값이다. categoryLabel은
        // 우리가 만든 catch-all(__other·__local)만 번역하고, 공급자가 준 실제
        // 카테고리는 이미 영어 데이터라 그대로 통과시킨다.
        lines.push(paint(DIM, cut(`  ${categoryLabel(t, entry.section)} (${count})`, w)))
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

  const hint = state.focus === 'search' ? t('tui.hint.search') : t('tui.hint.list')
  lines.push('')
  lines.push(paint(DIM, cut(status || hint, w)))
  return lines
}

const CHANGE_MARK = { install: '+', complete: '±', uninstall: '−' }

// 제출 검토 화면 — 적용 직전에 무엇이 바뀌는지만 보여 준다.
// 목록이 길면 잘라내고 남은 건수를 알린다(스크롤 대신) — 여기서 길을 잃을 이유는 없다.
export function renderReview(changes, opts = {}) {
  const { width: columns = 80, height = 24, dryRun = false, color = false, t = createT('en') } = opts
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const title = `${t('tui.review.title', { count: changes.length })}${dryRun ? ' (dry-run)' : ''}`
  const lines = [color ? `${BOLD}${cut(title, w)}${RESET}` : cut(title, w), '']

  const body = bodyHeight(height)
  const room = Math.max(1, body - 1)
  const shown = changes.slice(0, room)
  for (const c of shown) {
    // 적용 직전 마지막 화면이다. 일부 CLI에만 들어가는 항목은 여기서도 그 사실을
    // 밝힌다 — 목록에서 지나쳤더라도 되돌릴 수 있는 마지막 지점이다.
    // 전부 지원하는 항목은 조용히 둔다: 경고가 흔해지면 아무도 읽지 않는다.
    const partial = c.item.supports && c.item.supports.length < CLI_IDS.length
    const cov = partial ? ` · ${t('item.cliCoverage', { covered: c.item.supports.length, total: CLI_IDS.length })}` : ''
    lines.push(cut(`  ${CHANGE_MARK[c.action] ?? '?'} ${pad(t(`change.${c.action}`), 10)} ${c.item.label}${cov}`, w))
  }
  if (changes.length > shown.length) {
    lines.push(paint(DIM, cut(t('tui.review.more', { count: changes.length - shown.length }), w)))
  } else {
    lines.push('')
  }
  for (let i = shown.length + 1; i < body; i++) lines.push('')

  lines.push('')
  lines.push(paint(DIM, cut(t('tui.review.hint'), w)))
  return lines
}
