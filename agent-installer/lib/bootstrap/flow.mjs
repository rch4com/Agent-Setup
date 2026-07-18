// 부트스트랩 진입점 — 순서와 보고만 담당한다.
// 무엇을 만들지는 manifest.mjs가, 어떻게 만들지는 apply.mjs·adapter.mjs가 안다.
import { MANIFEST } from './manifest.mjs'
import { ensureBlocks, ensureDirs, ensureFiles, ensureIgnore } from './apply.mjs'
import { configureAdapter } from './adapter.mjs'

const SKILL_MODES = ['auto', 'link', 'copy']

export function runBootstrap(root, opts = {}) {
  const { dryRun = false, skillMode = 'auto', log = console.log, manifest = MANIFEST } = opts

  if (!SKILL_MODES.includes(skillMode)) {
    throw new Error(`--skill-mode는 ${SKILL_MODES.join(', ')} 중 하나여야 합니다: ${skillMode}`)
  }

  const say = (message) => log(`[agent-setup] ${message}`)
  const ctx = { dryRun, log: say }

  say(`저장소 루트: ${root}`)
  say('글로벌 설정 경로는 읽거나 수정하지 않습니다.')

  const results = [
    ...ensureDirs(root, manifest.dirs, ctx),
    ...ensureFiles(root, manifest.files, ctx),
    ...ensureBlocks(root, manifest.blocks, ctx),
  ]

  // 어댑터는 항목별로 실패를 격리한다 — 하나가 실패해도 나머지를 계속한다.
  for (const entry of manifest.adapters) {
    try {
      results.push(configureAdapter(root, entry, { ...ctx, skillMode }))
    } catch (err) {
      results.push({ ok: false, action: 'link', path: entry.path, message: err.message })
    }
  }

  results.push(...ensureIgnore(root, manifest.ignore, ctx))

  const failed = results.filter((r) => !r.ok)
  log('')
  if (failed.length > 0) {
    say(`실패 ${failed.length}건:`)
    for (const f of failed) say(`  ✖ ${f.path} — ${f.message}`)
  }
  say('완료되었습니다.')
  say('공통 지침: AGENTS.md')
  say('공통 스킬: .agents/skills/')
  say(`적용 도구: ${manifest.tools.join(', ')}`)
  say('도구별 설정은 모두 현재 저장소 안에만 생성되었습니다.')
  say('기존 설정 파일은 덮어쓰지 않았습니다.')

  return { results, failed }
}
