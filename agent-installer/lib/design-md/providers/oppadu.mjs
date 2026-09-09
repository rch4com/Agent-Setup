// 오빠두엑셀 "디자인 시스템 갤러리" 프로바이더.
//   https://www.oppadu.com/tools/design-systems-site/
//
// ⚠️ 아직 PROVIDERS(providers/index.mjs)에 등록하지 않는다. 사이트는 마크다운
// 다운로드·복사·원본 보기를 로그인 회원 전용으로 두고 바닥글이 "All rights
// reserved"다 — 재배포 허가(info@oppadu.com)가 오기 전에는 번들도, 카탈로그
// 항목도, 등록도 하지 않는다. design-md.oppadu.test.mjs가 이 상태를 못박는다.
// 허가가 오면: index.mjs에 등록 → `design --sync=catalog` → `npm run refresh-bundle`
// → cache/oppadu/LICENSE.md 고지 → README의 design.md 절 갱신 → 발행.
//
// 사이트 구조(2026-09-06 실측, schema_version 3):
//   카탈로그  data/brands-index.json — 브랜드 242개의 slug·이름·지역·한 줄 설명.
//             갤러리 그리드가 그대로 읽는 공개 파일이다.
//   파일      data/detail/<slug>.json — raw_markdown(라이트)·raw_markdown_dark.
//             사이트의 "가이드 다운로드"는 라이트 모드에서 raw_markdown의
//             `[data-theme="dark"]` 규칙을 걷어낸 것을 <slug>-light.md로 저장한다
//             (app.js currentDownloadMd·stripDarkBlock) — DESIGN.md도 그 판을 쓴다.
//   미리보기  brand/<slug>.html — 로그인 없이 보이는 공개 페이지.
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalizedError } from '../../i18n/index.mjs'
import { isSafeSegment } from '../../untrusted.mjs'

const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache')

const BASE = 'https://www.oppadu.com/tools/design-systems-site'
const INDEX_URL = `${BASE}/data/brands-index.json`

// 카테고리는 사이트의 전체 목록 페이지(brand/)가 쓰는 지역 묶음과 같다 —
// 한국 48·아시아 14·해외 180. 색인의 `western`을 그 페이지는 "해외"로 적는다.
export const REGION_LABELS = { korea: '한국', asia: '아시아', western: '해외' }

// 사이트의 displayName과 같은 규칙 — 한국 브랜드만 괄호에 한글 이름을 붙인다.
function displayName(b) {
  return b.region === 'korea' && b.brand_ko ? `${b.brand} (${b.brand_ko})` : String(b.brand ?? b.slug)
}

// brands-index.json → 카탈로그 엔트리. slug가 곧 이름이자 설치 경로 세그먼트다.
export function parseIndex(index) {
  const brands = Array.isArray(index?.brands) ? index.brands : []
  return brands
    .filter((b) => typeof b?.slug === 'string' && isSafeSegment(b.slug))
    .map((b) => ({
      name: b.slug,
      label: displayName(b),
      category: REGION_LABELS[b.region] ?? String(b.region ?? ''),
      description: String(b.signature_keyword ?? ''),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// app.js의 stripDarkBlock을 그대로 옮겼다 — 사이트의 라이트 다운로드와 글자
// 단위로 같은 결과를 내야 한다. `[data-theme="dark"] { … }` 규칙을 중괄호
// 짝으로 찾아 제 줄까지 통째로 지운다(CSS 규칙 안에 중첩 중괄호는 없다).
export function stripDarkBlock(md) {
  if (!md) return md
  let out = md
  let idx
  while ((idx = out.indexOf('[data-theme="dark"]')) !== -1) {
    const open = out.indexOf('{', idx)
    if (open === -1) break
    let depth = 1
    let i = open + 1
    for (; i < out.length && depth > 0; i++) {
      if (out[i] === '{') depth++
      else if (out[i] === '}') depth--
    }
    let start = idx
    while (start > 0 && (out[start - 1] === ' ' || out[start - 1] === '\t')) start--
    if (start > 0 && out[start - 1] === '\n') start--
    out = out.slice(0, start) + out.slice(i)
  }
  return out
}

// app.js의 currentDownloadMd(mode='light')와 같다. 라이트·다크 겸용 브랜드는
// 다크 규칙을 걷어낸 라이트 판, 단일 모드 브랜드는 원문 그대로.
export function toDesignMd(detail) {
  const md = detail?.raw_markdown
  if (typeof md !== 'string' || md.length === 0) return null
  const modes = Array.isArray(detail.theme_modes) ? detail.theme_modes : []
  const dual = modes.includes('light') && modes.includes('dark')
  const hasDark = dual && typeof detail.raw_markdown_dark === 'string' && detail.raw_markdown_dark.length > 0
  return hasDark ? stripDarkBlock(md) : md
}

export const oppadu = {
  id: 'oppadu',
  label: 'Design Systems Gallery (오빠두엑셀)',
  files: ['DESIGN.md'],
  // 재배포 허가 전이다 — refresh-bundle과 번들 검사가 이 값을 보고 건너뛴다.
  redistributable: false,

  fileUrl(name) {
    return `${BASE}/data/detail/${encodeURIComponent(name)}.json`
  },

  webUrl(name) {
    return `${BASE}/brand/${encodeURIComponent(name)}.html`
  },

  bundlePath(name, file = 'DESIGN.md') {
    return join(BUNDLE_DIR, this.id, name, file)
  },

  bundledText(name, file = 'DESIGN.md') {
    if (/[\\/]/.test(name)) return null
    const p = this.bundlePath(name, file)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  },

  // 상세 JSON 하나가 곧 파일이다. 응답이 없거나 원문 필드가 비면 null —
  // defineDesignMd가 그것을 "내려받지 못했다"로 보고한다.
  async fetchFile(fetchImpl, name) {
    const res = await fetchImpl(this.fileUrl(name))
    if (!res.ok) return null
    return toDesignMd(await res.json())
  },

  async fetchCatalog(fetchImpl) {
    const res = await fetchImpl(INDEX_URL)
    if (!res.ok) throw new LocalizedError('error.indexFetch', { url: INDEX_URL, status: res.status })
    return parseIndex(await res.json())
  },
}

export default oppadu
