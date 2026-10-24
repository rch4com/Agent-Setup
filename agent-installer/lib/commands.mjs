// 출력 모드(--print). 실행 모드와 같은 item.steps()에서 명령을 얻는다 —
// 사용자가 복사해 직접 돌리는 명령과 설치기가 도는 명령이 같아야 한다.
import { CLIS, CLI_IDS } from './clis.mjs'
import { shellQuote } from './catalog.mjs'
import { SHARED } from './recipe.mjs'

const ORDER = [SHARED, ...CLI_IDS, 'files']
// 따옴표 없이도 셸이 한 인자로 읽는 문자만. 복사해 붙일 줄이 읽기 쉬워야 한다.
const PLAIN = /^[A-Za-z0-9_@+=:,./-]+$/

export function quoteArg(arg, platform = process.platform) {
  return PLAIN.test(arg) ? arg : shellQuote(arg, platform)
}

export function planCommands(changes) {
  const groups = new Map()
  const push = (key, entry) => {
    if (!groups.has(key)) groups.set(key, { key, entries: [] })
    groups.get(key).entries.push(entry)
  }
  for (const { item, action, state } of changes) {
    // 파일을 직접 쓰는 항목(.gitmessage.txt 등)은 명령이 없다.
    if (typeof item.steps !== 'function') { push('files', { item, action, manual: true }); continue }
    for (const step of item.steps(action, state)) push(step.cli, { item, action, step })
  }
  return ORDER.filter((k) => groups.has(k)).map((k) => groups.get(k))
}

export function formatCommands(groups, { t, scope, platform = process.platform }) {
  if (groups.length === 0) return [t('print.none')]
  const lines = [t('print.title'), '']
  for (const g of groups) {
    const title = g.key === SHARED ? t('print.shared') : g.key === 'files' ? t('print.files') : CLIS[g.key].label
    lines.push(`# ${title} — ${t(`scope.${scope}`)}`)
    for (const e of g.entries) {
      if (e.manual) lines.push(`# ${t('print.fileItem', { label: e.item.label })}`)
      else if (e.step.fn) lines.push(`#   ${e.step.describe}`)
      else lines.push(e.step.argv.map((a) => quoteArg(a, platform)).join(' '))
    }
    lines.push('')
  }
  return lines
}
