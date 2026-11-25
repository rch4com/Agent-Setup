import { lstatSync, mkdirSync, rmSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createLink } from '../bootstrap/adapter.mjs'
import { repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries, removeGitignoreEntries } from '../gitignore.mjs'
import { defineRecipe, SHARED } from '../recipe.mjs'
import { claudeAdapterStep } from '../recipe-helpers.mjs'

// jmanico/grim-prompter(MIT). 위협 모델링 프롬프트 라이브러리와 그것을 구동하는 threat-model 스킬
// 하나(skills/threat-model/SKILL.md, 2026-11-24 확인). 스킬은 자기 실제 경로(링크를 따라간)에서 두
// 단계 위를 라이브러리 루트(runbook.md·quick/·deep/)로 쓰므로 스킬 폴더만 복사하는 skillsAdd로는
// 동작하지 않는다. 상류 README대로 저장소 전체를 clone하고 스킬을 링크한다 — 저장소 범위에서
// clone은 .agents/grim-prompter, 링크는 .agents/skills/threat-model(Windows Junction, 그 외 상대
// 심볼릭 링크)이며 둘 다 .gitignore에 넣는다. 상류 설치는 ~/grim-prompter + 홈 링크라 전역 판은
// 두지 않는다(파일을 직접 쓰는 항목은 전역에 없다). 스크립트·훅·외부 API는 없고, runbook이 빌드·
// 테스트·네트워크를 사용자 허락 없이는 막는다.
const LIB = '.agents/grim-prompter'
const LINK = '.agents/skills/threat-model'
const IGNORE = [LIB, LINK]
const paths = (root) => ({ lib: repoPathStrict(root, LIB), link: repoPathStrict(root, LINK) })
const guard = { describe: `check ${LIB} and ${LINK} stay inside the repository`, fn: ({ root }) => { paths(root) } }
const removeLib = ({ root }) => rmSync(paths(root).lib, { recursive: true, force: true })
const removeLink = (root) => {
  const { link } = paths(root)
  let stat
  try { stat = lstatSync(link) } catch { return }
  // 링크만 지운다 — 손으로 둔 실제 폴더는 건드리지 않는다.
  if (stat.isSymbolicLink()) unlinkSync(link)
}

export default defineRecipe({
  id: 'skill.grim-prompter', category: 'skill', label: 'Grim Prompter', group: '__service',
  note: 'item.skill.grim-prompter.note',
  verified: '2026-11-24',
  recipes: {
    [SHARED]: {
      project: {
        install: [
          guard,
          // clone 뒤 단계가 실패하면 반쯤 깔린 clone을 지운다 — 남기면 다음 clone이 실패한다.
          { argv: ['git', 'clone', '--single-branch', '--depth', '1', 'https://github.com/jmanico/grim-prompter.git', LIB], undo: removeLib },
          { describe: `link ${LINK} to ${LIB}/skills/threat-model`, fn: ({ root }) => { const { lib, link } = paths(root); mkdirSync(dirname(link), { recursive: true }); createLink(join(lib, 'skills', 'threat-model'), link) } },
          claudeAdapterStep,
          { describe: `add ${IGNORE.join(', ')} to .gitignore`, fn: ({ root }) => ensureGitignoreEntries(root, IGNORE) },
        ],
        update: [guard, ['git', '-C', LIB, 'pull', '--ff-only']],
        uninstall: [
          guard,
          { describe: `remove ${LINK}, ${LIB} and their .gitignore entries`, fn: (ctx) => { removeLink(ctx.root); removeLib(ctx); removeGitignoreEntries(ctx.root, IGNORE) } },
        ],
      },
    },
  },
  detect: { [SHARED]: async (p) => p.exists(`${LIB}/runbook.md`) && (await p.skill('threat-model')) },
})
