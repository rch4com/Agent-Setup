import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// hypit-ai/hypit(수정된 Apache-2.0 — 자기 조직 사용·상업 작업 허용, 멀티테넌트 서비스·유료 재배포는
// 상용 라이선스 필요). 참고 영상이나 브리프로 영상을 연출·제작하는 스킬 하나(skills/hypit, Markdown과
// SVML 예제뿐, skills --list로 확인, 2026-11-24). 상류 README의 설치가 이 스킬 하나이고, 실행 파일
// @hypit/hypit(npm, Node 22.15+)은 스킬이 첫 사용 때 확인해 준비를 돕는다 — 이 도구는 깔지 않는다
// (sharp·puppeteer-core·koffi 등 무거운 전역 설치라 상류 흐름을 따른다). 생성에는 HypiHub 계정이나
// 사용자 모델 API 키가 필요하다. 상류 .claude/.codex/skills/hypit은 skills/hypit을 가리키는 링크다.
export default defineRecipe({
  id: 'skill.hypit', category: 'skill', label: 'Hypit', group: '__edit',
  note: 'item.skill.hypit.note',
  verified: '2026-11-24',
  ...skillsAdd({ source: 'https://github.com/hypit-ai/hypit', skill: 'hypit' }),
})
