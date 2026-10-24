import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import def from '../lib/items/skill.gsd.mjs'
import { bindScope } from '../lib/recipe.mjs'
import { createProbe } from '../lib/probe.mjs'
import { makeTempRepo } from './helpers.mjs'

// GSD는 런타임 플래그(--claude 등)로 저장소 안 디렉터리에 설치한다. 런타임마다
// 명령 한 줄이라, 부분 설치를 완성할 때 빠진 런타임만 돈다.
const item = bindScope(def, 'project')
const DIRS = {
  claude: '.claude/commands',
  codex: '.codex/skills',
  opencode: '.opencode/skills',
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

// 세 CLI가 모두 PATH에 있는 머신을 흉내 낸다 — 런타임 디렉터리는 실제 파일을 본다.
function detect(root) {
  const probe = { ...createProbe({ root, scope: 'project', exec: async () => ({ ok: false, output: '' }) }), has: () => true }
  return item.detect({ probe })
}

test('세 런타임을 배선하고 Antigravity는 미실측 사유를 단다', () => {
  assert.deepEqual(item.supports, ['claude', 'codex', 'opencode'])
  assert.equal(item.unsupported.antigravity.key, 'item.unsupported.unmeasuredUpstream')
  assert.equal(bindScope(def, 'user'), null, '전역 설치는 배선하지 않는다')
})

test('detect: 없으면 absent, 셋 다 있으면 installed, 일부면 partial', async () => {
  const root = makeTempRepo()
  assert.equal((await detect(root)).status, 'absent')

  putGsd(root, 'codex')
  const partial = await detect(root)
  assert.equal(partial.status, 'partial')
  assert.equal(partial.detail.params.present, 'codex')
  assert.equal(partial.detail.params.missing, 'claude, opencode')

  for (const cli of ['claude', 'opencode']) putGsd(root, cli)
  assert.equal((await detect(root)).status, 'installed')
})

// 상류 제거는 디렉터리와 gsd-install-state.json을 남긴다(실측). 파일 존재만
// 보면 제거한 런타임이 영원히 설치됨으로 읽힌다.
test('detect: 제거 잔재는 설치로 세지 않는다', async () => {
  const root = makeTempRepo()
  putLeftover(root, 'codex')
  assert.equal((await detect(root)).status, 'absent')
})

test('install: 런타임마다 한 줄, 이미 있는 런타임은 다시 쓰지 않는다', async () => {
  const root = makeTempRepo()
  putGsd(root, 'claude')
  const { calls, exec } = recordingExec()
  await item.install({ root, exec, state: await detect(root) })
  assert.deepEqual(calls, [
    'npx -y @opengsd/gsd-core@latest --codex --local',
    'npx -y @opengsd/gsd-core@latest --opencode --local',
  ])
})

// 런타임 플래그 없는 --uninstall은 기본값 claude만 지운다 — 늘 플래그를 준다.
test('uninstall: 설치된 런타임마다 플래그를 붙여 지운다', async () => {
  const root = makeTempRepo()
  putGsd(root, 'codex')
  const { calls, exec } = recordingExec()
  await item.uninstall({ root, exec, state: await detect(root) })
  assert.deepEqual(calls, ['npx -y @opengsd/gsd-core@latest --codex --local --uninstall'])
})

test('uninstall: 설치된 것이 없으면 아무것도 부르지 않는다', async () => {
  const root = makeTempRepo()
  const { calls, exec } = recordingExec()
  await item.uninstall({ root, exec, state: await detect(root) })
  assert.deepEqual(calls, [])
})
