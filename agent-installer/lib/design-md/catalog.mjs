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

// 경로 세그먼트 하나로 안전한 이름인지 본다. 한글 등 유니코드는 허용하되
// 경로 구분자·상위 이동·Windows 금지 문자·제어문자는 막는다.
// (name은 원격 README 파싱이나 디렉터리 스캔에서 오므로 신뢰 경계 밖이다.)
export function isSafeSegment(text) {
  const value = String(text ?? '')
  // 선행·후행 점은 숨김 파일이자 Windows에서 다루기 어려운 이름이다('.', '..' 포함).
  if (!value || value.startsWith('.') || value.endsWith('.')) return false
  // eslint-disable-next-line no-control-regex
  return !/[\\/:*?"<>|\x00-\x1f]/.test(value)
}

// 라벨·카테고리·설명은 원격 README나 DESIGN.md 본문에서 온다. 목록과 TUI가
// 이 값을 터미널에 그대로 찍으므로 제어문자를 걷어낸다 — ANSI 이스케이프가
// 남아 있으면 화면을 지우거나 커서를 옮겨 목록을 위장할 수 있다.
export function stripControl(text) {
  // eslint-disable-next-line no-control-regex
  return String(text ?? '').replace(/[\x00-\x1f\x7f]+/g, ' ').trim()
}

// 설치·번들 경로는 제공자별로 스코프한다: design-md/<provider>/<name>/DESIGN.md.
// 동명 항목이 여러 제공자에 있어도 충돌 없이 공존한다.
function designPaths(root, providerId, name) {
  if (!isSafeSegment(providerId) || !isSafeSegment(name)) {
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
    local: provider.local === true, // 디렉터리 스캔으로 찾은 로컬(사내) 정의
    name,
    // 화면에 나가는 세 값만 정화한다. name은 isSafeSegment가 이미 걸렀고
    // 경로·URL에 쓰이므로 여기서 바꾸면 안 된다.
    label: stripControl(label) || name,
    designCategory: stripControl(category),
    description: stripControl(description),
    webUrl: provider.webUrl(name),
    // 로컬(디렉터리) 항목은 웹 페이지가 없다 — 미리보기는 원본 파일을 연다.
    previewPath: provider.local === true ? provider.fileUrl(name) : null,

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

// 큐레이션된 카탈로그 값이 우선, 비어 있으면 스캔에서 얻은 값으로 채운다.
function mergeEntry(scanned, curated) {
  if (!scanned) return curated
  const pick = (a, b) => (a != null && String(a).trim() !== '' ? a : b)
  return {
    ...scanned,
    ...curated,
    label: pick(curated.label, scanned.label),
    category: pick(curated.category, scanned.category),
    description: pick(curated.description, scanned.description),
  }
}

// 카탈로그 + 디렉터리 스캔 소스 → item 배열.
// 디렉터리로 발견한 소스는 프로바이더 등록 없이도 목록에 오르고(사내 오프라인 정의),
// 등록된 프로바이더가 있으면 그쪽(네트워크·웹 미리보기 지원)을 쓴다.
// 카탈로그에만 있고 프로바이더도 스캔 결과도 없는 엔트리는 다룰 방법이 없어 건너뛴다.
// id가 소스별로 유일하므로 동명 항목이 붕괴하지 않는다. (provider, name)순 정렬.
export function buildItems(catalog, { fetchImpl, providers = PROVIDERS, sources = [] } = {}) {
  const registered = new Map(providers.map((p) => [p.id, p]))
  const blocks = new Map() // sourceId → { provider, entries: Map<name, entry> }

  const blockFor = (id, provider) => {
    let block = blocks.get(id)
    if (!block) {
      block = { provider, entries: new Map() }
      blocks.set(id, block)
    }
    return block
  }

  // 1) 디렉터리 스캔 — 등록 여부와 무관하게 목록에 올린다.
  for (const source of sources) {
    const provider = registered.get(source.id) ?? getProvider(source.id) ?? source.provider
    if (!provider) continue
    const block = blockFor(source.id, provider)
    for (const entry of source.entries ?? []) block.entries.set(entry.name, entry)
  }

  // 2) 카탈로그 — 라벨·카테고리·설명을 보강하고, 아직 없는 항목을 추가한다.
  for (const [providerId, catalogBlock] of Object.entries(catalog.providers ?? {})) {
    const provider = registered.get(providerId) ?? getProvider(providerId) ?? blocks.get(providerId)?.provider
    if (!provider) continue
    const block = blockFor(providerId, provider)
    for (const entry of catalogBlock.entries ?? []) {
      block.entries.set(entry.name, mergeEntry(block.entries.get(entry.name), entry))
    }
  }

  const items = []
  for (const block of blocks.values()) {
    for (const entry of block.entries.values()) {
      // 이름은 원격 README 파싱이나 디렉터리 스캔에서 오므로 신뢰 경계 밖이다.
      // 설치 경로도 미리보기 URL도 이 이름을 쓰는데, 경로 검사는 designPaths가
      // install 시점에만 한다. item이 만들어지는 이 한 곳에서 걸러 두면
      // 목록·미리보기를 포함한 모든 소비자가 함께 안전해진다.
      if (!isSafeSegment(entry.name)) continue
      items.push(defineDesignMd(entry, block.provider, { fetchImpl }))
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
