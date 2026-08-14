import { defineRegistrySkill } from '../catalog.mjs'
// 상류는 .claude-plugin·.codex-plugin 매니페스트를 함께 두지만 알맹이는
// skills/diagram-design/SKILL.md 배치라, 기존 레지스트리 경로가 그대로 읽는다 —
// 배선은 한 줄도 새로 만들지 않았다. SKILL.md의 name이 디렉터리 이름과 같아
// taste가 밟던 frontmatter 폴백도 필요 없다.
// 플러그인 경로만 주는 것은 commands/ 3개(/export-diagram·/import-drawio·
// /import-mermaid)인데, 본문을 skills/.../references/에 위임하는 얇은 래퍼라
// 규칙의 알맹이는 스킬 쪽에 전부 온다.
export default defineRegistrySkill({
  id: 'skill.diagram-design', label: 'Diagram Design', group: '__style',
  source: 'https://github.com/cathrynlavery/diagram-design',
  skill: 'diagram-design',
  note: 'item.skill.diagram-design.note',
})
