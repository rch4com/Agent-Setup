import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOOTSTRAP_USAGE, DESIGN_USAGE, ROOT_USAGE,
  requireValue, collectValues, parseSetArg,
  parseRootArgs, parseDesignArgs, parseBootstrapArgs,
} from '../lib/args.mjs'

// ── collectValues ─────────────────────────────────────────────────

test('collectValues: 두 형식(값 분리·등호)과 반복 지정을 모두 받는다', () => {
  const cases = [
    [[], []],
    [['--design-dir', 'a'], ['a']],
    [['--design-dir=a'], ['a']],
    [['--design-dir', 'a', '--design-dir=b'], ['a', 'b']],
    [['--design-dir', '사내=//nas/design'], ['사내=//nas/design']],
    // 값을 소비한 뒤 그 값이 다시 플래그로 읽히면 안 된다.
    [['--design-dir', 'a', '--dry-run'], ['a']],
  ]
  for (const [argv, expected] of cases) {
    assert.deepEqual(collectValues(argv, '--design-dir'), expected, JSON.stringify(argv))
  }
})

test('collectValues: 값이 없으면 던진다', () => {
  for (const argv of [['--design-dir'], ['--design-dir', '--dry-run'], ['--design-dir=']]) {
    assert.throws(() => collectValues(argv, '--design-dir'), /값이 필요합니다/, JSON.stringify(argv))
  }
})

test('requireValue: 값이 없거나 다음 플래그면 던진다', () => {
  assert.equal(requireValue(['--preview', 'stripe'], '--preview'), 'stripe')
  assert.throws(() => requireValue(['--preview'], '--preview'), /값이 필요합니다/)
  assert.throws(() => requireValue(['--preview', '--dry-run'], '--preview'), /값이 필요합니다/)
})

// ── parseSetArg ───────────────────────────────────────────────────

test('parseSetArg: 빈 문자열(전체 제거)과 없음(null)을 구별한다', () => {
  assert.equal(parseSetArg([]), null)
  assert.equal(parseSetArg(['--set', '']), '')
  assert.equal(parseSetArg(['--set', 'a,b']), 'a,b')
})

test('parseSetArg: 값이 빠지면 던진다 — 조용히 전체 제거로 읽히면 안 된다', () => {
  assert.throws(() => parseSetArg(['--set']), /--set "" 로 명시/)
  assert.throws(() => parseSetArg(['--set', '--dry-run']), /--set "" 로 명시/)
})

// 등호 형식만 인식되지 않으면 목표 집합을 줬는데도 대화형 화면이 열린다.
test('parseSetArg: 등호 형식도 받는다', () => {
  assert.equal(parseSetArg(['--set=a,b']), 'a,b')
  assert.equal(parseSetArg(['--set=']), '')
  assert.equal(parseSetArg(['--dry-run', '--set=a']), 'a')
})

test('requireValue: 등호 형식도 받는다', () => {
  assert.equal(requireValue(['--preview=stripe'], '--preview'), 'stripe')
  assert.throws(() => requireValue(['--preview='], '--preview'), /값이 필요합니다/)
})

// ── parseRootArgs ─────────────────────────────────────────────────

test('parseRootArgs: --list·--set이 없을 때만 대화형으로 간다', () => {
  assert.equal(parseRootArgs([]).interactive, true)
  assert.equal(parseRootArgs(['--dry-run']).interactive, true)
  assert.equal(parseRootArgs(['--list']).interactive, false)
  assert.equal(parseRootArgs(['--set', '']).interactive, false)
  assert.equal(parseRootArgs(['--set', 'mcp.notion']).interactive, false)
})

test('parseRootArgs: 플래그를 그대로 실어 나른다', () => {
  const o = parseRootArgs(['--dry-run', '--set', 'a', '--design-dir=x'])
  assert.deepEqual(
    { dryRun: o.dryRun, listOnly: o.listOnly, setArg: o.setArg, designDirs: o.designDirs },
    { dryRun: true, listOnly: false, setArg: 'a', designDirs: ['x'] },
  )
})

