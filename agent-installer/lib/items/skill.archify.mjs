import { defineRegistrySkill } from '../catalog.mjs'
// 상류 스킬은 archify/SKILL.md(MIT)이고, 저장소에는 기여자용
// .agents/skills/archify-review도 있다. 레지스트리 경로가 늘 --skill archify를
// 넘기므로 루트를 source로 줘도 archify 하나만 들어온다 — 상류 README가
// 안내하는 `npx skills add tt-a1i/archify --skill archify`와 같은 호출이다.
//
// 스킬은 bin/archify.mjs(validate·deliver)를 Node로 돌린다. package.json의
// 의존성은 전부 devDependencies라 npm install 없이 Node 18+만 있으면 된다.
// 스킬 디렉터리는 렌더러·스키마·예제·test/까지 219개 파일, 8.6MB가 복사되며
// 복사본에서 validate가 그대로 통과한다(2026-09-27 스크래치 저장소 실측).
// 본문이 첫 산출물 뒤 scripts/check-update.mjs로 상류 매니페스트를 한 번
// GET한다 — ARCHIFY_UPDATE_CHECK_DISABLED=1로 끈다. note가 알린다.
export default defineRegistrySkill({
  id: 'skill.archify', label: 'Archify', group: '__style',
  source: 'https://github.com/tt-a1i/archify',
  skill: 'archify',
  note: 'item.skill.archify.note',
  verified: '2026-09-27',
})
