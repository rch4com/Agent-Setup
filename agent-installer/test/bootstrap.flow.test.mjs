import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'

test('매니페스트가 선언한 모든 대상을 만든다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })

  for (const rel of MANIFEST.dirs) {
    assert.ok(existsSync(join(root, rel)), `디렉터리 누락: ${rel}`)
  }
  for (const { path: rel } of MANIFEST.files) {
    assert.ok(existsSync(join(root, rel)), `파일 누락: ${rel}`)
  }
  for (const { path: rel } of MANIFEST.blocks) {
    assert.match(readFileSync(join(root, rel), 'utf8'), /<!-- agent-kit:begin -->/)
  }
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8')
  for (const entry of MANIFEST.ignore) {
    assert.ok(ignore.includes(entry), `.gitignore 누락: ${entry}`)
  }
})

test('두 번 실행해도 두 번째는 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const second = runBootstrap(root, { log() {} })

  const created = second.results.filter((r) => ['create', 'append', 'copy'].includes(r.action))
  assert.deepEqual(created.map((r) => r.path), [], '멱등하지 않다')
  assert.deepEqual(second.failed, [])
})

test('기존 파일을 보존한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), '내가 쓴 지침\n')
  runBootstrap(root, { log() {} })
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '내가 쓴 지침\n')
})

test('dry-run은 파일시스템을 전혀 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  runBootstrap(root, { dryRun: true, log: cap.log })

  for (const rel of [...MANIFEST.dirs, ...MANIFEST.files.map((f) => f.path)]) {
    assert.equal(existsSync(join(root, rel)), false, `dry-run이 만들었다: ${rel}`)
  }
  assert.match(cap.text(), /\[agent-setup\]/)
})

test('출력에 저장소 루트와 완료 안내가 있다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  runBootstrap(root, { log: cap.log })

  assert.match(cap.text(), /저장소 루트/)
  assert.match(cap.text(), /글로벌 설정 경로는 읽거나 수정하지 않습니다/)
  assert.match(cap.text(), /완료되었습니다/)
})

// 저장소 밖 경로는 repoPathStrict가 던지므로 어느 OS에서도 확실히 실패한다.
// (없는 원본으로 링크를 만들면 POSIX는 dangling symlink로 성공해 버려 테스트가 흔들린다.)
test('실패는 격리되어 나머지 진행을 막지 않는다', () => {
  const root = makeTempRepo()
  const manifest = { ...MANIFEST, adapters: [{ tool: '실패용', path: '../escape' }] }
  const { results, failed } = runBootstrap(root, { log() {}, manifest })

  assert.equal(failed.length, 1, '어댑터 하나만 실패해야 한다')
  assert.match(failed[0].message, /저장소 밖/)
  assert.ok(results.some((r) => r.action === 'create'), '파일 생성은 계속되어야 한다')
  // .gitignore는 어댑터 뒤에 실행된다 — 실패 이후 단계까지 진행됐다는 증거다.
  assert.ok(existsSync(join(root, '.gitignore')), '실패 이후 단계도 실행되어야 한다')
})

test('실패가 있으면 failed에 모인다', () => {
  const root = makeTempRepo()
  const { failed } = runBootstrap(root, { log() {} })
  assert.deepEqual(failed, [], '정상 실행에는 실패가 없어야 한다')
})
