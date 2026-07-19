import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
export function runInstaller(cwd, args, { timeout = 30000, input = '' } = {}) {
  return spawnSync(process.execPath, [INSTALL_MJS, ...args], { cwd, encoding: 'utf8', timeout, input })
}

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

// 브라우저 대신 target을 기록하는 가짜 opener.
export function recordingOpener() {
  const targets = []
  const opener = (t) => { targets.push(t); return { ok: true } }
  opener.targets = targets
  return opener
}
