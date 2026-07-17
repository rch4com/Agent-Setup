import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { hasSection, appendSection, removeSection } from '../lib/tomlfile.mjs'

function tmpToml(content) {
  const file = join(mkdtempSync(join(tmpdir(), 'toml-')), 'config.toml')
  if (content !== undefined) writeFileSync(file, content)
  return file
}

const BASE = '# Repository-local Codex configuration.\nproject_doc_max_bytes = 65536\n'

test('appendSection은 기존 내용과 주석을 보존한다', () => {
  const file = tmpToml(BASE)
  appendSection(file, 'notion', ['url = "https://mcp.notion.com/mcp"'])
  const text = readFileSync(file, 'utf8')
  assert.match(text, /# Repository-local Codex configuration\./)
  assert.match(text, /project_doc_max_bytes = 65536/)
  assert.equal(hasSection(file, 'notion'), true)
})

test('removeSection은 해당 섹션만 제거한다', () => {
  const file = tmpToml(BASE)
  appendSection(file, 'notion', ['url = "https://mcp.notion.com/mcp"'])
  appendSection(file, 'cbm', ['command = "codebase-memory-mcp"', 'args = []'])
  removeSection(file, 'notion')
  assert.equal(hasSection(file, 'notion'), false)
  assert.equal(hasSection(file, 'cbm'), true)
  assert.match(readFileSync(file, 'utf8'), /project_doc_max_bytes/)
})

test('hasSection은 없는 파일에서 false를 반환한다', () => {
  assert.equal(hasSection(join(tmpdir(), 'no-such-dir', 'x.toml'), 'notion'), false)
})
