import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildRows, buildActions, agentHint, designHint, agentShortHint, designShortHint, installedIds, SECTION_ORDER, ACTION_SECTION, CATCH_ALL_CATEGORY,
} from '../lib/tui/rows.mjs'
import { unsupportedGroups } from '../lib/tui/detail.mjs'
import { BUNDLE_CATEGORY } from '../lib/design-md/scan.mjs'
import { CLI_IDS } from '../lib/clis.mjs'
import { createT, msg } from '../lib/i18n/index.mjs'
import { render, renderReview, cut, width, bodyHeight } from '../lib/tui/render.mjs'
import { createState, setQuery, setTab, setFocus } from '../lib/tui/state.mjs'
import { runTui } from '../lib/tui/run.mjs'
import { makeTempRepo, makeCapture } from './helpers.mjs'

const ACTIONS = [{
  kind: 'action', id: 'action.bootstrap', section: 'action', label: '부트스트랩 실행',
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
  assert.deepEqual(sections, ['action', 'plugin', 'mcp', 'design'])
  // 섹션 순서는 SECTION_ORDER를 따른다 — displayList가 인접한 같은 섹션을 하나로 묶기 때문이다.
  const ranks = rows.map((r) => SECTION_ORDER.indexOf(r.section))
  assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b))
})

test('섹션은 표시 문자열이 아니라 id다', () => {
  assert.deepEqual(SECTION_ORDER, ['action', 'plugin', 'mcp', 'skill', 'design'])
  assert.equal(ACTION_SECTION, 'action')
})

// 성격 그룹은 탭 안쪽 소분류 헤더가 된다. displayList가 **인접한** 같은 group을
// 하나로 묶으므로, 정렬이 흐트러지면 한 탭에서 같은 헤더가 여러 번 나온다.
test('항목 행은 성격 그룹을 달고 GROUP_ORDER 순으로 붙는다', () => {
  const states = [
    { item: { id: 'mcp.notion', category: 'mcp', label: 'Notion', scope: 'project', group: '__service', supports: [], unsupported: {} }, status: 'absent' },
    { item: { id: 'mcp.headroom', category: 'mcp', label: 'Headroom', scope: 'project', group: '__token', supports: [], unsupported: {} }, status: 'absent' },
    { item: { id: 'mcp.graphify', category: 'mcp', label: 'Graphify', scope: 'project', group: '__context', supports: [], unsupported: {} }, status: 'absent' },
    { item: { id: 'mcp.supabase', category: 'mcp', label: 'Supabase', scope: 'project', group: '__service', supports: [], unsupported: {} }, status: 'absent' },
  ]
  const rows = buildRows({ agentStates: states })
  assert.deepEqual(rows.map((r) => r.group), ['__token', '__context', '__service', '__service'])
  // 같은 그룹 안은 라벨 순 — id순으로 두면 화면에 이유 없는 순서가 남는다.
  assert.deepEqual(rows.slice(2).map((r) => r.label), ['Notion', 'Supabase'])
})

test('성격 그룹이 없는 항목은 맨 뒤에 헤더 없이 붙는다', () => {
  const states = [
    { item: { id: 'mcp.x', category: 'mcp', label: 'X', scope: 'project', supports: [], unsupported: {} }, status: 'absent' },
    { item: { id: 'mcp.y', category: 'mcp', label: 'Y', scope: 'project', group: '__token', supports: [], unsupported: {} }, status: 'absent' },
  ]
  const rows = buildRows({ agentStates: states })
  assert.deepEqual(rows.map((r) => r.group), ['__token', null])
})

test('catch-all 카테고리는 scan.mjs와 같은 값이다', () => {
  // 두 값이 갈리면 '기타' 그룹이 두 개로 쪼개져 나온다.
  assert.equal(CATCH_ALL_CATEGORY, BUNDLE_CATEGORY)
})

test('행의 section은 item.category를 그대로 쓴다', () => {
  const rows = buildRows({
    agentStates: [
      { item: { id: 'mcp.x', category: 'mcp', label: 'X' }, status: 'absent' },
      { item: { id: 'plugin.y', category: 'plugin', label: 'Y' }, status: 'absent' },
    ],
  })
  assert.deepEqual(rows.map((r) => r.section), ['plugin', 'mcp'])
})

test('액션 행은 항상 맨 위이고 체크 대상이 아니다', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  assert.equal(rows[0].kind, 'action')
  assert.equal(rows.filter((r) => r.kind === 'action').length, 1)
})

