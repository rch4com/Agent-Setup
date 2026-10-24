import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createProbe, onPath, parseAgyMcpList, opencodeConfigFile } from '../lib/probe.mjs'

const FIX = join(import.meta.dirname, 'fixtures', 'probe')
const fixture = (name) => readFileSync(join(FIX, name), 'utf8')

// 명령 문자열 → 출력. 부른 명령을 calls에 남겨 캐시를 검사한다.
function fakeExec(routes) {
  const calls = []
  const exec = async (cmd, args) => {
    const key = [cmd, ...args].join(' ')
    calls.push(key)
    if (!(key in routes)) return { ok: false, output: `unexpected ${key}` }
    const out = routes[key]
    return out instanceof Error ? { ok: false, output: out.message } : { ok: true, output: out }
  }
  return { exec, calls }
}

function tempDirs() {
  const root = mkdtempSync(join(tmpdir(), 'probe-root-'))
  const home = mkdtempSync(join(tmpdir(), 'probe-home-'))
  return { root, home }
}

test('onPath는 PATH 디렉터리에서 실행 파일을 찾는다 (win32는 PATHEXT)', () => {
  const seen = new Set(['/bin/claude', 'C:/bin/agy.EXE', 'D:/x/codex.CMD'])
  const exists = (p) => seen.has(p.replace(/\\/g, '/'))
  assert.equal(onPath('claude', { env: { PATH: '/bin' }, platform: 'linux', exists }), true)
  assert.equal(onPath('codex', { env: { PATH: '/bin' }, platform: 'linux', exists }), false)
  assert.equal(onPath('agy', { env: { PATH: 'C:\\bin', PATHEXT: '.CMD;.EXE' }, platform: 'win32', exists }), true)
  // win32 구분자는 세미콜론이다 — 드라이브 문자의 콜론에서 쪼개면 안 된다.
  assert.equal(onPath('codex', { env: { PATH: 'C:\\bin;D:\\x', PATHEXT: '.CMD' }, platform: 'win32', exists }), true)
  // Windows는 확장자 없는 파일을 실행하지 않는다.
  assert.equal(onPath('claude', { env: { PATH: '/bin', PATHEXT: '.EXE' }, platform: 'win32', exists }), false)
})

test('parseAgyMcpList는 표의 첫 열만 이름으로 읽는다', () => {
  assert.deepEqual(parseAgyMcpList(fixture('agy-mcp-list.txt')), ['codebase-memory', 'notion'])
  assert.deepEqual(parseAgyMcpList(''), [])
})

test('claudePlugin은 범위와 projectPath까지 맞아야 설치됨이다', async () => {
  const { root, home } = tempDirs()
  const list = fixture('claude-plugin-list.json').replace('"__ROOT__"', JSON.stringify(root))
  const { exec, calls } = fakeExec({ 'claude plugin list --json': list })
  const project = createProbe({ root, scope: 'project', exec, home, env: {} })
  assert.equal(await project.claudePlugin(['ponytail@ponytail']), true)
  // 다른 저장소에 project 범위로 깐 것은 이 저장소의 설치가 아니다.
  assert.equal(await project.claudePlugin(['cli-anything@cli-anything']), false)
  assert.equal(await project.claudePlugin(['caveman@caveman']), false)
  assert.equal(calls.length, 1, '목록 명령은 스캔당 한 번만 돈다')
  const user = createProbe({ root, scope: 'user', exec, home, env: {} })
  assert.equal(await user.claudePlugin(['caveman@caveman']), true)
})

test('codex·agy 목록과 MCP를 이름으로 대조한다', async () => {
  const { root, home } = tempDirs()
  const { exec } = fakeExec({
    'codex plugin list --json': fixture('codex-plugin-list.json'),
    'codex mcp list --json': fixture('codex-mcp-list.json'),
    'agy plugin list --json': fixture('agy-plugin-list.json'),
    'agy mcp list': fixture('agy-mcp-list.txt'),
  })
  const p = createProbe({ root, scope: 'user', exec, home, env: {} })
  assert.equal(await p.codexPlugin('ponytail@ponytail'), true)
  assert.equal(await p.codexPlugin('latex@openai-bundled'), false, 'installed:false는 미설치')
  assert.equal(await p.mcp('codex', 'codebase-memory'), true)
  assert.equal(await p.agyPlugin('superpowers'), true)
  assert.equal(await p.mcp('antigravity', 'notion'), true)
  assert.equal(await p.mcp('antigravity', 'vercel'), false)
})

