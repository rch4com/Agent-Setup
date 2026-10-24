import { rmSync } from 'node:fs'
import { defineRecipe } from '../recipe.mjs'
import { repoPathStrict } from '../context.mjs'
import { ensureGitignoreEntries, removeGitignoreEntries } from '../gitignore.mjs'

// 상류 setup은 --host codex·opencode 등도 지원하지만 이 항목은 인자 없이
// 실행하며 setup의 기본값이 claude 단독이다. README 표에 있는 --host
// cursor·slate는 setup의 case 문이 거부해 exit 1로 죽는다(2026-08-15 재확인).
//
// --host를 늘릴 필요가 없다는 것이 2026-08-15 실측으로 드러났다. 상류 --host
// 경로는 홈(~/.codex/skills 등)에 까는 사용자 스코프인데, 이 항목이 clone하는
// `.claude/skills/gstack`은 부트스트랩 저장소에서 Junction이라 실물이 공유
// `.agents/skills/gstack`에 앉는다. codex·opencode는 스킬을 재귀로 스캔해
// 클론 루트 아래 개별 스킬까지 인식한다(중첩 프로브로 실측). Antigravity의
// 스캔 깊이는 미실측이라 "상류 경로 없음"으로 남긴다.
const DIR = '.claude/skills/gstack'
// 부트스트랩 저장소에서는 .claude/skills가 .agents/skills Junction이므로 두 경로 모두 무시 처리
const IGNORE_ENTRIES = ['.claude/skills/gstack', '.agents/skills/gstack']
// clone·삭제가 일어나는 경로다. 어휘적 검사만으로는 .claude/skills가 저장소
// 밖을 가리키는 링크일 때를 막지 못한다.
const removeDir = ({ root }) => rmSync(repoPathStrict(root, DIR), { recursive: true, force: true })

export default defineRecipe({
  id: 'skill.gstack', category: 'skill', label: 'gstack', group: '__flow',
  note: 'item.skill.gstack.note',
  verified: '2026-08-15',
  recipes: {
    claude: {
      project: {
        install: [
          ['git', 'clone', '--single-branch', '--depth', '1', 'https://github.com/garrytan/gstack.git', DIR],
          // setup이 실패하면 반쯤 깔린 클론을 지운다 — 남기면 다음 감지가 설치됨으로 읽는다.
          { argv: ['bash', './setup'], cwd: DIR, undo: removeDir },
          { describe: `add ${IGNORE_ENTRIES.join(', ')} to .gitignore`, fn: ({ root }) => ensureGitignoreEntries(root, IGNORE_ENTRIES) },
        ],
        uninstall: [
          // 상류 제거 스크립트가 실패해도 디렉터리 삭제로 마무리한다.
          { argv: ['bash', './bin/gstack-uninstall', '--force'], cwd: DIR, tolerateFail: true },
          {
            // 설치가 넣은 두 줄을 도로 가져간다 — 남겨 두면 제거한 뒤에도 우리가
            // 만든 흔적이 .gitignore에 계속 남는다.
            describe: `remove ${DIR} and its .gitignore entries`,
            fn: (ctx) => { removeDir(ctx); removeGitignoreEntries(ctx.root, IGNORE_ENTRIES) },
          },
        ],
      },
    },
  },
  detect: { claude: (p) => p.exists(DIR) },
  reasons: {
    codex: 'item.unsupported.gstackShared',
    opencode: 'item.unsupported.gstackShared',
    antigravity: 'item.unsupported.upstreamNone',
  },
})
