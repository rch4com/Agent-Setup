import { defineRegistrySkill } from '../catalog.mjs'
// 상류는 skills/i-have-adhd/에 SKILL.md와 agents/(gemini.toml·openai.yaml)를
// 두고 루트에는 SKILL.md가 없다 — 레지스트리가 그 폴더만 복사한다(3파일,
// 13K, 2026-09-17 실측). Claude 마켓플레이스 플러그인 판(ayghri/i-have-adhd)도
// 있지만 그쪽이 더 주는 것은 SessionStart 훅 하나이고, 그 훅은
// ~/.claude/.i-have-adhd-always 플래그가 있을 때만 규칙을 상시 주입한다.
// 스킬의 기본 자세는 /i-have-adhd로 켜는 opt-in이라 공유 스킬 판으로 11개
// CLI를 함께 덮는 쪽을 택했다 — 상시 적용을 원하면 note가 안내하는 대로
// 규칙 블록을 각 CLI의 지침 파일에 손으로 넣는다(상류 INSTALL.md).
export default defineRegistrySkill({
  id: 'skill.i-have-adhd', label: 'I Have ADHD', group: '__style',
  source: 'https://github.com/ayghri/i-have-adhd',
  skill: 'i-have-adhd',
  note: 'item.skill.i-have-adhd.note',
  verified: '2026-09-17',
})
