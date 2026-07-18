import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeTempRepo, makeCapture, makeFetch } from './helpers.mjs'
import {
  parseDesignMeta, parseDirSpec, sanitizeId, scanDesignDir, discoverSources, extraDirsFromEnv,
} from '../lib/design-md/scan.mjs'
import { buildItems } from '../lib/design-md/catalog.mjs'
import { runDesign } from '../lib/design-md/flow.mjs'

function tempDir() {
  return mkdtempSync(join(tmpdir(), 'design-md-scan-'))
}

// <dir>/<segs…>/DESIGN.md 를 만든다.
function putDesign(dir, segs, body) {
  const target = join(dir, ...segs)
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, 'DESIGN.md'), body)
  return join(target, 'DESIGN.md')
}

const noNetwork = async () => {
  throw new Error('테스트에서 네트워크를 호출하면 안 됩니다.')
}

// ── 메타데이터 파싱 ────────────────────────────────────────────────

test('parseDesignMeta: 첫 제목 → 라벨, 첫 문단 → 설명', () => {
  const meta = parseDesignMeta('# 결제 콘솔\n\n사내 결제 화면의 공통 디자인 규칙.\n\n## 색상\n')
  assert.equal(meta.label, '결제 콘솔')
  assert.equal(meta.description, '사내 결제 화면의 공통 디자인 규칙.')
})

test('parseDesignMeta: frontmatter가 본문보다 우선', () => {
  const meta = parseDesignMeta(
    '---\ntitle: Checkout\ncategory: 핀테크\ndescription: 결제 플로우\n---\n# 무시되는 제목\n\n무시되는 문단\n',
  )
  assert.deepEqual(meta, { label: 'Checkout', category: '핀테크', description: '결제 플로우' })
})

test('parseDesignMeta: 코드펜스·표·목록은 설명으로 쓰지 않는다', () => {
  const meta = parseDesignMeta('# T\n\n```css\nbody { color: red }\n```\n\n| a | b |\n\n- 목록\n\n진짜 설명.\n')
  assert.equal(meta.description, '진짜 설명.')
})

test('parseDesignMeta: 제목도 문단도 없으면 비어 있다', () => {
  assert.deepEqual(parseDesignMeta(''), {})
})

test('parseDesignMeta: 중첩된 키는 최상위 메타데이터로 오해하지 않는다', () => {
  const meta = parseDesignMeta('---\nname: 실제\ncolors:\n  name: 가짜\n---\n')
  assert.equal(meta.label, '실제')
})

test('parseDesignMeta: 닫히지 않은 frontmatter는 설명으로 새지 않는다', () => {
  // 읽기 창을 넘어 잘린 frontmatter — `version: alpha`가 설명이 되면 안 된다.
  const meta = parseDesignMeta('---\nversion: alpha\nname: X\ncolors:\n  primary: "#fff"\n')
  assert.equal(meta.label, 'X')
  assert.equal(meta.description, undefined)
})

// 회귀 가드: 실제 번들 파일은 frontmatter가 수 KB라 읽기 창을 넘어간다.
test('실제 번들 DESIGN.md의 큰 frontmatter도 제대로 읽는다', () => {
  const bundle = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'design-md', 'cache', 'awesome-design-md')
  const entries = scanDesignDir(bundle)
  const leaked = entries.filter((e) => /^(version|name|description)\s*:/.test(e.description))
  assert.deepEqual(leaked.map((e) => e.name), [])

  const airbnb = entries.find((e) => e.name === 'airbnb')
  assert.notEqual(airbnb.label, 'airbnb') // 폴더명 폴백이 아니라 frontmatter에서 왔다
  assert.match(airbnb.description, /marketplace/)
})

// ── 디렉터리 스캔 ──────────────────────────────────────────────────

test('scanDesignDir: <이름>/DESIGN.md 를 항목으로 만든다', () => {
  const dir = tempDir()
  putDesign(dir, ['checkout'], '# 결제\n\n결제 화면.\n')
  const entries = scanDesignDir(dir)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].name, 'checkout')
  assert.equal(entries[0].label, '결제')
  assert.equal(entries[0].description, '결제 화면.')
  assert.equal(entries[0].category, '사내') // 중간 경로가 없으면 기본값
})

