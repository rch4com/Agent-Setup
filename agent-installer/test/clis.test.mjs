import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CLIS, CLI_IDS } from '../lib/clis.mjs'

test('지원 CLI는 여섯이고 실행 파일 이름을 갖는다', () => {
  assert.deepEqual(CLI_IDS, ['claude', 'codex', 'opencode', 'antigravity', 'copilot', 'vscode'])
  assert.deepEqual(CLI_IDS.map((c) => CLIS[c].bin), ['claude', 'codex', 'opencode', 'agy', 'copilot', 'code'])
  for (const c of CLI_IDS) assert.ok(CLIS[c].label, `${c}: 표시 이름이 없다`)
})
