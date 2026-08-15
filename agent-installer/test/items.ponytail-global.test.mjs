import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createItem } from '../lib/items/global.ponytail.mjs'
import { createT } from '../lib/i18n/index.mjs'

// 공통 기구(global-plugin.mjs)의 동작은 items.superpowers-global.test.mjs가
// 깊게 덮는다 — 여기서는 ponytail 좌표가 제대로 꽂혔는지와 opencode 어댑터가
// 빠져 있는지만 본다. 실제 홈은 절대 건드리지 않는다.
function makeHome() {
  return mkdtempSync(join(tmpdir(), 'pt-global-'))
}

function fakeExec() {
  const calls = []
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '))
    return { ok: true, output: '' }
  }
  return { calls, exec }
}

const t = createT('en')
const bins = (...names) => (name) => names.includes(name)

test('install은 ponytail 좌표로 하니스별 명령을 부르고 opencode는 건드리지 않는다', async () => {
  const home = makeHome()
  const { calls, exec } = fakeExec()
  const item = createItem({ home, env: {}, hasBinary: bins('codex', 'gemini', 'copilot', 'opencode') })
  await item.install({ dryRun: false, exec, t })
  assert.deepEqual(calls, [
    'codex plugin marketplace add DietrichGebert/ponytail',
    'codex plugin add ponytail@ponytail',
    'gemini extensions install https://github.com/DietrichGebert/ponytail',
    'copilot plugin marketplace add DietrichGebert/ponytail',
    'copilot plugin install ponytail@ponytail',
  ])
  // opencode 어댑터가 없으니 전역 opencode.json을 만들지 않는다 — 그 자리는
  // 프로젝트 항목(plugin.ponytail)의 것이다.
  assert.equal(existsSync(join(home, '.config', 'opencode', 'opencode.json')), false)
})

test('codex 감지는 ponytail@ 접두사만 잡는다 — superpowers 설치에 속지 않는다', async () => {
  const home = makeHome()
  mkdirSync(join(home, '.codex'), { recursive: true })
  writeFileSync(
    join(home, '.codex', 'config.toml'),
    '[plugins."superpowers@superpowers-marketplace"]\n[plugins."ponytail@ponytail"]\n',
  )
  const item = createItem({ home, env: {}, hasBinary: bins('codex') })
  const r = await item.detect()
  assert.equal(r.status, 'installed')

  const { calls, exec } = fakeExec()
  await item.uninstall({ dryRun: false, exec, t })
  assert.deepEqual(calls, ['codex plugin remove ponytail@ponytail'])
})

test('gemini 확장 디렉터리 이름은 ponytail이다', async () => {
  const home = makeHome()
  mkdirSync(join(home, '.gemini', 'extensions', 'ponytail'), { recursive: true })
  const item = createItem({ home, env: {}, hasBinary: bins('gemini') })
  const r = await item.detect()
  assert.equal(r.status, 'installed')

  const { calls, exec } = fakeExec()
  await item.uninstall({ dryRun: false, exec, t })
  assert.deepEqual(calls, ['gemini extensions uninstall ponytail'])
})

test('supports에 opencode가 없고 사유는 프로젝트 항목을 가리킨다', async () => {
  const item = createItem({ home: makeHome(), env: {}, hasBinary: bins() })
  assert.deepEqual(item.supports, ['codex', 'gemini', 'copilot'])
  assert.equal(item.unsupported.opencode.key, 'item.unsupported.globalProjectItem')
  assert.equal(item.unsupported.opencode.params.item, 'Ponytail')
})
