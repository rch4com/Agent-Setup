import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { runUpdate } from '../lib/update.mjs'
import { CLAUDE_SETTINGS } from '../lib/bootstrap/templates.mjs'
import { createT } from '../lib/i18n/index.mjs'

// 부트스트랩은 Claude Code의 Code Mode(실험 기능)를 저장소 설정 .claude/settings.json의
// env로 기본 켠다. 새 파일은 템플릿이, 기존 파일은 ensureJsonPaths가 맡는다 — 사용자가 이미
// 쓴 값은 무엇이든 덮지 않는다.
const KEY = 'CLAUDE_CODE_EXPERIMENTAL_CODE_MODE'
const FILE = '.claude/settings.json'
const t = createT('en')
const read = (root) => readFileSync(join(root, FILE), 'utf8')
const put = (root, text) => {
  mkdirSync(join(root, '.claude'), { recursive: true })
  writeFileSync(join(root, FILE), text)
}
const run = (root, opts = {}) => runBootstrap(root, { t, log() {}, ...opts })

test('새 저장소의 settings.json은 Code Mode를 켠 채로 만들어진다', () => {
  const root = makeTempRepo()
  const { failed } = run(root)
  assert.deepEqual(failed, [])
  assert.deepEqual(JSON.parse(read(root)), { env: { [KEY]: '1' } })
  assert.deepEqual(JSON.parse(CLAUDE_SETTINGS), { env: { [KEY]: '1' } })
})

test('다른 키만 있는 기존 settings.json에는 env를 더하고 나머지는 지킨다', () => {
  const root = makeTempRepo()
  put(root, '{\n  "model": "opus",\n  "permissions": { "allow": ["Bash(ls)"] }\n}\n')
  run(root)
  assert.deepEqual(JSON.parse(read(root)), {
    model: 'opus', permissions: { allow: ['Bash(ls)'] }, env: { [KEY]: '1' },
  })
  const once = read(root)
  run(root)
  assert.equal(read(root), once, '재실행은 바꾸지 않는다')
})

test('이미 있는 env 객체 안에 키만 더하고 다른 변수는 지킨다', () => {
  const root = makeTempRepo()
  put(root, '{\n  "env": {\n    "FOO": "bar"\n  }\n}\n')
  run(root)
  assert.deepEqual(JSON.parse(read(root)), { env: { FOO: 'bar', [KEY]: '1' } })
})

test('사용자가 값을 정해 둔 키는 무엇이든 건드리지 않는다 — "0"은 다시 켜지지 않는다', () => {
  const root = makeTempRepo()
  const mine = `{\n  "env": {\n    "${KEY}": "0"\n  }\n}\n`
  put(root, mine)
  run(root)
  run(root)
  assert.equal(read(root), mine)
})

test('JSON으로 읽을 수 없거나 env가 객체가 아니면 건드리지 않고 경고만 한다', () => {
  for (const mine of ['{\n  // 주석\n  "model": "opus"\n}\n', '{ "env": "no" }\n', '[]\n', '{ broken']) {
    const root = makeTempRepo()
    put(root, mine)
    const { failed } = run(root)
    assert.deepEqual(failed, [], `실패로 끝나면 안 된다: ${mine}`)
    assert.equal(read(root), mine)
  }
})

test('파일의 들여쓰기·줄바꿈·끝 개행을 따른다', () => {
  const root = makeTempRepo()
  put(root, '{\r\n\t"model": "opus"\r\n}\r\n')
  run(root)
  const text = read(root)
  assert.equal(text, '{\r\n\t"model": "opus",\r\n\t"env": {\r\n\t\t"' + KEY + '": "1"\r\n\t}\r\n}\r\n')

  const bare = makeTempRepo()
  put(bare, '{"model":"opus"}')
  run(bare)
  assert.ok(!read(bare).endsWith('\n'), '끝 개행이 없던 파일에 만들어 붙이지 않는다')
  assert.deepEqual(JSON.parse(read(bare)), { model: 'opus', env: { [KEY]: '1' } })
})

test('dry-run은 기존 settings.json을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const mine = '{ "model": "opus" }\n'
  put(root, mine)
  run(root, { dryRun: true })
  assert.equal(read(root), mine)
})

test('update도 같은 규칙으로 기존 사용자 파일에 키를 더한다', async () => {
  const root = makeTempRepo()
  run(root)
  // 사용자가 env를 지우고 다른 설정을 넣었다 — 우리가 쓴 그대로가 아니니 템플릿 갱신 대상이 아니다.
  put(root, '{ "model": "opus" }\n')
  await runUpdate(root, { t, log() {} })
  assert.deepEqual(JSON.parse(read(root)), { model: 'opus', env: { [KEY]: '1' } })
  const once = read(root)
  await runUpdate(root, { t, log() {} })
  assert.equal(read(root), once)
})

test('옛 부트스트랩이 만든 빈 {} 설정은 update로 새 템플릿이 된다', async () => {
  const root = makeTempRepo()
  run(root)
  // 옛 버전의 상태를 흉내 낸다: 템플릿이 {}였고 기록의 해시도 {}의 것이다.
  put(root, '{}\n')
  const { hashBody } = await import('../lib/bootstrap/text.mjs')
  const recordFile = join(root, '.agent-kit/agent-setup.json')
  const record = JSON.parse(readFileSync(recordFile, 'utf8'))
  record.managed[FILE] = hashBody('{}')
  writeFileSync(recordFile, `${JSON.stringify(record, null, 2)}\n`)

  await runUpdate(root, { t, log() {} })
  assert.equal(read(root), `${CLAUDE_SETTINGS}\n`, '템플릿과 같은 내용')
})
