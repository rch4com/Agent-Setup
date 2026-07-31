import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRows, agentHint, designHint, installedIds, SECTION_ORDER, CATCH_ALL_CATEGORY } from '../lib/tui/rows.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { render, renderReview, cut, width, bodyHeight } from '../lib/tui/render.mjs'
import { createState, setQuery, setTab, setFocus } from '../lib/tui/state.mjs'
import { runTui } from '../lib/tui/run.mjs'
import { makeTempRepo, makeCapture } from './helpers.mjs'

const ACTIONS = [{
  kind: 'action', id: 'action.bootstrap', section: '작업', label: '부트스트랩 실행',
  hint: '지침 · 스킬', status: 'absent', previewTarget: null, searchText: '부트스트랩 실행 작업',
}]

const AGENT_STATES = [
  { item: { id: 'mcp.supabase', category: 'mcp', label: 'Supabase', scope: 'project', supports: ['claude', 'codex'], unsupported: {} }, status: 'absent' },
  { item: { id: 'plugin.bkit', category: 'plugin', label: 'bkit', scope: 'project', supports: ['claude'], unsupported: { codex: '전용' } }, status: 'installed' },
]

const DESIGN_STATES = [
  { item: { id: 'design.a.stripe', name: 'stripe', providerId: 'a', label: 'Stripe', designCategory: 'Fintech', description: '결제', webUrl: 'https://x/stripe' }, status: 'installed' },
  { item: { id: 'design.b.stripe', name: 'stripe', providerId: 'b', label: 'Stripe', designCategory: '사내', description: null, webUrl: null, previewPath: 'C:/x/DESIGN.md' }, status: 'absent' },
]

test('세 갈래가 하나의 배열로 합쳐지고 섹션 순서가 고정된다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const sections = [...new Set(rows.map((r) => r.section))]
  assert.deepEqual(sections, ['작업', 'PLUGIN', 'MCP', 'DESIGN.MD'])
  // 섹션 순서는 SECTION_ORDER를 따른다 — displayList가 인접한 같은 섹션을 하나로 묶기 때문이다.
  const ranks = rows.map((r) => SECTION_ORDER.indexOf(r.section))
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
})

test('액션 행은 항상 맨 위이고 체크 대상이 아니다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  assert.equal(rows[0].kind, 'action')
  assert.equal(rows.filter((r) => r.kind === 'action').length, 1)
})

test('design 제공자가 하나뿐이면 힌트에 제공자명을 붙이지 않는다', () => {
  const one = designHint(DESIGN_STATES[0], false)
  const many = designHint(DESIGN_STATES[0], true)
  assert.equal(one.includes('a · '), false)
  assert.equal(many.startsWith('a · '), true)
})

// 카테고리를 id로 바꾼 뒤로 designHint가 raw id를 그대로 찍던 회귀 —
// categoryLabel을 거쳐야 catch-all만 번역되고 카탈로그의 실제 카테고리는
// 그대로 통과한다. 두 로케일 모두 raw id가 새지 않아야 한다.
test('designHint: catch-all 카테고리는 raw id가 아니라 로케일 라벨로 나온다', () => {
  const state = { item: { id: 'd.x', name: 'x', providerId: 'a', label: 'X', designCategory: '__other' }, status: 'absent' }
  const ko = designHint(state, false, createT('ko'))
  const en = designHint(state, false, createT('en'))
  assert.doesNotMatch(ko, /__other/)
  assert.doesNotMatch(en, /__other/)
  assert.match(ko, /기타/)
  assert.match(en, /Other/)
})

test('미리보기 대상은 webUrl 우선, 없으면 로컬 원본 파일', () => {
  // id로 찾는다 — 행 순서는 카테고리 정렬에 달려 있어 인덱스로 짚으면 쉽게 깨진다.
  const byId = new Map(buildRows({ designStates: DESIGN_STATES }).map((r) => [r.id, r]))
  assert.equal(byId.get('design.a.stripe').previewTarget, 'https://x/stripe')
  assert.equal(byId.get('design.b.stripe').previewTarget, 'C:/x/DESIGN.md')
})

