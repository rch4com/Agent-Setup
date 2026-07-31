import { scan, planChanges, apply } from '../engine.mjs'
import { loadCatalog, saveCatalog, buildItems, allEntries, sha256, resolveTokens, netFetch, CATALOG_PATH } from './catalog.mjs'
import { PROVIDERS } from './providers/index.mjs'
import { discoverSources, extraDirsFromEnv } from './scan.mjs'
import { makeOpener, openPreview } from './open.mjs'
import { createT, toText } from '../i18n/index.mjs'

const STATUS_LABEL = { installed: '설치됨', partial: '일부', absent: '미설치' }

// apply()의 message는 이제 구조체 또는 문자열이다(예: context.mjs의 경로 이탈
// LocalizedError). 이 파일 전체가 아직 한국어 리터럴이라 여기서도 한국어로
// 고정한다 — Task 8이 design-md를 지역화하면서 이 고정을 걷어낸다.
const T_KO = createT('ko')

function report(results, log) {
  const ACTION = { install: '설치', complete: '보완', uninstall: '제거' }
  for (const r of results) {
    const message = toText(T_KO, r.message)
    log(`  ${r.ok ? '✔' : '✖'} ${ACTION[r.action]} ${r.item.label}${message ? ` — ${message}` : ''}`)
  }
}

// ── 비대화형/공용 코어 ─────────────────────────────────────────────

function printList(states, log) {
  const byProvider = new Map()
  for (const s of states) {
    if (!byProvider.has(s.item.providerId)) byProvider.set(s.item.providerId, [])
    byProvider.get(s.item.providerId).push(s)
  }
  for (const [pid, group] of byProvider) {
    log(`[${pid}${group[0].item.local ? ' · 로컬' : ''}]`)
    for (const s of group) {
      log(`  ${STATUS_LABEL[s.status].padEnd(4)} ${s.item.name} — ${s.item.label} [${s.item.designCategory}]`)
    }
  }
}

// 미리보기는 관대하게 해석한다: 알 수 없거나 중복된 토큰은 예외 없이 안내하고 건너뛴다.
function openPreviews(items, tokensStr, opener, log) {
  for (const tok of tokensStr.split(',').map((s) => s.trim()).filter(Boolean)) {
    const slash = tok.indexOf('/')
    const matches = slash >= 0
      ? items.filter((i) => i.providerId === tok.slice(0, slash) && i.name === tok.slice(slash + 1))
      : items.filter((i) => i.name === tok)
    if (matches.length === 0) { log(`  알 수 없는 항목: ${tok}`); continue }
    if (matches.length > 1) {
      log(`  중복된 이름 '${tok}' — 제공자를 지정하세요: ${matches.map((m) => `${m.providerId}/${m.name}`).join(', ')}`)
      continue
    }
    openPreview(opener, matches[0], log)
  }
}

// 보이는 집합(visibleStates) 안에서만 diff/적용한다.
async function applyVisible(root, visibleStates, selectedIds, { dryRun, log }) {
  const changes = planChanges(visibleStates, selectedIds)
  if (changes.length === 0) { log('변경할 항목이 없습니다.'); return [] }
  const results = await apply(root, changes, { dryRun, log, t: T_KO })
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

export async function refreshCatalog({ dryRun, fetchImpl, log, catalogFile = CATALOG_PATH }) {
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
  if (!dryRun) saveCatalog(next, catalogFile)
  log(dryRun ? `  [dry-run] ${total}개로 갱신 예정` : `카탈로그 갱신됨: ${total}개`)
  return { total }
}

export async function updateInstalled(root, items, { dryRun, log }) {
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

export async function findStale(root, items, { log }) {
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
    fetchImpl = netFetch,
    log = console.log,
    designDirs = [],
    env = process.env,
    catalogFile = CATALOG_PATH,
  } = opts
  const opener = opts.opener ?? makeOpener(dryRun, log)

  const catalog = loadCatalog(catalogFile)
  // 디렉터리 스캔이 먼저다 — 프로바이더 등록 없이도 사내 정의가 목록에 오른다.
  const sources = opts.sources ?? discoverSources({
    ...(opts.bundleDir ? { bundleDir: opts.bundleDir } : {}),
    extraDirs: [...extraDirsFromEnv(env), ...designDirs],
    log,
  })
  const items = buildItems(catalog, { fetchImpl, sources })

  if (list) {
    printList(await scan(root, items), log)
    return
  }
  if (preview != null) {
    openPreviews(items, preview, opener, log)
    return
  }
  if (sync != null) {
    await runSync(root, items, { op: sync, dryRun, fetchImpl, log, catalogFile })
    return
  }
  if (set != null) {
    const selected = new Set(resolveTokens(items, set).map((i) => i.id))
    await applyVisible(root, await scan(root, items), selected, { dryRun, log })
    return
  }
  printList(await scan(root, items), log)
}

async function runSync(root, items, { op: chosen, dryRun, fetchImpl, log, catalogFile }) {
  if (chosen === 'catalog') { await refreshCatalog({ dryRun, fetchImpl, log, catalogFile }); return }
  if (chosen === 'installed') { await updateInstalled(root, items, { dryRun, log }); return }
  if (chosen === 'stale') {
    const stale = await findStale(root, items, { log })
    if (stale.length === 0) { log('모든 설치본이 최신입니다.'); return }
    log(`오래된 항목 ${stale.length}개: ${stale.map((i) => i.name).join(', ')}`)
    return
  }
  log(`알 수 없는 동기화 작업: ${chosen}`)
}
