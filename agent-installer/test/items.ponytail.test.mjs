import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import ponytail from '../lib/items/plugin.ponytail.mjs'
import { createT, toText } from '../lib/i18n/index.mjs'
import { makeTempRepo, makeCapture } from './helpers.mjs'

// 이 항목만 두 CLI에 동시에 배선한다 — Claude Code는 플러그인 CLI(없으면
// .claude/settings.json 기록), OpenCode는 opencode.jsonc의 plugin 배열.
// 배열을 건드리는 코드는 이 저장소에 여기밖에 없어서, 기존 값 보존과
// 멱등성을 지켜 주는 검사가 따로 필요하다.

const T = createT('ko')
const ENTRY = '@dietrichgebert/ponytail'
const OPENCODE = 'opencode.jsonc'

// claude 명령이 없는 환경. install은 설정 기록으로 폴백해야 하고, 그 결과가
// detect에 그대로 보여야 한다 — CI와 실제 사용자 환경 다수가 이 경로다.
function failingExec(calls = []) {
  return (cmd, args) => {
    calls.push([cmd, ...args].join(' '))
    return { ok: false, output: 'not found' }
  }
}

// dry-run의 exec는 아무것도 실행하지 않고 성공을 돌려준다(makeExec와 같다).
const dryExec = () => ({ ok: true, output: '' })

function readOpencode(root) {
  const file = join(root, OPENCODE)
  return existsSync(file) ? parse(readFileSync(file, 'utf8')) : undefined
}

function writeOpencode(root, obj) {
  writeFileSync(join(root, OPENCODE), `${JSON.stringify(obj, null, 2)}\n`)
}

test('ponytail detect: 아무 배선도 없으면 absent', async () => {
  assert.equal((await ponytail.detect({ root: makeTempRepo() })).status, 'absent')
})

test('ponytail install: claude가 없으면 설정에 기록하고 opencode plugin 배열을 만든다', async () => {
  const root = makeTempRepo()
  const calls = []
  const r = await ponytail.install({ root, dryRun: false, exec: failingExec(calls), t: T })

  // 폴백은 조용히 성공한 척하지 않는다 — 다음 실행에서 받는다고 알린다.
  assert.equal(r.fallback, true)
  assert.equal(r.message.key, 'item.plugin.deferred')
  assert.ok(calls.some((c) => c.includes('plugin install ponytail@ponytail --scope project')))
  // 상류 안내는 --scope user다. 프로젝트 스코프로 넘겼는지가 이 항목의 핵심이다.
  assert.ok(!calls.some((c) => c.includes('--scope user')))

  assert.deepEqual(readOpencode(root).plugin, [ENTRY])
  const settings = parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'))
  assert.ok(JSON.stringify(settings.enabledPlugins).includes('ponytail@ponytail'))
  assert.equal((await ponytail.detect({ root })).status, 'installed')
})

test('ponytail install: 기존 plugin 항목을 보존하고 끝에 덧붙인다', async () => {
  const root = makeTempRepo()
  writeOpencode(root, { plugin: ['@someone/other'], mcp: {} })
  await ponytail.install({ root, dryRun: false, exec: failingExec(), t: T })

  const after = readOpencode(root)
  assert.deepEqual(after.plugin, ['@someone/other', ENTRY])
  assert.deepEqual(after.mcp, {}, '다른 키가 사라졌다')
})

test('ponytail install: 두 번 돌려도 항목이 중복되지 않는다', async () => {
  const root = makeTempRepo()
  await ponytail.install({ root, dryRun: false, exec: failingExec(), t: T })
  await ponytail.install({ root, dryRun: false, exec: failingExec(), t: T })
  assert.deepEqual(readOpencode(root).plugin, [ENTRY])
})

test('ponytail detect: 한쪽만 배선되면 partial이고 어느 쪽인지 담는다', async () => {
  const root = makeTempRepo()
  writeOpencode(root, { plugin: [ENTRY] })

  const r = await ponytail.detect({ root })
  assert.equal(r.status, 'partial')
  assert.equal(r.detail.key, 'item.plugin.partial')
  assert.equal(r.detail.params.present, 'opencode')
  assert.equal(r.detail.params.missing, 'claude')
  assert.match(toText(T, r.detail), /opencode/)
})

test('ponytail uninstall: 우리 항목만 빼고, 남은 게 없으면 plugin 키를 지운다', async () => {
  const root = makeTempRepo()
  writeOpencode(root, { plugin: [ENTRY] })
  await ponytail.uninstall({ root, dryRun: false, exec: failingExec(), t: T })
  assert.equal(readOpencode(root).plugin, undefined, '빈 배열이 남았다')

  writeOpencode(root, { plugin: ['@someone/other', ENTRY] })
  await ponytail.uninstall({ root, dryRun: false, exec: failingExec(), t: T })
  assert.deepEqual(readOpencode(root).plugin, ['@someone/other'])
})

test('ponytail: plugin 키가 배열이 아니면 던지고 파일을 그대로 둔다', async () => {
  // 통째로 덮어쓰면 사용자가 적어 둔 설정이 조용히 사라진다. 실패가 낫다.
  const root = makeTempRepo()
  writeOpencode(root, { plugin: '@someone/other' })
  const before = readFileSync(join(root, OPENCODE), 'utf8')

  await assert.rejects(
    () => ponytail.install({ root, dryRun: false, exec: failingExec(), t: T }),
    (err) => err.key === 'error.ponytailOpencodePlugin',
  )
  assert.equal(readFileSync(join(root, OPENCODE), 'utf8'), before)
})

test('ponytail dry-run: 파일을 만들지 않고 무엇이 바뀔지 알린다', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  await ponytail.install({ root, dryRun: true, exec: dryExec, log: cap.log, t: T })

  assert.equal(existsSync(join(root, OPENCODE)), false)
  assert.equal(existsSync(join(root, '.claude', 'settings.json')), false)
  assert.match(cap.text(), /OpenCode/)
  assert.match(cap.text(), /@dietrichgebert\/ponytail/)
})
