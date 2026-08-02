// 유일한 부수효과 지점 — 키 입력, 화면 그리기, 액션 실행, 적용.
// 무엇을 보여줄지(render)와 무엇이 선택됐는지(state)는 순수 모듈이 정한다.
import { emitKeypressEvents } from 'node:readline'
import { planChanges, apply } from '../engine.mjs'
import { makeOpener, openPreview } from '../design-md/open.mjs'
import { netFetch, CATALOG_PATH } from '../design-md/catalog.mjs'
import { createT, toText, LOCALES } from '../i18n/index.mjs'
import { RECORD_REL, writeLang } from '../bootstrap/record.mjs'
import { collectRows, installedIds } from './rows.mjs'
import { CLI_IDS } from '../clis.mjs'
import {
  createState, setQuery, setFocus, move, moveTab, toggle, toggleVisible, scroll, currentRow, replaceRows, activeTab,
  cycleCliFilter,
} from './state.mjs'
import { render, renderReview, bodyHeight } from './render.mjs'
import { createProgress, applyEvent, progressLines } from './progress.mjs'

const ESC = String.fromCharCode(27)
const HIDE_CURSOR = `${ESC}[?25l`
const SHOW_CURSOR = `${ESC}[?25h`
const ALT_ON = `${ESC}[?1049h`
const ALT_OFF = `${ESC}[?1049l`
const HOME = `${ESC}[H`
const CLEAR_LINE = `${ESC}[K`
const CLEAR_DOWN = `${ESC}[J`

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
    // 적용 중 중단 감시용. 큐를 **소비하지 않고** Ctrl+C만 들여다본다.
    // next()로 기다리는 두 번째 소비자를 두면 적용이 끝난 뒤 눌린 키가
    // 그 대기로 흘러 사라지고, 본 루프의 "아무 키나" 대기가 멈춘다.
    // Ctrl+C가 있을 때만 거기까지를 버린다.
    hasAbort: () => {
      const at = queue.findIndex((k) => k.ctrl && k.name === 'c')
      if (at === -1) return false
      queue.splice(0, at + 1)
      return true
    },
    stop: () => stdin.off('keypress', onKey),
  }
}

function itemStates(rows) {
  return rows.filter((r) => r.kind === 'item').map((r) => ({ item: r.item, status: r.status }))
}

