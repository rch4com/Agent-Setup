import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// robonuggets/be-ambitious(MIT). Felix Rieseberg의 글을 에이전트가 따르는 단계로 옮긴 스킬
// 하나로, 저장소 루트의 SKILL.md 한 파일이 전부다(skills --list로 확인, 2026-11-18). 같은 이름의
// 다른 저장소(alexpiar/be-ambitious-harness 등)는 별개 프로젝트다. 외부 도구가 필요 없다.
export default defineRecipe({
  id: 'skill.be-ambitious', category: 'skill', label: 'be-ambitious', group: '__flow',
  note: 'item.skill.be-ambitious.note',
  verified: '2026-11-18',
  ...skillsAdd({ source: 'https://github.com/robonuggets/be-ambitious', skill: 'be-ambitious' }),
})
