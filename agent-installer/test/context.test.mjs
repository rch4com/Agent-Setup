import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { symlinkSync, mkdirSync, mkdtempSync } from 'node:fs'
import { findRepoRoot, repoPath, repoPathStrict } from '../lib/context.mjs'
import { makeTempRepo } from './helpers.mjs'

test('findRepoRoot는 저장소 루트를 반환한다', () => {
  const repo = makeTempRepo()
  assert.equal(findRepoRoot(repo).toLowerCase(), repo.toLowerCase())
})

test('findRepoRoot는 git 저장소 밖이면 throw한다', () => {
  assert.throws(() => findRepoRoot(tmpdir()), /git/i)
})

// LocalizedError의 .message는 언제나 영어다 — 이 파일은 함수를 직접 불러
// raw 오류를 잡으므로 { env: KO }로는 로케일을 바꿀 수 없다. 지역화된
// 재렌더는 install.mjs의 catch에서만 일어난다.
test('repoPath는 루트 밖 경로를 거부한다', () => {
  const repo = makeTempRepo()
  assert.throws(() => repoPath(repo, '../escape.txt'), /repository/)
  assert.equal(repoPath(repo, '.mcp.json'), join(repo, '.mcp.json'))
})

test('repoPathStrict: 저장소 안 경로는 통과한다', () => {
  const root = makeTempRepo()
  assert.equal(repoPathStrict(root, 'a/b/c'), join(root, 'a', 'b', 'c'))
})

test('repoPathStrict: 저장소 밖 경로는 거부한다', () => {
  const root = makeTempRepo()
  assert.throws(() => repoPathStrict(root, '../escape'), /Cannot write outside/)
})

test('repoPathStrict: 링크를 통한 이탈을 거부한다', () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  mkdirSync(join(outside, 'skills'), { recursive: true })
  // <root>/.evil -> <tmp>/outside : 어휘적으로는 저장소 안이지만 실제로는 밖이다
  symlinkSync(outside, join(root, '.evil'), 'junction')

  assert.doesNotThrow(() => repoPath(root, '.evil/skills')) // 기존 함수는 통과시킨다
  assert.throws(() => repoPathStrict(root, '.evil/skills'), /external link/)
})

test('repoPathStrict: 아직 없는 하위 경로는 조상 기준으로 검사한다', () => {
  const root = makeTempRepo()
  assert.equal(
    repoPathStrict(root, 'not/created/yet.txt'),
    join(root, 'not', 'created', 'yet.txt'),
  )
})

test('repoPathStrict: 경로 확인에 실패하면 진단 가능한 오류를 던진다', () => {
  const missingRoot = join(makeTempRepo(), 'never-created')
  assert.throws(
    () => repoPathStrict(missingRoot, 'a.txt'),
    (err) => {
      assert.match(err.message, /Cannot resolve path/)
      // 실패한 것은 root다 — 멀쩡한 조상 경로가 아니라 이 경로가 지목되어야 한다.
      assert.ok(
        err.message.includes('never-created'),
        `실패한 경로가 메시지에 없다: ${err.message}`,
      )
      return true
    },
  )
})
