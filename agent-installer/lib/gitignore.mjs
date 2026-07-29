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
  const sep = text.length === 0 || text.endsWith('\n') ? '' : '\n'
  writeFileSync(file, text + sep + missing.join('\n') + '\n')
}
