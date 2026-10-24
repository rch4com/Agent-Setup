import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, skillsAdd } from '../lib/recipe-helpers.mjs'
import { activationLines } from '../lib/activation.mjs'
import { createT } from '../lib/i18n/index.mjs'

const t = createT('en')
const pony = bindScope(defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail', hooks: true, postInstall: 'activation.cli.opencode',
  ...marketplacePlugin({ claude: { id: 'p@p' }, codex: { marketplace: 'o/r', id: 'p@p' } }),
  reasons: { opencode: 'x', antigravity: 'x' },
}), 'user')
const skill = bindScope(defineRecipe({ id: 'skill.c', category: 'skill', label: 'c', ...skillsAdd({ source: 'o/c', skill: 'c' }) }), 'project')

test('설치가 있는 CLI마다 공통 안내 한 줄, Codex 훅 안내는 hooks 항목만', () => {
  const lines = activationLines([{ item: pony, action: 'install', state: { present: [], targets: ['claude', 'codex'] } }], t)
  assert.equal(lines[0], 'After installing:')
  assert.ok(lines.some((l) => l.includes('Claude Code: start a new session')))
  assert.ok(lines.some((l) => l.includes('Codex: run codex')))
  assert.ok(lines.some((l) => l.includes('hooks (Ponytail)')))
  assert.ok(lines.some((l) => l.includes('Ponytail: restart OpenCode')), '항목 고유 안내')
})

test('같은 CLI 안내는 항목이 여럿이어도 한 번만', () => {
  const state = { present: [], targets: ['claude'] }
  const lines = activationLines([{ item: pony, action: 'install', state }, { item: pony, action: 'complete', state }], t)
  assert.equal(lines.filter((l) => l.startsWith('  Claude Code:')).length, 1)
  assert.ok(!lines.some((l) => l.includes('hooks (')), 'Codex 단계가 없으면 훅 안내도 없다')
})

test('공유 스킬은 PATH에 있는 CLI(reach)에 안내를 낸다; 제거만 있으면 안내가 없다', () => {
  const lines = activationLines([{ item: skill, action: 'install', state: { present: [], targets: ['shared'], reach: ['codex'] } }], t)
  assert.ok(lines.some((l) => l.startsWith('  Codex:')))
  assert.ok(!lines.some((l) => l.startsWith('  Claude Code:')))
  assert.deepEqual(activationLines([{ item: pony, action: 'uninstall', state: { present: ['claude'], targets: ['claude'] } }], t), [])
})

// PATH에 CLI가 하나도 없어 실행된 단계가 없으면 그 항목의 안내도 낼 이유가 없다.
test('실행할 단계가 없던 항목은 고유 안내도 내지 않는다', () => {
  assert.deepEqual(activationLines([{ item: pony, action: 'install', state: { present: [], targets: [] } }], t), [])
})
