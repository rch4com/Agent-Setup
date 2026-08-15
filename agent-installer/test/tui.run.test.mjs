import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { existsSync, writeFileSync } from 'node:fs'
import { delimiter, join } from 'node:path'
import { runTui } from '../lib/tui/run.mjs'
import { createT, msg, toText } from '../lib/i18n/index.mjs'
import { readRecord } from '../lib/bootstrap/record.mjs'
import { GITMESSAGE_KO } from '../lib/gitmessage.mjs'
import { makeTempRepo, makeCapture, recordingOpener, isolateGlobalHome } from './helpers.mjs'

// 전역 항목(global.superpowers)이 진짜 홈을 읽으면 이 파일의 "변경 없음"류
// 단언이 머신 상태에 따라 뒤집힌다.
isolateGlobalHome()

// 가짜 TTY로 키 루프를 돌린다. keyReader가 이벤트를 큐에 쌓으므로
// 리스너가 붙은 뒤에는 한꺼번에 밀어 넣어도 순서대로 소비된다.
//
// 타임아웃은 필수다 — 키 시퀀스가 루프를 빠져나오지 못하면 runTui가 영원히
// 다음 키를 기다리고, 테스트 스위트가 통째로 멈춘 채 죽는다. 빨리 실패시킨다.
async function drive(keys, opts = {}) {
  // columns는 runTui가 아니라 가짜 stdout이 받는다. 상태줄은 폭에 맞춰
  // 잘리므로, 긴 문구를 통째로 단언하려면 넓은 터미널이 필요하다.
  const { columns = 100, ...rest } = opts

  const stdin = new EventEmitter()
  stdin.isTTY = true
  stdin.setRawMode = () => {}
  stdin.resume = () => {}
  stdin.pause = () => {}

  const frames = []
  const stdout = { columns, rows: 24, isTTY: true, write: (s) => frames.push(s) }

  const cap = makeCapture()
  const done = runTui(rest.root ?? makeTempRepo(), {
    dryRun: true, log: cap.log, env: { NO_COLOR: '1' }, stdin, stdout, t: createT('ko'), ...rest,
  })

  while (stdin.listenerCount('keypress') === 0) await new Promise((r) => setImmediate(r))
  for (const k of keys) stdin.emit('keypress', k.str, k)

  let timer
  const result = await Promise.race([
    done,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('runTui가 끝나지 않았습니다 — 키 시퀀스가 루프를 빠져나오지 못했습니다.')), 10000)
      timer.unref()
    }),
  ])
  clearTimeout(timer)
  // 마지막으로 그려진 목록 화면(검토 화면 등 제외)만 따로 뽑아 포커스 검증에 쓴다.
  const lastListFrame = frames.filter((f) => f.includes('검색 ›')).pop() ?? ''
  return { result, frames, screen: frames.join(''), lastListFrame, log: cap.text() }
}

const type = (text) => [...text].map((str) => ({ str, name: str }))
const TAB = { name: 'tab' }
const DOWN = { name: 'down' }
const UP = { name: 'up' }
const SPACE = { str: ' ', name: 'space' }
const ENTER = { name: 'return' }
const ESC = { name: 'escape' }
const LEFT = { name: 'left' }
const CC = { name: 'c', ctrl: true }
const ANY = { str: 'x', name: 'x' } // "계속하려면 아무 키나"
// 검색칸+검색어 상태에서도 확실히 빠져나오도록 세 번: 검색어 지우기 → 목록으로 → 종료.
const QUIT = [ESC, ESC, ESC]
// 작업 → PLUGIN → MCP → SKILL → CONFIG → DESIGN.MD. 탭 순서는 SECTION_ORDER가 고정한다.
const TO_MCP = [TAB, TAB]
const TO_DESIGN = [TAB, TAB, TAB, TAB, TAB]

test('Ctrl+C는 즉시 빠져나온다', async () => {
  const { result } = await drive([CC])
  assert.equal(result.interactive, true)
})

