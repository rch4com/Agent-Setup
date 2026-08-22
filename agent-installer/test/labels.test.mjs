import test from 'node:test'
import assert from 'node:assert/strict'
import { scopedLabel } from '../lib/labels.mjs'
import { createT } from '../lib/i18n/index.mjs'

test('plugin 항목은 범위 접미사가 붙는다 — 두 로케일 모두', () => {
  const project = { category: 'plugin', label: 'superpowers', scope: 'project' }
  const user = { category: 'plugin', label: 'superpowers', scope: 'user' }
  assert.equal(scopedLabel(project, createT('ko')), 'superpowers (저장소)')
  assert.equal(scopedLabel(user, createT('ko')), 'superpowers (전역)')
  assert.equal(scopedLabel(project, createT('en')), 'superpowers (repo)')
  assert.equal(scopedLabel(user, createT('en')), 'superpowers (global)')
})

test('plugin이 아닌 항목은 라벨 그대로다', () => {
  const t = createT('ko')
  assert.equal(scopedLabel({ category: 'skill', label: 'GSD', scope: 'project' }, t), 'GSD')
  assert.equal(scopedLabel({ category: 'mcp', label: 'Notion' }, t), 'Notion')
})

test('scope가 없는 plugin은 저장소 범위로 본다', () => {
  assert.equal(scopedLabel({ category: 'plugin', label: 'X' }, createT('ko')), 'X (저장소)')
})
