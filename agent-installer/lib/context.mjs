import { execFileSync } from 'node:child_process'
import { lstatSync, realpathSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'

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

function pathExists(target) {
  try {
    lstatSync(target)
    return true
  } catch {
    return false
  }
}

// repoPath의 어휘적 검사에 더해, 가장 가까운 존재하는 조상의 realpath가
// 저장소 안인지 확인한다. 어휘적 검사만으로는 심볼릭 링크/Junction을 통한
// 이탈을 막지 못한다. 부트스트랩의 모든 쓰기 경로가 이 함수를 쓴다.
export function repoPathStrict(root, rel) {
  const abs = repoPath(root, rel)

  let probe = abs
  while (!pathExists(probe)) {
    const parent = dirname(probe)
    if (parent === probe) break
    probe = parent
  }

  const realProbe = realpathSync(probe)
  const realRoot = realpathSync(root)
  if (realProbe !== realRoot && !realProbe.startsWith(realRoot + sep)) {
    throw new Error(`저장소 내부 경로가 외부 링크를 통해 이탈합니다: ${probe} -> ${realProbe}`)
  }
  return abs
}
