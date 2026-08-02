// 진행 화면 — 순수 함수 모듈이다. 터미널도 시계도 모른다.
//
// 시각을 인자로 받는 것이 핵심이다. 모듈 안에서 Date.now()를 부르면 테스트가
// 실제 시간에 묶여 "14초 경과"를 검증할 방법이 없다.
import { createT } from '../i18n/index.mjs'
import { cut, pad, width } from '../width.mjs'

const ESC = String.fromCharCode(27)
const DIM = `${ESC}[2m`
const BOLD = `${ESC}[1m`
const RESET = `${ESC}[0m`

const MARK = { done: '✔', failed: '✖', running: '▸', pending: ' ', skipped: '–' }

export function createProgress(changes) {
  return {
    total: changes.length,
    startedAt: null,
    aborted: false,
    entries: changes.map(({ item, action }) => ({
      item, action, state: 'pending', ok: null, ms: 0, command: null, startedAt: null,
    })),
  }
}

// 이벤트 하나를 접어 넣는다. 새 상태를 돌려준다 — 화면은 이 값만 보고 그린다.
export function applyEvent(progress, event, now) {
  const entries = progress.entries.slice()
  const at = entries[event.index]
  if (!at) return progress
  if (event.phase === 'start') entries[event.index] = { ...at, state: 'running', startedAt: now }
  else if (event.phase === 'command') entries[event.index] = { ...at, command: event.command }
  else if (event.phase === 'done') {
    entries[event.index] = { ...at, state: event.ok ? 'done' : 'failed', ok: event.ok, ms: event.ms ?? 0 }
  }
  return { ...progress, entries, startedAt: progress.startedAt ?? now }
}

function seconds(ms) {
  return (Math.max(0, ms) / 1000).toFixed(1).replace(/\.0$/, '')
}

function elapsedText(ms, t) {
  const total = Math.floor(Math.max(0, ms) / 1000)
  return total >= 60
    ? t('progress.elapsedMin', { minutes: Math.floor(total / 60), seconds: total % 60 })
    : t('progress.elapsed', { seconds: total })
}

function bar(done, total, room) {
  if (room <= 2) return ''
  const inner = room - 2
  const filled = total === 0 ? 0 : Math.round((done / total) * inner)
  return `[${'█'.repeat(filled)}${'░'.repeat(Math.max(0, inner - filled))}]`
}

// 항목 한 개가 차지하는 줄. 실행 중이면 경과와 명령을 함께 낸다.
function entryLines(entry, w, actionWidth, now, t) {
  let tail = ''
  if (entry.state === 'running') {
    const ran = Math.floor(Math.max(0, now - (entry.startedAt ?? now)) / 1000)
    tail = `  ${t('progress.running', { seconds: ran })}`
  } else if (entry.state === 'done' || entry.state === 'failed') {
    tail = `  ${t('progress.elapsed', { seconds: seconds(entry.ms) })}`
  } else if (entry.state === 'skipped') {
    tail = `  ${t('progress.skipped')}`
  }
  const mark = MARK[entry.state] ?? ' '
  const out = [cut(`${mark} ${pad(t(`change.${entry.action}`), actionWidth)} ${entry.item.label}${tail}`, w)]
  // 명령은 실행 중일 때만. 끝난 뒤에도 남기면 화면이 명령 목록이 된다.
  if (entry.state === 'running' && entry.command) out.push(cut(`      ${entry.command}`, w))
  return out
}

// 중단되면 아직 시작하지 않은(pending) 항목이 곧 건너뛴 항목이다. applyEvent는
// Task 9의 이벤트(start·command·done)만 받아 항목 상태가 'skipped'가 되는
// 경로가 없다 — 그래서 화면을 그릴 때만 pending을 skipped로 겹쳐 본다.
// 집계와 표시가 같은 규칙을 쓰게 해, "건너뜀 0건"처럼 숫자와 말이 어긋나지 않게 한다.
function viewEntry(entry, aborted) {
  return aborted && entry.state === 'pending' ? { ...entry, state: 'skipped' } : entry
}

