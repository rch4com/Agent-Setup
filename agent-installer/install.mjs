#!/usr/bin/env node
import * as p from '@clack/prompts'
import { findRepoRoot } from './lib/context.mjs'
import { loadItems } from './lib/catalog.mjs'
import { scan, planChanges, apply } from './lib/engine.mjs'

const argv = process.argv.slice(2)
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

async function main() {
  const root = findRepoRoot()
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

main().catch((err) => { console.error(err.message); process.exit(1) })
