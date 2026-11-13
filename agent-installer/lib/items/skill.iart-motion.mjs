import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// iart-ai/motion-skills는 스킬이 없는 색인 저장소다 — 19개 묶음이 각자 저장소에
// 있고(README "Each pack is its own repo"), 묶음 사이에 이름이 겹친다(lower-thirds가
// tiktok-video·lower-thirds 양쪽). 그래서 대표 묶음 motion-design-skills(9개:
// animation-principles·remotion-video·logo-animation·after-effects…)만 넣는다.
// 다른 묶음은 `npx skills add iart-ai/<묶음>-skills`로 직접 받는다(2026-11-13 확인).
export default defineRecipe({
  id: 'skill.iart-motion', category: 'skill', label: 'iart Motion Design', group: '__service',
  note: 'item.skill.iart-motion.note',
  verified: '2026-11-13',
  ...skillsAdd({ source: 'https://github.com/iart-ai/motion-design-skills', skill: '*', anchor: 'animation-principles' }),
})
