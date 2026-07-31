import { scan, planChanges, apply } from '../engine.mjs'
import { loadCatalog, saveCatalog, buildItems, allEntries, sha256, resolveTokens, netFetch, CATALOG_PATH } from './catalog.mjs'
import { PROVIDERS } from './providers/index.mjs'
import { discoverSources, extraDirsFromEnv } from './scan.mjs'
import { makeOpener, openPreview } from './open.mjs'
import { createT, toText } from '../i18n/index.mjs'

// 카탈로그의 카테고리는 공급자가 준 영어 데이터라 번역하지 않는다.
// 우리가 만든 catch-all(__other·__local)만 번역 대상이다.
export function categoryLabel(t, id) {
  return id.startsWith('__') ? t(`category.${id.slice(2)}`) : id
}

function report(results, log, t) {
  for (const r of results) {
    const message = toText(t, r.message)
    log(`  ${r.ok ? '✔' : '✖'} ${t(`change.${r.action}`)} ${r.item.label}${message ? ` — ${message}` : ''}`)
  }
}

// ── 비대화형/공용 코어 ─────────────────────────────────────────────

function printList(states, log, t) {
  const byProvider = new Map()
  for (const s of states) {
    if (!byProvider.has(s.item.providerId)) byProvider.set(s.item.providerId, [])
    byProvider.get(s.item.providerId).push(s)
  }
  for (const [pid, group] of byProvider) {
    log(`[${pid}${group[0].item.local ? ` · ${t('design.localTag')}` : ''}]`)
    for (const s of group) {
      log(`  ${t(`status.${s.status}`).padEnd(4)} ${s.item.name} — ${s.item.label} [${categoryLabel(t, s.item.designCategory)}]`)
    }
  }
}

// 미리보기는 관대하게 해석한다: 알 수 없거나 중복된 토큰은 예외 없이 안내하고 건너뛴다.
function openPreviews(items, tokensStr, opener, log, t) {
  for (const tok of tokensStr.split(',').map((s) => s.trim()).filter(Boolean)) {
    const slash = tok.indexOf('/')
    const matches = slash >= 0
      ? items.filter((i) => i.providerId === tok.slice(0, slash) && i.name === tok.slice(slash + 1))
      : items.filter((i) => i.name === tok)
    if (matches.length === 0) { log(t('design.unknownItem', { token: tok })); continue }
    if (matches.length > 1) {
      log(t('design.ambiguous', { token: tok, options: matches.map((m) => `${m.providerId}/${m.name}`).join(', ') }))
      continue
    }
    openPreview(opener, matches[0], log, t)
  }
}

// 보이는 집합(visibleStates) 안에서만 diff/적용한다.
async function applyVisible(root, visibleStates, selectedIds, { dryRun, log, t }) {
  const changes = planChanges(visibleStates, selectedIds)
  if (changes.length === 0) { log(t('apply.noChanges')); return [] }
  const results = await apply(root, changes, { dryRun, log, t })
  report(results, log, t)
  return results
}

async function installedItems(root, items) {
  const out = []
  for (const item of items) {
    if ((await item.detect({ root })).status === 'installed') out.push(item)
  }
  return out
}

export async function refreshCatalog({ dryRun, fetchImpl, log, catalogFile = CATALOG_PATH, t = createT('en') }) {
  const next = { updatedAt: new Date().toISOString(), providers: {} }
  for (const provider of PROVIDERS) {
    try {
      const entries = await provider.fetchCatalog(fetchImpl)
      next.providers[provider.id] = { label: provider.label, entries }
      log(t('design.provider.count', { label: provider.label, count: entries.length }))
    } catch (err) {
      log(t('design.provider.failed', { label: provider.label, message: err.message }))
    }
  }
  const total = allEntries(next).length
  if (total === 0) { log(t('design.catalog.empty')); return { total: 0 } }
  if (!dryRun) saveCatalog(next, catalogFile)
  log(dryRun ? t('design.catalog.planned', { total }) : t('design.catalog.updated', { total }))
  return { total }
}

export async function updateInstalled(root, items, { dryRun, log, t = createT('en') }) {
  const installed = await installedItems(root, items)
  if (installed.length === 0) { log(t('design.none')); return }
  for (const item of installed) {
    try {
      await item.install({ root, dryRun, fresh: true })
      log(t('design.updated', { label: item.label }))
    } catch (err) {
      log(t('design.updateFailed', { label: item.label, message: err.message }))
    }
  }
}

export async function findStale(root, items, { log, t = createT('en') }) {
  const installed = await installedItems(root, items)
  const stale = []
  for (const item of installed) {
    const local = item.localText({ root })
    if (local == null) continue
    let remote
    try { remote = await item.remoteText() } catch { remote = null }
    if (remote == null) { log(t('design.sourceCheckFailed', { label: item.label })); continue }
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
    fetchImpl = netFetch,
    log = console.log,
    designDirs = [],
    env = process.env,
    catalogFile = CATALOG_PATH,
    t = createT('en'),
  } = opts
  const opener = opts.opener ?? makeOpener(dryRun, log)

  const catalog = loadCatalog(catalogFile)
  // 디렉터리 스캔이 먼저다 — 프로바이더 등록 없이도 사내 정의가 목록에 오른다.
  const sources = opts.sources ?? discoverSources({
    ...(opts.bundleDir ? { bundleDir: opts.bundleDir } : {}),
    extraDirs: [...extraDirsFromEnv(env), ...designDirs],
    log,
    t,
  })
  const items = buildItems(catalog, { fetchImpl, sources })

  if (list) {
    printList(await scan(root, items), log, t)
    return
  }
  if (preview != null) {
    openPreviews(items, preview, opener, log, t)
    return
  }
  if (sync != null) {
    await runSync(root, items, { op: sync, dryRun, fetchImpl, log, catalogFile, t })
    return
  }
  if (set != null) {
    const selected = new Set(resolveTokens(items, set).map((i) => i.id))
    await applyVisible(root, await scan(root, items), selected, { dryRun, log, t })
    return
  }
  printList(await scan(root, items), log, t)
}

async function runSync(root, items, { op: chosen, dryRun, fetchImpl, log, catalogFile, t }) {
  if (chosen === 'catalog') { await refreshCatalog({ dryRun, fetchImpl, log, catalogFile, t }); return }
  if (chosen === 'installed') { await updateInstalled(root, items, { dryRun, log, t }); return }
  if (chosen === 'stale') {
    const stale = await findStale(root, items, { log, t })
    if (stale.length === 0) { log(t('design.allCurrent')); return }
    log(t('design.staleList', { count: stale.length, names: stale.map((i) => i.name).join(', ') }))
    return
  }
  log(t('design.unknownSync', { action: chosen }))
}