// row.section은 이제 소문자 id다(rows.mjs Task 9) — t 없이 그대로 찍으면
// 화면에 'action'·'plugin' 같은 raw id가 새어 나간다. 이 경로도 사용자가
// 보는 출력이라 여기서도 t를 받는다.
function printPlain(rows, log, t = createT('en')) {
  let section = null
  for (const row of rows) {
    if (row.section !== section) { section = row.section; log(`[${t(`section.${section}`)}]`) }
    const mark = row.kind === 'action' ? '▶' : row.status === 'absent' ? ' ' : '×'
    // 화면 폭 제약이 없는 자리다 — 여기서는 긴 힌트가 낫다.
    const hint = row.fullHint ?? row.hint
    log(`  [${mark}] ${row.label}${hint ? ` — ${hint}` : ''}`)
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
    fetchImpl = netFetch,
    designDirs = [],
    env = process.env,
    catalogFile = CATALOG_PATH,
    log = console.log,
    stdin = process.stdin,
    stdout = process.stdout,
  } = opts
  const opener = opts.opener ?? makeOpener(dryRun, log)
  // let으로 둔다 — 언어 전환 행(cycleLanguage)이 실행 중에 갈아끼운다.
  let { t = createT('en'), localeForced = false } = opts

  let collected = await collectRows(root, { fetchImpl, designDirs, env, catalogFile, log: () => {}, t })

  // raw 모드를 켤 수 없으면(CI·파이프) 목록만 내고 끝낸다.
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    printPlain(collected.rows, log, t)
    log(`\n${t('tui.nonInteractive')}`)
    return { interactive: false }
  }

  // 처음엔 목록에 포커스를 둔다 — 곧바로 화살표 이동·Space 선택·Enter 실행이 되게.
  // 타이핑하면 검색칸으로 올라간다.
  let state = createState(collected.rows, { selectedIds: installedIds(collected.rows), focus: 'list' })
  let status = ''
  // 순환 대상: 전체(null) + CLI 10개. state.mjs는 아무것도 import 하지 않으므로
  // 목록을 여기서 만들어 넘긴다.
  const CLI_OPTIONS = [null, ...CLI_IDS]
  let detailExpanded = false

  emitKeypressEvents(stdin)
  stdin.setRawMode(true)
  stdin.resume()
  const keys = keyReader(stdin)
  stdout.write(ALT_ON + HIDE_CURSOR)

  const color = !env.NO_COLOR && stdout.isTTY
  const draw = (lines) => stdout.write(HOME + lines.map((l) => l + CLEAR_LINE).join('\n') + '\n' + CLEAR_DOWN)
  const paint = () => {
    const height = stdout.rows ?? 24
    state = scroll(state, bodyHeight(height, detailExpanded))
    draw(render(state, {
      width: stdout.columns ?? 80, height, repo: root, dryRun, color, status, t,
      detailExpanded, cliOptions: CLI_OPTIONS,
    }))
  }

  // 로그는 화면 안에 우겨넣지 않는다 — 실패 메시지가 길고, 잘리면 진단이 불가능해진다.
  const suspend = async (fn) => {
    stdout.write(ALT_OFF + SHOW_CURSOR)
    try { return await fn() } finally { stdout.write(ALT_ON + HIDE_CURSOR) }
  }
  const confirm = async (message) => {
    stdout.write(`\n${message}${t('tui.confirmSuffix')}`)
    const key = await keys.next()
    stdout.write('\n')
    return String(key.str ?? '').toLowerCase() === 'y'
  }
  const pause = async () => {
    stdout.write(`\n${t('tui.pressAnyKey')}`)
    await keys.next()
  }

  // 언어 전환은 선택을 보존해야 한다. 적용·액션 실행 뒤 재스캔은 그 반대로
  // 실제 설치 상태로 되돌려야 한다 — 둘을 한 함수로 묶으면 언어를 바꿀 때
  // 사용자가 고르던 항목이 조용히 날아간다.
  const rebuild = async (keepSelection) => {
    collected = await collectRows(root, { fetchImpl, designDirs, env, catalogFile, t, log: () => {} })
    const ids = keepSelection ? [...state.selected] : installedIds(collected.rows)
    state = replaceRows(state, collected.rows, ids)
  }
  const recollect = () => rebuild(false)

  const cycleLanguage = async () => {
    const next = LOCALES[(LOCALES.indexOf(t.locale) + 1) % LOCALES.length]
    t = createT(next)
    let note
    try {
      writeLang(root, next, { dryRun, log: () => {}, t })
      note = dryRun ? t('tui.lang.dryRun') : t('tui.lang.saved', { path: RECORD_REL })
    } catch (err) {
      // 언어는 부수적 설정이다. 저장에 실패했다고 화면이 죽으면 설치기를 못 쓴다.
      note = t('tui.lang.saveFailed', { message: err.message })
    }
    // 전환은 이번 실행에 이미 적용됐다(위에서 t를 갈아끼우고 아래에서 다시
    // 그린다) — 읽을 수 없는 언어에 갇힌 사용자가 빠져나올 길이 있어야 한다.
    // 알릴 것은 "다음 실행에서는 플래그·환경변수가 다시 이긴다"뿐이다.
    // note는 이미 "저장했다"를 말하므로 겹치지 않게 이어 붙인다.
    if (localeForced) note = `${note} · ${t('tui.lang.overridden')}`
    await rebuild(true)
    return note
  }

  const select = () => {
    const row = currentRow(state)
    if (row?.kind !== 'item') return t('tui.notItemRow')
    state = toggle(state)
    return ''
  }

  // 미리보기는 두 포커스에서 모두 통해야 한다 — 검색으로 찾은 직후가 가장 열어 보고 싶은 순간이다.
  const preview = () => {
    const row = currentRow(state)
    if (row?.kind !== 'item' || !row.previewTarget) return t('tui.noPreview')
    const notes = []
    openPreview(opener, row.item, (m) => notes.push(String(m).trim()), t)
    return notes.length > 0 ? notes.join(' ') : t('tui.opened', { target: row.previewTarget })
  }

  // 제출 검토 — 적용 직전에 변경 목록을 보여 주고 Enter/Esc만 받는다.
  const review = async (changes) => {
    for (;;) {
      draw(renderReview(changes, { width: stdout.columns ?? 80, height: stdout.rows ?? 24, dryRun, color, t }))
      const key = await keys.next()
      if (key.ctrl && key.name === 'c') return 'quit'
      if (key.name === 'escape') return 'cancel'
      if (key.name === 'return' || key.name === 'enter') return 'apply'
    }
  }

  // 적용 중에는 alt 화면을 떠나지 않는다. exec가 비동기가 된 덕에 이벤트
  // 루프가 살아 있어, 100ms 타이머가 경과 시간을 실제로 흘려 준다.
  const runApply = async (changes) => {
    let progress = { ...createProgress(changes), startedAt: Date.now() }
    let stopRequested = false

    // 중단 요청은 큐를 엿봐서 안다. 한 번 서면 되돌리지 않는다.
    const checkAbort = () => {
      if (!stopRequested && keys.hasAbort()) stopRequested = true
      return stopRequested
    }
    const drawProgress = () => draw(progressLines(progress, {
      width: stdout.columns ?? 80, height: stdout.rows ?? 24, color, dryRun, now: Date.now(), t,
    }))

    drawProgress()
    const timer = setInterval(() => { checkAbort(); drawProgress() }, 100)
    // 타이머가 프로세스를 붙잡지 않게 한다 — 화면 갱신은 종료를 미룰 이유가 없다.
    timer.unref?.()

    try {
      const results = await apply(root, changes, {
        dryRun,
        log: () => {}, // 로그는 진행 화면이 대신한다
        t,
        shouldStop: checkAbort,
        onProgress: (event) => {
          progress = applyEvent(progress, event, Date.now())
          drawProgress()
        },
      })
      // aborted는 apply()가 끝난 뒤에만 세운다 — 도중에 세우면 실행 중 항목이
      // aborted:true와 공존해, progressLines의 pending→skipped 겹쳐 보기가
      // 아직 끝나지 않은 항목까지 건너뛴 것으로 잘못 그린다. entries 자체는
      // 건드리지 않는다 — 시도조차 하지 않은 항목은 그대로 pending으로
      // 남아 있어야 progressLines(viewEntry)가 그 상태를 skipped로 겹쳐
      // 보며 표시와 집계("N건 건너뜀")를 함께 맞출 수 있다. 여기서 먼저
      // state를 skipped로 바꿔 버리면 그 겹쳐 보기가 더는 pending을 찾지
      // 못해 집계가 항상 0이 된다.
      progress = { ...progress, aborted: stopRequested }
      drawProgress()
      if (results.some((r) => !r.ok && !r.skipped)) process.exitCode = 1
      return results
    } finally {
      clearInterval(timer)
    }
  }

  try {
    for (;;) {
      paint()
      const key = await keys.next()
      status = ''

      if (key.ctrl && key.name === 'c') break

      // Ctrl 조합은 두 포커스에서 모두 통한다 — 검색으로 좁힌 직후가 CLI
      // 필터를 겹쳐 걸고 싶은 순간이다. 글자 키(c·d)를 쓰지 않는 이유는
      // 목록 포커스에서 아무 글자나 누르면 검색칸으로 올라가기 때문이다:
      // c를 필터에 배정하면 codex·claude를 검색어로 칠 수 없다.
      if (key.ctrl && (key.name === 'f' || key.name === 'b')) {
        state = cycleCliFilter(state, key.name === 'f' ? 1 : -1, CLI_OPTIONS)
        continue
      }
      if (key.ctrl && key.name === 'd') { detailExpanded = !detailExpanded; continue }

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
      if (key.name === 'pageup') { state = move(state, -bodyHeight(stdout.rows ?? 24, detailExpanded)); continue }
      if (key.name === 'pagedown') { state = move(state, bodyHeight(stdout.rows ?? 24, detailExpanded)); continue }

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
        const statusKey = state.selected.size >= before ? 'tui.toggledAll' : 'tui.toggledNone'
        status = t(statusKey, { tab: t(`section.${activeTab(state)}`) })
        continue
      }

      if (key.ctrl && key.name === 'o') { status = preview(); continue }

      if (key.name === 'return' || key.name === 'enter') {
        // 액션 행은 그 자리에서 실행한다. 나머지는 제출(검토 → 일괄 적용)이다.
        const row = currentRow(state)
        // 언어 행은 화면을 벗어나지 않는다 — 그 자리에서 t를 갈아끼우고 다시 그린다.
        if (row?.id === 'action.language') { status = await cycleLanguage(); continue }
        if (row?.kind === 'action') {
          await suspend(async () => {
            await row.run({ root, dryRun, skillMode, fetchImpl, catalogFile, log, confirm, t })
            await pause()
          })
          await recollect()
          continue
        }

        const changes = planChanges(itemStates(state.rows), state.selected)
        if (changes.length === 0) { status = t('tui.noChanges'); continue }

        const verdict = await review(changes)
        if (verdict === 'quit') break
        if (verdict === 'cancel') { status = t('tui.submitCancelled'); continue }

        const results = await runApply(changes)

        // 실패가 있으면 자세한 사연을 화면 밖에서 보여 준다 — 실패 메시지는
        // 길고, 화면 안에서 잘리면 진단이 불가능해진다. 건너뜀은 실패가
        // 아니다 — 진행 화면에 이미 나타났고, 다시 여기 나열하면 사용자가
        // 스스로 취소한 일을 실패처럼 읽게 된다.
        const notable = results.filter((r) => !r.ok && !r.skipped)
        await suspend(async () => {
          if (notable.length > 0) {
            log('')
            for (const r of notable) {
              const message = toText(t, r.message)
              log(`  ✖ ${t(`change.${r.action}`)} ${r.item.label}${message ? ` — ${message}` : ''}`)
            }
          }
          log(`\n${t('apply.seeGitDiff')}`)
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

  return { interactive: true, state }
}

export { printPlain, itemStates }
