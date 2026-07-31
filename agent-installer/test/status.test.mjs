import { strict as assert } from 'node:assert'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { RECORD_REL } from '../lib/bootstrap/record.mjs'
import { createT } from '../lib/i18n/index.mjs'
import { collectStatus, formatStatus } from '../lib/status.mjs'
import { width } from '../lib/tui/render.mjs'
import { KO, makeTempRepo, runInstaller } from './helpers.mjs'

const NO_ITEMS = []
// 기존 단언은 지역화 이전 한국어 출력을 가정하고 쓰였다 — t를 명시해 그 뜻을 지킨다.
const KO_T = createT('ko')

test('갓 배선한 저장소는 관리 파일이 전부 최신이다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const report = await collectStatus(root, { items: NO_ITEMS })

  assert.equal(report.hasRecord, true)
  assert.equal(report.files.drift, 0)
  assert.equal(report.files.pending, 0)
  assert.ok(report.files.current >= 17)
})

test('사용자가 고친 파일은 드리프트로 센다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  writeFileSync(join(root, '.agent-kit/README.md'), '고친 내용\n')
  const report = await collectStatus(root, { items: NO_ITEMS })

  assert.equal(report.files.drift, 1)
})

test('기록이 없으면 hasRecord가 false이고 안내가 나온다', async () => {
  const root = makeTempRepo()
  const report = await collectStatus(root, { items: NO_ITEMS })

  assert.equal(report.hasRecord, false)
  assert.match(formatStatus(report, KO_T), /--adopt/)
})

test('기록에만 있는 항목과 저장소에만 있는 항목을 갈라 센다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  // 기록에는 두 개, 실제로는 하나만 설치된 상황을 만든다.
  const record = JSON.parse(readFileSync(join(root, RECORD_REL), 'utf8'))
  record.items = ['mcp.notion', 'mcp.vercel']
  writeFileSync(join(root, RECORD_REL), `${JSON.stringify(record, null, 2)}\n`)

  const items = [
    { id: 'mcp.notion', label: 'Notion', detect: async () => ({ status: 'installed' }) },
    { id: 'mcp.vercel', label: 'Vercel', detect: async () => ({ status: 'absent' }) },
    { id: 'skill.gsd', label: 'GSD', detect: async () => ({ status: 'installed' }) },
  ]
  const report = await collectStatus(root, { items })

  assert.deepEqual(report.items.installed, ['mcp.notion', 'skill.gsd'])
  assert.deepEqual(report.items.recordOnly, ['mcp.vercel'])
  assert.deepEqual(report.items.repoOnly, ['skill.gsd'])
})

test('감지가 던지면 미설치로 본다 — status가 죽지 않아야 한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const items = [{ id: 'x', label: 'X', detect: async () => { throw new Error('boom') } }]
  const report = await collectStatus(root, { items })

  assert.deepEqual(report.items.installed, [])
})

test('버전 차이를 보고한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const report = await collectStatus(root, { items: NO_ITEMS, latest: '9.9.9' })

  assert.equal(report.tool.latest, '9.9.9')
  assert.match(formatStatus(report, KO_T), /9\.9\.9/)
})

test('네트워크로 최신 버전을 못 받아도 나머지는 보고한다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const report = await collectStatus(root, { items: NO_ITEMS, latest: null })

  assert.equal(report.tool.latest, null)
  assert.doesNotMatch(formatStatus(report, KO_T), /null/)
})

test('status는 아무것도 바꾸지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { log() {} })
  const before = readFileSync(join(root, RECORD_REL), 'utf8')
  const readme = readFileSync(join(root, '.agent-kit/README.md'), 'utf8')

  await collectStatus(root, { items: NO_ITEMS })

  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), before)
  assert.equal(readFileSync(join(root, '.agent-kit/README.md'), 'utf8'), readme)
})

test('--json 출력은 로케일과 무관하게 같다', () => {
  const root = makeTempRepo()
  runInstaller(root, ['bootstrap'], { env: KO })
  const en = runInstaller(root, ['status', '--json'], { env: { AGENT_SETUP_LANG: 'en' } })
  const ko = runInstaller(root, ['status', '--json'], { env: KO })
  // 기계가 읽는 출력에 언어가 새면 CI 판정이 사람 설정에 흔들린다.
  assert.deepEqual(JSON.parse(en.stdout), JSON.parse(ko.stdout))
})

test('status 표의 값이 두 로케일 모두에서 같은 열에서 시작한다', () => {
  for (const locale of ['en', 'ko']) {
    const t = createT(locale)
    const cols = [
      t('status.row.tool', { version: '|' }),
      t('status.row.files', { total: '', current: '', pending: '', drift: '' }),
      t('status.row.items', { list: '|' }),
    ].map((line) => width(line.slice(0, line.indexOf('|') === -1 ? undefined : line.indexOf('|'))))
    // tool과 items는 값 앞 여백이 같아야 한다. files는 자리 구조가 달라 제외한다.
    assert.equal(cols[0], cols[2], `${locale}: tool과 items의 값 시작 열이 다르다`)

    // 힌트 줄(→)은 자신이 가리키는 행의 값 열에서 화살표가 시작해야 한다 —
    // 행 여백만 고치고 힌트를 빠뜨리면 화살표가 값보다 한참 왼쪽에 남는다.
    for (const hintKey of ['status.hint.update', 'status.hint.pending', 'status.hint.drift']) {
      const line = t(hintKey)
      const arrowCol = width(line.slice(0, line.indexOf('→')))
      assert.equal(arrowCol, cols[0], `${locale}: ${hintKey}의 화살표가 값 시작 열과 다르다`)
    }
  }
})
