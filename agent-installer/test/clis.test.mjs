import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'
import { readJson } from '../lib/jsonfile.mjs'
import { makeTempRepo } from './helpers.mjs'

const HTTP = { kind: 'http', url: 'https://mcp.notion.com/mcp' }
const STDIO = { kind: 'stdio', command: 'codebase-memory-mcp', args: [] }

for (const id of CLI_IDS) {
  test(`${id}: add→has→remove roundtrip (http, stdio)`, () => {
    const repo = makeTempRepo()
    for (const server of [HTTP, STDIO]) {
      assert.equal(CLIS[id].has(repo, 'testsrv'), false)
      CLIS[id].add(repo, 'testsrv', server)
      assert.equal(CLIS[id].has(repo, 'testsrv'), true)
      CLIS[id].remove(repo, 'testsrv')
      assert.equal(CLIS[id].has(repo, 'testsrv'), false)
    }
  })
}

test('gemini는 원격에 httpUrl 키를 쓴다 (url은 SSE라서 금지)', () => {
  const repo = makeTempRepo()
  CLIS.gemini.add(repo, 'n', HTTP)
  const entry = readJson(join(repo, '.gemini/settings.json')).mcpServers.n
  assert.equal(entry.httpUrl, HTTP.url)
  assert.equal(entry.url, undefined)
})

test('opencode는 mcp 키 + command 배열 형식을 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.opencode.add(repo, 'c', STDIO)
  const entry = readJson(join(repo, 'opencode.jsonc')).mcp.c
  assert.equal(entry.type, 'local')
  assert.deepEqual(entry.command, ['codebase-memory-mcp'])
})

test('kilo는 .kilocode/mcp.json에 streamable-http를 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.kilo.add(repo, 'n', HTTP)
  const entry = readJson(join(repo, '.kilocode/mcp.json')).mcpServers.n
  assert.equal(entry.type, 'streamable-http')
})

test('grok은 .grok/config.toml에 mcp_servers 테이블을 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.grok.add(repo, 'n', HTTP)
  const text = readFileSync(join(repo, '.grok/config.toml'), 'utf8')
  assert.match(text, /\[mcp_servers\.n\]/)
  assert.match(text, /url = "https:\/\/mcp\.notion\.com\/mcp"/)
})
