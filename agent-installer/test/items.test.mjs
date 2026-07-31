import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadItems } from '../lib/catalog.mjs'
import { createT } from '../lib/i18n/index.mjs'
import EN from '../lib/i18n/catalog/en.mjs'

test('loadItems는 18개 항목을 id순으로 로드한다', async () => {
  const items = await loadItems()
  assert.equal(items.length, 18)
  const ids = items.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  assert.ok(ids.includes('mcp.notion'))
  assert.ok(ids.includes('mcp.graphify'))
  assert.ok(ids.includes('mcp.headroom'))
  assert.ok(ids.includes('plugin.superpowers'))
  assert.ok(ids.includes('plugin.mattpocock-skills'))
  assert.ok(ids.includes('plugin.ponytail'))
  assert.ok(ids.includes('skill.gstack'))
  assert.ok(ids.includes('skill.caveman'))
  assert.ok(ids.includes('skill.taste'))
})

test('모든 항목은 카테고리와 스코프가 유효하다', async () => {
  for (const item of await loadItems()) {
    assert.ok(['plugin', 'mcp', 'skill'].includes(item.category))
    assert.ok(['project', 'user'].includes(item.scope))
  }
})

test('항목의 note는 카탈로그에 있는 키다', async () => {
  // note를 문자열로 두면 어느 로케일에서도 그 언어로만 나온다.
  const t = createT('en')
  for (const item of await loadItems()) {
    if (!item.note) continue
    assert.ok(Object.hasOwn(EN, item.note), `${item.id}: note 키 '${item.note}'가 카탈로그에 없다`)
    assert.doesNotThrow(() => t(item.note))
  }
})

test('unsupported 사유는 구조화 메시지다', async () => {
  const t = createT('en')
  for (const item of await loadItems()) {
    for (const [cli, why] of Object.entries(item.unsupported ?? {})) {
      assert.equal(typeof why, 'object', `${item.id}/${cli}: 사유가 구조체가 아니다`)
      assert.doesNotThrow(() => t(why.key), `${item.id}/${cli}: 알 수 없는 키 ${why.key}`)
    }
  }
})