test('언어 행이 작업 탭 맨 위에 있다', () => {
  const root = makeTempRepo()
  const rows = buildRows({ actions: buildActions(root, { t: createT('en') }), t: createT('en') })
  assert.equal(rows[0].id, 'action.language')
  assert.equal(rows[0].kind, 'action')
  assert.equal(rows[0].section, 'action')
  assert.match(rows[0].hint, /English/)
})

test('언어 행 힌트는 현재 로케일의 자기 이름이다', () => {
  const root = makeTempRepo()
  const ko = buildActions(root, { t: createT('ko') })[0]
  // 어떤 화면에서 보든 언어 이름은 자기 언어로 쓴다.
  assert.match(ko.hint, /한국어/)
})

test('design 제공자가 하나뿐이면 힌트에 제공자명을 붙이지 않는다', () => {
  const one = designHint(DESIGN_STATES[0], false, createT('ko'))
  const many = designHint(DESIGN_STATES[0], true, createT('ko'))
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

test('agentHint: 상태와 커버리지와 미지원 사유를 함께 담는다', () => {
  const hint = agentHint(AGENT_STATES[1].item, AGENT_STATES[1], createT('ko'))
  assert.equal(hint.includes('설치됨'), true)
  assert.match(hint, /CLI 1\/10/)
  assert.equal(hint.includes('전용'), true)
})

// 커버리지는 상태 **바로 뒤**여야 한다. 힌트 끝은 좁은 터미널에서 잘려 나가는데,
// 하필 그때가 "이 항목이 내가 쓰는 CLI에서 되나"를 가장 알고 싶은 순간이다.
test('agentHint: CLI 커버리지가 상태 바로 뒤에 온다', () => {
  const state = {
    item: { id: 'mcp.x', category: 'mcp', label: 'X', note: 'item.mcp.notion.note', supports: ['claude', 'codex'], unsupported: {} },
    status: 'partial',
    detail: msg('item.mcp.partial', { present: 'claude', missing: 'codex' }),
  }
  assert.match(agentHint(state.item, state, createT('en')), /^Partial · CLI 2\/10 · registered: claude/)
  assert.match(agentHint(state.item, state, createT('ko')), /^일부 설치됨 · CLI 2\/10 · 등록됨: claude/)
})

// 전부 지원할 때도 찍는다 — 표시가 없는 것과 "10/10"은 뜻이 다르다.
// 없으면 "빠뜨린 것"과 "전부 되는 것"을 화면에서 가를 수 없다.
test('agentHint: 10개 전부 지원하면 그 사실도 명시한다', () => {
  const item = { id: 'skill.all', category: 'skill', label: 'All', scope: 'project', supports: [...CLI_IDS], unsupported: {} }
  const hint = agentHint(item, { item, status: 'absent' }, createT('ko'))
  assert.match(hint, /CLI 10\/10/)
  assert.ok(!hint.includes('미배선'), '미지원이 없는데 미배선 문구가 나왔다')
})

// 이전에는 이 분기가 category === 'mcp'일 때만 돌았다. 그래서 CLI 두 개만
// 지원하는 플러그인(ponytail)이 나머지 여덟 개를 화면에 한 글자도 알리지
// 않았다 — 고를 때 알 방법이 없었다. 카테고리와 무관하게 나와야 한다.
test('agentHint: 플러그인·스킬도 미지원 CLI를 밝힌다', () => {
  const item = {
    id: 'plugin.partial', category: 'plugin', label: 'P', scope: 'project', supports: ['claude', 'opencode'],
    unsupported: { codex: msg('item.unsupported.ponytailUser'), kilo: msg('item.unsupported.ponytailRules') },
  }
  const ko = agentHint(item, { item, status: 'absent' }, createT('ko'))
  assert.match(ko, /CLI 2\/10/)
  assert.match(ko, /미배선 2곳/)
  assert.match(ko, /codex/)
  assert.match(ko, /kilo/)
})

// 사유 하나가 CLI 아홉 개에 그대로 반복되면 줄만 길어지고 "무엇이 왜 빠졌는가"는
// 오히려 묻힌다. 같은 사유는 한 번만 적고 CLI를 묶는다.
test('agentHint: 같은 사유의 CLI는 하나로 묶고, 다른 사유는 갈라 놓는다', () => {
  const same = {
    id: 'mcp.multi', category: 'mcp', label: 'Multi', scope: 'project', supports: ['claude'],
    unsupported: { codex: msg('item.unsupported.claudePlugin'), gemini: msg('item.unsupported.claudePlugin') },
  }
  const en = agentHint(same, { item: same, status: 'absent' }, createT('en'))
  const ko = agentHint(same, { item: same, status: 'absent' }, createT('ko'))
  assert.match(en, /not wired for 2: codex·gemini — Claude Code plugin only/)
  assert.match(ko, /미배선 2곳: codex·gemini — Claude Code 전용 플러그인/)
  // 사유가 반복되지 않는다 — 같은 문장이 두 번 나오면 묶기가 깨진 것이다.
  assert.equal(en.split('Claude Code plugin only').length - 1, 1)

  const mixed = {
    id: 'mcp.mixed', category: 'mcp', label: 'Mixed', scope: 'project', supports: ['claude'],
    unsupported: { codex: msg('item.unsupported.claudePlugin'), gemini: msg('item.unsupported.claudeSkill') },
  }
  const two = agentHint(mixed, { item: mixed, status: 'absent' }, createT('en'))
  assert.match(two, /codex — Claude Code plugin only \/ gemini — Claude Code skill install/)
})

test('검색어는 섹션 id와 두 로케일 라벨에 모두 걸린다', () => {
  const rows = buildRows({
    agentStates: [{ item: { id: 'mcp.x', category: 'mcp', label: 'X' }, status: 'absent' }],
    t: createT('ko'),
  })
  // 한국어 화면에서도 영어 탭 이름으로 찾을 수 있어야 한다.
  assert.match(rows[0].searchText, /mcp/)
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
  const bar = render(createState(rows), { width: 100, height: 24, t: createT('ko') })[1]
  for (const label of ['작업', 'PLUGIN', 'MCP', 'DESIGN.MD']) assert.ok(bar.includes(label), `${label} 없음`)
  assert.ok(bar.includes('[작업 1]'), `활성 표시 없음: ${bar}`)
})

test('render: 검색 중이면 탭마다 적중 수를 보여 준다 — 다른 탭의 결과를 놓치지 않게', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const bar = render(setQuery(createState(rows), 'stripe'), { width: 100, height: 24, t: createT('ko') })[1]
  assert.ok(bar.includes('DESIGN.MD 2/2'), `탭별 적중 수 없음: ${bar}`)
  assert.ok(bar.includes('[작업 0/1]'), `활성 탭 0건 표시 없음: ${bar}`)
})

// 카테고리를 id로 바꾼 뒤로 tabBar가 raw id를 그대로 찍던 회귀 —
// t가 section.<id> 키를 번역해야 하고, 두 로케일 모두 raw id가 새지 않아야 한다.
test('render: 탭 줄은 raw 섹션 id가 아니라 t로 번역된 이름을 보인다 — 두 로케일 모두', () => {
  const rows = buildRows({ actions: ACTIONS, agentStates: AGENT_STATES, designStates: DESIGN_STATES })
  const barKo = render(createState(rows), { width: 100, height: 24, t: createT('ko') })[1]
  const barEn = render(createState(rows), { width: 100, height: 24, t: createT('en') })[1]
  assert.ok(barKo.includes('작업'), `ko 탭 이름 없음: ${barKo}`)
  assert.ok(barEn.includes('ACTION'), `en 탭 이름 없음: ${barEn}`)
  for (const bar of [barKo, barEn]) assert.doesNotMatch(bar, /\baction\b/, `raw id가 새어 나갔다: ${bar}`)
})

// design 그룹 헤더(render.mjs:143)도 같은 회귀에 노출된다 — categoryLabel을
// 거쳐야 catch-all id가 로케일 라벨로 나온다.
test('render: design 그룹 헤더는 catch-all id를 로케일 라벨로 보여준다 — raw id가 새지 않는다', () => {
  const states = [{ item: { id: 'd.x', name: 'x', providerId: 'a', label: 'X', designCategory: '' }, status: 'absent' }]
  const rows = buildRows({ designStates: states })
  const ko = render(createState(rows), { width: 80, height: 24, t: createT('ko') }).join('\n')
  const en = render(createState(rows), { width: 80, height: 24, t: createT('en') }).join('\n')
  assert.match(ko, /기타/)
  assert.match(en, /Other/)
  assert.doesNotMatch(ko, /__other/)
  assert.doesNotMatch(en, /__other/)
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
  const lines = render(setQuery(createState(rows), 'zzz'), { width: 80, height: 24, t: createT('ko') })
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
  const lines = renderReview(CHANGES, { width: 80, height: 24, t: createT('ko') })
  const text = lines.join('\n')
  assert.ok(text.includes('변경 2건'))
  assert.ok(text.includes('설치') && text.includes('Supabase'))
  assert.ok(text.includes('제거') && text.includes('Stripe'))
  assert.ok(text.includes('Enter 적용') && text.includes('Esc 취소'))
  assert.equal(lines.length, bodyHeight(24) + 4)
})

// 적용 직전 마지막 화면이다. 목록에서 커버리지를 지나쳤더라도 여기서 한 번 더
// 보여야 되돌릴 수 있다. 다만 전부 지원하는 항목까지 표시하면 경고가 흔해져
// 아무도 읽지 않게 되므로, 일부만 들어가는 항목에만 붙인다.
test('renderReview: 일부 CLI에만 들어가는 항목은 커버리지를 함께 보인다', () => {
  const changes = [
    { action: 'install', item: { label: '일부', supports: ['claude', 'opencode'] } },
    { action: 'install', item: { label: '전부', supports: [...CLI_IDS] } },
  ]
  const text = renderReview(changes, { width: 80, height: 24, t: createT('ko') }).join('\n')
  assert.match(text, /일부 · CLI 2\/10/)
  assert.doesNotMatch(text, /전부 · CLI/)
})

test('renderReview: 목록이 화면보다 길면 잘라내고 남은 건수를 알린다', () => {
  const many = Array.from({ length: 50 }, (_, i) => ({ action: 'install', item: { label: `항목${i}` } }))
  const lines = renderReview(many, { width: 80, height: 12, t: createT('ko') })
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
    t: createT('ko'),
  })
  assert.equal(result.interactive, false)
  assert.equal(cap.text().includes('[작업]'), true)
  assert.equal(cap.text().includes('부트스트랩 실행'), true)
  assert.equal(cap.text().includes('--list'), true)
})

