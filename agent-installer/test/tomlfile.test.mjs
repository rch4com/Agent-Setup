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

test('appendSection은 새 파일을 선행 빈 줄 없이 생성한다', () => {
  const file = tmpToml(undefined)
  appendSection(file, 'notion', ['url = "https://mcp.notion.com/mcp"'])
  const text = readFileSync(file, 'utf8')
  assert.ok(text.startsWith('[mcp_servers.notion]'))
  assert.equal(hasSection(file, 'notion'), true)
})

test('removeSection은 무관한 위치의 연속 빈 줄을 보존한다', () => {
  const before = '# top\n\n\n\n# after blanks\nproject_doc_max_bytes = 65536\n'
  const file = tmpToml(before)
  appendSection(file, 'notion', ['url = "https://x"'])
  removeSection(file, 'notion')
  assert.equal(readFileSync(file, 'utf8'), before)
})

// smol-toml이 던지는 파싱 실패를 "섹션 없음"으로 돌려주면, 닫는 대괄호가
// 빠진 파일 끝에 같은 섹션이 하나 더 붙고 사용자는 파일이 깨진 것을 모른다.
test('깨진 TOML은 읽기·쓰기 모두 지역화 오류로 거부하고 파일을 건드리지 않는다', () => {
  const broken = '[mcp_servers.notion\nurl = "https://x"\n'
  const file = tmpToml(broken)
  const isInvalid = (err) => err.key === 'error.tomlInvalid' && err.params.path === file
  assert.throws(() => hasSection(file, 'notion'), isInvalid)
  assert.throws(() => appendSection(file, 'notion', ['url = "https://x"']), isInvalid)
  assert.throws(() => removeSection(file, 'notion'), isInvalid)
  assert.equal(readFileSync(file, 'utf8'), broken)
})
