import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope, normalizeStep, runSteps } from '../lib/recipe.mjs'

const P = (argv) => ({ install: [argv], uninstall: [['x', 'remove']] })

function sample(extra = {}) {
  return defineRecipe({
    id: 'plugin.sample', category: 'plugin', label: 'Sample', group: '__flow',
    recipes: {
      claude: { project: P(['claude', 'plugin', 'install', 's', '--scope', 'project']), user: P(['claude', 'plugin', 'install', 's', '--scope', 'user']) },
      codex: { user: { install: [{ argv: ['codex', 'plugin', 'marketplace', 'add', 'o/r'], tolerateFail: true }, ['codex', 'plugin', 'add', 's@s']], uninstall: [['codex', 'plugin', 'remove', 's@s']] } },
    },
    detect: { claude: async () => false, codex: async () => false },
    reasons: { opencode: 'item.unsupported.upstreamNone', antigravity: 'item.unsupported.upstreamNone' },
    ...extra,
  })
}

// has: PATH에 있는 CLI 목록
function probe({ has = ['claude', 'codex', 'opencode', 'antigravity'] } = {}) {
  return { has: (c) => has.includes(c) }
}

test('defineRecipe는 모르는 CLI·범위·단계와 빠진 detect를 거부한다', () => {
  assert.throws(() => sample({ recipes: { gemini: { project: P(['g']) } }, detect: { gemini: async () => false } }), /unknown CLI gemini/)
  assert.throws(() => sample({ recipes: { claude: { global: P(['c']) } } }), /unknown scope global/)
  assert.throws(() => sample({ recipes: { claude: { project: { install: [[1]], uninstall: [] } } } }), /bad step/)
  assert.throws(() => sample({ detect: { claude: async () => false } }), /detect\.codex missing/)
})

test('bindScope: 범위별 supports와 자동 사유', () => {
  const project = bindScope(sample(), 'project')
  assert.deepEqual(project.supports, ['claude'])
  assert.equal(project.unsupported.codex.key, 'item.unsupported.userOnly')
  assert.equal(project.unsupported.opencode.key, 'item.unsupported.upstreamNone')
  const user = bindScope(sample(), 'user')
  assert.deepEqual(user.supports, ['claude', 'codex'])
  assert.equal(user.scope, 'user')
})

test('bindScope: 사유도 레시피도 없는 CLI는 로드 오류다', () => {
  const def = sample({ reasons: { opencode: 'item.unsupported.upstreamNone' } })
  assert.throws(() => bindScope(def, 'project'), (err) => err.key === 'error.itemReasonMissing' && err.params.cli === 'antigravity')
})

test('bindScope: 그 범위 레시피가 없으면 항목이 빠진다(null)', () => {
  const def = defineRecipe({
    id: 'skill.x', category: 'skill', label: 'X',
    recipes: { shared: { project: P(['npx', 'skills', 'add']) } },
    detect: { shared: async () => false },
  })
  assert.equal(bindScope(def, 'user'), null)
  assert.deepEqual(bindScope(def, 'project').supports, ['claude', 'codex', 'opencode', 'antigravity'])
})

test('detect: PATH에 없는 CLI는 excluded, 조회 실패는 failed, 나머지로 상태를 정한다', async () => {
  const def = sample({ detect: { claude: async () => true, codex: async () => { throw new Error('login') } } })
  const user = bindScope(def, 'user')
  const r = await user.detect({ probe: probe() })
  assert.equal(r.status, 'installed', '읽힌 CLI 전부(claude)에 있다')
  assert.deepEqual(r.failed, ['codex'])
  assert.equal(r.detail.key, 'item.probeFailed')
  const none = await user.detect({ probe: probe({ has: ['codex'] }) })
  assert.deepEqual(none.excluded, ['claude'])
})

