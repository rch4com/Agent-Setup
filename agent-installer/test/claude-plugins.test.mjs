import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { isPluginEnabled, enablePlugin, disablePlugin } from '../lib/claude-plugins.mjs'
import { readJson, setKey } from '../lib/jsonfile.mjs'
import { makeTempRepo } from './helpers.mjs'

function settingsPath(repo) { return join(repo, '.claude', 'settings.json') }

test('객체 양식 enabledPlugins를 감지한다', () => {
  const repo = makeTempRepo()
  mkdirSync(join(repo, '.claude'), { recursive: true })
  writeFileSync(settingsPath(repo), '{"enabledPlugins":{"bkit@bkit-marketplace":true}}')
  assert.equal(isPluginEnabled(repo, ['bkit@bkit-marketplace']), true)
  assert.equal(isPluginEnabled(repo, ['superpowers@claude-plugins-official']), false)
})

test('배열 양식 enabledPlugins도 감지한다', () => {
  const repo = makeTempRepo()
  mkdirSync(join(repo, '.claude'), { recursive: true })
  writeFileSync(settingsPath(repo), '{"enabledPlugins":["superpowers@claude-plugins-official"]}')
  assert.equal(isPluginEnabled(repo, ['superpowers@claude-plugins-official', 'superpowers@superpowers-marketplace']), true)
})

test('enablePlugin은 객체 양식으로 기록하고 마켓플레이스를 등록한다', () => {
  const repo = makeTempRepo()
  enablePlugin(repo, 'bkit@bkit-marketplace', { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' })
  const s = readJson(settingsPath(repo))
  assert.equal(s.enabledPlugins['bkit@bkit-marketplace'], true)
  assert.equal(s.extraKnownMarketplaces['bkit-marketplace'].source.repo, 'popup-studio-ai/bkit-claude-code')
})

test('disablePlugin은 항목과 고아 마켓플레이스를 제거한다', () => {
  const repo = makeTempRepo()
  enablePlugin(repo, 'bkit@bkit-marketplace', { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' })
  disablePlugin(repo, ['bkit@bkit-marketplace'])
  const s = readJson(settingsPath(repo))
  assert.equal(isPluginEnabled(repo, ['bkit@bkit-marketplace']), false)
  assert.equal(s.extraKnownMarketplaces?.['bkit-marketplace'], undefined)
})

test('배열 양식에서 enablePlugin은 배열에 추가한다', () => {
  const repo = makeTempRepo()
  mkdirSync(join(repo, '.claude'), { recursive: true })
  writeFileSync(settingsPath(repo), '{"enabledPlugins":["superpowers@claude-plugins-official"]}')
  enablePlugin(repo, 'bkit@bkit-marketplace', { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' })
  const s = readJson(settingsPath(repo))
  assert.deepEqual(s.enabledPlugins, ['superpowers@claude-plugins-official', 'bkit@bkit-marketplace'])
  assert.equal(isPluginEnabled(repo, ['bkit@bkit-marketplace']), true)
})

test('배열 양식에서 disablePlugin은 항목 제거와 고아 마켓 정리를 수행한다', () => {
  const repo = makeTempRepo()
  mkdirSync(join(repo, '.claude'), { recursive: true })
  writeFileSync(settingsPath(repo), JSON.stringify({
    enabledPlugins: ['bkit@bkit-marketplace', 'superpowers@claude-plugins-official'],
    extraKnownMarketplaces: { 'bkit-marketplace': { source: { source: 'github', repo: 'popup-studio-ai/bkit-claude-code' } } },
  }))
  disablePlugin(repo, ['bkit@bkit-marketplace'])
  const s = readJson(settingsPath(repo))
  assert.deepEqual(s.enabledPlugins, ['superpowers@claude-plugins-official'])
  assert.equal(s.extraKnownMarketplaces?.['bkit-marketplace'], undefined)
})

test('disablePlugin은 무관한 마켓플레이스를 보존한다', () => {
  const repo = makeTempRepo()
  enablePlugin(repo, 'bkit@bkit-marketplace', { name: 'bkit-marketplace', repo: 'popup-studio-ai/bkit-claude-code' })
  setKey(settingsPath(repo), ['extraKnownMarketplaces', 'my-unrelated-marketplace'], { source: { source: 'github', repo: 'someone/else' } })
  disablePlugin(repo, ['bkit@bkit-marketplace'])
  const s = readJson(settingsPath(repo))
  assert.equal(s.extraKnownMarketplaces?.['bkit-marketplace'], undefined)
  assert.equal(s.extraKnownMarketplaces['my-unrelated-marketplace'].source.repo, 'someone/else')
})
