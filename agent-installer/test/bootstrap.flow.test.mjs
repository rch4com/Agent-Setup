import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'
import { RECORD_REL, readRecord, toolVersion } from '../lib/bootstrap/record.mjs'
import { createT } from '../lib/i18n/index.mjs'

// 이 스위트는 함수를 직접 부르므로 로케일을 한국어로 못박는다 — 기존 단언이
// 그대로 뜻을 유지하도록. 영어 쪽 회귀는 test/i18n.en.test.mjs가 담당한다.
const t = createT('ko')

test('매니페스트가 선언한 모든 대상을 만든다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, log() {} })

  for (const rel of MANIFEST.dirs) {
    assert.ok(existsSync(join(root, rel)), `디렉터리 누락: ${rel}`)
  }
  for (const { path: rel } of MANIFEST.files) {
    assert.ok(existsSync(join(root, rel)), `파일 누락: ${rel}`)
  }
  for (const { path: rel } of MANIFEST.blocks) {
    assert.match(readFileSync(join(root, rel), 'utf8'), /<!-- agent-kit:begin -->/)
  }
  const ignore = readFileSync(join(root, '.gitignore'), 'utf8')
  for (const entry of MANIFEST.ignore) {
    assert.ok(ignore.includes(entry), `.gitignore 누락: ${entry}`)
  }
})

test('두 번 실행해도 두 번째는 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, log() {} })
  const second = runBootstrap(root, { t, log() {} })

  const created = second.results.filter((r) => ['create', 'append', 'copy', 'insert'].includes(r.action))
  assert.deepEqual(created.map((r) => r.path), [], '멱등하지 않다')
  assert.deepEqual(second.failed, [])
})

test('settings 선언대로 VS Code 설정 키를 넣는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, log() {} })

  const text = readFileSync(join(root, '.vscode/settings.json'), 'utf8')
  assert.deepEqual(JSON.parse(text), { 'chat.useAgentsMdFile': true })
})

test('기존 .vscode/settings.json의 다른 키를 보존한다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.vscode'))
  writeFileSync(join(root, '.vscode/settings.json'), '{\n  "editor.tabSize": 2\n}\n')

  runBootstrap(root, { t, log() {} })

  const parsed = JSON.parse(readFileSync(join(root, '.vscode/settings.json'), 'utf8'))
  assert.equal(parsed['editor.tabSize'], 2)
  assert.equal(parsed['chat.useAgentsMdFile'], true)
})

test('기존 파일을 보존한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), '내가 쓴 지침\n')
  runBootstrap(root, { t, log() {} })
  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '내가 쓴 지침\n')
})

test('dry-run은 파일시스템을 전혀 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  runBootstrap(root, { t, dryRun: true, log: cap.log })

  for (const rel of [...MANIFEST.dirs, ...MANIFEST.files.map((f) => f.path)]) {
    assert.equal(existsSync(join(root, rel)), false, `dry-run이 만들었다: ${rel}`)
  }
  assert.match(cap.text(), /\[agent-setup\]/)
})

test('출력에 저장소 루트와 완료 안내가 있다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  runBootstrap(root, { t, log: cap.log })

  assert.match(cap.text(), /저장소 루트/)
  assert.match(cap.text(), /글로벌 설정 경로는 읽거나 수정하지 않습니다/)
  assert.match(cap.text(), /완료되었습니다/)
})

// 저장소 밖 경로는 repoPathStrict가 던지므로 어느 OS에서도 확실히 실패한다.
// (없는 원본으로 링크를 만들면 POSIX는 dangling symlink로 성공해 버려 테스트가 흔들린다.)
test('실패는 격리되어 나머지 진행을 막지 않는다', () => {
  const root = makeTempRepo()
  const manifest = { ...MANIFEST, adapters: [{ tool: '실패용', path: '../escape' }] }
  const { results, failed } = runBootstrap(root, { t, log() {}, manifest })

  assert.equal(failed.length, 1, '어댑터 하나만 실패해야 한다')
  // LocalizedError.message는 언제나 영어다 — apply.mjs가 raw 오류를 그대로
  // message에 담으므로 여기서도 영어를 본다.
  assert.match(failed[0].message, /Cannot write outside/)
  assert.ok(results.some((r) => r.action === 'create'), '파일 생성은 계속되어야 한다')
  // .gitignore는 어댑터 뒤에 실행된다 — 실패 이후 단계까지 진행됐다는 증거다.
  assert.ok(existsSync(join(root, '.gitignore')), '실패 이후 단계도 실행되어야 한다')
})

test('실패가 있으면 failed에 모인다', () => {
  const root = makeTempRepo()
  const { failed } = runBootstrap(root, { t, log() {} })
  assert.deepEqual(failed, [], '정상 실행에는 실패가 없어야 한다')
})

test('bootstrap이 설치 기록을 남긴다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, log() {} })

  const record = readRecord(root)
  assert.equal(record.pinnedVersion, toolVersion())
  assert.equal(record.skillMode, 'auto')
  // 갓 만든 파일은 정의상 템플릿과 같으므로 전부 채택된다.
  const values = Object.values(record.managed)
  assert.ok(values.length >= 17, `관리 항목이 ${values.length}개뿐이다`)
  assert.equal(values.filter((v) => v === null).length, 0, '갓 만든 파일이 미채택으로 잡혔다')
})

test('bootstrap 재실행은 기록을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, log() {} })
  const first = readFileSync(join(root, RECORD_REL), 'utf8')
  runBootstrap(root, { t, log() {} })
  assert.equal(readFileSync(join(root, RECORD_REL), 'utf8'), first)
})

test('--adopt는 파일을 만들지 않고 기록만 만든다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, adopt: true, log() {} })

  assert.equal(existsSync(join(root, 'AGENTS.md')), false, 'adopt가 파일을 만들었다')
  const record = readRecord(root)
  assert.ok(record, '기록이 없다')
  // 파일이 없으니 채택된 것도 없어야 한다.
  assert.equal(Object.values(record.managed).filter((v) => v).length, 0)
})

test('--adopt는 템플릿과 같은 파일만 채택한다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, log() {} })            // 정상 배선
  writeFileSync(join(root, 'AGENTS.md'), '팀이 고친 지침\n')
  runBootstrap(root, { t, adopt: true, log() {} })

  const record = readRecord(root)
  assert.equal(record.managed['AGENTS.md'], null, '고친 파일이 채택됐다')
  assert.ok(record.managed['.codex/config.toml'], '손대지 않은 파일이 미채택됐다')
})

test('dry-run은 기록도 쓰지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t, dryRun: true, log() {} })
  assert.equal(readRecord(root), null)
})

test('부트스트랩이 단계 진행을 알린다', () => {
  const root = makeTempRepo()
  const events = []
  runBootstrap(root, { log: () => {}, onProgress: (e) => events.push(e) })
  assert.ok(events.length > 0)
  assert.equal(events.at(-1).done, events.at(-1).total)
  assert.ok(events.every((e) => e.done <= e.total))
})
