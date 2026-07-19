import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, runInstaller } from './helpers.mjs'

function noBootstrapFilesCreated(root) {
  return !existsSync(join(root, 'AGENTS.md')) &&
    !existsSync(join(root, '.claude')) &&
    !existsSync(join(root, '.gitignore'))
}

// Critical 회귀 가드: --help는 사용법만 출력하고 아무 파일도 만들지 않아야 한다.
test('bootstrap --help는 사용법을 출력하고 아무 파일도 만들지 않는다', () => {
  const root = makeTempRepo()
  const result = runInstaller(root, ['bootstrap', '--help'])

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /--skill-mode/)
  assert.ok(noBootstrapFilesCreated(root), '--help가 파일을 만들었다')
})

test('알 수 없는 플래그는 거부된다', () => {
  const root = makeTempRepo()
  const result = runInstaller(root, ['bootstrap', '--totally-unknown'])

  assert.notEqual(result.status, 0, '알 수 없는 플래그가 0으로 종료되면 안 된다')
  assert.ok(noBootstrapFilesCreated(root), '알 수 없는 플래그인데도 파일이 생겼다')
})

test('--skill-mode copy의 값이 알 수 없는 인자로 오해되지 않는다', () => {
  const root = makeTempRepo()
  const result = runInstaller(root, ['bootstrap', '--skill-mode', 'copy', '--dry-run'])

  assert.equal(result.status, 0, result.stderr)
})