test('scanDesignDir: 중간 디렉터리가 카테고리가 된다', () => {
  const dir = tempDir()
  putDesign(dir, ['핀테크', 'checkout'], '# C\n')
  putDesign(dir, ['내부도구', 'admin'], '# A\n')
  const byName = Object.fromEntries(scanDesignDir(dir).map((e) => [e.name, e]))
  assert.equal(byName.checkout.category, '핀테크')
  assert.equal(byName.admin.category, '내부도구')
})

test('scanDesignDir: 깊은 카테고리는 경로를 이어 붙인다', () => {
  const dir = tempDir()
  putDesign(dir, ['웹', '결제', 'checkout'], '# C\n')
  assert.equal(scanDesignDir(dir)[0].category, '웹 / 결제')
})

test('scanDesignDir: 루트 바로 아래 DESIGN.md는 루트 폴더명이 이름', () => {
  const dir = tempDir()
  putDesign(dir, [], '# R\n')
  const entries = scanDesignDir(dir)
  assert.equal(entries.length, 1)
  assert.equal(entries[0].name, entries[0].file.split(/[\\/]/).at(-2))
})

test('scanDesignDir: 항목 폴더 안쪽으로는 더 내려가지 않는다', () => {
  const dir = tempDir()
  putDesign(dir, ['checkout'], '# C\n')
  putDesign(dir, ['checkout', 'nested'], '# N\n')
  assert.deepEqual(scanDesignDir(dir).map((e) => e.name), ['checkout'])
})

// 사내 문서는 `design.md`(소문자)로 쓰는 경우가 많다. 대소문자를 구분하는
// 파일시스템(Linux·macOS)에서 통째로 누락되면 안 된다.
test('scanDesignDir: 소문자 design.md도 찾는다', () => {
  const dir = tempDir()
  mkdirSync(join(dir, 'faux'), { recursive: true })
  writeFileSync(join(dir, 'faux', 'design.md'), '---\nname: Feelanet\n---\n')
  const entries = scanDesignDir(dir)
  assert.deepEqual(entries.map((e) => e.name), ['faux'])
  assert.equal(entries[0].label, 'Feelanet')
})

test('scanDesignDir: 숨김·node_modules 디렉터리는 건너뛴다', () => {
  const dir = tempDir()
  putDesign(dir, ['.hidden', 'ghost'], '# G\n')
  putDesign(dir, ['node_modules', 'pkg'], '# P\n')
  putDesign(dir, ['real'], '# R\n')
  assert.deepEqual(scanDesignDir(dir).map((e) => e.name), ['real'])
})

test('scanDesignDir: 카테고리가 다른 동명 항목을 잃지 않는다', () => {
  const dir = tempDir()
  putDesign(dir, ['웹', '버튼'], '# 웹 버튼\n')
  putDesign(dir, ['모바일', '버튼'], '# 모바일 버튼\n')
  const cap = makeCapture()
  const entries = scanDesignDir(dir, { log: cap.log })

  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map((e) => e.label).sort(), ['모바일 버튼', '웹 버튼'])
  assert.equal(new Set(entries.map((e) => e.name)).size, 2) // 설치 경로가 겹치지 않는다
  assert.match(cap.text(), /이름이 겹쳐/)
})

test('scanDesignDir: DESIGN.md가 없거나 없는 경로는 빈 목록', () => {
  assert.deepEqual(scanDesignDir(tempDir()), [])
  assert.deepEqual(scanDesignDir(join(tempDir(), 'nope')), [])
})

test('scanDesignDir: 기본 카테고리를 지정할 수 있다', () => {
  const dir = tempDir()
  putDesign(dir, ['x'], '# X\n')
  assert.equal(scanDesignDir(dir, { defaultCategory: '기타' })[0].category, '기타')
})

// ── 소스 식별자·경로 지정 ──────────────────────────────────────────

