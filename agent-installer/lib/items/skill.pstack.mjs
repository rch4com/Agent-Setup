import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// backnotprop/pstack(MIT). cursor/plugins/pstack(Poteto)을 Cursor 전용 부분만 고쳐 하니스
// 중립으로 옮긴 미러로, skills/<이름>/SKILL.md 58개가 레지스트리에 그대로 읽힌다
// (2026-11-18 확인). 스킬끼리 서로 부르므로(poteto-mode는 principle-* 전부와 대부분의
// 스킬을 부른다) 일부만 받지 않고 전부 받는다. anchor는 진입 스킬 poteto-mode다.
// 상류 이름이 같은 스킬이 하나 있다 — pstack의 unslop(글쓰기 AI 티 제거)은 skill.unslop
// (UI 재디자인, heydamir/unslop)과 같은 .agents/skills/unslop을 쓰고 한쪽을 지우면 다른 쪽도
// 지워지므로 배타로 묶는다. 다른 하니스 판(michael-denyer/pstack-claude 등 플러그인)은 쓰지 않는다.
export default defineRecipe({
  id: 'skill.pstack', category: 'skill', label: 'pstack', group: '__flow',
  exclusive: 'unslop',
  note: 'item.skill.pstack.note',
  verified: '2026-11-18',
  ...skillsAdd({ source: 'https://github.com/backnotprop/pstack', skill: '*', anchor: 'poteto-mode' }),
})
