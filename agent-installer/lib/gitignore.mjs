import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { repoPathStrict } from './context.mjs'

export function ensureGitignoreEntries(root, entries) {
  // 함수의 목적 자체가 쓰기이므로 맨 앞에서 한 번 엄격 검사한다 —
  // bootstrap의 ensureIgnore와 같은 규칙. 어휘적 검사만으로는 .gitignore가
  // 저장소 밖을 가리키는 링크일 때를 막지 못한다.
  const file = repoPathStrict(root, '.gitignore')
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const lines = new Set(text.split(/\r?\n/))
  const missing = entries.filter((e) => !lines.has(e))
  if (missing.length === 0) return
  // 파일의 우세 줄바꿈을 따른다 — CRLF 파일에 덧붙인 줄만 LF로 섞이지 않게.
  // apply.mjs의 ensureJsonKeys가 JSON에 대해 지키는 규칙과 같다.
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const sep = text.length === 0 || text.endsWith('\n') ? '' : eol
  writeFileSync(file, text + sep + missing.join(eol) + eol)
}