test('parseDirSpec: <소스id>=<경로> 와 경로 단독을 모두 받는다', () => {
  assert.equal(parseDirSpec('acme=./x').id, 'acme')
  assert.equal(parseDirSpec(join(tempDir(), 'design-lib')).id, 'design-lib')
})

test('parseDirSpec: 한글 소스 id를 경로로 오인하지 않는다', () => {
  const spec = parseDirSpec('사내=/nas/design')
  assert.equal(spec.id, '사내')
  assert.match(spec.dir, /nas[\\/]design$/)
})

test('parseDirSpec: 경로에 =가 있어도 id로 오인하지 않는다', () => {
  assert.equal(parseDirSpec('D:\\a=b\\c').id, 'c')
})

test('sanitizeId: 경로에 위험한 문자만 제거하고 유니코드는 보존한다', () => {
  assert.equal(sanitizeId('사내'), '사내') // 한글 id가 붕괴하면 안 된다
  assert.equal(sanitizeId('디자인-lib'), '디자인-lib')
  assert.equal(sanitizeId('a/b c'), 'a-b-c')
  assert.equal(sanitizeId('///'), 'local')
  assert.equal(sanitizeId('name.'), 'name') // Windows 후행 점
})

test('extraDirsFromEnv: OS 구분자로 여러 경로를 나눈다', () => {
  const env = { AGENT_INSTALLER_DESIGN_MD_DIRS: ['/a', '/b'].join(delimiter) }
  assert.deepEqual(extraDirsFromEnv(env), ['/a', '/b'])
  assert.deepEqual(extraDirsFromEnv({}), [])
})

// ── 소스 발견 ──────────────────────────────────────────────────────

test('discoverSources: 번들 캐시의 하위 디렉터리 하나가 소스 하나', () => {
  const bundleDir = tempDir()
  putDesign(bundleDir, ['acme-internal', 'checkout'], '# C\n')
  putDesign(bundleDir, ['other-src', 'admin'], '# A\n')
  const sources = discoverSources({ bundleDir })
  assert.deepEqual(sources.map((s) => s.id), ['acme-internal', 'other-src'])
  assert.deepEqual(sources[0].entries.map((e) => e.name), ['checkout'])
  assert.equal(sources[0].bundled, true)
  assert.equal(sources[0].entries[0].category, '사내') // 등록 프로바이더가 없는 사내 소스
})

test('discoverSources: 등록 프로바이더의 번들은 기본 카테고리가 기타', () => {
  const bundleDir = tempDir()
  putDesign(bundleDir, ['awesome-design-md', 'stripe'], '# S\n')
  const sources = discoverSources({ bundleDir, reservedIds: ['awesome-design-md'] })
  assert.equal(sources[0].entries[0].category, '기타')
})

test('discoverSources: 외부 경로를 추가로 붙인다', () => {
  const bundleDir = tempDir()
  const extra = tempDir()
  putDesign(extra, ['checkout'], '# C\n')
  const sources = discoverSources({ bundleDir, extraDirs: [`acme=${extra}`] })
  assert.deepEqual(sources.map((s) => s.id), ['acme'])
  assert.equal(sources[0].bundled, false)
  assert.equal(sources[0].entries[0].category, '사내')
})

test('discoverSources: id가 겹치면 접미사로 구분한다', () => {
  const bundleDir = tempDir()
  const extra = tempDir()
  putDesign(bundleDir, ['acme', 'a'], '# A\n')
  putDesign(extra, ['b'], '# B\n')
  const sources = discoverSources({ bundleDir, extraDirs: [`acme=${extra}`] })
  assert.deepEqual(sources.map((s) => s.id), ['acme', 'acme-2'])
})

test('discoverSources: 없는 경로·빈 경로는 안내하고 건너뛴다', () => {
  const cap = makeCapture()
  const sources = discoverSources({
    bundleDir: tempDir(),
    extraDirs: [join(tempDir(), 'nope'), tempDir()],
    log: cap.log,
  })
  assert.deepEqual(sources, [])
  assert.match(cap.text(), /찾을 수 없습니다/)
  assert.match(cap.text(), /DESIGN.md가 없습니다/)
})

