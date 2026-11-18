import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// google-labs-code/stitch-skills(Apache-2.0). 스킬 16개(plugins/stitch-{design,build,utilities}/skills/*,
// 2026-11-18 확인)를 전부 받는다 — README가 스킬끼리 의존한다고 밝혔다. 그중 8개는 frontmatter 이름이
// `stitch::x`라 레지스트리가 `stitch-x` 폴더에 저장하는데, 제거가 이 이름을 경로로 못 쓰고 건너뛰어
// 폴더를 고아로 남겼다(cleanup이 frontmatter로 찾도록 고침). anchor는 이름이 안전한 stitch-loop다.
// 스킬이 구동하는 Stitch MCP 서버는 사용자 엔드포인트·자격 증명이 필요해 여기서 등록하지 않는다.
// 같은 상류의 플러그인 판(codex marketplace, `npx plugins add`)은 쓰지 않는다.
export default defineRecipe({
  id: 'skill.stitch-skills', category: 'skill', label: 'Stitch Skills', group: '__style',
  note: 'item.skill.stitch-skills.note',
  verified: '2026-11-18',
  ...skillsAdd({ source: 'https://github.com/google-labs-code/stitch-skills', skill: '*', anchor: 'stitch-loop' }),
})
