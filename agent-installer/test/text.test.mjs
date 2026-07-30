import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { hashBody, normalizeBody } from '../lib/bootstrap/text.mjs'

test('normalizeBody: CRLF를 LF로 바꾸고 끝 개행을 하나로 만든다', () => {
  assert.equal(normalizeBody('a\r\nb'), 'a\nb\n')
  assert.equal(normalizeBody('a\nb\n\n\n'), 'a\nb\n')
  assert.equal(normalizeBody('  a\nb  '), 'a\nb\n')
})

test('hashBody: 같은 내용의 LF본과 CRLF본이 같은 해시를 낸다', () => {
  // .gitattributes가 text=auto라 워킹트리 줄바꿈이 플랫폼마다 다르다.
  // 원시 바이트를 해시하면 Windows 체크아웃에서 전부 드리프트로 뜬다.
  const lf = 'line one\nline two\n'
  const crlf = 'line one\r\nline two\r\n'
  assert.equal(hashBody(lf), hashBody(crlf))
})

test('hashBody: 끝 개행 개수와 앞뒤 공백은 해시를 바꾸지 않는다', () => {
  assert.equal(hashBody('x\n'), hashBody('x'))
  assert.equal(hashBody('x\n'), hashBody('\n\nx\n\n'))
})

test('hashBody: 내용이 다르면 해시가 다르고 접두사가 붙는다', () => {
  assert.notEqual(hashBody('a'), hashBody('b'))
  assert.match(hashBody('a'), /^sha256:[0-9a-f]{64}$/)
})
