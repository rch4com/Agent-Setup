import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineMcp, definePlugin, defineSkill, makeExec, shellQuote } from '../lib/catalog.mjs'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'
import { createT, msg, toText } from '../lib/i18n/index.mjs'
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

test('definePlugin·defineSkill: 항목별 사유가 기본 사유를 덮고 나머지는 기본으로 남는다', () => {
  const plugin = definePlugin({
    id: 'plugin.t', label: 'T', installId: 't@t', detectIds: ['t@t'],
    unsupported: { codex: msg('item.unsupported.upstreamNone') },
  })
  assert.equal(plugin.unsupported.codex.key, 'item.unsupported.upstreamNone')
  assert.equal(plugin.unsupported.gemini.key, 'item.unsupported.claudePlugin')
  assert.ok(!('claude' in plugin.unsupported))

  const skill = defineSkill({
    id: 'skill.t', label: 'T', scope: 'project',
    detect: async () => ({ status: 'absent' }), install: async () => {}, uninstall: async () => {},
    unsupported: { kiro: msg('item.unsupported.upstreamNone') },
  })
  assert.equal(skill.unsupported.kiro.key, 'item.unsupported.upstreamNone')
  assert.equal(skill.unsupported.grok.key, 'item.unsupported.claudeSkill')
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

// 회귀: partial의 detail이 평문 템플릿 문자열로 되돌아가면(msg() 없이)
// .key 단언이 깨지고, present/missing 값이 실제 CLI를 담지 않으면
// toText로 풀어도 내용이 비어 있는 채 통과할 수 있다 — 값까지 확인한다.
test('defineMcp detect: partial의 detail은 구조화 메시지이고 실제 등록·누락 CLI를 담는다', async () => {
  const item = defineMcp({
    id: 'mcp.t3', label: 'T3',
    server: { kind: 'http', url: 'https://t3/mcp' },
    supports: ['claude', 'gemini'],
    unsupported: Object.fromEntries(CLI_IDS.filter((c) => !['claude', 'gemini'].includes(c)).map((c) => [c, '테스트용 제외'])),
  })
  const root = makeTempRepo()
  CLIS.claude.add(root, 't3', { kind: 'http', url: 'https://t3/mcp' })

  const r = await item.detect({ root })
  assert.equal(r.status, 'partial')
  assert.equal(typeof r.detail, 'object')
  assert.equal(r.detail.key, 'item.mcp.partial')
  assert.equal(r.detail.params.present, 'claude')
  assert.equal(r.detail.params.missing, 'gemini')

  const ko = toText(createT('ko'), r.detail)
  assert.match(ko, /claude/)
  assert.match(ko, /gemini/)
  const en = toText(createT('en'), r.detail)
  assert.match(en, /claude/)
  assert.match(en, /gemini/)
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

test('makeExec는 공백 포함 명령과 인자를 온전히 전달한다', async () => {
  const exec = makeExec(false, () => {})
  const r = await exec(process.execPath, ['-e', 'console.log(process.argv[1])', 'a b c'])
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
test('makeExec: 셸 메타문자가 든 인자를 리터럴로 전달한다', async () => {
  const exec = makeExec(false, () => {})
  const nasty = process.platform === 'win32' ? 'a&b|c^(d)' : 'a&b|c$(id)`id`'
  const r = await exec(process.execPath, ['-e', 'console.log(process.argv[1])', nasty], { shell: true })
  assert.equal(r.ok, true, r.output)
  assert.equal(r.output.trim(), nasty)
})

// 회귀: shell 모드에서 인자 배열을 함께 넘기면 Node가 DEP0190을 경고한다(Windows 설치 경로가 이 조합).
// --throw-deprecation으로 자식 프로세스를 띄워, 경고가 나면 자식이 죽어 이 테스트가 실패하게 못 박는다.
test('makeExec는 shell 경로에서도 DEP0190(shell+args) 경고를 내지 않는다', () => {
  const code = `import { makeExec } from ${JSON.stringify(CATALOG_URL)}
    const exec = makeExec(false, () => {})
    const r = await exec(process.execPath, ['-e', 'console.log(process.argv[1])', 'a b c'], { shell: true })
    if (!r.ok || r.output.trim() !== 'a b c') { console.error('unexpected:', JSON.stringify(r)); process.exit(2) }`
  const res = spawnSync(process.execPath, ['--throw-deprecation', '--input-type=module', '-e', code], { encoding: 'utf8' })
  assert.equal(res.status, 0, `DEP0190 또는 실행 실패:\n${res.stderr}`)
})

// 회귀: spawn 자체가 실패하면(ENOENT 등) err.stderr가 undefined가 아니라 빈
// 문자열로 온다(execFileSync 시절엔 undefined였다). ??로 폴백을 판단하면 빈
// 문자열을 "값 있음"으로 보고 err.message(바이너리 이름이 담긴 진단 텍스트)를
// 버린다 — 사용자에게 "gstack setup 실패: " 처럼 빈 진단만 남는다. 스텁은
// 둘 다 그냥 값을 동기로 반환하므로 이 차이를 재현하지 못한다 — 실제 자식
// 프로세스로 확인한다.
test('makeExec: 존재하지 않는 바이너리는 빈 진단이 아니라 바이너리 이름을 남긴다', async () => {
  const exec = makeExec(false, () => {})
  const r = await exec('definitely-not-a-real-binary-xyz', [], { shell: false })
  assert.equal(r.ok, false)
  assert.notEqual(r.output, '')
  assert.match(r.output, /definitely-not-a-real-binary-xyz/)
})

// 회귀: execFile은 stdio 옵션을 무시하고 자식에게 열린 stdin 파이프를 그대로
// 넘긴다. 옛 execFileSync는 stdio: ['ignore', ...]로 자식의 stdin을 즉시
// 닫아 뒀다 — 스폰 직후 우리가 stdin.end()로 그 동작을 복원했는지, 실제
// 자식으로 확인한다. 복원되지 않으면 자식이 EOF를 못 받아 타이머(1.5초)까지
// 기다린다 — 이 테스트는 수십 ms 안에 끝나야 한다.
test('makeExec: 자식의 stdin을 닫아 EOF를 준다(안 닫으면 자식이 멈춘다)', async () => {
  const exec = makeExec(false, () => {})
  const childCode = "process.stdin.on('end', () => { console.log('EOF'); process.exit(0) }); process.stdin.resume(); setTimeout(() => { console.log('NO-EOF'); process.exit(0) }, 1500)"
  const start = Date.now()
  const r = await exec(process.execPath, ['-e', childCode])
  assert.equal(r.ok, true, r.output)
  assert.equal(r.output.trim(), 'EOF')
  assert.ok(Date.now() - start < 500, `stdin이 열린 채로 남아 타임아웃까지 기다린 듯하다: ${Date.now() - start}ms`)
})

// await를 빠뜨린 자리는 { ok, output } 대신 Promise를 받는다. r.ok가
// undefined라 `if (!r.ok)` 폴백이 늘 돌고, 실패가 성공으로 읽힌다.
// 사람 눈으로는 놓치기 쉬워 소스에서 직접 잡는다.
test('exec 호출은 전부 await한다', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join, dirname } = await import('node:path')
  const { fileURLToPath } = await import('node:url')
  const lib = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib')
  const files = [
    join(lib, 'catalog.mjs'),
    ...readdirSync(join(lib, 'items')).map((f) => join(lib, 'items', f)),
  ]
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      // 정의부(`(cmd, args, opts)` 꼴)와 주석은 건너뛴다.
      if (!/\bexec\(/.test(line) || /^\s*\/\//.test(line) || /=>/.test(line)) return
      assert.match(line, /await exec\(/, `${file}:${i + 1} — await 없는 exec: ${line.trim()}`)
    })
  }
})
