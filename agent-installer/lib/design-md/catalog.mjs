import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { repoPath } from '../context.mjs'
import { PROVIDERS, getProvider } from './providers/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CATALOG_PATH = join(HERE, 'catalog.json')

export function loadCatalog(file = CATALOG_PATH) {
  if (!existsSync(file)) return { updatedAt: null, providers: {} }
  const text = readFileSync(file, 'utf8')
  if (!text.trim()) return { updatedAt: null, providers: {} }
  return JSON.parse(text)
}

export function saveCatalog(catalog, file = CATALOG_PATH) {
  writeFileSync(file, JSON.stringify(catalog, null, 2) + '\n')
}

export function allEntries(catalog) {
  return Object.values(catalog.providers ?? {}).flatMap((p) => p.entries ?? [])
}

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

// 설치·번들 경로는 제공자별로 스코프한다: design-md/<provider>/<name>/DESIGN.md.
// 동명 항목이 여러 제공자에 있어도 충돌 없이 공존한다.
function designPaths(root, providerId, name) {
  if (/[\\/]/.test(providerId) || /[\\/]/.test(name)) {
    throw new Error(`잘못된 design.md 식별자: ${providerId}/${name}`)
  }
  const dir = repoPath(root, `design-md/${providerId}/${name}`)
  return { dir, file: join(dir, 'DESIGN.md') }
}

// 카탈로그 엔트리 1개를 item 인터페이스(engine.mjs 호환)로 변환한다.
// provider와 fetchImpl을 클로저로 잡아 install/detect가 그것을 사용한다.
export function defineDesignMd(entry, provider, { fetchImpl }) {
  const { name, label, category, description } = entry
  const providerId = provider.id
  return {
    id: `design.${providerId}.${name}`,
    category: 'design',
    providerId,
    name,
    label,
    designCategory: category,
    description,
    webUrl: provider.webUrl(name),

    async detect({ root }) {
      return { status: existsSync(designPaths(root, providerId, name).file) ? 'installed' : 'absent' }
    },

    // fresh=false: 동봉 번들 우선(오프라인) → 없으면 네트워크.
    // fresh=true: 번들 우회, 항상 네트워크 최신(업데이트/동기화용).
    async install({ root, dryRun, fresh = false }) {
      if (dryRun) return // dry-run은 네트워크·쓰기 없이 예정 동작만 리포트
      let text = fresh ? null : provider.bundledText?.(name, 'DESIGN.md')
      if (text == null) text = await provider.fetchFile(fetchImpl, name, 'DESIGN.md')
      if (text == null) throw new Error(`${providerId}/${name}: DESIGN.md 다운로드 실패`)
      const { dir, file } = designPaths(root, providerId, name)
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, text)
    },

    async uninstall({ root, dryRun }) {
      const { dir } = designPaths(root, providerId, name)
      if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    },

    // 오래된 항목 감지용: 로컬과 원본 DESIGN.md 해시 비교.
    localText({ root }) {
      const { file } = designPaths(root, providerId, name)
      return existsSync(file) ? readFileSync(file, 'utf8') : null
    },
    async remoteText() {
      return provider.fetchFile(fetchImpl, name, 'DESIGN.md')
    },
  }
}

// 캐시 카탈로그 → item 배열. 알 수 없는 프로바이더 엔트리는 건너뛴다.
// id가 제공자별로 유일하므로 동명 항목이 붕괴하지 않는다. (provider, name)순 정렬.
export function buildItems(catalog, { fetchImpl, providers = PROVIDERS } = {}) {
  const byId = new Map(providers.map((p) => [p.id, p]))
  const items = []
  const seen = new Set()
  for (const [providerId, block] of Object.entries(catalog.providers ?? {})) {
    const provider = byId.get(providerId) ?? getProvider(providerId)
    if (!provider) continue
    for (const entry of block.entries ?? []) {
      const item = defineDesignMd(entry, provider, { fetchImpl })
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }
  return items.sort((a, b) => a.providerId.localeCompare(b.providerId) || a.name.localeCompare(b.name))
}

// `--set`/`--preview` 토큰(`name` 또는 `provider/name`)을 item으로 해석한다.
// 이름이 여러 제공자에 걸쳐 중복되면 제공자 지정을 요구한다.
export function resolveTokens(items, tokensStr) {
  const out = []
  for (const tok of tokensStr.split(',').map((s) => s.trim()).filter(Boolean)) {
    const slash = tok.indexOf('/')
    const matches = slash >= 0
      ? items.filter((i) => i.providerId === tok.slice(0, slash) && i.name === tok.slice(slash + 1))
      : items.filter((i) => i.name === tok)
    if (matches.length === 0) throw new Error(`알 수 없는 항목: ${tok}`)
    if (matches.length > 1) {
      throw new Error(`중복된 이름 '${tok}' — 제공자를 지정하세요: ${matches.map((m) => `${m.providerId}/${m.name}`).join(', ')}`)
    }
    out.push(matches[0])
  }
  return out
}
