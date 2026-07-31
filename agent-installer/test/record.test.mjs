import { strict as assert } from 'node:assert'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  FORMAT_VERSION, RECORD_REL, collectManaged, emptyRecord, extractBlock,
  managedKey, readRecord, toolVersion, writeLang, writeRecord,
} from '../lib/bootstrap/record.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { hashBody } from '../lib/bootstrap/text.mjs'
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

// LocalizedError의 .message는 언제나 영어다 — 여기서는 함수를 직접 불러
// raw 오류를 잡으므로 지역화된 재렌더가 일어나지 않는다.
test('formatVersion이 다르면 진단 가능한 오류를 던진다', () => {
  const root = makeTempRepo()
  putRecord(root, { formatVersion: 99, pinnedVersion: '1.1.0', managed: {} })
  assert.throws(() => readRecord(root), /format version/)
})

test('깨진 JSON은 진단 가능한 오류를 던진다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.agent-kit'), { recursive: true })
  writeFileSync(join(root, RECORD_REL), '{ not json')
  assert.throws(() => readRecord(root), /Cannot read/)
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

test('extractBlock: 마커 사이 본문만 돌려준다', () => {
  const text = '사용자 서문\n\n<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->\n뒷말\n'
  assert.equal(extractBlock(text), '@AGENTS.md\n')
  assert.equal(extractBlock('마커 없는 파일\n'), null)
})

test('managedKey: 블록은 접미사로 파일 전체와 구분한다', () => {
  assert.equal(managedKey('AGENTS.md', false), 'AGENTS.md')
  assert.equal(managedKey('CLAUDE.md', true), 'CLAUDE.md#agent-kit')
})

test('collectManaged: 템플릿과 일치하는 파일만 해시를 남긴다', () => {
  const root = makeTempRepo()
  const manifest = {
    files: [
      { path: 'same.md', template: '내용\n' },
      { path: 'edited.md', template: '내용\n' },
      { path: 'missing.md', template: '내용\n' },
    ],
    blocks: [],
  }
  writeFileSync(join(root, 'same.md'), '내용\n')
  writeFileSync(join(root, 'edited.md'), '사용자가 고친 내용\n')

  const managed = collectManaged(root, manifest)

  assert.equal(managed['same.md'], hashBody('내용\n'))
  // 고친 파일에 해시를 박으면 다음 update가 사용자 수정을 날려버린다.
  assert.equal(managed['edited.md'], null)
  // 없는 파일도 관리 대상이다 — update가 생성 분기로 처리한다.
  assert.equal(managed['missing.md'], null)
})

test('collectManaged: CRLF로 체크아웃된 파일도 일치로 본다', () => {
  const root = makeTempRepo()
  const manifest = { files: [{ path: 'a.md', template: 'x\ny\n' }], blocks: [] }
  writeFileSync(join(root, 'a.md'), 'x\r\ny\r\n')
  assert.equal(collectManaged(root, manifest)['a.md'], hashBody('x\ny\n'))
})

test('collectManaged: 블록은 마커 사이 본문으로 비교한다', () => {
  const root = makeTempRepo()
  const block = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'
  const manifest = { files: [], blocks: [{ path: 'CLAUDE.md', block }] }
  // 사용자 본문이 앞뒤에 있어도 블록 본문이 같으면 일치다.
  writeFileSync(join(root, 'CLAUDE.md'), `내 메모\n\n${block}\n`)

  const managed = collectManaged(root, manifest)
  assert.equal(managed['CLAUDE.md#agent-kit'], hashBody('@AGENTS.md\n'))
})

test('collectManaged: 블록 안쪽을 고치면 채택하지 않는다', () => {
  const root = makeTempRepo()
  const block = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'
  const manifest = { files: [], blocks: [{ path: 'CLAUDE.md', block }] }
  writeFileSync(join(root, 'CLAUDE.md'),
    '<!-- agent-kit:begin -->\n@AGENTS.md\n내가 넣은 줄\n<!-- agent-kit:end -->\n')

  assert.equal(collectManaged(root, manifest)['CLAUDE.md#agent-kit'], null)
})

test('emptyRecord의 lang 기본값은 null이다', () => {
  assert.equal(emptyRecord().lang, null)
  assert.equal(emptyRecord({ lang: 'ko' }).lang, 'ko')
})

test('readRecord는 지원하지 않는 lang을 null로 떨어뜨린다', () => {
  const root = makeTempRepo()
  writeRecord(root, { ...emptyRecord(), lang: 'zz' })
  assert.equal(readRecord(root).lang, null)
})

test('readRecord는 lang이 없는 옛 기록을 그대로 읽는다', () => {
  const root = makeTempRepo()
  const old = emptyRecord()
  delete old.lang
  writeRecord(root, old)
  // formatVersion을 올리지 않았으므로 옛 기록이 막히면 안 된다.
  assert.equal(readRecord(root).lang, null)
})

test('writeLang은 기록이 없으면 새로 만든다', () => {
  const root = makeTempRepo()
  writeLang(root, 'ko')
  assert.equal(readRecord(root).lang, 'ko')
})

test('writeLang은 기존 기록의 나머지를 보존한다', () => {
  const root = makeTempRepo()
  writeRecord(root, { ...emptyRecord({ skillMode: 'copy' }), items: ['mcp.notion'] })
  writeLang(root, 'ko')
  const after = readRecord(root)
  assert.equal(after.lang, 'ko')
  assert.equal(after.skillMode, 'copy')
  assert.deepEqual(after.items, ['mcp.notion'])
})

test('writeLang은 dry-run에서 아무것도 쓰지 않는다', () => {
  const root = makeTempRepo()
  writeLang(root, 'ko', { dryRun: true })
  assert.equal(readRecord(root), null)
})

test('부트스트랩은 기록의 lang을 지우지 않는다', () => {
  const root = makeTempRepo()
  writeLang(root, 'ko')
  runBootstrap(root, { log: () => {} })
  assert.equal(readRecord(root).lang, 'ko')
})
