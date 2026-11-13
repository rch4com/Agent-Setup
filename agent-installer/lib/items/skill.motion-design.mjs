import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// lottiefiles/motion-design-skill(MIT). skills/motion-design/SKILL.md 하나 —
// UI 애니메이션의 타이밍·이징·안무, 디즈니 원칙. 도구 중립 원칙집이다
// (2026-11-13 확인).
export default defineRecipe({
  id: 'skill.motion-design', category: 'skill', label: 'Lottie Motion Design', group: '__style',
  note: 'item.skill.motion-design.note',
  verified: '2026-11-13',
  ...skillsAdd({ source: 'https://github.com/lottiefiles/motion-design-skill', skill: 'motion-design' }),
})
