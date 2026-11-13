import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// Jakeschincariol/youtube-agent-skill(MIT). skills/yt-*/SKILL.md 11개(script·
// package·edit·retention·shorts·viral…). skill.instagram-agent와 같은 작성자·같은
// 배치다 — Claude 마켓플레이스도 있지만 스킬뿐이라 공유 스킬 판을 택했다.
// anchor는 묶음의 출발점인 yt-script(2026-11-13 확인).
export default defineRecipe({
  id: 'skill.youtube-agent', category: 'skill', label: 'YouTube Agent', group: '__social',
  note: 'item.skill.youtube-agent.note',
  verified: '2026-11-13',
  ...skillsAdd({ source: 'https://github.com/Jakeschincariol/youtube-agent-skill', skill: '*', anchor: 'yt-script' }),
})
