import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeFetch } from './helpers.mjs'
import { defineDesignMd, buildItems, sha256, loadCatalog, saveCatalog, resolveTokens } from '../lib/design-md/catalog.mjs'
import { awesomeDesignMd as provider } from '../lib/design-md/providers/awesome-design-md.mjs'

const PID = provider.id // 'awesome-design-md'

function entry(name, over = {}) {
  return { name, label: name, category: 'c', description: '', ...over }
}

function stub(id) {
  return { id, webUrl: (n) => `web/${id}/${n}`, async fetchFile() { return `# ${id}` } }
}

test('defineDesignMd: install 쓰기 → detect installed → uninstall 제거', async () => {
  const root = makeTempRepo()
  const fetchImpl = makeFetch([{ match: 'design-md/stripe/DESIGN.md', body: '# Stripe DESIGN' }])
  const item = defineDesignMd(entry('stripe', { label: 'Stripe' }), provider, { fetchImpl })

  assert.equal((await item.detect({ root })).status, 'absent')
  await item.install({ root, dryRun: false, fresh: true }) // fresh=네트워크 경로 검증
  const file = join(root, 'design-md', PID, 'stripe', 'DESIGN.md')
  assert.ok(existsSync(file))
  assert.equal(readFileSync(file, 'utf8'), '# Stripe DESIGN')
  assert.equal((await item.detect({ root })).status, 'installed')

  await item.uninstall({ root, dryRun: false })
  assert.equal((await item.detect({ root })).status, 'absent')
})

test('install dry-run은 fetch도 쓰기도 하지 않는다', async () => {
  const root = makeTempRepo()
  let called = 0
  const fetchImpl = async () => { called++; return { ok: true, text: async () => 'x' } }
  const item = defineDesignMd(entry('apple'), provider, { fetchImpl })
  await item.install({ root, dryRun: true })
  assert.equal(called, 0)
  assert.equal(existsSync(join(root, 'design-md', PID, 'apple')), false)
})

test('install은 원본 파일이 없으면 예외', async () => {
  const item = defineDesignMd(entry('ghost'), provider, { fetchImpl: makeFetch([]) })
  await assert.rejects(item.install({ root: makeTempRepo(), dryRun: false }), /다운로드 실패/)
})

test('경로 구분자가 든 이름은 거부한다', async () => {
  const item = defineDesignMd(entry('a/b'), provider, { fetchImpl: async () => ({}) })
  await assert.rejects(item.detect({ root: makeTempRepo() }), /잘못된 design.md 식별자/)
})

test('buildItems: 엔트리를 item으로, 알 수 없는 프로바이더는 건너뛴다', () => {
  const catalog = { providers: {
    'awesome-design-md': { entries: [entry('b'), entry('a')] },
    'unknown-src': { entries: [entry('z')] },
  } }
  const items = buildItems(catalog, { fetchImpl: async () => ({}) })
  assert.deepEqual(items.map((i) => i.name), ['a', 'b'])
  assert.equal(items[0].category, 'design')
  assert.equal(items[0].id, 'design.awesome-design-md.a')
})

test('buildItems: 여러 제공자의 동명 항목이 붕괴 없이 공존한다', () => {
  const catalog = { providers: {
    'src-a': { entries: [entry('stripe')] },
    'src-b': { entries: [entry('stripe')] },
  } }
  const items = buildItems(catalog, { fetchImpl: async () => ({}), providers: [stub('src-a'), stub('src-b')] })
  assert.deepEqual(items.map((i) => i.id), ['design.src-a.stripe', 'design.src-b.stripe'])
  assert.deepEqual([...new Set(items.map((i) => i.providerId))], ['src-a', 'src-b'])
})

test('resolveTokens: name / provider/name 해석, 미지원·중복 처리', () => {
  const items = buildItems(
    { providers: { 'src-a': { entries: [entry('stripe'), entry('vercel')] }, 'src-b': { entries: [entry('stripe')] } } },
    { fetchImpl: async () => ({}), providers: [stub('src-a'), stub('src-b')] },
  )
  // 고유 이름은 그대로
  assert.deepEqual(resolveTokens(items, 'vercel').map((i) => i.id), ['design.src-a.vercel'])
  // provider/name 지정
  assert.deepEqual(resolveTokens(items, 'src-b/stripe').map((i) => i.id), ['design.src-b.stripe'])
  // 빈 문자열 → 빈 목표(전체 제거)
  assert.deepEqual(resolveTokens(items, ''), [])
  // 미지원
  assert.throws(() => resolveTokens(items, 'nope'), /알 수 없는 항목/)
  // 중복된 이름은 제공자 지정 요구
  assert.throws(() => resolveTokens(items, 'stripe'), /중복된 이름/)
})

test('saveCatalog/loadCatalog 왕복', () => {
  const file = join(makeTempRepo(), 'cat.json')
  const cat = { updatedAt: 't', providers: { x: { entries: [{ name: 'n' }] } } }
  saveCatalog(cat, file)
  assert.deepEqual(loadCatalog(file), cat)
})

test('loadCatalog: 없는 파일은 빈 카탈로그', () => {
  assert.deepEqual(loadCatalog(join(makeTempRepo(), 'none.json')), { updatedAt: null, providers: {} })
})

test('sha256은 내용이 다르면 다른 값', () => {
  assert.notEqual(sha256('a'), sha256('b'))
  assert.equal(sha256('a'), sha256('a'))
})
