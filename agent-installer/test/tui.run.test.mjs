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
  return { result, frames, screen: frames.join(''), log: cap.text() }
}

const type = (text) => [...text].map((str) => ({ str, name: str }))
const TAB = { name: 'tab' }
const SPACE = { str: ' ', name: 'space' }
const ENTER = { name: 'return' }
const ESC = { name: 'escape' }
const ANY = { str: 'x', name: 'x' } // "계속하려면 아무 키나"
// 작업 → PLUGIN → MCP. 탭 순서는 SECTION_ORDER가 고정한다.
const TO_MCP = [TAB, TAB]

test('타이핑하면 검색 모드로 들어가고, Esc 두 번이면(비우고 나서) 빠져나온다', async () => {
  const { result, screen } = await drive([...type('zzz'), ESC, ESC])
  assert.equal(result.interactive, true)
  assert.equal(screen.includes('이 탭에는 일치하는 항목이 없습니다'), true)
})

test('Ctrl+C는 즉시 빠져나온다', async () => {
  const { result } = await drive([{ name: 'c', ctrl: true }])
  assert.equal(result.interactive, true)
})

test('Tab은 탭을 옮긴다 — 활성 표시가 따라 움직인다', async () => {
  const { frames } = await drive([TAB, ESC])
  assert.equal(frames.some((f) => f.includes('[작업')), true, '첫 화면이 작업 탭이 아니다')
  assert.equal(frames.some((f) => f.includes('[PLUGIN')), true, 'Tab 뒤에 PLUGIN 탭이 활성이 아니다')
})

test('Space로 선택하고 Enter로 제출하면 검토 화면을 거쳐 일괄 적용된다', async () => {
  const { screen, log } = await drive([
    ...TO_MCP,
    ...type('supabase'), // 검색 모드 진입 — MCP 탭 안에서 걸러진다
    ENTER,               // 검색 확정(검색어 유지, 탐색 모드로)
    SPACE,               // 선택
    ENTER,               // 제출 → 검토 화면
    ENTER,               // 적용
    ANY,                 // "계속하려면 아무 키나"
    ESC, ESC,
  ])
  assert.equal(screen.includes('제출 검토'), true, '검토 화면이 뜨지 않았다')
  assert.equal(log.includes('적용할 변경'), true)
  assert.equal(log.includes('설치 Supabase'), true)
})

// 회귀: Space가 검색 모드에서 검색어로 삼켜지면, 검색해서 찾자마자 선택하는
// 가장 자연스러운 순서에서 아무것도 선택되지 않은 채 "변경할 항목이 없습니다"만 나온다.
// 겉보기에는 설치(파일 복사)가 안 되는 것처럼 보인다.
test('검색 직후 Space로 바로 선택된다 — 모드와 무관하게 Space는 언제나 선택이다', async () => {
  const { screen, log } = await drive([
    ...TO_MCP,
    ...type('supabase'), // 검색 모드로 진입한 상태 그대로
    SPACE,               // Enter로 빠져나오지 않고 곧바로 선택
    ENTER,               // 검색 확정
    ENTER,               // 제출 → 검토 화면
    ENTER,               // 적용
    ANY, ESC, ESC,
  ])
  assert.equal(screen.includes('변경할 항목이 없습니다'), false, 'Space가 선택되지 않고 삼켜졌다')
  assert.equal(log.includes('설치 Supabase'), true)
})

test('검색 중 Space는 검색어에 들어가지 않는다 — 검색은 한 단어다', async () => {
  const { screen } = await drive([...TO_MCP, ...type('sup'), SPACE, SPACE, ESC, ESC])
  assert.equal(/검색 › sup\s+▌/.test(screen), false, `검색어에 공백이 섞였다: ${screen.match(/검색 › [^\n]*/g)?.pop()}`)
})

test('검토 화면에서 Esc는 취소한다 — 아무것도 적용되지 않는다', async () => {
  const { screen, log } = await drive([
    ...TO_MCP, ...type('supabase'), ENTER, SPACE,
    ENTER, // 제출 → 검토 화면
    ESC,   // 취소
    ESC, ESC,
  ])
  assert.equal(screen.includes('제출 검토'), true)
  assert.equal(screen.includes('제출을 취소했습니다'), true)
  assert.equal(log.includes('적용할 변경'), false)
})

test('변경이 없으면 Enter가 검토 화면으로 들어가지 않는다', async () => {
  const { screen, log } = await drive([...TO_MCP, ENTER, ESC])
  assert.equal(screen.includes('변경할 항목이 없습니다'), true)
  assert.equal(screen.includes('제출 검토'), false)
  assert.equal(log.includes('적용할 변경'), false)
})

test('액션 행에서 Enter는 그 작업을 실행한다', async () => {
  // 커서는 처음에 작업 탭의 부트스트랩 행에 있다.
  const { log } = await drive([ENTER, ANY, ESC])
  assert.equal(log.includes('공통 지침'), true, `부트스트랩이 실행되지 않았다: ${log}`)
})

test('액션 행에서 Space는 체크되지 않는다 — 제거 개념이 없는 작업이다', async () => {
  const { screen } = await drive([SPACE, ESC])
  assert.equal(screen.includes('[×] 부트스트랩'), false)
  assert.equal(screen.includes('Enter로 실행합니다'), true)
})

test('Ctrl+A는 지금 탭에서 보이는 항목을 한 번에 켜고 끈다', async () => {
  const { screen } = await drive([...TO_MCP, { name: 'a', ctrl: true }, ESC])
  assert.equal(screen.includes('모두 선택'), true)
})

test('Ctrl+O는 커서 항목을 열고, 미리보기가 없는 항목은 안내만 한다', async () => {
  const opener = recordingOpener()
  // DESIGN.MD 탭까지 이동(작업 → PLUGIN → MCP → SKILL → DESIGN.MD).
  await drive([TAB, TAB, TAB, TAB, ...type('stripe'), { name: 'o', ctrl: true }, ESC, ESC], { opener })
  assert.equal(opener.targets.length, 1)
  assert.equal(opener.targets[0].includes('stripe'), true)

  const bare = recordingOpener()
  const noPreview = await drive([...TO_MCP, ...type('supabase'), { name: 'o', ctrl: true }, ESC, ESC], { opener: bare })
  assert.deepEqual(bare.targets, [])
  assert.equal(noPreview.screen.includes('미리보기를 제공하지 않습니다'), true)
})
