import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadItems } from '../lib/catalog.mjs'
import { assertExclusive } from '../lib/engine.mjs'
import { createT, toText } from '../lib/i18n/index.mjs'
import { GROUP_ORDER } from '../lib/tui/rows.mjs'
import { LABEL_WIDTH, width } from '../lib/tui/render.mjs'
import { categoryLabel } from '../lib/design-md/flow.mjs'
import EN from '../lib/i18n/catalog/en.mjs'
import { makeTempRepo } from './helpers.mjs'

const both = async () => [...await loadItems(), ...await loadItems({ scope: 'user' })]

test('loadItems: project 39개, user 31개를 id순으로', async () => {
  const project = await loadItems()
  assert.equal(project.length, 39)
  const ids = project.map((i) => i.id)
  assert.deepEqual(ids, [...ids].sort())
  for (const id of [
    'config.gitmessage.en', 'config.gitmessage.ko', 'mcp.codebase-memory', 'mcp.graft', 'mcp.graphify', 'mcp.headroom',
    'mcp.notion', 'mcp.supabase', 'mcp.vercel', 'plugin.ai-memory', 'plugin.cli-anything', 'plugin.ecc', 'plugin.hyperframes',
    'plugin.impeccable', 'plugin.mattpocock-skills', 'plugin.ponytail', 'plugin.superpowers', 'plugin.understand-anything',
    'skill.agent-browser', 'skill.archify', 'skill.caveman', 'skill.diagram-design', 'skill.eli5', 'skill.find-skills',
    'skill.gsd', 'skill.gstack', 'skill.hallmark', 'skill.i-have-adhd', 'skill.im-not-ai', 'skill.impeccable', 'skill.karpathy',
    'skill.mattpocock-skills', 'skill.mcp-builder', 'skill.officecli', 'skill.prompt-master', 'skill.remotion', 'skill.strix',
    'skill.superpowers', 'skill.taste',
  ]) assert.ok(ids.includes(id), id)
  // 전역 판은 같은 항목의 다른 범위로 합쳐졌다.
  for (const id of ['global.ponytail', 'global.superpowers', 'mcp.ai-memory']) assert.ok(!ids.includes(id), id)
  assert.ok(project.every((i) => i.scope === 'project'))

  const user = await loadItems({ scope: 'user' })
  assert.equal(user.length, 31)
  const uids = user.map((i) => i.id)
  // 파일을 직접 쓰는 항목·저장소 전용 설치기·전역 제거를 추적 못 하는 스킬 묶음은 전역에 없다.
  for (const id of ['skill.gsd', 'skill.gstack', 'skill.superpowers', 'skill.mattpocock-skills', 'skill.strix', 'skill.im-not-ai', 'config.gitmessage.ko', 'config.gitmessage.en']) {
    assert.ok(!uids.includes(id), `${id}는 전역에 없다`)
  }
  assert.ok(user.every((i) => i.scope === 'user'))
})

// 같은 상류를 플러그인과 공유 스킬 양쪽으로 넣으면 같은 스킬이 두 경로에서
// 잡혀 중복 등록된다. 배타 키가 풀리면 TUI가 형제를 자동으로 끄지 않고
// --set도 둘을 함께 받아 조용히 그 상태를 만든다.
test('같은 상류의 플러그인 판과 스킬 판은 배타다', async () => {
  const items = await loadItems()
  const pick = (id) => items.find((i) => i.id === id)
  for (const [pluginId, skillId, key] of [
    ['plugin.superpowers', 'skill.superpowers', 'superpowers'],
    ['plugin.mattpocock-skills', 'skill.mattpocock-skills', 'mattpocock'],
    ['plugin.impeccable', 'skill.impeccable', 'impeccable'],
  ]) {
    assert.equal(pick(pluginId).exclusive, key, `${pluginId}: 배타 키가 없다`)
    assert.equal(pick(skillId).exclusive, key, `${skillId}: 배타 키가 없다`)
    assert.throws(
      () => assertExclusive(items, new Set([pluginId, skillId])),
      /exclusiveItems|한 자리|same slot/,
      `${key}: 둘을 함께 골라도 거절하지 않는다`,
    )
  }
})

