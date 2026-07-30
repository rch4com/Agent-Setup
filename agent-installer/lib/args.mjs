// 인자 파싱만 한다 — 파일시스템도 콘솔도 프로세스도 모른다.
// install.mjs에서 분리한 이유: 진입점은 최상위에서 main()을 실행하므로
// import하는 순간 설치기가 돌아버려 순수 함수를 단위 테스트할 수 없었다.
//
// 오류는 전부 throw다. 종료 코드는 진입점 한 곳에서 정한다 —
// 예전에는 --set만 process.exit(2)로 빠져나가 같은 사용자 오류가
// 경로에 따라 1과 2로 갈렸다.

import { LOCALES, LocalizedError, createT } from './i18n/index.mjs'

// 사용법은 모듈 로드 시점에 로케일을 모르므로 상수가 될 수 없다.
// `bootstrap` 서브커맨드 사용법. install.mjs와 두 런처(setup-agents.sh/.ps1) 모두에서 안내한다.
export const bootstrapUsage = (t) => t('usage.bootstrap')
// 서브커맨드 없는 최상위 사용법. `design`은 자기 사용법을 따로 갖는다.
export const rootUsage = (t) => t('usage.root')
export const designUsage = (t) => t('usage.design')
export const updateUsage = (t) => t('usage.update')
export const statusUsage = (t) => t('usage.status')

const SKILL_MODES = ['auto', 'link', 'copy']

// 인자 사양: 플래그 이름 → 'bool'(값 없음) | 'value'(값 하나를 소비).
// 미지 인자를 조용히 삼키지 않기 위한 것이다 — 오타(`--dryrun`)나 지원하지
// 않는 형식(`--set=a`)이 무시되면 사용자는 명령이 먹혔다고 믿지만 아무 일도
// 일어나지 않는다. bootstrap 파서만 지키던 규칙을 세 파서 모두로 넓힌다.
const COMMON_SPEC = { '-h': 'bool', '--help': 'bool', '--lang': 'value' }
const ROOT_SPEC = {
  ...COMMON_SPEC, '--dry-run': 'bool', '--list': 'bool',
  '--set': 'value', '--skill-mode': 'value', '--design-dir': 'value',
}
const DESIGN_SPEC = {
  ...COMMON_SPEC, '--dry-run': 'bool', '--list': 'bool', '--set': 'value',
  '--preview': 'value', '--sync': 'value', '--design-dir': 'value',
}
const BOOTSTRAP_SPEC = { ...COMMON_SPEC, '--dry-run': 'bool', '--adopt': 'bool', '--skill-mode': 'value' }
const UPDATE_SPEC = { ...COMMON_SPEC, '--dry-run': 'bool', '--force': 'bool' }
const STATUS_SPEC = { ...COMMON_SPEC, '--json': 'bool' }

export function assertKnownArgs(argv, spec, usage) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    const eq = token.startsWith('--') ? token.indexOf('=') : -1
    const name = eq > 0 ? token.slice(0, eq) : token
    const kind = spec[name]
    if (kind === undefined) throw new LocalizedError('error.unknownArg', { token, usage })
    if (kind === 'bool' && eq > 0) throw new LocalizedError('error.flagTakesNoValue', { name, token, usage })
    // `--플래그 값` 형태는 값 한 칸을 건너뛴다. `--플래그=값`은 이미 한 토큰이다.
    if (kind === 'value' && eq < 0) i++
  }
}

// 동작 플래그는 한 번에 하나만 뜻이 있다. 여러 개를 주면 실행 경로가 먼저 오는
// 하나를 골라 나머지를 조용히 버렸다 — `--list --set a`는 --set을, design의
// `--preview x --set y`는 --set을 무시했다. 알 수 없는 인자를 거부하는 것과
// 같은 이유(준 인자가 먹히지 않은 채 다른 일이 벌어진다)로 같이 거부한다.
export function assertSingleAction(argv, names, usage) {
  const given = names.filter((name) => hasFlag(argv, name))
  if (given.length > 1) {
    // 조사를 붙이지 않는다 — 플래그 이름에 따라 은/는이 갈려 문장이 어색해진다.
    throw new LocalizedError('error.singleAction', { given: given.join(', '), usage })
  }
}