test('타이핑하면 검색칸으로 올라가고(▌) 결과가 걸러진다', async () => {
  const { screen } = await drive([...type('zzz'), ...QUIT])
  assert.equal(screen.includes('zzz▌'), true, '검색칸 포커스로 올라가지 않았다')
  assert.equal(screen.includes('이 탭에는 일치하는 항목이 없습니다'), true)
})

test('Tab은 탭을 옮긴다 — 활성 표시가 따라 움직인다', async () => {
  const { frames } = await drive([TAB, ...QUIT])
  assert.equal(frames.some((f) => f.includes('[작업')), true, '첫 화면이 작업 탭이 아니다')
  assert.equal(frames.some((f) => f.includes('[PLUGIN')), true, 'Tab 뒤에 PLUGIN 탭이 활성이 아니다')
})

test('검색 → ↓로 목록 진입 → Space 선택 → 제출 → 일괄 적용', async () => {
  const { screen, frames, log } = await drive([
    ...TO_MCP,
    ...type('supabase'), // 검색칸 포커스로 올라가 걸러진다
    DOWN,                // 목록으로 내려간다(첫 결과가 커서)
    SPACE,               // 선택
    ENTER,               // 제출 → 검토 화면
    ENTER,               // 적용
    ANY,                 // "계속하려면 아무 키나"
    ...QUIT,
  ])
  assert.equal(screen.includes('제출 검토'), true, '검토 화면이 뜨지 않았다')
  // Task 11부터 성공한 항목은 로그에 나열되지 않는다 — 진행 화면이 대신
  // 보여 준다(runApply의 onProgress). log는 실패 사연 전용으로 좁혀졌다.
  //
  // screen 전체에서 찾으면 목록·검토 화면이 이미 같은 라벨을 그려 놓아
  // 진행 화면이 통째로 비어 있어도 통과한다. 진행 화면만 골라 그 안에서 본다.
  const progressFrame = frames.filter((f) => f.includes('적용 중')).pop() ?? ''
  assert.ok(progressFrame.includes('Supabase MCP'), '진행 화면에 항목 라벨이 없다')
  assert.equal(log.includes('Supabase'), false, '성공한 항목은 log에 남지 않아야 한다')
})

// 이 UX의 핵심: 검색칸에서는 스페이스가 검색어로 들어가 두 단어 검색이 된다.
test('검색칸에서 Space는 검색어에 들어간다 — 두 단어 검색이 가능하다', async () => {
  const { lastListFrame, screen } = await drive([...TO_MCP, ...type('supabase'), SPACE, ...type('mcp'), CC])
  assert.equal(lastListFrame.includes('supabase mcp▌'), true, `두 단어가 검색어로 들어가지 않았다: ${lastListFrame.match(/검색 › [^\n]*/)?.[0]}`)
  assert.equal(screen.includes('Supabase'), true, '두 단어 검색 결과가 비었다')
})

test('목록 맨 위에서 ↑를 누르면 검색칸으로 되돌아간다', async () => {
  const { lastListFrame } = await drive([...TO_MCP, ...type('sup'), DOWN, UP, CC])
  assert.equal(lastListFrame.includes('▌'), true, '맨 위 ↑가 검색칸으로 포커스를 되돌리지 않았다')
})

test('검토 화면에서 Esc는 취소한다 — 아무것도 적용되지 않는다', async () => {
  const { screen, log } = await drive([
    ...TO_MCP, ...type('supabase'), DOWN, SPACE,
    ENTER, // 제출 → 검토 화면
    ESC,   // 취소
    ...QUIT,
  ])
  assert.equal(screen.includes('제출 검토'), true)
  assert.equal(screen.includes('제출을 취소했습니다'), true)
  assert.equal(log.includes('적용할 변경'), false)
})

