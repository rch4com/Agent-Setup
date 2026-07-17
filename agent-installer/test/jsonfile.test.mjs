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
