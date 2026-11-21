import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// adithya-s-k/manim_skill(MIT). 3Blue1Brown 풍 수학 애니메이션용 스킬 3종(manim-composer,
// manimce-best-practices, manimgl-best-practices)이 skills/ 아래 있다(skills --list로 확인,
// 2026-11-21). composer가 장면 기획을, 나머지 둘이 두 판(Manim Community·ManimGL)의 코드 규칙을
// 맡아 함께 받는다. 예제 .py만 있고 실행 스크립트·훅은 없다. 렌더에는 manim(또는 manimgl)과
// ffmpeg, 수식은 LaTeX가 필요하다 — 이 도구는 깔지 않고 note가 알린다.
export default defineRecipe({
  id: 'skill.manim', category: 'skill', label: 'Manim', group: '__motion',
  note: 'item.skill.manim.note',
  verified: '2026-11-21',
  ...skillsAdd({ source: 'https://github.com/adithya-s-k/manim_skill', skill: '*', anchor: 'manimce-best-practices' }),
})
