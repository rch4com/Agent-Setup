import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { runTui } from '../lib/tui/run.mjs'
import { makeTempRepo, makeCapture, recordingOpener } from './helpers.mjs'

// 가짜 TTY로 키 루프를 돌린다. keyReader가 이벤트를 큐에 쌓으므로
// 리스너가 붙은 뒤에는 한꺼번에 밀어 넣어도 순서대로 소비된다.
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

  const result = await done
  return { result, frames, screen: frames.join(''), log: cap.text() }
}

const type = (text) => [...text].map((str) => ({ str, name: str }))
const ESC = { name: 'escape' }

test('타이핑하면 걸러지고, Esc 두 번이면(비우고 나서) 빠져나온다', async () => {
  const { result, screen } = await drive([...type('zzz'), ESC, ESC])
  assert.equal(result.interactive, true)
  assert.equal(screen.includes('일치하는 항목이 없습니다'), true)
})

test('Ctrl+C는 즉시 빠져나온다', async () => {
  const { result } = await drive([{ name: 'c', ctrl: true }])
  assert.equal(result.interactive, true)
})

test('검색 → Tab 토글 → Enter는 적용 요약을 먼저 보여주고 확인을 받는다', async () => {
  const { log } = await drive([
    ...type('supabase'),
    { name: 'tab' },
    { name: 'return' },
    { str: 'n', name: 'n' },        // 확인에 아니오
    { str: ' ', name: 'space' },    // "계속하려면 아무 키나"
    ESC, ESC,
  ])
  assert.equal(log.includes('적용할 변경'), true)
  assert.equal(log.includes('설치 Supabase'), true)
  assert.equal(log.includes('취소했습니다.'), true)
})

test('변경이 없으면 Enter가 적용 화면으로 들어가지 않는다', async () => {
  const { log } = await drive([{ name: 'return' }, ESC])
  assert.equal(log.includes('적용할 변경'), false)
})

test('Ctrl+O는 커서 항목을 열고, 미리보기가 없는 항목은 안내만 한다', async () => {
  const opener = recordingOpener()
  const { screen } = await drive([...type('stripe'), { name: 'o', ctrl: true }, ESC, ESC], { opener })
  assert.equal(opener.targets.length, 1)
  assert.equal(opener.targets[0].includes('stripe'), true)

  const bare = recordingOpener()
  const noPreview = await drive([...type('supabase'), { name: 'o', ctrl: true }, ESC, ESC], { opener: bare })
  assert.deepEqual(bare.targets, [])
  assert.equal(noPreview.screen.includes('미리보기를 제공하지 않습니다'), true)
})

test('액션 행에서 Tab을 눌러도 체크 상태로 바뀌지 않는다', async () => {
  // 커서는 처음에 액션 행(부트스트랩)에 있다. Tab이 토글이었다면 [×]가 찍힌다.
  const { screen } = await drive([{ name: 'tab' }, { str: ' ', name: 'space' }, ESC, ESC], { dryRun: true })
  assert.equal(screen.includes('[×] 부트스트랩'), false)
})
