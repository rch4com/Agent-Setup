import { defineRegistrySkill } from '../catalog.mjs'
// 같은 상류를 플러그인(plugin.superpowers)으로도 넣을 수 있다. 그쪽은 Claude
// 하나만 닿는 대신 session-start 훅으로 알아서 켜지고, 이쪽은 공유
// .agents/skills라 10개 CLI가 함께 보는 대신 훅이 빠진다 — 스킬은 부르면 되지만
// "대화 시작 시 using-superpowers 주입"은 오지 않는다.
// 둘을 함께 켜면 같은 스킬이 플러그인 캐시와 공유 디렉터리 양쪽에서 잡혀 중복
// 등록되므로 배타로 묶는다.
//
// 상류 배치가 skills/<이름>/SKILL.md라 레지스트리가 그대로 읽는다(14개 실측).
// anchor는 using-superpowers다 — 상류가 "대화 시작 시 반드시 읽으라"고 못 박은
// 부트스트랩 스킬이라, 이것이 없으면 나머지가 있어도 설치로 볼 수 없다.
export default defineRegistrySkill({
  id: 'skill.superpowers', label: 'superpowers (skills)', group: '__flow',
  source: 'https://github.com/obra/superpowers',
  skill: '*',
  anchor: 'using-superpowers',
  exclusive: 'superpowers',
  note: 'item.skill.superpowers.note',
})
