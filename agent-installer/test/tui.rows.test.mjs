import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRows, agentHint, designHint, installedIds, SECTION_ORDER } from '../lib/tui/rows.mjs'
import { render, cut, width, bodyHeight } from '../lib/tui/render.mjs'
import { createState, setQuery } from '../lib/tui/state.mjs'
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

test('미리보기 대상은 webUrl 우선, 없으면 로컬 원본 파일', () => {
  const rows = buildRows({ designStates: DESIGN_STATES })
  assert.equal(rows[0].previewTarget, 'https://x/stripe')
  assert.equal(rows[1].previewTarget, 'C:/x/DESIGN.md')
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
  assert.equal(lines.length, bodyHeight(24) + 5)
})

test('render: 어떤 줄도 터미널 폭을 넘지 않는다 — 넘으면 줄이 접혀 화면이 밀린다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const lines = render(createState(rows), { width: 40, height: 24 })
  for (const line of lines) assert.ok(width(line) <= 39, `너무 김: ${line}`)
})

test('render: 검색 결과가 없으면 안내를 낸다', () => {
  const rows = buildRows({ agentStates: AGENT_STATES })
  const lines = render(setQuery(createState(rows), 'zzz'), { width: 80, height: 24 })
  assert.equal(lines.join('\n').includes('일치하는 항목이 없습니다'), true)
})

test('render: 커서 행에만 표식이 붙는다', () => {
  const rows = buildRows({ agentStates: AGENT_STATES })
  const lines = render(createState(rows), { width: 80, height: 24 })
  assert.equal(lines.filter((l) => l.startsWith('❯')).length, 1)
})

test('render: dry-run은 제목에 드러난다', () => {
  const lines = render(createState(buildRows({ agentStates: AGENT_STATES })), { width: 80, height: 24, dryRun: true })
  assert.equal(lines[0].includes('dry-run'), true)
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
