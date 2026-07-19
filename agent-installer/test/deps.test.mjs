import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { withDeps, DEPS_HINT } from '../lib/deps.mjs'
import { makeTempRepo } from './helpers.mjs'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function moduleNotFound() {
  const err = new Error("Cannot find package 'jsonc-parser'")
  err.code = 'ERR_MODULE_NOT_FOUND'
  return err
}

test('withDeps: 성공하면 로더의 값을 그대로 돌려준다', async () => {
  assert.deepEqual(await withDeps(() => ({ ok: 1 })), { ok: 1 })
  assert.deepEqual(await withDeps(async () => ({ ok: 2 })), { ok: 2 })
})

test('withDeps: 모듈이 없으면 설치 방법 안내로 바꾼다', async () => {
  await assert.rejects(() => withDeps(() => { throw moduleNotFound() }), (err) => {
    assert.equal(err.message, DEPS_HINT)
    assert.match(err.message, /npm install --prefix agent-installer/)
    return true
  })
})

// 이걸 놓치면 로드된 모듈 안의 진짜 버그가 "의존성을 설치하세요"로 둔갑해
// 엉뚱한 곳을 찾게 만든다.
test('withDeps: 다른 오류는 그대로 올려보낸다', async () => {
  const boom = new TypeError('x is not a function')
  await assert.rejects(() => withDeps(() => { throw boom }), (err) => {
    assert.equal(err, boom)
    return true
  })
})

// ── 통합: node_modules 없는 트리 ──────────────────────────────────

// 갓 클론한 사용자가 처음 만나는 경로다. 여기서 Node의 원시 메시지가 새면
// 무엇을 해야 하는지 알 수 없다.
test('의존성이 없으면 원시 메시지 대신 설치 방법을 안내한다', () => {
  const bare = mkdtempSync(join(tmpdir(), 'agent-installer-nodeps-'))

  // node_modules와 design-md(번들 74개)는 뺀다 — 앞의 것이 시험 대상이고,
  // 뒤의 것은 --list(에이전트 경로)에 필요 없는 데다 복사가 비싸다.
  cpSync(PKG_ROOT, bare, {
    recursive: true,
    filter: (src) => {
      const rel = relative(PKG_ROOT, src)
      if (rel === '') return true
      const top = rel.split(sep)
      return top[0] !== 'node_modules' && !(top[0] === 'lib' && top[1] === 'design-md')
    },
  })

  const r = spawnSync(process.execPath, [join(bare, 'install.mjs'), '--list'], {
    cwd: makeTempRepo(), encoding: 'utf8', timeout: 30000, input: '',
  })

  assert.notEqual(r.status, null, '시간 초과')
  assert.notEqual(r.status, 0, '의존성이 없는데 성공으로 끝났다')
  assert.match(r.stderr, /npm install --prefix agent-installer/)
  assert.doesNotMatch(r.stderr, /ERR_MODULE_NOT_FOUND|Cannot find package/, 'Node의 원시 메시지가 샜다')
})

// 부트스트랩은 의존성 없이도 완전히 동작해야 한다 — 이 저장소의 핵심 불변식이다.
// isolation 테스트가 정적으로 검사하지만, 실제로 돌려 보는 것과는 다르다.
test('의존성이 없어도 부트스트랩은 끝까지 동작한다', () => {
  const bare = mkdtempSync(join(tmpdir(), 'agent-installer-nodeps-boot-'))
  cpSync(PKG_ROOT, bare, {
    recursive: true,
    filter: (src) => {
      const rel = relative(PKG_ROOT, src)
      if (rel === '') return true
      const top = rel.split(sep)
      return top[0] !== 'node_modules' && !(top[0] === 'lib' && top[1] === 'design-md')
    },
  })

  const root = makeTempRepo()
  const r = spawnSync(process.execPath, [join(bare, 'install.mjs'), 'bootstrap'], {
    cwd: root, encoding: 'utf8', timeout: 30000, input: '',
  })

  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /완료되었습니다/)
  assert.doesNotMatch(r.stderr, /npm install/, '부트스트랩이 의존성을 요구했다')
})
