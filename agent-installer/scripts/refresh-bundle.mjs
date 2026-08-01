#!/usr/bin/env node
// 카탈로그의 모든 DESIGN.md를 lib/design-md/cache/<name>/DESIGN.md 로 내려받아
// 인스톨러에 동봉하는 오프라인 번들을 (재)생성한다. 유지보수용.
//   node scripts/refresh-bundle.mjs   (또는 npm run refresh-bundle)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCatalog, netFetch } from '../lib/design-md/catalog.mjs'
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
    // 맨 fetch가 아니라 netFetch를 쓴다 — 시간 제한도 크기 상한도 없는 호출은
    // 응답하지 않는 서버를 만나면 취소할 방법 없이 멈춘다.
    const text = await provider.fetchFile(netFetch, name, 'DESIGN.md')
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

// 고지가 상류와 어긋났는지만 본다 — 자동으로 덮어쓰지는 않는다.
// 고지 파일에는 우리가 쓴 출처 설명이 함께 들어 있어, 원문으로 통째 갈아치우면
// 그 맥락이 사라진다. 상류가 라이선스를 바꾸면(연도·주체·조건) 사람이 보고
// 고쳐야 하는 일이므로, 여기서는 다르다는 사실만 크게 알린다.
for (const providerId of new Set(jobs.map((j) => j.provider.id))) {
  const provider = getProvider(providerId)
  if (!provider?.licenseUrl || !provider.noticeFile) continue
  const notice = join(CACHE, provider.id, provider.noticeFile)
  try {
    const res = await netFetch(provider.licenseUrl)
    if (!res.ok) { console.log(`고지 확인 실패(${provider.id}): HTTP ${res.status}`); continue }
    const upstream = (await res.text()).replace(/\r\n/g, '\n').trim()
    const ours = existsSync(notice) ? readFileSync(notice, 'utf8').replace(/\r\n/g, '\n') : ''
    if (ours.includes(upstream)) console.log(`고지 확인(${provider.id}): 상류와 일치`)
    else console.log(`고지 불일치(${provider.id}): ${notice} 를 상류 원문에 맞춰 갱신하세요`)
  } catch (err) {
    console.log(`고지 확인 실패(${provider.id}): ${err.message}`)
  }
}

if (failed.length) process.exitCode = 1
