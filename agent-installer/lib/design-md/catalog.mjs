import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { repoPath, repoPathStrict } from '../context.mjs'
import { PROVIDERS, getProvider } from './providers/index.mjs'
import { createT, LocalizedError } from '../i18n/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const CATALOG_PATH = join(HERE, 'catalog.json')

export function loadCatalog(file = CATALOG_PATH) {
  if (!existsSync(file)) return { updatedAt: null, providers: {} }
  const text = readFileSync(file, 'utf8')
  if (!text.trim()) return { updatedAt: null, providers: {} }
  try {
    return JSON.parse(text)
  } catch (err) {
    // 원시 SyntaxError는 어느 파일이 문제인지도, 어떻게 고치는지도 알려 주지
    // 않는다. deps.mjs가 모듈 부재를 안내로 바꾸는 것과 같은 이유다.
    throw new LocalizedError('error.catalogUnreadable', { path: file, message: err.message })
  }
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

// 응답 시간 제한. 맨 fetch에는 제한이 없어, 응답하지 않는 서버를 만나면
// 동기화가 취소할 방법 없이 멈춘다 — 특히 TUI에서는 화면이 정지한 것처럼 보인다.
export const FETCH_TIMEOUT_MS = 20000

// 응답 본문 상한. DESIGN.md는 수십 KB, 가장 큰 응답인 tree API도 수 MB
// 수준이다. 상한이 없으면 응답하는 서버가 무한 스트림을 흘려보낼 때
// text()가 메모리를 다 쓸 때까지 읽는다 — 시간 제한은 이 경우를 막지 못한다
// (데이터가 계속 오는 동안은 타임아웃이 걸리지 않는다).
export const FETCH_MAX_BYTES = 8 * 1024 * 1024

async function readCapped(res, limit) {
  // body가 없는 구현(테스트의 가짜 fetch 등)은 그대로 읽는다.
  if (!res.body?.getReader) return res.text()
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel()
      throw new LocalizedError('error.responseTooLarge', { limit, url: res.url })
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

// 기본 fetch에 위 두 제한을 건다. 주입된 fetchImpl(테스트·대체 구현)은
// 건드리지 않는다.
export async function netFetch(url, opts = {}) {
  // maxBytes는 우리 옵션이므로 fetch에 넘기지 않는다(기본값은 FETCH_MAX_BYTES).
  const { maxBytes = FETCH_MAX_BYTES, ...init } = opts
  const res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  // 소비자는 ok·status·text()·json()만 쓴다. text()는 한 번만 읽을 수 있는
  // 스트림을 감싸므로 결과를 기억해 두 번 호출에도 견디게 한다.
  let body = null
  const text = () => (body ??= readCapped(res, maxBytes))
  return {
    ok: res.ok,
    status: res.status,
    url: res.url,
    headers: res.headers,
    text,
    json: async () => JSON.parse(await text()),
  }
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
// C0/C1 제어문자에 더해 눈에 보이지 않으면서 표시 순서를 바꾸는 유니코드
// 서식문자도 함께 지운다: bidi 오버라이드·isolate(U+202A~202E, U+2066~2069)는
// 라벨을 거꾸로 그려 다른 항목처럼 보이게 만들고, 폭 없는 문자(U+200B~200F,
// U+FEFF, U+00AD)는 이름이 같아 보이는 서로 다른 항목을 만든다.
export function stripControl(text) {
  return String(text ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f-\x9f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]+/g, ' ')
    .trim()
}

// 설치·번들 경로는 제공자별로 스코프한다: design-md/<provider>/<name>/DESIGN.md.
// 동명 항목이 여러 제공자에 있어도 충돌 없이 공존한다.
// 읽기는 어휘적 경로면 충분하다. 실제로 만들거나 지우는 경로만 링크를 통한
// 저장소 이탈까지 검사한다 — bootstrap의 apply.mjs와 같은 규칙이다.
// design-md가 저장소 밖을 가리키는 링크일 때 uninstall의 재귀 삭제가
// 그 너머까지 닿는 것을 막는다.
function designPaths(root, providerId, name, { strict = false } = {}) {
  if (!isSafeSegment(providerId) || !isSafeSegment(name)) {
    throw new LocalizedError('error.badDesignId', { provider: providerId, name })
  }
  const rel = `design-md/${providerId}/${name}`
  const dir = strict ? repoPathStrict(root, rel) : repoPath(root, rel)
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
    async install({ root, dryRun, fresh = false, log = () => {}, t = createT('en') }) {
      // dry-run은 네트워크도 쓰기도 하지 않고 예정 동작만 알린다.
      if (dryRun) {
        log(t('design.write', { provider: providerId, name }))
        return
      }
      let text = fresh ? null : provider.bundledText?.(name, 'DESIGN.md')
      if (text == null) text = await provider.fetchFile(fetchImpl, name, 'DESIGN.md')
      if (text == null) throw new LocalizedError('error.designDownload', { provider: providerId, name })
      const { dir, file } = designPaths(root, providerId, name, { strict: true })
      mkdirSync(dir, { recursive: true })
      writeFileSync(file, text)
    },

    async uninstall({ root, dryRun, log = () => {}, t = createT('en') }) {
      if (dryRun) {
        log(t('design.remove', { provider: providerId, name }))
        return
      }
      const { dir } = designPaths(root, providerId, name, { strict: true })
      if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
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
    if (matches.length === 0) throw new LocalizedError('error.unknownItem', { id: tok })
    if (matches.length > 1) {
      throw new LocalizedError('error.ambiguousDesignId', { token: tok, options: matches.map((m) => `${m.providerId}/${m.name}`).join(', ') })
    }
    out.push(matches[0])
  }
  return out
}
