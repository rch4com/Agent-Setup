import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeFetch } from './helpers.mjs'
import { parseReadme, parseTreeNames, awesomeDesignMd } from '../lib/design-md/providers/awesome-design-md.mjs'

const README = `# Title
## What is DESIGN.md?
- [**NotInCollection**](https://getdesign.md/nope/design-md) - 무시되어야 함
## Collection
### AI & LLM Platforms
- [**Claude**](https://getdesign.md/claude/design-md) - Anthropic's AI assistant. Warm terracotta
- [**Mistral AI**](https://getdesign.md/mistral.ai/design-md) - French minimalism
### Fintech & Crypto
- [**Stripe**](https://getdesign.md/stripe/design-md) - Payment infrastructure
## What's Inside
- [**AfterCollection**](https://getdesign.md/after/design-md) - 무시
`

test('parseReadme는 Collection 블록만, 카테고리/이름/설명을 추출한다', () => {
  const entries = parseReadme(README)
  assert.deepEqual(entries.map((e) => e.name), ['claude', 'mistral.ai', 'stripe'])
  const claude = entries.find((e) => e.name === 'claude')
  assert.equal(claude.label, 'Claude')
  assert.equal(claude.category, 'AI & LLM Platforms')
  assert.match(claude.description, /terracotta/)
  assert.equal(entries.find((e) => e.name === 'stripe').category, 'Fintech & Crypto')
})

test('parseTreeNames는 design-md 폴더명만 뽑는다', () => {
  const tree = { tree: [
    { path: 'design-md/stripe/DESIGN.md' },
    { path: 'design-md/slack/DESIGN.md' },
    { path: 'README.md' },
  ] }
  assert.deepEqual([...parseTreeNames(tree)].sort(), ['slack', 'stripe'])
})

test('fetchCatalog는 README + tree orphan을 병합하고 이름순 정렬한다', async () => {
  const fetchImpl = makeFetch([
    { match: 'README.md', body: README },
    { match: 'git/trees', body: JSON.stringify({ tree: [
      { path: 'design-md/stripe/DESIGN.md' },
      { path: 'design-md/orphan/DESIGN.md' },
    ] }) },
  ])
  const entries = await awesomeDesignMd.fetchCatalog(fetchImpl)
  assert.deepEqual(entries.map((e) => e.name), ['claude', 'mistral.ai', 'orphan', 'stripe'])
  assert.equal(entries.find((e) => e.name === 'orphan').category, '기타')
})

test('fetchCatalog는 tree 실패 시 README만으로 동작한다', async () => {
  const fetchImpl = makeFetch([{ match: 'README.md', body: README }]) // tree는 404
  const entries = await awesomeDesignMd.fetchCatalog(fetchImpl)
  assert.deepEqual(entries.map((e) => e.name), ['claude', 'mistral.ai', 'stripe'])
})

test('fetchCatalog는 README 실패 시 예외', async () => {
  const fetchImpl = makeFetch([]) // 404
  await assert.rejects(awesomeDesignMd.fetchCatalog(fetchImpl), /README/)
})

test('webUrl/fileUrl 규칙', () => {
  assert.equal(awesomeDesignMd.webUrl('stripe'), 'https://getdesign.md/stripe/design-md')
  assert.match(awesomeDesignMd.fileUrl('stripe'), /\/design-md\/stripe\/DESIGN\.md$/)
})

// README가 오염되면 이름에 셸 메타문자가 섞일 수 있다. 그 이름이 그대로
// 이어붙으면 미리보기 대상 문자열이 URL이 아니게 된다.
test('webUrl은 이름을 인코딩한다 — 셸 메타문자가 URL 밖으로 새지 않게', () => {
  assert.equal(awesomeDesignMd.webUrl('x&calc'), 'https://getdesign.md/x%26calc/design-md')
  assert.equal(awesomeDesignMd.webUrl('a b'), 'https://getdesign.md/a%20b/design-md')
  // 실제 카탈로그의 이름들은 인코딩해도 그대로여야 한다(회귀 방지).
  for (const name of ['stripe', 'mistral.ai', 'linear.app', 'nintendo-2001']) {
    assert.equal(awesomeDesignMd.webUrl(name), `https://getdesign.md/${name}/design-md`)
  }
})
