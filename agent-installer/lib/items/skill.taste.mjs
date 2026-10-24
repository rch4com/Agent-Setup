import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// 저장소의 폴더 이름은 taste-skill이지만 SKILL.md의 name은 design-taste-frontend다.
// 레지스트리는 name으로 고르므로 여기에도 name을 적는다.
export default defineRecipe({
  id: 'skill.taste', category: 'skill', label: 'Taste Skill', group: '__style',
  note: 'item.skill.taste.note',
  ...skillsAdd({ source: 'https://github.com/Leonxlnx/taste-skill', skill: 'design-taste-frontend' }),
})
