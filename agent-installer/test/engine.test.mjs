import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { planChanges, apply } from '../lib/engine.mjs'
import { defineMcp } from '../lib/catalog.mjs'
import { makeTempRepo, makeCapture } from './helpers.mjs'

function fake(id, status) {
  return { item: { id, label: id }, status }
}

test('planChanges: absent+체크=install, installed+해제=uninstall', () => {
  const states = [fake('a', 'absent'), fake('b', 'installed'), fake('c', 'installed')]
  const changes = planChanges(states, new Set(['a', 'c']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['a', 'install'], ['b', 'uninstall']],
  )
})

test('planChanges: partial+체크 유지=complete, partial+해제=uninstall', () => {
  const states = [fake('p1', 'partial'), fake('p2', 'partial')]
  const changes = planChanges(states, new Set(['p1']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['p1', 'complete'], ['p2', 'uninstall']],
  )
})

test('planChanges: 변경 없으면 빈 배열', () => {
  const states = [fake('a', 'installed'), fake('b', 'absent')]
  assert.deepEqual(planChanges(states, new Set(['a'])), [])
})

// 파일을 직접 쓰는 항목은 exec를 거치지 않는다. log를 넘기지 않으면 dry-run이
// "✔ 설치"라고만 찍고 무엇이 바뀔지는 하나도 알려 주지 않는다.
test('apply dry-run: 파일을 쓰는 항목도 예정 동작을 보고하고 아무것도 만들지 않는다', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const item = defineMcp({
    id: 'mcp.demo', label: 'Demo MCP',
    server: { kind: 'http', url: 'https://example.com/mcp' },
  })

  const results = await apply(root, [{ item, action: 'install' }], { dryRun: true, log: cap.log })

  assert.equal(results[0].ok, true)
  assert.match(cap.text(), /\[dry-run\] Claude Code 설정에 demo 등록/)
  assert.match(cap.text(), /\[dry-run\] VS Code Copilot 설정에 demo 등록/)
  assert.equal(existsSync(join(root, '.mcp.json')), false, 'dry-run은 파일을 만들지 않는다')
})
