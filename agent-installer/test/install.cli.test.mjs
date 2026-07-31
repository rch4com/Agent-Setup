import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeTempRepo, runInstaller, KO } from './helpers.mjs'
import { resolveLocale } from '../lib/i18n/index.mjs'
import { detectLocale } from '../lib/i18n/detect.mjs'

// 프로세스 레벨에서만 드러나는 계약을 검증한다: 종료 코드, 스트림 분리,
// 실패했을 때 아무것도 남기지 않는 것, 그리고 멈추지 않는 것.
// 인자 파싱 자체는 args.test.mjs가 훨씬 싸게 덮는다.

function untouched(root) {
  // git init 직후의 저장소에는 .git만 있다.
  return readdirSync(root).filter((n) => n !== '.git')
}

// ── 멈춤 방지 ─────────────────────────────────────────────────────

// 이 저장소에서 가장 값비싼 회귀다. TUI가 비TTY를 감지하지 못하면
// `node install.mjs`가 키 입력을 기다리며 영원히 멈추고, CI 전체가 함께 멈춘다.
test('인자 없이 비TTY로 실행하면 목록만 내고 즉시 끝난다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, [], { timeout: 30000, env: KO })

  assert.notEqual(r.status, null, '시간 초과 — 설치기가 입력을 기다리며 멈췄다')
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\[작업\]/)
  assert.match(r.stdout, /대화형 화면은 터미널에서만/)
  assert.deepEqual(untouched(root), [], '읽기만 해야 하는데 파일이 생겼다')
})

test('--dry-run도 비TTY에서 멈추지 않고 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--dry-run'])

  assert.notEqual(r.status, null, '시간 초과')
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(untouched(root), [])
})

// ── 종료 코드 ─────────────────────────────────────────────────────

// 같은 사용자 오류가 경로에 따라 다른 코드로 끝나면 스크립트가 분기할 수 없다.
// 예전에는 최상위 --set만 exit 2였다.
// 이 어서션들은 진입점의 catch가 LocalizedError를 .key로 다시 렌더한다는
// 사실을 증명하는 유일한 자리다 — 인자 오류 경로는 notGitRepo 경로와 달리
// main() 안에서 t가 만들어진 다음에 던져지므로, env: KO로 강제한 로케일이
// catch까지 그대로 살아남는지 여기서 확인한다.
test('--set 값 누락은 최상위와 design에서 같은 코드로 끝난다', () => {
  const root = makeTempRepo()
  const top = runInstaller(root, ['--set'], { env: KO })
  const design = runInstaller(root, ['design', '--set'], { env: KO })

  assert.equal(top.status, design.status, `최상위 ${top.status} vs design ${design.status}`)
  assert.equal(top.status, 1)
  for (const r of [top, design]) assert.match(r.stderr, /--set "" 로 명시/)
  assert.deepEqual(untouched(root), [])
})

test('실패는 모두 exit 1이고 메시지는 stderr로 나간다', () => {
  const root = makeTempRepo()
  const cases = [
    [['--set', 'does-not-exist'], /알 수 없는 항목/],
    [['design', '--sync=nope'], /--sync=installed\|catalog\|stale/],
    [['design', '--preview'], /값이 필요합니다/],
    [['bootstrap', '--totally-unknown'], /알 수 없는 인자/],
  ]
  for (const [args, pattern] of cases) {
    const r = runInstaller(root, args, { env: KO })
    assert.equal(r.status, 1, `${args.join(' ')} → ${r.status}`)
    assert.match(r.stderr, pattern, args.join(' '))
    assert.equal(r.stdout, '', `${args.join(' ')}: 실패인데 stdout에 출력이 있다`)
  }
  assert.deepEqual(untouched(root), [], '실패했는데 파일이 생겼다')
})

// ── 성공 경로 ─────────────────────────────────────────────────────

test('--list는 상태와 함께 목록을 내고 아무것도 바꾸지 않는다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--list'], { env: KO })

  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /미설치\s+mcp\.notion/)
  assert.deepEqual(untouched(root), [])
})

test('design --list는 제공자별로 묶어 낸다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['design', '--list'])

  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /\[awesome-design-md\]/)
  assert.match(r.stdout, /stripe — Stripe/)
  assert.deepEqual(untouched(root), [])
})

test('design --set은 파일을 만들고 --set ""은 되돌린다', () => {
  const root = makeTempRepo()
  const target = join(root, 'design-md', 'awesome-design-md', 'stripe', 'DESIGN.md')

  assert.equal(runInstaller(root, ['design', '--set', 'stripe']).status, 0)
  assert.ok(existsSync(target), 'design --set이 파일을 만들지 않았다')

  assert.equal(runInstaller(root, ['design', '--set', '']).status, 0)
  assert.equal(existsSync(target), false, 'design --set ""이 되돌리지 않았다')
})

