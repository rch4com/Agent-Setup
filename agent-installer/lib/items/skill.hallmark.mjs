import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// 상류 저장소는 skills/hallmark/SKILL.md 배치라 레지스트리가 그대로 읽는다 —
// SKILL.md의 name도 hallmark라 디렉터리 이름과 어긋나지 않는다(taste와 다른 점).
// references/가 100개가 넘지만 레지스트리가 통째로 복사한다(2026-08-10 실측).
export default defineRecipe({
  id: 'skill.hallmark', category: 'skill', label: 'Hallmark', group: '__style',
  note: 'item.skill.hallmark.note',
  verified: '2026-08-10',
  ...skillsAdd({ source: 'https://github.com/nutlope/hallmark', skill: 'hallmark' }),
})
