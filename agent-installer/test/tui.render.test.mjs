import test from 'node:test'
import assert from 'node:assert/strict'
import { render, renderReview, bodyHeight, panelHeight, footerHeight } from '../lib/tui/render.mjs'
import { createState, move, setCliFilter, setFocus, setQuery } from '../lib/tui/state.mjs'
import { createT, msg } from '../lib/i18n/index.mjs'
import { width } from '../lib/width.mjs'
import { CLI_IDS } from '../lib/clis.mjs'

const T = createT('ko')

function row(id, label, supports) {
  return {
    kind: 'item', id, section: 'mcp', group: null, label,
    hint: '미설치', fullHint: '미설치', statusDetail: null, status: 'absent',
    previewTarget: null, searchText: `${id} ${label}`.toLowerCase(),
    item: { id, category: 'mcp', label, scope: 'project', supports, unsupported: {} },
  }
}

// 상세가 짧은 행과 긴 행을 함께 둔다. Alpha·Bravo는 상세가 2~3줄이라
// 클램프 하한(4)에 함께 뭉개져, 패널이 내용에 종속돼도 자리가 안 갈린다 —
// 클램프 범위 안에 드는 행이 있어야 배분 변화가 드러난다.
const LONG = {
  kind: 'item', id: 'mcp.long', section: 'mcp', group: null, label: 'Long',
  hint: '미설치 · CLI 1/10', fullHint: '미설치', statusDetail: null, status: 'absent',
  previewTarget: null, searchText: 'mcp.long long',
  item: {
    id: 'mcp.long', category: 'mcp', label: 'Long', scope: 'project',
    supports: ['claude'],
    unsupported: {
      codex: msg('item.unsupported.claudePlugin'),
      gemini: msg('item.unsupported.claudeSkill'),
      kilo: msg('item.unsupported.ponytailUser'),
      kiro: msg('item.unsupported.ponytailRules'),
    },
  },
}

const ROWS = [row('mcp.a', 'Alpha', ['claude']), row('mcp.b', 'Bravo', ['claude', 'codex']), LONG]

// 커서를 옮길 때마다 패널 높이가 변하면 목록이 위아래로 출렁인다.
// 아코디언을 기각한 이유가 바로 그것이라, 높이는 터미널 크기로만 정한다.
test('패널 높이는 커서 위치와 무관하다', () => {
  const a = createState(ROWS)
  const b = move(a, 1) // Bravo — Alpha보다 상세가 한 줄 길다
  const c = move(a, 2) // Long — 클램프 범위([4,12]) 안에 드는 상세 길이
  // Alpha·Bravo·Long은 상세 길이가 저마다 다르다. 그런데도 패널이 시작하는
  // 자리는 같아야 한다. 총 줄 수만 비교하면 소용이 없다 — body + panel은
  // 언제나 room이라, 배분이 내용에 따라 흔들려도 합은 보존된다.
  const sep = (s) => render(s, { width: 80, height: 30, t: T }).findIndex((l) => l.startsWith('─'))
  assert.ok(sep(a) > 0, '구분선을 찾지 못하면 이 테스트는 아무것도 지키지 못한다')
  assert.equal(sep(a), sep(b), '커서를 옮기면 목록이 출렁인다 (Alpha↔Bravo)')
  assert.equal(sep(a), sep(c), '커서를 옮기면 목록이 출렁인다 (Alpha↔Long, 클램프 범위 안)')
  const at = (s) => render(s, { width: 80, height: 30, t: T }).length
  assert.equal(at(a), at(b))
  assert.equal(at(a), at(c))
})

test('지면이 넉넉하면 목록과 패널이 화면을 나눠 갖는다', () => {
  assert.ok(panelHeight(30) >= 4)
  assert.equal(bodyHeight(30) + panelHeight(30), 30 - 6)
})

// 목록이 3줄 밑으로 내려가는 쪽이 패널이 사라지는 것보다 나쁘다.
test('낮은 터미널에서는 패널이 사라지고 목록이 지면을 다 쓴다', () => {
  assert.equal(panelHeight(12), 0)
  assert.equal(bodyHeight(12), 12 - 6)
})

test('패널을 펼치면 목록 자리를 전부 가져간다', () => {
  assert.equal(bodyHeight(30, true), 0)
  assert.equal(panelHeight(30, true), 30 - 6)
})

