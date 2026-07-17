import { execFileSync } from 'node:child_process'

// OS 기본 브라우저/앱으로 target(URL 또는 파일)을 연다. 주입 가능(테스트 대체).
export function makeOpener(dryRun, log = console.log) {
  return (target) => {
    if (dryRun) {
      log(`  [dry-run] open ${target}`)
      return { ok: true }
    }
    const [cmd, args] =
      process.platform === 'win32' ? ['cmd', ['/c', 'start', '', target]] :
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

// 항목의 getdesign.md 미리보기 페이지를 연다. 실패 시 URL을 안내한다.
export function openPreview(opener, item, log = console.log) {
  const url = item.webUrl
  if (!url) {
    log(`  ${item.label}: 미리보기 URL이 없습니다.`)
    return { ok: false }
  }
  const r = opener(url)
  if (!r.ok) log(`  ${item.label}: 브라우저 열기 실패 — 직접 여세요: ${url}`)
  return r
}
