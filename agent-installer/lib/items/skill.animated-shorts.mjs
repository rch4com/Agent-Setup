import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// mromidev/claude-animated-shorts(MIT). 저장소 루트의 SKILL.md 하나이고 이름은
// 저장소와 달리 cartoon-3d-short다. three.js + Remotion으로 세로형 카툰 숏폼을
// 만든다 — 렌더에는 Remotion이 필요하니 skill.remotion과 함께 쓰면 좋다
// (2026-11-13 확인).
export default defineRecipe({
  id: 'skill.animated-shorts', category: 'skill', label: 'Animated Shorts', group: '__motion',
  note: 'item.skill.animated-shorts.note',
  verified: '2026-11-13',
  ...skillsAdd({ source: 'https://github.com/mromidev/claude-animated-shorts', skill: 'cartoon-3d-short' }),
})