// 그룹은 화면의 소분류 헤더로 나가므로, 오타 하나가 헤더를 raw id(`__tokne`)로
// 찍는다. 표시 순서를 정하는 GROUP_ORDER와 실제 값이 갈리는 것도 여기서 잡는다.
test('모든 항목의 성격 그룹은 GROUP_ORDER에 있고 번역 키가 있다', async () => {
  const t = createT('en')
  for (const item of await both()) {
    assert.ok(item.group, `${item.id}: 성격 그룹이 없다`)
    assert.ok(GROUP_ORDER.includes(item.group), `${item.id}: 알 수 없는 그룹 '${item.group}'`)
    assert.notEqual(categoryLabel(t, item.group), item.group, `${item.id}: 그룹 라벨이 번역되지 않는다`)
  }
})

test('모든 항목은 카테고리와 스코프가 유효하다', async () => {
  for (const item of await both()) {
    assert.ok(['plugin', 'mcp', 'skill', 'config'].includes(item.category))
    assert.ok(['project', 'user'].includes(item.scope))
  }
})

// 라벨 자리는 LABEL_WIDTH칸이다 — 넘치면 목록에서 조용히 잘린다. 하필 잘리는
// 자리가 항목을 가르는 꼬리표일 수 있어(…(Englis…) 눈으로만 보면 놓친다.
test('모든 항목의 라벨이 LABEL_WIDTH 안에 든다', async () => {
  for (const item of await loadItems()) {
    assert.ok(width(item.label) <= LABEL_WIDTH, `${item.id}: 라벨 폭 ${width(item.label)} > ${LABEL_WIDTH} — "${item.label}"`)
  }
})

test('항목의 note·postInstall은 카탈로그에 있는 키다', async () => {
  // note를 문자열로 두면 어느 로케일에서도 그 언어로만 나온다.
  const t = createT('en')
  for (const item of await both()) {
    for (const key of [item.note, item.postInstall].filter(Boolean)) {
      assert.ok(Object.hasOwn(EN, key), `${item.id}: 키 '${key}'가 카탈로그에 없다`)
      assert.doesNotThrow(() => t(key))
    }
  }
})

// 상류 지원 현황을 1차 자료로 검증해 사유에 반영했다. 일괄 사유로 되돌아가면
// 상류가 실제로 지원하는 CLI에 거짓 정보가 나간다 — 검증된 판정을 고정한다.
test('검증된 항목은 CLI별로 정확한 미배선 사유를 갖는다', async () => {
  const project = await loadItems()
  const user = await loadItems({ scope: 'user' })
  const why = (items, id, cli) => items.find((i) => i.id === id).unsupported[cli]?.key
  // 범위만 다르면 "범위를 바꾸라"가 사유다.
  assert.equal(why(project, 'plugin.ponytail', 'codex'), 'item.unsupported.userOnly')
  assert.equal(why(project, 'plugin.ponytail', 'antigravity'), 'item.unsupported.userOnly')
  assert.equal(why(project, 'mcp.notion', 'codex'), 'item.unsupported.userOnly')
  // 상류가 지원하는 CLI는 공유 스킬 판(skill.impeccable)이 맡는다
  assert.equal(why(project, 'plugin.impeccable', 'codex'), 'item.unsupported.impeccableSkill')
  // gstack: 공유 Junction 도달과 재귀 스캔(2026-08-15 실측)
  assert.equal(why(project, 'skill.gstack', 'codex'), 'item.unsupported.gstackShared')
  assert.equal(why(project, 'skill.gstack', 'antigravity'), 'item.unsupported.upstreamNone')
  assert.equal(why(project, 'skill.gsd', 'antigravity'), 'item.unsupported.unmeasuredUpstream')
  // ECC는 OpenCode·Antigravity를 install.sh로만 지원하고 skills/ 284개가 문제다
  assert.equal(why(user, 'plugin.ecc', 'opencode'), 'item.unsupported.eccScale')
  assert.equal(why(user, 'plugin.ecc', 'codex'), undefined, 'Codex는 네이티브 플러그인으로 배선한다')
  assert.equal(why(user, 'plugin.understand-anything', 'codex'), 'item.unsupported.uaUser')
  assert.equal(why(user, 'plugin.mattpocock-skills', 'opencode'), 'item.unsupported.mattpocockRegistry')
  assert.equal(why(user, 'plugin.mattpocock-skills', 'codex'), undefined)
})