test('변경이 없으면 Enter가 검토 화면으로 들어가지 않는다', async () => {
  const { screen, log } = await drive([...TO_MCP, ENTER, ...QUIT])
  assert.equal(screen.includes('변경할 항목이 없습니다'), true)
  assert.equal(screen.includes('제출 검토'), false)
  assert.equal(log.includes('적용할 변경'), false)
})

test('액션 행에서 Enter는 그 작업을 실행한다', async () => {
  // 커서는 처음에 작업 탭의 언어 행에 있다(목록 포커스) — 한 칸 내려가야 부트스트랩 행이다.
  const { log } = await drive([DOWN, ENTER, ANY, ...QUIT])
  assert.equal(log.includes('공통 지침'), true, `부트스트랩이 실행되지 않았다: ${log}`)
})

test('액션 행에서 Space는 체크되지 않는다 — 제거 개념이 없는 작업이다', async () => {
  const { screen } = await drive([SPACE, ...QUIT])
  assert.equal(screen.includes('[×] 부트스트랩'), false)
  assert.equal(screen.includes('Enter로 실행합니다'), true)
})

// ── 언어 행 ───────────────────────────────────────────────────────

test('언어 행에서 Enter를 누르면 화면 언어가 바뀐다', async () => {
  // 커서는 첫 행(언어)에 있다. Enter로 en → ko, 그 뒤 Esc로 종료.
  const { screen } = await drive([ENTER, ESC], { t: createT('en') })
  assert.match(screen, /한국어/, '두 번째 로케일로 넘어가지 않았다')
})

test('언어 전환이 설치 기록에 남는다', async () => {
  const root = makeTempRepo()
  await drive([ENTER, ESC], { root, t: createT('en'), dryRun: false })
  assert.equal(readRecord(root).lang, 'ko')
})

test('dry-run에서는 언어를 기록하지 않는다', async () => {
  const root = makeTempRepo()
  await drive([ENTER, ESC], { root, t: createT('en') })
  assert.equal(readRecord(root), null)
})

test('언어 전환은 순환한다', async () => {
  // en → ko → en. 읽을 수 없는 언어에 갇혀도 Enter만 반복해 빠져나온다.
  const root = makeTempRepo()
  await drive([ENTER, ENTER, ESC], { root, t: createT('en'), dryRun: false })
  assert.equal(readRecord(root).lang, 'en')
})

// localeForced는 "이번 전환이 안 먹는다"가 아니다 — 전환은 그 자리에서
// 적용된다(읽을 수 없는 언어에 갇힌 사용자가 빠져나올 길이다). 상태줄이
// 알릴 것은 다음 실행에서 플래그·환경변수가 다시 이긴다는 사실뿐이다.
test('로케일이 강제돼도 전환은 이번 실행에 적용되고, 다음 실행을 안내한다', async () => {
  const root = makeTempRepo()
  const { screen, lastListFrame } = await drive([ENTER, ESC], {
    root, t: createT('en'), dryRun: false, localeForced: true, columns: 160,
  })

  // 화면은 실제로 한국어로 바뀌었다.
  assert.match(screen, /한국어/, '강제 로케일에서 전환이 화면에 반영되지 않았다')
  // 그리고 상태줄이 다음 실행을 예고한다.
  assert.match(lastListFrame, /다음 실행에서는 --lang \/ AGENT_SETUP_LANG이 여전히 이깁니다/)
  // "저장했습니다"가 두 번 나오면 안 된다 — 저장 알림과 이어 붙는 문구다.
  assert.equal(lastListFrame.match(/저장했습니다/g).length, 1, '저장 알림이 중복됐다')
})

test('로케일이 강제되지 않으면 다음 실행 안내를 붙이지 않는다', async () => {
  const root = makeTempRepo()
  const { lastListFrame } = await drive([ENTER, ESC], { root, t: createT('en'), dryRun: false })
  assert.doesNotMatch(lastListFrame, /여전히 이깁니다/)
})

