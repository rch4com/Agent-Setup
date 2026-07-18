#!/usr/bin/env node
import * as p from '@clack/prompts'
import { findRepoRoot } from './lib/context.mjs'
import { loadItems } from './lib/catalog.mjs'
import { scan, planChanges, apply } from './lib/engine.mjs'
import { runDesign } from './lib/design-md/flow.mjs'

const STATUS_LABEL = { installed: '설치됨', partial: '일부 설치됨', absent: '미설치' }

function hint(item, state) {
  const parts = []
  if (state.status !== 'absent') parts.push(STATUS_LABEL[state.status])
  if (state.detail) parts.push(state.detail)
  if (item.scope === 'user') parts.push('설치 위치: 사용자 글로벌')
  const un = Object.entries(item.unsupported ?? {})
  if (item.category === 'mcp' && un.length > 0) {
    parts.push(`미지원: ${un.map(([cli, why]) => `${cli}(${why})`).join(', ')}`)
  }
  if (item.supports.length === 1 && item.supports[0] === 'claude') parts.push('Claude Code 전용')
  if (item.note) parts.push(item.note)
  return parts.join(' · ')
}

function requireValue(argv, name) {
  const value = argv[argv.indexOf(name) + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${name} 뒤에 값이 필요합니다.`)
  }
  return value
}

// 반복 지정 가능한 플래그 값 수집: `--flag <값>` 과 `--flag=<값>` 둘 다 받는다.
function collectValues(argv, name) {
  const values = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${name} 뒤에 값이 필요합니다.`)
      values.push(value)
      i++
    } else if (argv[i].startsWith(`${name}=`)) {
      const value = argv[i].slice(name.length + 1)
      if (!value) throw new Error(`${name} 뒤에 값이 필요합니다.`)
      values.push(value)
    }
  }
  return values
}

// `design` 서브커맨드 플래그 파싱.
function parseDesignArgs(argv) {
  const dryRun = argv.includes('--dry-run')
  const list = argv.includes('--list')
  const designDirs = collectValues(argv, '--design-dir')
  let set = null
  if (argv.includes('--set')) {
    const value = argv[argv.indexOf('--set') + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error('--set 뒤에 항목 목록이 필요합니다. 전체 제거는 --set "" 로 명시하세요.')
    }
    set = value
  }
  let preview = null
  if (argv.includes('--preview')) preview = requireValue(argv, '--preview')
  let sync = null
  const s = argv.find((a) => a === '--sync' || a.startsWith('--sync='))
  if (s) {
    const m = /^--sync=(installed|catalog|stale)$/.exec(s)
    if (!m) throw new Error('--sync=installed|catalog|stale 형식으로 지정하세요.')
    sync = m[1]
  }
  const interactive = !list && set === null && preview === null && sync === null
  return { dryRun, list, set, preview, sync, interactive, designDirs }
}

async function runClassic(root, { dryRun, listOnly, setArg, designDirs = [] }) {
  const items = await loadItems()
  const states = await scan(root, items)

  if (listOnly) {
    for (const s of states) console.log(`${STATUS_LABEL[s.status].padEnd(7)} ${s.item.id} — ${s.item.label}${s.detail ? ` (${s.detail})` : ''}`)
    return
  }

  let selectedIds
  if (setArg !== null) {
    selectedIds = new Set(setArg.split(',').map((s) => s.trim()).filter(Boolean))
    const known = new Set(items.map((i) => i.id))
    for (const id of selectedIds) if (!known.has(id)) throw new Error(`알 수 없는 항목: ${id}`)
  } else {
    p.intro(`agent-installer${dryRun ? ' (dry-run)' : ''} — 저장소: ${root}`)
    const mode = await p.select({
      message: '무엇을 관리할까요?',
      options: [
        { value: 'agents', label: '에이전트 설치 (plugin · mcp · skill)' },
        { value: 'design', label: 'design.md 라이브러리' },
      ],
    })
    if (p.isCancel(mode)) { p.cancel('취소되었습니다.'); return }
    if (mode === 'design') { await runDesign(root, { interactive: true, dryRun, designDirs }); return }

    const byCategory = { plugin: '플러그인', mcp: 'MCP 서버', skill: '스킬' }
    const selection = await p.groupMultiselect({
      message: '설치할 항목을 선택하세요 (체크 해제 = 제거)',
      options: Object.fromEntries(
        Object.entries(byCategory).map(([cat, label]) => [
          label,
          states.filter((s) => s.item.category === cat).map((s) => ({
            value: s.item.id,
            label: s.item.label,
            hint: hint(s.item, s),
          })),
        ]),
      ),
      initialValues: states.filter((s) => s.status !== 'absent').map((s) => s.item.id),
      required: false,
    })
    if (p.isCancel(selection)) { p.cancel('취소되었습니다.'); return }
    selectedIds = new Set(selection)
  }

  const changes = planChanges(states, selectedIds)
  if (changes.length === 0) { console.log('변경할 항목이 없습니다.'); return }

  const results = await apply(root, changes, { dryRun })
  const ACTION_LABEL = { install: '설치', complete: '보완 설치', uninstall: '제거' }
  for (const r of results) {
    const mark = r.ok ? '✔' : '✖'
    console.log(`${mark} ${ACTION_LABEL[r.action]} ${r.item.label}${r.message ? ` — ${r.message}` : ''}`)
  }

  const after = await scan(root, items)
  console.log('\n최종 상태:')
  for (const s of after) console.log(`  ${STATUS_LABEL[s.status].padEnd(7)} ${s.item.label}`)
  console.log('\n설정 파일 변경 내용은 git diff로 확인할 수 있습니다.')
  const failed = results.filter((r) => !r.ok)
  if (failed.length > 0) process.exitCode = 1
}

async function main() {
  const argv = process.argv.slice(2)
  const root = findRepoRoot()

  if (argv[0] === 'design') {
    await runDesign(root, parseDesignArgs(argv.slice(1)))
    return
  }

  const dryRun = argv.includes('--dry-run')
  const listOnly = argv.includes('--list')
  let setArg = null
  if (argv.includes('--set')) {
    const value = argv[argv.indexOf('--set') + 1]
    if (value === undefined || value.startsWith('--')) {
      console.error('--set 뒤에 항목 목록이 필요합니다. 전체 제거는 --set "" 로 명시하세요.')
      process.exit(2)
    }
    setArg = value
  }

  await runClassic(root, { dryRun, listOnly, setArg, designDirs: collectValues(argv, '--design-dir') })
}

main().catch((err) => { console.error(err.message); process.exit(1) })
