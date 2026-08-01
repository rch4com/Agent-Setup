// awesome-design-md (VoltAgent) 프로바이더.
// 카탈로그: README `## Collection`의 `### 카테고리` + 링크 목록을 파싱한다.
// 링크 URL `getdesign.md/<name>/design-md`의 <name>이 곧 GitHub 폴더명이다.
// 파일: 폴더에는 DESIGN.md만 있다(preview.html 없음). 렌더된 미리보기는 웹페이지.
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LocalizedError } from '../../i18n/index.mjs'

// lib/design-md/cache/<name>/DESIGN.md — 인스톨러에 동봉된 오프라인 번들.
const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache')

const REPO = 'VoltAgent/awesome-design-md'
const BRANCH = 'main'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/design-md`
const README_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/README.md`
// 번들에 함께 담는 상류 고지의 출처. MIT는 사본에 저작권 고지와 허가 문구를
// 담을 것을 요구하므로, 파일을 내려받아 재배포하는 이상 이 URL이 필요하다.
const LICENSE_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/LICENSE`
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`
// scan.mjs의 BUNDLE_CATEGORY와 같은 값이어야 한다 — 둘 다 카테고리 못 얻은
// 항목이 모이는 자리라, 갈라지면 같은 그룹이 헤더 두 개로 쪼개진다.
export const UNCATEGORIZED = '__other'

const ENTRY_RE = /^-\s*\[\*\*(.+?)\*\*\]\(\s*https?:\/\/getdesign\.md\/([^/)]+)\/design-md\s*\)\s*-\s*(.*)$/

// README `## Collection` 블록만 대상으로 카테고리·항목을 뽑는다.
export function parseReadme(md) {
  const lines = md.split(/\r?\n/)
  const entries = []
  let inCollection = false
  let category = UNCATEGORIZED
  for (const line of lines) {
    const h2 = /^##\s+(.*)$/.exec(line)
    if (h2) {
      inCollection = /^collection\b/i.test(h2[1].trim())
      continue
    }
    if (!inCollection) continue
    const h3 = /^###\s+(.*)$/.exec(line)
    if (h3) {
      category = h3[1].trim()
      continue
    }
    const m = ENTRY_RE.exec(line.trim())
    if (m) {
      entries.push({ name: m[2].trim(), label: m[1].trim(), category, description: m[3].trim() })
    }
  }
  return entries
}

// tree API에서 design-md/<name>/ 폴더명 집합을 뽑는다(orphan 보강용).
export function parseTreeNames(treeJson) {
  const names = new Set()
  for (const e of treeJson?.tree ?? []) {
    const m = /^design-md\/([^/]+)\//.exec(e.path)
    if (m) names.add(m[1])
  }
  return names
}

export const awesomeDesignMd = {
  id: 'awesome-design-md',
  label: 'awesome-design-md (VoltAgent)',
  files: ['DESIGN.md'],
  licenseUrl: LICENSE_URL,
  // 번들과 함께 발행되는 고지 파일. 이름이 LICENSE가 아닌 이유는 발행물 검사가
  // 최상위 LICENSE 하나만 확장자 없는 파일로 허용하기 때문이다.
  noticeFile: 'LICENSE.md',

  fileUrl(name, file = 'DESIGN.md') {
    return `${RAW_BASE}/${encodeURIComponent(name)}/${file}`
  },

  // fileUrl과 같이 인코딩한다 — name은 원격 README에서 오므로, 그대로 이어
  // 붙이면 URL이 아닌 문자가 미리보기 대상 문자열에 섞인다.
  webUrl(name) {
    return `https://getdesign.md/${encodeURIComponent(name)}/design-md`
  },

  bundlePath(name, file = 'DESIGN.md') {
    return join(BUNDLE_DIR, this.id, name, file)
  },

  // 동봉 번들에서 읽는다(없으면 null). 오프라인 설치용.
  bundledText(name, file = 'DESIGN.md') {
    if (/[\\/]/.test(name)) return null
    const p = this.bundlePath(name, file)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  },

  async fetchFile(fetchImpl, name, file = 'DESIGN.md') {
    const res = await fetchImpl(this.fileUrl(name, file))
    if (!res.ok) return null
    return res.text()
  },

  // README 파싱(주) + tree orphan 보강(선택). 이름순 정렬 반환.
  async fetchCatalog(fetchImpl) {
    const readmeRes = await fetchImpl(README_URL)
    if (!readmeRes.ok) throw new LocalizedError('error.readmeFetch', { status: readmeRes.status })
    const entries = parseReadme(await readmeRes.text())
    const seen = new Set(entries.map((e) => e.name))

    try {
      const treeRes = await fetchImpl(TREE_URL, { headers: { 'User-Agent': 'agent-installer' } })
      if (treeRes.ok) {
        for (const name of parseTreeNames(await treeRes.json())) {
          if (!seen.has(name)) {
            entries.push({ name, label: name, category: UNCATEGORIZED, description: '' })
            seen.add(name)
          }
        }
      }
    } catch {
      // tree 실패는 무시 — README만으로도 카탈로그는 유효하다.
    }

    return entries.sort((a, b) => a.name.localeCompare(b.name))
  },
}

export default awesomeDesignMd