// ── 사유 그룹 분리와 짧은 힌트 ────────────────────────────────────

const PONYTAIL = {
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', scope: 'project',
  supports: ['claude', 'opencode'],
  unsupported: {
    codex: msg('item.unsupported.ponytailUser'),
    gemini: msg('item.unsupported.ponytailUser'),
    kilo: msg('item.unsupported.ponytailRules'),
  },
}

// 사유 하나가 CLI 여럿에 그대로 반복되면 줄만 길어지고 "무엇이 왜 빠졌는가"가
// 묻힌다. 같은 사유끼리 묶어 갈래가 보이게 한다.
test('미배선 사유를 같은 사유끼리 묶어 구조체로 돌려준다', () => {
  const t = createT('en')
  const groups = unsupportedGroups(PONYTAIL, t)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups[0].clis, ['codex', 'gemini'])
  assert.deepEqual(groups[1].clis, ['kilo'])
  assert.equal(typeof groups[0].why, 'string')
})

test('미배선이 없으면 빈 배열이다', () => {
  assert.deepEqual(unsupportedGroups({ unsupported: {} }, createT('en')), [])
  assert.deepEqual(unsupportedGroups({}, createT('en')), [])
})

// 목록 행에서 잘릴 것을 없애는 것이 이번 변경의 핵심이다. 사유·note·detail은
// 상세 패널로 옮기고 행에는 상태와 커버리지만 남긴다.
test('짧은 힌트는 상태와 CLI 커버리지만 담는다', () => {
  const t = createT('en')
  const hint = agentShortHint(PONYTAIL, { item: PONYTAIL, status: 'installed' }, t)
  assert.match(hint, /Installed/)
  assert.match(hint, /CLI 2\/10/)
  assert.doesNotMatch(hint, /upstream/)
})

test('긴 힌트는 그대로 남아 검색과 비대화형 목록이 쓴다', () => {
  const t = createT('en')
  const full = agentHint(PONYTAIL, { item: PONYTAIL, status: 'installed' }, t)
  assert.match(full, /upstream/)
})

test('항목 행은 짧은 힌트와 긴 힌트를 함께 들고 긴 쪽으로 검색된다', () => {
  const rows = buildRows({ agentStates: [{ item: PONYTAIL, status: 'installed' }] })
  const row = rows.find((r) => r.id === 'plugin.ponytail')
  assert.notEqual(row.hint, row.fullHint)
  assert.ok(row.searchText.includes('agents.md'))
})