test('화면 줄 수는 터미널 높이를 넘지 않고 어느 줄도 폭을 넘지 않는다', () => {
  const lines = render(createState(ROWS), { width: 60, height: 30, t: T })
  // 위아래 경계를 모두 잡는다 — 상한만 두면 빈 화면이 통과한다.
  assert.equal(lines.length, 30, `줄 수 ${lines.length}`)
  for (const line of lines) assert.ok(width(line) <= 60, `넘침: ${line}`)
})

test('커서 항목의 상세가 화면에 담긴다', () => {
  const text = render(createState(ROWS), { width: 60, height: 30, t: T }).join('\n')
  assert.match(text, /Alpha/)
  assert.match(text, /claude/)
})

test('고를 항목이 없으면 안내를 낸다', () => {
  const text = render(createState([]), { width: 60, height: 30, t: T }).join('\n')
  assert.match(text, /커서를 항목 위에/)
})

// 제출 검토 화면에는 패널이 없다. 목록 화면의 패널 자리를 여기서도 떼면
// 적용 직전 마지막 확인 화면이 이유 없이 변경을 감춘다.
test('제출 검토는 패널 자리를 빼앗기지 않는다', () => {
  const changes = Array.from({ length: 12 }, (_, n) => ({
    action: 'install', item: { label: `Item${n}`, supports: ['claude'] },
  }))
  const text = renderReview(changes, { width: 60, height: 24, t: T }).join('\n')
  assert.ok(text.includes('Item11'), '24줄 터미널이면 12건이 다 보여야 한다')
  assert.ok(!text.includes('…외'), '자를 이유가 없다')
})

// 순환 목록은 [null, ...CLI_IDS]지만 위치는 CLI 사이에서만 센다 — "전체"까지
// 세면 CLI가 열한 개인데 열두 번째가 있다고 읽힌다. codex는 두 번째 CLI다.
test('필터가 걸리면 검색줄 오른쪽에 CLI와 위치가 보인다', () => {
  const s = setCliFilter(createState(ROWS), 'codex')
  const text = render(s, { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] }).join('\n')
  assert.match(text, /CLI › codex/)
  assert.ok(text.includes(`(2/${CLI_IDS.length})`), '순환 위치가 보여야 한다')
  assert.ok(!text.includes(`/${CLI_IDS.length + 1})`), '"전체"는 CLI 수에 들어가면 안 된다')
})

// 검색칸 반전이 줄 끝까지 칠하면 오른쪽 필터 표시가 반전에 먹힌다.
test('검색칸 포커스에서도 필터 표시가 반전 밖에 남는다', () => {
  const s = setFocus(setCliFilter(createState(ROWS), 'codex'), 'search')
  const line = render(s, { width: 80, height: 30, color: true, t: T, cliOptions: [null, ...CLI_IDS] })[2]
  const RESET = `${String.fromCharCode(27)}[0m`
  const at = line.indexOf('CLI › codex')
  assert.ok(at !== -1, '필터 표시가 있어야 한다')
  const resetBefore = line.lastIndexOf(RESET, at)
  assert.ok(resetBefore !== -1 && resetBefore < at, '필터는 반전이 끝난 뒤에 와야 한다')
})

// 폭이 모자라면 검색이 이긴다 — 타이핑 중인 글자가 사라지면 안 된다.
test('좁은 폭에서는 필터 표시를 버리고 검색칸을 남긴다', () => {
  const s = setQuery(setCliFilter(createState(ROWS), 'codex'), 'alp')
  const lines = render(s, { width: 26, height: 30, t: T, cliOptions: [null, ...CLI_IDS] })
  const text = lines.join('\n')
  // 버렸다는 것을 직접 못박는다 — 폭 검사만으로는 필터가 그려졌는지 알 수 없다.
  assert.ok(!text.includes('CLI › codex'), '좁은 폭에서는 필터를 버려야 한다')
  assert.ok(text.includes('alp'), '검색어는 남아야 한다')
  for (const line of lines) assert.ok(width(line) <= 26, `넘침: ${line}`)
})

test('필터로 탭이 비면 그 사실을 알린다', () => {
  const s = setCliFilter(createState(ROWS), 'kiro')
  const text = render(s, { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] }).join('\n')
  assert.match(text, /kiro에 배선되는 항목이 없습니다/)
})

