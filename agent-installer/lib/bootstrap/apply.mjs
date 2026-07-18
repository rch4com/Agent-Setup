// 매니페스트 선언을 실제 파일시스템 변경으로 옮기는 실행기.
// 추가 전용 — 여기에는 삭제 경로가 없다.
import { lstatSync, mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries } from '../gitignore.mjs'

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
    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (pathExists(repoPath(root, rel))) return { ok: true, action: 'skip', path: rel }
    log(`디렉터리 생성: ${rel}`)
    // 실제로 만드는 경로만 엄격 검사한다(링크를 통한 저장소 이탈 차단).
    const target = repoPathStrict(root, rel)
    if (!dryRun) mkdirSync(target, { recursive: true })
    return { ok: true, action: 'create', path: rel }
  })
}

export function ensureFiles(root, files, { dryRun = false, log }) {
  return files.map(({ path: rel, template }) => {
    // 깨진 링크도 lstat으로는 존재한다 — 내용을 보지 않고 그대로 보존한다.
    if (pathExists(repoPath(root, rel))) {
      log(`기존 파일 유지: ${rel}`)
      return { ok: true, action: 'keep', path: rel }
    }
    log(`파일 생성: ${rel}`)
    const target = repoPathStrict(root, rel)
    if (!dryRun) writeText(target, template)
    return { ok: true, action: 'create', path: rel }
  })
}

const BEGIN_MARKER = '<!-- agent-kit:begin -->'

export function ensureBlocks(root, blocks, { dryRun = false, log }) {
  return blocks.map(({ path: rel, block }) => {
    // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
    if (!pathExists(repoPath(root, rel))) {
      log(`파일 생성: ${rel}`)
      // 실제로 만드는 경로만 엄격 검사한다(링크를 통한 저장소 이탈 차단).
      const target = repoPathStrict(root, rel)
      if (!dryRun) writeText(target, block)
      return { ok: true, action: 'create', path: rel }
    }

    const target = repoPath(root, rel)
    let text
    try {
      text = readFileSync(target, 'utf8')
    } catch (err) {
      log(`경고: ${rel}을 읽을 수 없어 건너뜁니다 (${err.code ?? err.message})`)
      return { ok: true, action: 'warn', path: rel, message: '읽기 실패' }
    }

    if (text.includes(BEGIN_MARKER)) {
      log(`관리 블록 확인: ${rel}`)
      return { ok: true, action: 'skip', path: rel }
    }

    log(`관리 블록 추가: ${rel}`)
    if (!dryRun) {
      // 실제 쓰기 전에 엄격 검사를 한다.
      const strictTarget = repoPathStrict(root, rel)
      // 기존 마지막 줄을 닫고 빈 줄 하나를 띄운 뒤 블록을 붙인다.
      const separator = text.endsWith('\n') ? '\n' : '\n\n'
      appendFileSync(strictTarget, separator + block.trim() + '\n', { encoding: 'utf8' })
    }
    return { ok: true, action: 'append', path: rel }
  })
}

export function ensureIgnore(root, entries, { dryRun = false, log }) {
  // 존재 확인은 어휘적 경로로 한다 — 만들지 않을 것이면 지켜야 할 쓰기도 없다.
  const target = repoPath(root, '.gitignore')
  const text = pathExists(target) ? readFileSync(target, 'utf8') : ''
  const lines = new Set(text.split(/\r?\n/))
  const missing = entries.filter((e) => !lines.has(e))

  if (missing.length === 0) {
    log(`.gitignore 항목 확인: ${entries.join(', ')}`)
    return entries.map((e) => ({ ok: true, action: 'skip', path: e }))
  }

  log(`.gitignore 항목 추가: ${missing.join(', ')}`)
  if (!dryRun) {
    // 실제 쓰기 전에 엄격 검사를 한다 (ensureGitignoreEntries 내부에서 repoPath 사용).
    ensureGitignoreEntries(root, missing)
  }
  return missing.map((e) => ({ ok: true, action: 'append', path: e }))
}
