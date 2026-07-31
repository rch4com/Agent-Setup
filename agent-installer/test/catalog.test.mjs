import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineMcp, makeExec, shellQuote } from '../lib/catalog.mjs'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'
import { makeTempRepo } from './helpers.mjs'

const CATALOG_URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'catalog.mjs')).href

test('defineMcp: supports에서 빠진 CLI에 사유가 없으면 throw한다', () => {
  // 오류가 LocalizedError로 바뀌면서 .message는 항상 영어다 — 텍스트가 아니라
  // 키로 단언해야 로케일이 바뀌어도 이 테스트가 계속 뜻을 유지한다.
  assert.throws(
    () => defineMcp({ id: 'mcp.x', label: 'X', server: { kind: 'http', url: 'https://x' }, supports: ['claude'] }),
    (err) => err.key === 'error.itemReasonMissing',
  )
})

test('defineMcp detect: 지원 CLI 전부 등록 시 installed, 일부면 partial', async () => {
  const item = defineMcp({
    id: 'mcp.t', label: 'T',
    server: { kind: 'http', url: 'https://t/mcp' },
    supports: ['claude', 'gemini'],
    unsupported: Object.fromEntries(CLI_IDS.filter((c) => !['claude', 'gemini'].includes(c)).map((c) => [c, '테스트용 제외'])),
  })
  const root = makeTempRepo()
  const ctx = { root, dryRun: false }
  assert.equal((await item.detect(ctx)).status, 'absent')
  CLIS.claude.add(root, 't', { kind: 'http', url: 'https://t/mcp' })
  assert.equal((await item.detect(ctx)).status, 'partial')
  CLIS.gemini.add(root, 't', { kind: 'http', url: 'https://t/mcp' })
  assert.equal((await item.detect(ctx)).status, 'installed')
})

test('defineMcp install은 누락 CLI만 채우고 uninstall은 전부 제거한다', async () => {
  const item = defineMcp({ id: 'mcp.t2', label: 'T2', server: { kind: 'stdio', command: 'x', args: [] } })
  const root = makeTempRepo()
  const ctx = { root, dryRun: false }
  CLIS.kimi.add(root, 't2', { kind: 'stdio', command: 'x', args: [] })
  await item.install(ctx)
  assert.equal((await item.detect(ctx)).status, 'installed')
  await item.uninstall(ctx)
  assert.equal((await item.detect(ctx)).status, 'absent')
})

test('makeExec는 공백 포함 명령과 인자를 온전히 전달한다', () => {
  const exec = makeExec(false, () => {})
  const r = exec(process.execPath, ['-e', 'console.log(process.argv[1])', 'a b c'])
  assert.equal(r.ok, true)
  assert.equal(r.output.trim(), 'a b c')
})

// 회귀: 공백이 없는 셸 메타문자는 감싸지 않아 그대로 셸에 노출됐다.
// 도달 경로는 skill.gstack의 clone 대상(=저장소 경로)이다 — `D:\R&D\repo`
// 아래에 클론한 저장소에서 명령이 두 개로 쪼개졌다.
// 두 플랫폼 규칙을 호스트 OS와 무관하게 확인하려고 platform을 명시해 검사한다.
test('shellQuote: cmd 메타문자를 항상 감싼다 (win32)', () => {
  assert.equal(shellQuote('D:\\R&D\\repo', 'win32'), '"D:\\R&D\\repo"')
  assert.equal(shellQuote('a|b^c(d)', 'win32'), '"a|b^c(d)"')
  assert.equal(shellQuote('git', 'win32'), '"git"')
  // 닫는 따옴표 앞 백슬래시는 자식 argv 파서가 이스케이프로 읽으므로 두 배로 늘린다.
  assert.equal(shellQuote('D:\\repo\\', 'win32'), '"D:\\repo\\\\"')
  // cmd는 \" 도 "" 도 이 위치에서 일관되게 해석하지 못한다 — 깨진 명령보다 거부가 낫다.
  // 오류가 LocalizedError로 바뀌면서 .message는 항상 영어다 — 키로 단언한다.
  assert.throws(() => shellQuote('C:\\a"b&calc', 'win32'), (err) => err.key === 'error.shellQuote')
})

test('shellQuote: POSIX는 작은따옴표로 $()·백틱까지 막는다', () => {
  assert.equal(shellQuote('/tmp/a b', 'linux'), "'/tmp/a b'")
  assert.equal(shellQuote('$(id)`id`', 'linux'), "'$(id)`id`'")
  assert.equal(shellQuote("it's", 'linux'), "'it'\\''s'")
})

// 실제 셸을 거쳐도 메타문자가 리터럴로 도착하는지 본다(호스트 OS의 셸로).
test('makeExec: 셸 메타문자가 든 인자를 리터럴로 전달한다', () => {
  const exec = makeExec(false, () => {})
  const nasty = process.platform === 'win32' ? 'a&b|c^(d)' : 'a&b|c$(id)`id`'
  const r = exec(process.execPath, ['-e', 'console.log(process.argv[1])', nasty], { shell: true })
  assert.equal(r.ok, true, r.output)
  assert.equal(r.output.trim(), nasty)
})

// 회귀: shell 모드에서 인자 배열을 함께 넘기면 Node가 DEP0190을 경고한다(Windows 설치 경로가 이 조합).
// --throw-deprecation으로 자식 프로세스를 띄워, 경고가 나면 자식이 죽어 이 테스트가 실패하게 못 박는다.
test('makeExec는 shell 경로에서도 DEP0190(shell+args) 경고를 내지 않는다', () => {
  const code = `import { makeExec } from ${JSON.stringify(CATALOG_URL)}
    const exec = makeExec(false, () => {})
    const r = exec(process.execPath, ['-e', 'console.log(process.argv[1])', 'a b c'], { shell: true })
    if (!r.ok || r.output.trim() !== 'a b c') { console.error('unexpected:', JSON.stringify(r)); process.exit(2) }`
  const res = spawnSync(process.execPath, ['--throw-deprecation', '--input-type=module', '-e', code], { encoding: 'utf8' })
  assert.equal(res.status, 0, `DEP0190 또는 실행 실패:\n${res.stderr}`)
})
