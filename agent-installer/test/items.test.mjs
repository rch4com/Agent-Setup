import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadItems } from '../lib/catalog.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { GROUP_ORDER } from '../lib/tui/rows.mjs'
import { LABEL_WIDTH, width } from '../lib/tui/render.mjs'
import { categoryLabel } from '../lib/design-md/flow.mjs'
import EN from '../lib/i18n/catalog/en.mjs'

test('loadItems는 20개 항목을 id순으로 로드한다', async () => {
  const items = await loadItems()
  assert.equal(items.length, 20)
  const ids = items.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  assert.ok(ids.includes('config.gitmessage.en'))
  assert.ok(ids.includes('config.gitmessage.ko'))
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

// 그룹은 화면의 소분류 헤더로 나가므로, 오타 하나가 헤더를 raw id(`__tokne`)로
// 찍는다. 표시 순서를 정하는 GROUP_ORDER와 실제 값이 갈리는 것도 여기서 잡는다.
test('모든 항목의 성격 그룹은 GROUP_ORDER에 있고 번역 키가 있다', async () => {
  const t = createT('en')
  for (const item of await loadItems()) {
    assert.ok(item.group, `${item.id}: 성격 그룹이 없다`)
    assert.ok(GROUP_ORDER.includes(item.group), `${item.id}: 알 수 없는 그룹 '${item.group}'`)
    assert.notEqual(categoryLabel(t, item.group), item.group, `${item.id}: 그룹 라벨이 번역되지 않는다`)
  }
})

test('모든 항목은 카테고리와 스코프가 유효하다', async () => {
  for (const item of await loadItems()) {
    assert.ok(['plugin', 'mcp', 'skill', 'config'].includes(item.category))
    assert.ok(['project', 'user'].includes(item.scope))
  }
})

// 라벨 자리는 LABEL_WIDTH칸이다 — 넘치면 목록에서 조용히 잘린다. 하필 잘리는
// 자리가 항목을 가르는 꼬리표일 수 있어(…(Englis…) 눈으로만 보면 놓친다.
test('모든 항목의 라벨이 LABEL_WIDTH 안에 든다', async () => {
  for (const item of await loadItems()) {
    assert.ok(width(item.label) <= LABEL_WIDTH, `${item.id}: 라벨 폭 ${width(item.label)} > ${LABEL_WIDTH} — "${item.label}"`)
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

// 상류 지원 현황을 2026-08-02에 1차 자료로 검증해 사유에 반영했다. 일괄
// "Claude 전용" 사유로 되돌아가면 상류가 실제로 지원하는 CLI에 거짓 정보가
// 나간다 — 검증된 판정을 여기에 고정한다.
test('검증된 항목은 CLI별로 정확한 미배선 사유를 갖는다', async () => {
  const items = await loadItems()
  const why = (id, cli) => items.find((i) => i.id === id).unsupported[cli].key
  // superpowers: 상류가 하니스별 설치로 지원하는 CLI / 경로 없는 CLI
  assert.equal(why('plugin.superpowers', 'codex'), 'item.unsupported.superpowersSeparate')
  assert.equal(why('plugin.superpowers', 'kiro'), 'item.unsupported.upstreamNone')
  // bkit: Codex·Gemini는 별도 배포판
  assert.equal(why('plugin.bkit', 'codex'), 'item.unsupported.bkitPort')
  assert.equal(why('plugin.bkit', 'gemini'), 'item.unsupported.bkitPort')
  assert.equal(why('plugin.bkit', 'opencode'), 'item.unsupported.upstreamNone')
  // impeccable: 상류가 지원하는 CLI는 Junction 파괴가 미배선 사유
  assert.equal(why('plugin.impeccable', 'grok'), 'item.unsupported.impeccableJunction')
  assert.equal(why('plugin.impeccable', 'kilo'), 'item.unsupported.upstreamNone')
  // gstack: setup --host 대상만 상류 지원
  assert.equal(why('skill.gstack', 'codex'), 'item.unsupported.gstackHost')
  assert.equal(why('skill.gstack', 'gemini'), 'item.unsupported.upstreamNone')
  // GSD: 런타임 플래그 지원 + gemini는 Antigravity 승계
  assert.equal(why('skill.gsd', 'codex'), 'item.unsupported.gsdFlag')
  assert.equal(why('skill.gsd', 'gemini'), 'item.unsupported.gsdGemini')
  assert.equal(why('skill.gsd', 'kiro'), 'item.unsupported.upstreamNone')
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
