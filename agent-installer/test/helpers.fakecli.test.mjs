import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeFakeClis } from './helpers.mjs'
import { makeExec } from '../lib/catalog.mjs'
import { onPath } from '../lib/probe.mjs'

test('가짜 CLI는 PATH에서 찾히고, 응답을 돌려주고, 호출을 기록한다', async () => {
  const fake = makeFakeClis(['claude', 'agy'], { 'claude plugin list --json': { out: '[]' }, 'agy mcp list': { out: 'x', code: 3 } })
  assert.equal(onPath('claude', { env: fake.env }), true)
  assert.equal(onPath('codex', { env: fake.env }), false)
  const saved = { ...process.env }
  Object.assign(process.env, fake.env)
  try {
    const exec = makeExec(false)
    assert.deepEqual(await exec('claude', ['plugin', 'list', '--json']), { ok: true, output: '[]' })
    assert.equal((await exec('agy', ['mcp', 'list'])).ok, false)
    await exec('claude', ['mcp', 'add', '-s', 'project', 'n', '--', 'npx', '-y', 'a b'])
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
  assert.deepEqual(fake.calls(), ['claude plugin list --json', 'agy mcp list', 'claude mcp add -s project n -- npx -y a b'])
})
