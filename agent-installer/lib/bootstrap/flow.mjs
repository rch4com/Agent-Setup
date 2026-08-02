// 부트스트랩 진입점 — 순서와 보고만 담당한다.
// 무엇을 만들지는 manifest.mjs가, 어떻게 만들지는 apply.mjs·adapter.mjs가 안다.
import { MANIFEST } from './manifest.mjs'
import {
  configureAdapterSafe, ensureBlocks, ensureDirs, ensureFiles, ensureIgnore, ensureJsonKeys,
} from './apply.mjs'
import { RECORD_REL, collectManaged, emptyRecord, readRecord, writeRecord } from './record.mjs'
import { createT, LocalizedError, toText } from '../i18n/index.mjs'

const SKILL_MODES = ['auto', 'link', 'copy']

export function runBootstrap(root, opts = {}) {
  const { dryRun = false, skillMode = 'auto', adopt = false, log = console.log, manifest = MANIFEST, onProgress = null, t = createT('en') } = opts

  if (!SKILL_MODES.includes(skillMode)) {
    throw new LocalizedError('error.badSkillModeRuntime', { list: SKILL_MODES.join(', '), value: skillMode })
  }

  const say = (message) => log(`[agent-setup] ${message}`)
  const ctx = { dryRun, log: say, t }

  say(t('log.repoRoot', { path: root }))
  say(t('log.noGlobalWrites'))

  // 총 단계 수. 동기 파일 작업이라 단계 바만 돌지만, 무엇이 남았는지는
  // 알려 줄 수 있다. adopt는 파일을 만들지 않으므로 기록 쓰기 한 단계뿐이다.
  const total = adopt
    ? 1
    : manifest.dirs.length + manifest.files.length + (manifest.settings ?? []).length
      + manifest.blocks.length + manifest.adapters.length + manifest.ignore.length + 1
  let done = 0
  const step = (results) => {
    const list = Array.isArray(results) ? results : [results]
    for (const r of list) {
      done++
      if (onProgress) onProgress({ done, total, path: r?.path ?? null })
    }
    return list
  }

  // --adopt는 이미 있는 저장소를 기록 체계로 끌어오는 용도라 파일을 만들지
  // 않는다. 설치기를 복사해 쓰던 저장소가 여기로 들어온다.
  const results = adopt ? [] : [
    ...step(ensureDirs(root, manifest.dirs, ctx)),
    ...step(ensureFiles(root, manifest.files, ctx)),
    ...step(ensureJsonKeys(root, manifest.settings ?? [], ctx)),
    ...step(ensureBlocks(root, manifest.blocks, ctx)),
  ]

  if (!adopt) {
    // 어댑터는 항목별로 실패를 격리한다 — 하나가 실패해도 나머지를 계속한다.
    // update.mjs도 같은 격리를 써야 하므로 apply.mjs가 단일 출처다.
    for (const entry of manifest.adapters) {
      results.push(...step(configureAdapterSafe(root, entry, { ...ctx, skillMode })))
    }

    results.push(...step(ensureIgnore(root, manifest.ignore, ctx)))
  }

  // 기존 기록의 items·design은 보존한다 — 부트스트랩은 배선만 다루므로
  // 사용자가 고른 설치 항목을 지울 권한이 없다. dry-run에서는 읽지 않는다:
  // 깨진 기록이 "무엇이 바뀔지 확인"까지 막을 이유가 없다.
  const previous = dryRun ? null : readRecord(root)
  const record = {
    ...emptyRecord({ skillMode }),
    // 부트스트랩은 배선만 다룬다. 사용자가 고른 언어·항목을 지울 권한이 없다.
    lang: previous?.lang ?? null,
    items: previous?.items ?? [],
    design: previous?.design ?? [],
    managed: collectManaged(root, manifest),
  }
  results.push(...step(writeRecord(root, record, ctx)))

  // 실제 결과 수가 예측과 다르면 마지막 알림으로 100%를 맞춘다.
  // 진행 바가 87%에서 끝나면 사용자는 무엇이 실패했다고 읽는다.
  if (onProgress && done !== total) onProgress({ done: total, total, path: null })

  const failed = results.filter((r) => !r.ok)
  log('')
  if (failed.length > 0) {
    say(t('bootstrap.failures', { count: failed.length }))
    for (const f of failed) say(`  ✖ ${f.path} — ${toText(t, f.message)}`)
  }
  say(t('bootstrap.done'))
  say(t('bootstrap.sharedGuide'))
  say(t('bootstrap.sharedSkills'))
  say(t('bootstrap.tools', { list: manifest.tools.join(', ') }))
  say(t('bootstrap.repoOnly'))
  say(t('bootstrap.noOverwrite'))
  say(t('bootstrap.record', { path: RECORD_REL }))

  return { results, failed, record }
}
