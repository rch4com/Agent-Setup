import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineRecipe, SHARED } from '../recipe.mjs'
import { SKILLS_AGENTS, mustRun, skillsAdd } from '../recipe-helpers.mjs'
import { pruneLock } from '../skills-registry.mjs'
// kstost/script-to-motion(MIT). 저장소 루트의 SKILL.md 하나가 스킬이다
// (name: script-to-motion). 대본·주제로 Fish Audio 내레이션이 입혀진 HTML/GSAP
// 모션그래픽 영상을 만든다. scripts/의 npm 의존성(jsdom·playwright-core 등)은
// 상류 도구가 처음 쓸 때 `npm install --prefix`를 안내·실행하므로 설치기가
// 따로 깔지 않는다. 상류는 macOS·Linux 기준이고 frontmatter 훅이 python3를
// 쓴다(2026-11-16 확인).
//
// 상류 SKILL.md의 description에 따옴표 없는 `browser: HTML…`이 있어 엄격한 YAML
// 파서(skills CLI)가 "Nested mappings are not allowed"로 스킬을 건너뛴다
// (b791213, 2026-11-16 실측). 그래서 GitHub에서 받은 복제본의 description만
// 따옴표로 감싼 뒤 그 로컬 복제본을 add한다. 상류가 고쳐 이미 따옴표가 있으면
// 손대지 않으므로 이 우회는 저절로 무해해진다 — 그때 skillsAdd 한 줄로 되돌린다.
const SOURCE = 'https://github.com/kstost/script-to-motion'
const SKILL = 'script-to-motion'

// 따옴표 없는 description 값을 JSON 문자열로 감싼다(YAML 큰따옴표와 호환).
export function quoteDescription(text) {
  const m = text.match(/^description: (.*)$/m)
  if (!m || /^["']/.test(m[1])) return text
  return text.replace(m[0], () => `description: ${JSON.stringify(m[1])}`)
}

// 복제본의 로컬 경로가 잠금 파일에 source로 남으면 커밋해서 나누는 파일이
// 동료 머신에서 깨진다. 저장소 범위에서는 설치 직후 그 항목을 지운다 — 감지는
// 디렉터리를 보므로 잠금이 없어도 설치됨으로 읽는다.
function patchedAdd(addArgs, { pruneProjectLock }) {
  return {
    describe: `git clone ${SOURCE}, quote the SKILL.md description, then npx -y skills@latest add <clone> --skill ${SKILL} ${addArgs.join(' ')}`,
    fn: async ({ root, exec }) => {
      const dir = mkdtempSync(join(tmpdir(), 'script-to-motion-'))
      try {
        await mustRun(exec, 'git', ['clone', '--depth', '1', SOURCE, dir])
        const file = join(dir, 'SKILL.md')
        writeFileSync(file, quoteDescription(readFileSync(file, 'utf8')))
        await mustRun(exec, 'npx', ['-y', 'skills@latest', 'add', dir, '--skill', SKILL, ...addArgs], { cwd: root })
        if (pruneProjectLock) pruneLock(root, [SKILL])
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  }
}

const base = skillsAdd({ source: SOURCE, skill: SKILL })
base.recipes[SHARED].project.install[0] = patchedAdd(['--agent', 'universal', '--yes', '--copy'], { pruneProjectLock: true })
base.recipes[SHARED].user.install[0] = patchedAdd(['-g', '-a', ...SKILLS_AGENTS, '--yes', '--copy'], { pruneProjectLock: false })

export default defineRecipe({
  id: 'skill.script-to-motion', category: 'skill', label: 'Script to Motion', group: '__motion',
  note: 'item.skill.script-to-motion.note',
  verified: '2026-11-16',
  ...base,
})
