import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// heydamir/unslop(CC-BY-4.0). AI가 만든 티가 나는 UI를 방향을 잡아 다시
// 디자인하는 스킬 하나(skills/unslop). references/·scripts/(snapshot·story,
// node 실행)가 스킬 폴더 안에 있어 함께 복사된다. 상류는 마켓플레이스·
// 플러그인 매니페스트가 없어 공유 스킬이 유일한 경로다.
export default defineRecipe({
  id: 'skill.unslop', category: 'skill', label: 'Unslop', group: '__style',
  note: 'item.skill.unslop.note',
  verified: '2026-11-12',
  ...skillsAdd({ source: 'https://github.com/heydamir/unslop', skill: 'unslop' }),
})
