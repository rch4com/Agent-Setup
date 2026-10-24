import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { width } from '../lib/width.mjs'

const INSTALL_MJS = join(dirname(fileURLToPath(import.meta.url)), '..', 'install.mjs')

// 가짜 CLI 본체. 셸 심(.cmd / sh)이 `node fake-cli.mjs <이름> <인자...>`로 부른다.
// 부른 명령을 FAKE_CLI_LOG에 한 줄씩 남기고 FAKE_CLI_RESPONSES의 응답을 낸다.
// test/ 아래 .mjs 파일은 node --test가 테스트로 집어 가므로 실행 때 임시
// 디렉터리에 써 둔다.
const FAKE_CLI_SOURCE = `import { appendFileSync, existsSync, readFileSync } from 'node:fs'
const [name, ...args] = process.argv.slice(2)
const key = [name, ...args].join(' ')
appendFileSync(process.env.FAKE_CLI_LOG, JSON.stringify(key) + '\\n')
const file = process.env.FAKE_CLI_RESPONSES
const responses = file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {}
const r = responses[key] ?? { out: '', code: 0 }
// 실패면 stderr로 낸다 — 실제 CLI처럼, 그리고 makeExec가 실패 사연을 stderr에서 읽는다.
;(r.code ? process.stderr : process.stdout).write(r.out ?? '')
process.exit(r.code ?? 0)
`

export function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-installer-test-'))
  execFileSync('git', ['init', '-q', dir])
  return dir
}

// git이 있는 디렉터리 — 테스트가 PATH를 줄여도 makeTempRepo의 git은 돌아야 한다.
let gitDirCache = null
export function gitDir() {
  if (gitDirCache) return gitDirCache
  const finder = process.platform === 'win32' ? 'where' : 'which'
  const first = execFileSync(finder, ['git'], { encoding: 'utf8' }).split(/\r?\n/)[0].trim()
  gitDirCache = dirname(first)
  return gitDirCache
}

// 감지는 홈의 설정과 PATH의 CLI를 읽는다 — 실제 항목으로 TUI를 모는 테스트는
// 개발 머신의 설치 상태에 따라 선선택이 갈린다(installedIds가 absent 아닌 항목을
// 미리 체크한다). 홈을 빈 임시 디렉터리로, PATH를 git 디렉터리 하나로 줄여
// 실제 claude·codex·agy가 끼지 않게 한다. node:test는 파일마다 프로세스가
// 분리되므로 이 변형이 다른 테스트 파일로 새지 않는다.
export function isolateGlobalHome() {
  const home = mkdtempSync(join(tmpdir(), 'isolated-home-'))
  process.env.USERPROFILE = home // win32의 os.homedir()
  process.env.HOME = home // POSIX의 os.homedir()
  delete process.env.CODEX_HOME
  delete process.env.XDG_CONFIG_HOME
  process.env.PATH = gitDir()
  return home
}

// 가짜 CLI를 담은 디렉터리를 만든다. responses는 "<이름> <인자…>" → { out, code }.
// env를 프로세스나 runInstaller에 넘기면 그 CLI들만 PATH에서 찾힌다.
export function makeFakeClis(names, responses = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fake-cli-'))
  const log = join(dir, 'calls.log')
  const responsesFile = join(dir, 'responses.json')
  writeFileSync(log, '')
  writeFileSync(responsesFile, JSON.stringify(responses))
  const FAKE_CLI = join(dir, 'fake-cli.mjs')
  writeFileSync(FAKE_CLI, FAKE_CLI_SOURCE)
  for (const name of names) {
    if (process.platform === 'win32') {
      writeFileSync(join(dir, `${name}.cmd`), `@"${process.execPath}" "${FAKE_CLI}" ${name} %*\r\n`)
    } else {
      const file = join(dir, name)
      writeFileSync(file, `#!/bin/sh\nexec "${process.execPath}" "${FAKE_CLI}" ${name} "$@"\n`)
      chmodSync(file, 0o755)
    }
  }
  return {
    dir,
    env: { PATH: `${dir}${delimiter}${gitDir()}`, FAKE_CLI_LOG: log, FAKE_CLI_RESPONSES: responsesFile },
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []),
  }
}