// 예전에는 루트에서 --skill-mode를 읽지 않아, 런처가 넘긴 값이 조용히
// 버려지고 대화형 부트스트랩이 늘 auto로 돌았다.
test('parseRootArgs: --skill-mode를 두 형식 모두 받아 실어 나른다', () => {
  assert.equal(parseRootArgs([]).skillMode, 'auto')
  for (const mode of ['auto', 'link', 'copy']) {
    assert.equal(parseRootArgs(['--skill-mode', mode]).skillMode, mode)
    assert.equal(parseRootArgs([`--skill-mode=${mode}`]).skillMode, mode)
  }
  // 값 검증도 bootstrap과 같은 규칙을 따른다.
  assert.throws(() => parseRootArgs(['--skill-mode', 'nope']), /auto, link, copy 중 하나/)
  assert.throws(() => parseRootArgs(['--skill-mode']), /값이 필요합니다/)
})

// 조용히 무시되면 사용자는 명령이 먹혔다고 믿지만 아무 일도 일어나지 않는다.
test('parseRootArgs: 모르는 인자와 오타를 거부한다', () => {
  for (const argv of [['--lst'], ['--dryrun'], ['--totally-unknown'], ['stray'], ['--list=1']]) {
    assert.throws(() => parseRootArgs(argv), (e) => e.message.includes(ROOT_USAGE), JSON.stringify(argv))
  }
})

test('parseRootArgs: 등호 형식 --set은 대화형으로 새지 않는다', () => {
  const o = parseRootArgs(['--set=mcp.notion'])
  assert.equal(o.setArg, 'mcp.notion')
  assert.equal(o.interactive, false)
})

// 예전에는 --list가 먼저 처리되어 --set이 조용히 버려졌다. 모르는 인자를
// 거부하는 것과 같은 이유로 거부한다 — 준 인자가 먹히지 않으면 안 된다.
test('parseRootArgs: 동작 플래그를 겹쳐 주면 거부한다', () => {
  for (const argv of [['--list', '--set', 'a'], ['--set=a', '--list'], ['--list', '--set=']]) {
    assert.throws(
      () => parseRootArgs(argv),
      (e) => /함께 쓸 수 없습니다/.test(e.message) && e.message.includes(ROOT_USAGE),
      JSON.stringify(argv),
    )
  }
  // 수식 플래그는 겹쳐도 된다.
  assert.equal(parseRootArgs(['--dry-run', '--list']).listOnly, true)
})

test('parseRootArgs: -h/--help는 다른 검증보다 앞선다', () => {
  for (const argv of [['-h'], ['--help'], ['--help', '--bogus']]) {
    const o = parseRootArgs(argv)
    assert.equal(o.help, true, JSON.stringify(argv))
    assert.equal(o.interactive, false)
  }
})

// ── parseDesignArgs ───────────────────────────────────────────────

test('parseDesignArgs: 어떤 동작 플래그도 없을 때만 대화형이다', () => {
  const cases = [
    [[], true],
    [['--dry-run'], true],
    [['--design-dir=x'], true],
    [['--list'], false],
    [['--set', ''], false],
    [['--preview', 'stripe'], false],
    [['--sync=catalog'], false],
  ]
  for (const [argv, expected] of cases) {
    assert.equal(parseDesignArgs(argv).interactive, expected, JSON.stringify(argv))
  }
})

// runDesign은 list → preview → sync → set 순으로 하나만 실행하므로,
// 겹쳐 주면 뒤에 온 것이 조용히 사라졌다(`--preview x --set y`는 --set 무시).
test('parseDesignArgs: 동작 플래그를 겹쳐 주면 거부한다', () => {
  const cases = [
    ['--preview', 'stripe', '--set', 'vercel'],
    ['--list', '--sync=catalog'],
    ['--set=a', '--preview=b'],
    ['--list', '--set', ''],
  ]
  for (const argv of cases) {
    assert.throws(
      () => parseDesignArgs(argv),
      (e) => /함께 쓸 수 없습니다/.test(e.message) && e.message.includes(DESIGN_USAGE),
      JSON.stringify(argv),
    )
  }
  // 수식 플래그(--dry-run·--design-dir)는 동작 플래그와 함께 쓸 수 있다.
  assert.equal(parseDesignArgs(['--dry-run', '--design-dir=x', '--sync=stale']).sync, 'stale')
})

