// 유일한 부수효과 지점 — 키 입력, 화면 그리기, 액션 실행, 적용.
// 무엇을 보여줄지(render)와 무엇이 선택됐는지(state)는 순수 모듈이 정한다.
import { emitKeypressEvents } from 'node:readline'
import { planChanges, apply } from '../engine.mjs'
import { makeOpener, openPreview } from '../design-md/open.mjs'
import { CATALOG_PATH } from '../design-md/catalog.mjs'
import { collectRows, installedIds } from './rows.mjs'
import {
  createState, setQuery, setFocus, move, moveTab, toggle, toggleVisible, scroll, currentRow, replaceRows, activeTab,
} from './state.mjs'
import { render, renderReview, bodyHeight } from './render.mjs'

const ESC = String.fromCharCode(27)
const HIDE_CURSOR = `${ESC}[?25l`
const SHOW_CURSOR = `${ESC}[?25h`
const ALT_ON = `${ESC}[?1049h`
const ALT_OFF = `${ESC}[?1049l`
const HOME = `${ESC}[H`
const CLEAR_LINE = `${ESC}[K`
const CLEAR_DOWN = `${ESC}[J`

const ACTION_LABEL = { install: '설치', complete: '보완 설치', uninstall: '제거' }

// 키를 큐에 쌓아 두고 하나씩 꺼내 쓴다. 이벤트 상태 기계 대신
// `for(;;) await next()` 루프로 흐름을 읽을 수 있게 하기 위해서다.
function keyReader(stdin) {
  const queue = []
  let waiting = null
  const onKey = (str, key) => {
    const event = { str, ...(key ?? {}) }
    if (waiting) { const resolve = waiting; waiting = null; resolve(event) }
    else queue.push(event)
  }
  stdin.on('keypress', onKey)
  return {
    next: () => (queue.length > 0 ? Promise.resolve(queue.shift()) : new Promise((r) => { waiting = r })),
    stop: () => stdin.off('keypress', onKey),
  }
}

function itemStates(rows) {
  return rows.filter((r) => r.kind === 'item').map((r) => ({ item: r.item, status: r.status }))
}

function printPlain(rows, log) {
  let section = null
  for (const row of rows) {
    if (row.section !== section) { section = row.section; log(`[${section}]`) }
    const mark = row.kind === 'action' ? '▶' : row.status === 'absent' ? ' ' : '×'
    log(`  [${mark}] ${row.label}${row.hint ? ` — ${row.hint}` : ''}`)
  }
}

// 화면에 찍히는 글자인가(스페이스 포함). 검색칸 포커스에서 검색어로 들어갈 후보다.
// 스페이스의 뜻은 포커스가 가른다: 검색칸에서는 검색어, 목록에서는 선택.
// 그래서 목록에서 타이핑으로 검색칸에 올라갈 때는 호출부에서 스페이스를 뺀다.
function isPrintable(key) {
  return Boolean(key.str) && !key.ctrl && !key.meta && key.str >= ' ' && key.str !== ESC
}

