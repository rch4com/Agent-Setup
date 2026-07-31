import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { planChanges, apply } from '../lib/engine.mjs'
import { defineMcp } from '../lib/catalog.mjs'
import { createT, toText, LocalizedError } from '../lib/i18n/index.mjs'
import { makeTempRepo, makeCapture } from './helpers.mjs'

function fake(id, status) {
  return { item: { id, label: id }, status }
}

test('planChanges: absent+체크=install, installed+해제=uninstall', () => {
  const states = [fake('a', 'absent'), fake('b', 'installed'), fake('c', 'installed')]
  const changes = planChanges(states, new Set(['a', 'c']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['a', 'install'], ['b', 'uninstall']],
  )
})

test('planChanges: partial+체크 유지=complete, partial+해제=uninstall', () => {
  const states = [fake('p1', 'partial'), fake('p2', 'partial')]
  const changes = planChanges(states, new Set(['p1']))
  assert.deepEqual(
    changes.map((c) => [c.item.id, c.action]),
    [['p1', 'complete'], ['p2', 'uninstall']],
  )
})

test('planChanges: 변경 없으면 빈 배열', () => {
  const states = [fake('a', 'installed'), fake('b', 'absent')]
  assert.deepEqual(planChanges(states, new Set(['a'])), [])
})

// 파일을 직접 쓰는 항목은 exec를 거치지 않는다. log를 넘기지 않으면 dry-run이
// "✔ 설치"라고만 찍고 무엇이 바뀔지는 하나도 알려 주지 않는다.
test('apply dry-run: 파일을 쓰는 항목도 예정 동작을 보고하고 아무것도 만들지 않는다', async () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const item = defineMcp({
    id: 'mcp.demo', label: 'Demo MCP',
    server: { kind: 'http', url: 'https://example.com/mcp' },
  })

  // apply()의 t 기본값은 영어다 — 이 단언은 기존 한국어 문구를 그대로
  // 검사하므로 한국어를 명시로 고정한다.
  const results = await apply(root, [{ item, action: 'install' }], { dryRun: true, log: cap.log, t: createT('ko') })

  assert.equal(results[0].ok, true)
  assert.match(cap.text(), /\[dry-run\] Claude Code 설정에 demo 등록/)
  assert.match(cap.text(), /\[dry-run\] VS Code Copilot 설정에 demo 등록/)
  assert.equal(existsSync(join(root, '.mcp.json')), false, 'dry-run은 파일을 만들지 않는다')
})

// 회귀: apply()의 catch가 LocalizedError를 그냥 err.message로 되돌리면
// (또는 partial의 detail이 평문 템플릿으로 되돌아가면) 이 테스트만으로는
// 안 잡히는 게 아니라 정확히 이 테스트가 잡아야 한다 — Task 6이 막으려던
// [object Object] 버그의 핵심 지점이다.
test('apply: install이 LocalizedError를 던지면 message가 구조화 메시지로 남고 렌더된다', async () => {
  const root = makeTempRepo()
  const item = {
    id: 'fake.err', label: 'Fake',
    async install() { throw new LocalizedError('error.itemReasonMissing', { id: 'fake.err', cli: 'codex' }) },
    async uninstall() {},
  }

  const results = await apply(root, [{ item, action: 'install' }], { dryRun: false })

  assert.equal(results[0].ok, false)
  // 문자열로 되돌아가면(err.message) 이 두 단언이 깨진다 — LocalizedError.message는
  // 항상 영어 문자열이라 typeof는 여전히 'string'이지만 .key가 없다.
  assert.equal(typeof results[0].message, 'object')
  assert.equal(results[0].message.key, 'error.itemReasonMissing')
  assert.deepEqual(results[0].message.params, { id: 'fake.err', cli: 'codex' })

  // 구조체이기만 하고 못 풀리면 소용없다 — 실제로 활성 로케일로 렌더되는지까지 본다.
  const ko = toText(createT('ko'), results[0].message)
  assert.match(ko, /codex/)
  assert.match(ko, /사유/)
  const en = toText(createT('en'), results[0].message)
  assert.match(en, /codex/)
  assert.match(en, /reason/)
})

// 짝을 이루는 반대 분기: 키 없는 일반 오류는 여전히 문자열로 남아야 한다 —
// 전부 msg()로 감싸 버리면 toText가 깨지진 않지만 err.params가 없어 다른
// 방식으로 깨진다. 두 분기를 갈라서 확인한다.
test('apply: 키 없는 일반 오류는 message가 문자열로 남는다', async () => {
  const root = makeTempRepo()
  const item = {
    id: 'fake.plain', label: 'Fake2',
    async install() { throw new Error('그냥 실패') },
    async uninstall() {},
  }

  const results = await apply(root, [{ item, action: 'install' }], { dryRun: false })

  assert.equal(results[0].ok, false)
  assert.equal(typeof results[0].message, 'string')
  assert.equal(results[0].message, '그냥 실패')
})
