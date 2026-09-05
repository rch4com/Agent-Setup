// 스킬 어댑터 — .agents/skills를 도구별 경로에서 보이게 한다.
// Windows는 Junction을 쓴다. 관리자 권한이 필요 없고, MSYS(Git Bash)의 ln -s가
// 링크 대신 복사를 만드는 문제도 우회한다.
import { cpSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { createT, msg } from '../i18n/index.mjs'
import { pathExists } from './apply.mjs'

const MARKER = '.agent-kit-managed-copy'
const SOURCE_REL = '.agents/skills'

// 심볼릭 링크/Junction이면 가리키는 절대 경로를, 아니면 null을 돌려준다.
function linkTarget(target) {
  try {
    if (!lstatSync(target).isSymbolicLink()) return null
    return resolve(dirname(target), readlinkSync(target))
  } catch {
    return null
  }
}

function createLink(source, target) {
  if (process.platform === 'win32') {
    // Junction은 절대 경로를 요구한다.
    symlinkSync(source, target, 'junction')
  } else {
    symlinkSync(relative(dirname(target), source), target)
  }
}

function createCopy(source, target) {
  mkdirSync(target, { recursive: true })
  cpSync(source, target, { recursive: true })
  writeFileSync(join(target, MARKER), '', { encoding: 'utf8' })
}

export function configureAdapter(root, { tool, path: rel }, { dryRun = false, skillMode = 'auto', log, t = createT('en') }) {
  // 기존 상태를 살펴보는 데에는 어휘적 경로를 쓴다. target이 저장소 밖을 가리키는
  // 링크일 수 있는데, 그 경우도 "보존 + 경고"가 정답이라 지켜야 할 쓰기가 없다.
  // repoPathStrict를 여기서 쓰면 이탈 링크에서 예외가 던져져 경고 대신 죽는다.
  const target = repoPath(root, rel)

  const linked = linkTarget(target)
  // 대상이 사라진 링크는 보존할 것이 없다. Windows Junction은 만들 때의 절대
  // 경로를 담으므로 저장소 디렉터리를 옮기거나 이름을 바꾸면 옛 경로를
  // 가리킨 채 끊긴다 — 그것을 "다른 곳을 가리키는 링크"로 보고 보존하면
  // 매 실행마다 경고만 찍히고 Claude Code는 공유 스킬을 영영 보지 못한다.
  const dangling = linked !== null && !pathExists(linked)
  if (linked !== null && !dangling) {
    if (linked === repoPath(root, SOURCE_REL)) {
      log(t('log.skill.linkOk', { tool, path: rel }))
      return { ok: true, action: 'skip', path: rel }
    }
    log(t('log.skill.warnForeignLink', { path: rel }))
    return { ok: true, action: 'warn', path: rel, message: msg('msg.foreignLink') }
  }

  const managedCopy = !dangling && pathExists(target) && pathExists(join(target, MARKER))
  if (!dangling && pathExists(target) && !managedCopy) {
    log(t('log.skill.warnUnmanaged', { path: rel }))
    return { ok: true, action: 'warn', path: rel, message: msg('msg.unmanagedExisting') }
  }

  // 여기부터는 실제로 링크/복사본을 만드는 경로다. 엄격 검사는 dry-run 여부와
  // 무관하게 항상 하고(dry-run에서도 이탈 경로를 걸러내려면), 실제 파일시스템
  // 쓰기만 !dryRun으로 막는다 — apply.mjs의 ensureDirs와 같은 형태.
  // source(.agents/skills)는 실제로 읽어 복사하는 대상이므로 여기서 함께 검사한다.
  const source = repoPathStrict(root, SOURCE_REL)
  // 끊긴 링크는 realpath가 ENOENT로 실패해 자기 자신을 엄격 검사할 수 없다.
  // 지울 것은 링크 항목 하나뿐이니 그것이 놓인 부모 디렉터리를 검사한다 —
  // 부모가 저장소 안이면 그 안의 항목 하나를 지우는 것도 저장소 안이다.
  const strictTarget = dangling
    ? join(repoPathStrict(root, dirname(rel)), basename(rel))
    : repoPathStrict(root, rel)

  if (dangling) log(t('log.skill.relinkDangling', { path: rel }))

  if (dryRun) {
    log(t('log.skill.plan', { tool, path: rel, mode: skillMode }))
    return { ok: true, action: 'skip', path: rel }
  }

  if (managedCopy) {
    log(t('log.skill.copySync', { tool, path: rel }))
    // 마커가 확인된 복사본만 지운다.
    rmSync(strictTarget, { recursive: true, force: true })
  }
  // 링크 자체만 지운다 — rmSync는 링크를 따라 내려가지 않는다(대상이 없기도 하다).
  if (dangling) rmSync(strictTarget, { recursive: true, force: true })

  mkdirSync(dirname(strictTarget), { recursive: true })

  if (skillMode !== 'copy') {
    try {
      createLink(source, strictTarget)
      log(t('log.skill.linkCreate', { tool, path: rel, target: SOURCE_REL }))
      return { ok: true, action: 'link', path: rel }
    } catch (err) {
      if (skillMode === 'link') {
        return { ok: false, action: 'link', path: rel, message: msg('msg.linkFailed', { message: err.message }) }
      }
      log(t('log.skill.linkFellBack', { tool }))
    }
  }

  createCopy(source, strictTarget)
  log(t('log.skill.copyCreate', { tool, path: rel }))
  return { ok: true, action: 'copy', path: rel }
}
