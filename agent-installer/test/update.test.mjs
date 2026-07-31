import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'
import { RECORD_REL, readRecord } from '../lib/bootstrap/record.mjs'
import { runUpdate } from '../lib/update.mjs'
import { makeCapture, makeTempRepo } from './helpers.mjs'

// 템플릿이 개선된 다음 릴리스를 흉내낸다.
function bumpedManifest() {
  return {
    ...MANIFEST,
    files: MANIFEST.files.map((f) =>
      f.path === '.agent-kit/README.md' ? { ...f, template: '새 안내 문서\n' } : f),
  }
}

function commitAll(root) {
  execFileSync('git', ['-C', root, 'add', '-A'])
  execFileSync('git', ['-C', root, '-c', 'user.email=t@e.com', '-c', 'user.name=t',
    'commit', '-q', '-m', 'init'])
}

test('템플릿이 개선되면 손대지 않은 파일이 갱신된다', async () => {
  const root = makeTempRepo()
  const { record } = runBootstrap(root, { log() {} })

  const cap = makeCapture()
  const r = await runUpdate(root, { manifest: bumpedManifest(), log: cap.log })

  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '새 안내 문서\n')
  assert.equal(r.drift.length, 0)
  // 기록의 해시도 새 내용으로 옮겨져야 다음 update가 또 갱신하지 않는다.
  assert.notEqual(readRecord(root).managed['.agent-kit/README.md'],
    record.managed['.agent-kit/README.md'])
})

test('사용자가 고친 파일은 건드리지 않고 드리프트로 보고한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  writeFileSync(join(root, '.agent-kit/README.md'), '팀이 고친 안내\n')

  const cap = makeCapture()
  const r = await runUpdate(root, { manifest: bumpedManifest(), log: cap.log })

  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '팀이 고친 안내\n')
  assert.deepEqual(r.drift.map((d) => d.path), ['.agent-kit/README.md'])
  assert.match(cap.text(), /드리프트|사용자 수정/)
})

test('기록이 없으면 --adopt를 안내하고 아무것도 쓰지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  rmSync(join(root, RECORD_REL))

  await assert.rejects(() => runUpdate(root, { log() {} }), /--adopt/)
})

test('두 번 돌리면 두 번째는 변경이 없다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const m = bumpedManifest()

  await runUpdate(root, { manifest: m, log() {} })
  const after1 = readFileSync(join(root, RECORD_REL), 'utf8')
  const r2 = await runUpdate(root, { manifest: m, log() {} })

  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), after1)
  assert.equal(r2.results.filter((x) => x.action === 'update').length, 0)
})

test('force는 워킹트리가 더러우면 거부한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  // 커밋하지 않은 상태 — 되돌릴 수 없는 덮어쓰기를 막아야 한다.
  await assert.rejects(
    () => runUpdate(root, { force: true, log() {} }),
    /워킹트리|커밋/,
  )
})

test('force는 워킹트리가 깨끗하면 드리프트를 덮어쓴다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  writeFileSync(join(root, '.agent-kit/README.md'), '팀이 고친 안내\n')
  commitAll(root)

  await runUpdate(root, { manifest: bumpedManifest(), force: true, log() {} })
  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '새 안내 문서\n')
})

test('dry-run은 파일도 기록도 바꾸지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const before = readFileSync(join(root, RECORD_REL), 'utf8')

  const cap = makeCapture()
  await runUpdate(root, { manifest: bumpedManifest(), dryRun: true, log: cap.log })

  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), before)
  assert.notEqual(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), '새 안내 문서\n')
  assert.match(cap.text(), /README\.md/)
})

// 회귀 가드: updateBlocks의 드리프트 message는 msg() 구조체다(문자열이 아니다).
// update.mjs가 이를 문자열 삽입 위치에 그대로 꽂으면 "[object Object]"가
// 찍힌다 — toText로 풀지 않으면 조용히 깨지는 자리라 반드시 지켜야 한다.
test('관리 블록이 사라진 파일은 드리프트 메시지를 문자열로 렌더한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  // 마커를 지워 updateBlocks의 "관리 블록 없음" 드리프트 경로를 밟게 한다.
  writeFileSync(join(root, 'CLAUDE.md'), '마커가 사라진 파일\n')

  const cap = makeCapture()
  const r = await runUpdate(root, { log: cap.log })

  assert.deepEqual(r.drift.map((d) => d.path), ['CLAUDE.md'])
  assert.doesNotMatch(cap.text(), /\[object Object\]/)
  assert.match(cap.text(), /관리 블록 없음/)
})
