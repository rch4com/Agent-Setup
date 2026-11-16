// 내용 단위 보장. 파일이 이미 있어도 그 안에 넣어야 할 내용(절·지침·키)이
// 빠졌으면 덧붙인다 — "파일이 있으면 보존"만 하던 ensureFiles가 놓치는 자리다.
// 판정은 내용 자체(제목 줄, 언급, 키 이름)로 한다. 사용자가 손으로 같은 내용을
// 써 두었으면 그것을 존중해 다시 넣지 않는다. 추가 전용 — 지우지 않는다.
//
// 부트스트랩 경로라 Node 표준 라이브러리만 쓴다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { repoPath, repoPathStrict } from '../context.mjs'
import { createT, msg } from '../i18n/index.mjs'
import { escapeRegExp } from '../untrusted.mjs'
import { AGENTS_TEMPLATE, AGENTS_TEMPLATE_KO, CODEX_CONFIG } from './templates.mjs'
import { PROJECT_DOCS, PROJECT_DOC_ALIASES, PROJECT_DOC_PATHS } from './project-docs.mjs'

// 커밋 템플릿 지침. config.gitmessage.* 항목(gitmessage.mjs)과 부트스트랩이 같은
// 문구를 쓴다. 에이전트는 git commit -m으로 메시지를 넘겨 commit.template을 보지
// 않으므로, 지침 파일에 템플릿을 따르라고 적어야 한다.
export const GITMESSAGE_FILE = '.gitmessage.txt'
export const RULE_BEGIN = '<!-- agent-setup:gitmessage:begin -->'
export const RULE_END = '<!-- agent-setup:gitmessage:end -->'
export const AGENT_RULE = `${RULE_BEGIN}
## Commit messages

Write every commit message by the template in \`${GITMESSAGE_FILE}\` at the
repository root. Read it before each commit: it sets the format, the allowed
types, the length limits and the language. Lines starting with \`#\` are
guidance, not message text.
${RULE_END}
`
// 손으로 쓴 지침도 인정한다 — 파일 이름을 언급하면 이미 안내된 것으로 본다.
export const RULE_PRESENT = /\.gitmessage\.txt/
// Claude Code는 CLAUDE.md만 읽는다. 이 줄이 있으면 AGENTS.md를 함께 본다.
export const CLAUDE_IMPORT = /^\s*@AGENTS\.md\s*$/m

