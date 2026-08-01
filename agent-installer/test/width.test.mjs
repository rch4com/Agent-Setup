import test from 'node:test'
import assert from 'node:assert/strict'
import { wrap, width } from '../lib/width.mjs'

test('영문은 공백에서 끊는다', () => {
  assert.deepEqual(wrap('abc def ghi', 7), ['abc def', 'ghi'])
})

test('공백이 없으면 표시 폭에서 끊는다', () => {
  assert.deepEqual(wrap('abcdefgh', 3), ['abc', 'def', 'gh'])
})

// 한글은 한 글자가 두 칸이다. 코드 유닛으로 세면 한 줄에 두 배가 들어가
// 터미널에서 줄이 넘친다.
test('한글은 표시 폭 두 칸으로 센다', () => {
  assert.deepEqual(wrap('가나다라마', 4), ['가나', '다라', '마'])
})

test('한글과 영문이 섞여도 공백 우선으로 끊는다', () => {
  assert.deepEqual(wrap('한글 abc', 6), ['한글', 'abc'])
})

test('어느 줄도 limit을 넘지 않는다', () => {
  const text = '플러그인 기구가 없습니다 — 규칙을 AGENTS.md에 직접 옮겨 적으세요'
  for (const line of wrap(text, 30)) assert.ok(width(line) <= 30, `넘침: ${line}`)
})

test('줄바꿈은 문단 경계로 보존한다', () => {
  assert.deepEqual(wrap('ab\ncd', 10), ['ab', 'cd'])
})

// 호출부가 폭을 잘못 계산해도 무한 루프에 빠지지 않아야 한다.
test('limit이 0 이하이거나 빈 글이면 빈 배열이다', () => {
  assert.deepEqual(wrap('abc', 0), [])
  assert.deepEqual(wrap('abc', -5), [])
  assert.deepEqual(wrap('', 10), [])
  assert.deepEqual(wrap(null, 10), [])
})
