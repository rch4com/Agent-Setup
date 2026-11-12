import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// Anthropic 커뮤니티 마켓플레이스(anthropics/claude-plugins-community)의 html-plan
// 플러그인이 담은 스킬 하나(html-plan/skills/html-plan, MIT). `/html-plan <만들 것>`을
// 주장 트리·목업·결정 지점이 있는 대화형 HTML 계획서 한 장으로 만든다.
// eli5와 같은 이유로 하위 경로를 source로 준다 — 마켓 루트에서 받으면 다른
// 플러그인의 스킬까지 후보에 든다. 스킬 폴더에 runtime/(css·js·pack.mjs)·
// references/·examples/가 함께 있어 그대로 복사된다. 플러그인이 더 주는 것이
// 없어(훅·명령 없음) 공유 스킬 판을 택했다.
export default defineRecipe({
  id: 'skill.html-plan', category: 'skill', label: 'html-plan', group: '__flow',
  note: 'item.skill.html-plan.note',
  verified: '2026-11-12',
  ...skillsAdd({ source: 'https://github.com/anthropics/claude-plugins-community/tree/main/html-plan', skill: 'html-plan' }),
})
