// 설치 뒤 사용자가 CLI 안에서 해야 하는 일. CLI마다 한 번만 말한다 — 항목이
// 다섯 개라고 "새 세션을 시작하라"를 다섯 번 읽힐 이유가 없다.
import { CLIS, CLI_IDS } from './clis.mjs'
import { SHARED } from './recipe.mjs'

export function activationLines(changes, t) {
  const clis = new Set()
  const hookItems = []
  const extras = []
  for (const { item, action, state } of changes) {
    if (action === 'uninstall' || typeof item.steps !== 'function') continue
    // 공유 스킬 단계는 CLI가 아니라 디렉터리에 쓴다 — 그 디렉터리를 읽는,
    // 이 머신에 있는 CLI(reach)가 안내 대상이다.
    const touched = new Set(item.steps(action, state).flatMap((s) => (s.cli === SHARED ? state?.reach ?? [] : [s.cli])))
    // 실행된 단계가 없으면(대상 CLI가 이 머신에 없음) 이 항목에 대해 말할 것이 없다.
    if (touched.size === 0) continue
    for (const cli of touched) clis.add(cli)
    if (item.hooks && touched.has('codex') && !hookItems.includes(item.label)) hookItems.push(item.label)
    const extra = item.postInstall ? `${item.label}: ${t(item.postInstall)}` : null
    if (extra && !extras.includes(extra)) extras.push(extra)
  }
  if (clis.size === 0 && extras.length === 0) return []
  const lines = [t('activation.title')]
  for (const cli of CLI_IDS) {
    if (!clis.has(cli)) continue
    lines.push(`  ${CLIS[cli].label}: ${t(`activation.cli.${cli}`)}`)
    if (cli === 'codex' && hookItems.length > 0) lines.push(`    ${t('activation.hooks.codex', { items: hookItems.join(', ') })}`)
  }
  for (const e of extras) lines.push(`  · ${e}`)
  return lines
}
