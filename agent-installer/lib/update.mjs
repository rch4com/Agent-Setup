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
import { createT, toText } from './i18n/index.mjs'

// git이 유일한 되돌리기 수단이다. 커밋되지 않은 변경 위에 덮어쓰면 사용자가
// 잃은 것을 복구할 방법이 없다.
function assertCleanWorktree(root) {
  const out = execFileSync('git', ['-C', root, 'status', '--porcelain'], { encoding: 'utf8' })
  if (out.trim()) {
    throw new Error(
      '--force는 워킹트리가 깨끗할 때만 쓸 수 있습니다. ' +
      'git이 유일한 되돌리기 수단이라 커밋되지 않은 변경 위에 덮어쓰면 복구할 수 없습니다.',
    )
  }
}

export async function runUpdate(root, opts = {}) {
  const { dryRun = false, force = false, log = console.log, manifest = MANIFEST } = opts
  const say = (message) => log(`[agent-setup] ${message}`)

  const record = readRecord(root)
  if (!record) {
    throw new Error(
      `${RECORD_REL}이 없습니다. 이 저장소를 기록 체계로 끌어오려면 먼저 ` +
      '`bootstrap --adopt`를 실행하세요 — 파일을 만들지 않고 기록만 만듭니다.',
    )
  }

  if (force) assertCleanWorktree(root)

  // 2단계에서는 버전 차이를 보고만 한다. 여기서 중단시키면 기존 사용자의
  // 실행이 오류로 죽어 파괴적 변경이 된다. 엄격 검사는 apply와 함께 3단계다.
  const running = toolVersion()
  if (record.pinnedVersion && record.pinnedVersion !== running) {
    say(`고정 ${record.pinnedVersion} → 실행 중 ${running}`)
  }

  const ctx = { dryRun, force, log: say, managed: record.managed }
  const results = [
    ...updateFiles(root, manifest.files, ctx),
    ...updateBlocks(root, manifest.blocks, ctx),
    // 키 보장과 gitignore 항목 추가는 원래 멱등이라 그대로 재실행한다.
    ...ensureJsonKeys(root, manifest.settings ?? [], { dryRun, log: say }),
    ...ensureIgnore(root, manifest.ignore, { dryRun, log: say }),
  ]

  // 어댑터는 링크가 끊겼을 수 있어 재검증한다. 항목별로 실패를 격리한다.
  for (const entry of manifest.adapters) {
    results.push(configureAdapterSafe(root, entry, {
      dryRun, log: say, skillMode: record.skillMode,
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

  if (!dryRun) writeRecord(root, { ...record, managed }, { dryRun, log: say })

  log('')
  say(`갱신 ${updated.length}건 · 신규 ${created.length}건 · 드리프트 ${drift.length}건`)
  if (drift.length > 0) {
    say('드리프트 (건드리지 않았습니다)')
    // 결과 message는 이제 구조화 메시지다. 이 파일의 나머지 문구가 아직
    // 한국어 리터럴이라 여기서도 한국어로 고정한다 — Task 7이 파일 전체를
    // 지역화하면서 이 고정을 걷어낸다.
    for (const d of drift) {
      const drifted = toText(createT('ko'), d.message)
      say(`  ${d.path}${drifted ? ` — ${drifted}` : ''}`)
    }
    say('최신 템플릿을 반영하려면 update --force (워킹트리가 깨끗해야 합니다)')
  }

  return { results, drift, record: { ...record, managed } }
}
