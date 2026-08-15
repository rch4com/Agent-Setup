import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadItems } from '../lib/catalog.mjs'
import { assertExclusive } from '../lib/engine.mjs'
import { createT, toText } from '../lib/i18n/index.mjs'
import { GROUP_ORDER } from '../lib/tui/rows.mjs'
import { LABEL_WIDTH, width } from '../lib/tui/render.mjs'
import { categoryLabel } from '../lib/design-md/flow.mjs'
import EN from '../lib/i18n/catalog/en.mjs'

test('loadItems는 26개 항목을 id순으로 로드한다', async () => {
  const items = await loadItems()
  assert.equal(items.length, 26)
  const ids = items.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  assert.ok(ids.includes('config.gitmessage.en'))
  assert.ok(ids.includes('global.ponytail'))
  assert.ok(ids.includes('global.superpowers'))
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
  assert.ok(ids.includes('skill.hallmark'))
  assert.ok(ids.includes('skill.diagram-design'))
  assert.ok(ids.includes('skill.superpowers'))
  assert.ok(ids.includes('skill.mattpocock-skills'))
})

// 같은 상류를 플러그인과 공유 스킬 양쪽으로 넣으면 같은 스킬이 두 경로에서
// 잡혀 중복 등록된다. 배타 키가 풀리면 TUI가 형제를 자동으로 끄지 않고
// --set도 둘을 함께 받아 조용히 그 상태를 만든다.
test('같은 상류의 플러그인 판과 스킬 판은 배타다', async () => {
  const items = await loadItems()
  const pick = (id) => items.find((i) => i.id === id)
  for (const [pluginId, skillId, key] of [
    ['plugin.superpowers', 'skill.superpowers', 'superpowers'],
    ['plugin.mattpocock-skills', 'skill.mattpocock-skills', 'mattpocock'],
  ]) {
    assert.equal(pick(pluginId).exclusive, key, `${pluginId}: 배타 키가 없다`)
    assert.equal(pick(skillId).exclusive, key, `${skillId}: 배타 키가 없다`)
    assert.throws(
      () => assertExclusive(items, new Set([pluginId, skillId])),
      /exclusiveItems|한 자리|same slot/,
      `${key}: 둘을 함께 골라도 거절하지 않는다`,
    )
  }
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

// 2026-08-15 재측정에서 뒤집힌 판정들. 상류가 지원을 새로 추가했거나(grok),
// 같은 제품인지 모르던 것이 실측으로 밝혀졌다(kilo). 되돌아가면 화면이 다시
// "상류에 없다"고 거짓말한다.
test('상류가 새로 지원한 CLI는 없다고 말하지 않는다', async () => {
  const items = await loadItems()
  const why = (id, cli) => items.find((i) => i.id === id).unsupported[cli].key
  // superpowers 6.3.0의 `### Grok Build CLI`
  assert.equal(why('plugin.superpowers', 'grok'), 'item.unsupported.superpowersSeparate')
  // ponytail은 grok 플러그인 기구가 있다 — 사유는 "기구 없음"이 아니라 사용자 스코프
  assert.equal(why('plugin.ponytail', 'grok'), 'item.unsupported.ponytailUser')
  // GSD --kilo가 만든 .kilo/skills를 Kilo Code가 읽는 것을 실측
  assert.equal(why('skill.gsd', 'kilo'), 'item.unsupported.gsdFlag')
})

// 전역 판은 CLI가 넷뿐이고 나머지 여섯의 사유가 전부 다르다 — claude는 자리
// 겹침, grok은 미실측, kimi는 대화형 전용, 셋은 상류 부재. 일괄 사유로
// 뭉개지면 화면이 거짓을 말한다.
test('superpowers 전역 판은 CLI별로 정확한 미배선 사유를 갖는다', async () => {
  const items = await loadItems()
  const item = items.find((i) => i.id === 'global.superpowers')
  assert.deepEqual(item.supports, ['codex', 'gemini', 'opencode', 'copilot'])
  assert.equal(item.scope, 'user')
  const why = (cli) => item.unsupported[cli].key
  assert.equal(why('claude'), 'item.unsupported.superpowersGlobalClaude')
  assert.equal(why('grok'), 'item.unsupported.superpowersGlobalGrok')
  assert.equal(why('kimi'), 'item.unsupported.superpowersGlobalKimi')
  assert.equal(why('kilo'), 'item.unsupported.upstreamNone')
  assert.equal(why('kiro'), 'item.unsupported.upstreamNone')
  assert.equal(why('vscode'), 'item.unsupported.upstreamNone')
})

// ponytail 전역 판. claude·opencode는 프로젝트 항목(plugin.ponytail)의 자리,
// kiro·vscode는 상류가 룰 파일 수동 배치만 안내한다(2026-08-15 재검증).
test('ponytail 전역 판은 CLI별로 정확한 미배선 사유를 갖는다', async () => {
  const items = await loadItems()
  const item = items.find((i) => i.id === 'global.ponytail')
  assert.deepEqual(item.supports, ['codex', 'gemini', 'copilot'])
  assert.equal(item.scope, 'user')
  const why = (cli) => item.unsupported[cli].key
  assert.equal(why('claude'), 'item.unsupported.globalProjectItem')
  assert.equal(why('opencode'), 'item.unsupported.globalProjectItem')
  assert.equal(why('grok'), 'item.unsupported.ponytailGlobalGrok')
  assert.equal(why('kiro'), 'item.unsupported.ponytailRules')
  assert.equal(why('vscode'), 'item.unsupported.ponytailRules')
  assert.equal(why('kilo'), 'item.unsupported.upstreamNone')
  assert.equal(why('kimi'), 'item.unsupported.upstreamNone')
})

// 일괄 폴백이 붙어 "Claude Code 전용 플러그인"이라 말하던 세 항목. 셋 다
// 상류가 다른 CLI를 지원하므로 그 문구는 거짓이었다.
test('폴백을 밟던 항목은 검증된 사유를 갖는다', async () => {
  const items = await loadItems()
  const why = (id, cli) => items.find((i) => i.id === id).unsupported[cli].key
  // ECC: codex만 스코프가 이유고 나머지는 285개라는 규모가 이유다
  assert.equal(why('plugin.ecc', 'codex'), 'item.unsupported.eccCodexHome')
  assert.equal(why('plugin.ecc', 'kimi'), 'item.unsupported.eccScale')
  assert.equal(why('plugin.ecc', 'gemini'), 'item.unsupported.eccScale')
  // Understand Anything: install.sh도 copilot 플러그인도 사용자 스코프
  assert.equal(why('plugin.understand-anything', 'copilot'), 'item.unsupported.uaUser')
  assert.equal(why('plugin.understand-anything', 'codex'), 'item.unsupported.uaUser')
  // Matt Pocock: 상류가 우리 레지스트리 경로를 직접 안내한다
  assert.equal(why('plugin.mattpocock-skills', 'codex'), 'item.unsupported.mattpocockRegistry')
})

// definePlugin·defineSkill의 기본 사유는 상류를 확인하지 않고도 9개 CLI에
// 일괄로 붙는다 — 그래서 검증을 건너뛴 항목이 조용히 거짓 정보를 내보냈다.
// 폴백 자체는 두 define의 계약이라 남기되(catalog.test.mjs가 검증한다),
// 실제 항목이 그걸 밟으면 여기서 막는다.
test('실제 항목은 검증하지 않은 일괄 폴백 사유를 쓰지 않는다', async () => {
  const FALLBACK = ['item.unsupported.claudePlugin', 'item.unsupported.claudeSkill']
  for (const item of await loadItems()) {
    for (const [cli, why] of Object.entries(item.unsupported ?? {})) {
      assert.ok(
        !FALLBACK.includes(why.key),
        `${item.id}/${cli}: 폴백 사유 '${why.key}' — 상류를 확인하고 사유를 명시하세요`,
      )
    }
  }
})

test('unsupported 사유는 구조화 메시지다', async () => {
  const t = createT('en')
  for (const item of await loadItems()) {
    for (const [cli, why] of Object.entries(item.unsupported ?? {})) {
      assert.equal(typeof why, 'object', `${item.id}/${cli}: 사유가 구조체가 아니다`)
      // 화면과 같은 경로(toText)로 렌더한다 — t(why.key)만 부르면
      // globalProjectItem처럼 매개변수를 쓰는 사유가 거짓 실패한다.
      assert.doesNotThrow(() => toText(t, why), `${item.id}/${cli}: 렌더 실패 ${why.key}`)
    }
  }
})