test('Ponytail·ai-memory 전역 명령은 상류 안내와 같다', async () => {
  const user = await loadItems({ scope: 'user' })
  const pick = (id) => user.find((i) => i.id === id)
  const cmds = (item) => item.steps('install', { targets: item.supports }).filter((s) => s.argv).map((s) => s.argv.join(' '))
  assert.deepEqual(cmds(pick('plugin.ponytail')).filter((c) => c.startsWith('codex')), [
    'codex plugin marketplace add DietrichGebert/ponytail', 'codex plugin add ponytail@ponytail',
  ])
  assert.deepEqual(cmds(pick('plugin.ai-memory')).filter((c) => c.startsWith('codex')), [
    'codex plugin marketplace add akitaonrails/ai-memory', 'codex plugin add ai-memory@ai-memory',
  ])
  assert.ok(cmds(pick('plugin.ai-memory')).includes('agy mcp add ai-memory -- ai-memory mcp-bridge --no-session-id'))
  assert.ok(pick('plugin.ponytail').hooks && pick('plugin.ai-memory').hooks, 'Codex /hooks 신뢰 안내가 붙어야 한다')
})

test('unsupported 사유는 구조화 메시지다', async () => {
  const t = createT('en')
  for (const item of await both()) {
    for (const [cli, why] of Object.entries(item.unsupported ?? {})) {
      assert.equal(typeof why, 'object', `${item.id}/${cli}: 사유가 구조체가 아니다`)
      // 화면과 같은 경로(toText)로 렌더한다 — 매개변수를 쓰는 사유도 거짓 실패하지 않는다.
      assert.doesNotThrow(() => toText(t, why), `${item.id}/${cli}: 렌더 실패 ${why.key}`)
    }
  }
})

// 접미사는 scopedLabel이 로케일에 맞춰 붙인다 — 정적 라벨에 수기 접미사가
// 남으면 화면에 'superpowers (plugin) (저장소)'처럼 이중으로 찍힌다.
test('plugin 항목 라벨에 수기 범위 접미사가 없다', async () => {
  const items = await loadItems()
  for (const item of items.filter((i) => i.category === 'plugin')) {
    assert.doesNotMatch(item.label, /\((plugin|global)\)/, `${item.id}: 라벨에 수기 접미사가 남았다`)
  }
})

// gstack 제거가 설치 때 넣은 .gitignore 두 줄을 도로 가져간다.
test('gstack 제거는 자기가 넣은 .gitignore 항목을 걷어낸다', async () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.claude', 'skills', 'gstack', 'bin'), { recursive: true })
  writeFileSync(join(root, '.gitignore'), '*.log\n.claude/skills/gstack\n.agents/skills/gstack\n')
  const item = (await loadItems()).find((i) => i.id === 'skill.gstack')
  await item.uninstall({ root, dryRun: false, exec: async () => ({ ok: false, output: '' }), state: { present: ['claude'], targets: ['claude'] } })
  assert.equal(existsSync(join(root, '.claude', 'skills', 'gstack')), false)
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), '*.log\n')
})