function checkSkillMode(value, usage) {
  if (!SKILL_MODES.includes(value)) {
    throw new LocalizedError('error.badSkillMode', { list: SKILL_MODES.join(', '), value, usage })
  }
  return value
}

// `--skill-mode <값>`과 `--skill-mode=<값>`을 모두 받는다. 없으면 기본값 auto.
export function parseSkillMode(argv, usage) {
  let mode = 'auto'
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--skill-mode') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new LocalizedError('error.skillModeNeedsValue', { list: SKILL_MODES.join(', '), usage })
      }
      mode = checkSkillMode(value, usage)
      i++
    } else if (a.startsWith('--skill-mode=')) {
      mode = checkSkillMode(a.slice('--skill-mode='.length), usage)
    }
  }
  return mode
}

function checkLang(value, usage) {
  if (!LOCALES.includes(value)) {
    throw new LocalizedError('error.badLang', { list: LOCALES.join(', '), value, usage })
  }
  return value
}

// `--lang <값>`과 `--lang=<값>`을 모두 받는다. 없으면 null —
// 이 자리에서 기본값을 정하지 않는다. 우선순위 판단은 resolveLocale의 몫이다.
export function parseLang(argv, usage) {
  let lang = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lang') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new LocalizedError('error.langNeedsValue', { list: LOCALES.join(', '), usage })
      }
      lang = checkLang(value, usage)
      i++
    } else if (a.startsWith('--lang=')) {
      lang = checkLang(a.slice('--lang='.length), usage)
    }
  }
  return lang
}

// 진입점이 로케일을 정하기 **전에** 부르는 관대한 사전 스캔이다.
// 여기서 던지면 인자 오류가 늘 영어로 나온다 — 정식 파서가 지역화된
// 오류를 내도록 미지원 값은 조용히 null로 넘긴다.
export function preScanLang(argv) {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const value = a === '--lang' ? argv[i + 1] : a.startsWith('--lang=') ? a.slice('--lang='.length) : null
    if (typeof value === 'string' && LOCALES.includes(value)) return value
  }
  return null
}

function wantsHelp(argv) {
  return argv.includes('-h') || argv.includes('--help')
}

// `--flag` 또는 `--flag=값`이 있는가. 두 형식 중 하나만 인식하면 나머지
// 형식이 조용히 무시되어, 준 인자가 먹히지 않은 채 화면이 열린다.
export function hasFlag(argv, name) {
  return argv.some((a) => a === name || a.startsWith(`${name}=`))
}

export function requireValue(argv, name) {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq !== undefined) {
    const value = eq.slice(name.length + 1)
    if (!value) throw new LocalizedError('error.needsValue', { name })
    return value
  }
  const value = argv[argv.indexOf(name) + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new LocalizedError('error.needsValue', { name })
  }
  return value
}

// 반복 지정 가능한 플래그 값 수집: `--flag <값>` 과 `--flag=<값>` 둘 다 받는다.
export function collectValues(argv, name) {
  const values = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new LocalizedError('error.needsValue', { name })
      values.push(value)
      i++
    } else if (argv[i].startsWith(`${name}=`)) {
      const value = argv[i].slice(name.length + 1)
      if (!value) throw new LocalizedError('error.needsValue', { name })
      values.push(value)
    }
  }
  return values
}

// 빈 문자열은 유효한 값이다(전체 제거). 없음(null)과 구별해야 한다.
// `--set <값>`과 `--set=<값>`을 모두 받는다 — 등호 형식만 인식되지 않으면
// 목표 집합을 지정했는데도 대화형 화면이 열린다. `--set=`은 빈 값이다.
export function parseSetArg(argv) {
  const eq = argv.find((a) => a.startsWith('--set='))
  if (eq !== undefined) return eq.slice('--set='.length)
  if (!argv.includes('--set')) return null
  const value = argv[argv.indexOf('--set') + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new LocalizedError('error.setNeedsValue')
  }
  return value
}

// --help는 다른 인자 검증보다 앞선다 — 도움말을 보려는 사람에게 인자 오류를
// 먼저 내밀 이유가 없다. 아래 두 파서가 같은 규칙을 따른다.

