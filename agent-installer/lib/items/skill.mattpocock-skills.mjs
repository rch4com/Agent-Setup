import { defineRegistrySkill } from '../catalog.mjs'
// 상류가 "Codex, and other agents" 절에서 이 경로를 직접 안내한다 —
// `npx skills add mattpocock/skills`다. 그러니 이쪽이 곁길이 아니라 상류가
// 의도한 두 경로 중 하나다. 훅이 없는 스킬 묶음이라 플러그인 판에 견줘 잃는
// 것도 없다(35개 실측, skills/<분류>/<이름>/SKILL.md 배치).
//
// anchor는 setup-matt-pocock-skills다. 상류 README가 "이것만은 반드시 고르라"고
// 적어 둔 스킬이라 설치 판정의 기준으로도 맞는다.
export default defineRegistrySkill({
  id: 'skill.mattpocock-skills', label: 'Matt Pocock (skills)', group: '__flow',
  source: 'https://github.com/mattpocock/skills',
  skill: '*',
  anchor: 'setup-matt-pocock-skills',
  exclusive: 'mattpocock',
  note: 'item.skill.mattpocock-skills.note',
})
