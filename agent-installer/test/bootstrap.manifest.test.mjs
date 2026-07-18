import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MANIFEST } from '../lib/bootstrap/manifest.mjs'
import * as templates from '../lib/bootstrap/templates.mjs'

test('MANIFEST는 다섯 종류를 모두 선언한다', () => {
  assert.ok(Array.isArray(MANIFEST.dirs) && MANIFEST.dirs.length > 0)
  assert.ok(Array.isArray(MANIFEST.files) && MANIFEST.files.length > 0)
  assert.ok(Array.isArray(MANIFEST.blocks) && MANIFEST.blocks.length > 0)
  assert.ok(Array.isArray(MANIFEST.adapters) && MANIFEST.adapters.length > 0)
  assert.ok(Array.isArray(MANIFEST.ignore) && MANIFEST.ignore.length > 0)
})

test('MANIFEST.tools는 비어 있지 않은 문자열 배열이다', () => {
  assert.ok(Array.isArray(MANIFEST.tools) && MANIFEST.tools.length > 0)
  for (const tool of MANIFEST.tools) {
    assert.equal(typeof tool, 'string', `도구 이름은 문자열이어야 한다: ${tool}`)
    assert.ok(tool.trim().length > 0, '빈 문자열 도구 이름 금지')
  }
})

test('경로는 저장소 상대 경로이고 중복이 없다', () => {
  const paths = [
    ...MANIFEST.dirs,
    ...MANIFEST.files.map((f) => f.path),
    ...MANIFEST.blocks.map((b) => b.path),
    ...MANIFEST.adapters.map((a) => a.path),
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

test('템플릿에 CRLF와 BOM이 없다', () => {
  for (const [name, value] of Object.entries(templates)) {
    if (typeof value !== 'string') continue
    assert.ok(!value.includes('\r'), `${name}: CR 포함`)
    assert.ok(!value.startsWith('﻿'), `${name}: BOM 포함`)
  }
})

test('9개 도구의 설정 파일이 모두 선언되어 있다', () => {
  const files = MANIFEST.files.map((f) => f.path)
  for (const expected of [
    'AGENTS.md',
    '.agents/skills/README.md',
    '.agents/skills/repository-check/SKILL.md',
    '.agent-kit/README.md',
    '.claude/settings.json',
    '.codex/config.toml',
    '.gemini/settings.json',
    '.grok/config.toml',
    'opencode.jsonc',
    'kilo.jsonc',
    '.kiro/settings/mcp.json',
    '.kimi-code/mcp.json',
  ]) {
    assert.ok(files.includes(expected), `누락: ${expected}`)
  }
})
