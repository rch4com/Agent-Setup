// 순수 렌더 — 상태와 크기를 받아 화면 줄 배열을 돌려준다.
// 커서 이동·지우기 같은 제어 시퀀스는 run.mjs가 맡는다.
import { displayList, tabCounts, activeTab, currentRow } from './state.mjs'
import { CLI_IDS } from '../clis.mjs'
import { createT } from '../i18n/index.mjs'
import { categoryLabel } from '../design-md/flow.mjs'
import { cut, pad, width } from '../width.mjs'
import { detailLines } from './detail.mjs'
import { scopedLabel } from '../labels.mjs'

// 폭 계산은 화면 전용이 아니다 — 비대화형 목록도 같은 열 맞춤이 필요해
// lib/width.mjs에 있다. 여기서 다시 내보내는 것은 호출부(테스트 포함)가
// "화면 폭"을 render에서 찾는 기존 습관을 깨지 않기 위해서다.
export { cut, width }

const ESC = String.fromCharCode(27)
const DIM = `${ESC}[2m`
const BOLD = `${ESC}[1m`
const REVERSE = `${ESC}[7m`
const RESET = `${ESC}[0m`

// 머리글·탭줄·검색줄·구분 공백·바닥글(한 줄)이 차지하는 줄 수.
// 바닥글이 두 줄이 되면(footerHeight) 그만큼 더 뺀다.
const CHROME = 6
export const LABEL_WIDTH = 24
// 라벨 열의 상한. 터미널이 넓으면 긴 라벨(`Understand Anything (저장소)`)을
// 자르지 않도록 열을 늘리되, 힌트 자리(HINT_MIN)는 남긴다. 50칸은 80칸
// 터미널의 힌트 자리(49칸)보다 커서, 80칸에서는 옛 24칸이 그대로 유지되고
// 100칸쯤부터 늘기 시작한다 — 좁은 화면에서 라벨을 늘리면 전역 항목의
// `gemini 없음` 같은 힌트 꼬리가 대신 잘렸다.
const LABEL_MAX = 40
const HINT_MIN = 50
// rows.mjs의 NAME_LIMIT와 같은 규칙 — 넷 이하면 이름, 그보다 많으면 수.
const NAME_LIMIT = 4

// 행 라벨 열의 폭. 24칸 고정이면 넓은 화면에서도 긴 라벨이 잘렸다. 화면에
// 있는 가장 긴 라벨까지 늘리되 상한과 힌트 자리를 지킨다.
export function labelColumn(rows, w) {
  const longest = Math.max(LABEL_WIDTH, ...rows.filter((r) => r.kind === 'item').map((r) => width(r.label ?? '')))
  return Math.max(LABEL_WIDTH, Math.min(longest, LABEL_MAX, w - 6 - HINT_MIN))
}

// 넓은 화면에서는 전체 경로, 자리가 없으면 마지막 디렉터리 이름만.
function repoLabel(repo, room) {
  const full = String(repo ?? '')
  if (width(full) <= room) return full
  return full.split(/[\\/]/).filter(Boolean).pop() ?? full
}

// 힌트 항목 사이의 구분자. 카탈로그 문자열이 이 간격으로 항목을 나눈다 —
// 좁은 폭에서 두 줄로 접을 때 이 경계에서만 끊는다.
const HINT_SEP = '   '

