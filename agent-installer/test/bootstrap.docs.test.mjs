import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { runUpdate } from '../lib/update.mjs'
import { manifestFor } from '../lib/bootstrap/manifest.mjs'
import { PROJECT_DOCS, PROJECT_DOC_PATHS } from '../lib/bootstrap/project-docs.mjs'
import { AGENTS_TEMPLATE, AGENTS_TEMPLATE_KO } from '../lib/bootstrap/templates.mjs'
import { splitSections } from '../lib/bootstrap/snippets.mjs'
import { RECORD_REL, readRecord } from '../lib/bootstrap/record.mjs'
import { createT } from '../lib/i18n/index.mjs'

const EN = createT('en')
const KO = createT('ko')
const DOC_KEYS = Object.keys(PROJECT_DOC_PATHS)
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
const guideHeading = { en: '## Interview guide', ko: '## 인터뷰 가이드' }

test('두 언어 모두 프로젝트 문서 여섯 개를 만든다', () => {
  for (const [locale, t] of [['en', EN], ['ko', KO]]) {
    const root = makeTempRepo()
    const { failed } = runBootstrap(root, { t, log() {} })
    assert.deepEqual(failed, [])
    assert.deepEqual(DOC_KEYS.sort(), ['architecture', 'intent', 'plan', 'readme', 'review', 'spec'])
    for (const key of DOC_KEYS) {
      const rel = PROJECT_DOC_PATHS[key]
      assert.ok(existsSync(join(root, rel)), `${locale}: ${rel}`)
      const text = read(root, rel)
      // 키워드는 언어와 무관하게 영어로 고정 — 지침과 에이전트가 같은 문자열로 초안을 판정한다.
      assert.match(text, /^> Status: draft/m, `${locale}/${rel}: Status 줄`)
      assert.match(text, /<TBD: /, `${locale}/${rel}: 자리표시자`)
      assert.ok(text.includes(guideHeading[locale]), `${locale}/${rel}: 인터뷰 가이드`)
      assert.match(text, /^1\. /m, `${locale}/${rel}: 인터뷰 질문`)
    }
  }
})