test('언어 전환이 선택 집합을 보존한다', async () => {
  // Tab으로 다음 탭에 가서 Space로 하나 고르고, 다시 작업 탭으로 돌아와 Enter.
  const { result } = await drive([TAB, SPACE, LEFT, ENTER, ESC], { t: createT('en') })
  assert.equal(result.state.selected.size, 1, '언어를 바꾸자 선택이 날아갔다')
})

test('Ctrl+A는 지금 탭에서 보이는 항목을 한 번에 켜고 끈다', async () => {
  const { screen } = await drive([...TO_MCP, { name: 'a', ctrl: true }, ...QUIT])
  assert.equal(screen.includes('모두 선택'), true)
})

test('Ctrl+O는 커서 항목을 열고, 미리보기가 없는 항목은 안내만 한다', async () => {
  const opener = recordingOpener()
  await drive([...TO_DESIGN, ...type('stripe'), { name: 'o', ctrl: true }, ...QUIT], { opener })
  assert.equal(opener.targets.length, 1)
  assert.equal(opener.targets[0].includes('stripe'), true)

  const bare = recordingOpener()
  const noPreview = await drive([...TO_MCP, ...type('supabase'), { name: 'o', ctrl: true }, ...QUIT], { opener: bare })
  assert.deepEqual(bare.targets, [])
  assert.equal(noPreview.screen.includes('미리보기를 제공하지 않습니다'), true)
})

const CTRL_F = { name: 'f', ctrl: true }

// 글자 키는 전부 검색에 양보한다는 규칙이 이 TUI의 뼈대다. c를 필터에
// 배정하면 codex·claude를 검색어로 칠 수 없다.
// ESC 세 번: 검색어 지우기 → 목록으로 → 종료.
test('c와 d는 필터 키가 아니라 검색어로 들어간다', async () => {
  const { screen } = await drive([...type('cd'), ESC, ESC, ESC])
  assert.ok(screen.includes('검색 › cd'), 'cd가 검색어로 들어가야 한다')
  assert.ok(!screen.includes('CLI › c'), 'CLI 필터가 걸리면 안 된다')
})

test('Ctrl+F가 CLI 필터를 돌린다', async () => {
  const { screen } = await drive([CTRL_F, ESC])
  assert.ok(screen.includes('CLI › claude'), '첫 순환은 claude여야 한다')
})

// ── 적용 중 진행 화면 (Task 11) ──────────────────────────────────

// 적용 중에는 alt 화면을 떠나지 않는다. 예전에는 화면을 벗어나 로그를
// 한꺼번에 찍었고, 그 사이 사용자는 아무것도 볼 수 없었다.
// TAB으로 항목 탭에 들어가 하나 고르고, Enter(제출) → Enter(적용) →
// 아무 키(계속) → ESC(종료).
test('적용 중 화면이 진행 바를 그린다', async () => {
  const { screen } = await drive([TAB, SPACE, ENTER, ENTER, ANY, ESC])
  assert.ok(screen.includes('적용 중'), '진행 화면이 그려져야 한다')
})

