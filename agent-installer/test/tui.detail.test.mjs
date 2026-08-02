import test from 'node:test'
import assert from 'node:assert/strict'
import { detailLines } from '../lib/tui/detail.mjs'
import { createT, msg } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'

const T = createT('ko')

function itemRow(item, status = 'installed', extra = {}) {
  return { kind: 'item', id: item.id, label: item.label, status, item, statusDetail: null, previewTarget: null, ...extra }
}

const PONYTAIL = itemRow({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', scope: 'project',
  supports: ['claude', 'opencode'],
  unsupported: {
    codex: msg('item.unsupported.ponytailUser'),
    gemini: msg('item.unsupported.ponytailUser'),
    kilo: msg('item.unsupported.ponytailRules'),
  },
  note: 'item.plugin.ponytail.note',
})

const SUPABASE = itemRow({
  id: 'mcp.supabase', category: 'mcp', label: 'Supabase', scope: 'project',
  supports: ['claude', 'codex'], unsupported: {},
}, 'absent')

const DESIGN = itemRow({
  id: 'design.a.linear', category: 'design', label: 'Linear', providerId: 'awesome-design-md',
  designCategory: 'Productivity', description: 'Linear의 디자인 시스템 문서.', webUrl: 'https://linear.app',
}, 'installed', { previewTarget: 'https://linear.app' })

test('머리줄에 이름·종류·스코프·상태를 담는다', () => {
  const [head] = detailLines(PONYTAIL, { width: 60, height: 20, t: T })
  assert.match(head, /Ponytail/)
  assert.match(head, /plugin/)
  assert.match(head, /저장소 스코프/)
  assert.match(head, /설치됨/)
})

// 오늘은 모든 항목이 scope를 채우지만, 하나라도 빠지면 t()가 모르는 키에
// 던진다(i18n/index.mjs) — headLine은 render() 안에서 돌아 그 예외가 패널
// 하나가 아니라 TUI 전체를 끌고 내려간다. 던지지 않고 그 자리를 비우는지만 본다.
test('scope가 없는 항목도 던지지 않고 머리줄을 그린다', () => {
  const noScope = itemRow({ id: 'plugin.x', category: 'plugin', label: 'X', supports: [], unsupported: {} })
  assert.doesNotThrow(() => detailLines(noScope, { width: 60, height: 20, t: T }))
  const [head] = detailLines(noScope, { width: 60, height: 20, t: T })
  assert.match(head, /X/)
  assert.doesNotMatch(head, /undefined/)
})

test('배선된 CLI를 이름째 보여 준다', () => {
  const text = detailLines(PONYTAIL, { width: 60, height: 20, t: T }).join('\n')
  assert.match(text, /claude/)
  assert.match(text, /opencode/)
})

// 커버리지 숫자만으로는 "내가 쓰는 CLI에서 되나"에 답할 수 없다.
test('미배선 CLI와 사유를 같은 사유끼리 묶어 보여 준다', () => {
  const text = detailLines(PONYTAIL, { width: 60, height: 20, t: T }).join('\n')
  assert.match(text, /codex·gemini/)
  assert.match(text, /kilo/)
  assert.match(text, /사용자 스코프/)
  assert.match(text, /AGENTS\.md/)
})

// MCP만 어댑터가 경로의 유일한 진실이다. plugin·skill은 설치 경로가 항목마다
// 달라 어댑터가 알지 못하므로 경로를 지어내지 않는다.
test('MCP 항목만 설정 파일 경로를 붙인다', () => {
  const mcp = detailLines(SUPABASE, { width: 60, height: 20, t: T }).join('\n')
  assert.match(mcp, /\.mcp\.json/)
  assert.match(mcp, /\.codex\/config\.toml/)
  const plugin = detailLines(PONYTAIL, { width: 60, height: 20, t: T }).join('\n')
  assert.doesNotMatch(plugin, /\.mcp\.json/)
})

test('design 항목은 공급자·미리보기·설명을 보여 준다', () => {
  const text = detailLines(DESIGN, { width: 60, height: 20, t: T }).join('\n')
  assert.match(text, /awesome-design-md/)
  assert.match(text, /https:\/\/linear\.app/)
  assert.match(text, /디자인 시스템/)
})

test('어느 줄도 폭을 넘지 않는다', () => {
  const lines = detailLines(PONYTAIL, { width: 40, height: 20, t: T })
  // 빈 배열 위를 도는 루프는 무엇을 반환하든 통과한다. 내용이 있다는 것을 먼저 못박는다.
  assert.ok(lines.length > 0, '상세가 비면 폭 검사가 공허해진다')
  for (const line of lines) assert.ok(width(line) <= 40, `넘침(${width(line)}): ${line}`)
})

// 지면을 넘치면 남은 줄 수를 알리고 펼치는 길을 안내한다 — 조용히 자르면
// 이번에 고치려던 문제가 그대로 되돌아온다.
test('지면을 넘치면 마지막 줄이 남은 줄 수를 알린다', () => {
  const lines = detailLines(PONYTAIL, { width: 40, height: 4, t: T })
  assert.equal(lines.length, 4)
  assert.match(lines[3], /외 \d+줄/)
})

test('지면이 없거나 행이 없으면 빈 배열이다', () => {
  assert.deepEqual(detailLines(PONYTAIL, { width: 40, height: 0, t: T }), [])
  assert.deepEqual(detailLines(null, { width: 40, height: 10, t: T }), [])
})

test('액션 행도 그린다', () => {
  const row = { kind: 'action', id: 'action.bootstrap', label: '부트스트랩 실행', hint: '지침 · 스킬', status: 'absent' }
  const text = detailLines(row, { width: 60, height: 10, t: T }).join('\n')
  assert.match(text, /부트스트랩 실행/)
  assert.match(text, /지침/)
})

// 반환 줄 수가 height를 넘으면 패널 밖으로 한 줄이 새어 나간다.
// height=1은 안내줄 하나만 들어가는 경계다.
test('반환 줄 수는 어떤 height에서도 height를 넘지 않는다', () => {
  for (const height of [1, 2, 3, 4, 8]) {
    const lines = detailLines(PONYTAIL, { width: 40, height, t: T })
    assert.ok(lines.length <= height, `height=${height}인데 ${lines.length}줄`)
  }
  assert.equal(detailLines(PONYTAIL, { width: 40, height: 1, t: T }).length, 1)
})
