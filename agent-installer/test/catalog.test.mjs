import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { defineMcp, makeExec } from '../lib/catalog.mjs'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'
import { makeTempRepo } from './helpers.mjs'

const CATALOG_URL = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'catalog.mjs')).href

test('defineMcp: supports에서 빠진 CLI에 사유가 없으면 throw한다', () => {
  assert.throws(
    () => defineMcp({ id: 'mcp.x', label: 'X', server: { kind: 'http', url: 'https://x' }, supports: ['claude'] }),
    /사유/,
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
