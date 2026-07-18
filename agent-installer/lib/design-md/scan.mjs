// design.md 디렉터리 스캔 — 프로바이더 등록 없이 **디렉터리 구조만으로** 항목을 찾는다.
// 번들 캐시(lib/design-md/cache/<소스>/…)에 폴더를 넣거나, 외부 경로를
// AGENT_INSTALLER_DESIGN_MD_DIRS 환경변수/`--design-dir`로 지정하면 그대로 목록에 오른다.
// 사내에서 오프라인으로 정의한 DESIGN.md를 코드 수정 없이 포함하기 위한 경로다.
import { existsSync, statSync, readdirSync, readFileSync, openSync, readSync, closeSync } from 'node:fs'
import { join, dirname, basename, resolve, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StringDecoder } from 'node:string_decoder'
import { isSafeSegment } from './catalog.mjs'
import { PROVIDERS } from './providers/index.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const BUNDLE_DIR = join(HERE, 'cache')

const DESIGN_FILE = 'DESIGN.md'
const DESIGN_FILE_RE = /^design\.md$/i
const MAX_DEPTH = 5 // <소스>/<카테고리…>/<이름>/DESIGN.md — 과도한 순회 방지
const META_BYTES = 4096 // 메타데이터는 앞부분만 읽는다(전체 로드 회피)
// getdesign.md 형식은 디자인 토큰 전체가 frontmatter라 수 KB에 이른다.
// 닫는 구분자가 첫 창을 넘어가면 이만큼까지 늘려 다시 읽는다.
const META_BYTES_MAX = 65536
const MAX_DESCRIPTION = 200
const SKIP_DIRS = new Set(['node_modules', '.git', '.svn'])

const FM_OPEN = /^---[ \t]*\r?\n/
const FM_CLOSE = /\r?\n---[ \t]*(\r?\n|$)/

export const BUNDLE_CATEGORY = '기타' // 번들 캐시에서 카테고리를 못 얻었을 때
export const LOCAL_CATEGORY = '사내' // 외부(사내) 경로에서 카테고리를 못 얻었을 때

