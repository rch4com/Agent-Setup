import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadItems } from '../lib/catalog.mjs'

test('loadItems는 9개 항목을 id순으로 로드한다', async () => {
  const items = await loadItems()
  assert.equal(items.length, 9)
  const ids = items.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  assert.ok(ids.includes('mcp.notion'))
  assert.ok(ids.includes('plugin.superpowers'))
  assert.ok(ids.includes('plugin.mattpocock-skills'))
  assert.ok(ids.includes('skill.gstack'))
})

test('모든 항목은 카테고리와 스코프가 유효하다', async () => {
  for (const item of await loadItems()) {
    assert.ok(['plugin', 'mcp', 'skill'].includes(item.category))
    assert.ok(['project', 'user'].includes(item.scope))
  }
})
