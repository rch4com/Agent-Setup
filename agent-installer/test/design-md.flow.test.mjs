import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeTempRepo, makeFetch, makeCapture, recordingOpener } from './helpers.mjs'
import { runDesign } from '../lib/design-md/flow.mjs'
import { makeOpener, openPreview, isOpenableTarget } from '../lib/design-md/open.mjs'
import { scanDesignDir, makeDirProvider } from '../lib/design-md/scan.mjs'
import { awesomeDesignMd } from '../lib/design-md/providers/awesome-design-md.mjs'

// 번들 catalog.json(실제 74개)을 쓰되 네트워크는 가짜 fetch로 대체한다.
const fileFetch = (body) => makeFetch([{ match: '/DESIGN.md', body }])
const PID = awesomeDesignMd.id // 'awesome-design-md'
const stripePath = (root) => join(root, 'design-md', PID, 'stripe', 'DESIGN.md')

test('--list는 카탈로그를 상태와 함께 출력', async () => {
  const cap = makeCapture()
  await runDesign(makeTempRepo(), { list: true, log: cap.log, fetchImpl: fileFetch('x') })
  assert.match(cap.text(), /stripe — Stripe/)
  assert.match(cap.text(), /미설치/)
})

test('--set 설치 후 --set "" 로 제거 (visible=전체)', async () => {
  const root = makeTempRepo()
  await runDesign(root, { set: 'stripe', log() {}, fetchImpl: fileFetch('# S') })
  assert.ok(existsSync(stripePath(root)))
  await runDesign(root, { set: '', log() {}, fetchImpl: fileFetch('# S') })
  assert.equal(existsSync(join(root, 'design-md', PID, 'stripe')), false)
})

test('--set 알 수 없는 항목은 예외', async () => {
  await assert.rejects(
    runDesign(makeTempRepo(), { set: 'does-not-exist', fetchImpl: fileFetch('x'), log() {} }),
    /알 수 없는 항목/,
  )
})

test('--set은 provider/name 형식도 설치한다', async () => {
  const root = makeTempRepo()
  await runDesign(root, { set: `${PID}/stripe`, log() {}, fetchImpl: fileFetch('# S') })
  assert.ok(existsSync(stripePath(root)))
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
  assert.equal(readFileSync(stripePath(root), 'utf8'), '# v2')
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

// 미리보기 대상 문자열은 원격 카탈로그 이름을 품는다. OS 오프너에 넘기기 전에
// http(s) URL이거나 실제로 존재하는 경로인지 확인해야 한다.
test('isOpenableTarget: http(s) URL과 존재하는 경로만 통과한다', () => {
  const real = join(mkdtempSync(join(tmpdir(), 'open-')), 'DESIGN.md')
  writeFileSync(real, '# x')

  for (const ok of ['https://getdesign.md/stripe/design-md', 'http://example.com', real]) {
    assert.equal(isOpenableTarget(ok), true, ok)
  }
  for (const bad of [
    '', null, undefined,
    'javascript:alert(1)',            // 스킴만 바꾼 대상
    'file:///C:/Windows/System32',    // http(s)가 아니고 경로로도 존재하지 않는다
    join(real, '..', 'none.md'),      // 존재하지 않는 경로
    'https://example.com\r\nX',       // 제어문자
  ]) {
    assert.equal(isOpenableTarget(bad), false, JSON.stringify(bad))
  }
})

test('makeOpener는 열 수 없는 대상을 실행 없이 거부한다', () => {
  // 통과하면 자식 프로세스가 뜬다 — 거부되므로 아무것도 실행되지 않아야 한다.
  const r = makeOpener(false, () => {})('javascript:alert(1)')
  assert.equal(r.ok, false)
  assert.match(r.output, /열 수 있는 대상이 아닙니다/)
})

test('openPreview: webUrl 없으면 안내하고 실패', () => {
  const cap = makeCapture()
  const r = openPreview(() => ({ ok: true }), { label: 'X', webUrl: null }, cap.log)
  assert.equal(r.ok, false)
  assert.match(cap.text(), /미리보기 URL/)
})

test('openPreview: webUrl이 없으면 previewPath(로컬 파일)로 폴백', () => {
  const opener = recordingOpener()
  const r = openPreview(opener, { label: 'X', webUrl: null, previewPath: 'C:/x/DESIGN.md' }, () => {})
  assert.equal(r.ok, true)
  assert.deepEqual(opener.targets, ['C:/x/DESIGN.md'])
})

test('--preview: 로컬(디렉터리) 항목은 원본 파일을 연다', async () => {
  const src = mkdtempSync(join(tmpdir(), 'design-local-'))
  mkdirSync(join(src, 'faux'))
  writeFileSync(join(src, 'faux', 'DESIGN.md'), '# Faux\n\n사내 디자인')
  const entries = scanDesignDir(src)
  const provider = makeDirProvider({ id: 'local-src', label: 'local-src', dir: src, entries })
  const sources = [{ id: 'local-src', dir: src, label: 'local-src', bundled: false, entries, provider }]
  const opener = recordingOpener()
  await runDesign(makeTempRepo(), { preview: 'faux', opener, log() {}, fetchImpl: fileFetch('x'), sources })
  assert.deepEqual(opener.targets, [join(src, 'faux', 'DESIGN.md')])
})
