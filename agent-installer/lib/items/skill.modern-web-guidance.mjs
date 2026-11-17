import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// GoogleChrome/modern-web-guidance(Apache-2.0, 배포 저장소). 소스 저장소 modern-web-guidance-src는
// 빌드 원본이라 skills CLI 대상이 아니다. 저장소에 스킬이 둘(modern-web-guidance, chrome-extensions)
// 있고 --skill로 앞의 것만 받는다. 스킬은 SKILL.md가 npx -y modern-web-guidance@latest
// search·retrieve를 부르는 구조라 Node.js(>=22)와 네트워크가 필요하다(2026-11-17 확인).
export default defineRecipe({
  id: 'skill.modern-web-guidance', category: 'skill', label: 'Modern Web Guidance', group: '__flow',
  note: 'item.skill.modern-web-guidance.note',
  verified: '2026-11-17',
  ...skillsAdd({ source: 'https://github.com/GoogleChrome/modern-web-guidance', skill: 'modern-web-guidance' }),
})
