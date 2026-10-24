import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// vercel-labs/skills는 이 저장소의 레지스트리 항목들이 쓰는 `npx skills` CLI
// 본체 리포인데, 자체 배포 스킬은 find-skills 하나다(skills/find-skills/
// SKILL.md, 2026-08-15 확인). 본문은 npx skills find/add/update 명령만
// 지시하는 하네스 중립 문서다. README 예시에 나오는 web-design-guidelines
// 등은 별도 리포(vercel-labs/agent-skills) 소속이라 이 항목과 무관하다.
export default defineRecipe({
  id: 'skill.find-skills', category: 'skill', label: 'find-skills', group: '__flow',
  note: 'item.skill.find-skills.note',
  verified: '2026-08-15',
  ...skillsAdd({ source: 'https://github.com/vercel-labs/skills', skill: 'find-skills' }),
})
