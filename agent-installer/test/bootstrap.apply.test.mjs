import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync, symlinkSync, rmSync, statSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { makeTempRepo, makeCapture } from './helpers.mjs'
import { ensureDirs, ensureFiles, ensureBlocks, ensureIgnore } from '../lib/bootstrap/apply.mjs'

const ctx = (cap, dryRun = false) => ({ dryRun, log: cap.log })

test('ensureDirs: 없는 디렉터리를 만든다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  const results = ensureDirs(root, ['.codex', '.kiro/settings'], ctx(cap))

  assert.ok(statSync(join(root, '.codex')).isDirectory())
  assert.ok(statSync(join(root, '.kiro', 'settings')).isDirectory())
  assert.deepEqual(results.map((r) => r.action), ['create', 'create'])
})

test('ensureDirs: 이미 있으면 건너뛴다', () => {
  const root = makeTempRepo()
  mkdirSync(join(root, '.codex'))
  const results = ensureDirs(root, ['.codex'], ctx(makeCapture()))
  assert.equal(results[0].action, 'skip')
})

test('ensureFiles: 없는 파일을 템플릿으로 만든다', () => {
  const root = makeTempRepo()
  const results = ensureFiles(root, [{ path: 'AGENTS.md', template: '# 제목' }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '# 제목\n')
  assert.equal(results[0].action, 'create')
})

test('ensureFiles: 기존 파일은 내용을 보지 않고 보존한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'AGENTS.md'), '사용자가 쓴 내용\n')
  const results = ensureFiles(root, [{ path: 'AGENTS.md', template: '# 템플릿' }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'AGENTS.md'), 'utf8'), '사용자가 쓴 내용\n')
  assert.equal(results[0].action, 'keep')
})

// existsSync는 깨진 링크에 false를 반환한다 — 덮어쓰면 사용자 의도를 파괴한다.
test('ensureFiles: 깨진 심볼릭 링크도 존재로 보아 보존한다', () => {
  const root = makeTempRepo()
  // 디렉터리 junction은 Windows에서 권한 없이 만들어진다(파일 심볼릭 링크와 달리).
  // 대상을 지워 깨진 링크로 만든다 — existsSync는 false, lstatSync는 성공하는 상태다.
  const victim = join(root, 'link-target')
  mkdirSync(victim)
  symlinkSync(victim, join(root, 'kilo.jsonc'), 'junction')
  rmSync(victim, { recursive: true, force: true })

  assert.equal(existsSync(join(root, 'kilo.jsonc')), false, '깨진 링크여야 한다')

  const results = ensureFiles(root, [{ path: 'kilo.jsonc', template: '{}' }], ctx(makeCapture()))
  assert.equal(results[0].action, 'keep')
  assert.equal(existsSync(join(root, 'link-target')), false, '템플릿이 링크를 통해 쓰이지 않아야 한다')
})

test('ensureFiles: 부모 디렉터리를 함께 만든다', () => {
  const root = makeTempRepo()
  ensureFiles(root, [{ path: 'a/b/c.md', template: 'x' }], ctx(makeCapture()))
  assert.ok(existsSync(join(root, 'a', 'b', 'c.md')))
})

test('ensureFiles: LF로 쓰고 끝 개행 1개, BOM 없음', () => {
  const root = makeTempRepo()
  ensureFiles(root, [{ path: 'x.md', template: '\n\n한 줄\r\n두 줄\n\n' }], ctx(makeCapture()))

  const raw = readFileSync(join(root, 'x.md'))
  assert.equal(raw.toString('utf8'), '한 줄\n두 줄\n')
  assert.notEqual(raw[0], 0xef) // BOM 아님
})

test('dry-run은 파일시스템을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const cap = makeCapture()
  ensureDirs(root, ['.codex'], ctx(cap, true))
  ensureFiles(root, [{ path: 'AGENTS.md', template: 'x' }], ctx(cap, true))

  assert.equal(existsSync(join(root, '.codex')), false)
  assert.equal(existsSync(join(root, 'AGENTS.md')), false)
  assert.match(cap.text(), /디렉터리 생성/)
  assert.match(cap.text(), /파일 생성/)
})

test('저장소 밖 경로는 거부한다', () => {
  const root = makeTempRepo()
  assert.throws(() => ensureDirs(root, ['../escape'], ctx(makeCapture())), /저장소 밖/)
})

const BLOCK = '<!-- agent-kit:begin -->\n@AGENTS.md\n<!-- agent-kit:end -->'

test('ensureBlocks: 파일이 없으면 블록만으로 만든다', () => {
  const root = makeTempRepo()
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), BLOCK + '\n')
  assert.equal(results[0].action, 'create')
})

test('ensureBlocks: 기존 내용을 보존하고 뒤에 덧붙인다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '# 내 지침\n')
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.ok(text.startsWith('# 내 지침\n'), '기존 내용이 보존되어야 한다')
  assert.ok(text.includes(BLOCK), '블록이 추가되어야 한다')
  assert.equal(results[0].action, 'append')
})

test('ensureBlocks: 마커가 이미 있으면 중복 추가하지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '# 내 지침\n\n' + BLOCK + '\n')
  const before = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), before)
  assert.equal(results[0].action, 'skip')
})

test('ensureBlocks: 끝 개행이 없어도 블록이 줄 경계에서 시작한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, 'CLAUDE.md'), '개행 없이 끝남')
  ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture()))

  const text = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.ok(text.includes('개행 없이 끝남\n'), '기존 마지막 줄이 닫혀야 한다')
  assert.ok(text.includes('\n' + BLOCK), '블록이 줄 처음에서 시작해야 한다')
})

