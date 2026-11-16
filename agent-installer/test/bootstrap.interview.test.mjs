import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { runUpdate } from '../lib/update.mjs'
import { collectStatus, formatStatus } from '../lib/status.mjs'
import { PROJECT_DOC_PATHS, PROJECT_DOCS } from '../lib/bootstrap/project-docs.mjs'
import { projectDocStates } from '../lib/bootstrap/snippets.mjs'
import { AGENTS_TEMPLATE, AGENTS_TEMPLATE_KO } from '../lib/bootstrap/templates.mjs'
import { createT } from '../lib/i18n/index.mjs'

// 인터뷰 규칙은 문서가 초안인 동안만 AGENTS.md에 있다. 끝나면 에이전트가 절을 지우고,
// 부트스트랩은 다 채워진 저장소에서 그 절을 되살리지 않는다. status는 초안 수만 알린다.
const EN = createT('en')
const KO = createT('ko')
const RELS = Object.values(PROJECT_DOC_PATHS)
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
const write = (root, rel, text) => writeFileSync(join(root, rel), text)
const finish = (root) => { for (const rel of RELS) write(root, rel, `# Done\n\n> Status: ready\n\nbody\n`) }
const dropInterview = (root, re) => write(root, 'AGENTS.md', read(root, 'AGENTS.md').replace(re, ''))
const EN_SECTION = /## Document interview[\s\S]*?(?=## Required workflow)/
const KO_SECTION = /## 문서 인터뷰[\s\S]*?(?=## 필수 작업 흐름)/

test('인터뷰 규칙은 별도 절이고, 문서 규칙 절에는 남지 않는다', () => {
  for (const [tpl, section, docs, heading] of [
    [AGENTS_TEMPLATE, EN_SECTION, /## Project documents[\s\S]*?(?=## Document interview)/, 'Interview protocol'],
    [AGENTS_TEMPLATE_KO, KO_SECTION, /## 프로젝트 문서[\s\S]*?(?=## 문서 인터뷰)/, '인터뷰 규칙'],
  ]) {
    assert.ok(section.test(tpl), '인터뷰 절이 있다')
    assert.ok(!tpl.match(docs)[0].includes(heading), '문서 절에는 인터뷰 규칙이 없다')
    assert.ok(tpl.match(section)[0].includes(heading))
    assert.match(tpl.match(section)[0], /Status: draft/, '언제 지우는지 적혀 있다')
  }
})

test('초안이 남은 저장소는 지운 인터뷰 절을 되살린다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: EN, log() {} })
  dropInterview(root, EN_SECTION)
  assert.ok(!/## Document interview/.test(read(root, 'AGENTS.md')))
  runBootstrap(root, { t: EN, log() {} })
  assert.equal(read(root, 'AGENTS.md').match(/^## Document interview$/gm).length, 1)
})

test('문서가 모두 끝난 저장소는 지운 인터뷰 절을 되살리지 않는다 — 부트스트랩도 update도', async () => {
  for (const [t, section, heading] of [[EN, EN_SECTION, /^## Document interview$/m], [KO, KO_SECTION, /^## 문서 인터뷰$/m]]) {
    const root = makeTempRepo()
    runBootstrap(root, { t, log() {} })
    finish(root)
    dropInterview(root, section)
    const mine = read(root, 'AGENTS.md')
    runBootstrap(root, { t, log() {} })
    assert.equal(read(root, 'AGENTS.md'), mine)
    await runUpdate(root, { t, log() {} })
    assert.equal(read(root, 'AGENTS.md'), mine)
    assert.doesNotMatch(read(root, 'AGENTS.md'), heading)
  }
})

test('문서가 하나라도 없거나 초안이면 아직 인터뷰 중이다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: EN, log() {} })
  finish(root)
  assert.ok(projectDocStates(root).every((d) => d.state === 'ready'))
  write(root, 'docs/spec.md', '# Spec\n\n## A\n\n<TBD: x>\n')
  assert.equal(projectDocStates(root).find((d) => d.path === 'docs/spec.md').state, 'draft')
  write(root, 'docs/spec.md', '# Spec\n\n> Status: draft\n')
  assert.equal(projectDocStates(root).find((d) => d.path === 'docs/spec.md').state, 'draft')
})

test('직접 쓴 README의 빠진 절이 붙은 뒤의 상태로 인터뷰 절을 판정한다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: EN, log() {} })
  finish(root)
  dropInterview(root, EN_SECTION)
  // 우리 표지 없는 README — 빠진 절이 붙으면서 <TBD>가 생긴다. 그러면 인터뷰가 필요하다.
  write(root, 'README.md', '# App\n\n## Why\n\nx\n')
  runBootstrap(root, { t: EN, log() {} })
  assert.match(read(root, 'README.md'), /<TBD: /)
  assert.match(read(root, 'AGENTS.md'), /^## Document interview$/m)
})

test('status는 초안 문서 수와 목록만 알린다 — 아무것도 바꾸지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: EN, log() {} })
  const before = read(root, 'AGENTS.md')
  let report = await collectStatus(root)
  assert.equal(report.docs.total, 6)
  assert.deepEqual(report.docs.drafts.sort(), [...RELS].sort())
  assert.match(formatStatus(report, EN), /6 of 6 still draft/)
  assert.match(formatStatus(report, KO), /6개 중 6 초안/)

  finish(root)
  report = await collectStatus(root)
  assert.deepEqual(report.docs.drafts, [])
  const text = formatStatus(report, EN)
  assert.match(text, /0 of 6 still draft/)
  assert.doesNotMatch(text, /interview you/)
  assert.equal(read(root, 'AGENTS.md'), before)
})

test('plan 문서는 이슈 트래커를 묻고, 있으면 요약만 두라고 안내한다', () => {
  for (const locale of ['en', 'ko']) {
    const plan = PROJECT_DOCS[locale].plan
    assert.match(plan, /^## (?:Task tracking|이슈 트래커)$/m)
    assert.match(plan, /<TBD: [^>]*(?:tracker|트래커)/)
    assert.match(plan, /^\d+\. .*(?:issue tracker|이슈 트래커)/m, '인터뷰 질문')
  }
  assert.match(AGENTS_TEMPLATE, /names an issue tracker, tasks live in the tracker/)
  assert.match(AGENTS_TEMPLATE_KO, /이슈 트래커를 밝히면 작업은 트래커에 둡니다/)
})
