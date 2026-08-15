import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createItem } from '../lib/items/global.superpowers.mjs'
import { createT } from '../lib/i18n/index.mjs'

// 전역 항목이라 실제 홈을 절대 건드리면 안 된다 — 모든 테스트가 임시 홈과
// 주입한 hasBinary로 돈다. 실측 근거(2026-08-15, 이 저장소 작업 머신):
//   codex   기록: $CODEX_HOME/config.toml [plugins."superpowers@…"]
//   copilot 기록: ~/.copilot/config.json installedPlugins[]
//   opencode 기록: 전역 opencode.json plugin 배열(.opencode/INSTALL.md)
function makeHome() {
  return mkdtempSync(join(tmpdir(), 'sp-global-'))
}

function fakeExec(failures = {}) {
  const calls = []
  const exec = async (cmd, args) => {
    const line = [cmd, ...args].join(' ')
    calls.push(line)
    const left = failures[line]
    if (left > 0) {
      failures[line] = left - 1
      return { ok: false, output: 'boom' }
    }
    return { ok: true, output: '' }
  }
  return { calls, exec }
}

const t = createT('en')
const bins = (...names) => (name) => names.includes(name)

test('아무 하니스에도 없으면 absent이고 없는 CLI를 detail로 알린다', async () => {
  const item = createItem({ home: makeHome(), env: {}, hasBinary: bins() })
  const r = await item.detect()
  assert.equal(r.status, 'absent')
  assert.equal(r.detail.key, 'item.global.noCli')
  assert.equal(r.detail.params.list, 'codex, gemini, opencode, copilot')
})

test('머신에 있는 CLI가 전부 배선되면 installed다 — 없는 CLI는 누락으로 세지 않는다', async () => {
  const home = makeHome()
  mkdirSync(join(home, '.copilot'), { recursive: true })
  writeFileSync(
    join(home, '.copilot', 'config.json'),
    JSON.stringify({ installedPlugins: [{ name: 'superpowers', marketplace: 'superpowers-marketplace' }] }),
  )
  const item = createItem({ home, env: {}, hasBinary: bins('copilot') })
  const r = await item.detect()
  assert.equal(r.status, 'installed')
  assert.equal(r.detail.params.list, 'codex, gemini, opencode')
})

test('CODEX_HOME 재지정을 따라간다', async () => {
  const home = makeHome()
  const codexHome = mkdtempSync(join(tmpdir(), 'sp-codex-'))
  writeFileSync(join(codexHome, 'config.toml'), '[plugins."superpowers@superpowers-marketplace"]\n')
  // 기본 홈에는 아무것도 없다 — 재지정을 무시하면 absent로 잘못 읽는다.
  const item = createItem({ home, env: { CODEX_HOME: codexHome }, hasBinary: bins('codex') })
  const r = await item.detect()
  assert.equal(r.status, 'installed')
})

test('install은 하니스별 공식 명령을 부르고 opencode는 전역 설정을 만든다', async () => {
  const home = makeHome()
  const { calls, exec } = fakeExec()
  const item = createItem({ home, env: {}, hasBinary: bins('codex', 'gemini', 'opencode', 'copilot') })
  const r = await item.install({ dryRun: false, exec, t })
  assert.equal(r, undefined)
  assert.deepEqual(calls, [
    'codex plugin marketplace add obra/superpowers-marketplace',
    'codex plugin add superpowers@superpowers-marketplace',
    'gemini extensions install https://github.com/obra/superpowers',
    'copilot plugin marketplace add obra/superpowers-marketplace',
    'copilot plugin install superpowers@superpowers-marketplace',
  ])
  const config = JSON.parse(readFileSync(join(home, '.config', 'opencode', 'opencode.json'), 'utf8'))
  assert.deepEqual(config.plugin, ['superpowers@git+https://github.com/obra/superpowers.git'])
})

test('copilot 명령은 한 번 재시도한다 — 다른 세션의 잠금(os error 5) 실측', async () => {
  const home = makeHome()
  const { calls, exec } = fakeExec({ 'copilot plugin install superpowers@superpowers-marketplace': 1 })
  const item = createItem({ home, env: {}, hasBinary: bins('copilot') })
  await item.install({ dryRun: false, exec, t })
  const installs = calls.filter((c) => c === 'copilot plugin install superpowers@superpowers-marketplace')
  assert.equal(installs.length, 2)
})

