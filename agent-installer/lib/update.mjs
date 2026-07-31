// update 흐름 — 관리 파일을 최신 템플릿으로 옮기고 드리프트를 보고한다.
//
// 갱신 판정은 apply.mjs의 updateFiles·updateBlocks가 하고, 여기는 순서와
// 보고, 그리고 기록 갱신만 담당한다. flow.mjs가 생성 쪽에서 하는 역할과 같다.
import { execFileSync } from 'node:child_process'
import { MANIFEST } from './bootstrap/manifest.mjs'
import {
  configureAdapterSafe, ensureIgnore, ensureJsonKeys, updateBlocks, updateFiles,
} from './bootstrap/apply.mjs'
import { RECORD_REL, managedKey, readRecord, toolVersion, writeRecord } from './bootstrap/record.mjs'
import { LocalizedError, createT, toText } from './i18n/index.mjs'

// git이 유일한 되돌리기 수단이다. 커밋되지 않은 변경 위에 덮어쓰면 사용자가
// 잃은 것을 복구할 방법이 없다.
function assertCleanWorktree(root) {
  const out = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' })
  if (out.trim()) {
    throw new LocalizedError('error.forceNeedsCleanTree')
  }
}

export async function runUpdate(root, opts = {}) {
  const { dryRun = false, force = false, log = console.log, manifest = MANIFEST, t = createT('en') } = opts
  const say = (message) => log(`[agent-setup] ${message}`)

  const record = readRecord(root)
  if (!record) {
    throw new LocalizedError('error.noRecordForUpdate', { path: RECORD_REL })
  }

  if (force) assertCleanWorktree(root)

  // 2단계에서는 버전 차이를 보고만 한다. 여기서 중단시키면 기존 사용자의
  // 실행이 오류로 죽어 파괴적 변경이 된다. 엄격 검사는 apply와 함께 3단계다.
  const running = toolVersion()
  if (record.pinnedVersion && record.pinnedVersion !== running) {
    say(t('update.versionMove', { pinned: record.pinnedVersion, running }))
  }

  const ctx = { dryRun, force, log: say, managed: record.managed, t }
  const results = [
    ...updateFiles(root, manifest.files, ctx),
    ...updateBlocks(root, manifest.blocks, ctx),
    // 키 보장과 gitignore 항목 추가는 원래 멱등이라 그대로 재실행한다.
    ...ensureJsonKeys(root, manifest.settings ?? [], { dryRun, log: say, t }),
    ...ensureIgnore(root, manifest.ignore, { dryRun, log: say, t }),
  ]

  // 어댑터는 링크가 끊겼을 수 있어 재검증한다. 항목별로 실패를 격리한다.
  for (const entry of manifest.adapters) {
    results.push(configureAdapterSafe(root, entry, {
      dryRun, log: say, skillMode: record.skillMode, t,
    }))
  }

  // 성공한 것만 기록에 옮긴다. 드리프트는 hash를 담지 않으므로 옛 해시가
  // 남아, 사용자가 원복하면 다음 update가 다시 집어간다.
  const managed = { ...record.managed }
  for (const r of results) {
    if (!r.hash) continue
    const isBlock = manifest.blocks.some((b) => b.path === r.path)
    managed[managedKey(r.path, isBlock)] = r.hash
  }

  const drift = results.filter((r) => r.action === 'drift')
  const updated = results.filter((r) => r.action === 'update')
  const created = results.filter((r) => r.action === 'create')

  if (!dryRun) writeRecord(root, { ...record, managed }, { dryRun, log: say, t })

  log('')
  say(t('update.summary', { updated: updated.length, created: created.length, drift: drift.length }))
  if (drift.length > 0) {
    say(t('update.driftHeader'))
    // 결과 message는 구조화 메시지(msg())다. 문자열 삽입 자리에 그대로
    // 꽂으면 "[object Object]"가 찍히므로 toText로 활성 로케일에 맞춰 푼다.
    for (const d of drift) {
      const drifted = toText(t, d.message)
      say(`  ${d.path}${drifted ? ` — ${drifted}` : ''}`)
    }
    say(t('update.driftHint'))
  }

  return { results, drift, record: { ...record, managed } }
}
