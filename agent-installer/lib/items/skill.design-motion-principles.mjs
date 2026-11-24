import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// kylezantos/design-motion-principles(MIT). skills/design-motion-principles/SKILL.md 하나 —
// UI 모션을 만드는 Create와 기존 애니메이션을 점검하는 Audit 두 모드. 본문은 Markdown 참고 문서와
// HTML 보고서 템플릿뿐이고 스크립트·훅·외부 API가 없다. 템플릿은 Google Fonts를 링크한다
// (전 파일 확인, 2026-11-24).
export default defineRecipe({
  id: 'skill.design-motion-principles', category: 'skill', label: 'Design Motion Principles', group: '__motion',
  note: 'item.skill.design-motion-principles.note',
  verified: '2026-11-24',
  ...skillsAdd({ source: 'https://github.com/kylezantos/design-motion-principles', skill: 'design-motion-principles' }),
})