// 바닥글 힌트를 폭에 맞춰 최대 두 줄로 접는다. 예전에는 한 줄로 두고 뒤를
// 잘랐는데, 80칸 한국어 화면에서 `Ctrl+A 전체   C…`에서 끊겨 CLI 필터(Ctrl+F)·
// 상세 펼침(Ctrl+D)·미리보기(Ctrl+O)를 발견할 길이 없었다. 두 줄로도 모자라면
// 둘째 줄을 자른다 — 세 줄은 목록 지면을 너무 갉아먹는다.
export function hintLines(hint, room) {
  const lines = []
  let cur = ''
  for (const seg of String(hint ?? '').split(HINT_SEP)) {
    const next = cur ? `${cur}${HINT_SEP}${seg}` : seg
    if (cur && width(next) > room) {
      lines.push(cur)
      cur = seg
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  if (lines.length <= 2) return lines
  return [lines[0], cut(lines.slice(1).join(HINT_SEP), room)]
}

// 힌트 오른쪽 끝의 종료 키를 뺀 나머지 자리. 8칸도 안 남으면 힌트를 버리고
// 종료 키만 남긴다(render의 바닥글과 같은 판정).
function hintRoom(w, t) {
  return w - width(t('tui.hint.quit')) - 2
}

// 바닥글 줄 수(1 또는 2). 검색칸·목록 두 포커스의 힌트 중 긴 쪽으로 정한다 —
// 포커스를 옮길 때마다 목록 높이가 바뀌면 화면이 출렁인다.
export function footerHeight(columns = 80, t = createT('en')) {
  const w = Math.max(24, columns - 1)
  const room = hintRoom(w, t)
  if (room < 8) return 1
  return Math.max(hintLines(t('tui.hint.list'), room).length, hintLines(t('tui.hint.search'), room).length)
}

// 상세 패널은 목록과 화면을 나눠 갖는다. 높이를 커서가 아니라 **터미널
// 크기로만** 정하는 것이 핵심이다 — 커서를 옮길 때마다 높이가 변하면
// 목록이 출렁이고, 그것이 아코디언(행 펼침)을 기각한 이유였다.
const PANEL_SHARE = 0.4
const PANEL_MIN = 4
const PANEL_MAX = 12
// 목록이 3줄 밑으로 내려가는 쪽이 패널이 사라지는 것보다 나쁘다.
const PANEL_FLOOR = PANEL_MIN + 3

// footer는 바닥글 줄 수(footerHeight)다. 기본 1이면 옛 산식과 같다.
export function panelHeight(height, expanded = false, footer = 1) {
  const room = Math.max(0, height - CHROME - (footer - 1))
  if (expanded) return room
  if (room < PANEL_FLOOR) return 0
  return Math.min(PANEL_MAX, Math.max(PANEL_MIN, Math.round(room * PANEL_SHARE)))
}

export function bodyHeight(height, expanded = false, footer = 1) {
  const room = Math.max(0, height - CHROME - (footer - 1))
  const panel = panelHeight(height, expanded, footer)
  // 패널이 없을 때는 예전과 같이 최소 3줄을 보장한다.
  return panel === 0 ? Math.max(3, room) : room - panel
}

// 제출 검토 화면(renderReview) 전용 — 거긴 패널을 그리지 않는다. bodyHeight를
// 그대로 재사용하면 그리지도 않는 패널 몫을 미리 떼어 두게 되고, 적용 직전
// 마지막 확인 화면이 화면에 여유가 남았는데도 변경 목록을 이유 없이 잘라
// "…외 N건"으로 감춘다. 그래서 패널을 도입하기 전의 옛 산식을 그대로 쓴다.
export function reviewBodyHeight(height) {
  return Math.max(3, height - CHROME)
}

// on = 설치돼 있고 그대로 둔다, add = 이번에 새로 고름(설치·보완 설치 예정),
// remove = 설치돼 있는데 체크를 풀었다(제거 예정), off = 없고 안 고름.
const MARK = { action: '▶', on: '×', add: '+', remove: '-', off: ' ' }

// 대괄호는 "여러 개 고를 수 있다"는 보편적 신호다 — 한 파일에 한 벌만 놓이는
// 배타 묶음(커밋 템플릿의 두 언어판)에 그대로 쓰면 화면이 거짓말을 한다.
// 둥근 괄호로 바꿔 라디오임을 드러낸다. 안쪽 글자는 그대로 둔다: ×는 이미
// 이 화면이 쓰는 글자라 폭 계산이 검증된 값이고, ●·•는 동아시아 폭이
// 모호(Ambiguous)해 터미널에 따라 두 칸으로 그려져 열을 밀 수 있다.
//
// 표식은 "지금 체크됐나"가 아니라 "Enter를 누르면 무슨 일이 나나"를 말한다.
// 예전에는 ×가 "설치됨(유지)"과 "새로 고름"에 똑같이 쓰였고, 설치된 항목의
// 체크를 풀면 빈 칸이 돼 힌트의 '설치됨'과 조합해야 제거 예정임을 알 수
// 있었다. +·-는 ASCII라 폭이 모호하지 않다(−·±는 동아시아 폭이 모호하다).
export function changeMark(row, selected) {
  const on = selected.has(row.id)
  if (on) return row.status === 'installed' ? MARK.on : MARK.add
  return row.status === 'absent' ? MARK.off : MARK.remove
}

function checkbox(row, selected) {
  if (row.kind === 'action') return `[${MARK.action}]`
  const mark = changeMark(row, selected)
  return row.exclusive ? `(${mark})` : `[${mark}]`
}

// Enter를 누르면 바뀔 항목 수 — engine.planChanges와 같은 판정이다.
// add는 설치·보완 설치, remove는 제거다.
export function pendingCounts(state) {
  const marks = state.rows.filter((r) => r.kind === 'item').map((r) => changeMark(r, state.selected))
  const add = marks.filter((m) => m === MARK.add).length
  const remove = marks.filter((m) => m === MARK.remove).length
  return { add, remove, total: add + remove }
}

// 탭 줄. 목록이 좁혀졌으면(검색어·CLI 필터 어느 쪽이든) 탭마다 적중 수를
// 보여 준다 — 검색·필터는 활성 탭 안으로만 걸리므로, 다른 탭에 결과가
// 있다는 사실을 여기서 알린다. 그래야 필터가 사용자를 빈 탭에 가둬 두고
// 아무 설명도 없이 방치하는 일이 없다.
// 폭이 모자라면 활성 탭 하나 + 위치 표시로 줄인다(줄바꿈은 화면을 무너뜨린다).
// tab 자체는 rows.mjs가 만든 소문자 id다 — 화면에는 t로 번역한 이름만 낸다.
export function tabBar(state, { width: limit, color = false, narrowed = false, t = createT('en') } = {}) {
  const counts = tabCounts(state)
  if (counts.length === 0) return ''
  const active = activeTab(state)

  const segs = counts.map(({ tab, shown, total }) => ({
    tab,
    text: narrowed ? `${t(`section.${tab}`)} ${shown}/${total}` : `${t(`section.${tab}`)} ${total}`,
    active: tab === active,
    empty: narrowed && shown === 0,
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

// 필터 표시. 검색줄 오른쪽 끝에 붙는다 — 새 줄을 만들면 CHROME이 늘어
// 목록이 그만큼 준다. 필터가 없으면 아무것도 내지 않는다(잡음 방지).
//
// 색은 여기서 입히지 않는다 — 이 반환값이 searchLine의 tailWidth 계산에도
// 그대로 쓰이는데, 색 코드를 섞으면 ESC 시퀀스가 표시 폭에 끼어든다(폭은
// 항상 색을 입히기 전에 재야 한다). 칠하는 일은 호출부가 폭 계산을 끝낸
// 뒤 마지막에 한다.
//
// 위치는 CLI 사이에서만 센다. options[0]은 "전체"(null)라 순환 목록에는 있지만
// 사용자에게는 CLI가 아니다 — 그것까지 세면 `codex (3/11)`처럼 CLI가 열
// 개인데 열한 번째가 있다고 읽힌다.
export function filterSegment(state, { t = createT('en'), options = [] } = {}) {
  if (!state.cliFilter) return ''
  const clis = options.filter((o) => o !== null)
  const at = clis.indexOf(state.cliFilter)
  const pos = at === -1 ? '' : ` (${t('tui.filter.position', { current: at + 1, total: clis.length })})`
  return `${t('tui.filter.prefix')}${state.cliFilter}${pos}`
}

// 검색줄 = 하나의 입력칸이다. 포커스가 여기 있으면 입력 커서(▌)로 드러내고,
// 컬러에서는 입력 영역을 반전시켜 "지금 여기에 타이핑된다"를 분명히 한다 —
// 이 상태에서만 스페이스가 선택이 아니라 검색어로 들어가기 때문이다.
//
// 반전은 **입력 영역까지만** 칠한다. 줄 끝까지 채워 반전시키면 오른쪽 필터
// 표시가 반전에 먹혀 읽히지 않는다.
function searchLine(state, { limit, color, paint, t, filter = '' }) {
  const prefix = t('tui.search.prefix')
  // filter는 항상 순수 텍스트다(filterSegment 참고) — 폭은 색을 입히기 전에
  // 재고, tail을 화면에 낼 때만 paint로 칠한다.
  const tailWidth = filter ? width(filter) + 2 : 0
  const tail = filter ? `  ${paint(BOLD, filter)}` : ''
  const room = Math.max(0, limit - width(prefix) - tailWidth)

  // 필터를 넣을 자리가 없으면 필터를 버린다 — 타이핑 중인 글자가 사라지는
  // 쪽이 더 나쁘다. 탭 줄의 shown/total 표기가 필터가 걸려 있음을 이미 알린다.
  if (room < 8) return searchLine(state, { limit, color, paint, t, filter: '' })

  if (state.focus === 'search') {
    const field = `${prefix}${cut(`${state.query}▌`, room)}`
    const body = color ? `${REVERSE}${pad(field, limit - tailWidth)}${RESET}` : field
    return `${body}${tail}`
  }
  const body = state.query
    ? `${prefix}${cut(state.query, room)}`
    : `${prefix}${paint(DIM, cut(t('tui.search.placeholder'), room))}`
  return `${body}${tail}`
}

export function render(state, opts = {}) {
  // columns로 받는다 — width로 두면 모듈의 width() 함수를 함수 스코프 전체에서 가린다.
  const { width: columns = 80, height = 24, repo = '', dryRun = false, color = false, status = '', detailExpanded = false, cliOptions = [], t = createT('en') } = opts

  // 마지막 칸은 비워 둔다 — 폭을 꽉 채우면 터미널이 줄을 넘긴다.
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const items = state.rows.filter((r) => r.kind === 'item')
  const picked = items.filter((r) => state.selected.has(r.id)).length

  const title = `agent-installer${dryRun ? ' (dry-run)' : ''}`
  // 선택 수 옆에 변경 예정 건수를 둔다 — "선택 3 / 전체 106"은 설치 상태의
  // 합계라 Enter를 누르면 무슨 일이 날지 말해 주지 않는다. 항상 찍는다:
  // 0건이면 "지금 Enter는 아무것도 안 한다"는 뜻이라 그것대로 정보다.
  const pending = pendingCounts(state)
  const marks = pending.total > 0 ? t('tui.pendingMarks', { add: pending.add, remove: pending.remove }) : ''
  const counts = `${t('tui.counts', { picked, total: items.length })}  ${t('tui.pending', { count: pending.total, marks })}`
  const repoText = repoLabel(repo, w - width(`${title}  ${counts}  `))
  const head = cut(`${title}  ${counts}  ${repoText}`, w)
  const searching = String(state.query ?? '').trim() !== ''
  // 목록이 좁혀졌는가 — 검색어·CLI 필터 어느 쪽이든 활성 탭 안에서만 걸리는
  // 좁힘이라, 다른 탭에 뭐가 남았는지 알리는 몫(탭 줄의 shown/total)은
  // 둘이 똑같이 진다.
  const narrowed = searching || Boolean(state.cliFilter)

  const filter = filterSegment(state, { t, options: cliOptions })
  const lines = [
    color ? `${BOLD}${title}${RESET}${cut(`  ${counts}  ${repoText}`, Math.max(0, w - width(title)))}` : head,
    tabBar(state, { width: w, color, narrowed, t }),
    searchLine(state, { limit: w, color, paint, t, filter }),
    '',
  ]

  const footer = footerHeight(columns, t)
  const body = bodyHeight(height, detailExpanded, footer)
  const all = displayList(state)

  if (all.length === 0) {
    // 빈 이유가 검색어 때문일 수도 있는데, cliFilter를 먼저 물으면 "이 CLI에는
    // 배선된 게 없다"는 문구가 거짓으로 뜰 수 있다 — 그 CLI가 이 탭의 다른
    // 항목들을 지원하더라도, 검색어가 전부 걸러내면 이 분기에 들어온다.
    // 검색어가 있으면 그쪽이 항상 참이므로 우선한다.
    const empty = searching
      ? t('tui.empty.filtered')
      : state.cliFilter ? t('tui.filter.empty', { cli: state.cliFilter }) : t('tui.empty.none')
    if (body > 0) lines.push(paint(DIM, cut(empty, w)))
    for (let i = 1; i < body; i++) lines.push('')
  } else {
    const window = all.slice(state.offset, state.offset + body)
    const labelCol = labelColumn(state.rows, w)
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
      const hintWidth = Math.max(0, w - labelCol - 6)
      const text = cut(`${here ? '❯' : ' '} ${checkbox(row, state.selected)} ${pad(row.label, labelCol)} ${cut(row.hint, hintWidth)}`, w)
      lines.push(here ? paint(REVERSE, text) : text)
    }
    for (let i = window.length; i < body; i++) lines.push('')
  }

  // 상세 패널 — 목록 아래 고정 자리. 높이가 커서와 무관하므로 목록이
  // 출렁이지 않는다. 지면이 모자라면 panelHeight가 0을 돌려 통째로 빠진다.
  const panel = panelHeight(height, detailExpanded, footer)
  if (panel > 0) {
    lines.push(paint(DIM, '─'.repeat(w)))
    const room = panel - 1
    const detail = detailLines(currentRow(state), { width: w, height: room, t })
    const shown = detail.length > 0 ? detail : [paint(DIM, cut(t('detail.empty'), w))]
    for (const line of shown.slice(0, room)) lines.push(line)
    for (let i = shown.length; i < room; i++) lines.push('')
  }

  // 종료 키는 힌트 줄 **오른쪽 끝에 고정**한다. 나머지 힌트는 좁은 터미널에서
  // 뒤쪽부터 잘려 나가는데, 하필 그때 가장 절실한 것이 "여기서 어떻게
  // 빠져나가나"다 — 잘려도 되는 안내와 절대 사라지면 안 되는 안내를 같은
  // 줄에 이어 붙여 두면 늘 후자가 먼저 사라진다. 상태 메시지가 힌트를
  // 대신할 때도 이 자리는 그대로 남는다.
  //
  // 바닥글은 footer줄이다(1 또는 2). 힌트는 위에서부터 채우고 종료 키는 항상
  // 마지막 줄 오른쪽 끝이다. 상태 메시지는 힌트를 통째로 대신하되 마지막
  // 줄에 놓는다 — 폭이 달라져도 "맨 아랫줄 = 상태 + 종료 키"가 유지된다.
  const hint = state.focus === 'search' ? t('tui.hint.search') : t('tui.hint.list')
  const quit = t('tui.hint.quit')
  const room = hintRoom(w, t)
  lines.push('')
  if (room < 8) {
    for (let i = 1; i < footer; i++) lines.push('')
    lines.push(paint(BOLD, cut(quit, w)))
    return lines
  }
  const shown = status ? [status] : hintLines(hint, room)
  while (shown.length < footer) shown.unshift('')
  shown.slice(0, footer).forEach((text, i) => {
    const last = i === footer - 1
    lines.push(last ? `${paint(DIM, pad(text, room))}  ${paint(BOLD, quit)}` : paint(DIM, cut(text, w)))
  })
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

  // 적용 직전 마지막 화면이다. 일부 CLI에만 들어가는 항목은 여기서도 그 사실을
  // 밝힌다 — 목록에서 지나쳤더라도 되돌릴 수 있는 마지막 지점이다.
  // 전부 지원하는 항목은 조용히 둔다: 경고가 흔해지면 아무도 읽지 않는다.
  // 목록과 같은 규칙으로 — 넷 이하면 이름을 적는다. 숫자만 있으면 어느
  // CLI인지 알려고 Esc로 되돌아가야 했다.
  const changeLine = (c) => {
    const supports = c.item.supports
    const partial = supports && supports.length < CLI_IDS.length
    const covText = supports?.length > 0 && supports.length <= NAME_LIMIT
      ? supports.join('·')
      : t('item.cliCoverage', { covered: supports?.length ?? 0, total: CLI_IDS.length })
    const cov = partial ? ` · ${covText}` : ''
    return cut(`  ${CHANGE_MARK[c.action] ?? '?'} ${pad(t(`change.${c.action}`), 10)} ${scopedLabel(c.item, t)}${cov}`, w)
  }

  // 전역 변경이 있을 때만 범위로 가른다 — 전부 저장소 범위인 흔한 경우에
  // 소제목은 잡음이다. 가를 때는 저장소 묶음이 먼저다(목록 화면과 같은 순서).
  const globals = changes.filter((c) => c.item.scope === 'user')
  const split = globals.length > 0
  const groups = split
    ? [
      { header: t('category.scope-project'), list: changes.filter((c) => c.item.scope !== 'user') },
      { header: t('category.scope-user'), list: globals },
    ].filter((g) => g.list.length > 0)
    : [{ header: null, list: changes }]

  // 소제목·경고 줄이 목록 지면을 갉아먹는다 — 그만큼 떼어 두지 않으면
  // "…외 N건" 판정이 어긋나 화면이 넘친다. 지면이 소제목까지 감당 못 하면
  // 소제목을 버리고 경고만 남긴다 — 경고가 범위 사실을 말하는 최후의 줄이고,
  // 화면이 넘치면 alt 화면 전체가 밀린다.
  const body = reviewBodyHeight(height)
  let overhead = split ? groups.length + 1 : 0
  let showHeaders = split
  if (split && body - 1 - overhead < 1) {
    showHeaders = false
    overhead = 1
  }
  const room = Math.max(1, body - 1 - overhead)

  let quota = room
  for (const g of groups) {
    // 소제목 지면조차 없으면 위에서 이미 강등돼(showHeaders=false) 이
    // 지점에 오지 않는다 — 여기 온다는 건 소제목 지면은 남았다는 뜻이고,
    // 그때는 목록 지면(quota)이 다해도 소제목만은 낸다: 전역 묶음이
    // 통째로 잘리더라도 그 평면이 있다는 사실은 화면에 남아야 한다
    // (경고 줄이 건수를 마저 말한다).
    if (showHeaders && g.header !== null) lines.push(paint(DIM, cut(`  ${g.header}`, w)))
    for (const c of g.list) {
      if (quota <= 0) break
      lines.push(changeLine(c))
      quota--
    }
  }
  const shown = room - quota
  if (changes.length > shown) {
    lines.push(paint(DIM, cut(t('tui.review.more', { count: changes.length - shown }), w)))
  } else {
    lines.push('')
  }
  if (split) lines.push(paint(DIM, cut(t('tui.review.globalWarning', { count: globals.length }), w)))
  while (lines.length < 2 + body) lines.push('')

  lines.push('')
  lines.push(paint(DIM, cut(t('tui.review.hint'), w)))
  return lines
}

// 도움말 화면 — F1. 바닥글 두 줄로는 키의 뜻까지 담을 수 없어, 전체 키를
// 설명과 함께 한 화면에 편다. 아무 키나 누르면 닫힌다.
export function renderHelp(opts = {}) {
  const { width: columns = 80, height = 24, color = false, t = createT('en') } = opts
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)
  const lines = [paint(BOLD, cut(t('help.title'), w)), '']
  for (const line of t('help.lines').split('\n')) lines.push(cut(line, w))
  while (lines.length < height - 2) lines.push('')
  lines.push('')
  lines.push(paint(DIM, cut(t('help.close'), w)))
  return lines.slice(0, height)
}
