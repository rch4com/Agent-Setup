// awesome-design-md (VoltAgent) 프로바이더.
// 카탈로그: README `## Collection`의 `### 카테고리` + 링크 목록을 파싱한다.
// 링크 URL `getdesign.md/<name>/design-md`의 <name>이 곧 GitHub 폴더명이다.
// 파일: 폴더에는 DESIGN.md만 있다(preview.html 없음). 렌더된 미리보기는 웹페이지.
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// lib/design-md/cache/<name>/DESIGN.md — 인스톨러에 동봉된 오프라인 번들.
const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'cache')

const REPO = 'VoltAgent/awesome-design-md'
const BRANCH = 'main'
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/design-md`
const README_URL = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/README.md`
const TREE_URL = `https://api.github.com/repos/${REPO}/git/trees/${BRANCH}?recursive=1`
const UNCATEGORIZED = '기타'

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

  fileUrl(name, file = 'DESIGN.md') {
    return `${RAW_BASE}/${encodeURIComponent(name)}/${file}`
  },

  webUrl(name) {
    return `https://getdesign.md/${name}/design-md`
  },

  bundlePath(name, file = 'DESIGN.md') {
    return join(BUNDLE_DIR, name, file)
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
    if (!readmeRes.ok) throw new Error(`README 가져오기 실패: HTTP ${readmeRes.status}`)
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