test('Claude MCP는 .mcp.json(project)·~/.claude.json(user)을 읽기만 한다', async () => {
  const { root, home } = tempDirs()
  writeFileSync(join(root, '.mcp.json'), '{ "mcpServers": { "notion": { "type": "http", "url": "x" } } }')
  writeFileSync(join(home, '.claude.json'), '{ "mcpServers": { "vercel": { "type": "http", "url": "y" } } }')
  const { exec, calls } = fakeExec({})
  assert.equal(await createProbe({ root, scope: 'project', exec, home, env: {} }).mcp('claude', 'notion'), true)
  assert.equal(await createProbe({ root, scope: 'user', exec, home, env: {} }).mcp('claude', 'vercel'), true)
  assert.equal(await createProbe({ root, scope: 'user', exec, home, env: {} }).mcp('claude', 'notion'), false)
  assert.deepEqual(calls, [], 'claude mcp list는 서버마다 연결을 검사해 쓰지 않는다')
})

test('OpenCode는 프로젝트 opencode.jsonc·전역 ~/.config/opencode를 읽는다', async () => {
  const { root, home } = tempDirs()
  writeFileSync(join(root, 'opencode.jsonc'), '{\n // c\n "plugin": ["@dietrichgebert/ponytail"], "mcp": { "graft": {} } }')
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(join(home, '.config', 'opencode', 'opencode.json'), '{ "mcp": { "notion": {} } }')
  const { exec } = fakeExec({})
  const proj = createProbe({ root, scope: 'project', exec, home, env: {} })
  assert.equal(await proj.opencodePlugin('@dietrichgebert/ponytail'), true)
  assert.equal(await proj.mcp('opencode', 'graft'), true)
  const user = createProbe({ root, scope: 'user', exec, home, env: {} })
  assert.equal(await user.mcp('opencode', 'notion'), true)
  assert.equal(opencodeConfigFile({ root, scope: 'user', home, env: { XDG_CONFIG_HOME: join(home, 'x') } }), join(home, 'x', 'opencode', 'opencode.json'))
})

test('스킬: project는 .agents/skills 스캔, user는 npx skills list -g --json', async () => {
  const { root, home } = tempDirs()
  mkdirSync(join(root, '.agents', 'skills', 'caveman'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'caveman', 'SKILL.md'), '---\nname: caveman\n---\n')
  const { exec } = fakeExec({ 'npx -y skills@latest list -g --json': fixture('skills-list.json') })
  assert.equal(await createProbe({ root, scope: 'project', exec, home, env: {} }).skill('caveman'), true)
  assert.equal(await createProbe({ root, scope: 'user', exec, home, env: {} }).skill('find-skills'), true)
})

test('목록 명령이 실패하면 조회가 던진다 — 호출부가 감지 실패로 처리한다', async () => {
  const { root, home } = tempDirs()
  const { exec } = fakeExec({ 'codex plugin list --json': new Error('not logged in') })
  const p = createProbe({ root, scope: 'user', exec, home, env: {} })
  await assert.rejects(() => p.codexPlugin('x@y'), /not logged in/)
})

test('exists·dirHasPrefix는 저장소 기준 상대 경로다', () => {
  const { root, home } = tempDirs()
  mkdirSync(join(root, '.codex', 'skills', 'gsd-plan'), { recursive: true })
  const p = createProbe({ root, scope: 'project', exec: async () => ({ ok: false, output: '' }), home, env: {} })
  assert.equal(p.exists('.codex/skills'), true)
  assert.equal(p.dirHasPrefix('.codex/skills', 'gsd-'), true)
  assert.equal(p.dirHasPrefix('.opencode/skills', 'gsd-'), false)
})
