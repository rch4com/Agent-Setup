import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, mcpServer, skillsAdd, opencodePrompt, SKILLS_AGENTS } from '../lib/recipe-helpers.mjs'

const lines = (item, action, state = {}) => item.steps(action, state).map((s) => (s.argv ? s.argv.join(' ') : `# ${s.describe}`))

const ponytail = () => defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    opencode: { module: '@dietrichgebert/ponytail' },
    antigravity: { source: 'https://github.com/DietrichGebert/ponytail', name: 'ponytail' },
  }),
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
  assert.deepEqual(item.supports, ['claude', 'codex', 'opencode', 'antigravity'])
  const all = { present: ['claude', 'codex', 'opencode', 'antigravity'], targets: item.supports }
  assert.deepEqual(lines(item, 'install', { targets: item.supports }), [
    'claude plugin marketplace add DietrichGebert/ponytail --scope user',
    'claude plugin install ponytail@ponytail --scope user',
    'codex plugin marketplace add DietrichGebert/ponytail',
    'codex plugin add ponytail@ponytail',
    'opencode plugin @dietrichgebert/ponytail -g',
    'agy plugin install https://github.com/DietrichGebert/ponytail',
  ])
  const removal = lines(item, 'uninstall', all)
  assert.equal(removal[0], 'claude plugin uninstall ponytail@ponytail --scope user')
  assert.equal(removal[1], 'codex plugin remove ponytail@ponytail')
  assert.match(removal[2], /^opencode run /)
  assert.match(removal[3], /^# /, 'opencode run 뒤에는 검증 단계가 붙는다')
  assert.equal(removal[4], 'agy plugin uninstall ponytail')
})

test('marketplacePlugin: 마켓플레이스 없는 Claude 공식 플러그인', () => {
  const def = defineRecipe({
    id: 'plugin.sp', category: 'plugin', label: 'sp',
    ...marketplacePlugin({ claude: { id: 'superpowers@claude-plugins-official', detectIds: ['a', 'b'] } }),
    reasons: { codex: 'x', opencode: 'x', antigravity: 'x' },
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
  const http = defineRecipe({ id: 'mcp.notion', category: 'mcp', label: 'n', ...mcpServer({ name: 'notion', server: { kind: 'http', url: 'https://mcp.notion.com/mcp' } }) })
  const p = bindScope(http, 'project')
  assert.deepEqual(p.supports, ['claude', 'opencode'])
  assert.equal(lines(p, 'install')[0], 'claude mcp add -s project -t http notion https://mcp.notion.com/mcp')
  assert.equal(lines(bindScope(http, 'user'), 'install', { targets: ['codex', 'antigravity'] }).join('|'),
    'codex mcp add notion --url https://mcp.notion.com/mcp|agy mcp add notion https://mcp.notion.com/mcp')
  assert.deepEqual(lines(p, 'uninstall', { present: ['claude'], targets: ['claude'] }), ['claude mcp remove -s project notion'])
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
  assert.deepEqual(p.supports, ['claude', 'codex', 'opencode', 'antigravity'])
  assert.deepEqual(lines(p, 'install'), ['npx -y skills@latest add https://github.com/JuliusBrussee/caveman --skill caveman --agent universal --yes --copy'])
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