// 이 테스트 하네스는 키를 전부 미리 큐에 밀어 넣는다(파일 상단 주석 참고).
// 그래서 Ctrl+C는 apply()가 첫 항목을 시작하기도 전에 이미 큐에 앉아
// 있고, shouldStop이 첫 항목 경계에서부터 이를 발견해 그 항목마저
// 건너뛴다 — "이미 도는 항목은 끝까지 간다"는 engine.mjs(Task 9) 쪽
// 계약이라 여기서는 검증하지 않는다. 이 테스트가 지키는 것은 배선이다:
// hasAbort가 큐를 훔치지 않아 그 뒤의 "아무 키나" 대기가 여전히 키를
// 받는다는 것, 건너뜀이 실패 사연으로도 종료 코드로도 새지 않는다는 것.
test('적용 중 Ctrl+C는 건너뜀으로 남기고 실패로 취급하지 않는다', async () => {
  const before = process.exitCode
  try {
    // 두 항목을 고른다 — footer의 건너뜀 집계가 실제 건수를 세는지까지
    // 검증하려면 건너뛴 항목이 하나뿐이면 안 된다(0건과 헷갈릴 여지가 없어야 한다).
    const { screen, log, result } = await drive([TAB, SPACE, DOWN, SPACE, ENTER, ENTER, CC, ANY, ...QUIT])

    assert.ok(screen.includes('중단했습니다'), '중단 화면이 그려지지 않았다')
    // run.mjs가 apply() 결과로 entries의 state를 미리 skipped로 덮어쓰면
    // progressLines의 pending→skipped 겹쳐 보기가 더는 pending을 찾지 못해
    // "0건 건너뜀"으로 어긋난다 — 실제 건수(2건)를 못박아 그 회귀를 잡는다.
    assert.match(screen, /2건 건너뜀/, '건너뜀 집계가 실제 건수와 어긋난다')
    assert.equal(log.includes('✖'), false, '건너뜀이 실패 사연으로 나오면 안 된다')
    assert.equal(process.exitCode, before, '사용자가 취소한 것을 실패로 세우면 안 된다')
    // ANY가 "아무 키나" 대기에 도달했고 그 뒤 ESC로 정상 종료됐다 —
    // hasAbort가 큐를 통째로 비우거나 다음 대기를 훔치지 않았다는 증거다.
    assert.equal(result.interactive, true, '"아무 키나" 대기가 키를 받지 못하고 멈췄다')
  } finally {
    process.exitCode = before
  }
})

