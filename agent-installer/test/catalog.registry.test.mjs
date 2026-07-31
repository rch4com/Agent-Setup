import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineRegistrySkill } from '../lib/catalog.mjs'
import { makeTempRepo } from './helpers.mjs'

// 레지스트리 스킬은 .agents/skills에 실물을 남긴다 — 이 저장소가 이미 공유
// 스킬 자리로 쓰는 디렉터리다. 그래서 검사는 두 가지를 본다:
// (1) 설치된 디렉터리 이름이 스킬 이름과 달라도 찾아내는가,
// (2) 레지스트리 remove가 디렉터리를 남겨도 우리가 지우는가.
// (2)는 실측에서 나왔다 — `skills remove --agent universal`은 "Done!"을 찍고도
// 디렉터리를 그대로 뒀다. 폴백이 없으면 제거가 성공으로 보이고 다음 스캔에서
// 되살아난 것처럼 읽힌다.

function putSkill(root, dir, name) {
  const path = join(root, '.agents', 'skills', dir)
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, 'SKILL.md'), `---\nname: ${name}\ndescription: t\n---\n\n# ${name}\n`)
  return path
}

function item(over = {}) {
  return defineRegistrySkill({
    id: 'skill.t', label: 'T', source: 'https://github.com/o/r', skill: 'design-taste-frontend', ...over,
  })
}

function recordingExec(ok = true) {
  const calls = []
  const exec = (cmd, args) => {
    calls.push([cmd, ...args].join(' '))
    return { ok, output: ok ? '' : 'boom' }
  }
  exec.calls = calls
  return exec
}

test('레지스트리 스킬: 지원 CLI는 전부다 — .agents/skills를 10개가 함께 본다', () => {
  const it = item()
  assert.equal(it.category, 'skill')
  assert.equal(it.scope, 'project')
  assert.deepEqual(it.unsupported, {})
  assert.ok(it.supports.includes('claude') && it.supports.includes('vscode'))
})

test('레지스트리 스킬 detect: 없으면 absent, 같은 이름 디렉터리면 installed', async () => {
  const root = makeTempRepo()
  const it = item()
  assert.equal((await it.detect({ root })).status, 'absent')
  putSkill(root, 'design-taste-frontend', 'design-taste-frontend')
  assert.equal((await it.detect({ root })).status, 'installed')
})

test('레지스트리 스킬 detect: 폴더 이름이 달라도 frontmatter name으로 찾는다', async () => {
  // taste-skill/ 폴더가 design-taste-frontend를 담는 실제 사례.
  const root = makeTempRepo()
  putSkill(root, 'taste-skill', 'design-taste-frontend')
  assert.equal((await item().detect({ root })).status, 'installed')
})

test('레지스트리 스킬 detect: 다른 스킬만 있으면 absent다', async () => {
  const root = makeTempRepo()
  putSkill(root, 'repository-check', 'repository-check')
  assert.equal((await item().detect({ root })).status, 'absent')
})

test('레지스트리 스킬 install: universal 스코프로, 링크가 아닌 복사로 넣는다', async () => {
  const root = makeTempRepo()
  const exec = recordingExec()
  await item().install({ root, exec })

  const cmd = exec.calls[0]
  assert.match(cmd, /skills@latest add https:\/\/github\.com\/o\/r/)
  assert.match(cmd, /--skill design-taste-frontend/)
  // universal의 프로젝트 경로가 .agents/skills다. -g(전역)는 절대 붙지 않는다.
  assert.match(cmd, /--agent universal/)
  assert.ok(!/(^| )-g( |$)|--global/.test(cmd), '전역 설치 플래그가 섞였다')
  // 커밋해서 나누는 자리라 심볼릭 링크는 클론 뒤 깨진다.
  assert.match(cmd, /--copy/)
})

test('레지스트리 스킬 install: 실패는 삼키지 않는다', async () => {
  await assert.rejects(
    () => item().install({ root: makeTempRepo(), exec: recordingExec(false) }),
    (err) => err.key === 'error.registrySkillInstall',
  )
})

test('레지스트리 스킬 uninstall: 레지스트리가 남겨 둔 디렉터리를 우리가 지운다', async () => {
  const root = makeTempRepo()
  const dir = putSkill(root, 'taste-skill', 'design-taste-frontend')
  // remove가 "성공"을 돌려주고도 디렉터리를 남기는 실제 동작을 그대로 흉내 낸다.
  await item().uninstall({ root, dryRun: false, exec: recordingExec(true) })
  assert.equal(existsSync(dir), false)
  assert.equal((await item().detect({ root })).status, 'absent')
})

test('레지스트리 스킬 uninstall: dry-run은 아무것도 지우지 않는다', async () => {
  const root = makeTempRepo()
  const dir = putSkill(root, 'design-taste-frontend', 'design-taste-frontend')
  await item().uninstall({ root, dryRun: true, exec: recordingExec(true) })
  assert.equal(existsSync(dir), true)
})