test('ensureIgnore: 없는 항목만 추가한다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, '.gitignore'), '.claude/skills\n')
  ensureIgnore(root, ['.claude/skills', '.kiro/skills'], ctx(makeCapture()))

  const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n')
  assert.equal(lines.filter((l) => l === '.claude/skills').length, 1, '중복 추가 금지')
  assert.ok(lines.includes('.kiro/skills'))
})

test('ensureIgnore: 모두 있으면 파일을 바꾸지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, '.gitignore'), '.claude/skills\n.kiro/skills\n')
  const before = readFileSync(join(root, '.gitignore'), 'utf8')
  const results = ensureIgnore(root, ['.claude/skills', '.kiro/skills'], ctx(makeCapture()))

  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), before)
  assert.equal(results[0].action, 'skip')
})

// 원본 setup-agents.ps1/.sh의 Add-GitignoreEntries/ensure_gitignore_entries가
// 항목 추가 시 앞에 넣는 헤더. 글자 단위로 원본과 같아야 한다.
const IGNORE_HEADER = '# agent-kit: local skill adapters (do not commit duplicated skills)'

test('ensureIgnore: 헤더가 없으면 항목보다 먼저 들어간다', () => {
  const root = makeTempRepo()
  ensureIgnore(root, ['.claude/skills', '.kiro/skills'], ctx(makeCapture()))

  const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n')
  const headerIndex = lines.indexOf(IGNORE_HEADER)
  const firstEntryIndex = lines.indexOf('.claude/skills')

  assert.notEqual(headerIndex, -1, '헤더가 있어야 한다')
  assert.ok(headerIndex < firstEntryIndex, '헤더가 항목보다 먼저 나와야 한다')
})

test('ensureIgnore: 헤더가 이미 있으면 중복 추가하지 않는다', () => {
  const root = makeTempRepo()
  writeFileSync(join(root, '.gitignore'), IGNORE_HEADER + '\n.claude/skills\n')
  ensureIgnore(root, ['.claude/skills', '.kiro/skills'], ctx(makeCapture()))

  const lines = readFileSync(join(root, '.gitignore'), 'utf8').split('\n')
  assert.equal(lines.filter((l) => l === IGNORE_HEADER).length, 1, '헤더 중복 추가 금지')
})

test('블록·ignore도 dry-run에서 바꾸지 않는다', () => {
  const root = makeTempRepo()
  ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(makeCapture(), true))
  ensureIgnore(root, ['.claude/skills'], ctx(makeCapture(), true))

  assert.equal(existsSync(join(root, 'CLAUDE.md')), false)
  assert.equal(existsSync(join(root, '.gitignore')), false)
})

test('ensureBlocks: 깨진 심볼릭 링크에서 읽기 실패 시 경고로 처리한다', () => {
  const root = makeTempRepo()
  // 디렉터리 junction으로 깨진 링크를 만든다 (Windows와 POSIX 호환)
  const victim = join(root, 'link-target')
  mkdirSync(victim)
  symlinkSync(victim, join(root, 'CLAUDE.md'), 'junction')
  rmSync(victim, { recursive: true, force: true })

  assert.equal(existsSync(join(root, 'CLAUDE.md')), false, '깨진 링크여야 한다')

  const cap = makeCapture()
  const results = ensureBlocks(root, [{ path: 'CLAUDE.md', block: BLOCK }], ctx(cap))

  assert.equal(results[0].action, 'warn', '읽기 실패는 경고로 처리해야 한다')
  assert.ok(results[0].message, '메시지가 있어야 한다')
  assert.match(cap.text(), /경고/)
})

// 아래 세 테스트는 저장소 밖을 가리키는 링크를 통한 이탈을 실제 쓰기 경로에서
// 거부하는지 검증한다. 디렉터리 junction을 쓰는 이유는 context.test.mjs와 같다:
// Windows에서 권한 없이 만들 수 있고, POSIX에서는 세 번째 인자가 무시된다.

test('ensureBlocks: 생성 분기가 링크를 통한 저장소 이탈을 거부한다 (실제 실행)', () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  // <root>/.evil -> <outside> : 어휘적으로는 저장소 안이지만 실제로는 밖이다.
  symlinkSync(outside, join(root, '.evil'), 'junction')

  assert.throws(
    () => ensureBlocks(root, [{ path: '.evil/CLAUDE.md', block: BLOCK }], ctx(makeCapture())),
    /외부 링크/,
  )
})

test('ensureBlocks: 덧붙이기 분기가 dry-run에서도 링크를 통한 이탈을 거부한다', () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  // 링크 대상 쪽에 마커 없는 파일을 미리 만들어 덧붙이기 분기로 들어가게 한다.
  writeFileSync(join(outside, 'CLAUDE.md'), '기존 내용\n')
  symlinkSync(outside, join(root, '.evil'), 'junction')

  assert.throws(
    () => ensureBlocks(root, [{ path: '.evil/CLAUDE.md', block: BLOCK }], ctx(makeCapture(), true)),
    /외부 링크/,
  )
})

test('ensureIgnore: 링크를 통한 저장소 이탈을 거부한다', () => {
  const root = makeTempRepo()
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  // .gitignore 자리 자체가 저장소 밖을 가리키는 junction이다.
  symlinkSync(outside, join(root, '.gitignore'), 'junction')

  assert.throws(
    () => ensureIgnore(root, ['.claude/skills'], ctx(makeCapture())),
    /외부 링크/,
  )
})