// ── 프로바이더 없이 목록·설치 ──────────────────────────────────────

test('buildItems: 등록된 프로바이더가 없어도 디렉터리 소스는 목록에 오른다', () => {
  const dir = tempDir()
  putDesign(dir, ['핀테크', 'checkout'], '# 결제\n\n설명 문단.\n')
  const sources = discoverSources({ bundleDir: tempDir(), extraDirs: [`acme=${dir}`] })
  const items = buildItems({ providers: {} }, { fetchImpl: noNetwork, providers: [], sources })

  assert.equal(items.length, 1)
  assert.equal(items[0].id, 'design.acme.checkout')
  assert.equal(items[0].label, '결제')
  assert.equal(items[0].designCategory, '핀테크')
  assert.equal(items[0].description, '설명 문단.')
  assert.equal(items[0].local, true)
  assert.equal(items[0].webUrl, null) // 로컬 정의는 웹 미리보기가 없다
})

test('buildItems: 카탈로그 메타데이터가 스캔 값을 보강한다', () => {
  const dir = tempDir()
  putDesign(dir, ['stripe'], '# 스캔 라벨\n\n스캔 설명.\n')
  const sources = discoverSources({ bundleDir: dir })
  const catalog = { providers: { [sources[0].id]: { entries: [{ name: 'stripe', label: 'Stripe', category: 'Fintech', description: '' }] } } }
  const items = buildItems(catalog, { fetchImpl: noNetwork, providers: [], sources })

  assert.equal(items.length, 1)
  assert.equal(items[0].label, 'Stripe') // 카탈로그 우선
  assert.equal(items[0].designCategory, 'Fintech')
  assert.equal(items[0].description, '스캔 설명.') // 카탈로그가 비면 스캔으로 채움
})

test('buildItems: 카탈로그에만 있고 프로바이더도 디렉터리도 없으면 건너뛴다', () => {
  const catalog = { providers: { ghost: { entries: [{ name: 'x', label: 'x', category: 'c', description: '' }] } } }
  assert.deepEqual(buildItems(catalog, { fetchImpl: noNetwork, providers: [], sources: [] }), [])
})

// 외부 경로가 등록 프로바이더 id를 차지하면 로컬 파일 대신 네트워크로 나가버린다.
test('외부 소스 id가 등록 프로바이더와 겹치면 비켜 간다', async () => {
  const dir = tempDir()
  putDesign(dir, ['secret-thing'], '# 사내\n')
  const sources = discoverSources({
    bundleDir: tempDir(),
    extraDirs: [`awesome-design-md=${dir}`],
    reservedIds: ['awesome-design-md'],
  })
  assert.deepEqual(sources.map((s) => s.id), ['awesome-design-md-2'])

  // PROVIDERS 전체를 넘겨도 로컬 프로바이더가 유지되어야 한다.
  const [item] = buildItems({ providers: {} }, { fetchImpl: noNetwork, sources })
  assert.equal(item.local, true)
  assert.equal(item.webUrl, null) // 사내 이름이 외부 URL로 새지 않는다
  await item.install({ root: makeTempRepo(), dryRun: false }) // noNetwork면 여기서 실패한다
})

test('번들 소스는 등록 프로바이더 id를 그대로 쓴다', () => {
  const bundleDir = tempDir()
  putDesign(bundleDir, ['awesome-design-md', 'stripe'], '# S\n')
  const sources = discoverSources({ bundleDir, reservedIds: ['awesome-design-md'] })
  assert.deepEqual(sources.map((s) => s.id), ['awesome-design-md'])
})