// 탭 줄은 "다른 탭에 뭐가 남았나"를 알려 주는 유일한 자리다. CLI 필터로
// 좁혔을 때도 걸러진 수가 보여야 사용자가 빈 탭에서 길을 잃지 않는다.
// codex를 고른 이유: ROWS에서 Bravo만 codex를 지원해(Alpha·Long은 claude만)
// shown(1) < total(3)이 되어 분할이 실제로 검증된다 — 전부 지원했다면
// 어느 쪽 분기든 같은 문자열이 나와 이 테스트가 아무것도 못 잡는다.
test('CLI 필터만 걸어도 탭 줄이 걸러진 수를 보여 준다', () => {
  const s = setCliFilter(createState(ROWS), 'codex')
  const bar = render(s, { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] })[1]
  assert.match(bar, /\d+\/\d+/, '필터 중에는 shown/total이 보여야 한다')
  assert.match(bar, /1\/3/, 'Bravo 하나만 codex를 지원하므로 1/3이어야 한다')
})

// 색 코드는 화면에서 0칸을 차지한다. 폭 계산에 섞이면 반전 배경이 일찍 끊기고,
// 좁은 폭 판정도 실제보다 짜게 나온다.
//
// plain(비컬러) 줄과 그대로 비교하지는 않는다 — 검색칸 포커스에서 비컬러
// 경로는 애초에 pad를 하지 않는다(반전을 칠하지 않으니 채울 이유가 없다).
// 그래서 두 줄의 가시 폭은 이 버그와 무관한 이유로도 다르다. 대신 컬러
// 경로가 스스로 지키기로 한 불변식 — 반전 입력칸(limit - tailWidth) + 필터
// 꼬리(tailWidth) = limit — 을 직접 겨눈다. width:80이면 w(=limit)는 79
// (마지막 칸은 항상 비운다).
test('색을 입혀도 검색줄의 가시 폭은 레이아웃이 의도한 값과 같다', () => {
  const s = setFocus(setCliFilter(createState(ROWS), 'codex'), 'search')
  const opts = { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] }
  const ESC = String.fromCharCode(27)
  const strip = (x) => x.split(ESC).map((p, i) => (i === 0 ? p : p.replace(/^\[[0-9;]*m/, ''))).join('')
  const painted = render(s, { ...opts, color: true })[2]
  assert.equal(width(strip(painted)), 79, 'width:80 → w(=limit)는 79여야 한다')
})

// 필터도 검색어도 걸려 있을 때, 정말 빈 이유가 검색어 때문이면 "이 CLI에는
// 배선된 게 없다"는 문구를 내면 안 된다 — claude는 ROWS의 세 행 모두
// 지원하므로 그 주장은 거짓이다. 빈 이유는 검색어(zzzz)가 아무것도
// 걸러내지 못했기 때문이다.
test('검색어 때문에 비었으면 CLI 전용 안내를 내지 않는다', () => {
  const s = setQuery(setCliFilter(createState(ROWS), 'claude'), 'zzzz')
  const text = render(s, { width: 80, height: 30, t: T, cliOptions: [null, ...CLI_IDS] }).join('\n')
  assert.ok(!text.includes('claude에 배선되는 항목이 없습니다'), 'CLI 전용 문구가 거짓으로 뜨면 안 된다')
  assert.match(text, /일치하는 항목이 없습니다/, '검색 안내가 대신 떠야 한다')
})

// ── 배타 항목의 라디오 표시 ───────────────────────────────────────
//
// 대괄호는 "여러 개 고를 수 있다"는 보편적 신호다. 한 파일에 한 벌만
// 놓이는 항목에 그대로 쓰면 화면이 거짓말을 한다.

function exclusiveRow(id, label) {
  return {
    ...row(id, label, undefined),
    section: 'config', exclusive: 'gitmessage',
    item: { id, category: 'config', label, scope: 'project', exclusive: 'gitmessage', unsupported: {} },
  }
}

// 둘을 같은 탭에 둔다 — createState는 첫 탭을 열므로 섹션이 갈리면
// 한쪽만 그려져 비교 자체가 성립하지 않는다.
const X_ROWS = [
  exclusiveRow('config.gitmessage.en', 'English commit template'),
  { ...row('mcp.a', 'Alpha', ['claude']), section: 'config' },
]

// X_ROWS는 전부 미설치라 켜면 '설치 예정'(+)이다 — 표식은 상태가 아니라
// 변경 예정을 말한다(changeMark).
test('배타 항목은 라디오로, 나머지는 체크박스로 그린다', () => {
  const on = render(createState(X_ROWS, { selectedIds: ['config.gitmessage.en', 'mcp.a'] }), { width: 80, height: 30, t: T }).join('\n')
  assert.ok(on.includes('(+) English commit template'), `라디오 켜짐이 아니다:\n${on}`)
  assert.ok(on.includes('[+] Alpha'), '일반 항목은 체크박스여야 한다')

  const off = render(createState(X_ROWS), { width: 80, height: 30, t: T }).join('\n')
  assert.ok(off.includes('( ) English commit template'), `라디오 꺼짐이 아니다:\n${off}`)
  assert.ok(off.includes('[ ] Alpha'))
})

