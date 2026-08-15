import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import item from '../lib/items/skill.gsd.mjs'
import { makeTempRepo } from './helpers.mjs'

// GSD는 런타임 플래그를 여러 개 함께 받는다(2026-08-15 실측: `--claude --codex
// --local`이 두 디렉터리를 만든다). 그래서 설치·제거가 호출 한 번이고, 그
// 한 번에 어느 플래그가 실리는지가 이 항목의 전부다.
const DIRS = {
  claude: '.claude/commands',
  codex: '.codex/skills',
  opencode: '.opencode/skills',
  copilot: '.github/skills',
  kilo: '.kilo/skills',
}

// 상류가 만드는 모양을 흉내 낸다 — 스킬 하나가 gsd- 접두사 디렉터리다.
function putGsd(root, cli) {
  mkdirSync(join(root, ...DIRS[cli].split('/'), 'gsd-plan-phase'), { recursive: true })
}

// 제거 후 상류가 남기는 잔재(실측: gsd-install-state.json, 훅 몇 개).
function putLeftover(root, cli) {
  const dir = join(root, ...DIRS[cli].split('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(root, ...DIRS[cli].split('/').slice(0, 1), 'gsd-install-state.json'), '{}')
}

function recordingExec() {
  const calls = []
  const exec = async (cmd, args) => {
    calls.push([cmd, ...args].join(' '))
    return { ok: true, output: '' }
  }
  return { calls, exec }
}

test('다섯 런타임을 배선하고 미배선 넷은 사유가 다르다', () => {
  assert.deepEqual(item.supports, ['claude', 'codex', 'opencode', 'copilot', 'kilo'])
  assert.equal(item.unsupported.gemini.key, 'item.unsupported.gsdGemini')
  assert.equal(item.unsupported.kimi.key, 'item.unsupported.gsdKimiLocal')
  for (const cli of ['kiro', 'grok', 'vscode']) {
    assert.equal(item.unsupported[cli].key, 'item.unsupported.upstreamNone', cli)
  }
  assert.ok(!('codex' in item.unsupported), '배선하는 CLI가 미배선 사유를 갖는다')
})

test('detect: 없으면 absent, 다섯 다 있으면 installed, 일부면 partial', async () => {
  const root = makeTempRepo()
  assert.equal((await item.detect({ root })).status, 'absent')

  putGsd(root, 'codex')
  const partial = await item.detect({ root })
  assert.equal(partial.status, 'partial')
  assert.equal(partial.detail.params.present, 'codex')
  assert.equal(partial.detail.params.missing, 'claude, opencode, copilot, kilo')

  for (const cli of ['claude', 'opencode', 'copilot', 'kilo']) putGsd(root, cli)
  assert.equal((await item.detect({ root })).status, 'installed')
})

// 상류 제거는 디렉터리와 gsd-install-state.json을 남긴다(실측). 파일 존재만
// 보면 제거한 런타임이 영원히 설치됨으로 읽힌다.
test('detect: 제거 잔재는 설치로 세지 않는다', async () => {
  const root = makeTempRepo()
  putLeftover(root, 'codex')
  assert.equal((await item.detect({ root })).status, 'absent')
})

test('install: 누락된 런타임 플래그만 한 번에 넘긴다', async () => {
  const root = makeTempRepo()
  const { calls, exec } = recordingExec()
  await item.install({ root, exec })
  assert.equal(calls.length, 1, '호출은 한 번이다')
  assert.equal(
    calls[0],
    'npx -y @opengsd/gsd-core@latest --claude --codex --opencode --copilot --kilo --local',
  )
})

test('install: 이미 있는 런타임은 다시 쓰지 않는다', async () => {
  const root = makeTempRepo()
  putGsd(root, 'claude')
  putGsd(root, 'kilo')
  const { calls, exec } = recordingExec()
  await item.install({ root, exec })
  assert.equal(calls[0], 'npx -y @opengsd/gsd-core@latest --codex --opencode --copilot --local')
})

// 런타임 플래그 없는 --uninstall은 기본값 claude만 지운다 — 설치된 것을 전부
// 넘겨야 나머지가 남지 않는다.
test('uninstall: 설치된 런타임 플래그를 전부 넘긴다', async () => {
  const root = makeTempRepo()
  putGsd(root, 'codex')
  putGsd(root, 'copilot')
  const { calls, exec } = recordingExec()
  await item.uninstall({ root, exec })
  assert.equal(calls[0], 'npx -y @opengsd/gsd-core@latest --codex --copilot --local --uninstall')
})

test('uninstall: 설치된 것이 없으면 아무것도 부르지 않는다', async () => {
  const { calls, exec } = recordingExec()
  await item.uninstall({ root: makeTempRepo(), exec })
  assert.deepEqual(calls, [])
})
