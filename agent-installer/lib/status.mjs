// status — 의도(설치 기록) / 실제(스캔) / 가용(최신 패키지)을 나란히 보여준다.
//
// 실제 상태의 근거는 여전히 스캔이다. 기록은 의도일 뿐이므로 둘이 어긋나면
// 어느 쪽에만 있는지 갈라 보여준다 — 수동 설치·제거를 그대로 잡는다는
// 기존 강점을 기록이 가리지 않게 한다.
import { MANIFEST } from './bootstrap/manifest.mjs'
import { updateBlocks, updateFiles } from './bootstrap/apply.mjs'
import { readRecord, toolVersion } from './bootstrap/record.mjs'

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

export function formatStatus(report) {
  const lines = []
  const { tool, files, items } = report

  if (!report.hasRecord) {
    lines.push('설치 기록이 없습니다.')
    lines.push('  이 저장소를 기록 체계로 끌어오려면 bootstrap --adopt 를 실행하세요.')
    lines.push('  파일을 만들지 않고, 템플릿과 같은 파일만 관리 대상으로 기록합니다.')
    return lines.join('\n')
  }

  const version = tool.latest && tool.latest !== tool.running
    ? `${tool.pinned} 고정 · 실행 중 ${tool.running} · 최신 ${tool.latest}`
    : `${tool.pinned} 고정 · 실행 중 ${tool.running}`
  lines.push(`도구        ${version}`)
  if (tool.pinned !== tool.running) lines.push('            → update로 고정 버전을 옮길 수 있습니다')

  lines.push(`관리 파일   ${files.total}개 중 ${files.current} 최신 · ${files.pending} 갱신 대기 · ${files.drift} 사용자 수정`)
  if (files.pending > 0) lines.push('            → update')
  if (files.drift > 0) lines.push('            → 사용자 수정 파일은 update가 건드리지 않습니다')

  lines.push(`항목        설치됨     ${items.installed.join(', ') || '(없음)'}`)
  if (items.recordOnly.length) lines.push(`            기록에만   ${items.recordOnly.join(', ')}`)
  if (items.repoOnly.length) lines.push(`            저장소에만 ${items.repoOnly.join(', ')}`)

  return lines.join('\n')
}

export async function runStatus(root, { json = false, log = console.log } = {}) {
  const { loadItems } = await import('./catalog.mjs')
  const report = await collectStatus(root, { items: await loadItems() })
  log(json ? JSON.stringify(report, null, 2) : formatStatus(report))
  return report
}
