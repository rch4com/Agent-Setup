import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { width } from '../lib/width.mjs'

const INSTALL_MJS = join(dirname(fileURLToPath(import.meta.url)), '..', 'install.mjs')

export function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-installer-test-'))
  execFileSync('git', ['init', '-q', dir])
  return dir
}

// install.mjs를 실제 프로세스로 돌린다.
// timeout은 필수다 — 비TTY 폴백이 깨지면 설치기가 키 입력을 기다리며 영원히 멈추고,
// 그 사실은 CI가 멈춰 죽을 때에야 드러난다. 시간 초과는 status=null로 나타난다.
// input을 주면 stdin이 파이프가 되어 TTY가 아니게 된다 — CI와 같은 조건이다.
export function runInstaller(cwd, args, { timeout = 30000, input = '', env = {} } = {}) {
  return spawnSync(process.execPath, [INSTALL_MJS, ...args], {
    cwd, encoding: 'utf8', timeout, input,
    env: { ...process.env, ...env },
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
