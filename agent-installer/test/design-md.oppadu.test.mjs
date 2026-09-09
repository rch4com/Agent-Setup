import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeFetch } from './helpers.mjs'
import { PROVIDERS } from '../lib/design-md/providers/index.mjs'
import { oppadu, parseIndex, stripDarkBlock, toDesignMd, REGION_LABELS } from '../lib/design-md/providers/oppadu.mjs'

// data/brands-index.json의 실제 형태를 줄인 것이다(schema_version 3, 2026-08-18).
const INDEX = JSON.stringify({
  schema_version: 3,
  brands: [
    { slug: 'kakao', brand: 'Kakao', brand_ko: '카카오', region: 'korea', signature_keyword: 'Kakao Yellow와 5색 캐릭터의 한국 메신저 표준' },
    { slug: 'figma', brand: 'Figma', brand_ko: '피그마', region: 'western', signature_keyword: 'Collaborative design tool' },
    { slug: 'line', brand: 'LINE', brand_ko: '라인', region: 'asia', signature_keyword: 'Green messenger' },
    // 이름이 경로가 될 수 없는 항목 — buildItems가 거르지만 프로바이더도 통과시키지 않는다.
    { slug: '../escape', brand: 'Bad', region: 'korea', signature_keyword: '' },
  ],
})

const LIGHT_MD = `---
brand: Kakao
theme_modes:
  - light
  - dark
---
### ③ 컬러 시스템
\`\`\`css
:root {
  --bg-base: #FFFFFF;
}

[data-theme="dark"] {
  --bg-base: #1F1F1F;
}
\`\`\`
### ④ 타이포그래피
- 본문
`

test('parseIndex는 slug를 이름으로, 지역을 카테고리로, 한 줄 설명을 description으로 뽑는다', () => {
  const entries = parseIndex(JSON.parse(INDEX))
  const kakao = entries.find((e) => e.name === 'kakao')
  assert.equal(kakao.label, 'Kakao (카카오)')
  assert.equal(kakao.category, REGION_LABELS.korea)
  assert.match(kakao.description, /메신저 표준/)
})

// 사이트의 displayName 규칙과 같다 — 한국 브랜드만 괄호에 한글 이름을 붙인다.
test('parseIndex는 한국 밖 브랜드에는 한글 이름을 붙이지 않는다', () => {
  const entries = parseIndex(JSON.parse(INDEX))
  assert.equal(entries.find((e) => e.name === 'figma').label, 'Figma')
  assert.equal(entries.find((e) => e.name === 'line').label, 'LINE')
  assert.equal(entries.find((e) => e.name === 'line').category, REGION_LABELS.asia)
})

test('parseIndex는 경로가 될 수 없는 slug를 버리고 이름순으로 정렬한다', () => {
  const entries = parseIndex(JSON.parse(INDEX))
  assert.deepEqual(entries.map((e) => e.name), ['figma', 'kakao', 'line'])
})

test('parseIndex는 brands 배열이 없으면 빈 배열이다', () => {
  assert.deepEqual(parseIndex({}), [])
  assert.deepEqual(parseIndex(null), [])
})

