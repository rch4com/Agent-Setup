import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// 같은 상류를 플러그인(plugin.impeccable)으로도 넣을 수 있다. 플러그인은 Claude
// 하나에만 닿고, 이쪽은 공유 .agents/skills라 네 CLI가 함께 본다. 둘을 함께
// 켜면 같은 스킬이 플러그인 캐시와 공유 디렉터리 양쪽에서 잡혀 중복 등록되므로
// 배타로 묶는다.
// 레지스트리가 pbakaus/impeccable에서 읽는 스킬은 impeccable 하나다
// (`skills add --list`, 2026-10-06 확인). 엔진 바이너리는 포함되지 않는다 —
// `npx impeccable install`만 플랫폼별 실행 파일을 함께 내려 준다.
export default defineRecipe({
  id: 'skill.impeccable', category: 'skill', label: 'impeccable (skill)', group: '__style',
  exclusive: 'impeccable',
  note: 'item.skill.impeccable.note',
  verified: '2026-10-06',
  ...skillsAdd({ source: 'https://github.com/pbakaus/impeccable', skill: 'impeccable' }),
})
