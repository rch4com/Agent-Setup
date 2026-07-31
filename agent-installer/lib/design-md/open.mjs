import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createT, msg } from '../i18n/index.mjs'

// 미리보기 대상은 신뢰 경계 밖이다 — 이름이 원격 README 파싱이나 디렉터리
// 스캔에서 온다. http(s) URL이거나 실제로 존재하는 로컬 경로일 때만 OS에
// 넘긴다. `javascript:`처럼 스킴만 바꾼 대상이 기본 앱으로 열리지 않게 한다.
export function isOpenableTarget(target) {
  const text = String(target ?? '')
  // eslint-disable-next-line no-control-regex
  if (!text || /[\x00-\x1f\x7f]/.test(text)) return false
  if (/^https?:\/\//i.test(text)) return true
  return existsSync(text)
}

// OS 기본 브라우저/앱으로 target(URL 또는 파일)을 연다. 주입 가능(테스트 대체).
export function makeOpener(dryRun, log = console.log) {
  return (target) => {
    if (dryRun) {
      log(`  [dry-run] open ${target}`)
      return { ok: true }
    }
    if (!isOpenableTarget(target)) return { ok: false, output: msg('design.notOpenable') }
    // Windows에서 `cmd /c start`를 쓰지 않는다 — Node는 셸 없이 cmd를 부를 때
    // 공백 없는 인자를 quote하지 않고, cmd는 `&`·`|`를 명령 구분자로 읽는다.
    // 그러면 이름에 섞인 `&`가 곧바로 명령 실행이 된다. rundll32는 셸을 거치지
    // 않아 인자가 그대로 전달되고, URL과 로컬 파일을 모두 기본 앱으로 연다.
    const [cmd, args] =
      process.platform === 'win32' ? ['rundll32', ['url.dll,FileProtocolHandler', target]] :
      process.platform === 'darwin' ? ['open', [target]] :
      ['xdg-open', [target]]
    try {
      execFileSync(cmd, args, { stdio: 'ignore' })
      return { ok: true }
    } catch (err) {
      return { ok: false, output: String(err.message) }
    }
  }
}

// 항목의 미리보기를 연다: 웹 URL이 있으면 그 페이지, 로컬 항목은 원본 파일을 기본 앱으로.
export function openPreview(opener, item, log = console.log, t = createT('en')) {
  const target = item.webUrl ?? item.previewPath ?? null
  if (!target) {
    log(t('design.noPreviewUrl', { label: item.label }))
    return { ok: false }
  }
  const r = opener(target)
  if (!r.ok) log(t('design.openFailed', { label: item.label, target }))
  return r
}