// 사이트의 "가이드 다운로드"(라이트 모드)와 글자 단위로 같은 결과여야 한다 —
// 다크 규칙 블록을 제 줄까지 걷어내되, 앞의 빈 줄 하나는 사이트처럼 남긴다.
test('stripDarkBlock은 [data-theme="dark"] 규칙을 줄째 제거한다', () => {
  const out = stripDarkBlock(LIGHT_MD)
  assert.doesNotMatch(out, /data-theme/)
  assert.doesNotMatch(out, /#1F1F1F/)
  assert.match(out, /--bg-base: #FFFFFF;\n}\n\n```\n### ④/)
})

test('stripDarkBlock은 다크 규칙이 없으면 원문을 그대로 돌려준다', () => {
  const plain = '# Title\n\n:root { --x: 1; }\n'
  assert.equal(stripDarkBlock(plain), plain)
  assert.equal(stripDarkBlock(''), '')
})

test('toDesignMd는 라이트·다크 겸용 브랜드에서 다크 블록을 걷어낸 라이트 판을 만든다', () => {
  const detail = { theme_modes: ['light', 'dark'], raw_markdown: LIGHT_MD, raw_markdown_dark: '# dark' }
  assert.doesNotMatch(toDesignMd(detail), /data-theme/)
})

test('toDesignMd는 단일 모드 브랜드의 원문을 그대로 쓴다', () => {
  const detail = { theme_modes: ['light'], raw_markdown: LIGHT_MD }
  assert.equal(toDesignMd(detail), LIGHT_MD)
})

test('toDesignMd는 원문이 없으면 null이다', () => {
  assert.equal(toDesignMd({ theme_modes: ['light'] }), null)
  assert.equal(toDesignMd(null), null)
})

test('fetchCatalog는 공개 색인 JSON 하나로 카탈로그를 만든다', async () => {
  const fetchImpl = makeFetch([{ match: 'data/brands-index.json', body: INDEX }])
  const entries = await oppadu.fetchCatalog(fetchImpl)
  assert.deepEqual(entries.map((e) => e.name), ['figma', 'kakao', 'line'])
})

test('fetchCatalog는 색인 실패 시 예외', async () => {
  await assert.rejects(oppadu.fetchCatalog(makeFetch([])), /brands-index/)
})

test('fetchFile은 상세 JSON에서 라이트 판 마크다운을 꺼낸다', async () => {
  const detail = { theme_modes: ['light', 'dark'], raw_markdown: LIGHT_MD, raw_markdown_dark: '# dark' }
  const fetchImpl = makeFetch([{ match: 'data/detail/kakao.json', body: JSON.stringify(detail) }])
  const text = await oppadu.fetchFile(fetchImpl, 'kakao')
  assert.match(text, /### ④ 타이포그래피/)
  assert.doesNotMatch(text, /data-theme/)
})

test('fetchFile은 404나 원문 없는 응답에 null을 돌려준다', async () => {
  assert.equal(await oppadu.fetchFile(makeFetch([]), 'kakao'), null)
  const empty = makeFetch([{ match: 'data/detail/kakao.json', body: JSON.stringify({ slug: 'kakao' }) }])
  assert.equal(await oppadu.fetchFile(empty, 'kakao'), null)
})

test('webUrl/fileUrl 규칙 — 공개 브랜드 페이지와 상세 JSON', () => {
  assert.equal(oppadu.webUrl('kakao'), 'https://www.oppadu.com/tools/design-systems-site/brand/kakao.html')
  assert.equal(oppadu.fileUrl('kakao'), 'https://www.oppadu.com/tools/design-systems-site/data/detail/kakao.json')
})

// 이름은 원격 색인에서 온다 — 인코딩하지 않으면 미리보기 대상 문자열이 URL이 아니게 된다.
test('webUrl/fileUrl은 이름을 인코딩한다', () => {
  assert.equal(oppadu.webUrl('x&calc'), 'https://www.oppadu.com/tools/design-systems-site/brand/x%26calc.html')
  assert.equal(oppadu.fileUrl('a b'), 'https://www.oppadu.com/tools/design-systems-site/data/detail/a%20b.json')
})

test('bundledText는 동봉 파일이 없으면 null이다 — 재배포 허가 전에는 번들이 없다', () => {
  assert.equal(oppadu.bundledText('kakao'), null)
  assert.equal(oppadu.bundledText('../escape'), null)
})

// 재배포 허가(info@oppadu.com)가 오기 전에는 사용자에게 노출되지 않아야 한다.
// 등록하는 커밋이 이 단언을 뒤집는다 — 그때 번들·고지·README를 함께 채운다.
test('oppadu 프로바이더는 아직 PROVIDERS에 등록되지 않았다', () => {
  assert.equal(PROVIDERS.some((p) => p.id === 'oppadu'), false)
  assert.equal(oppadu.redistributable, false)
})