test('로컬 소스 항목은 네트워크 없이 설치·감지·제거된다', async () => {
  const dir = tempDir()
  putDesign(dir, ['checkout'], '# 결제\n')
  const sources = discoverSources({ bundleDir: tempDir(), extraDirs: [`acme=${dir}`] })
  const [item] = buildItems({ providers: {} }, { fetchImpl: noNetwork, providers: [], sources })
  const root = makeTempRepo()

  assert.equal((await item.detect({ root })).status, 'absent')
  await item.install({ root, dryRun: false })
  const file = join(root, 'design-md', 'acme', 'checkout', 'DESIGN.md')
  assert.equal(readFileSync(file, 'utf8'), '# 결제\n')
  assert.equal((await item.detect({ root })).status, 'installed')

  // fresh 업데이트도 로컬 파일을 원본으로 삼는다(네트워크 호출 없음).
  writeFileSync(join(dir, 'checkout', 'DESIGN.md'), '# 결제 v2\n')
  await item.install({ root, dryRun: false, fresh: true })
  assert.equal(readFileSync(file, 'utf8'), '# 결제 v2\n')

  await item.uninstall({ root, dryRun: false })
  assert.equal(existsSync(join(root, 'design-md', 'acme', 'checkout')), false)
})

// ── flow 통합 ──────────────────────────────────────────────────────

test('--list는 로컬 소스를 표시하고, --set이 설치한다', async () => {
  const dir = tempDir()
  putDesign(dir, ['sanae-console'], '# 사내 콘솔\n')
  const root = makeTempRepo()
  const cap = makeCapture()
  const opts = { bundleDir: tempDir(), designDirs: [`acme=${dir}`], env: {}, fetchImpl: noNetwork }

  await runDesign(root, { ...opts, list: true, log: cap.log })
  assert.match(cap.text(), /\[acme · 로컬\]/)
  assert.match(cap.text(), /sanae-console — 사내 콘솔/)

  await runDesign(root, { ...opts, set: 'sanae-console', log() {} })
  assert.ok(existsSync(join(root, 'design-md', 'acme', 'sanae-console', 'DESIGN.md')))
})

test('환경변수로 지정한 경로도 목록에 포함된다', async () => {
  const dir = tempDir()
  putDesign(dir, ['env-item'], '# ENV\n')
  const cap = makeCapture()
  await runDesign(makeTempRepo(), {
    list: true,
    log: cap.log,
    fetchImpl: noNetwork,
    bundleDir: tempDir(),
    env: { AGENT_INSTALLER_DESIGN_MD_DIRS: `acme=${dir}` },
  })
  assert.match(cap.text(), /env-item — ENV/)
})

// README가 약속한 동작: 카탈로그 새로고침이 사내 항목을 지우지 않는다.
test('--sync=catalog 후에도 로컬 항목이 남는다', async () => {
  const dir = tempDir()
  putDesign(dir, ['keep-me'], '# 유지\n')
  const root = makeTempRepo()
  const catalogFile = join(tempDir(), 'catalog.json')
  const opts = { bundleDir: tempDir(), designDirs: [`acme=${dir}`], env: {}, catalogFile }

  const fetchImpl = makeFetch([
    { match: 'README.md', body: '## Collection\n### C\n- [**Stripe**](https://getdesign.md/stripe/design-md) - d\n' },
    { match: 'git/trees', body: JSON.stringify({ tree: [] }) },
  ])
  await runDesign(root, { ...opts, sync: 'catalog', fetchImpl, log() {} })

  const cap = makeCapture()
  await runDesign(root, { ...opts, list: true, fetchImpl, log: cap.log })
  assert.match(cap.text(), /keep-me — 유지/)
  assert.match(cap.text(), /stripe — Stripe/) // 새로고침 결과도 함께 보인다
})

test('로컬 항목 --preview는 안내만 하고 브라우저를 열지 않는다', async () => {
  const dir = tempDir()
  putDesign(dir, ['local-only'], '# L\n')
  const cap = makeCapture()
  const targets = []
  await runDesign(makeTempRepo(), {
    preview: 'local-only',
    opener: (t) => { targets.push(t); return { ok: true } },
    log: cap.log,
    fetchImpl: noNetwork,
    bundleDir: tempDir(),
    designDirs: [`acme=${dir}`],
    env: {},
  })
  assert.deepEqual(targets, [])
  assert.match(cap.text(), /미리보기 URL/)
})
