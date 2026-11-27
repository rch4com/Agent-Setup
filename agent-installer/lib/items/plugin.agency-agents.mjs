import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { createLink } from '../bootstrap/adapter.mjs'
import { repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries, removeGitignoreEntries } from '../gitignore.mjs'
import { defineRecipe } from '../recipe.mjs'

// msitarzewski/agency-agents(MIT, 커밋 8ae6164). 스킬도 플러그인도 아닌 Claude Code 서브에이전트
// .md 283개가 분과 폴더 18개(engineering/·design/·marketing/…)에 있다 — SKILL.md·hooks.json·
// 마켓플레이스 매니페스트가 없어 skillsAdd·marketplacePlugin으로는 깔리지 않는다. 상류 README의
// Claude Code 경로는 `cp <분과>/*.md ~/.claude/agents/`이고, Claude Code는 .claude/agents의
// 하위 폴더도 읽는다(2026-11-27 claude 2.1.332 실측). 그래서 저장소 범위에서 .agents/agency-agents에
// clone하고 divisions.json이 꼽는 분과 폴더만 .claude/agents/agency-agents/<분과>로 링크한다(Windows
// Junction). 저장소 루트를 통째로 링크하면 integrations/mcp-memory의 변환본이 Backend Architect를
// 한 번 더 등록한다. 두 경로는 .gitignore에 넣는다. 다른 CLI는 상류 scripts/convert.sh·install.sh
// (bash)로 형식을 바꿔야 해 배선하지 않는다. scripts/의 Python·bash는 실행하지 않고, 훅·API 키·외부
// 네트워크 없음. 에이전트 설명 283개가 Claude의 에이전트 목록에 모두 올라가 문맥을 먹는다. 상류
// 데스크톱 앱(agencyagents.app)은 넣지 않는다(2026-11-27 확인).
const LIB = '.agents/agency-agents'
const LINKS = '.claude/agents/agency-agents'
const IGNORE = [LIB, LINKS]
const WHY = 'item.unsupported.agencyConvert'
const paths = (root) => ({ lib: repoPathStrict(root, LIB), links: repoPathStrict(root, LINKS) })
const guard = { describe: `check ${LIB} and ${LINKS} stay inside the repository`, fn: ({ root }) => { paths(root) } }
const removeLib = ({ root }) => rmSync(paths(root).lib, { recursive: true, force: true })

// 링크만 지운다 — 손으로 둔 실제 폴더나 파일은 건드리지 않고, 비지 않은 폴더도 남긴다.
function removeLinks(root) {
  const { links } = paths(root)
  let names
  try { names = readdirSync(links) } catch { return }
  for (const name of names) {
    if (lstatSync(join(links, name)).isSymbolicLink()) unlinkSync(join(links, name))
  }
  try { rmdirSync(links) } catch { /* 사용자가 둔 것이 남아 있다 */ }
}

// update 뒤에도 다시 돈다 — 상류가 분과를 더하거나 빼면 링크가 따라간다.
const link = {
  describe: `link ${LINKS}/<division> to the division folders in ${LIB}/divisions.json`,
  fn: ({ root }) => {
    const { lib, links } = paths(root)
    removeLinks(root)
    mkdirSync(links, { recursive: true })
    const { divisions } = JSON.parse(readFileSync(join(lib, 'divisions.json'), 'utf8'))
    for (const name of Object.keys(divisions)) {
      // 분과 이름은 상류 데이터다 — 경로를 벗어나는 값은 링크하지 않는다.
      if (!/^[a-z0-9-]+$/.test(name)) continue
      createLink(join(lib, name), join(links, name))
    }
  },
}

export default defineRecipe({
  id: 'plugin.agency-agents', category: 'plugin', label: 'Agency Agents', group: '__flow', claudeOnly: true,
  note: 'item.plugin.agency-agents.note',
  verified: '2026-11-27',
  recipes: {
    claude: {
      project: {
        install: [
          guard,
          // clone 뒤 단계가 실패하면 반쯤 깔린 clone을 지운다 — 남기면 다음 clone이 실패한다.
          { argv: ['git', 'clone', '--single-branch', '--depth', '1', 'https://github.com/msitarzewski/agency-agents.git', LIB], undo: removeLib },
          link,
          { describe: `add ${IGNORE.join(', ')} to .gitignore`, fn: ({ root }) => ensureGitignoreEntries(root, IGNORE) },
        ],
        update: [guard, ['git', '-C', LIB, 'pull', '--ff-only'], link],
        uninstall: [
          guard,
          { describe: `remove ${LINKS}, ${LIB} and their .gitignore entries`, fn: (ctx) => { removeLinks(ctx.root); removeLib(ctx); removeGitignoreEntries(ctx.root, IGNORE) } },
        ],
      },
    },
  },
  detect: { claude: async (p) => p.exists(`${LIB}/divisions.json`) && p.exists(`${LINKS}/engineering`) },
  reasons: { codex: WHY, opencode: WHY, antigravity: WHY, copilot: WHY, vscode: WHY },
})
