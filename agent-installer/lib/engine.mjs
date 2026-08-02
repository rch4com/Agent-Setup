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

export async function apply(root, changes, { dryRun = false, log = console.log, t = createT('en'), onProgress = null, shouldStop = null } = {}) {
  const baseExec = makeExec(dryRun, log)
  const results = []
  const total = changes.length
  const notify = (event) => { if (onProgress) onProgress({ total, ...event }) }

  for (let index = 0; index < total; index++) {
    const { item, action } = changes[index]

    // 중단은 **항목 경계에서만** 본다. 외부 명령을 중간에 죽이면 반쯤 설치된
    // 상태가 남는다 — 그래서 AbortSignal이 아니라 술어(predicate)다.
    if (shouldStop && shouldStop()) {
      results.push({ item, action, ok: false, skipped: true })
      continue
    }

    notify({ index, item, action, phase: 'start' })
    const startedAt = Date.now()

    // 화면이 "지금 무엇이 도는가"를 보여 줄 수 있는 유일한 경로다.
    const exec = async (cmd, args, opts) => {
      notify({ index, item, action, phase: 'command', command: [cmd, ...args].join(' ') })
      return baseExec(cmd, args, opts)
    }

    // log까지 넘긴다 — 파일을 직접 쓰는 항목(MCP·design.md)은 exec를 거치지
    // 않아 dry-run에서 아무것도 보고하지 못했다. 결과줄은 ✔ 설치라고 찍히는데
    // 무엇이 바뀔지는 알 수 없는 상태였다.
    const ctx = { root, dryRun, exec, log, t }
    let result
    try {
      const fn = action === 'uninstall' ? item.uninstall : item.install
      const r = await fn.call(item, ctx)
      result = { item, action, ok: true, message: r?.message }
    } catch (err) {
      // LocalizedError는 .key를 들고 있다 — 구조체로 옮겨 담아야 표시하는
      // 쪽에서 toText로 활성 로케일에 맞게 다시 렌더할 수 있다. 그냥
      // err.message만 쓰면 LocalizedError.message는 항상 영어라 로케일이 섞인다.
      result = { item, action, ok: false, message: err.key ? msg(err.key, err.params) : err.message }
    }
    results.push(result)
    notify({ index, item, action, phase: 'done', ok: result.ok, ms: Date.now() - startedAt, message: result.message })
  }
  return results
}
