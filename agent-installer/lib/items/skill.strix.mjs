import { defineRegistrySkill } from '../catalog.mjs'
// 상류가 skills/에 SKILL.md 9종을 두고 npx skills add usestrix/strix를 README로
// 직접 안내한다. 스킬 본문은 strix CLI를 구동하는 지침이라 바이너리가 사실상
// 전제다 — note가 알린다. 2026-09-02 스크래치 저장소에서 9종 설치와
// skills-lock.json의 source(usestrix/strix) 기록을 실측했다.
export default defineRegistrySkill({
  id: 'skill.strix', label: 'Strix', group: '__service',
  source: 'https://github.com/usestrix/strix',
  skill: '*',
  anchor: 'penetration-testing-with-strix',
  note: 'item.skill.strix.note',
  verified: '2026-09-02',
})