test('에이전트 항목은 이름으로도 검색된다 — 라벨과 id가 다를 수 있다', () => {
  const rows = buildRows({ agentStates: AGENT_STATES })
  assert.equal(rows.find((r) => r.id === 'mcp.supabase').searchText.includes('mcp.supabase'), true)
})

test('agentHint: 미지원 사유와 전용 표시를 담는다', () => {
  const hint = agentHint(AGENT_STATES[1].item, AGENT_STATES[1])
  assert.equal(hint.includes('설치됨'), true)
  assert.equal(hint.includes('Claude Code 전용'), true)
})

test('design 행은 카테고리 → 라벨 순으로 정렬된다 — 그룹 헤더가 쪼개지지 않게', () => {
  const states = [
    { item: { id: 'd.1', name: 'b', providerId: 'a', label: 'B', designCategory: 'Zeta' }, status: 'absent' },
    { item: { id: 'd.2', name: 'a', providerId: 'a', label: 'A', designCategory: 'Alpha' }, status: 'absent' },
    { item: { id: 'd.3', name: 'c', providerId: 'a', label: 'C', designCategory: 'Zeta' }, status: 'absent' },
  ]
  const groups = buildRows({ designStates: states }).map((r) => r.group)
  assert.deepEqual(groups, ['Alpha', 'Zeta', 'Zeta'])
})

test('design 카테고리가 비면 기타로 묶인다 — group이 없으면 헤더가 사라진다', () => {
  const states = [{ item: { id: 'd.x', name: 'x', providerId: 'a', label: 'X', designCategory: '' }, status: 'absent' }]
  assert.equal(buildRows({ designStates: states })[0].group, CATCH_ALL_CATEGORY)
})

test('installedIds: 설치·일부 설치만 초기 체크 대상이다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  assert.deepEqual(installedIds(rows).sort(), ['design.a.stripe', 'plugin.bkit'])
})

// ── 렌더 ──────────────────────────────────────────────────────────

test('cut: 폭을 넘으면 말줄임표로 잘린다', () => {
  assert.equal(cut('abcdef', 4), 'abc…')
  assert.equal(cut('abc', 10), 'abc')
  assert.equal(cut('abc', 0), '')
})

test('render: 프레임 높이가 터미널 높이와 맞는다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const lines = render(createState(rows), { width: 80, height: 24 })
  assert.equal(lines.length, bodyHeight(24) + 6)
})

test('render: 탭 줄이 모든 섹션을 싣고 활성 탭을 표시한다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const bar = render(createState(rows), { width: 100, height: 24 })[1]
  for (const section of ['작업', 'PLUGIN', 'MCP', 'DESIGN.MD']) assert.ok(bar.includes(section), `${section} 없음`)
  assert.ok(bar.includes('[작업 1]'), `활성 표시 없음: ${bar}`)
})

test('render: 검색 중이면 탭마다 적중 수를 보여 준다 — 다른 탭의 결과를 놓치지 않게', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const bar = render(setQuery(createState(rows), 'stripe'), { width: 100, height: 24 })[1]
  assert.ok(bar.includes('DESIGN.MD 2/2'), `탭별 적중 수 없음: ${bar}`)
  assert.ok(bar.includes('[작업 0/1]'), `활성 탭 0건 표시 없음: ${bar}`)
})

test('render: 폭이 좁으면 탭 줄이 활성 탭 하나로 줄어든다 — 접히면 화면이 무너진다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const lines = render(createState(rows), { width: 30, height: 24 })
  assert.ok(lines[1].includes('1/4'), `위치 표시 없음: ${lines[1]}`)
  for (const line of lines) assert.ok(width(line) <= 29, `너무 김: ${line}`)
})

test('render: 어떤 줄도 터미널 폭을 넘지 않는다 — 넘으면 줄이 접혀 화면이 밀린다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const lines = render(createState(rows), { width: 40, height: 24 })
  for (const line of lines) assert.ok(width(line) <= 39, `너무 김: ${line}`)
})

