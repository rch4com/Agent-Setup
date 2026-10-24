import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'
import * as templates from '../lib/bootstrap/templates.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('MANIFEST는 여섯 종류를 모두 선언한다', () => {
  assert.ok(Array.isArray(MANIFEST.dirs) && MANIFEST.dirs.length > 0)
  assert.ok(Array.isArray(MANIFEST.files) && MANIFEST.files.length > 0)
  assert.ok(Array.isArray(MANIFEST.blocks) && MANIFEST.blocks.length > 0)
  assert.ok(Array.isArray(MANIFEST.adapters) && MANIFEST.adapters.length > 0)
  assert.ok(Array.isArray(MANIFEST.ignore) && MANIFEST.ignore.length > 0)
  // 설정 키 보장은 지금 비어 있다(VS Code Copilot 지원 종료) — 기구는 남는다.
  assert.ok(Array.isArray(MANIFEST.settings))
})

test('MANIFEST.tools는 비어 있지 않은 문자열 배열이다', () => {
  assert.ok(Array.isArray(MANIFEST.tools) && MANIFEST.tools.length > 0)
  for (const tool of MANIFEST.tools) {
    assert.equal(typeof tool, 'string', `도구 이름은 문자열이어야 한다: ${tool}`)
    assert.ok(tool.trim().length > 0, '빈 문자열 도구 이름 금지')
  }
})

test('부트스트랩은 네 도구만 다룬다', () => {
  assert.deepEqual(MANIFEST.tools, ['Claude Code', 'Codex', 'OpenCode', 'Antigravity'])
  const paths = MANIFEST.files.map((f) => f.path)
  for (const gone of ['.gemini/settings.json', '.grok/config.toml', 'kilo.jsonc', '.kiro/settings/mcp.json', '.kimi-code/mcp.json', '.github/mcp.json', '.github/copilot/settings.json', '.vscode/mcp.json']) {
    assert.ok(!paths.includes(gone), gone)
  }
  for (const kept of ['AGENTS.md', '.agents/skills/README.md', '.agents/skills/repository-check/SKILL.md', '.agent-kit/README.md', '.claude/settings.json', '.codex/config.toml', 'opencode.jsonc']) {
    assert.ok(paths.includes(kept), kept)
  }
  assert.deepEqual(MANIFEST.blocks.map((b) => b.path), ['CLAUDE.md'])
  assert.deepEqual(MANIFEST.adapters.map((a) => a.path), ['.claude/skills'])
  assert.deepEqual(MANIFEST.settings, [])
})

test('경로는 저장소 상대 경로이고 중복이 없다', () => {
  const paths = [
    ...MANIFEST.dirs,
    ...MANIFEST.files.map((f) => f.path),
    ...MANIFEST.blocks.map((b) => b.path),
    ...MANIFEST.adapters.map((a) => a.path),
    ...MANIFEST.settings.map((s) => s.path),
  ]
  for (const p of paths) {
    assert.ok(!p.startsWith('/') && !/^[A-Za-z]:/.test(p), `절대 경로 금지: ${p}`)
    assert.ok(!p.includes('..'), `상위 이동 금지: ${p}`)
    assert.ok(!p.includes('\\'), `구분자는 / 로 통일: ${p}`)
  }
  const files = MANIFEST.files.map((f) => f.path)
  assert.equal(new Set(files).size, files.length, 'files 경로 중복')
})

test('모든 files 항목이 비어 있지 않은 템플릿을 갖는다', () => {
  for (const f of MANIFEST.files) {
    assert.equal(typeof f.template, 'string', `${f.path}: template 누락`)
    assert.ok(f.template.trim().length > 0, `${f.path}: template 비어 있음`)
  }
})

test('블록은 관리 마커를 포함한다', () => {
  for (const b of MANIFEST.blocks) {
    assert.match(b.block, /<!-- agent-kit:begin -->/, `${b.path}: 시작 마커 없음`)
    assert.match(b.block, /<!-- agent-kit:end -->/, `${b.path}: 종료 마커 없음`)
  }
})

test('어댑터 경로는 모두 .gitignore 대상이다', () => {
  for (const a of MANIFEST.adapters) {
    assert.ok(MANIFEST.ignore.includes(a.path), `${a.path}가 ignore에 없음`)
  }
})

// VisualStudio.gitignore가 `.vscode/*`를 통째로 무시한다. config.gitmessage.*가
// VS Code 커밋 템플릿을 .vscode/settings.json에 배선하므로, 부정 항목이 빠지면
// 그 파일은 만들어지는데 커밋되지 않아 팀 공유가 조용히 깨진다.
test('.vscode/settings.json 부정 항목을 유지한다', () => {
  assert.deepEqual(MANIFEST.ignore, ['.claude/skills', '!.vscode/settings.json'])
})

test('템플릿에 CRLF와 BOM이 없다', () => {
  for (const [name, value] of Object.entries(templates)) {
    if (typeof value !== 'string') continue
    assert.ok(!value.includes('\r'), `${name}: CR 포함`)
    assert.ok(!value.startsWith('﻿'), `${name}: BOM 포함`)
  }
})

test('템플릿 문서가 지원을 끝낸 도구를 말하지 않는다', () => {
  for (const name of ['SKILL_README', 'AGENT_KIT_README', 'CODEX_CONFIG']) {
    assert.doesNotMatch(templates[name], /Gemini|Kiro|Grok|Copilot|Kilo|Kimi/, name)
  }
})

// 이 저장소 자신도 부트스트랩 산출물을 커밋해 두고 있어, 템플릿만 고치면
// 두 벌이 조용히 갈라진다(실제로 .agent-kit/README.md가 그렇게 어긋났다).
// 설치기는 자기완결이라 다른 저장소에 복사될 수 있으므로, 사본이 없으면
// 검증을 건너뛴다 — 여기서 없다는 것은 드리프트가 아니라 다른 저장소라는 뜻이다.
test('저장소에 커밋된 사본이 템플릿과 일치한다', () => {
  const norm = (text) => text.replace(/\r\n/g, '\n').trim()
  const pairs = [
    ['.agent-kit/README.md', templates.AGENT_KIT_README],
    ['.agents/skills/README.md', templates.SKILL_README],
    ['.agents/skills/repository-check/SKILL.md', templates.EXAMPLE_SKILL],
  ]
  let checked = 0
  for (const [rel, template] of pairs) {
    const file = join(REPO_ROOT, rel)
    if (!existsSync(file)) continue
    checked++
    assert.equal(
      norm(readFileSync(file, 'utf8')),
      norm(template),
      `${rel}이 템플릿과 다르다 — 템플릿을 고쳤다면 이 사본도 갱신해야 한다`,
    )
  }
  assert.ok(checked > 0 || !existsSync(join(REPO_ROOT, '.agent-kit')), '사본이 있는데 하나도 검사하지 못했다')
})
