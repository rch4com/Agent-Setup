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

  // 알림은 참고용이지 설치를 좌우하지 않는다. onProgress는 훗날 실제 렌더러가
  // 될 자리라(Task 11) 그 안의 버그가 던지면, notify를 감싸지 않는 한 예외가
  // apply()를 통째로 빠져나가 이미 디스크에 쓴 항목의 결과를 아무도 못 받는다.
  // command 단계 알림은 install/uninstall의 try 안에서 불리므로, 여기서 삼키지
  // 않으면 렌더링 버그가 그 항목의 설치 실패로 잘못 보고된다.
  const notify = (event) => {
    if (!onProgress) return
    try {
      onProgress({ total, ...event })
    } catch {
      // 무시한다 — 알림 실패로 설치를 멈추거나 결과를 뒤틀면 안 된다.
    }
  }

  // shouldStop도 같은 이유로 감싼다. 여기서 다시 던지면 UI 술어의 버그 하나가
  // 설치 전체를 중단시킨다 — 알림을 못 받는 것보다 더 나쁘다. 던지면 "멈추지
  // 않음"으로 취급해 계속 진행한다.
  const isStopRequested = () => {
    if (!shouldStop) return false
    try {
      return Boolean(shouldStop())
    } catch {
      return false
    }
  }

  for (let index = 0; index < total; index++) {
    const { item, action } = changes[index]

    // 중단은 **항목 경계에서만** 본다. 외부 명령을 중간에 죽이면 반쯤 설치된
    // 상태가 남는다 — 그래서 AbortSignal이 아니라 술어(predicate)다.
    if (isStopRequested()) {
      // skipped: true는 "시도조차 하지 않았다"는 뜻이다. ok는 성공하지 못했으니
      // false지만 실패는 아니다 — 소비자는 실패로 보고하거나 exitCode를 세우기
      // 전에 반드시 skipped를 먼저 확인해야 한다(!r.ok && !r.skipped).
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
