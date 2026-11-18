import { defineRecipe, SHARED } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// heydamir/unslop(CC-BY-4.0). AI가 만든 티가 나는 UI를 방향을 잡아 다시
// 디자인하는 스킬 하나(skills/unslop). references/·scripts/(snapshot·story,
// node 실행)가 스킬 폴더 안에 있어 함께 복사된다. 상류는 마켓플레이스·
// 플러그인 매니페스트가 없어 공유 스킬이 유일한 경로다.
// skill.pstack도 같은 이름의 unslop 스킬(글쓰기용)을 깔아 .agents/skills/unslop을 다투므로 배타다.
// 감지가 이름으로만 읽으면 pstack의 unslop도 이 항목으로 보여, --set이 "고르지 않은 설치된
// 항목"으로 판단해 pstack의 unslop을 지운다 — pstack(진입 스킬 poteto-mode)이 있으면 이 항목의 것이 아니다.
const base = skillsAdd({ source: 'https://github.com/heydamir/unslop', skill: 'unslop' })
export default defineRecipe({
  id: 'skill.unslop', category: 'skill', label: 'Unslop', group: '__style',
  exclusive: 'unslop',
  note: 'item.skill.unslop.note',
  verified: '2026-11-12',
  ...base,
  detect: { [SHARED]: async (p) => !(await p.skill('poteto-mode')) && base.detect[SHARED](p) },
})
