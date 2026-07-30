import { strict as assert } from 'node:assert'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  FORMAT_VERSION, RECORD_REL, emptyRecord, readRecord, toolVersion, writeRecord,
} from '../lib/bootstrap/record.mjs'
import { makeCapture, makeTempRepo } from './helpers.mjs'

function putRecord(root, obj) {
  mkdirSync(join(root, '.agent-kit'), { recursive: true })
  writeFileSync(join(root, RECORD_REL), JSON.stringify(obj, null, 2))
}

test('toolVersion: package.json의 버전을 읽는다', () => {
  assert.match(toolVersion(), /^\d+\.\d+\.\d+/)
})

test('기록이 없으면 null이다', () => {
  assert.equal(readRecord(makeTempRepo()), null)
})

test('쓰고 읽으면 같은 값이 돌아온다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const record = emptyRecord({ skillMode: 'copy' })
  record.items = ['mcp.notion']
  record.managed['AGENTS.md'] = 'sha256:abc'

  writeRecord(root, record, { dryRun: false, log: cap.log })
  const back = readRecord(root)

  assert.equal(back.formatVersion, FORMAT_VERSION)
  assert.equal(back.pinnedVersion, toolVersion())
  assert.equal(back.skillMode, 'copy')
  assert.deepEqual(back.items, ['mcp.notion'])
  assert.equal(back.managed['AGENTS.md'], 'sha256:abc')
})

test('dryRun이면 파일을 만들지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  writeRecord(root, emptyRecord({ skillMode: 'auto' }), { dryRun: true, log: cap.log })
  assert.equal(readRecord(root), null)
  // 무엇이 바뀔지는 보고해야 한다 — dry-run이 조용하면 확인 도구가 아니다.
  assert.match(cap.text(), /agent-setup\.json/)
})

test('formatVersion이 다르면 진단 가능한 오류를 던진다', () => {
  const root = makeTempRepo()
  putRecord(root, { formatVersion: 99, pinnedVersion: '1.1.0', managed: {} })
  assert.throws(() => readRecord(root), /형식 버전/)
})

test('깨진 JSON은 진단 가능한 오류를 던진다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.agent-kit'), { recursive: true })
  writeFileSync(join(root, RECORD_REL), '{ not json')
  assert.throws(() => readRecord(root), /읽을 수 없습니다/)
})

test('필드가 없어도 기본값으로 읽힌다', () => {
  // 손으로 편집한 기록이 필드를 빠뜨려도 죽지 않아야 한다.
  const root = makeTempRepo()
  putRecord(root, { formatVersion: FORMAT_VERSION })
  const back = readRecord(root)
  assert.deepEqual(back.items, [])
  assert.deepEqual(back.design, [])
  assert.deepEqual(back.managed, {})
  assert.equal(back.skillMode, 'auto')
})

test('사람이 읽을 수 있게 들여쓰기하고 끝 개행을 둔다', () => {
  const root = makeTempRepo()
  writeRecord(root, emptyRecord({ skillMode: 'auto' }), { dryRun: false, log: makeCapture().log })
  const text = readFileSync(join(root, RECORD_REL), 'utf8')
  // 커밋되어 git diff로 읽는 파일이다. 한 줄 JSON이면 diff가 무의미하다.
  assert.match(text, /\n {2}"formatVersion"/)
  assert.ok(text.endsWith('\n'))
})