test('parseDesignArgs: --sync는 허용된 세 값만 받는다', () => {
  for (const op of ['installed', 'catalog', 'stale']) {
    assert.equal(parseDesignArgs([`--sync=${op}`]).sync, op)
  }
  // 값 없는 --sync가 조용히 통과하면 무엇을 동기화할지 모르는 채로 진행된다.
  assert.throws(() => parseDesignArgs(['--sync']), /--sync=installed\|catalog\|stale/)
  assert.throws(() => parseDesignArgs(['--sync=nope']), /--sync=installed\|catalog\|stale/)
})

test('parseDesignArgs: 값들을 그대로 실어 나른다', () => {
  const o = parseDesignArgs(['--preview', 'stripe,apple', '--design-dir', 'a', '--dry-run'])
  assert.equal(o.preview, 'stripe,apple')
  assert.deepEqual(o.designDirs, ['a'])
  assert.equal(o.dryRun, true)
})

test('parseDesignArgs: 등호 형식 --preview·--set도 대화형으로 새지 않는다', () => {
  assert.equal(parseDesignArgs(['--preview=stripe']).preview, 'stripe')
  assert.equal(parseDesignArgs(['--preview=stripe']).interactive, false)
  assert.equal(parseDesignArgs(['--set=stripe']).set, 'stripe')
  assert.equal(parseDesignArgs(['--set=stripe']).interactive, false)
})

test('parseDesignArgs: 모르는 인자를 거부하고, --help가 앞선다', () => {
  for (const argv of [['--syncx'], ['--previw', 'stripe'], ['--list=1']]) {
    assert.throws(() => parseDesignArgs(argv), (e) => e.message.includes(DESIGN_USAGE), JSON.stringify(argv))
  }
  assert.equal(parseDesignArgs(['--help']).help, true)
  assert.equal(parseDesignArgs(['-h']).interactive, false)
})

// ── parseBootstrapArgs ────────────────────────────────────────────

test('parseBootstrapArgs: 기본값과 플래그 조합', () => {
  assert.deepEqual(parseBootstrapArgs([]), { dryRun: false, adopt: false, skillMode: 'auto', help: false })
  assert.deepEqual(parseBootstrapArgs(['--dry-run']), { dryRun: true, adopt: false, skillMode: 'auto', help: false })
  assert.equal(parseBootstrapArgs(['-h']).help, true)
  assert.equal(parseBootstrapArgs(['--help']).help, true)
})

test('parseBootstrapArgs: --skill-mode는 두 형식 모두 받는다', () => {
  for (const mode of ['auto', 'link', 'copy']) {
    assert.equal(parseBootstrapArgs(['--skill-mode', mode]).skillMode, mode)
    assert.equal(parseBootstrapArgs([`--skill-mode=${mode}`]).skillMode, mode)
  }
})

test('parseBootstrapArgs: --skill-mode 값이 알 수 없는 인자로 오해되지 않는다', () => {
  const o = parseBootstrapArgs(['--skill-mode', 'copy', '--dry-run'])
  assert.deepEqual(o, { dryRun: true, adopt: false, skillMode: 'copy', help: false })
})

test('parseBootstrapArgs: 잘못된 값과 모르는 인자는 사용법과 함께 던진다', () => {
  const bad = [
    [['--skill-mode', 'nope'], /auto, link, copy 중 하나/],
    [['--skill-mode=nope'], /auto, link, copy 중 하나/],
    [['--skill-mode'], /값이 필요합니다/],
    [['--skill-mode', '--dry-run'], /값이 필요합니다/],
    [['--totally-unknown'], /알 수 없는 인자/],
  ]
  for (const [argv, pattern] of bad) {
    assert.throws(() => parseBootstrapArgs(argv), pattern, JSON.stringify(argv))
    // 오류 메시지에 사용법이 붙어야 한다 — 사용자가 곧바로 고칠 수 있게.
    assert.throws(() => parseBootstrapArgs(argv), (e) => e.message.includes(BOOTSTRAP_USAGE))
  }
})

test('parseBootstrapArgs: --adopt를 받는다', () => {
  assert.equal(parseBootstrapArgs(['--adopt']).adopt, true)
  assert.equal(parseBootstrapArgs([]).adopt, false)
  // 값을 받는 플래그가 아니다.
  assert.throws(() => parseBootstrapArgs(['--adopt=x']), /값을 줄 수 없습니다/)
})
