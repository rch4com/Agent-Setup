import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { updateBlocks, updateFiles } from '../lib/bootstrap/apply.mjs'
import { hashBody } from '../lib/bootstrap/text.mjs'
import { makeCapture, makeTempRepo } from './helpers.mjs'

const OLD = '옛 템플릿\n'
const NEW = '새 템플릿\n'

function runFiles(root, managed, opts = {}) {
  return updateFiles(root, [{ path: 'a.md', template: NEW }], {
    managed, log: makeCapture().log, ...opts,
  })
}

test('해시가 일치하면 새 템플릿으로 교체한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), OLD)
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) })

  assert.equal(r.action, 'update')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), NEW)
  assert.equal(r.hash, hashBody(NEW))
})

test('CRLF로 체크아웃된 파일도 일치로 보고 교체한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), '옛 템플릿\r\n')
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) })
  assert.equal(r.action, 'update')
})

test('해시가 다르면 건드리지 않고 드리프트로 보고한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), '사용자가 고친 내용\n')
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) })

  assert.equal(r.action, 'drift')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), '사용자가 고친 내용\n')
  assert.equal(r.hash, undefined, '드리프트가 해시를 돌려주면 기록이 오염된다')
})

test('기록에 해시가 없으면 출처 불명이라 건드리지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), OLD)
  const [r] = runFiles(root, { 'a.md': null })
  assert.equal(r.action, 'drift')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), OLD)
})

test('파일이 없으면 새로 만든다 — 새 도구 지원이 이 경로로 들어온다', () => {
  const root = makeTempRepo()
  const [r] = runFiles(root, {})
  assert.equal(r.action, 'create')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), NEW)
  assert.equal(r.hash, hashBody(NEW))
})

test('이미 새 템플릿과 같으면 아무것도 하지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), NEW)
  const [r] = runFiles(root, { 'a.md': hashBody(NEW) })
  assert.equal(r.action, 'skip')
  assert.equal(r.hash, hashBody(NEW))
})

test('force는 드리프트까지 덮어쓴다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), '사용자가 고친 내용\n')
  const [r] = runFiles(root, { 'a.md': hashBody(OLD) }, { force: true })
  assert.equal(r.action, 'update')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), NEW)
})

test('dryRun은 보고만 하고 파일을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'a.md'), OLD)
  const cap = makeCapture()
  const [r] = updateFiles(root, [{ path: 'a.md', template: NEW }], {
    managed: { 'a.md': hashBody(OLD) }, dryRun: true, log: cap.log,
  })
  assert.equal(r.action, 'update')
  assert.equal(readFileSync(join(root, 'a.md'), 'utf8'), OLD)
  assert.match(cap.text(), /a\.md/)
})

const BLOCK_OLD = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'
const BLOCK_NEW = '<!-- agent-kit:begin -->\n@AGENTS.md\n@EXTRA.md\n<!-- agent-kit:end -->'

test('블록은 마커 사이만 바뀌고 앞뒤 사용자 본문이 보존된다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), `앞말\n\n${BLOCK_OLD}\n\n뒷말\n`)
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: { 'CLAUDE.md#agent-kit': hashBody('@AGENTS.md\n') }, log: makeCapture().log,
  })

  assert.equal(r.action, 'update')
  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.match(text, /^앞말/)
  assert.match(text, /뒷말/)
  assert.match(text, /@EXTRA\.md/)
})

test('블록 안쪽을 고쳤으면 드리프트로 보고한다', () => {
  const root = makeTempRepo()
  const edited = '<!-- agent-kit:begin -->\n내가 넣은 줄\n<!-- agent-kit:end -->'
  writeFileSync(join(root, 'CLAUDE.md'), `${edited}\n`)
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: { 'CLAUDE.md#agent-kit': hashBody('@AGENTS.md\n') }, log: makeCapture().log,
  })

  assert.equal(r.action, 'drift')
  assert.match(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /내가 넣은 줄/)
})

test('블록 대상 파일이 없으면 블록만으로 만든다', () => {
  const root = makeTempRepo()
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: {}, log: makeCapture().log,
  })
  assert.equal(r.action, 'create')
  assert.ok(existsSync(join(root, 'CLAUDE.md')))
})

test('마커가 없는 기존 파일은 드리프트다 — append는 생성 경로의 일이다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '마커 없는 사용자 파일\n')
  const [r] = updateBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK_NEW }], {
    managed: {}, log: makeCapture().log,
  })
  assert.equal(r.action, 'drift')
  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), '마커 없는 사용자 파일\n')
})
