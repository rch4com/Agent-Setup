// status — 의도(설치 기록) / 실제(스캔) / 가용(최신 패키지)을 나란히 보여준다.
//
// 실제 상태의 근거는 여전히 스캔이다. 기록은 의도일 뿐이므로 둘이 어긋나면
// 어느 쪽에만 있는지 갈라 보여준다 — 수동 설치·제거를 그대로 잡는다는
// 기존 강점을 기록이 가리지 않게 한다.
import { MANIFEST } from './bootstrap/manifest.mjs'
import { updateBlocks, updateFiles } from './bootstrap/apply.mjs'
import { readRecord, toolVersion } from './bootstrap/record.mjs'
import { createT } from './i18n/index.mjs'

// 미배선 사유는 상류를 실측한 날의 사실이다. 그 날짜(item.verified)가 이보다
// 오래되면 status가 알린다 — 사유 문장이 화면에 낡은 채 남는 것을 막는 유일한
// 장치다. 90일은 상류 하니스들의 릴리스 간격을 넉넉히 덮는 값이다.
export const STALE_DAYS = 90

function daysSince(iso, now) {
  const ms = now - Date.parse(`${iso}T00:00:00Z`)
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : 0
}

export async function collectStatus(root, { manifest = MANIFEST, items = [], latest, now = Date.now() } = {}) {
  const record = readRecord(root)

  // dry-run으로 갱신 판정만 얻는다 — 판정 로직을 두 벌 두면 status와 update가
  // 다른 답을 내는 순간이 온다.
  const silent = () => {}
  const verdicts = record
    ? [
        ...updateFiles(root, manifest.files, { managed: record.managed, dryRun: true, log: silent }),
        ...updateBlocks(root, manifest.blocks, { managed: record.managed, dryRun: true, log: silent }),
      ]
    : []

  const count = (action) => verdicts.filter((v) => v.action === action).length

  const states = []
  for (const item of items) {
    try {
      const r = await item.detect({ root })
      states.push({ id: item.id, status: r.status })
    } catch {
      // 감지 실패로 status 전체가 죽으면 진단 도구가 아니다.
      states.push({ id: item.id, status: 'absent' })
    }
  }
  const installed = states.filter((s) => s.status !== 'absent').map((s) => s.id)
  const intended = new Set(record?.items ?? [])
  const stale = items
    .filter((i) => i.verified && daysSince(i.verified, now) > STALE_DAYS)
    .map((i) => ({ id: i.id, verified: i.verified }))

  return {
    hasRecord: Boolean(record),
    tool: {
      pinned: record?.pinnedVersion ?? null,
      running: toolVersion(),
      latest: latest ?? null,
    },
    files: {
      total: verdicts.length,
      current: count('skip'),
      pending: count('update') + count('create'),
      drift: count('drift'),
    },
    items: {
      installed,
      recordOnly: [...intended].filter((id) => !installed.includes(id)),
      repoOnly: installed.filter((id) => !intended.has(id)),
      stale,
    },
  }
}

export function formatStatus(report, t = createT('en')) {
  const lines = []
  const { tool, files, items } = report

  if (!report.hasRecord) {
    lines.push(t('status.noRecord'))
    lines.push(t('status.noRecord.hint1'))
    lines.push(t('status.noRecord.hint2'))
    return lines.join('\n')
  }

  const version = tool.latest && tool.latest !== tool.running
    ? t('status.version.latest', { pinned: tool.pinned, running: tool.running, latest: tool.latest })
    : t('status.version.pinned', { pinned: tool.pinned, running: tool.running })
  lines.push(t('status.row.tool', { version }))
  if (tool.pinned !== tool.running) lines.push(t('status.hint.update'))

  lines.push(t('status.row.files', files))
  if (files.pending > 0) lines.push(t('status.hint.pending'))
  if (files.drift > 0) lines.push(t('status.hint.drift'))

  lines.push(t('status.row.items', { list: items.installed.join(', ') || t('status.none') }))
  if (items.recordOnly.length) lines.push(t('status.row.recordOnly', { list: items.recordOnly.join(', ') }))
  if (items.repoOnly.length) lines.push(t('status.row.repoOnly', { list: items.repoOnly.join(', ') }))
  if (items.stale?.length) {
    lines.push(t('status.row.stale', { list: items.stale.map((s) => `${s.id} (${s.verified})`).join(', ') }))
    lines.push(t('status.hint.stale', { days: STALE_DAYS }))
  }

  return lines.join('\n')
}

// 레지스트리의 최신 발행 버전. status는 진단 명령이라 네트워크가 없거나
// 느려도 죽으면 안 된다 — 어떤 실패든 null로 떨어뜨리고 화면은 "최신"
// 자리만 비운다. 시간 제한은 짧게 둔다: 이 한 줄 때문에 status가 20초를
// 기다리면 진단 도구가 아니다.
export const LATEST_TIMEOUT_MS = 5000
const LATEST_URL = 'https://registry.npmjs.org/@rch4com%2Fagent-setup/latest'

export async function fetchLatestVersion(fetchImpl = fetch) {
  try {
    const res = await fetchImpl(LATEST_URL, { signal: AbortSignal.timeout(LATEST_TIMEOUT_MS) })
    if (!res.ok) return null
    const version = (await res.json())?.version
    return typeof version === 'string' && version ? version : null
  } catch {
    return null
  }
}

export async function runStatus(root, { json = false, log = console.log, fetchImpl = fetch, t = createT('en') } = {}) {
  const { loadItems } = await import('./catalog.mjs')
  const report = await collectStatus(root, { items: await loadItems(), latest: await fetchLatestVersion(fetchImpl) })
  log(json ? JSON.stringify(report, null, 2) : formatStatus(report, t))
  return report
}
