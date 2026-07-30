import { execFileSync } from 'node:child_process'
import { lstatSync, realpathSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { LocalizedError } from './i18n/index.mjs'

export function findRepoRoot(cwd = process.cwd()) {
  let out
  try {
    out = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' })
  } catch {
    throw new LocalizedError('error.notGitRepo')
  }
  return resolve(out.trim())
}

export function repoPath(root, rel) {
  const abs = resolve(root, rel)
  const normRoot = resolve(root)
  if (abs !== normRoot && !abs.startsWith(normRoot + sep)) {
    throw new LocalizedError('error.pathOutsideRepo', { path: abs })
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

  let realProbe
  try {
    realProbe = realpathSync(probe)
  } catch (err) {
    // 경합으로 사라졌거나(ENOENT) 링크가 순환하는(ELOOP) 경우다.
    // 원인을 알 수 없는 raw 예외 대신 진단 가능한 메시지로 바꾼다.
    throw new LocalizedError('error.pathUnresolvable', { path: probe, code: err.code ?? err.message })
  }

  let realRoot
  try {
    realRoot = realpathSync(root)
  } catch (err) {
    throw new LocalizedError('error.pathUnresolvable', { path: root, code: err.code ?? err.message })
  }
  if (realProbe !== realRoot && !realProbe.startsWith(realRoot + sep)) {
    throw new LocalizedError('error.pathEscapesViaLink', { path: probe, real: realProbe })
  }
  return abs
}
