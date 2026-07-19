// 순수 렌더 — 상태와 크기를 받아 화면 줄 배열을 돌려준다.
// 커서 이동·지우기 같은 제어 시퀀스는 run.mjs가 맡는다.
import { displayList } from './state.mjs'

const ESC = String.fromCharCode(27)
const DIM = `${ESC}[2m`
const BOLD = `${ESC}[1m`
const REVERSE = `${ESC}[7m`
const RESET = `${ESC}[0m`

// 머리글·검색줄·구분 공백·바닥글이 차지하는 줄 수.
const CHROME = 5
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

export function render(state, opts = {}) {
  const { width = 80, height = 24, repo = '', dryRun = false, color = false, status = '' } = opts

  // 마지막 칸은 비워 둔다 — 폭을 꽉 채우면 터미널이 줄을 넘긴다.
  const w = Math.max(24, width - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const installed = state.rows.filter((r) => r.kind === 'item' && r.status !== 'absent').length
  const items = state.rows.filter((r) => r.kind === 'item').length

  const title = `agent-installer${dryRun ? ' (dry-run)' : ''}`
  const counts = `설치 ${installed} / 전체 ${items}`
  const head = cut(`${title}  ${counts}  ${repo}`, w)

  const lines = [
    color ? `${BOLD}${title}${RESET}${cut(`  ${counts}  ${repo}`, Math.max(0, w - width(title)))}` : head,
    state.query ? `검색 › ${cut(state.query, Math.max(0, w - 7))}` : `검색 › ${paint(DIM, '타이핑하면 걸러집니다')}`,
    '',
  ]

  const body = bodyHeight(height)
  const all = displayList(state)

  if (all.length === 0) {
    lines.push(paint(DIM, '  일치하는 항목이 없습니다.'))
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

  lines.push('')
  lines.push(paint(DIM, cut(status || 'Tab 선택/실행   Ctrl+O 브라우저   Enter 적용   Esc 종료', w)))
  return lines
}