// install.mjs를 실제 프로세스로 돌린다.
// timeout은 필수다 — 비TTY 폴백이 깨지면 설치기가 키 입력을 기다리며 영원히 멈추고,
// 그 사실은 CI가 멈춰 죽을 때에야 드러난다. 시간 초과는 status=null로 나타난다.
// input을 주면 stdin이 파이프가 되어 TTY가 아니게 된다 — CI와 같은 조건이다.
export function runInstaller(cwd, args, { timeout = 30000, input = '', env = {} } = {}) {
  const merged = { ...process.env }
  // Windows의 환경변수 이름은 대소문자를 가리지 않는다 — 펼친 사본에는 원래의
  // `Path`가 남아, 덮어쓴 `PATH`와 둘이 함께 자식에게 넘어간다.
  for (const key of Object.keys(merged)) if (key.toUpperCase() === 'PATH') delete merged[key]
  // 설치는 이제 CLI 명령을 실행한다 — PATH를 그대로 두면 테스트가 개발 머신의
  // 실제 claude·codex·agy에 설치를 건다. 테스트가 PATH를 주지 않으면 git만 둔다.
  return spawnSync(process.execPath, [INSTALL_MJS, ...args], {
    cwd, encoding: 'utf8', timeout, input,
    env: { ...merged, PATH: gitDir(), ...env },
  })
}

// 이 저장소의 기존 테스트는 한국어 문구를 그대로 단언한다. 기본 로케일이
// 영어가 된 뒤에도 그 단언들이 뜻을 잃지 않도록 로케일을 못박아 돌린다.
export const KO = { AGENT_SETUP_LANG: 'ko' }

// URL 부분일치로 응답을 돌려주는 가짜 fetch. 매칭 없으면 404.
// routes: [{ match, body, ok?, status? }]
export function makeFetch(routes) {
  return async (url) => {
    for (const r of routes) {
      if (url.includes(r.match)) {
        return { ok: r.ok !== false, status: r.status ?? 200, text: async () => r.body, json: async () => JSON.parse(r.body) }
      }
    }
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) }
  }
}

// 로그를 수집하는 캡처. log를 runDesign에 주입한다.
export function makeCapture() {
  const lines = []
  return { log: (m) => lines.push(String(m)), lines, text: () => lines.join('\n') }
}

// ── 목록 열 정렬 ──────────────────────────────────────────────────
//
// `--list` 계열의 항목 행은 전부 "<상태> <이름> — <라벨>…" 꼴이다.
// 상태 라벨의 길이는 로케일마다 다르므로(영어 'Not installed' 13칸, 한국어
// '미설치' 6칸), 열 맞춤은 코드 유닛이 아니라 표시 폭으로 재야 한다 —
// padEnd로 맞춘 열은 한글에서 밀리고, 라벨보다 좁은 폭을 주면 영어에서
// 채움이 아예 일어나지 않는다.

// 주어진 상태 라벨로 시작하는 항목 행만 고른다.
// 'Installed'는 'Not installed' 행을 집지 않는다 — 앞에서부터 맞춰 보기 때문이다.
export function itemRows(text, label) {
  return text.split('\n').filter((l) => l.includes(' — ') && l.trimStart().startsWith(label))
}

// 항목 이름이 시작하는 표시 열. 이름 뒤에는 항상 ' — '가 오고 이름 자체에는
// 공백이 없다(isSafeSegment) — 그래서 라벨을 몰라도 앞부분을 떼어낼 수 있다.
export function nameColumn(line) {
  const head = line.split(' — ')[0]
  const name = head.slice(head.lastIndexOf(' ') + 1)
  return width(head.slice(0, head.length - name.length))
}

// 브라우저 대신 target을 기록하는 가짜 opener.
export function recordingOpener() {
  const targets = []
  const opener = (t) => { targets.push(t); return { ok: true } }
  opener.targets = targets
  return opener
}
