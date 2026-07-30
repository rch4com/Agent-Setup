#!/usr/bin/env node
import { findRepoRoot } from './lib/context.mjs'
import { runBootstrap } from './lib/bootstrap/flow.mjs'
import { withDeps } from './lib/deps.mjs'
import {
  BOOTSTRAP_USAGE, DESIGN_USAGE, ROOT_USAGE, UPDATE_USAGE,
  parseBootstrapArgs, parseDesignArgs, parseRootArgs, parseUpdateArgs,
} from './lib/args.mjs'

// 위 정적 import는 전부 의존성 없는 모듈이다 — 부트스트랩은 npm install 없이 돌아야 하고,
// bootstrap.isolation.test.mjs가 이 불변식을 지킨다. lib/ 나머지는 동적 import로만 닿는다.

const STATUS_LABEL = { installed: '설치됨', partial: '일부 설치됨', absent: '미설치' }
const ACTION_LABEL = { install: '설치', complete: '보완 설치', uninstall: '제거' }

// 대화형 화면은 TUI가 맡는다.
async function openTui(root, { dryRun, skillMode, designDirs }) {
  const { runTui } = await withDeps(() => import('./lib/tui/run.mjs'))
  // skillMode는 화면 안의 '부트스트랩 실행' 작업이 쓴다. design 경로에서는
  // 없으므로 undefined가 넘어가고 runTui의 기본값(auto)이 적용된다.
  await runTui(root, { dryRun, skillMode, designDirs })
}

// --list / --set 전용 비대화형 경로.
async function runClassic(root, { dryRun, listOnly, setArg }) {
  const { loadItems } = await withDeps(() => import('./lib/catalog.mjs'))
  const { scan, planChanges, apply } = await withDeps(() => import('./lib/engine.mjs'))
  const items = await loadItems()
  const states = await scan(root, items)

  if (listOnly) {
    for (const s of states) console.log(`${STATUS_LABEL[s.status].padEnd(7)} ${s.item.id} — ${s.item.label}${s.detail ? ` (${s.detail})` : ''}`)
    return
  }

  const selectedIds = new Set(setArg.split(',').map((s) => s.trim()).filter(Boolean))
  const known = new Set(items.map((i) => i.id))
  for (const id of selectedIds) if (!known.has(id)) throw new Error(`알 수 없는 항목: ${id}`)

  const changes = planChanges(states, selectedIds)
  if (changes.length === 0) { console.log('변경할 항목이 없습니다.'); return }

  const results = await apply(root, changes, { dryRun })
  for (const r of results) {
    console.log(`${r.ok ? '✔' : '✖'} ${ACTION_LABEL[r.action]} ${r.item.label}${r.message ? ` — ${r.message}` : ''}`)
  }

  const after = await scan(root, items)
  console.log('\n최종 상태:')
  for (const s of after) console.log(`  ${STATUS_LABEL[s.status].padEnd(7)} ${s.item.label}`)
  console.log('\n설정 파일 변경 내용은 git diff로 확인할 수 있습니다.')
  if (results.some((r) => !r.ok)) process.exitCode = 1
}

async function main() {
  const argv = process.argv.slice(2)
  const root = findRepoRoot()

  if (argv[0] === 'bootstrap') {
    const opts = parseBootstrapArgs(argv.slice(1))
    if (opts.help) { console.log(BOOTSTRAP_USAGE); return }
    const { failed } = runBootstrap(root, opts)
    if (failed.length > 0) process.exitCode = 1
    return
  }

  if (argv[0] === 'update') {
    const opts = parseUpdateArgs(argv.slice(1))
    if (opts.help) { console.log(UPDATE_USAGE); return }
    // 항목 수렴을 위해 스캔이 필요해 의존성 있는 모듈에 닿는다.
    const { runUpdate } = await withDeps(() => import('./lib/update.mjs'))
    await runUpdate(root, opts)
    return
  }

  if (argv[0] === 'design') {
    const opts = parseDesignArgs(argv.slice(1))
    if (opts.help) { console.log(DESIGN_USAGE); return }
    // 플래그 없는 `design`은 통합 화면을 연다 — DESIGN.MD 섹션이 그 안에 있다.
    if (opts.interactive) return openTui(root, opts)
    const { runDesign } = await withDeps(() => import('./lib/design-md/flow.mjs'))
    await runDesign(root, opts)
    return
  }

  const opts = parseRootArgs(argv)
  if (opts.help) { console.log(ROOT_USAGE); return }
  if (opts.interactive) return openTui(root, opts)
  await runClassic(root, opts)
}

main().catch((err) => { console.error(err.message); process.exit(1) })
