// 유일한 부수효과 지점 — 키 입력, 화면 그리기, 액션 실행, 적용.
// 무엇을 보여줄지(render)와 무엇이 선택됐는지(state)는 순수 모듈이 정한다.
import { emitKeypressEvents } from 'node:readline'
import { planChanges, apply } from '../engine.mjs'
import { makeOpener, openPreview } from '../design-md/open.mjs'
import { CATALOG_PATH } from '../design-md/catalog.mjs'
import { collectRows, installedIds } from './rows.mjs'
import { createState, setQuery, move, toggle, scroll, currentRow, replaceRows } from './state.mjs'
import { render, bodyHeight } from './render.mjs'

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

  let state = createState(collected.rows, { selectedIds: installedIds(collected.rows) })
  let status = ''

  emitKeypressEvents(stdin)
  stdin.setRawMode(true)
  stdin.resume()
  const keys = keyReader(stdin)
  stdout.write(ALT_ON + HIDE_CURSOR)

  const color = !env.NO_COLOR && stdout.isTTY
  const paint = () => {
    const height = stdout.rows ?? 24
    state = scroll(state, bodyHeight(height))
    const lines = render(state, { width: stdout.columns ?? 80, height, repo: root, dryRun, color, status })
    stdout.write(HOME + lines.map((l) => l + CLEAR_LINE).join('\n') + '\n' + CLEAR_DOWN)
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

  try {
    for (;;) {
      paint()
      const key = await keys.next()
      status = ''

      if (key.ctrl && key.name === 'c') break

      if (key.name === 'escape') {
        if (state.query) { state = setQuery(state, ''); continue }
        break
      }

      if (key.name === 'up' || (key.ctrl && key.name === 'p')) { state = move(state, -1); continue }
      if (key.name === 'down' || (key.ctrl && key.name === 'n')) { state = move(state, 1); continue }
      if (key.name === 'pageup') { state = move(state, -bodyHeight(stdout.rows ?? 24)); continue }
      if (key.name === 'pagedown') { state = move(state, bodyHeight(stdout.rows ?? 24)); continue }
      if (key.name === 'backspace') { state = setQuery(state, state.query.slice(0, -1)); continue }

      if (key.name === 'tab') {
        const row = currentRow(state)
        if (row?.kind === 'action') {
          await suspend(async () => {
            await row.run({ root, dryRun, skillMode, fetchImpl, catalogFile, log, confirm })
            await pause()
          })
          await recollect()
        } else {
          state = toggle(state)
        }
        continue
      }

      if (key.ctrl && key.name === 'o') {
        const row = currentRow(state)
        if (row?.kind !== 'item' || !row.previewTarget) { status = '이 항목은 미리보기를 제공하지 않습니다.'; continue }
        const notes = []
        openPreview(opener, row.item, (m) => notes.push(String(m).trim()))
        status = notes.length > 0 ? notes.join(' ') : `열었습니다: ${row.previewTarget}`
        continue
      }

      if (key.name === 'return' || key.name === 'enter') {
        const changes = planChanges(itemStates(state.rows), state.selected)
        if (changes.length === 0) { status = '변경할 항목이 없습니다.'; continue }
        const applied = await suspend(async () => {
          log(`\n적용할 변경 ${changes.length}건${dryRun ? ' (dry-run)' : ''}:`)
          for (const c of changes) log(`  ${ACTION_LABEL[c.action]} ${c.item.label}`)
          if (!(await confirm('진행할까요?'))) { log('취소했습니다.'); await pause(); return false }
          const results = await apply(root, changes, { dryRun, log })
          for (const r of results) log(`  ${r.ok ? '✔' : '✖'} ${ACTION_LABEL[r.action]} ${r.item.label}${r.message ? ` — ${r.message}` : ''}`)
          if (results.some((r) => !r.ok)) process.exitCode = 1
          log('\n설정 파일 변경 내용은 git diff로 확인할 수 있습니다.')
          await pause()
          return true
        })
        if (applied) await recollect()
        continue
      }

      // 나머지는 전부 검색어다 — 글자 키를 단축키로 쓰면 "docker"를 검색할 수 없다.
      if (key.str && !key.ctrl && !key.meta && key.str >= ' ') {
        state = setQuery(state, state.query + key.str)
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