// gstack setup이 실패하면 반쯤 깔린 클론을 지운다 — 남기면 다음 감지가 설치됨으로 읽는다.
test('gstack 설치: setup 실패는 클론을 지우고 실패로 보고한다', async () => {
  const root = makeTempRepo()
  const item = (await loadItems()).find((i) => i.id === 'skill.gstack')
  const exec = async (cmd, args) => {
    if (cmd === 'git') { mkdirSync(join(root, '.claude', 'skills', 'gstack'), { recursive: true }); return { ok: true, output: '' } }
    return { ok: false, output: 'setup broke' }
  }
  await assert.rejects(() => item.install({ root, dryRun: false, exec, state: { present: [], targets: ['claude'] } }), /setup broke/)
  assert.equal(existsSync(join(root, '.claude', 'skills', 'gstack')), false)
})

// 잠금 파일의 스킬 이름은 상류 SKILL.md frontmatter에서 온다 — 신뢰 경계 밖이다.
// 정규식 메타문자가 든 이름이 RegExp 생성을 깨뜨리면 제거가 중간에 죽어,
// 이미 `npx skills remove`를 부른 뒤 나머지 스킬이 그대로 남는다.
test('레지스트리 스킬 제거는 정규식 메타문자가 든 잠금 이름에도 끝까지 돈다', async () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.agents', 'skills', 'good'), { recursive: true })
  writeFileSync(join(root, '.agents', 'skills', 'good', 'SKILL.md'), '---\nname: good\n---\n')
  writeFileSync(join(root, 'skills-lock.json'), JSON.stringify({
    skills: { 'evil(': { source: 'obra/superpowers' }, good: { source: 'obra/superpowers' } },
  }))
  const item = (await loadItems()).find((i) => i.id === 'skill.superpowers')
  const removed = []
  await item.uninstall({ root, dryRun: false, exec: async (_cmd, args) => { removed.push(args[3]); return { ok: true, output: '' } }, state: { present: ['shared'], targets: ['shared'] } })
  assert.deepEqual(removed.sort(), ['evil(', 'good'])
  assert.equal(existsSync(join(root, '.agents', 'skills', 'good')), false)
  assert.equal(existsSync(join(root, 'skills-lock.json')), false)
})

// 경로 구분자·상위 이동·선행 대시가 든 이름은 CLI 인자도 경로도 될 수 없다 —
// `--flag`는 skills CLI의 플래그로 읽히고, `..`는 공유 디렉터리 밖을 가리킨다.
test('레지스트리 스킬 제거는 인자·경로로 쓸 수 없는 잠금 이름을 건너뛴다', async () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'skills-lock.json'), JSON.stringify({
    skills: { '--yes': { source: 'obra/superpowers' }, '../escape': { source: 'obra/superpowers' }, good: { source: 'obra/superpowers' } },
  }))
  const item = (await loadItems()).find((i) => i.id === 'skill.superpowers')
  const removed = []
  await item.uninstall({ root, dryRun: false, exec: async (_cmd, args) => { removed.push(args[3]); return { ok: true, output: '' } }, state: { present: ['shared'], targets: ['shared'] } })
  assert.deepEqual(removed, ['good'])
  // 건너뛴 이름은 잠금 파일에도 남지 않는다 — 남기면 다음 제거가 같은 자리에서 또 멈춘다.
  assert.equal(existsSync(join(root, 'skills-lock.json')), false)
})

// Codex는 원격 MCP의 OAuth 로그인을 설치 때 끝내지 못한다 — 설치 후 할 일에 그 단계를 싣는다.
test('원격 MCP 항목은 OAuth 로그인 안내를 단다', async () => {
  const user = await loadItems({ scope: 'user' })
  for (const id of ['mcp.notion', 'mcp.supabase', 'mcp.vercel']) {
    assert.equal(user.find((i) => i.id === id).postInstall, 'item.mcp.oauth.post', id)
  }
  assert.match(createT('en')('item.mcp.oauth.post'), /codex mcp login/)
})
