import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findRepoRoot, repoPath } from '../lib/context.mjs'
import { makeTempRepo } from './helpers.mjs'

test('findRepoRoot는 저장소 루트를 반환한다', () => {
  const repo = makeTempRepo()
  assert.equal(findRepoRoot(repo).toLowerCase(), repo.toLowerCase())
})

test('findRepoRoot는 git 저장소 밖이면 throw한다', () => {
  assert.throws(() => findRepoRoot(tmpdir()), /git/i)
})

test('repoPath는 루트 밖 경로를 거부한다', () => {
  const repo = makeTempRepo()
  assert.throws(() => repoPath(repo, '../escape.txt'), /저장소/)
  assert.equal(repoPath(repo, '.mcp.json'), join(repo, '.mcp.json'))
})
