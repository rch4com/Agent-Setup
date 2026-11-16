import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeTempRepo } from './helpers.mjs'
import { runBootstrap } from '../lib/bootstrap/flow.mjs'
import { runUpdate } from '../lib/update.mjs'
import { createT } from '../lib/i18n/index.mjs'

// 사용자가 직접 쓴 파일(우리 표지 `Status: draft|ready`가 없는 파일)은 본문을 그대로 두고,
// 템플릿에는 있는데 파일에 없는 절만 뒤에 덧붙인다. 판정은 제목(영문·한글·동의어, 단계 무관)이라
// 같은 내용이 두 번 들어가지 않는다. 우리 표지가 있는 문서는 건드리지 않는다.
const EN = createT('en')
const KO = createT('ko')
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
const put = (root, rel, text) => {
  mkdirSync(join(root, rel, '..'), { recursive: true })
  writeFileSync(join(root, rel), text)
}
// 어떤 단계(#~######)든 제목 이름이 같은 줄의 개수.
const count = (text, name) => text.split(/\r?\n/).filter((l) => new RegExp(`^#{1,6}\\s+${name}\\s*$`, 'i').test(l)).length

test('사용자 README는 본문을 지키고 빠진 절만 덧붙인다 — 동의어·다른 단계 제목은 같은 절', () => {
  const root = makeTempRepo()
  const mine = '# 내 프로젝트\n\n## Installation\n\nnpm i\n\n### Usage\n\n쓰는 법\n\n## License\n\nMIT\n'
  put(root, 'README.md', mine)
  runBootstrap(root, { t: KO, log() {} })
  const text = read(root, 'README.md')
  assert.ok(text.startsWith(mine), '사용자 본문은 앞에 그대로')
  // Installation(= 빠른 시작), ### Usage(= 사용법), License(= 라이선스)는 이미 있다.
  for (const name of ['빠른 시작', '사용법', '라이선스']) assert.equal(count(text, name), 0, name)
  // 없는 절은 한글로 붙고, 채울 자리표시자가 생겼으니 인터뷰 가이드도 붙는다.
  for (const name of ['왜 만드는가', '프로젝트 구조', '문서', '기여 방법', '인터뷰 가이드']) {
    assert.equal(count(text, name), 1, name)
  }
  // 재실행은 바꾸지 않는다 — 중복 저장 없음.
  runBootstrap(root, { t: KO, log() {} })
  assert.equal(read(root, 'README.md'), text)
})

test('필요한 절을 이미 다 가진 사용자 README에는 아무것도 붙지 않는다 — 가이드도 없다', () => {
  const root = makeTempRepo()
  const mine = '# 앱\n\n## About\n\n소개\n\n## Getting started\n\nx\n\n## Examples\n\ny\n\n## Structure\n\nz\n\n## Docs\n\nd\n\n## Contribute\n\nc\n\n## Licence\n\nMIT\n'
  put(root, 'README.md', mine)
  runBootstrap(root, { t: EN, log() {} })
  assert.equal(read(root, 'README.md'), mine)
})

test('언어가 달라도 같은 절은 중복되지 않는다 — 영어 README에 한글 실행', () => {
  const root = makeTempRepo()
  const mine = '# App\n\n## Why\n\nbecause\n\n## Quick start\n\nrun\n'
  put(root, 'README.md', mine)
  runBootstrap(root, { t: KO, log() {} })
  const text = read(root, 'README.md')
  assert.ok(text.startsWith(mine))
  assert.equal(count(text, '왜 만드는가'), 0)
  assert.equal(count(text, '빠른 시작'), 0)
  assert.equal(count(text, '사용법'), 1)
})

test('docs의 사용자 파일도 같다 — 제목 단계가 달라도, 한글 제목이어도 같은 절', () => {
  const root = makeTempRepo()
  const mine = '# 명세\n\n### Scope\n\n범위\n\n#### 용어집\n\n뜻\n'
  put(root, 'docs/spec.md', mine)
  runBootstrap(root, { t: EN, log() {} })
  const text = read(root, 'docs/spec.md')
  assert.ok(text.startsWith(mine))
  assert.equal(count(text, 'Scope'), 1, '### Scope가 있다')
  assert.equal(count(text, 'Glossary'), 0, '#### 용어집이 있다')
  assert.equal(count(text, 'Functional requirements'), 1, '없는 절은 붙는다')
  assert.equal(count(text, 'Interview guide'), 1)
})

test('우리 표지(Status: draft|ready)가 있는 문서는 건드리지 않는다 — 지운 절을 되살리지 않는다', () => {
  for (const status of ['draft', 'ready']) {
    const root = makeTempRepo()
    const mine = `# Intent\n\n> Status: ${status}\n\n## Purpose\n\n끝난 문서\n`
    put(root, 'docs/intent.md', mine)
    runBootstrap(root, { t: EN, log() {} })
    assert.equal(read(root, 'docs/intent.md'), mine, status)
  }
})

test('"Status: stable" 같은 README 문구는 우리 표지로 보지 않는다', () => {
  const root = makeTempRepo()
  const mine = '# App\n\nStatus: stable\n\n## Why\n\nx\n'
  put(root, 'README.md', mine)
  runBootstrap(root, { t: EN, log() {} })
  const text = read(root, 'README.md')
  assert.ok(text.startsWith(mine))
  assert.equal(count(text, 'Usage'), 1, '빠진 절이 붙는다')
})

test('dry-run은 사용자 파일을 바꾸지 않고, update도 같은 규칙으로 덧붙인다', async () => {
  const root = makeTempRepo()
  const mine = '# App\n\n## Why\n\nx\n'
  put(root, 'README.md', mine)
  runBootstrap(root, { t: EN, dryRun: true, log() {} })
  assert.equal(read(root, 'README.md'), mine, 'dry-run')

  runBootstrap(root, { t: EN, log() {} })
  // 사용자가 Usage 절을 지웠다 — 우리 표지가 없는 파일이라 다시 붙는다(AGENTS.md 절과 같은 추가 전용 규칙).
  put(root, 'README.md', read(root, 'README.md').replace(/## Usage[\s\S]*?(?=## Project structure)/, ''))
  assert.equal(count(read(root, 'README.md'), 'Usage'), 0)
  await runUpdate(root, { t: EN, log() {} })
  assert.equal(count(read(root, 'README.md'), 'Usage'), 1)
  const again = read(root, 'README.md')
  await runUpdate(root, { t: EN, log() {} })
  assert.equal(read(root, 'README.md'), again, '재실행은 바꾸지 않는다')
})

test('새로 만든 문서는 재실행해도 절이 늘지 않는다', () => {
  const root = makeTempRepo()
  runBootstrap(root, { t: KO, log() {} })
  const files = ['README.md', 'docs/intent.md', 'docs/spec.md', 'docs/architecture.md', 'docs/plan.md', 'docs/review.md']
  const before = files.map((f) => read(root, f))
  runBootstrap(root, { t: KO, log() {} })
  runBootstrap(root, { t: EN, log() {} })
  assert.deepEqual(files.map((f) => read(root, f)), before)
})