test('design --set --dry-run은 아무것도 만들지 않는다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['design', '--set', 'stripe', '--dry-run'])

  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(untouched(root), [])
})

// ── 로케일 확정 ───────────────────────────────────────────────────

test('설정이 없으면 결정 사슬이 고른 언어로 나온다', () => {
  // 이 검사는 개발 기계의 OS 언어에 좌우되면 안 된다. Windows에서 Node의
  // Intl은 LANG·LC_ALL을 읽지 않으므로 환경변수로 감지 결과를 밀어낼 수
  // 없다. 그래서 "영어가 나온다"가 아니라 "라이브러리가 계산한 로케일과
  // CLI 출력이 일치한다"를 본다 — 여기서 검증할 값은 install.mjs가 결정
  // 사슬을 실제로 부르는가(하드코딩이 아닌가)이다.
  const root = makeTempRepo()
  const env = { ...process.env, AGENT_SETUP_LANG: '' }
  const expected = resolveLocale({ env, detected: detectLocale(env) })

  const r = runInstaller(root, ['--help'], { env: { AGENT_SETUP_LANG: '' } })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, expected === 'ko' ? /사용법:/ : /Usage:/)
})

test('설정이 없으면 OS 환경변수 감지가 출력 언어를 정한다', () => {
  // detectLocale은 LC_ALL을 Intl보다 먼저 본다. 그래서 이 경로는 Windows의
  // Intl이 OS 언어를 고수하는 것과 무관하게 어디서나 결정적이다. 위
  // '결정 사슬' 테스트는 CI(ubuntu-latest)에서 expected가 거의 항상 en이라
  // 하드코딩 회귀가 나도 우연히 통과할 수 있다 — 이 테스트가 그 구멍을 메운다.
  const root = makeTempRepo()
  const r = runInstaller(root, ['--help'], { env: { AGENT_SETUP_LANG: '', LC_ALL: 'ko_KR.UTF-8' } })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /사용법:/)
})

test('AGENT_SETUP_LANG=ko면 한국어로 나온다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--help'], { env: KO })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /사용법:/)
})

test('--lang이 환경변수를 이긴다', () => {
  const root = makeTempRepo()
  const r = runInstaller(root, ['--help', '--lang', 'en'], { env: KO })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /Usage:/)
})

test('git 저장소가 아니면 선택한 언어로 거부한다', () => {
  const outside = mkdtempSync(join(tmpdir(), 'agent-installer-nogit-'))
  const en = runInstaller(outside, ['--list'], { env: { AGENT_SETUP_LANG: 'en' } })
  assert.equal(en.status, 1)
  assert.match(en.stderr, /Git repository/)

  const ko = runInstaller(outside, ['--list'], { env: KO })
  assert.equal(ko.status, 1)
  assert.match(ko.stderr, /git 저장소/)
})

// 결정 사슬에서 기록(record.lang)은 플래그·환경변수 다음이다. 성공 경로는
// main()이 기록까지 넣어 해석하는데, 오류 경로가 기록을 빠뜨리면 TUI에서
// 한국어를 고른 팀이 성공은 한국어로 오류는 영어로 받는다 — 실제로 그랬다.
test('설치 기록의 lang이 오류 메시지에도 적용된다', () => {
  const root = makeTempRepo()
  // TUI의 언어 전환이 남기는 것과 같은 기록을 만든다.
  assert.equal(runInstaller(root, ['bootstrap'], { env: KO }).status, 0)
  const target = join(root, '.agent-kit', 'agent-setup.json')
  const record = JSON.parse(readFileSync(target, 'utf8'))
  writeFileSync(target, `${JSON.stringify({ ...record, lang: 'ko' }, null, 2)}\n`)

  // 플래그도 환경변수도 없다 — 기록만이 한국어를 가리킨다.
  const env = { AGENT_SETUP_LANG: '' }
  const ok = runInstaller(root, ['status'], { env })
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /도구/, '성공 경로가 기록의 언어를 따르지 않았다')

  const failed = runInstaller(root, ['--set', 'no.such.item'], { env })
  assert.equal(failed.status, 1)
  assert.match(failed.stderr, /알 수 없는 항목/, '오류 경로가 기록의 언어를 버렸다')
  assert.doesNotMatch(failed.stderr, /Unknown item/)
})

test('--lang은 오류 메시지에도 적용된다', () => {
  // --help는 catch를 지나지 않는다. 실제 오류를 내야 재렌더 경로가 검증된다.
  const root = makeTempRepo()
  const r = runInstaller(root, ['--totally-unknown-flag', '--lang', 'ko'], {
    env: { AGENT_SETUP_LANG: '' },
  })
  assert.notEqual(r.status, 0)
  assert.match(r.stderr, /알 수 없는 인자입니다/)
  // 한 메시지 안에서 언어가 갈리지 않아야 한다.
  assert.doesNotMatch(r.stderr, /Unknown argument/)
})