// 템플릿을 `## ` 제목 단위로 자른다. 첫 제목 앞(머리말)은 버린다 — 머리말은
// 파일을 새로 만들 때만 의미가 있다.
export function splitSections(template) {
  const parts = template.split(/^(?=## )/m).filter((p) => p.startsWith('## '))
  return parts.map((body) => ({ heading: body.slice(3, body.indexOf('\n')).trim(), body: body.trimEnd() }))
}

// 영문·한글 제목 중 어느 쪽이든 있으면 그 절이 있는 것이다 — 영어로 만든 AGENTS.md에
// 한글 실행이 같은 절을 한글로 또 붙이면 안 된다. 두 템플릿의 절은 순서로 짝지어진다.
const headingPattern = (...headings) => new RegExp(`^##\\s+(?:${headings.map(escapeRegExp).join('|')})\\s*$`, 'mi')

// 프로젝트 문서의 제목은 사용자가 쓴 파일에서 단계(# ~ ######)도 장식(이모지 등)도 다를 수 있다.
// 제목 이름이 같고 뒤가 공백이나 줄 끝이면 같은 절로 본다.
const anyHeadingPattern = (names) => new RegExp(`^#{1,6}\\s+(?:${names.map(escapeRegExp).join('|')})(?=\\s|$)`, 'mi')

// 우리가 만든 문서의 표지(`Status: draft|ready`). 이 줄이 있으면 우리 구조 그대로 시작한 문서라
// 건드리지 않는다 — 사용자가 일부러 지운 절이나 채운 내용을 되살리거나 덮지 않기 위해서다.
// "Status: stable" 같은 README 문구와 섞이지 않게 값을 draft·ready로 한정한다.
export const OWN_DOC_MARK = /^>?\s*Status:\s*(?:draft|ready)\b/mi
const DRAFT_MARK = /^>?\s*Status:\s*draft\b/mi
const TBD_MARK = /<TBD: /

// 프로젝트 문서 여섯 개의 상태: missing(없음) · draft(초안 표지나 <TBD: …>가 남음) · ready.
// status가 초안 수를 알리고, 인터뷰 절이 아직 필요한지 판정하는 근거가 같다.
export function projectDocStates(root) {
  return Object.values(PROJECT_DOC_PATHS).map((path) => {
    let text
    try {
      text = readFileSync(repoPath(root, path), 'utf8')
    } catch (err) {
      return { path, state: err.code === 'ENOENT' ? 'missing' : 'ready' }
    }
    return { path, state: DRAFT_MARK.test(text) || TBD_MARK.test(text) ? 'draft' : 'ready' }
  })
}

// 인터뷰가 끝났다 — 여섯 문서가 모두 있고 초안이 없다. 이때 AGENTS.md의 "Document interview"
// 절은 할 일을 마쳤으니 에이전트가 지운다. 지운 절을 부트스트랩이 되살리지 않게 한다.
const interviewDone = (root) => projectDocStates(root).every((d) => d.state === 'ready')
const INTERVIEW_HEADING = 'Document interview'

// 프로젝트 문서 여섯 개의 절 단위 보장. 파일이 이미 있어도(대개 사용자가 직접 쓴 README.md)
// 템플릿에 있는데 파일에 없는 절만 뒤에 덧붙인다. 판정은 제목이다 — 영문·한글 템플릿 제목과
// 흔한 동의어(PROJECT_DOC_ALIASES)가 있으면 이미 있는 것으로 보고, 단계가 달라도 같은 절이다.
// 인터뷰 가이드는 채울 자리표시자(<TBD: …>)가 파일에 있을 때만 덧붙인다 — 빠진 절이 하나도 없어
// 물을 것이 없는 문서에 "다 채우면 지우세요"만 남기지 않기 위해서다.
// 순서가 의미를 갖는다: 가이드는 템플릿의 마지막 절이라, 앞 절이 덧붙은 뒤에 판정된다.
function projectDocSnippets(locale) {
  const snippets = []
  for (const [key, path] of Object.entries(PROJECT_DOC_PATHS)) {
    const en = splitSections(PROJECT_DOCS.en[key])
    const ko = splitSections(PROJECT_DOCS.ko[key])
    const own = locale === 'ko' ? ko : en
    own.forEach(({ heading, body }, i) => {
      const names = [en[i].heading, ko[i].heading, ...(PROJECT_DOC_ALIASES[key]?.[en[i].heading] ?? [])]
      const known = anyHeadingPattern(names)
      const isGuide = i === own.length - 1
      snippets.push({
        path,
        text: body,
        label: `## ${heading}`,
        // ensureSnippets는 present.test(현재 내용)만 부른다.
        present: { test: (text) => OWN_DOC_MARK.test(text) || known.test(text) || (isGuide && !TBD_MARK.test(text)) },
      })
    })
  }
  return snippets
}

// 매니페스트가 쓰는 스니펫 목록. when이 거짓이면 건너뛴다.
export function defaultSnippets(locale = 'en') {
  const en = splitSections(AGENTS_TEMPLATE)
  const ko = splitSections(AGENTS_TEMPLATE_KO)
  const own = locale === 'ko' ? ko : en
  return [
    // 문서 절이 먼저다 — 인터뷰 절의 when이 덧붙은 뒤의 문서 상태를 봐야 한다.
    ...projectDocSnippets(locale),
    ...own.map(({ heading, body }, i) => ({
      path: 'AGENTS.md', present: headingPattern(en[i].heading, ko[i].heading), text: body, label: `## ${heading}`,
      ...(en[i].heading === INTERVIEW_HEADING ? { when: (root) => !interviewDone(root) } : {}),
    })),
    {
      path: 'AGENTS.md', present: RULE_PRESENT, text: AGENT_RULE.trimEnd(), label: `${GITMESSAGE_FILE} rule`,
      when: (root) => existsSync(repoPath(root, GITMESSAGE_FILE)),
    },
    // TOML 최상위 키는 첫 [표] 앞에 있어야 한다 — 뒤에 붙이면 그 표의 키가 된다.
    {
      path: '.codex/config.toml', present: /^\s*project_doc_max_bytes\s*=/m, at: 'start',
      text: CODEX_CONFIG.split('\n').find((l) => l.startsWith('project_doc_max_bytes')), label: 'project_doc_max_bytes',
    },
  ]
}

export function ensureSnippets(root, snippets, { dryRun = false, log, t = createT('en') }) {
  const results = []
  for (const { path: rel, present, text, label, at = 'end', when } of snippets) {
    // 조건이 안 맞아도 결과는 남긴다 — 진행률 total이 스니펫 수로 예측된다.
    if (when && !when(root)) { results.push({ ok: true, action: 'skip', path: rel }); continue }
    let current = null
    try {
      current = readFileSync(repoPath(root, rel), 'utf8')
    } catch (err) {
      if (err.code !== 'ENOENT') {
        log(t('log.warn.unreadable', { path: rel, code: err.code ?? err.message }))
        results.push({ ok: true, action: 'warn', path: rel, message: msg('msg.readFailed') })
        continue
      }
    }
    if (current !== null && present.test(current)) {
      results.push({ ok: true, action: 'skip', path: rel })
      continue
    }
    // 검사가 던지면 하지 않은 동작을 보고하지 않도록 로그보다 먼저 수행한다.
    const target = repoPathStrict(root, rel)
    log(t('log.snippet.add', { path: rel, label }))
    if (!dryRun) {
      const eol = current?.includes('\r\n') ? '\r\n' : '\n'
      const piece = text.replace(/\r?\n/g, eol)
      let next
      if (!current) next = piece + eol
      else if (at === 'start') next = piece + eol + current
      else next = current.replace(/\s*$/, '') + eol + eol + piece + eol
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, next, { encoding: 'utf8' })
    }
    results.push({ ok: true, action: 'append', path: rel })
  }
  return results
}