// ── 종료 키 안내는 잘리지 않는다 ──────────────────────────────────
//
// 나머지 힌트는 좁은 터미널에서 뒤쪽부터 잘려 나가는데, 하필 그때 가장
// 절실한 것이 "여기서 어떻게 빠져나가나"다.

const lastLine = (opts) => render(createState(ROWS), { height: 30, t: T, ...opts }).at(-1)

test('종료 키 안내는 힌트 줄 오른쪽 끝에 고정된다', () => {
  const wide = lastLine({ width: 200 })
  assert.ok(wide.includes('Space 선택'), '넓은 화면에서는 나머지 힌트도 함께 나온다')
  assert.ok(wide.trimEnd().endsWith('Ctrl+Q 종료'), `오른쪽 끝이 아니다: "${wide}"`)
})

test('좁아서 힌트가 잘려도 종료 키는 남는다', () => {
  for (const w of [200, 100, 60, 40, 30, 24]) {
    const line = lastLine({ width: w })
    assert.ok(line.includes('Ctrl+Q 종료'), `width ${w}에서 종료 키가 사라졌다: "${line}"`)
    assert.ok(width(line) <= w, `width ${w}를 넘겼다: ${width(line)}`)
  }
})

test('상태 메시지가 힌트를 대신할 때도 종료 키는 남는다', () => {
  const line = render(createState(ROWS), { width: 100, height: 30, t: T, status: '이 항목은 미리보기가 없습니다.' }).at(-1)
  assert.ok(line.includes('미리보기가 없습니다'), '상태 메시지가 나와야 한다')
  assert.ok(line.trimEnd().endsWith('Ctrl+Q 종료'))
})

test('검토 화면도 종료 키를 안내한다', () => {
  const changes = [{ action: 'install', item: { label: 'Alpha' } }]
  const text = renderReview(changes, { width: 80, height: 24, t: T }).join('\n')
  assert.ok(text.includes('Ctrl+Q 종료'))
})

// ── 변경 예정 표식과 머리글 건수 ──────────────────────────────────
//
// 예전에는 ×가 "설치됨(유지)"과 "새로 고름"에 똑같이 쓰였고, 설치된 항목의
// 체크를 풀면 빈 칸이 돼 힌트의 '설치됨'과 조합해야 제거 예정임을 알 수 있었다.

function statusRow(id, label, status) {
  return { ...row(id, label, ['claude']), status }
}

const S_ROWS = [
  statusRow('mcp.keep', 'Keep', 'installed'),
  statusRow('mcp.drop', 'Drop', 'installed'),
  statusRow('mcp.add', 'Add', 'absent'),
  statusRow('mcp.none', 'None', 'absent'),
  statusRow('mcp.fill', 'Fill', 'partial'),
]

test('체크 표식은 상태가 아니라 변경 예정을 말한다', () => {
  // keep·add·fill 켜짐, drop·none 꺼짐.
  const text = render(createState(S_ROWS, { selectedIds: ['mcp.keep', 'mcp.add', 'mcp.fill'] }), { width: 80, height: 30, t: T }).join('\n')
  assert.ok(text.includes('[×] Keep'), '설치돼 있고 그대로 두면 ×')
  assert.ok(text.includes('[-] Drop'), '설치돼 있는데 풀었으면 - (제거 예정)')
  assert.ok(text.includes('[+] Add'), '없는데 골랐으면 + (설치 예정)')
  assert.ok(text.includes('[ ] None'), '없고 안 골랐으면 빈 칸')
  assert.ok(text.includes('[+] Fill'), '일부 설치를 골랐으면 + (보완 설치 예정)')
})