// claude CLI가 실제로 PATH에 있으면 아래 테스트가 진짜 claude 프로세스를
// 띄워 marketplace add·plugin install을 시도한다 — 로컬 Claude Code 설정을
// 실제로 건드리는 부작용이라 테스트에서는 절대 안 된다. claude 실행 파일이
// 든 PATH 항목만 걸러 내, items.ponytail.test.mjs의 failingExec와 같은
// 조건(claude가 없는 환경)을 진짜 subprocess를 태우면서도 안전하게 재현한다.
function pathWithoutExecutable(name) {
  const names = process.platform === 'win32' ? [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`] : [name]
  return (process.env.PATH ?? '').split(delimiter)
    .filter((dir) => dir && !names.some((n) => existsSync(join(dir, n))))
    .join(delimiter)
}

// F2: definePlugin·ponytail은 claude CLI가 없으면 .claude/settings.json
// 직접 기록으로 대체하고, 그래도 성공(ok:true)으로 돌아오되 message를
// 남긴다(item.plugin.deferred) — 왜 대체 경로를 탔는지 사용자가 알아야
// 한다. dry-run의 exec는 항상 성공만 돌려주므로(lib/catalog.mjs makeExec)
// 이 대체 경로를 태우려면 dryRun:false로 실제 exec를 태워야 한다 — 아래
// '적용 실패는...' 테스트가 exec와 무관한 throw로 실패를 재현하는 것과
// 같은 이유다.
test('성공해도 메시지가 있으면 적용 뒤 로그에 남는다', async () => {
  const savedPath = process.env.PATH
  process.env.PATH = pathWithoutExecutable('claude')
  try {
    const root = makeTempRepo()
    const { log, result } = await drive([
      TAB, // 작업 탭 → PLUGIN 탭
      ...type('ponytail'),
      DOWN, SPACE,
      ENTER, // 제출 → 검토
      ENTER, // 적용
      ANY, ...QUIT,
    ], { root, dryRun: false })

    assert.ok(log.includes('✔'), '성공 표시가 로그에 없다')
    assert.ok(
      log.includes(toText(createT('ko'), msg('item.plugin.deferred'))),
      `대체 경로 사연이 로그에 없다: ${log}`,
    )
    assert.equal(result.interactive, true)
  } finally {
    process.env.PATH = savedPath
  }
})

// Ponytail은 opencode.jsonc의 plugin 키가 배열이 아니면 install()이
// LocalizedError를 던진다(lib/items/plugin.ponytail.mjs) — dry-run에서도
// 피할 수 없는 실제 실패 경로다. dry-run의 exec는 항상 성공만 돌려주므로
// (lib/catalog.mjs makeExec) 이 항목 말고는 dry-run에서 apply()를 실패시킬
// 방법이 없다.
test('적용 실패는 화면 밖에서 사연을 보여 주고 종료 코드를 세운다', async () => {
  const before = process.exitCode
  try {
    const root = makeTempRepo()
    writeFileSync(join(root, 'opencode.jsonc'), JSON.stringify({ plugin: 'not-an-array' }))

    const { screen, log, result } = await drive([
      TAB, // 작업 탭 → PLUGIN 탭
      ...type('ponytail'),
      DOWN, SPACE,
      ENTER, // 제출 → 검토
      ENTER, // 적용
      ANY, ...QUIT,
    ], { root })

    assert.ok(screen.includes('적용 중'), '진행 화면이 그려지지 않았다')
    assert.ok(log.includes('✖'), '실패 사연이 화면 밖으로 나오지 않았다')
    assert.ok(log.includes('plugin 키가 배열이 아닙니다'), `실패 메시지가 로그에 없다: ${log}`)
    assert.equal(process.exitCode, 1, '실패는 종료 코드를 세워야 한다')
    assert.equal(result.interactive, true)
  } finally {
    process.exitCode = before
  }
})

// ── 종료 전용 키 ──────────────────────────────────────────────────
//
// Ctrl+C는 "중단"이고 Esc는 검색어·포커스를 먼저 되돌리느라 최대 세 번을
// 눌러야 나간다 — 어느 쪽도 "나가는 키"로 배우기 어렵다. Ctrl+Q는 어느
// 상태에서든 한 번에 통해야 그 몫을 한다.
const CQ = { name: 'q', ctrl: true }

test('Ctrl+Q는 목록에서 즉시 빠져나온다', async () => {
  const { result } = await drive([CQ])
  assert.equal(result.interactive, true)
})

test('Ctrl+Q는 검색어를 친 상태에서도 한 번에 빠져나온다', async () => {
  // Esc였다면 검색어 지우기 → 목록으로 → 종료까지 세 번이 필요한 자리다.
  const { result } = await drive([...type('supabase'), CQ])
  assert.equal(result.interactive, true)
})

test('Ctrl+Q는 검토 화면에서도 빠져나온다', async () => {
  const { result, log } = await drive([...TO_MCP, ...type('supabase'), SPACE, CQ, CQ])
  assert.equal(result.interactive, true)
  assert.equal(log.includes('적용'), false, '검토 화면에서 나갔으므로 적용이 돌면 안 된다')
})

test('종료 키 안내가 화면에 늘 떠 있다', async () => {
  const { lastListFrame } = await drive([CQ])
  assert.ok(lastListFrame.includes('Ctrl+Q 종료'), '종료 키 안내가 화면에 없다')
})

// 배타 묶음에서 체크가 조용히 뒤집히면 사용자는 자기가 잘못 눌렀다고 읽는다.
test('배타 항목을 바꾸면 무엇이 해제됐는지 알린다', async () => {
  const root = makeTempRepo()
  writeFileSync(join(root, '.gitmessage.txt'), GITMESSAGE_KO)
  // CONFIG 탭으로 가서 영어판을 고른다 — 한국어판이 이미 켜져 있는 자리다.
  // 타이핑은 검색칸으로 올라가므로 DOWN으로 목록에 내려와야 Space가 선택이 된다.
  const { screen } = await drive([TAB, TAB, TAB, TAB, ...type('english'), DOWN, SPACE, CQ], { root, columns: 160 })
  assert.match(screen, /한 자리를 두고 다투므로/, `배타 전환 안내가 없다`)
  assert.match(screen, /Korean commit template/)
})
