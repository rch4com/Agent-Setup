import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { makeTempRepo, makeFetch } from './helpers.mjs'
import {
  defineDesignMd, buildItems, sha256, loadCatalog, saveCatalog, resolveTokens,
  netFetch, FETCH_TIMEOUT_MS,
} from '../lib/design-md/catalog.mjs'
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
  // LocalizedError의 .message는 언제나 영어다 — 키로 단언한다.
  const item = defineDesignMd(entry('ghost'), provider, { fetchImpl: makeFetch([]) })
  await assert.rejects(item.install({ root: makeTempRepo(), dryRun: false }), (err) => err.key === 'error.designDownload')
})

test('경로 구분자가 든 이름은 거부한다', async () => {
  const item = defineDesignMd(entry('a/b'), provider, { fetchImpl: async () => ({}) })
  await assert.rejects(item.detect({ root: makeTempRepo() }), (err) => err.key === 'error.badDesignId')
})

// 부트스트랩은 쓰기 경로마다 링크 이탈을 검사한다. 설치기의 design.md 경로도
// 같은 규칙을 따라야 한다 — uninstall이 재귀 삭제를 하므로 새어 나가면
// 저장소 밖 파일이 지워진다.
test('design-md가 저장소 밖을 가리키는 링크면 install·uninstall이 거부한다', async () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-design-'))
  symlinkSync(outside, join(root, 'design-md'), 'junction')

  const item = defineDesignMd(entry('stripe'), provider, {
    fetchImpl: makeFetch([{ match: 'DESIGN.md', body: '# S' }]),
  })
  await assert.rejects(item.install({ root, dryRun: false, fresh: true }), /external link/)
  await assert.rejects(item.uninstall({ root, dryRun: false }), /external link/)
  // 읽기(detect)는 어휘적 경로로 충분하다 — 지켜야 할 쓰기가 없다.
  assert.equal((await item.detect({ root })).status, 'absent')
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

// 카탈로그는 원격 README 파싱 결과라 신뢰 경계 밖이다. 경로에 위험한 이름은
// install 시점(designPaths)뿐 아니라 목록·미리보기에도 오르면 안 된다.
test('buildItems: 경로에 위험한 이름은 item으로 만들지 않는다', () => {
  const catalog = { providers: { 'awesome-design-md': { entries: [
    entry('ok'), entry('../escape'), entry('a/b'), entry('.hidden'), entry('tail.'), entry('q?mark'),
  ] } } }
  const items = buildItems(catalog, { fetchImpl: async () => ({}) })
  assert.deepEqual(items.map((i) => i.name), ['ok'])
})

// 라벨·설명은 원격 README에서 온다. 목록과 TUI가 터미널에 그대로 찍으므로
// ANSI 이스케이프가 남으면 화면을 지우거나 커서를 옮겨 목록을 위장할 수 있다.
// 제어문자는 소스에 원시 바이트로 두지 않는다 — 도구를 거치며 조용히 뭉개진다.
const ESC = '\u001b'
const CONTROL_RE = /[\u0000-\u001f\u007f]/
// 보이지 않으면서 표시를 흔드는 유니코드 서식문자(bidi 오버라이드·isolate·폭 0).
const INVISIBLE_RE =
  /[\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\ufeff]/

test('defineDesignMd: 화면에 나가는 값에서 제어문자를 걷어낸다', () => {
  const item = defineDesignMd(
    entry('stripe', {
      label: `Str${ESC}[2Jipe`,
      category: 'Fin\u0007tech',
      description: '줄\r\n바꿈과 널\u0000문자',
    }),
    provider,
    { fetchImpl: async () => ({}) },
  )
  assert.equal(item.label, 'Str [2Jipe')
  assert.equal(item.designCategory, 'Fin tech')
  assert.equal(item.description, '줄 바꿈과 널 문자')
  for (const shown of [item.label, item.designCategory, item.description]) {
    assert.doesNotMatch(shown, CONTROL_RE, JSON.stringify(shown))
  }
  // name은 경로·URL에 쓰이므로 정화 대상이 아니다(isSafeSegment가 따로 거른다).
  assert.equal(item.name, 'stripe')
})

// bidi 오버라이드·isolate는 보이지 않으면서 표시 순서를 뒤집어, 라벨이 다른
// 항목처럼 보이게 만든다. 폭 없는 문자는 같아 보이는 서로 다른 이름을 만든다.
// 제어문자를 걷어내는 목적("원격 텍스트가 화면을 위장하지 못하게")이 같다.
test('defineDesignMd: bidi·폭 없는 유니코드 서식문자도 걷어낸다', () => {
  const RLO = '\u202e' // right-to-left override: 뒤 텍스트를 거꾸로 그린다
  const PDF = '\u202c' // pop directional formatting
  const item = defineDesignMd(
    entry('stripe', {
      label: 'Str' + RLO + 'epi' + PDF + 'pe',
      category: 'Fin\u200btech', // zero-width space
      description: '설명\u2066숨김\u2069\ufeff', // isolate + BOM
    }),
    provider,
    { fetchImpl: async () => ({}) },
  )
  for (const shown of [item.label, item.designCategory, item.description]) {
    assert.doesNotMatch(shown, INVISIBLE_RE, JSON.stringify(shown))
  }
  assert.equal(item.label, 'Str epi pe')
  assert.equal(item.designCategory, 'Fin tech')
  assert.equal(item.description, '설명 숨김')
})

test('defineDesignMd: 라벨이 통째로 제어문자면 name으로 폴백한다', () => {
  const item = defineDesignMd(entry('stripe', { label: ESC + ESC }), provider, { fetchImpl: async () => ({}) })
  assert.equal(item.label, 'stripe')
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
  // 미지원 — LocalizedError의 .message는 언제나 영어다, 키로 단언한다.
  assert.throws(() => resolveTokens(items, 'nope'), (err) => err.key === 'error.unknownItem')
  // 중복된 이름은 제공자 지정 요구
  assert.throws(() => resolveTokens(items, 'stripe'), (err) => err.key === 'design.ambiguous')
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

// 원시 SyntaxError는 어느 파일이 문제인지도, 어떻게 고치는지도 알려 주지 않는다.
// LocalizedError의 .message는 언제나 영어다 — 키와 params로 단언한다.
test('loadCatalog: 손상된 파일은 경로와 복구 방법을 담아 던진다', () => {
  const file = join(makeTempRepo(), 'broken.json')
  writeFileSync(file, '{ "providers": ')
  assert.throws(() => loadCatalog(file), (err) => {
    assert.equal(err.key, 'error.catalogUnreadable')
    assert.equal(err.params.path, file)
    assert.match(err.message, /--sync=catalog/)
    return true
  })
})

// 맨 fetch에는 제한이 없어, 응답하지 않는 서버를 만나면 동기화가 멈춘다.
test('netFetch는 기본 시간 제한을 건다', async () => {
  const seen = []
  const original = globalThis.fetch
  globalThis.fetch = async (url, opts) => { seen.push({ url, opts }); return { ok: true } }
  try {
    await netFetch('https://example.com/a')
    await netFetch('https://example.com/b', { headers: { 'User-Agent': 'x' } })
  } finally {
    globalThis.fetch = original
  }
  assert.equal(seen.length, 2)
  for (const { opts } of seen) {
    assert.ok(opts.signal instanceof AbortSignal, '시간 제한 signal이 붙어야 한다')
  }
  // 호출자가 준 옵션은 그대로 살아 있어야 한다.
  assert.equal(seen[1].opts.headers['User-Agent'], 'x')
  assert.ok(FETCH_TIMEOUT_MS > 0)
})

// 시간 제한은 "데이터가 계속 오는" 응답을 막지 못한다 — 끝나지 않는 본문은
// text()가 메모리를 다 쓸 때까지 읽는다. 상한을 넘으면 읽기를 끊어야 한다.
test('netFetch는 본문 크기 상한을 넘으면 읽기를 끊는다', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('x'.repeat(4096))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/big`
  try {
    // LocalizedError의 .message는 언제나 영어다 — 키로 단언한다.
    await assert.rejects(async () => (await netFetch(url, { maxBytes: 64 })).text(), (err) => err.key === 'error.responseTooLarge')
    // 상한 안이면 그대로 읽는다.
    const res = await netFetch(url, { maxBytes: 1024 * 1024 })
    assert.equal(res.ok, true)
    assert.equal((await res.text()).length, 4096)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})

test('sha256은 내용이 다르면 다른 값', () => {
  assert.notEqual(sha256('a'), sha256('b'))
  assert.equal(sha256('a'), sha256('a'))
})
