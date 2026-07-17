import { test } from 'node:test'
import assert from 'node:assert/strict'
import { defineMcp } from '../lib/catalog.mjs'
import { CLIS } from '../lib/clis.mjs'
import { makeTempRepo } from './helpers.mjs'

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
    unsupported: Object.fromEntries(['codex','opencode','kilo','kiro','kimi'].map((c) => [c, '테스트용 제외'])),
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
