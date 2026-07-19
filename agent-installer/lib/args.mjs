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

const SKILL_MODES = ['auto', 'link', 'copy']

export function requireValue(argv, name) {
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
export function parseSetArg(argv) {
  if (!argv.includes('--set')) return null
  const value = argv[argv.indexOf('--set') + 1]
  if (value === undefined || value.startsWith('--')) {
    throw new Error('--set 뒤에 항목 목록이 필요합니다. 전체 제거는 --set "" 로 명시하세요.')
  }
  return value
}

// 서브커맨드 없는 최상위 인자.
export function parseRootArgs(argv) {
  const setArg = parseSetArg(argv)
  return {
    dryRun: argv.includes('--dry-run'),
    listOnly: argv.includes('--list'),
    setArg,
    designDirs: collectValues(argv, '--design-dir'),
    // 목록·집합 지정이 없으면 대화형 화면으로 간다.
    interactive: !argv.includes('--list') && setArg === null,
  }
}

// `design` 서브커맨드 플래그.
export function parseDesignArgs(argv) {
  const list = argv.includes('--list')
  const set = parseSetArg(argv)
  const preview = argv.includes('--preview') ? requireValue(argv, '--preview') : null

  let sync = null
  const s = argv.find((a) => a === '--sync' || a.startsWith('--sync='))
  if (s) {
    const m = /^--sync=(installed|catalog|stale)$/.exec(s)
    if (!m) throw new Error('--sync=installed|catalog|stale 형식으로 지정하세요.')
    sync = m[1]
  }

  return {
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
  let dryRun = false
  let skillMode = 'auto'
  let help = false

  const checkMode = (value) => {
    if (!SKILL_MODES.includes(value)) {
      throw new Error(`--skill-mode는 ${SKILL_MODES.join(', ')} 중 하나여야 합니다: ${value}\n\n${BOOTSTRAP_USAGE}`)
    }
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h' || a === '--help') {
      help = true
    } else if (a === '--dry-run') {
      dryRun = true
    } else if (a === '--skill-mode') {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('--')) {
        throw new Error(`--skill-mode 뒤에 값이 필요합니다 (${SKILL_MODES.join(', ')} 중 하나).\n\n${BOOTSTRAP_USAGE}`)
      }
      skillMode = checkMode(value)
      i++
    } else if (a.startsWith('--skill-mode=')) {
      skillMode = checkMode(a.slice('--skill-mode='.length))
    } else {
      throw new Error(`알 수 없는 인자입니다: ${a}\n\n${BOOTSTRAP_USAGE}`)
    }
  }

  return { dryRun, skillMode, help }
}
