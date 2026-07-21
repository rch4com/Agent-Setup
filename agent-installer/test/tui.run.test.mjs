import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { runTui } from '../lib/tui/run.mjs'
import { makeTempRepo, makeCapture, recordingOpener } from './helpers.mjs'

// 가짜 TTY로 키 루프를 돌린다. keyReader가 이벤트를 큐에 쌓으므로
// 리스너가 붙은 뒤에는 한꺼번에 밀어 넣어도 순서대로 소비된다.
//
// 타임아웃은 필수다 — 키 시퀀스가 루프를 빠져나오지 못하면 runTui가 영원히
// 다음 키를 기다리고, 테스트 스위트가 통째로 멈춘 채 죽는다. 빨리 실패시킨다.
async function drive(keys, opts = {}) {
  const stdin = new EventEmitter()
  stdin.isTTY = true
  stdin.setRawMode = () => {}
  stdin.resume = () => {}
  stdin.pause = () => {}

  const frames = []
  const stdout = { columns: 100, rows: 24, isTTY: true, write: (s) => frames.push(s) }

  const cap = makeCapture()
  const done = runTui(opts.root ?? makeTempRepo(), {
    dryRun: true, log: cap.log, env: { NO_COLOR: '1' }, stdin, stdout, ...opts,
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
const CC = { name: 'c', ctrl: true }
const ANY = { str: 'x', name: 'x' } // "계속하려면 아무 키나"
// 검색칸+검색어 상태에서도 확실히 빠져나오도록 세 번: 검색어 지우기 → 목록으로 → 종료.
const QUIT = [ESC, ESC, ESC]
// 작업 → PLUGIN → MCP. 탭 순서는 SECTION_ORDER가 고정한다.
const TO_MCP = [TAB, TAB]
const TO_DESIGN = [TAB, TAB, TAB, TAB]

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
  const { screen, log } = await drive([
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
  assert.equal(log.includes('설치 Supabase'), true)
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
  // 커서는 처음에 작업 탭의 부트스트랩 행에 있다(목록 포커스).
  const { log } = await drive([ENTER, ANY, ...QUIT])
  assert.equal(log.includes('공통 지침'), true, `부트스트랩이 실행되지 않았다: ${log}`)
})

test('액션 행에서 Space는 체크되지 않는다 — 제거 개념이 없는 작업이다', async () => {
  const { screen } = await drive([SPACE, ...QUIT])
  assert.equal(screen.includes('[×] 부트스트랩'), false)
  assert.equal(screen.includes('Enter로 실행합니다'), true)
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
