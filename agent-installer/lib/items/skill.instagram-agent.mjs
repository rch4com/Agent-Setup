import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// Jakeschincariol/instagram-agent-skill(MIT). skills/ig-*/SKILL.md 13개(reel·
// caption·carousel·viral·human…). 상류엔 Claude 마켓플레이스(instagram-agent)도
// 있지만 훅·명령 없이 스킬뿐이라, 다섯 CLI가 함께 보는 공유 스킬 판을 택했다.
// anchor는 묶음의 중심인 ig-reel(2026-11-13 확인).
export default defineRecipe({
  id: 'skill.instagram-agent', category: 'skill', label: 'Instagram Agent', group: '__service',
  note: 'item.skill.instagram-agent.note',
  verified: '2026-11-13',
  ...skillsAdd({ source: 'https://github.com/Jakeschincariol/instagram-agent-skill', skill: '*', anchor: 'ig-reel' }),
})
