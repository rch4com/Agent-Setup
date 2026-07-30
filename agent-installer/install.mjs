#!/usr/bin/env node
import { findRepoRoot } from './lib/context.mjs'
import { runBootstrap } from './lib/bootstrap/flow.mjs'
import { readRecord } from './lib/bootstrap/record.mjs'
import { withDeps } from './lib/deps.mjs'
import { LocalizedError, createT, resolveLocale, toText } from './lib/i18n/index.mjs'
import { detectLocale } from './lib/i18n/detect.mjs'
import {
  bootstrapUsage, designUsage, rootUsage, statusUsage, updateUsage,
  parseBootstrapArgs, parseDesignArgs, parseRootArgs, parseStatusArgs, parseUpdateArgs, preScanLang,
} from './lib/args.mjs'

// 위 정적 import는 전부 의존성 없는 모듈이다 — 부트스트랩은 npm install 없이 돌아야 하고,
// bootstrap.isolation.test.mjs가 이 불변식을 지킨다. lib/ 나머지는 동적 import로만 닿는다.

// 저장소 탐지와 기록 읽기는 "있으면 쓴다"로만 한다. 여기서 던지면 언어를
// 정하기도 전에 죽어, 한국어를 모르는 사람이 한국어 오류를 보게 된다.
// 삼킨 오류는 사라지지 않는다 — 기록을 실제로 쓰는 명령이 readRecord를
// 정식으로 다시 불러 그때 지역화된 오류로 던진다.
function tryFindRepoRoot() {
  try { return findRepoRoot() } catch { return null }
}

function tryReadRecord(root) {
  try { return readRecord(root) } catch { return null }
}

// 대화형 화면은 TUI가 맡는다.
async function openTui(root, { dryRun, skillMode, designDirs, t, localeForced }) {
  const { runTui } = await withDeps(() => import('./lib/tui/run.mjs'), t)
  // skillMode는 화면 안의 '부트스트랩 실행' 작업이 쓴다. design 경로에서는
  // 없으므로 undefined가 넘어가고 runTui의 기본값(auto)이 적용된다.
  await runTui(root, { dryRun, skillMode, designDirs, t, localeForced })
}

// --list / --set 전용 비대화형 경로.
async function runClassic(root, { dryRun, listOnly, setArg, t }) {
  const { loadItems } = await withDeps(() => import('./lib/catalog.mjs'), t)
  const { scan, planChanges, apply } = await withDeps(() => import('./lib/engine.mjs'), t)
  const items = await loadItems()
  const states = await scan(root, items)

  if (listOnly) {
    for (const s of states) {
      const detail = toText(t, s.detail)
      console.log(`${t(`status.${s.status}`).padEnd(13)} ${s.item.id} — ${s.item.label}${detail ? ` (${detail})` : ''}`)
    }
    return
  }

  const selectedIds = new Set(setArg.split(',').map((s) => s.trim()).filter(Boolean))
  const known = new Set(items.map((i) => i.id))
  for (const id of selectedIds) if (!known.has(id)) throw new LocalizedError('error.unknownItem', { id })

  const changes = planChanges(states, selectedIds)
  if (changes.length === 0) { console.log(t('apply.noChanges')); return }

  const results = await apply(root, changes, { dryRun, t })
  for (const r of results) {
    console.log(`${r.ok ? '✔' : '✖'} ${t(`change.${r.action}`)} ${r.item.label}${r.message ? ` — ${toText(t, r.message)}` : ''}`)
  }

  const after = await scan(root, items)
  console.log(`\n${t('apply.finalState')}`)
  for (const s of after) console.log(`  ${t(`status.${s.status}`).padEnd(13)} ${s.item.label}`)
  console.log(`\n${t('apply.seeGitDiff')}`)
  if (results.some((r) => !r.ok)) process.exitCode = 1
}

async function main() {
  const argv = process.argv.slice(2)

  const flag = preScanLang(argv)
  const root = tryFindRepoRoot()
  const record = root === null ? null : tryReadRecord(root)
  const locale = resolveLocale({ flag, env: process.env, record, detected: detectLocale(process.env) })
  const t = createT(locale)
  // 플래그·환경변수가 로케일을 강제하면 TUI의 언어 전환이 이번 실행에
  // 반영되지 않는다. 조용히 안 먹는 대신 화면이 그 사실을 알리게 한다.
  const localeForced = Boolean(flag) || Boolean(process.env.AGENT_SETUP_LANG)

  if (root === null) throw new LocalizedError('error.notGitRepo')

  if (argv[0] === 'bootstrap') {
    const opts = parseBootstrapArgs(argv.slice(1), t)
    if (opts.help) { console.log(bootstrapUsage(t)); return }
    const { failed } = runBootstrap(root, { ...opts, t })
    if (failed.length > 0) process.exitCode = 1
    return
  }

  if (argv[0] === 'update') {
    const opts = parseUpdateArgs(argv.slice(1), t)
    if (opts.help) { console.log(updateUsage(t)); return }
    // 항목 수렴을 위해 스캔이 필요해 의존성 있는 모듈에 닿는다.
    const { runUpdate } = await withDeps(() => import('./lib/update.mjs'), t)
    await runUpdate(root, { ...opts, t })
    return
  }

  if (argv[0] === 'status') {
    const opts = parseStatusArgs(argv.slice(1), t)
    if (opts.help) { console.log(statusUsage(t)); return }
    // 항목 스캔이 필요해 의존성 있는 모듈에 닿는다.
    const { runStatus } = await withDeps(() => import('./lib/status.mjs'), t)
    await runStatus(root, { ...opts, t })
    return
  }

  if (argv[0] === 'design') {
    const opts = parseDesignArgs(argv.slice(1), t)
    if (opts.help) { console.log(designUsage(t)); return }
    // 플래그 없는 `design`은 통합 화면을 연다 — DESIGN.MD 섹션이 그 안에 있다.
    if (opts.interactive) return openTui(root, { ...opts, t, localeForced })
    const { runDesign } = await withDeps(() => import('./lib/design-md/flow.mjs'), t)
    await runDesign(root, { ...opts, t })
    return
  }

  const opts = parseRootArgs(argv, t)
  if (opts.help) { console.log(rootUsage(t)); return }
  if (opts.interactive) return openTui(root, { ...opts, t, localeForced })
  await runClassic(root, { ...opts, t })
}

// 오류는 한 곳에서 지역화한다. LocalizedError의 .message는 영어라
// 스택 트레이스가 읽히고, 여기서 활성 로케일로 다시 렌더한다.
main().catch((err) => {
  const t = createT(resolveLocale({ env: process.env, detected: detectLocale(process.env) }))
  console.error(err.key ? t(err.key, err.params) : err.message)
  process.exit(1)
})
