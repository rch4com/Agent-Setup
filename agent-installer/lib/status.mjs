// status — 의도(설치 기록) / 실제(스캔) / 가용(최신 패키지)을 나란히 보여준다.
//
// 실제 상태의 근거는 여전히 스캔이다. 기록은 의도일 뿐이므로 둘이 어긋나면
// 어느 쪽에만 있는지 갈라 보여준다 — 수동 설치·제거를 그대로 잡는다는
// 기존 강점을 기록이 가리지 않게 한다.
import { MANIFEST } from './bootstrap/manifest.mjs'
import { updateBlocks, updateFiles } from './bootstrap/apply.mjs'
import { readRecord, toolVersion } from './bootstrap/record.mjs'
import { createT } from './i18n/index.mjs'

export async function collectStatus(root, { manifest = MANIFEST, items = [], latest } = {}) {
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

  return lines.join('\n')
}

export async function runStatus(root, { json = false, log = console.log, t = createT('en') } = {}) {
  const { loadItems } = await import('./catalog.mjs')
  const report = await collectStatus(root, { items: await loadItems() })
  log(json ? JSON.stringify(report, null, 2) : formatStatus(report, t))
  return report
}