export function progressLines(progress, opts = {}) {
  const { width: columns = 80, height = 24, color = false, dryRun = false, now = 0, t = createT('en') } = opts
  const w = Math.max(24, columns - 1)
  const paint = (code, text) => (color ? `${code}${text}${RESET}` : text)

  const done = progress.entries.filter((e) => e.state === 'done' || e.state === 'failed').length
  const skipped = progress.aborted ? progress.entries.filter((e) => e.state === 'pending').length : 0
  const percent = progress.total === 0 ? 100 : Math.round((done / progress.total) * 100)
  const counter = t('progress.counter', { done, total: progress.total, percent })
  const elapsed = progress.startedAt === null ? '' : `   ${elapsedText(now - progress.startedAt, t)}`

  const title = t('progress.title', { count: progress.total, suffix: dryRun ? ' (dry-run)' : '' })
  const lines = [paint(BOLD, cut(title, w)), '']

  const meta = `  ${counter}${elapsed}`
  lines.push(cut(`${bar(done, progress.total, Math.max(0, w - width(meta)))}${meta}`, w))
  lines.push('')

  const actionWidth = Math.max(...['install', 'complete', 'uninstall'].map((a) => width(t(`change.${a}`))))
  const body = Math.max(1, height - lines.length - 2)

  // 지면이 모자라면 **완료된 것부터** 접는다. 지금 무엇이 도는지가 가장 알고
  // 싶은 정보라, 실행 중 항목은 언제나 화면에 남는다.
  //
  // 실행 중 항목(없으면 마지막으로 끝난 항목)을 기준점으로 잡고 지면이
  // 허락하는 만큼만 위로 거슬러 올라간다. 기준점에서 시작하므로 그 줄이
  // 잘려 나갈 수 없다 — "완료분부터 접는다"를 규칙이 아니라 구조로 보장한다.
  const blocks = progress.entries.map((e) => entryLines(viewEntry(e, progress.aborted), w, actionWidth, now, t))
  const running = progress.entries.findIndex((e) => e.state === 'running')
  const anchor = running === -1 ? Math.max(0, done - 1) : running

  let from = anchor
  let used = blocks.slice(anchor).reduce((n, b) => n + b.length, 0)
  while (from > 0 && used + blocks[from - 1].length <= body - 1) {
    from--
    used += blocks[from].length
  }
  // '더보기' 줄은 부가 정보일 뿐이다. 지면이 1줄밖에 없으면 실행 중 항목이
  // 이긴다 — 더보기 줄에 밀려 정작 지금 도는 항목이 사라지면 안 된다.
  const showMore = from > 0 && body > 1
  const shown = blocks.slice(from).flat().slice(0, Math.max(1, body - (showMore ? 1 : 0)))
  if (showMore) lines.push(paint(DIM, cut(t('progress.more', { count: from }), w)))
  for (const line of shown) lines.push(line)
  for (let i = lines.length; i < height - 2; i++) lines.push('')

  lines.push('')
  const foot = progress.aborted
    ? t('progress.aborted', { count: skipped })
    : done < progress.total
      ? t('progress.abortHint')
      : t('progress.done', {
        ok: progress.entries.filter((e) => e.state === 'done').length,
        failed: progress.entries.filter((e) => e.state === 'failed').length,
        skippedSuffix: skipped > 0 ? t('progress.doneSkipped', { count: skipped }) : '',
      })
  lines.push(paint(DIM, cut(foot, w)))
  return lines.slice(0, height)
}

// 비TTY(CI·파이프)용. 바를 그리지 않고 항목마다 한 줄씩 흘린다 —
// ANSI 제어문자로 CI 로그를 더럽히지 않는다.
export function plainLine(event, t = createT('en')) {
  if (event.phase === 'start') {
    return t('progress.plain', {
      index: event.index + 1,
      total: event.total,
      action: t(`change.${event.action}`),
      label: event.item.label,
    })
  }
  if (event.phase === 'done') {
    return t('progress.plainDone', { mark: event.ok ? '✔' : '✖', seconds: seconds(event.ms ?? 0) })
  }
  return null
}