export async function runTui(root, opts = {}) {
  const {
    dryRun = false,
    skillMode = 'auto',
    fetchImpl = fetch,
    designDirs = [],
    env = process.env,
    catalogFile = CATALOG_PATH,
    log = console.log,
    stdin = process.stdin,
    stdout = process.stdout,
  } = opts
  const opener = opts.opener ?? makeOpener(dryRun, log)

  let collected = await collectRows(root, { fetchImpl, designDirs, env, catalogFile, log: () => {} })

  // raw 모드를 켤 수 없으면(CI·파이프) 목록만 내고 끝낸다.
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    printPlain(collected.rows, log)
    log('\n대화형 화면은 터미널에서만 열립니다. --list · --set 으로도 다룰 수 있습니다.')
    return { interactive: false }
  }

  // 처음엔 목록에 포커스를 둔다 — 곧바로 화살표 이동·Space 선택·Enter 실행이 되게.
  // 타이핑하면 검색칸으로 올라간다.
  let state = createState(collected.rows, { selectedIds: installedIds(collected.rows), focus: 'list' })
  let status = ''

  emitKeypressEvents(stdin)
  stdin.setRawMode(true)
  stdin.resume()
  const keys = keyReader(stdin)
  stdout.write(ALT_ON + HIDE_CURSOR)

  const color = !env.NO_COLOR && stdout.isTTY
  const draw = (lines) => stdout.write(HOME + lines.map((l) => l + CLEAR_LINE).join('\n') + '\n' + CLEAR_DOWN)
  const paint = () => {
    const height = stdout.rows ?? 24
    state = scroll(state, bodyHeight(height))
    draw(render(state, { width: stdout.columns ?? 80, height, repo: root, dryRun, color, status }))
  }

  // 로그는 화면 안에 우겨넣지 않는다 — 실패 메시지가 길고, 잘리면 진단이 불가능해진다.
  const suspend = async (fn) => {
    stdout.write(ALT_OFF + SHOW_CURSOR)
    try { return await fn() } finally { stdout.write(ALT_ON + HIDE_CURSOR) }
  }
  const confirm = async (message) => {
    stdout.write(`\n${message} [y/N] `)
    const key = await keys.next()
    stdout.write('\n')
    return String(key.str ?? '').toLowerCase() === 'y'
  }
  const pause = async () => {
    stdout.write('\n계속하려면 아무 키나 누르세요…')
    await keys.next()
  }

  const recollect = async () => {
    collected = await collectRows(root, { fetchImpl, designDirs, env, catalogFile, log: () => {} })
    state = replaceRows(state, collected.rows, installedIds(collected.rows))
  }

  const select = () => {
    const row = currentRow(state)
    if (row?.kind !== 'item') return '이 행은 Enter로 실행합니다.'
    state = toggle(state)
    return ''
  }

  // 미리보기는 두 포커스에서 모두 통해야 한다 — 검색으로 찾은 직후가 가장 열어 보고 싶은 순간이다.
  const preview = () => {
    const row = currentRow(state)
    if (row?.kind !== 'item' || !row.previewTarget) return '이 항목은 미리보기를 제공하지 않습니다.'
    const notes = []
    openPreview(opener, row.item, (m) => notes.push(String(m).trim()))
    return notes.length > 0 ? notes.join(' ') : `열었습니다: ${row.previewTarget}`
  }

  // 제출 검토 — 적용 직전에 변경 목록을 보여 주고 Enter/Esc만 받는다.
  const review = async (changes) => {
    for (;;) {
      draw(renderReview(changes, { width: stdout.columns ?? 80, height: stdout.rows ?? 24, dryRun, color }))
      const key = await keys.next()
      if (key.ctrl && key.name === 'c') return 'quit'
      if (key.name === 'escape') return 'cancel'
      if (key.name === 'return' || key.name === 'enter') return 'apply'
    }
  }

  try {
    for (;;) {
      paint()
      const key = await keys.next()
      status = ''

      if (key.ctrl && key.name === 'c') break

      // ── 검색칸에 포커스: 타이핑이 곧 검색어다(스페이스 포함, 두 단어 검색 가능).
      if (state.focus === 'search') {
        // Esc: 검색어가 있으면 지우고 검색칸에 남는다. 이미 비었으면 목록으로 내려간다.
        if (key.name === 'escape') {
          state = state.query ? setQuery(state, '') : setFocus(state, 'list')
          continue
        }
        // Enter·↓: 검색을 마치고 목록으로 내려간다. 결과의 첫 항목이 커서다.
        if (key.name === 'return' || key.name === 'enter' || key.name === 'down') { state = setFocus(state, 'list'); continue }
        if (key.name === 'backspace') { state = setQuery(state, state.query.slice(0, -1)); continue }
        if (key.name === 'tab') { state = moveTab(state, key.shift ? -1 : 1); continue }
        if (key.ctrl && key.name === 'o') { status = preview(); continue }
        if (isPrintable(key)) state = setQuery(state, state.query + key.str)
        continue
      }

      // ── 목록에 포커스
      if (key.name === 'escape') {
        if (state.query) { state = setQuery(state, ''); continue }
        break
      }

      // / 또는 글자를 누르면 검색칸으로 올라가 타이핑을 시작한다. 스페이스는 선택이므로 제외한다.
      if (key.str === '/') { state = setFocus(state, 'search'); continue }
      if (key.name !== 'space' && isPrintable(key)) {
        state = setQuery(setFocus(state, 'search'), state.query + key.str)
        continue
      }

      // 맨 위에서 ↑를 누르면 검색칸으로 되돌아간다 — 목록과 검색칸이 위아래로 이어진 느낌.
      if (key.name === 'up' || (key.ctrl && key.name === 'p')) {
        state = state.cursor === 0 ? setFocus(state, 'search') : move(state, -1)
        continue
      }
      if (key.name === 'down' || (key.ctrl && key.name === 'n')) { state = move(state, 1); continue }
      if (key.name === 'pageup') { state = move(state, -bodyHeight(stdout.rows ?? 24)); continue }
      if (key.name === 'pagedown') { state = move(state, bodyHeight(stdout.rows ?? 24)); continue }

      // 탭 이동 — Tab/Shift+Tab, 좌우 화살표.
      if (key.name === 'tab') { state = moveTab(state, key.shift ? -1 : 1); continue }
      if (key.name === 'right') { state = moveTab(state, 1); continue }
      if (key.name === 'left') { state = moveTab(state, -1); continue }

      // 선택 토글 — 액션 행에서는 아무 일도 하지 않는다(제거 개념이 없다).
      if (key.name === 'space') { status = select(); continue }

      // 지금 탭에서 보이는 항목 전체 토글.
      if (key.ctrl && key.name === 'a') {
        const before = state.selected.size
        state = toggleVisible(state)
        status = `${activeTab(state)} 탭의 보이는 항목을 ${state.selected.size >= before ? '모두 선택' : '모두 해제'}했습니다.`
        continue
      }

      if (key.ctrl && key.name === 'o') { status = preview(); continue }

      if (key.name === 'return' || key.name === 'enter') {
        // 액션 행은 그 자리에서 실행한다. 나머지는 제출(검토 → 일괄 적용)이다.
        const row = currentRow(state)
        if (row?.kind === 'action') {
          await suspend(async () => {
            await row.run({ root, dryRun, skillMode, fetchImpl, catalogFile, log, confirm })
            await pause()
          })
          await recollect()
          continue
        }

        const changes = planChanges(itemStates(state.rows), state.selected)
        if (changes.length === 0) { status = '변경할 항목이 없습니다.'; continue }

        const verdict = await review(changes)
        if (verdict === 'quit') break
        if (verdict === 'cancel') { status = '제출을 취소했습니다.'; continue }

        await suspend(async () => {
          log(`\n적용할 변경 ${changes.length}건${dryRun ? ' (dry-run)' : ''}:`)
          for (const c of changes) log(`  ${ACTION_LABEL[c.action]} ${c.item.label}`)
          const results = await apply(root, changes, { dryRun, log })
          for (const r of results) log(`  ${r.ok ? '✔' : '✖'} ${ACTION_LABEL[r.action]} ${r.item.label}${r.message ? ` — ${r.message}` : ''}`)
          if (results.some((r) => !r.ok)) process.exitCode = 1
          log('\n설정 파일 변경 내용은 git diff로 확인할 수 있습니다.')
          await pause()
        })
        await recollect()
        continue
      }
    }
  } finally {
    keys.stop()
    stdout.write(ALT_OFF + SHOW_CURSOR)
    stdin.setRawMode(false)
    stdin.pause()
  }

  return { interactive: true }
}

export { printPlain, itemStates }
