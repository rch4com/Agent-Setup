import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// JDhruv14/line-art-animation(MIT). 저장소 루트의 SKILL.md 하나가 스킬이다
// (name: line-art-animation). SVG·TypeScript로 선화 캐릭터·장면을 움직이는 법을
// 담았고, 같은 저장소의 TS 라이브러리는 스킬이 참조만 한다. 매니페스트가 없어
// 공유 스킬이 유일한 경로다(2026-11-13 확인).
export default defineRecipe({
  id: 'skill.line-art-animation', category: 'skill', label: 'Line-art Animation', group: '__service',
  note: 'item.skill.line-art-animation.note',
  verified: '2026-11-13',
  ...skillsAdd({ source: 'https://github.com/JDhruv14/line-art-animation', skill: 'line-art-animation' }),
})
