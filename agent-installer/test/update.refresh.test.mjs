import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, skillsAdd, mcpServer } from '../lib/recipe-helpers.mjs'
import { planCommands } from '../lib/commands.mjs'
import { planRefresh } from '../lib/engine.mjs'
import { parseRootArgs } from '../lib/args.mjs'
import { createT } from '../lib/i18n/index.mjs'

const ponytail = bindScope(defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    copilot: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    opencode: { module: '@dietrichgebert/ponytail' },
  }),
  reasons: { antigravity: 'item.unsupported.upstreamNone', vscode: 'item.unsupported.upstreamNone' },
}), 'user')
const caveman = bindScope(defineRecipe({ id: 'skill.caveman', category: 'skill', label: 'caveman', ...skillsAdd({ source: 'https://github.com/o/caveman', skill: 'caveman' }) }), 'project')
const graft = bindScope(defineRecipe({
  id: 'mcp.graft', category: 'mcp', label: 'graft',
  ...mcpServer({ name: 'graft', server: { kind: 'stdio', command: 'npx', args: ['-y', '@nanonets/graft@latest', 'mcp'] } }),
  reasons: {},
}), 'project')

const installed = (item, present) => ({ item, status: 'installed', result: { present, failed: [], stale: [], targets: present } })
const cmds = (changes) => planCommands(changes).flatMap((g) => g.entries).filter((e) => e.step?.argv).map((e) => e.step.argv.join(' '))

test('planRefresh: 깔린 항목만, 갱신 경로가 있는 것만 든다', () => {
  const changes = planRefresh([
    installed(caveman, ['shared']),
    { item: ponytail, status: 'absent', result: { present: [], failed: [], stale: [], targets: ['claude'] } },
    installed(graft, ['claude']),
  ])
  assert.deepEqual(changes.map((c) => c.item.id), ['skill.caveman'])
  assert.equal(changes[0].action, 'update')
})

test('스킬 갱신은 같은 add를 다시 돈다', () => {
  assert.deepEqual(cmds(planRefresh([installed(caveman, ['shared'])])), [
    'npx -y skills@latest add https://github.com/o/caveman --skill caveman --agent universal --yes --copy',
  ])
})

test('플러그인 갱신은 깔린 CLI의 명령만 돌고, 갱신 경로 없는 CLI는 건너뛴다', () => {
  const got = cmds(planRefresh([installed(ponytail, ['codex', 'copilot', 'opencode'])]))
  assert.deepEqual(got, [
    'codex plugin marketplace upgrade ponytail',
    'codex plugin add ponytail@ponytail',
    'copilot plugin marketplace update ponytail',
    'copilot plugin update ponytail@ponytail',
  ])
  assert.deepEqual(cmds(planRefresh([installed(ponytail, ['claude'])])), [
    'claude plugin marketplace update ponytail',
    'claude plugin update ponytail@ponytail --scope user',
  ])
})

test('MCP는 갱신 대상이 아니다 — 등록 인자가 이미 @latest다', () => {
  assert.equal(graft.canRefresh, false)
})

test('parseRootArgs: --update는 대화형이 아니고 --set과 함께 못 쓴다', () => {
  const o = parseRootArgs(['--update'], createT('en'))
  assert.equal(o.update, true)
  assert.equal(o.interactive, false)
  assert.throws(() => parseRootArgs(['--update', '--set', 'a'], createT('en')))
  assert.equal(parseRootArgs([], createT('en')).update, false)
})
