import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'
import { readJson } from '../lib/jsonfile.mjs'
import { makeTempRepo } from './helpers.mjs'

const HTTP = { kind: 'http', url: 'https://mcp.notion.com/mcp' }
const STDIO = { kind: 'stdio', command: 'codebase-memory-mcp', args: [] }

// CLI별로 링크를 걸어 볼 자리. 디렉터리 junction만 쓴다 — Windows에서 파일
// 심볼릭 링크는 권한이 필요하고 junction은 아니다(context.test.mjs와 같은 이유).
// 설정 파일이 하위 디렉터리에 있으면 그 디렉터리를, 저장소 루트의 파일이면
// 파일 자리 자체를 링크로 바꾼다(inPlace) — 후자는 읽기가 EISDIR로 실패하므로
// 읽기 경로까지 검사하지는 않는다.
const ESCAPE_POINT = {
  claude: { path: '.mcp.json', inPlace: true },
  codex: { path: '.codex' },
  gemini: { path: '.gemini' },
  opencode: { path: 'opencode.jsonc', inPlace: true },
  kilo: { path: '.kilocode' },
  kiro: { path: '.kiro' },
  kimi: { path: '.kimi-code' },
  grok: { path: '.grok' },
  copilot: { path: '.github' },
  vscode: { path: '.vscode' },
}

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

// 어휘적 검사만으로는 저장소 안 `.codex`·`.claude`가 홈을 가리키는 Junction일 때를
// 막지 못한다. MCP 등록 한 번으로 글로벌 설정이 생성·수정되면 "홈 디렉터리의
// 글로벌 설정을 읽거나 수정하지 않는다"는 약속이 깨진다. 10개 CLI 전부 검사한다.
for (const id of CLI_IDS) {
  test(`${id}: 설정 파일 자리가 저장소 밖 링크면 add·remove가 거부한다`, () => {
    const root = makeTempRepo()
    const outside = mkdtempSync(join(tmpdir(), 'outside-mcp-'))
    const { path: rel, inPlace = false } = ESCAPE_POINT[id]
    symlinkSync(outside, join(root, rel), 'junction')

    assert.throws(() => CLIS[id].add(root, 'evil', HTTP), /external link/)
    assert.throws(() => CLIS[id].remove(root, 'evil'), /external link/)
    // 읽기(has)는 어휘적 경로로 충분하다 — 지켜야 할 쓰기가 없다.
    if (!inPlace) assert.equal(CLIS[id].has(root, 'evil'), false)
    // 저장소 밖에 아무것도 만들지 않았다.
    assert.deepEqual(
      ['config.toml', 'settings.json', 'mcp.json', 'opencode.jsonc'].filter((f) => existsSync(join(outside, f))),
      [],
    )
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

test('copilot은 .github/mcp.json에 mcpServers + type:local을 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.copilot.add(repo, 'n', HTTP)
  CLIS.copilot.add(repo, 'c', STDIO)

  const servers = readJson(join(repo, '.github/mcp.json')).mcpServers
  assert.equal(servers.n.type, 'http')
  assert.equal(servers.n.url, HTTP.url)
  assert.equal(servers.c.type, 'local')
  assert.equal(servers.c.command, 'codebase-memory-mcp')
})

test('vscode는 .vscode/mcp.json에 servers 키 + type:stdio를 쓴다', () => {
  const repo = makeTempRepo()
  CLIS.vscode.add(repo, 'n', HTTP)
  CLIS.vscode.add(repo, 'c', STDIO)

  const data = readJson(join(repo, '.vscode/mcp.json'))
  assert.equal(data.mcpServers, undefined, 'VS Code는 mcpServers가 아니라 servers를 쓴다')
  assert.equal(data.servers.n.type, 'http')
  assert.equal(data.servers.c.type, 'stdio')
  assert.deepEqual(data.servers.c.args, [])
})

// 상세 패널이 "이 항목이 어디에 쓰이나"를 보여 주는 근거다. 경로를 어댑터와
// 따로 적으면 갈릴 수 있으므로, 실제로 쓴 파일이 그 자리에 생기는지 본다.
test('모든 CLI가 자기 설정 파일 경로를 밝힌다', () => {
  for (const cli of CLI_IDS) {
    assert.equal(typeof CLIS[cli].file, 'string', `${cli}: file이 없다`)
    assert.ok(CLIS[cli].file.length > 0, `${cli}: file이 비었다`)
  }
})

test('밝힌 경로가 실제로 쓰이는 파일이다', () => {
  const root = makeTempRepo()
  const server = { kind: 'http', url: 'https://example.test/mcp' }
  for (const cli of CLI_IDS) {
    CLIS[cli].add(root, 'probe', server)
    assert.ok(existsSync(join(root, CLIS[cli].file)), `${cli}: ${CLIS[cli].file}가 없다`)
  }
})
