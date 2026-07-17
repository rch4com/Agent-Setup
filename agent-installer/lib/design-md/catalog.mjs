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

function designPaths(root, name) {
  if (/[\\/]/.test(name)) throw new Error(`잘못된 design.md 이름: ${name}`)
  const dir = repoPath(root, `design-md/${name}`)
  return { dir, file: join(dir, 'DESIGN.md') }
}

// 카탈로그 엔트리 1개를 item 인터페이스(engine.mjs 호환)로 변환한다.
// provider와 fetchImpl을 클로저로 잡아 install/detect가 그것을 사용한다.
export function defineDesignMd(entry, provider, { fetchImpl }) {
  const { name, label, category, description } = entry
  return {
    id: `design.${name}`,
    category: 'design',
    providerId: provider.id,
    name,
    label,
    designCategory: category,
    description,
    webUrl: provider.webUrl(name),

    async detect({ root }) {
      return { status: existsSync(designPaths(root, name).file) ? 'installed' : 'absent' }
    },

    async install({ root, dryRun }) {
      if (dryRun) return // dry-run은 네트워크·쓰기 없이 예정 동작만 리포트
      const text = await provider.fetchFile(fetchImpl, name, 'DESIGN.md')
      if (text == null) throw new Error(`${name}: DESIGN.md 다운로드 실패`)
      const { dir, file } = designPaths(root, name)
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, text)
    },

    async uninstall({ root, dryRun }) {
      const { dir } = designPaths(root, name)
      if (!dryRun && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
    },

    // 오래된 항목 감지용: 로컬과 원본 DESIGN.md 해시 비교.
    localText({ root }) {
      const { file } = designPaths(root, name)
      return existsSync(file) ? readFileSync(file, 'utf8') : null
    },
    async remoteText() {
      return provider.fetchFile(fetchImpl, name, 'DESIGN.md')
    },
  }
}

// 캐시 카탈로그 → item 배열. 알 수 없는 프로바이더 엔트리는 건너뛴다.
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
  return items.sort((a, b) => a.name.localeCompare(b.name))
}
