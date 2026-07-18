// 매니페스트 선언을 실제 파일시스템 변경으로 옮기는 실행기.
// 추가 전용 — 여기에는 삭제 경로가 없다.
import { lstatSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPathStrict } from '../context.mjs'

// existsSync는 깨진 심볼릭 링크에 false를 반환한다. 그대로 쓰면 사용자가 만든
// 링크를 덮어쓰게 되므로 lstat으로 "항목이 있는가"를 본다.
export function pathExists(target) {
  try {
    lstatSync(target)
    return true
  } catch {
    return false
  }
}

// 두 OS가 같은 파일을 만들도록 항상 LF + 끝 개행 1개로 쓴다.
function writeText(file, text) {
  const body = text.replace(/\r\n/g, '\n').trim() + '\n'
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, body, { encoding: 'utf8' })
}

export function ensureDirs(root, dirs, { dryRun = false, log }) {
  return dirs.map((rel) => {
    const target = repoPathStrict(root, rel)
    if (pathExists(target)) return { ok: true, action: 'skip', path: rel }
    log(`디렉터리 생성: ${rel}`)
    if (!dryRun) mkdirSync(target, { recursive: true })
    return { ok: true, action: 'create', path: rel }
  })
}

export function ensureFiles(root, files, { dryRun = false, log }) {
  return files.map(({ path: rel, template }) => {
    const target = repoPathStrict(root, rel)
    if (pathExists(target)) {
      log(`기존 파일 유지: ${rel}`)
      return { ok: true, action: 'keep', path: rel }
    }
    log(`파일 생성: ${rel}`)
    if (!dryRun) writeText(target, template)
    return { ok: true, action: 'create', path: rel }
  })
}
