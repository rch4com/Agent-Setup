import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readJson, setKey, removeKey } from '../lib/jsonfile.mjs'

function tmpFile(content) {
  const dir = mkdtempSync(join(tmpdir(), 'jsonfile-'))
  const file = join(dir, 'config.jsonc')
  if (content !== undefined) writeFileSync(file, content)
  return file
}

test('setKey는 주석을 보존하며 중첩 키를 추가한다', () => {
  const file = tmpFile('{\n  // keep this comment\n  "mcp": {}\n}\n')
  setKey(file, ['mcp', 'notion'], { type: 'remote', url: 'https://mcp.notion.com/mcp', enabled: true })
  const text = readFileSync(file, 'utf8')
  assert.match(text, /keep this comment/)
  assert.equal(readJson(file).mcp.notion.url, 'https://mcp.notion.com/mcp')
})

test('setKey는 없는 파일을 {}부터 생성한다', () => {
  const file = tmpFile(undefined)
  setKey(file, ['mcpServers', 'vercel'], { url: 'https://mcp.vercel.com' })
  assert.equal(readJson(file).mcpServers.vercel.url, 'https://mcp.vercel.com')
})

test('removeKey는 해당 키만 제거하고 형제를 보존한다', () => {
  const file = tmpFile('{"mcpServers":{"a":{"url":"x"},"b":{"url":"y"}}}')
  removeKey(file, ['mcpServers', 'a'])
  const data = readJson(file)
  assert.equal(data.mcpServers.a, undefined)
  assert.equal(data.mcpServers.b.url, 'y')
})

test('removeKey는 없는 키에 no-op이다', () => {
  const file = tmpFile('{"x":1}')
  removeKey(file, ['mcpServers', 'a'])
  assert.equal(readJson(file).x, 1)
})

// jsonc-parser의 parse는 던지지 않는다 — 닫는 괄호가 빠진 파일에 키를 끼워
// 넣고 has()는 설치됨으로 읽어, 사용자는 파일이 깨진 것을 끝까지 몰랐다.
test('깨진 JSON은 읽기·쓰기 모두 지역화 오류로 거부하고 파일을 건드리지 않는다', () => {
  const broken = '{ "mcpServers": { "a": { "command": "x" } '
  const file = tmpFile(broken)
  const isInvalid = (err) => err.key === 'error.jsonInvalid' && /CloseBraceExpected/.test(err.params.message)
  assert.throws(() => readJson(file), isInvalid)
  assert.throws(() => setKey(file, ['mcpServers', 'b'], { command: 'y' }), isInvalid)
  assert.throws(() => removeKey(file, ['mcpServers', 'a']), isInvalid)
  assert.equal(readFileSync(file, 'utf8'), broken, '깨진 파일에 쓰면 안 된다')
})

test('주석과 후행 콤마는 JSONC로 정상이라 거부하지 않는다', () => {
  const file = tmpFile('{\n  // 주석\n  "plugin": ["a",],\n}\n')
  assert.deepEqual(readJson(file).plugin, ['a'])
  setKey(file, ['plugin', 1], 'b')
  assert.deepEqual(readJson(file).plugin, ['a', 'b'])
})