test('머리글에 변경 예정 건수가 보인다', () => {
  // 일부 설치(fill)는 켜면 보완, 끄면 제거라 어느 쪽이든 변경이다 — 0건
  // 사례에서는 뺀다. keep·drop을 그대로 켜 두면 바뀔 것이 없다.
  const steady = S_ROWS.filter((r) => r.id !== 'mcp.fill')
  const none = render(createState(steady, { selectedIds: ['mcp.keep', 'mcp.drop'] }), { width: 100, height: 30, t: T })[0]
  assert.match(none, /변경 예정 0건/)
  assert.doesNotMatch(none, /\(\+/, '0건이면 +·- 내역을 붙이지 않는다')
  const three = render(createState(S_ROWS, { selectedIds: ['mcp.keep', 'mcp.add', 'mcp.fill'] }), { width: 100, height: 30, t: T })[0]
  // drop 제거 + add 설치 + fill 보완 = 3건. engine.planChanges와 같은 판정이다.
  // 괄호 안에 +·- 내역을 붙여 행의 표식과 같은 글자로 읽히게 한다.
  assert.match(three, /변경 예정 3건 \(\+2 -1\)/)
})

// ── 바닥글이 두 줄로 접힌다 ────────────────────────────────────────
//
// 80칸 한국어 화면에서 힌트가 `Ctrl+A 전체   C…`에서 끊겨 CLI 필터(Ctrl+F)·
// 상세(Ctrl+D)를 발견할 길이 없었다.

test('80칸에서도 Ctrl+F·Ctrl+D 안내가 보인다 — 힌트가 두 줄로 접힌다', () => {
  const lines = render(createState(ROWS), { width: 80, height: 30, t: T })
  assert.equal(lines.length, 30)
  const tail = lines.slice(-2).join('\n')
  assert.ok(tail.includes('Ctrl+F'), `Ctrl+F가 없다:\n${tail}`)
  assert.ok(tail.includes('Ctrl+D'), `Ctrl+D가 없다:\n${tail}`)
  assert.ok(lines.at(-1).trimEnd().endsWith('Ctrl+Q 종료'), '종료 키는 마지막 줄 오른쪽 끝')
  for (const line of lines) assert.ok(width(line) <= 80, `넘침: ${line}`)
})

test('넓은 화면에서는 바닥글이 한 줄이고 목록이 그만큼 넓다', () => {
  assert.equal(footerHeight(200, T), 1)
  assert.equal(footerHeight(80, T), 2)
  // 목록 지면은 바닥글 줄 수만큼 준다.
  assert.equal(bodyHeight(30, false, 2) + panelHeight(30, false, 2), 30 - 7)
})

test('포커스를 옮겨도 바닥글 줄 수가 변하지 않는다 — 목록이 출렁이면 안 된다', () => {
  const list = render(createState(ROWS), { width: 80, height: 30, t: T })
  const search = render(setFocus(createState(ROWS), 'search'), { width: 80, height: 30, t: T })
  const sep = (ls) => ls.findIndex((l) => l.startsWith('─'))
  assert.equal(sep(list), sep(search))
})

// ── 라벨 열·머리글 경로·도움말 ─────────────────────────────────────────
import { labelColumn, renderHelp, LABEL_WIDTH } from '../lib/tui/render.mjs'

test('라벨 열은 넓은 화면에서 긴 라벨만큼 늘고 좁은 화면에서는 24칸이다', () => {
  const long = { ...row('mcp.l', 'Understand Anything (저장소)', ['claude']) }
  assert.equal(labelColumn([long], 79), LABEL_WIDTH, '80칸에서는 힌트 자리(50칸)를 지켜 24칸에 머문다')
  assert.equal(labelColumn([long], 119), width(long.label), '120칸에서는 라벨만큼 늘어난다')
  assert.ok(labelColumn([long], 119) >= width(long.label), '120칸에서는 라벨이 다 들어간다')
  const text = render(createState([long]), { width: 120, height: 24, t: T }).join('\n')
  assert.ok(text.includes('Understand Anything (저장소)'), `라벨이 잘렸다:\n${text}`)
})

test('머리글은 자리가 없으면 저장소의 마지막 디렉터리 이름만 쓴다', () => {
  const repo = 'D:/Sources/github/Agent-Setup'
  const wide = render(createState(ROWS), { width: 140, height: 24, t: T, repo })[0]
  assert.ok(wide.includes(repo), '넓으면 전체 경로')
  const narrow = render(createState(ROWS), { width: 80, height: 24, t: T, repo })[0]
  assert.ok(narrow.includes('Agent-Setup'), `좁으면 마지막 이름: ${narrow}`)
  assert.ok(!narrow.includes('…'), `잘린 경로가 남았다: ${narrow}`)
})

test('도움말 화면은 모든 키를 담고 화면을 넘지 않는다', () => {
  const lines = renderHelp({ width: 80, height: 24, t: T })
  assert.ok(lines.length <= 24)
  const text = lines.join('\n')
  for (const key of ['Home', 'Ctrl+F', 'Ctrl+D', 'Ctrl+Q', 'F1'].filter((k) => k !== 'F1')) assert.ok(text.includes(key), `${key} 안내가 없다`)
  assert.match(text, /아무 키나/)
  for (const line of lines) assert.ok(width(line) <= 80, `넘침: ${line}`)
})
