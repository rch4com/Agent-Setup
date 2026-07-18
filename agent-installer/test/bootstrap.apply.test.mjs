import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { ensureDirs, ensureFiles } from '../lib/bootstrap/apply.mjs'

const ctx = (cap, dryRun = false) => ({ dryRun, log: cap.log })

test('ensureDirs: 없는 디렉터리를 만든다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const results = ensureDirs(root, ['.codex', '.kiro/settings'], ctx(cap))

  assert.ok(statSync(join(root, '.codex')).isDirectory())
  assert.ok(statSync(join(root, '.kiro', 'settings')).isDirectory())
  assert.deepEqual(results.map((r) => r.action), ['create', 'create'])
})

test('ensureDirs: 이미 있으면 건너뛴다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.codex'))
  const results = ensureDirs(root, ['.codex'], ctx(makeCapture()))
  assert.equal(results[0].action, 'skip')
})

test('ensureFiles: 없는 파일을 템플릿으로 만든다', () => {
  const root = makeTempRepo()
  const results = ensureFiles(root, [{ path: 'AGENTS.md', template: '# 제목' }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# 제목\n')
  assert.equal(results[0].action, 'create')
})

test('ensureFiles: 기존 파일은 내용을 보지 않고 보존한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), '사용자가 쓴 내용\n')
  const results = ensureFiles(root, [{ path: 'AGENTS.md', template: '# 템플릿' }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '사용자가 쓴 내용\n')
  assert.equal(results[0].action, 'keep')
})

// existsSync는 깨진 링크에 false를 반환한다 — 덮어쓰면 사용자 의도를 파괴한다.
test('ensureFiles: 깨진 심볼릭 링크도 존재로 보아 보존한다', () => {
  const root = makeTempRepo()
  symlinkSync(join(root, 'does-not-exist'), join(root, 'kilo.jsonc'))
  const results = ensureFiles(root, [{ path: 'kilo.jsonc', template: '{}' }], ctx(makeCapture()))
  assert.equal(results[0].action, 'keep')
})

test('ensureFiles: 부모 디렉터리를 함께 만든다', () => {
  const root = makeTempRepo()
  ensureFiles(root, [{ path: 'a/b/c.md', template: 'x' }], ctx(makeCapture()))
  assert.ok(existsSync(join(root, 'a', 'b', 'c.md')))
})

test('ensureFiles: LF로 쓰고 끝 개행 1개, BOM 없음', () => {
  const root = makeTempRepo()
  ensureFiles(root, [{ path: 'x.md', template: '\n\n한 줄\r\n두 줄\n\n' }], ctx(makeCapture()))

  const raw = readFileSync(join(root, 'x.md'))
  assert.equal(raw.toString('utf8'), '한 줄\n두 줄\n')
  assert.notEqual(raw[0], 0xef) // BOM 아님
})

test('dry-run은 파일시스템을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  ensureDirs(root, ['.codex'], ctx(cap, true))
  ensureFiles(root, [{ path: 'AGENTS.md', template: 'x' }], ctx(cap, true))

  assert.equal(existsSync(join(root, '.codex')), false)
  assert.equal(existsSync(join(root, 'AGENTS.md')), false)
  assert.match(cap.text(), /디렉터리 생성/)
  assert.match(cap.text(), /파일 생성/)
})

test('저장소 밖 경로는 거부한다', () => {
  const root = makeTempRepo()
  assert.throws(() => ensureDirs(root, ['../escape'], ctx(makeCapture())), /저장소 밖/)
})
