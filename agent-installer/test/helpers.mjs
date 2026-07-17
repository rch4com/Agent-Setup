import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function makeTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'agent-installer-test-'))
  execFileSync('git', ['init', '-q', dir])
  return dir
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
