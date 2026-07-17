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
