import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureGitignoreEntries } from '../lib/gitignore.mjs'
import { makeTempRepo } from './helpers.mjs'

test('없는 항목만 추가하고 기존 내용을 보존한다', () => {
  const repo = makeTempRepo()
  writeFileSync(join(repo, '.gitignore'), '*.log\n.claude/skills/gstack\n')
  ensureGitignoreEntries(repo, ['.claude/skills/gstack', '.agents/skills/gstack'])
  const text = readFileSync(join(repo, '.gitignore'), 'utf8')
  assert.match(text, /\*\.log/)
  assert.equal(text.match(/\.claude\/skills\/gstack/g).length, 1)
  assert.match(text, /\.agents\/skills\/gstack/)
})

test('.gitignore가 없으면 생성한다', () => {
  const repo = makeTempRepo()
  ensureGitignoreEntries(repo, ['.claude/skills/gstack'])
  assert.match(readFileSync(join(repo, '.gitignore'), 'utf8'), /gstack/)
})

// 덧붙인 줄만 LF로 섞이면 파일 하나에 두 줄바꿈이 공존해 diff가 지저분해진다.
test('CRLF 파일에는 CRLF로 덧붙인다', () => {
  const repo = makeTempRepo()
  writeFileSync(join(repo, '.gitignore'), 'node_modules\r\n.env\r\n')
  ensureGitignoreEntries(repo, ['.claude/skills', '.kiro/skills'])

  const text = readFileSync(join(repo, '.gitignore'), 'utf8')
  assert.equal(text, 'node_modules\r\n.env\r\n.claude/skills\r\n.kiro/skills\r\n')
  assert.equal(text.split('\n').length - 1, text.split('\r\n').length - 1, '줄바꿈이 섞이면 안 된다')
})

test('LF 파일은 LF를 유지한다', () => {
  const repo = makeTempRepo()
  writeFileSync(join(repo, '.gitignore'), 'node_modules\n')
  ensureGitignoreEntries(repo, ['.claude/skills'])
  assert.equal(readFileSync(join(repo, '.gitignore'), 'utf8'), 'node_modules\n.claude/skills\n')
})

// 두 번째 실행이 같은 항목을 다시 붙이면 파일이 계속 자란다.
test('CRLF 파일에서도 멱등하다', () => {
  const repo = makeTempRepo()
  writeFileSync(join(repo, '.gitignore'), '.env\r\n')
  ensureGitignoreEntries(repo, ['.claude/skills'])
  const after = readFileSync(join(repo, '.gitignore'), 'utf8')
  ensureGitignoreEntries(repo, ['.claude/skills'])
  assert.equal(readFileSync(join(repo, '.gitignore'), 'utf8'), after)
})
