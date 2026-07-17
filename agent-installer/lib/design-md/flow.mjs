import * as p from '@clack/prompts'
import { scan, planChanges, apply } from '../engine.mjs'
import { loadCatalog, saveCatalog, buildItems, allEntries, sha256 } from './catalog.mjs'
import { PROVIDERS } from './providers/index.mjs'
import { makeOpener, openPreview } from './open.mjs'

const STATUS_LABEL = { installed: '설치됨', partial: '일부', absent: '미설치' }

function short(text, n = 60) {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function designHint(state) {
  const parts = [state.item.designCategory]
  if (state.status !== 'absent') parts.push(STATUS_LABEL[state.status])
  if (state.item.description) parts.push(short(state.item.description))
  return parts.filter(Boolean).join(' · ')
}

function matchSearch(item, query) {
  const hay = `${item.name} ${item.label} ${item.designCategory} ${item.description}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok))
}

function report(results, log) {
  const ACTION = { install: '설치', complete: '보완', uninstall: '제거' }
  for (const r of results) {
    log(`  ${r.ok ? '✔' : '✖'} ${ACTION[r.action]} ${r.item.label}${r.message ? ` — ${r.message}` : ''}`)
  }
}

// ── 비대화형/공용 코어 ─────────────────────────────────────────────

function printList(states, log) {
  for (const s of states) {
    log(`${STATUS_LABEL[s.status].padEnd(4)} ${s.item.name} — ${s.item.label} [${s.item.designCategory}]`)
  }
}

function openPreviews(items, names, opener, log) {
  const byName = new Map(items.map((i) => [i.name, i]))
  for (const raw of names) {
    const name = raw.trim()
    if (!name) continue
    const item = byName.get(name)
    if (!item) { log(`  알 수 없는 항목: ${name}`); continue }
    openPreview(opener, item, log)
  }
}

// 보이는 집합(visibleStates) 안에서만 diff/적용한다.
async function applyVisible(root, visibleStates, selectedIds, { dryRun, log }) {
  const changes = planChanges(visibleStates, selectedIds)
  if (changes.length === 0) { log('변경할 항목이 없습니다.'); return [] }
  const results = await apply(root, changes, { dryRun, log })
  report(results, log)
  return results
}

async function installedItems(root, items) {
  const out = []
  for (const item of items) {
    if ((await item.detect({ root })).status === 'installed') out.push(item)
  }
  return out
}

async function refreshCatalog({ dryRun, fetchImpl, log }) {
  const next = { updatedAt: new Date().toISOString(), providers: {} }
  for (const provider of PROVIDERS) {
    try {
      const entries = await provider.fetchCatalog(fetchImpl)
      next.providers[provider.id] = { label: provider.label, entries }
      log(`  ${provider.label}: ${entries.length}개`)
    } catch (err) {
      log(`  ${provider.label}: 실패 — ${err.message}`)
    }
  }
  const total = allEntries(next).length
  if (total === 0) { log('가져온 항목이 없어 카탈로그를 갱신하지 않습니다.'); return { total: 0 } }
  if (!dryRun) saveCatalog(next)
  log(dryRun ? `  [dry-run] ${total}개로 갱신 예정` : `카탈로그 갱신됨: ${total}개`)
  return { total }
}

async function updateInstalled(root, items, { dryRun, log }) {
  const installed = await installedItems(root, items)
  if (installed.length === 0) { log('설치된 design.md가 없습니다.'); return }
  for (const item of installed) {
    try {
      await item.install({ root, dryRun, fresh: true })
      log(`  ✔ 업데이트 ${item.label}`)
    } catch (err) {
      log(`  ✖ 업데이트 ${item.label} — ${err.message}`)
    }
  }
}

async function findStale(root, items, { log }) {
  const installed = await installedItems(root, items)
  const stale = []
  for (const item of installed) {
    const local = item.localText({ root })
    if (local == null) continue
    let remote
    try { remote = await item.remoteText() } catch { remote = null }
    if (remote == null) { log(`  ? ${item.label}: 원본 확인 실패`); continue }
    if (sha256(local) !== sha256(remote)) stale.push(item)
  }
  return stale
}

// ── 진입점 ────────────────────────────────────────────────────────

export async function runDesign(root, opts = {}) {
  const {
    dryRun = false,
    list = false,
    set = null,
    sync = null,
    preview = null,
    interactive = false,
    fetchImpl = fetch,
    log = console.log,
  } = opts
  const opener = opts.opener ?? makeOpener(dryRun, log)

  const catalog = loadCatalog()
  const items = buildItems(catalog, { fetchImpl })
  const sourceLabel = Object.values(catalog.providers ?? {}).map((p) => p.label ?? '').filter(Boolean).join(', ') || '(없음)'

  if (list) {
    printList(await scan(root, items), log)
    return
  }
  if (preview != null) {
    openPreviews(items, preview.split(','), opener, log)
    return
  }
  if (sync != null) {
    await runSync(root, items, catalog, { op: sync, dryRun, fetchImpl, log, interactive: false })
    return
  }
  if (set != null) {
    const selected = new Set(set.split(',').map((s) => s.trim()).filter(Boolean).map((n) => `design.${n}`))
    const known = new Set(items.map((i) => i.id))
    for (const id of selected) if (!known.has(id)) throw new Error(`알 수 없는 항목: ${id.replace(/^design\./, '')}`)
    await applyVisible(root, await scan(root, items), selected, { dryRun, log })
    return
  }
  if (!interactive) { printList(await scan(root, items), log); return }

  await interactiveLoop(root, items, catalog, { dryRun, fetchImpl, log, opener, sourceLabel })
}

async function runSync(root, items, catalog, { op, dryRun, fetchImpl, log, interactive }) {
  let chosen = op
  if (!chosen && interactive) {
    chosen = await p.select({
      message: '동기화 작업',
      options: [
        { value: 'installed', label: '설치본 업데이트 (원본 최신으로 재다운로드)' },
        { value: 'catalog', label: '카탈로그 새로고침 (목록·카테고리 갱신)' },
        { value: 'stale', label: '오래된 항목 확인 (원본과 변경분)' },
      ],
    })
    if (p.isCancel(chosen)) return
  }
  if (chosen === 'catalog') { await refreshCatalog({ dryRun, fetchImpl, log }); return }
  if (chosen === 'installed') { await updateInstalled(root, items, { dryRun, log }); return }
  if (chosen === 'stale') {
    const stale = await findStale(root, items, { log })
    if (stale.length === 0) { log('모든 설치본이 최신입니다.'); return }
    log(`오래된 항목 ${stale.length}개: ${stale.map((i) => i.name).join(', ')}`)
    if (interactive && !dryRun) {
      const sel = await p.multiselect({
        message: '업데이트할 항목',
        options: stale.map((i) => ({ value: i.id, label: i.label, hint: i.designCategory })),
        required: false,
      })
      if (p.isCancel(sel)) return
      for (const item of stale.filter((i) => sel.includes(i.id))) {
        try { await item.install({ root, dryRun, fresh: true }); log(`  ✔ 업데이트 ${item.label}`) }
        catch (err) { log(`  ✖ ${item.label} — ${err.message}`) }
      }
    }
    return
  }
  log(`알 수 없는 동기화 작업: ${chosen}`)
}

// ── 대화형 ────────────────────────────────────────────────────────

async function interactiveLoop(root, items, catalog, ctx) {
  const installedCount = (await scan(root, items)).filter((s) => s.status !== 'absent').length
  p.intro(`design.md 라이브러리 — 소스 ${ctx.sourceLabel} · 설치 ${installedCount} / 카탈로그 ${items.length}`)

  for (;;) {
    const action = await p.select({
      message: '어떻게 찾을까요?',
      options: [
        { value: 'category', label: '🗂  카테고리(탭)로 둘러보기' },
        { value: 'search', label: '🔍 이름/키워드로 검색' },
        { value: 'preview', label: '🖼  미리보기로 둘러보기 (브라우저)' },
        { value: 'sync', label: '↻  동기화' },
        { value: 'exit', label: '← 끝내기' },
      ],
    })
    if (p.isCancel(action) || action === 'exit') break

    if (action === 'category') {
      const visible = await pickByCategory(items)
      if (visible) await selectAndApply(root, visible, ctx)
    } else if (action === 'search') {
      const visible = await pickBySearch(items)
      if (visible) await selectAndApply(root, visible, ctx)
    } else if (action === 'preview') {
      await previewBrowse(root, items, ctx)
    } else if (action === 'sync') {
      await runSync(root, items, catalog, { op: null, dryRun: ctx.dryRun, fetchImpl: ctx.fetchImpl, log: ctx.log, interactive: true })
    }
  }
  p.outro('완료')
}

async function pickByCategory(items) {
  const counts = new Map()
  for (const i of items) counts.set(i.designCategory, (counts.get(i.designCategory) ?? 0) + 1)
  const cats = [...counts.keys()].sort()
  const cat = await p.select({
    message: '카테고리(탭)',
    options: cats.map((c) => ({ value: c, label: `${c} (${counts.get(c)})` })),
  })
  if (p.isCancel(cat)) return null
  return items.filter((i) => i.designCategory === cat)
}

async function pickBySearch(items) {
  const q = await p.text({ message: '검색어 (이름·라벨·카테고리·설명)', placeholder: '예: dark, fintech, stripe' })
  if (p.isCancel(q)) return null
  const visible = items.filter((i) => matchSearch(i, q))
  if (visible.length === 0) { p.note('일치하는 항목이 없습니다.', '검색'); return null }
  return visible
}

async function narrow(items) {
  const via = await p.select({
    message: '후보를 어떻게 좁힐까요?',
    options: [
      { value: 'category', label: '카테고리' },
      { value: 'search', label: '검색' },
      { value: 'all', label: `전체 (${items.length})` },
    ],
  })
  if (p.isCancel(via)) return null
  if (via === 'category') return pickByCategory(items)
  if (via === 'search') return pickBySearch(items)
  return items
}

async function selectAndApply(root, visible, ctx) {
  const vstates = await scan(root, visible)
  const selection = await p.multiselect({
    message: '설치할 항목 (체크=설치, 해제=제거) · 이 목록 안에서만 적용',
    options: vstates.map((s) => ({ value: s.item.id, label: s.item.label, hint: designHint(s) })),
    initialValues: vstates.filter((s) => s.status !== 'absent').map((s) => s.item.id),
    required: false,
  })
  if (p.isCancel(selection)) return
  await applyVisible(root, vstates, new Set(selection), { dryRun: ctx.dryRun, log: ctx.log })
}

async function previewBrowse(root, items, ctx) {
  const visible = await narrow(items)
  if (!visible || visible.length === 0) return
  const sel = await p.multiselect({
    message: '미리볼 항목 (브라우저로 열림)',
    options: visible.map((i) => ({ value: i.id, label: i.label, hint: i.designCategory })),
    required: false,
  })
  if (p.isCancel(sel)) return
  const chosen = visible.filter((i) => sel.includes(i.id))
  for (const item of chosen) openPreview(ctx.opener, item, ctx.log)
  if (chosen.length === 0) return
  const go = await p.confirm({ message: '방금 본 항목을 설치 선택으로 진행할까요?', initialValue: true })
  if (p.isCancel(go) || !go) return
  await selectAndApply(root, chosen, ctx)
}
