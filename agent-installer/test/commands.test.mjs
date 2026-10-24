import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineRecipe, bindScope } from '../lib/recipe.mjs'
import { marketplacePlugin, skillsAdd } from '../lib/recipe-helpers.mjs'
import { planCommands, formatCommands, quoteArg } from '../lib/commands.mjs'
import { apply, planChanges } from '../lib/engine.mjs'
import { createT } from '../lib/i18n/index.mjs'

const t = createT('en')
const ponytail = (scope) => bindScope(defineRecipe({
  id: 'plugin.ponytail', category: 'plugin', label: 'Ponytail',
  ...marketplacePlugin({
    claude: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
    codex: { marketplace: 'DietrichGebert/ponytail', id: 'ponytail@ponytail' },
  }),
  reasons: { opencode: 'item.unsupported.upstreamNone', antigravity: 'item.unsupported.upstreamNone' },
}), scope)
const caveman = (scope) => bindScope(defineRecipe({ id: 'skill.caveman', category: 'skill', label: 'caveman', ...skillsAdd({ source: 'o/caveman', skill: 'caveman' }) }), scope)
const fileItem = { id: 'config.gitmessage.ko', category: 'config', label: '.gitmessage.txt (ko)', scope: 'project', detect: async () => ({ status: 'absent' }), install: async () => {}, uninstall: async () => {} }

test('quoteArg: 안전한 인자는 그대로, 나머지는 셸별 인용', () => {
  assert.equal(quoteArg('ponytail@ponytail', 'linux'), 'ponytail@ponytail')
  assert.equal(quoteArg('https://github.com/o/r', 'linux'), 'https://github.com/o/r')
  assert.equal(quoteArg('a b', 'linux'), "'a b'")
  assert.equal(quoteArg("it's", 'linux'), String.raw`'it'\''s'`)
  assert.equal(quoteArg('a b', 'win32'), '"a b"')
})

test('planCommands·formatCommands: 공유·CLI·파일 순으로 묶는다', () => {
  const user = ponytail('user')
  const skill = caveman('project')
  const changes = [
    { item: user, action: 'install', state: { present: [], targets: ['claude', 'codex'] } },
    { item: skill, action: 'install', state: { present: [], targets: ['shared'] } },
    { item: fileItem, action: 'install' },
  ]
  const groups = planCommands(changes)
  assert.deepEqual(groups.map((g) => g.key), ['shared', 'claude', 'codex', 'files'])
  const text = formatCommands(groups, { t, scope: 'user', platform: 'linux' }).join('\n')
  assert.match(text, /# Shared skills/)
  assert.match(text, /# Codex — user-global\ncodex plugin marketplace add DietrichGebert\/ponytail\ncodex plugin add ponytail@ponytail/)
  assert.match(text, /\.gitmessage\.txt \(ko\): the installer writes these files itself/)
})

test('formatCommands: 바꿀 것이 없으면 한 줄로 말한다', () => {
  assert.deepEqual(formatCommands([], { t, scope: 'project' }), ['No commands — nothing to change.'])
})

test('불변식: 실행 모드가 부른 명령 == 출력 모드가 낸 명령', async () => {
  const user = ponytail('user')
  const states = [{ item: user, status: 'absent', result: { present: [], failed: [], targets: ['claude', 'codex'] } }]
  const changes = planChanges(states, new Set([user.id]))
  const printed = planCommands(changes).flatMap((g) => g.entries).filter((e) => e.step?.argv).map((e) => e.step.argv.join(' '))
  // apply는 makeExec를 쓰므로 dry-run 로그로 실행된 명령을 받는다.
  const logs = []
  await apply('/repo', changes, { dryRun: true, log: (m) => logs.push(m), t })
  const ran = logs.map((l) => /\[dry-run\] (.*)$/.exec(l)?.[1]).filter(Boolean)
  assert.equal(printed.length, 4)
  assert.deepEqual(ran, printed)
})
