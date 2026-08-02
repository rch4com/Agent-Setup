import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadItems, makeExec } from '../lib/catalog.mjs'
import { assertExclusive } from '../lib/engine.mjs'
import { normalizeBody } from '../lib/bootstrap/text.mjs'
import { GITMESSAGE_EN, GITMESSAGE_KO, GITMESSAGE_REL } from '../lib/gitmessage.mjs'
import { createT, toText } from '../lib/i18n/index.mjs'
import { agentHint, buildRows } from '../lib/tui/rows.mjs'
import { categoryLabel } from '../lib/design-md/flow.mjs'
import { makeTempRepo } from './helpers.mjs'

const T = createT('en')

async function items() {
  const all = await loadItems()
  return {
    en: all.find((i) => i.id === 'config.gitmessage.en'),
    ko: all.find((i) => i.id === 'config.gitmessage.ko'),
    all,
  }
}

function ctx(root, { dryRun = false } = {}) {
  const log = []
  return { root, dryRun, exec: makeExec(dryRun, (m) => log.push(m)), log: (m) => log.push(m), t: T, lines: log }
}

function template(root) {
  const file = join(root, GITMESSAGE_REL)
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}

function configured(root) {
  try {
    return execFileSync('git', ['config', '--local', '--get', 'commit.template'], { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// 저장소 루트의 .gitmessage.txt가 곧 한국어판의 원본이다. 둘이 갈리면 이
// 저장소가 자기 도구로 자기 템플릿을 설치할 수 없게 되고(손으로 쓴 파일로
// 읽혀 install이 거부한다), 그 사실은 배포한 뒤에야 드러난다.
test('한국어 템플릿은 이 저장소의 .gitmessage.txt와 같다', () => {
  const repoFile = readFileSync(new URL('../../.gitmessage.txt', import.meta.url), 'utf8')
  assert.equal(normalizeBody(GITMESSAGE_KO), normalizeBody(repoFile))
})

test('두 판은 서로 다르고 같은 골격을 쓴다', () => {
  assert.notEqual(normalizeBody(GITMESSAGE_EN), normalizeBody(GITMESSAGE_KO))
  for (const body of [GITMESSAGE_EN, GITMESSAGE_KO]) {
    // 타입 목록은 두 판이 같아야 한다 — 언어를 바꿨다고 커밋 타입이 달라지면
    // 히스토리가 갈린다.
    for (const type of ['feat:', 'fix:', 'style:', 'refactor:', 'chore:', 'add:', 'remove:', 'move:', 'comment:', 'perf:', 'test:', 'docs:', 'design:', 'revert:']) {
      assert.ok(body.includes(`# ${type}`), `${type} 항목이 빠졌다`)
    }
  }
})

test('두 항목은 같은 배타 묶음이고 CLI 배선 개념이 없다', async () => {
  const { en, ko } = await items()
  assert.equal(en.exclusive, ko.exclusive)
  assert.ok(en.exclusive)
  assert.equal(en.category, 'config')
  // supports가 없어야 커버리지 줄·배선표·CLI 필터가 이 항목을 건너뛴다.
  assert.equal(en.supports, undefined)
  assert.equal(ko.supports, undefined)
})

test('설치는 파일을 쓰고 commit.template을 저장소 설정에 건다', async () => {
  const root = makeTempRepo()
  const { ko } = await items()
  assert.deepEqual(await ko.detect({ root }), { status: 'absent' })

  await ko.install(ctx(root))
  assert.equal(normalizeBody(template(root)), normalizeBody(GITMESSAGE_KO))
  assert.equal(configured(root), GITMESSAGE_REL)
  assert.deepEqual(await ko.detect({ root }), { status: 'installed' })
})

test('파일만 있고 설정이 없으면 일부 설치됨이다', async () => {
  const root = makeTempRepo()
  const { en } = await items()
  writeFileSync(join(root, GITMESSAGE_REL), GITMESSAGE_EN)

  const state = await en.detect({ root })
  assert.equal(state.status, 'partial')
  assert.equal(toText(T, state.detail), T('item.gitmessage.unregistered'))

  // 체크를 유지한 채 다시 적용하면(engine의 complete) 설정만 채워진다.
  await en.install(ctx(root))
  assert.deepEqual(await en.detect({ root }), { status: 'installed' })
})

test('다른 언어판이 놓여 있으면 미설치로 읽는다', async () => {
  const root = makeTempRepo()
  const { en, ko } = await items()
  await ko.install(ctx(root))
  assert.deepEqual(await en.detect({ root }), { status: 'absent' })
  assert.equal((await ko.detect({ root })).status, 'installed')
})

test('제거는 파일과 설정을 함께 되돌린다', async () => {
  const root = makeTempRepo()
  const { ko } = await items()
  await ko.install(ctx(root))
  await ko.uninstall(ctx(root))
  assert.equal(template(root), null)
  assert.equal(configured(root), null)
})

// 언어를 바꿀 때 engine은 [en 설치, ko 제거]를 이 순서로 돌린다(항목 id 순).
// 제거가 내용을 보지 않으면 방금 쓴 영어판을 지워 버린다.
test('언어를 바꿔도 나중 제거가 방금 쓴 파일을 지우지 않는다', async () => {
  const root = makeTempRepo()
  const { en, ko } = await items()
  await ko.install(ctx(root))

  await en.install(ctx(root))
  await ko.uninstall(ctx(root))

  assert.equal(normalizeBody(template(root)), normalizeBody(GITMESSAGE_EN))
  assert.equal(configured(root), GITMESSAGE_REL)
  assert.equal((await en.detect({ root })).status, 'installed')
})

test('손으로 쓴 템플릿은 덮어쓰지 않고 거부한다', async () => {
  const root = makeTempRepo()
  const { ko } = await items()
  writeFileSync(join(root, GITMESSAGE_REL), '# 우리 팀이 직접 쓴 템플릿\n')

  await assert.rejects(() => ko.install(ctx(root)), (err) => err.key === 'error.gitmessageForeign')
  assert.equal(template(root), '# 우리 팀이 직접 쓴 템플릿\n')
})

test('남의 commit.template은 제거가 건드리지 않는다', async () => {
  const root = makeTempRepo()
  const { ko } = await items()
  writeFileSync(join(root, GITMESSAGE_REL), GITMESSAGE_KO)
  execFileSync('git', ['config', '--local', 'commit.template', '.github/COMMIT_TEMPLATE'], { cwd: root })

  await ko.uninstall(ctx(root))
  assert.equal(template(root), null) // 우리 판이 맞으니 파일은 지운다
  assert.equal(configured(root), '.github/COMMIT_TEMPLATE') // 설정은 남의 값이라 둔다
})

test('dry-run은 아무것도 쓰지 않고 무엇이 바뀔지 알린다', async () => {
  const root = makeTempRepo()
  const { ko } = await items()
  const c = ctx(root, { dryRun: true })
  await ko.install(c)
  assert.equal(template(root), null)
  assert.equal(configured(root), null)
  assert.ok(c.lines.some((l) => l.includes(GITMESSAGE_REL)))
  assert.ok(c.lines.some((l) => l.includes('git config')))
})

test('assertExclusive는 두 언어판을 함께 고른 --set을 거부한다', async () => {
  const { all } = await items()
  assert.throws(
    () => assertExclusive(all, new Set(['config.gitmessage.en', 'config.gitmessage.ko'])),
    (err) => err.key === 'error.exclusiveItems',
  )
  assert.doesNotThrow(() => assertExclusive(all, new Set(['config.gitmessage.ko', 'skill.caveman'])))
})

// 평평한 목록(printPlain·--list)에는 그룹 헤더가 없다 — 무엇을 건드리는
// 항목인지 알 길이 없고, '.gitmessage'로 검색해도 걸리지 않았다.
test('힌트와 검색어에 대상 파일이 들어간다', async () => {
  const { en } = await items()
  const state = { item: en, status: 'absent', detail: null }
  assert.match(agentHint(en, state, T), /\.gitmessage\.txt/)

  const [row] = buildRows({ agentStates: [state], t: T })
  assert.ok(row.searchText.includes('.gitmessage'), `검색어에 대상 파일이 없다: ${row.searchText}`)
  assert.equal(row.exclusive, en.exclusive, '행이 배타 키를 물고 가야 라디오로 그려진다')
})

// 헤더 하나가 "무엇을 고르는 자리이고 규칙이 무엇인가"를 함께 말한다.
test('그룹 헤더가 대상 파일과 배타 규칙을 밝힌다', () => {
  for (const locale of ['en', 'ko']) {
    const label = categoryLabel(createT(locale), '__commit')
    assert.match(label, /\.gitmessage\.txt/, `${locale}: 헤더에 대상 파일이 없다`)
    assert.notEqual(label, '__commit', `${locale}: 헤더가 번역되지 않았다`)
  }
})
