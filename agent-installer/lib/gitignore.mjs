import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { repoPath } from './context.mjs'

export function ensureGitignoreEntries(root, entries) {
  const file = repoPath(root, '.gitignore')
  const text = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const lines = new Set(text.split(/\r?\n/))
  const missing = entries.filter((e) => !lines.has(e))
  if (missing.length === 0) return
  const sep = text.length === 0 || text.endsWith('\n') ? '' : '\n'
  writeFileSync(file, text + sep + missing.join('\n') + '\n')
}
