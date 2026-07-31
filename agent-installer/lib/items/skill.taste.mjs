import { defineRegistrySkill } from '../catalog.mjs'
// 저장소의 폴더 이름은 taste-skill이지만 SKILL.md의 name은 design-taste-frontend다.
// 레지스트리는 name으로 고르므로 여기에도 name을 적는다.
export default defineRegistrySkill({
  id: 'skill.taste', label: 'Taste Skill', group: '__style',
  source: 'https://github.com/Leonxlnx/taste-skill',
  skill: 'design-taste-frontend',
  note: 'item.skill.taste.note',
})
