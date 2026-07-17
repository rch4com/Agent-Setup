import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeFetch, makeCapture, recordingOpener } from './helpers.mjs'
import { runDesign } from '../lib/design-md/flow.mjs'
import { makeOpener, openPreview } from '../lib/design-md/open.mjs'
import { awesomeDesignMd } from '../lib/design-md/providers/awesome-design-md.mjs'

// 번들 catalog.json(실제 74개)을 쓰되 네트워크는 가짜 fetch로 대체한다.
const fileFetch = (body) => makeFetch([{ match: '/DESIGN.md', body }])

test('--list는 카탈로그를 상태와 함께 출력', async () => {
  const cap = makeCapture()
  await runDesign(makeTempRepo(), { list: true, log: cap.log, fetchImpl: fileFetch('x') })
  assert.match(cap.text(), /stripe — Stripe/)
  assert.match(cap.text(), /미설치/)
})

test('--set 설치 후 --set "" 로 제거 (visible=전체)', async () => {
  const root = makeTempRepo()
  await runDesign(root, { set: 'stripe', log() {}, fetchImpl: fileFetch('# S') })
  assert.ok(existsSync(join(root, 'design-md', 'stripe', 'DESIGN.md')))
  await runDesign(root, { set: '', log() {}, fetchImpl: fileFetch('# S') })
  assert.equal(existsSync(join(root, 'design-md', 'stripe')), false)
})

test('--set 알 수 없는 항목은 예외', async () => {
  await assert.rejects(
    runDesign(makeTempRepo(), { set: 'does-not-exist', fetchImpl: fileFetch('x'), log() {} }),
    /알 수 없는 항목/,
  )
})

test('--preview는 webUrl을 opener로 연다', async () => {
  const opener = recordingOpener()
  await runDesign(makeTempRepo(), { preview: 'stripe,apple', opener, log() {}, fetchImpl: fileFetch('x') })
  assert.deepEqual(opener.targets, [
    'https://getdesign.md/stripe/design-md',
    'https://getdesign.md/apple/design-md',
  ])
})

test('--preview 알 수 없는 이름은 예외 없이 안내', async () => {
  const opener = recordingOpener()
  const cap = makeCapture()
  await runDesign(makeTempRepo(), { preview: 'stripe,zzz', opener, log: cap.log, fetchImpl: fileFetch('x') })
  assert.deepEqual(opener.targets, ['https://getdesign.md/stripe/design-md'])
  assert.match(cap.text(), /알 수 없는 항목: zzz/)
})

test('sync=installed는 설치본을 재다운로드한다', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  await runDesign(root, { set: 'stripe', fetchImpl: fileFetch('# v1'), log() {} })
  await runDesign(root, { sync: 'installed', fetchImpl: fileFetch('# v2'), log: cap.log })
  assert.match(cap.text(), /업데이트 Stripe/)
  assert.equal(readFileSync(join(root, 'design-md', 'stripe', 'DESIGN.md'), 'utf8'), '# v2')
})

test('sync=stale은 변경된 설치본을 감지', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  await runDesign(root, { set: 'stripe', fetchImpl: fileFetch('# local'), log() {} })
  await runDesign(root, { sync: 'stale', fetchImpl: fileFetch('# remote'), log: cap.log })
  assert.match(cap.text(), /오래된 항목 1개: stripe/)
})

test('sync=stale은 동일하면 최신으로 보고', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  // 기본 설치는 번들 콘텐츠를 쓰므로, 원격도 같은 번들 콘텐츠면 최신이어야 한다.
  const bundled = awesomeDesignMd.bundledText('stripe')
  await runDesign(root, { set: 'stripe', fetchImpl: fileFetch(bundled), log() {} })
  await runDesign(root, { sync: 'stale', fetchImpl: fileFetch(bundled), log: cap.log })
  assert.match(cap.text(), /최신입니다/)
})

test('sync=catalog dry-run은 저장 없이 개수만 리포트', async () => {
  const cap = makeCapture()
  const fetchImpl = makeFetch([
    { match: 'README.md', body: '## Collection\n### C\n- [**Stripe**](https://getdesign.md/stripe/design-md) - d\n' },
    { match: 'git/trees', body: JSON.stringify({ tree: [] }) },
  ])
  await runDesign(makeTempRepo(), { sync: 'catalog', dryRun: true, fetchImpl, log: cap.log })
  assert.match(cap.text(), /갱신 예정/)
})

test('makeOpener dry-run은 실행 없이 리포트', () => {
  const cap = makeCapture()
  const opener = makeOpener(true, cap.log)
  assert.deepEqual(opener('https://example.com'), { ok: true })
  assert.match(cap.text(), /\[dry-run\] open https:\/\/example\.com/)
})

test('openPreview: webUrl 없으면 안내하고 실패', () => {
  const cap = makeCapture()
  const r = openPreview(() => ({ ok: true }), { label: 'X', webUrl: null }, cap.log)
  assert.equal(r.ok, false)
  assert.match(cap.text(), /미리보기 URL/)
})
