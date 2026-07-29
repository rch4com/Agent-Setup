// 인자 파싱만 한다 — 파일시스템도 콘솔도 프로세스도 모른다.
// install.mjs에서 분리한 이유: 진입점은 최상위에서 main()을 실행하므로
// import하는 순간 설치기가 돌아버려 순수 함수를 단위 테스트할 수 없었다.
//
// 오류는 전부 throw다. 종료 코드는 진입점 한 곳에서 정한다 —
// 예전에는 --set만 process.exit(2)로 빠져나가 같은 사용자 오류가
// 경로에 따라 1과 2로 갈렸다.

// `bootstrap` 서브커맨드 사용법. install.mjs와 두 런처(setup-agents.sh/.ps1) 모두에서 안내한다.
export const BOOTSTRAP_USAGE = `사용법: node install.mjs bootstrap [--skill-mode auto|link|copy] [--dry-run]

옵션:
  --skill-mode auto|link|copy  스킬 연결 방식을 지정합니다. (기본값: auto)
                                  auto: 심볼릭 링크를 먼저 시도하고, 실패하면 복사로 전환합니다.
                                  link: 심볼릭 링크만 시도합니다. 실패하면 오류로 종료합니다.
                                  copy: 항상 복제본을 만듭니다.
  --dry-run                    아무것도 바꾸지 않고 예정된 동작만 출력합니다.
  -h, --help                   이 도움말을 출력하고 종료합니다.

런처로도 사용할 수 있습니다:
  ./setup-agents.sh [옵션]
  pwsh -File ./setup-agents.ps1 [옵션]
  --tui (또는 -Tui)를 주면 의존성을 설치하고 대화형 화면을 엽니다.
  거기서 부트스트랩·에이전트·design.md를 한 목록에서 검색하고 고릅니다.`

// 서브커맨드 없는 최상위 사용법. `design`은 자기 사용법을 따로 갖는다.
export const ROOT_USAGE = `사용법: node install.mjs [옵션]
       node install.mjs bootstrap [옵션]
       node install.mjs design [옵션]

옵션이 없으면 대화형 화면을 엽니다 — 부트스트랩·에이전트·design.md를
한 목록에서 검색하고 고릅니다.

옵션:
  --list                       현재 설치 상태만 출력하고 종료합니다.
  --set <목록>                 쉼표로 구분한 항목을 목표 상태로 맞춥니다.
                               전체 제거는 --set "" 로 명시하세요.
  --skill-mode auto|link|copy  대화형 화면에서 실행하는 부트스트랩의 스킬
                               연결 방식입니다. (기본값: auto)
  --design-dir <경로>          design.md 소스를 더합니다. <소스id>=<경로>
                               형식도 받으며 반복 지정할 수 있습니다.
  --dry-run                    아무것도 바꾸지 않고 예정된 동작만 출력합니다.
  -h, --help                   이 도움말을 출력하고 종료합니다.

서브커맨드 도움말: node install.mjs bootstrap --help
                   node install.mjs design --help`

export const DESIGN_USAGE = `사용법: node install.mjs design [옵션]

옵션이 없으면 대화형 화면을 엽니다 — DESIGN.MD 섹션이 그 안에 있습니다.

옵션:
  --list                 카탈로그와 설치 상태를 출력합니다.
  --set <목록>           쉼표로 구분한 항목을 목표 상태로 맞춥니다.
                         토큰은 <이름> 또는 <제공자>/<이름> 입니다.
                         전체 제거는 --set "" 로 명시하세요.
  --preview <목록>       미리보기를 엽니다.
  --sync=installed       설치본을 원본 최신으로 다시 받습니다.
  --sync=catalog         사용 가능 목록·카테고리를 소스에서 다시 만듭니다.
  --sync=stale           설치본을 원본과 해시 비교합니다.
  --design-dir <경로>    design.md 소스를 더합니다. <소스id>=<경로>
                         형식도 받으며 반복 지정할 수 있습니다.
  --dry-run              아무것도 바꾸지 않고 예정된 동작만 출력합니다.
  -h, --help             이 도움말을 출력하고 종료합니다.`

const SKILL_MODES = ['auto', 'link', 'copy']

// 인자 사양: 플래그 이름 → 'bool'(값 없음) | 'value'(값 하나를 소비).
// 미지 인자를 조용히 삼키지 않기 위한 것이다 — 오타(`--dryrun`)나 지원하지
// 않는 형식(`--set=a`)이 무시되면 사용자는 명령이 먹혔다고 믿지만 아무 일도
// 일어나지 않는다. bootstrap 파서만 지키던 규칙을 세 파서 모두로 넓힌다.
const HELP_SPEC = { '-h': 'bool', '--help': 'bool' }
const ROOT_SPEC = {
  ...HELP_SPEC, '--dry-run': 'bool', '--list': 'bool',
  '--set': 'value', '--skill-mode': 'value', '--design-dir': 'value',
}
const DESIGN_SPEC = {
  ...HELP_SPEC, '--dry-run': 'bool', '--list': 'bool', '--set': 'value',
  '--preview': 'value', '--sync': 'value', '--design-dir': 'value',
}
const BOOTSTRAP_SPEC = { ...HELP_SPEC, '--dry-run': 'bool', '--skill-mode': 'value' }

