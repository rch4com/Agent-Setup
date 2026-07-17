import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo } from './helpers.mjs'
import { defineDesignMd, loadCatalog, allEntries } from '../lib/design-md/catalog.mjs'
import { awesomeDesignMd } from '../lib/design-md/providers/awesome-design-md.mjs'

function entry(name) {
  return { name, label: name, category: 'c', description: '' }
}

// 번들 유무/네트워크 호출을 관찰하는 스텁 프로바이더.
function stubProvider({ bundle = null, net = null } = {}) {
  const calls = { fetch: 0 }
  const provider = {
    id: 'stub',
    async fetchFile() { calls.fetch++; return net },
    webUrl: (n) => `web/${n}`,
  }
  if (bundle !== null) provider.bundledText = (name) => (name in bundle ? bundle[name] : null)
  return { provider, calls }
}

function contentOf(root, providerId, name) {
  return readFileSync(join(root, 'design-md', providerId, name, 'DESIGN.md'), 'utf8')
}

test('install 기본은 번들 우선 — 네트워크를 호출하지 않는다', async () => {
  const root = makeTempRepo()
  const { provider, calls } = stubProvider({ bundle: { stripe: '# BUNDLED' }, net: '# NET' })
  const item = defineDesignMd(entry('stripe'), provider, { fetchImpl: async () => ({}) })
  await item.install({ root, dryRun: false })
  assert.equal(contentOf(root, 'stub', 'stripe'), '# BUNDLED')
  assert.equal(calls.fetch, 0)
})

test('install fresh=true는 번들을 무시하고 네트워크 최신을 쓴다', async () => {
  const root = makeTempRepo()
  const { provider, calls } = stubProvider({ bundle: { stripe: '# BUNDLED' }, net: '# NET' })
  const item = defineDesignMd(entry('stripe'), provider, { fetchImpl: async () => ({}) })
  await item.install({ root, dryRun: false, fresh: true })
  assert.equal(contentOf(root, 'stub', 'stripe'), '# NET')
  assert.equal(calls.fetch, 1)
})

test('install은 번들이 없으면 네트워크로 폴백한다', async () => {
  const root = makeTempRepo()
  const { provider, calls } = stubProvider({ bundle: {}, net: '# NET' })
  const item = defineDesignMd(entry('stripe'), provider, { fetchImpl: async () => ({}) })
  await item.install({ root, dryRun: false })
  assert.equal(contentOf(root, 'stub', 'stripe'), '# NET')
  assert.equal(calls.fetch, 1)
})

// 회귀 방지: 카탈로그가 바뀌면 번들도 다시 만들어야 한다(npm run refresh-bundle).
test('번들은 카탈로그의 모든 항목을 포함한다', () => {
  const missing = allEntries(loadCatalog()).filter((e) => !existsSync(awesomeDesignMd.bundlePath(e.name)))
  assert.deepEqual(missing.map((e) => e.name), [])
})

test('provider.bundledText는 동봉 파일을 읽고, 없으면 null', () => {
  assert.ok(awesomeDesignMd.bundledText('stripe').length > 0)
  assert.equal(awesomeDesignMd.bundledText('__does_not_exist__'), null)
})
