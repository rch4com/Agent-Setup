import { makeExec } from './catalog.mjs'

export async function scan(root, items) {
  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root })
      states.push({ item, status: r.status, detail: r.detail })
    } catch (err) {
      states.push({ item, status: 'absent', detail: `감지 실패: ${err.message}` })
    }
  }
  return states
}

export function planChanges(states, selectedIds) {
  const changes = []
  for (const { item, status } of states) {
    const selected = selectedIds.has(item.id)
    if (selected && status === 'absent') changes.push({ item, action: 'install' })
    else if (selected && status === 'partial') changes.push({ item, action: 'complete' })
    else if (!selected && status !== 'absent') changes.push({ item, action: 'uninstall' })
  }
  return changes
}

export async function apply(root, changes, { dryRun = false, log = console.log } = {}) {
  const exec = makeExec(dryRun, log)
  const results = []
  for (const { item, action } of changes) {
    const ctx = { root, dryRun, exec }
    try {
      const fn = action === 'uninstall' ? item.uninstall : item.install
      const r = await fn.call(item, ctx)
      results.push({ item, action, ok: true, message: r?.message })
    } catch (err) {
      results.push({ item, action, ok: false, message: err.message })
    }
  }
  return results
}