export function assertKnownArgs(argv, spec, usage) {
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    const eq = token.startsWith('--') ? token.indexOf('=') : -1
    const name = eq > 0 ? token.slice(0, eq) : token
    const kind = spec[name]
    if (kind === undefined) throw new Error(`알 수 없는 인자입니다: ${token}\n\n${usage}`)
    if (kind === 'bool' && eq > 0) throw new Error(`${name}에는 값을 줄 수 없습니다: ${token}\n\n${usage}`)
    // `--플래그 값` 형태는 값 한 칸을 건너뛴다. `--플래그=값`은 이미 한 토큰이다.
    if (kind === 'value' && eq < 0) i++
  }
}

function checkSkillMode(value, usage) {
  if (!SKILL_MODES.includes(value)) {
    throw new Error(`--skill-mode는 ${SKILL_MODES.join(', ')} 중 하나여야 합니다: ${value}\n\n${usage}`)
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
        throw new Error(`--skill-mode 뒤에 값이 필요합니다 (${SKILL_MODES.join(', ')} 중 하나).\n\n${usage}`)
      }
      mode = checkSkillMode(value, usage)
      i++
    } else if (a.startsWith('--skill-mode=')) {
      mode = checkSkillMode(a.slice('--skill-mode='.length), usage)
    }
  }
  return mode
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
    if (!value) throw new Error(`${name} 뒤에 값이 필요합니다.`)
    return value
  }
  const value = argv[argv.indexOf(name) + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${name} 뒤에 값이 필요합니다.`)
  }
  return value
}

// 반복 지정 가능한 플래그 값 수집: `--flag <값>` 과 `--flag=<값>` 둘 다 받는다.
export function collectValues(argv, name) {
  const values = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) throw new Error(`${name} 뒤에 값이 필요합니다.`)
      values.push(value)
      i++
    } else if (argv[i].startsWith(`${name}=`)) {
      const value = argv[i].slice(name.length + 1)
      if (!value) throw new Error(`${name} 뒤에 값이 필요합니다.`)
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
    throw new Error('--set 뒤에 항목 목록이 필요합니다. 전체 제거는 --set "" 로 명시하세요.')
  }
  return value
}

// --help는 다른 인자 검증보다 앞선다 — 도움말을 보려는 사람에게 인자 오류를
// 먼저 내밀 이유가 없다. 아래 두 파서가 같은 규칙을 따른다.

// 서브커맨드 없는 최상위 인자.
export function parseRootArgs(argv) {
  if (wantsHelp(argv)) {
    return { help: true, dryRun: false, listOnly: false, setArg: null, skillMode: 'auto', designDirs: [], interactive: false }
  }
  assertKnownArgs(argv, ROOT_SPEC, ROOT_USAGE)
  const setArg = parseSetArg(argv)
  return {
    help: false,
    dryRun: argv.includes('--dry-run'),
    listOnly: argv.includes('--list'),
    setArg,
    // 대화형 화면에서 실행하는 부트스트랩이 이 값을 쓴다. 예전에는 루트에서
    // 읽지 않아, 런처가 넘긴 --skill-mode가 조용히 버려졌다.
    skillMode: parseSkillMode(argv, ROOT_USAGE),
    designDirs: collectValues(argv, '--design-dir'),
    // 목록·집합 지정이 없으면 대화형 화면으로 간다.
    interactive: !argv.includes('--list') && setArg === null,
  }
}

// `design` 서브커맨드 플래그.
export function parseDesignArgs(argv) {
  if (wantsHelp(argv)) {
    return { help: true, dryRun: false, list: false, set: null, preview: null, sync: null, designDirs: [], interactive: false }
  }
  assertKnownArgs(argv, DESIGN_SPEC, DESIGN_USAGE)
  const list = argv.includes('--list')
  const set = parseSetArg(argv)
  const preview = hasFlag(argv, '--preview') ? requireValue(argv, '--preview') : null

  let sync = null
  const s = argv.find((a) => a === '--sync' || a.startsWith('--sync='))
  if (s) {
    const m = /^--sync=(installed|catalog|stale)$/.exec(s)
    if (!m) throw new Error('--sync=installed|catalog|stale 형식으로 지정하세요.')
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
    interactive: !list && set === null && preview === null && sync === null,
  }
}

// `bootstrap`에 허용되는 플래그: --dry-run, --skill-mode(+값)/--skill-mode=값, -h/--help.
// 그 외 인자는 거부한다 — 조용히 삼켜지는 것을 막기 위해서다.
export function parseBootstrapArgs(argv) {
  if (wantsHelp(argv)) return { dryRun: false, skillMode: 'auto', help: true }
  assertKnownArgs(argv, BOOTSTRAP_SPEC, BOOTSTRAP_USAGE)
  return {
    dryRun: argv.includes('--dry-run'),
    skillMode: parseSkillMode(argv, BOOTSTRAP_USAGE),
    help: false,
  }
}
