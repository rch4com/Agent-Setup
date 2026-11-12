import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, mcpServer, skillsAdd, opencodePrompt, SKILLS_AGENTS, withApp, npmApp } from '../lib/recipe-helpers.mjs'

const lines = (item, action, state = {}) => item.steps(action, state).map((s) => (s.argv ? s.argv.join(' ') : `# ${s.describe}`))

const ponytail = () => defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    opencode: { module: '@dietrichgebert/ponytail' },
    antigravity: { source: 'https://github.com/DietrichGebert/ponytail', name: 'ponytail' },
    copilot: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
  }),
  reasons: { vscode: 'item.unsupported.vscodePlugin' },
})

test('marketplacePlugin: project 범위 명령', () => {
  const item = bindScope(ponytail(), 'project')
  assert.deepEqual(item.supports, ['claude', 'opencode'])
  assert.deepEqual(lines(item, 'install'), [
    'claude plugin marketplace add DietrichGebert/ponytail --scope project',
    'claude plugin install ponytail@ponytail --scope project',
    'opencode plugin @dietrichgebert/ponytail',
  ])
  assert.equal(item.steps('install')[0].tolerateFail, true, '마켓플레이스 "이미 등록됨"은 실패가 아니다')
})

test('marketplacePlugin: user 범위 명령과 제거', () => {
  const item = bindScope(ponytail(), 'user')
  assert.deepEqual(item.supports, ['claude', 'codex', 'opencode', 'antigravity', 'copilot'])
  const all = { present: ['claude', 'codex', 'opencode', 'antigravity', 'copilot'], targets: item.supports }
  assert.deepEqual(lines(item, 'install', { targets: item.supports }), [
    'claude plugin marketplace add DietrichGebert/ponytail --scope user',
    'claude plugin install ponytail@ponytail --scope user',
    'codex plugin marketplace add DietrichGebert/ponytail',
    'codex plugin add ponytail@ponytail',
    'opencode plugin @dietrichgebert/ponytail -g',
    'agy plugin install https://github.com/DietrichGebert/ponytail',
    'copilot plugin marketplace add DietrichGebert/ponytail',
    'copilot plugin install ponytail@ponytail',
  ])
  const removal = lines(item, 'uninstall', all)
  assert.equal(removal[0], 'claude plugin uninstall ponytail@ponytail --scope user')
  assert.equal(removal[1], 'codex plugin remove ponytail@ponytail')
  assert.match(removal[2], /^opencode run /)
  assert.match(removal[3], /^# /, 'opencode run 뒤에는 검증 단계가 붙는다')
  assert.equal(removal[4], 'agy plugin uninstall ponytail')
  assert.equal(removal[5], 'copilot plugin uninstall ponytail@ponytail')
})

test('marketplacePlugin: Copilot은 전역 전용이고 마켓 등록 "이미 있음"을 참는다', () => {
  const item = bindScope(ponytail(), 'user')
  const [add] = item.steps('install', { targets: ['copilot'] })
  assert.equal(add.tolerateFail, true)
  // 프로젝트 범위에는 Copilot 레시피가 없다 — 범위만 다르다는 자동 사유가 붙는다.
  const project = bindScope(ponytail(), 'project')
  assert.ok(!project.supports.includes('copilot'))
  assert.ok(project.unsupported.copilot, '범위 사유가 없다')
})

test('marketplacePlugin: Copilot 직접 설치(source)는 마켓 등록 없이 source로 깔고 이름으로 지운다', () => {
  const def = defineRecipe({
    id: 'plugin.ua', category: 'plugin', label: 'ua',
    ...marketplacePlugin({ copilot: { source: 'Egonex-AI/Understand-Anything:understand-anything-plugin', id: 'understand-anything' } }),
    reasons: { claude: 'x', codex: 'x', opencode: 'x', antigravity: 'x', vscode: 'x' },
  })
  const item = bindScope(def, 'user')
  assert.deepEqual(lines(item, 'install'), ['copilot plugin install Egonex-AI/Understand-Anything:understand-anything-plugin'])
  assert.deepEqual(lines(item, 'uninstall', { present: ['copilot'], targets: ['copilot'] }), ['copilot plugin uninstall understand-anything'])
})

test('marketplacePlugin: 마켓플레이스 없는 Claude 공식 플러그인', () => {
  const def = defineRecipe({
    id: 'plugin.sp', category: 'plugin', label: 'sp',
    ...marketplacePlugin({ claude: { id: 'superpowers@claude-plugins-official', detectIds: ['a', 'b'] } }),
    reasons: { codex: 'x', opencode: 'x', antigravity: 'x', copilot: 'x', vscode: 'x' },
  })
  assert.deepEqual(lines(bindScope(def, 'project'), 'install'), ['claude plugin install superpowers@claude-plugins-official --scope project'])
})

test('mcpServer: stdio·http를 CLI별 문법으로', () => {
  const stdio = defineRecipe({ id: 'mcp.graft', category: 'mcp', label: 'g', ...mcpServer({ name: 'graft', server: { kind: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft', 'mcp'] } }) })
  const user = bindScope(stdio, 'user')
  const got = lines(user, 'install', { targets: user.supports })
  assert.equal(got[0], 'claude mcp add -s user graft -- npx -y @nanonets/graft mcp')
  assert.equal(got[1], 'codex mcp add graft -- npx -y @nanonets/graft mcp')
  assert.match(got[2], /^opencode run /)
  assert.equal(got[4], 'agy mcp add graft -- npx -y @nanonets/graft mcp')
  assert.equal(got[5], 'copilot mcp add graft -- npx -y @nanonets/graft mcp')
  assert.match(got[6], /^# add mcpServers\.graft to /, 'VS Code는 명령이 없어 파일을 쓰는 단계다')
  const http = defineRecipe({ id: 'mcp.notion', category: 'mcp', label: 'n', ...mcpServer({ name: 'notion', server: { kind: 'http', url: 'https://mcp.notion.com/mcp' } }) })
  const p = bindScope(http, 'project')
  assert.deepEqual(p.supports, ['claude', 'opencode', 'vscode'])
  assert.equal(lines(p, 'install')[0], 'claude mcp add -s project -t http notion https://mcp.notion.com/mcp')
  assert.equal(lines(bindScope(http, 'user'), 'install', { targets: ['codex', 'antigravity', 'copilot'] }).join('|'),
    'codex mcp add notion --url https://mcp.notion.com/mcp|# check codex mcp list has notion|agy mcp add notion https://mcp.notion.com/mcp|copilot mcp add --transport http notion https://mcp.notion.com/mcp')
  assert.deepEqual(lines(p, 'uninstall', { present: ['claude'], targets: ['claude'] }), ['claude mcp remove -s project notion'])
  assert.deepEqual(lines(bindScope(http, 'user'), 'uninstall', { present: ['copilot'], targets: ['copilot'] }), ['copilot mcp remove notion'])
})

// VS Code에는 설치 명령이 없다(`code --add-mcp`는 JSON의 큰따옴표를 Windows 인용이
// 거부하고, 제거·목록 명령도 없다). 그래서 파일을 직접 고치고 편집은 주석을 지킨다.
test('mcpServer: VS Code 프로젝트는 .vscode/mcp.json의 servers를 쓰고 지운다', async () => {
  const stdio = defineRecipe({ id: 'mcp.g', category: 'mcp', label: 'g', ...mcpServer({ name: 'graft', server: { kind: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft', 'mcp'] } }) })
  const http = defineRecipe({ id: 'mcp.n', category: 'mcp', label: 'n', ...mcpServer({ name: 'notion', server: { kind: 'http', url: 'https://mcp.notion.com/mcp' } }) })
  const root = mkdtempSync(join(tmpdir(), 'vsc-'))
  mkdirSync(join(root, '.vscode'), { recursive: true })
  writeFileSync(join(root, '.vscode', 'mcp.json'), '{\n  // 팀 서버\n  "servers": { "keep": { "type": "stdio", "command": "x" } }\n}\n')
  const [add] = bindScope(stdio, 'project').steps('install', { targets: ['vscode'] })
  const [addHttp] = bindScope(http, 'project').steps('install', { targets: ['vscode'] })
  await add.fn({ root })
  await addHttp.fn({ root })
  const text = readFileSync(join(root, '.vscode', 'mcp.json'), 'utf8')
  assert.match(text, /\/\/ 팀 서버/, '사용자 주석을 지킨다')
  const data = JSON.parse(text.replace(/\/\/.*$/m, ''))
  assert.deepEqual(data.servers.graft, { type: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft', 'mcp'] })
  assert.deepEqual(data.servers.notion, { type: 'http', url: 'https://mcp.notion.com/mcp' })
  assert.ok(data.servers.keep, '남의 항목은 그대로')
  const [remove] = bindScope(stdio, 'project').steps('uninstall', { present: ['vscode'], targets: ['vscode'] })
  await remove.fn({ root })
  const after = JSON.parse(readFileSync(join(root, '.vscode', 'mcp.json'), 'utf8').replace(/\/\/.*$/m, ''))
  assert.equal(after.servers.graft, undefined)
  assert.ok(after.servers.notion && after.servers.keep)
})

test('mcpServer: VS Code 프로젝트 설치는 .gitignore가 있을 때만 부정 항목을 보장한다', async () => {
  const def = defineRecipe({ id: 'mcp.g', category: 'mcp', label: 'g', ...mcpServer({ name: 'graft', server: { kind: 'stdio', command: 'npx', args: [] } }) })
  const [add] = bindScope(def, 'project').steps('install', { targets: ['vscode'] })
  // .gitignore가 없으면 만들지 않는다 — 무시되는 것이 없다.
  const bare = mkdtempSync(join(tmpdir(), 'vsc-bare-'))
  await add.fn({ root: bare })
  assert.equal(existsSync(join(bare, '.gitignore')), false)
  // `.vscode/*`를 무시하는 저장소에서는 부정 항목이 없으면 mcp.json이 조용히 커밋에서 빠진다.
  const ignoring = mkdtempSync(join(tmpdir(), 'vsc-ign-'))
  writeFileSync(join(ignoring, '.gitignore'), '.vscode/*\n')
  await add.fn({ root: ignoring })
  await add.fn({ root: ignoring })
  const lines = readFileSync(join(ignoring, '.gitignore'), 'utf8').split('\n')
  assert.equal(lines.filter((l) => l === '!.vscode/mcp.json').length, 1, '두 번 돌려도 한 줄이다')
})

test('mcpServer: VS Code 전역은 Copilot CLI와 같은 mcp-config.json을 쓰고 이미 있으면 건드리지 않는다', async () => {
  const stdio = defineRecipe({ id: 'mcp.g', category: 'mcp', label: 'g', ...mcpServer({ name: 'graft', server: { kind: 'stdio', command: 'npx', args: ['-y', 'g'] } }) })
  const home = mkdtempSync(join(tmpdir(), 'vsc-home-'))
  const prev = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, COPILOT_HOME: process.env.COPILOT_HOME }
  process.env.HOME = home
  process.env.USERPROFILE = home
  delete process.env.COPILOT_HOME
  try {
    const [add] = bindScope(stdio, 'user').steps('install', { targets: ['vscode'] })
    await add.fn({ root: '/unused' })
    const file = join(home, '.copilot', 'mcp-config.json')
    assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')).mcpServers.graft, { tools: ['*'], type: 'local', command: 'npx', args: ['-y', 'g'] })
    // Copilot CLI가 같은 실행에서 먼저 같은 항목을 썼다면(둘이 한 파일을 나눈다) 덮지 않는다.
    writeFileSync(file, '{ "mcpServers": { "graft": { "type": "local", "command": "mine" } } }')
    await add.fn({ root: '/unused' })
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).mcpServers.graft.command, 'mine')
    const [remove] = bindScope(stdio, 'user').steps('uninstall', { present: ['vscode'], targets: ['vscode'] })
    await remove.fn({ root: '/unused' })
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).mcpServers.graft, undefined)
  } finally {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
})

test('mcpServer: clis로 일부 CLI만 고른다', () => {
  const part = mcpServer({ name: 'ai-memory', server: { kind: 'stdio', command: 'ai-memory', args: ['mcp-bridge'] }, clis: ['opencode', 'antigravity'] })
  assert.deepEqual(Object.keys(part.recipes), ['opencode', 'antigravity'])
  assert.deepEqual(Object.keys(part.detect), ['opencode', 'antigravity'])
})

test('opencodePrompt에는 큰따옴표가 없다 — Windows cmd 인용이 거부한다', () => {
  const prompt = opencodePrompt('project', `set ${JSON.stringify({ type: 'local', command: ['a b'] })}`)
  assert.doesNotMatch(prompt, /"/)
  assert.match(prompt, /opencode\.jsonc/)
  assert.match(opencodePrompt('user', 'x'), /~\/\.config\/opencode\/opencode\.json/)
  const def = defineRecipe({ id: 'mcp.n', category: 'mcp', label: 'n', ...mcpServer({ name: 'n', server: { kind: 'stdio', command: 'x', args: ['--flag'] } }) })
  for (const s of bindScope(def, 'user').steps('install', { targets: ['opencode'] })) {
    if (s.argv) assert.doesNotMatch(s.argv.join(' '), /"/)
  }
})

test('OpenCode 검증 단계: 파일에 반영되지 않았으면 던진다', async () => {
  const root = mkdtempSync(join(tmpdir(), 'oc-'))
  const def = defineRecipe({ id: 'mcp.n', category: 'mcp', label: 'n', ...mcpServer({ name: 'n', server: { kind: 'http', url: 'https://x' } }) })
  const verify = bindScope(def, 'project').steps('install', { targets: ['opencode'] }).find((s) => s.fn)
  await assert.rejects(async () => verify.fn({ root }), (err) => err.key === 'error.opencodeVerify')
  writeFileSync(join(root, 'opencode.jsonc'), '{ "mcp": { "n": { "type": "remote", "url": "https://x", "enabled": true } } }')
  await verify.fn({ root })
})

test('skillsAdd: 공유 단계 하나로 네 CLI, 전역은 에이전트 명시', () => {
  const def = defineRecipe({ id: 'skill.caveman', category: 'skill', label: 'c', ...skillsAdd({ source: 'https://github.com/JuliusBrussee/caveman', skill: 'caveman' }) })
  const p = bindScope(def, 'project')
  assert.deepEqual(p.supports, ['claude', 'codex', 'opencode', 'antigravity', 'copilot', 'vscode'])
  assert.deepEqual(lines(p, 'install'), [
    'npx -y skills@latest add https://github.com/JuliusBrussee/caveman --skill caveman --agent universal --yes --copy',
    '# link .claude/skills to .agents/skills so Claude Code sees shared skills (skipped if already linked)',
  ])
  const removal = lines(p, 'uninstall', { present: ['shared'], targets: ['shared'] })
  assert.equal(removal[0], 'npx -y skills@latest remove caveman --agent universal --yes')
  assert.match(removal[1], /^# /)
  const u = bindScope(def, 'user')
  assert.deepEqual(SKILLS_AGENTS, ['claude-code', 'codex', 'antigravity-cli'])
  assert.deepEqual(lines(u, 'install'), [`npx -y skills@latest add https://github.com/JuliusBrussee/caveman --skill caveman -g -a ${SKILLS_AGENTS.join(' ')} --yes --copy`])
})

test('skillsAdd: 단일 스킬 제거는 남은 디렉터리와 잠금 항목을 치운다', async () => {
  const def = defineRecipe({ id: 'skill.taste', category: 'skill', label: 't', ...skillsAdd({ source: 'https://github.com/Leonxlnx/taste-skill', skill: 'design-taste-frontend' }) })
  const root = mkdtempSync(join(tmpdir(), 'sk1-'))
  // 디렉터리 이름이 스킬 이름과 다르다 — frontmatter로 찾는다.
  mkdirSync(join(root, '.agents', 'skills', 'taste-skill'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'taste-skill', 'SKILL.md'), '---\nname: design-taste-frontend\n---\n')
  writeFileSync(join(root, 'skills-lock.json'), JSON.stringify({ skills: { 'design-taste-frontend': { source: 'Leonxlnx/taste-skill' } } }))
  const cleanup = bindScope(def, 'project').steps('uninstall', { present: ['shared'], targets: ['shared'] }).find((s) => s.fn)
  await cleanup.fn({ root })
  assert.equal(existsSync(join(root, '.agents', 'skills', 'taste-skill')), false)
  assert.equal(existsSync(join(root, 'skills-lock.json')), false)
})

test('skillsAdd: skill * 는 project 전용이고 제거는 잠금 파일을 따른다', async () => {
  const def = defineRecipe({ id: 'skill.sp', category: 'skill', label: 's', ...skillsAdd({ source: 'https://github.com/obra/superpowers', skill: '*', anchor: 'using-superpowers' }) })
  assert.equal(bindScope(def, 'user'), null)
  const root = mkdtempSync(join(tmpdir(), 'sk-'))
  for (const n of ['using-superpowers', 'brainstorming']) {
    mkdirSync(join(root, '.agents', 'skills', n), { recursive: true })
    writeFileSync(join(root, '.agents', 'skills', n, 'SKILL.md'), `---\nname: ${n}\n---\n`)
  }
  writeFileSync(join(root, 'skills-lock.json'), JSON.stringify({ skills: { 'using-superpowers': { source: 'obra/superpowers' }, brainstorming: { source: 'obra/superpowers' } } }))
  const [step] = bindScope(def, 'project').steps('uninstall', { present: ['shared'], targets: ['shared'] })
  const ran = []
  await step.fn({ root, exec: async (cmd, args) => { ran.push(args.join(' ')); return { ok: true, output: '' } } })
  assert.equal(ran.length, 2)
  assert.equal(existsSync(join(root, '.agents', 'skills', 'brainstorming')), false)
  assert.equal(existsSync(join(root, 'skills-lock.json')), false)
})

// codex mcp add --url은 OAuth 서버면 등록을 마친 뒤 로그인 콜백을 5분 기다리다
// 실패로 끝난다(2026-10-24 supabase 실측) — 짧게 끊고 목록으로 등록을 확인한다.
test('mcpServer: Codex 원격 MCP는 로그인 대기를 끊고 목록으로 등록을 확인한다', async () => {
  const def = defineRecipe({ id: 'mcp.s', category: 'mcp', label: 's', ...mcpServer({ name: 'supabase', server: { kind: 'http', url: 'https://mcp.supabase.com/mcp' } }) })
  const [add, verify] = bindScope(def, 'user').steps('install', { targets: ['codex'] })
  assert.deepEqual(add.argv, ['codex', 'mcp', 'add', 'supabase', '--url', 'https://mcp.supabase.com/mcp'])
  assert.equal(add.tolerateFail, true)
  assert.ok(add.timeout > 0 && add.timeout <= 60000, `대기 상한: ${add.timeout}`)
  assert.ok(verify.fn, '등록 확인 단계가 없다')
  const listing = (names) => async () => ({ ok: true, output: JSON.stringify(names.map((name) => ({ name }))) })
  await verify.fn({ root: '/r', exec: listing(['supabase']) })
  await assert.rejects(async () => verify.fn({ root: '/r', exec: listing(['vercel']) }), (err) => err.key === 'error.codexMcpVerify')
})

// 스킬이 구동하는 앱은 없을 때만 깔고, 제거는 스킬만 지운다. 감지는 둘 다 있어야
// 설치됨이다 — 앱이 빠진 채 설치됨으로 읽히면 다시 고를 길이 없다.
test('withApp: 앱이 없을 때만 깔고, 제거는 앱을 건드리지 않는다', async () => {
  for (const [has, expectInstall] of [[false, true], [true, false]]) {
    let installed = 0
    const def = defineRecipe({
      id: 'skill.x', category: 'skill', label: 'x',
      ...withApp(skillsAdd({ source: 'https://github.com/o/r', skill: 'x' }), {
        describe: 'install x app', present: async () => has, install: async () => { installed++ },
      }),
    })
    const item = bindScope(def, 'user')
    const install = item.steps('install', { targets: ['shared'] })
    assert.equal(install.at(-1).describe, 'install x app')
    await install.at(-1).fn({})
    assert.equal(installed, expectInstall ? 1 : 0)
    assert.ok(!item.steps('uninstall', { targets: ['shared'], present: ['shared'] }).some((s) => s.describe === 'install x app'))
    const state = await item.detect({ probe: { has: () => true, skill: async () => true } })
    assert.equal(state.status, has ? 'installed' : 'absent')
  }
})

test('npmApp: 전역 npm 설치 뒤 후속 명령을 차례로 돌리고, 실패면 명령과 출력을 싣는다', async () => {
  const calls = []
  const app = npmApp({ bin: 'nope-bin-xyz', pkg: 'nope', after: [['nope', 'install']] })
  await app.install({ exec: async (cmd, args) => { calls.push([cmd, ...args].join(' ')); return { ok: true } } })
  assert.deepEqual(calls, ['npm install -g nope', 'nope install'])
  assert.equal(await app.present(), false)
  await assert.rejects(
    app.install({ exec: async () => ({ ok: false, output: 'E404' }) }),
    /npm install -g nope.*E404/,
  )
})