test('render: 검색 결과가 없으면 다른 탭을 보라고 안내한다', () => {
  const rows = buildRows({ agentStates: AGENT_STATES })
  const lines = render(setQuery(createState(rows), 'zzz'), { width: 80, height: 24 })
  assert.equal(lines.join('\n').includes('이 탭에는 일치하는 항목이 없습니다'), true)
})

test('render: 검색칸 포커스는 입력 커서(▌)로 드러난다 — 스페이스의 뜻이 포커스마다 다르기 때문이다', () => {
  const rows = buildRows({ agentStates: AGENT_STATES })
  const searchFocus = setFocus(setQuery(createState(rows), 'sup'), 'search')
  const listFocus = setQuery(createState(rows), 'sup') // 기본 포커스는 목록
  assert.ok(render(searchFocus, { width: 80, height: 24 })[2].includes('sup▌'))
  assert.ok(!render(listFocus, { width: 80, height: 24 })[2].includes('▌'))
})

test('render: 커서 행에만 표식이 붙는다', () => {
  const rows = buildRows({ agentStates: AGENT_STATES })
  const lines = render(createState(rows), { width: 80, height: 24 })
  assert.equal(lines.filter((l) => l.startsWith('❯')).length, 1)
})

// color는 TTY에서 항상 켜지므로, 이 갈래가 깨지면 대화형 실행 자체가 불가능해진다.
test('render: color 갈래도 폭을 지키며 렌더된다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const lines = render(createState(rows), { width: 40, height: 24, color: true, repo: '/tmp/x' })
  assert.equal(lines.length, bodyHeight(24) + 6)
  const ESC = String.fromCharCode(27)
  const strip = (l) => l.split(`${ESC}[`).map((p, i) => (i === 0 ? p : p.slice(p.indexOf('m') + 1))).join('')
  for (const line of lines) assert.ok(width(strip(line)) <= 39, `너무 김: ${JSON.stringify(line)}`)
})

test('render: dry-run은 제목에 드러난다', () => {
  const lines = render(createState(buildRows({ agentStates: AGENT_STATES })), { width: 80, height: 24, dryRun: true })
  assert.equal(lines[0].includes('dry-run'), true)
})

// ── 제출 검토 ─────────────────────────────────────────────────────

const CHANGES = [
  { action: 'install', item: { label: 'Supabase' } },
  { action: 'uninstall', item: { label: 'Stripe' } },
]

test('renderReview: 변경 건수와 각 항목의 동작을 싣는다', () => {
  const lines = renderReview(CHANGES, { width: 80, height: 24 })
  const text = lines.join('\n')
  assert.ok(text.includes('변경 2건'))
  assert.ok(text.includes('설치') && text.includes('Supabase'))
  assert.ok(text.includes('제거') && text.includes('Stripe'))
  assert.ok(text.includes('Enter 적용') && text.includes('Esc 취소'))
  assert.equal(lines.length, bodyHeight(24) + 4)
})

test('renderReview: 목록이 화면보다 길면 잘라내고 남은 건수를 알린다', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ action: 'install', item: { label: `항목${i}` } }))
  const lines = renderReview(many, { width: 80, height: 12 })
  assert.ok(lines.join('\n').includes('…외'), '남은 건수 안내 없음')
  assert.equal(lines.length, bodyHeight(12) + 4)
  for (const line of lines) assert.ok(width(line) <= 79, `너무 김: ${line}`)
})

// ── 비TTY 폴백 ────────────────────────────────────────────────────

test('비TTY에서는 raw 모드를 켜지 않고 목록만 출력한다', async () => {
  const cap = makeCapture()
  const result = await runTui(makeTempRepo(), {
    log: cap.log,
    stdin: { isTTY: false },
    stdout: { columns: 80, rows: 24, write() {} },
  })
  assert.equal(result.interactive, false)
  assert.equal(cap.text().includes('[작업]'), true)
  assert.equal(cap.text().includes('부트스트랩 실행'), true)
  assert.equal(cap.text().includes('--list'), true)
})