// 설치 경로 `design-md/<소스>/<이름>/`에 쓰이므로 경로에 위험한 문자만 걷어낸다.
// 한글 등 유니코드 이름은 그대로 살린다 — 사내 디렉터리명이 대개 그렇다.
export function sanitizeId(text) {
  const cleaned = String(text)
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-') // 경로 구분자·Windows 금지 문자·제어문자
    .replace(/\s+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') // 선행·후행 점은 Windows에서 문제가 된다
    .replace(/-{2,}/g, '-')
  return cleaned && cleaned !== '.' && cleaned !== '..' ? cleaned : 'local'
}

// `--design-dir` / 환경변수 항목: `<경로>` 또는 `<소스id>=<경로>`.
// id에는 경로 구분자가 올 수 없으므로 `D:\a=b` 같은 경로를 id로 오인하지 않는다.
export function parseDirSpec(spec) {
  const text = String(spec).trim()
  const m = /^([^=\\/]+)=(.+)$/.exec(text)
  const dir = resolve(m ? m[2].trim() : text)
  return { id: m ? m[1].trim() : basename(dir), dir }
}

// 환경변수의 경로 목록. 구분자는 OS 기본(Windows `;`, POSIX `:`).
export function extraDirsFromEnv(env = process.env) {
  const raw = env.AGENT_INSTALLER_DESIGN_MD_DIRS
  if (!raw) return []
  return raw.split(delimiter).map((s) => s.trim()).filter(Boolean)
}

// 앞부분만 읽는다. 경계에서 멀티바이트 문자가 잘려도 대체 문자가 남지 않도록
// StringDecoder로 불완전 시퀀스를 버린다.
function readHead(file, bytes = META_BYTES) {
  const fd = openSync(file, 'r')
  try {
    const buf = Buffer.alloc(bytes)
    const n = readSync(fd, buf, 0, bytes, 0)
    return new StringDecoder('utf8').write(buf.subarray(0, n))
  } finally {
    closeSync(fd)
  }
}

// frontmatter가 첫 창 안에서 닫히지 않으면 한 번 더 크게 읽는다.
function readMetaText(file) {
  const head = readHead(file)
  if (!FM_OPEN.test(head) || FM_CLOSE.test(head)) return head
  return readHead(file, META_BYTES_MAX)
}

// DESIGN.md 본문에서 라벨·설명·카테고리를 뽑는다.
// frontmatter(있으면)가 우선, 없으면 첫 제목 → 라벨, 첫 문단 → 설명.
export function parseDesignMeta(text) {
  const meta = {}
  let body = String(text ?? '')

  const open = FM_OPEN.exec(body)
  if (open) {
    const rest = body.slice(open[0].length)
    const close = FM_CLOSE.exec(rest)
    // 닫는 구분자를 못 찾으면(읽기 창보다 긴 frontmatter) 본문 후보를 비워
    // `version: alpha` 같은 frontmatter 줄이 설명으로 새어 나가지 않게 한다.
    const block = close ? rest.slice(0, close.index) : rest
    body = close ? rest.slice(close.index + close[0].length) : ''

    const fm = {}
    for (const line of block.split(/\r?\n/)) {
      // 최상위 키만 본다 — 들여쓴 줄은 디자인 토큰 같은 중첩 값이다.
      const kv = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)$/.exec(line)
      if (!kv) continue
      const key = kv[1].toLowerCase()
      const value = kv[2].trim().replace(/^["']|["']$/g, '').trim()
      if (value) fm[key] ??= value
    }
    meta.label ??= fm.title || fm.label || fm.name || undefined
    meta.category ??= fm.category
    meta.description ??= (fm.description || fm.summary)?.slice(0, MAX_DESCRIPTION)
    for (const key of Object.keys(meta)) if (meta[key] === undefined) delete meta[key]
  }

  let sawHeading = false
  let fence = null // 코드블록 안에서는 어떤 줄도 설명으로 쓰지 않는다
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const fenceMark = /^(```+|~~~+)/.exec(line)
    if (fenceMark) {
      if (fence && line.startsWith(fence)) fence = null
      else if (!fence) fence = fenceMark[1]
      continue
    }
    if (fence) continue
    const heading = /^#{1,3}\s+(.+)$/.exec(line)
    if (heading) {
      if (!sawHeading) {
        meta.label ??= heading[1].trim()
        sawHeading = true
      }
      continue
    }
    // 주석·표·구분선·목록·인용은 설명으로 쓰지 않는다.
    if (/^(<!--|<|\||-{3,}|={3,}|[-*+]\s|\d+\.\s|>)/.test(line)) continue
    meta.description ??= line.slice(0, MAX_DESCRIPTION)
    if (meta.label && meta.description) break
  }
  return meta
}

// 디렉터리 1회 읽기로 하위 폴더와 design 파일을 함께 얻는다.
// 읽을 수 없는 디렉터리(권한·경합)는 목록을 통째로 실패시키지 않고 건너뛴다.
// 심볼릭 링크는 따라가지 않는다(순환 방지) — isDirectory()가 링크에는 false다.
// 파일명은 대소문자를 가리지 않는다: 사내 문서는 `design.md`로 쓰는 경우가 많고,
// 대소문자를 구분하는 파일시스템(Linux·macOS)에서 통째로 누락되면 안 된다.
function readDir(dir) {
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return { dirs: [], designFile: null }
    const dirents = readdirSync(dir, { withFileTypes: true })
    const designs = dirents
      .filter((d) => d.isFile() && DESIGN_FILE_RE.test(d.name))
      .map((d) => d.name)
      .sort() // 여러 표기가 공존하면 결정적으로 고른다
    return {
      dirs: dirents
        .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !SKIP_DIRS.has(d.name))
        .map((d) => d.name)
        .sort(),
      designFile: designs.includes(DESIGN_FILE) ? DESIGN_FILE : (designs[0] ?? null),
    }
  } catch {
    return { dirs: [], designFile: null }
  }
}

function subdirs(dir) {
  return readDir(dir).dirs
}

// 디렉터리 트리에서 DESIGN.md를 찾아 엔트리로 만든다.
// `<루트>/<카테고리…>/<이름>/DESIGN.md` — DESIGN.md가 있는 폴더가 곧 항목(리프)이다.
// 루트 바로 아래 DESIGN.md가 있으면 루트 폴더명이 항목 이름이 된다.
export function scanDesignDir(dir, { defaultCategory = LOCAL_CATEGORY, maxDepth = MAX_DEPTH, log } = {}) {
  const root = resolve(dir)
  const entries = []
  const seen = new Set()

  // 설치 경로가 `design-md/<소스>/<이름>/`이라 소스 안에서 이름이 유일해야 한다.
  // 카테고리가 다른 동명 항목(웹/버튼, 모바일/버튼)은 카테고리를 접두사로 붙여 살린다.
  const uniqueName = (name, segs) => {
    if (!seen.has(name)) return name
    const prefixed = sanitizeId([...segs.slice(0, -1), name].join('-'))
    let candidate = prefixed
    for (let n = 2; seen.has(candidate); n++) candidate = `${prefixed}-${n}`
    if (log) log(`  design.md 이름이 겹쳐 '${candidate}'로 구분합니다: ${segs.join('/')}`)
    return candidate
  }

  const visit = (current, segs, depth) => {
    const { dirs, designFile } = readDir(current)
    if (designFile) {
      const file = join(current, designFile)
      const found = segs.length > 0 ? segs[segs.length - 1] : basename(root)
      if (found && isSafeSegment(found)) {
        const name = uniqueName(found, segs)
        seen.add(name)
        let meta = {}
        try {
          meta = parseDesignMeta(readMetaText(file))
        } catch {
          // 읽기 실패는 메타데이터 없이 진행 — 목록에서 빠지지 않게 한다.
        }
        entries.push({
          name,
          label: meta.label || found,
          category: meta.category || segs.slice(0, -1).join(' / ') || defaultCategory,
          description: meta.description || '',
          file,
        })
      }
      return // 항목 폴더 안쪽은 더 내려가지 않는다
    }
    if (depth >= maxDepth) return
    for (const sub of dirs) visit(join(current, sub), [...segs, sub], depth + 1)
  }

  visit(root, [], 0)
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

// 스캔한 디렉터리를 프로바이더 인터페이스로 감싼다.
// 네트워크 원본이 없으므로 로컬 파일이 곧 최신본이고, 웹 미리보기 URL은 없다.
export function makeDirProvider({ id, label, dir, entries }) {
  const files = new Map(entries.map((e) => [e.name, e.file]))
  return {
    id,
    label,
    dir,
    local: true,
    files: [DESIGN_FILE],

    fileUrl(name) {
      return files.get(name) ?? null
    },

    webUrl() {
      return null // 로컬 정의는 getdesign.md 페이지가 없다
    },

    bundledText(name) {
      const file = files.get(name)
      if (!file || !existsSync(file)) return null
      return readFileSync(file, 'utf8')
    },

    // fresh 업데이트도 같은 로컬 파일을 읽는다 — 디렉터리가 곧 원본이다.
    async fetchFile(fetchImpl, name) {
      return this.bundledText(name)
    },

    async fetchCatalog() {
      return entries.map(({ file, ...rest }) => rest)
    },
  }
}

// 번들 캐시 하위 디렉터리 + 지정한 외부 경로를 소스 목록으로 만든다.
// 반환: [{ id, dir, label, bundled, entries, provider }]
export function discoverSources({ bundleDir = BUNDLE_DIR, extraDirs = [], reservedIds, log } = {}) {
  const sources = []
  const usedIds = new Set()
  // 등록된 프로바이더 id는 번들 캐시 전용이다. 외부 경로가 그 id를 차지하면
  // 로컬 파일 대신 네트워크로 나가버리므로 접미사로 비켜 간다.
  const reserved = new Set(reservedIds ?? PROVIDERS.map((p) => p.id))

  const add = ({ id, dir, bundled, defaultCategory }) => {
    const entries = scanDesignDir(dir, { defaultCategory, log })
    if (entries.length === 0) {
      if (!bundled && log) log(`  design.md 소스에 DESIGN.md가 없습니다: ${dir}`)
      return
    }
    const base = sanitizeId(id)
    const taken = (candidate) => usedIds.has(candidate) || (!bundled && reserved.has(candidate))
    let uid = base
    for (let n = 2; taken(uid); n++) uid = `${base}-${n}`
    if (uid !== base && log) log(`  design.md 소스 id가 겹쳐 '${uid}'로 사용합니다: ${dir}`)
    usedIds.add(uid)
    const label = bundled ? uid : `${uid} (로컬)`
    sources.push({ id: uid, dir, label, bundled, entries, provider: makeDirProvider({ id: uid, label, dir, entries }) })
  }

  for (const name of subdirs(bundleDir)) {
    // 캐시에 직접 넣은 사내 소스는 등록 프로바이더가 없다 — 기본 카테고리를 달리 준다.
    const defaultCategory = reserved.has(sanitizeId(name)) ? BUNDLE_CATEGORY : LOCAL_CATEGORY
    add({ id: name, dir: join(bundleDir, name), bundled: true, defaultCategory })
  }
  for (const spec of extraDirs) {
    const { id, dir } = parseDirSpec(spec)
    if (!existsSync(dir)) {
      if (log) log(`  design.md 경로를 찾을 수 없습니다: ${dir}`)
      continue
    }
    add({ id, dir, bundled: false, defaultCategory: LOCAL_CATEGORY })
  }
  return sources
}
