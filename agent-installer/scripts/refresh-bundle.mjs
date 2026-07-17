#!/usr/bin/env node
// 카탈로그의 모든 DESIGN.md를 lib/design-md/cache/<name>/DESIGN.md 로 내려받아
// 인스톨러에 동봉하는 오프라인 번들을 (재)생성한다. 유지보수용.
//   node scripts/refresh-bundle.mjs   (또는 npm run refresh-bundle)
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog } from '../lib/design-md/catalog.mjs'
import { getProvider } from '../lib/design-md/providers/index.mjs'

const CACHE = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'design-md', 'cache')
const CONCURRENCY = 8

async function pool(tasks, size, worker) {
  const results = []
  let i = 0
  async function run() {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await worker(tasks[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, tasks.length) }, run))
  return results
}

const catalog = loadCatalog()
const jobs = []
for (const [providerId, block] of Object.entries(catalog.providers ?? {})) {
  const provider = getProvider(providerId)
  if (!provider) { console.log(`프로바이더 건너뜀: ${providerId}`); continue }
  for (const entry of block.entries ?? []) jobs.push({ provider, name: entry.name })
}

let ok = 0
const failed = []
await pool(jobs, CONCURRENCY, async ({ provider, name }) => {
  try {
    const text = await provider.fetchFile(fetch, name, 'DESIGN.md')
    if (text == null) { failed.push(`${provider.id}/${name}`); return }
    const dir = join(CACHE, provider.id, name) // cache/<provider>/<name>/DESIGN.md
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'DESIGN.md'), text)
    ok++
  } catch (err) {
    failed.push(`${provider.id}/${name} (${err.message})`)
  }
})

console.log(`번들 생성: ${ok}개 성공${failed.length ? `, 실패 ${failed.length}: ${failed.join(', ')}` : ''}`)
console.log(`위치: ${CACHE}`)
if (failed.length) process.exitCode = 1
