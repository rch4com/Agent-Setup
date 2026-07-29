import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  await assert.rejects(item.install({ root, dryRun: false, fresh: true }), /외부 링크/)
  await assert.rejects(item.uninstall({ root, dryRun: false }), /외부 링크/)
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

// 원시 SyntaxError는 어느 파일이 문제인지도, 어떻게 고치는지도 알려 주지 않는다.
test('loadCatalog: 손상된 파일은 경로와 복구 방법을 담아 던진다', () => {
  const file = join(makeTempRepo(), 'broken.json')
  writeFileSync(file, '{ "providers": ')
  assert.throws(() => loadCatalog(file), (err) => {
    assert.match(err.message, /카탈로그를 읽을 수 없습니다/)
    assert.ok(err.message.includes(file), `문제 파일이 메시지에 없다: ${err.message}`)
    assert.match(err.message, /--sync=catalog/)
    return true
  })
})

test('sha256은 내용이 다르면 다른 값', () => {
  assert.notEqual(sha256('a'), sha256('b'))
  assert.equal(sha256('a'), sha256('a'))
})