test('steps: install은 빠진 CLI만, 실패한 조회는 건너뛴다; uninstall은 있는 CLI만', async () => {
  const user = bindScope(sample({ detect: { claude: async () => true, codex: async () => false } }), 'user')
  const state = await user.detect({ probe: probe() })
  assert.equal(state.status, 'partial')
  assert.deepEqual(user.steps('install', state).map((s) => s.argv.join(' ')), [
    'codex plugin marketplace add o/r', 'codex plugin add s@s',
  ])
  assert.deepEqual(user.steps('complete', state).map((s) => s.cli), ['codex', 'codex'])
  assert.deepEqual(user.steps('uninstall', state).map((s) => s.argv.join(' ')), ['x remove'])
  assert.deepEqual(user.steps('install', { ...state, present: [], failed: ['codex'] }).map((s) => s.cli), ['claude'])
})

test('runSteps: tolerateFail은 넘어가고, 실패한 CLI만 멈추고 다음 CLI는 계속한다', async () => {
  const ran = []
  const exec = async (cmd, args) => {
    const line = [cmd, ...args].join(' ')
    ran.push(line)
    return { ok: !line.includes('fail'), output: 'boom\nlast line' }
  }
  const steps = [
    normalizeStep({ argv: ['codex', 'marketplace', 'fail'], tolerateFail: true }, 'codex'),
    normalizeStep(['codex', 'add', 'ok'], 'codex'),
    normalizeStep(['claude', 'install', 'fail'], 'claude'),
    normalizeStep(['claude', 'never'], 'claude'),
    normalizeStep(['agy', 'install', 'ok'], 'antigravity'),
  ]
  await assert.rejects(() => runSteps(steps, { root: '/r', exec }), (err) => {
    assert.equal(err.key, 'error.stepsFailed')
    assert.match(err.params.details, /Claude Code: claude install fail/)
    assert.doesNotMatch(err.params.details, /codex/)
    return true
  })
  assert.deepEqual(ran, ['codex marketplace fail', 'codex add ok', 'claude install fail', 'agy install ok'])
})

test('runSteps: 참아 준 실패는 같은 CLI의 뒤 단계가 실패할 때 함께 보고한다', async () => {
  const exec = async (cmd, args) => ({ ok: false, output: [cmd, ...args].join(' ') })
  const steps = [
    normalizeStep({ argv: ['codex', 'marketplace', 'add'], tolerateFail: true }, 'codex'),
    normalizeStep(['codex', 'plugin', 'add'], 'codex'),
  ]
  await assert.rejects(() => runSteps(steps, { root: '/r', exec }), (err) => {
    assert.match(err.params.details, /codex marketplace add[\s\S]*codex plugin add/)
    return true
  })
})

test('runSteps: undo는 그 단계가 실패했을 때만 돈다; fn 단계는 ctx를 받는다', async () => {
  let undone = 0
  let seen = null
  const exec = async () => ({ ok: false, output: '' })
  const steps = [
    normalizeStep({ argv: ['bash', './setup'], cwd: 'dir', undo: () => { undone++ } }, 'claude'),
    normalizeStep({ fn: (ctx) => { seen = ctx.root }, describe: 'touch' }, 'codex'),
  ]
  await assert.rejects(() => runSteps(steps, { root: '/r', exec }))
  assert.equal(undone, 1)
  assert.equal(seen, '/r')
})

test('runSteps: cwd는 저장소 루트 기준이다', async () => {
  const cwds = []
  await runSteps([normalizeStep({ argv: ['bash', './setup'], cwd: 'a/b' }, 'claude'), normalizeStep(['x'], 'claude')], {
    root: '/r', exec: async (cmd, args, opts) => { cwds.push(opts.cwd.replace(/\\/g, '/')); return { ok: true, output: '' } },
  })
  assert.match(cwds[0], /\/r\/a\/b$/)
  assert.match(cwds[1], /\/r$/)
})

test('runSteps: dryRun에서 fn 단계는 실행하지 않고 describe를 로그로 남긴다', async () => {
  const logs = []
  let ran = false
  await runSteps([normalizeStep({ fn: () => { ran = true }, describe: 'clean up' }, 'shared')], { root: '/r', exec: async () => ({ ok: true }), dryRun: true, log: (m) => logs.push(m) })
  assert.equal(ran, false)
  assert.match(logs.join('\n'), /clean up/)
})