test('영문판과 한글판은 구조가 같다', () => {
  for (const key of DOC_KEYS) {
    const en = PROJECT_DOCS.en[key]
    const ko = PROJECT_DOCS.ko[key]
    const count = (text, re) => (text.match(re) ?? []).length
    assert.equal(count(ko, /^## /gm), count(en, /^## /gm), `${key}: 절 개수`)
    assert.equal(count(ko, /^\d+\. /gm), count(en, /^\d+\. /gm), `${key}: 인터뷰 질문 수`)
    assert.equal(count(ko, /<TBD: /g), count(en, /<TBD: /g), `${key}: 자리표시자 수`)
    assert.equal(count(ko, /^\| /gm), count(en, /^\| /gm), `${key}: 표 행 수`)
    assert.equal(count(ko, /^- \[ \]/gm), count(en, /^- \[ \]/gm), `${key}: 체크박스 수`)
  }
  const en = splitSections(AGENTS_TEMPLATE)
  const ko = splitSections(AGENTS_TEMPLATE_KO)
  assert.equal(ko.length, en.length, 'AGENTS.md 절 개수 — snippets가 순서로 짝짓는다')
  assert.equal(en[1].heading, 'Project documents')
  assert.equal(ko[1].heading, '프로젝트 문서')
})

test('문서 템플릿에 CRLF·BOM이 없고 서로의 파일을 가리킨다', () => {
  for (const locale of ['en', 'ko']) {
    for (const key of DOC_KEYS) {
      const text = PROJECT_DOCS[locale][key]
      assert.ok(!text.includes('\r'), `${locale}/${key}: CRLF`)
      assert.ok(!text.startsWith('﻿'), `${locale}/${key}: BOM`)
    }
    // README가 다섯 문서와 AGENTS.md로 링크하고, 지침이 여섯 문서 경로를 모두 안내한다.
    for (const rel of ['docs/intent.md', 'docs/spec.md', 'docs/architecture.md', 'docs/plan.md', 'docs/review.md', 'AGENTS.md']) {
      assert.ok(PROJECT_DOCS[locale].readme.includes(`](${rel})`), `${locale}: README → ${rel}`)
    }
    const agents = locale === 'ko' ? AGENTS_TEMPLATE_KO : AGENTS_TEMPLATE
    for (const rel of Object.values(PROJECT_DOC_PATHS)) {
      assert.ok(agents.includes(`\`${rel}\``), `${locale}: AGENTS.md → ${rel}`)
    }
  }
})

test('영어 AGENTS.md에 한글 실행이 같은 절을 또 붙이지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), AGENTS_TEMPLATE)
  runBootstrap(root, { t: KO, log() {} })
  assert.equal(read(root, 'AGENTS.md'), AGENTS_TEMPLATE, '모든 절이 이미 있으면 그대로')
  assert.doesNotMatch(read(root, 'AGENTS.md'), /^## 프로젝트 문서$/m)
})

test('영어로 만든 AGENTS.md에 새 절만 영어로 덧붙는다 — 옛 저장소 호환', () => {
  const root = makeTempRepo()
  const old = AGENTS_TEMPLATE.replace(/## Project documents[\s\S]*?(?=## Required workflow)/, '')
  writeFileSync(join(root, 'AGENTS.md'), old)
  runBootstrap(root, { t: EN, log() {} })
  const text = read(root, 'AGENTS.md')
  assert.equal(text.match(/^## Project documents$/gm).length, 1)
  runBootstrap(root, { t: EN, log() {} })
  assert.equal(read(root, 'AGENTS.md'), text, '재실행은 바꾸지 않는다')
})

test('문서 언어는 저장소가 정한다 — 다른 언어로 update해도 번역으로 바뀌지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: KO, log() {} })
  assert.equal(readRecord(root).lang, 'ko')
  const before = read(root, 'docs/intent.md')
  assert.match(before, /^# 의도/m)

  const logs = []
  await runUpdate(root, { t: EN, log: (m) => logs.push(m) })
  assert.equal(read(root, 'docs/intent.md'), before, '영어 화면에서 update해도 한글 문서 그대로')
  assert.equal(readRecord(root).lang, 'ko')
  assert.ok(!logs.some((l) => /update|갱신/i.test(l) && /intent/.test(l)), logs.join('\n'))

  // 영어 화면에서 부트스트랩을 다시 돌려도 빠진 문서는 기록의 언어로 만든다.
  rmSync(join(root, 'docs/plan.md'))
  runBootstrap(root, { t: EN, log() {} })
  assert.match(read(root, 'docs/plan.md'), /^# 계획/m)
})

test('lang이 없는 옛 기록은 영어 문서로 본다 — 한글 화면이어도 번역하지 않는다', async () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: EN, log() {} })
  // 옛 버전(lang을 남기지 않던)의 기록을 흉내 낸다.
  const record = JSON.parse(read(root, RECORD_REL))
  record.lang = null
  writeFileSync(join(root, RECORD_REL), `${JSON.stringify(record, null, 2)}\n`)
  const before = read(root, 'AGENTS.md')

  await runUpdate(root, { t: KO, log() {} })
  assert.equal(read(root, 'AGENTS.md'), before, '한글 화면 update가 영어 AGENTS.md를 번역하지 않는다')
  assert.equal(readRecord(root).lang, null, 'update는 lang을 건드리지 않는다')

  rmSync(join(root, 'docs/review.md'))
  runBootstrap(root, { t: KO, log() {} })
  assert.match(read(root, 'docs/review.md'), /^# Review/m, '빠진 문서도 영어로 만든다')
})

test('manifestFor: 언어만 다르고 경로는 같다', () => {
  const paths = (m) => m.files.map((f) => f.path)
  assert.deepEqual(paths(manifestFor('ko')), paths(manifestFor('en')))
  assert.deepEqual(paths(manifestFor('xx')), paths(manifestFor('en')), '모르는 언어는 영어')
  for (const rel of Object.values(PROJECT_DOC_PATHS)) assert.ok(paths(manifestFor('en')).includes(rel), rel)
})
