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

// 항목의 미리보기를 연다: 웹 URL이 있으면 그 페이지, 로컬 항목은 원본 파일을 기본 앱으로.
export function openPreview(opener, item, log = console.log) {
  const target = item.webUrl ?? item.previewPath ?? null
  if (!target) {
    log(`  ${item.label}: 미리보기 URL이 없습니다.`)
    return { ok: false }
  }
  const r = opener(target)
  if (!r.ok) log(`  ${item.label}: 열기 실패 — 직접 여세요: ${target}`)
  return r
}
