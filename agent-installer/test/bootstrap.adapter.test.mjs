import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync, lstatSync, mkdirSync, writeFileSync, symlinkSync, readFileSync, mkdtempSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { configureAdapter } from '../lib/bootstrap/adapter.mjs'

const ENTRY = { tool: 'Claude Code', path: '.claude/skills' }
const ctx = (cap, over = {}) => ({ dryRun: false, skillMode: 'auto', log: cap.log, ...over })

// .agents/skills에 스킬 하나를 둔 저장소를 만든다.
function repoWithSkills() {
  const root = makeTempRepo()
  mkdirSync(join(root, '.agents', 'skills', 'demo'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'demo', 'SKILL.md'), '# demo\n')
  mkdirSync(join(root, '.claude'), { recursive: true })
  return root
}

test('링크를 만들고 원본이 보인다', () => {
  const root = repoWithSkills()
  const result = configureAdapter(root, ENTRY, ctx(makeCapture()))

  assert.ok(['link', 'copy'].includes(result.action))
  assert.equal(
    readFileSync(join(root, '.claude', 'skills', 'demo', 'SKILL.md'), 'utf8'),
    '# demo\n',
  )
})

// auto 모드는 링크 실패 시 복사로 떨어지므로, 링크 확인 경로를 보려면 link로 고정한다.
// (복사본 재동기화 경로는 아래 별도 테스트가 덮는다.)
test('이미 올바른 링크면 확인만 한다', () => {
  const root = repoWithSkills()
  const first = configureAdapter(root, ENTRY, ctx(makeCapture(), { skillMode: 'link' }))
  assert.equal(first.action, 'link')
  assert.equal(first.ok, true, '이 환경에서 링크를 만들 수 있어야 한다')

  const cap = makeCapture()
  const result = configureAdapter(root, ENTRY, ctx(cap, { skillMode: 'link' }))

  assert.equal(result.action, 'skip')
  assert.match(cap.text(), /링크 확인/)
})

test('다른 곳을 가리키는 링크는 보존하고 경고한다', () => {
  const root = repoWithSkills()
  const elsewhere = mkdtempSync(join(tmpdir(), 'elsewhere-'))
  symlinkSync(elsewhere, join(root, '.claude', 'skills'), 'junction')

  const cap = makeCapture()
  const result = configureAdapter(root, ENTRY, ctx(cap))

  assert.equal(result.action, 'warn')
  assert.ok(lstatSync(join(root, '.claude', 'skills')).isSymbolicLink(), '링크가 남아야 한다')
  assert.match(cap.text(), /다른 위치/)
})

test('마커 없는 디렉터리는 보존하고 경고한다', () => {
  const root = repoWithSkills()
  mkdirSync(join(root, '.claude', 'skills'), { recursive: true })
  writeFileSync(join(root, '.claude', 'skills', '내것.md'), '건드리지 마\n')

  const cap = makeCapture()
  const result = configureAdapter(root, ENTRY, ctx(cap))

  assert.equal(result.action, 'warn')
  assert.equal(readFileSync(join(root, '.claude', 'skills', '내것.md'), 'utf8'), '건드리지 마\n')
  assert.match(cap.text(), /관리 대상이 아닙니다/)
})

test('마커가 있는 복제본은 재동기화한다', () => {
  const root = repoWithSkills()
  const target = join(root, '.claude', 'skills')
  mkdirSync(target, { recursive: true })
  writeFileSync(join(target, '.agent-kit-managed-copy'), '')
  writeFileSync(join(target, '오래된.md'), '옛날 내용\n')

  const result = configureAdapter(root, ENTRY, ctx(makeCapture(), { skillMode: 'copy' }))

  assert.equal(result.action, 'copy')
  assert.equal(existsSync(join(target, '오래된.md')), false, '옛 복제본은 정리된다')
  assert.ok(existsSync(join(target, 'demo', 'SKILL.md')))
})

test('copy 모드는 복제본과 마커를 만든다', () => {
  const root = repoWithSkills()
  const result = configureAdapter(root, ENTRY, ctx(makeCapture(), { skillMode: 'copy' }))

  assert.equal(result.action, 'copy')
  assert.equal(lstatSync(join(root, '.claude', 'skills')).isSymbolicLink(), false)
  assert.ok(existsSync(join(root, '.claude', 'skills', '.agent-kit-managed-copy')))
  assert.ok(existsSync(join(root, '.claude', 'skills', 'demo', 'SKILL.md')))
})

test('dry-run은 아무것도 만들지 않는다', () => {
  const root = repoWithSkills()
  const cap = makeCapture()
  configureAdapter(root, ENTRY, ctx(cap, { dryRun: true }))

  assert.equal(existsSync(join(root, '.claude', 'skills')), false)
  assert.match(cap.text(), /어댑터 생성 예정/)
})

// 함정 회귀 가드: target이 저장소 밖을 가리키는 링크면 repoPathStrict가 예외를
// 던질 수 있다. 하지만 이 상태는 "보존 + 경고"가 정답이므로 예외가 아니라
// warn을 돌려줘야 한다.
test('저장소 밖을 가리키는 링크도 예외 없이 경고로 보존한다', () => {
  const root = repoWithSkills()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  symlinkSync(outside, join(root, '.claude', 'skills'), 'junction')

  const cap = makeCapture()
  let result
  assert.doesNotThrow(() => {
    result = configureAdapter(root, ENTRY, ctx(cap))
  })

  assert.equal(result.action, 'warn')
  assert.ok(lstatSync(join(root, '.claude', 'skills')).isSymbolicLink(), '링크가 남아야 한다')
})
