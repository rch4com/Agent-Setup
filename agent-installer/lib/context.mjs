import { execFileSync } from 'node:child_process'
import { resolve, sep } from 'node:path'

export function findRepoRoot(cwd = process.cwd()) {
  let out
  try {
    out = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  } catch {
    throw new Error('git 저장소 안에서 실행해야 합니다.')
  }
  return resolve(out.trim())
}

export function repoPath(root, rel) {
  const abs = resolve(root, rel)
  const normRoot = resolve(root)
  if (abs !== normRoot && !abs.startsWith(normRoot + sep)) {
    throw new Error(`저장소 밖의 경로에는 쓸 수 없습니다: ${abs}`)
  }
  return abs
}
