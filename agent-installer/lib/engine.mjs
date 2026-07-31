import { makeExec } from './catalog.mjs'
import { createT, msg } from './i18n/index.mjs'

export async function scan(root, items) {
  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root })
      states.push({ item, status: r.status, detail: r.detail })
    } catch (err) {
      states.push({ item, status: 'absent', detail: msg('item.scanFailed', { message: err.message }) })
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

export async function apply(root, changes, { dryRun = false, log = console.log, t = createT('en') } = {}) {
  const exec = makeExec(dryRun, log)
  const results = []
  for (const { item, action } of changes) {
    // log까지 넘긴다 — 파일을 직접 쓰는 항목(MCP·design.md)은 exec를 거치지
    // 않아 dry-run에서 아무것도 보고하지 못했다. 결과줄은 ✔ 설치라고 찍히는데
    // 무엇이 바뀔지는 알 수 없는 상태였다.
    const ctx = { root, dryRun, exec, log, t }
    try {
      const fn = action === 'uninstall' ? item.uninstall : item.install
      const r = await fn.call(item, ctx)
      results.push({ item, action, ok: true, message: r?.message })
    } catch (err) {
      // LocalizedError는 .key를 들고 있다 — 구조체로 옮겨 담아야 표시하는
      // 쪽에서 toText로 활성 로케일에 맞게 다시 렌더할 수 있다. 그냥
      // err.message만 쓰면 LocalizedError.message는 항상 영어라 로케일이 섞인다.
      results.push({ item, action, ok: false, message: err.key ? msg(err.key, err.params) : err.message })
    }
  }
  return results
}
