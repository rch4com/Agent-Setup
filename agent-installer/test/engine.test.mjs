import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planChanges } from '../lib/engine.mjs'

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