// 서브커맨드 없는 최상위 인자.
export function parseRootArgs(argv, t = createT('en')) {
  const usage = rootUsage(t)
  if (wantsHelp(argv)) {
    return { help: true, dryRun: false, listOnly: false, setArg: null, skillMode: 'auto', designDirs: [], lang: null, interactive: false }
  }
  assertKnownArgs(argv, ROOT_SPEC, usage)
  assertSingleAction(argv, ['--list', '--set'], usage)
  const setArg = parseSetArg(argv)
  return {
    help: false,
    dryRun: argv.includes('--dry-run'),
    listOnly: argv.includes('--list'),
    setArg,
    // 대화형 화면에서 실행하는 부트스트랩이 이 값을 쓴다. 예전에는 루트에서
    // 읽지 않아, 런처가 넘긴 --skill-mode가 조용히 버려졌다.
    skillMode: parseSkillMode(argv, usage),
    designDirs: collectValues(argv, '--design-dir'),
    lang: parseLang(argv, usage),
    // 목록·집합 지정이 없으면 대화형 화면으로 간다. --lang은 동작 플래그가
    // 아니므로 여기에 끼지 않는다.
    interactive: !argv.includes('--list') && setArg === null,
  }
}

// `design` 서브커맨드 플래그.
export function parseDesignArgs(argv, t = createT('en')) {
  const usage = designUsage(t)
  if (wantsHelp(argv)) {
    return { help: true, dryRun: false, list: false, set: null, preview: null, sync: null, designDirs: [], lang: null, interactive: false }
  }
  assertKnownArgs(argv, DESIGN_SPEC, usage)
  assertSingleAction(argv, ['--list', '--set', '--preview', '--sync'], usage)
  const list = argv.includes('--list')
  const set = parseSetArg(argv)
  const preview = hasFlag(argv, '--preview') ? requireValue(argv, '--preview') : null

  let sync = null
  const s = argv.find((a) => a === '--sync' || a.startsWith('--sync='))
  if (s) {
    const m = /^--sync=(installed|catalog|stale)$/.exec(s)
    if (!m) throw new LocalizedError('error.badSync')
    sync = m[1]
  }

  return {
    help: false,
    dryRun: argv.includes('--dry-run'),
    list,
    set,
    preview,
    sync,
    designDirs: collectValues(argv, '--design-dir'),
    lang: parseLang(argv, usage),
    interactive: !list && set === null && preview === null && sync === null,
  }
}

// `bootstrap`에 허용되는 플래그: --dry-run, --adopt,
// --skill-mode(+값)/--skill-mode=값, --lang(+값)/--lang=값, -h/--help.
// 그 외 인자는 거부한다 — 조용히 삼켜지는 것을 막기 위해서다.
export function parseBootstrapArgs(argv, t = createT('en')) {
  const usage = bootstrapUsage(t)
  if (wantsHelp(argv)) return { dryRun: false, skillMode: 'auto', adopt: false, help: true, lang: null }
  assertKnownArgs(argv, BOOTSTRAP_SPEC, usage)
  return {
    dryRun: argv.includes('--dry-run'),
    adopt: argv.includes('--adopt'),
    skillMode: parseSkillMode(argv, usage),
    lang: parseLang(argv, usage),
    help: false,
  }
}

// `update`에 허용되는 플래그: --dry-run, --force, --lang(+값)/--lang=값, -h/--help.
export function parseUpdateArgs(argv, t = createT('en')) {
  const usage = updateUsage(t)
  if (wantsHelp(argv)) return { help: true, dryRun: false, force: false, lang: null }
  assertKnownArgs(argv, UPDATE_SPEC, usage)
  return { help: false, dryRun: argv.includes('--dry-run'), force: argv.includes('--force'), lang: parseLang(argv, usage) }
}

// `status`에 허용되는 플래그: --json, --lang(+값)/--lang=값, -h/--help.
export function parseStatusArgs(argv, t = createT('en')) {
  const usage = statusUsage(t)
  if (wantsHelp(argv)) return { help: true, json: false, lang: null }
  assertKnownArgs(argv, STATUS_SPEC, usage)
  return { help: false, json: argv.includes('--json'), lang: parseLang(argv, usage) }
}