test('CLI 없는 하니스는 건너뛰고 message로 알린다', async () => {
  const home = makeHome()
  const { calls, exec } = fakeExec()
  const item = createItem({ home, env: {}, hasBinary: bins('gemini') })
  const r = await item.install({ dryRun: false, exec, t })
  assert.deepEqual(calls, ['gemini extensions install https://github.com/obra/superpowers'])
  assert.equal(r.message.key, 'item.global.skipped')
  assert.equal(r.message.params.list, 'codex, opencode, copilot')
})

test('전역 opencode.json의 plugin 키가 배열이 아니면 아무것도 만지기 전에 거절한다', async () => {
  const home = makeHome()
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(join(home, '.config', 'opencode', 'opencode.json'), '{"plugin": "oops"}')
  const { calls, exec } = fakeExec()
  const item = createItem({ home, env: {}, hasBinary: bins('codex', 'opencode') })
  await assert.rejects(() => item.install({ dryRun: false, exec, t }), /globalOpencodePlugin|not an array/)
  assert.deepEqual(calls, [])
})

test('명령 실패는 하니스 이름과 함께 모아 던진다', async () => {
  const home = makeHome()
  const { exec } = fakeExec({ 'gemini extensions install https://github.com/obra/superpowers': 9 })
  const item = createItem({ home, env: {}, hasBinary: bins('gemini') })
  await assert.rejects(() => item.install({ dryRun: false, exec, t }), /gemini: boom/)
})

test('dry-run install은 전역 파일을 만들지 않는다', async () => {
  const home = makeHome()
  const { exec } = fakeExec()
  const logs = []
  const item = createItem({ home, env: {}, hasBinary: bins('opencode') })
  await item.install({ dryRun: true, exec, log: (m) => logs.push(m), t })
  assert.equal(existsSync(join(home, '.config', 'opencode', 'opencode.json')), false)
  assert.equal(logs.length, 1)
})

// 이 머신 실측: superpowers@openai-curated처럼 다른 마켓플레이스로 설치된
// 흔적이 실제로 있다. 감지가 "있다"고 한 id 그대로 지워야 상태가 맞는다.
test('uninstall은 config.toml에서 찾은 codex 플러그인 id를 그대로 지운다', async () => {
  const home = makeHome()
  mkdirSync(join(home, '.codex'), { recursive: true })
  writeFileSync(join(home, '.codex', 'config.toml'), '[plugins."superpowers@openai-curated"]\n')
  const { calls, exec } = fakeExec()
  const item = createItem({ home, env: {}, hasBinary: bins('codex') })
  await item.uninstall({ dryRun: false, exec, t })
  assert.deepEqual(calls, ['codex plugin remove superpowers@openai-curated'])
})

test('uninstall은 opencode 배열에서 우리 항목만 빼고, 비면 키째 지운다', async () => {
  const home = makeHome()
  const file = join(home, '.config', 'opencode', 'opencode.json')
  mkdirSync(join(home, '.config', 'opencode'), { recursive: true })
  writeFileSync(file, JSON.stringify({
    plugin: ['other-plugin', 'superpowers@git+https://github.com/obra/superpowers.git'],
    theme: 'dark',
  }))
  const { exec } = fakeExec()
  const item = createItem({ home, env: {}, hasBinary: bins('opencode') })
  await item.uninstall({ dryRun: false, exec, t })
  let config = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual(config.plugin, ['other-plugin'])
  assert.equal(config.theme, 'dark')

  writeFileSync(file, JSON.stringify({ plugin: ['superpowers@git+https://github.com/obra/superpowers.git'] }))
  await item.uninstall({ dryRun: false, exec, t })
  config = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(config.plugin, undefined)
})

test('깨진 codex config.toml은 미설치로 읽는다', async () => {
  const home = makeHome()
  mkdirSync(join(home, '.codex'), { recursive: true })
  writeFileSync(join(home, '.codex', 'config.toml'), '[plugins."broken\n=')
  const item = createItem({ home, env: {}, hasBinary: bins('codex') })
  const r = await item.detect()
  assert.equal(r.status, 'absent')
})
