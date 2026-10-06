import { defineRegistrySkill } from '../catalog.mjs'
// remotion-dev/skills에는 최상위 스킬이 12개 있는데, remotion-best-practices가
// 나머지 11개(create·markup·studio·render·captions·maps…)를 하위 폴더로 모두
// 품는 상위 스킬이다(141개 파일, 1.1MB — 2026-10-06 실측). 하나만 받으면
// 되므로 --skill '*'(12개 중복 복사) 대신 이것만 고른다. 대신 /remotion-create
// 같은 개별 슬래시 명령은 생기지 않는다.
// 상류 라이선스는 SPDX가 아닌 Remotion License다 — 개인·직원 3명 이하 영리
// 조직·비영리는 무료, 그보다 큰 영리 조직은 회사 라이선스가 필요하다.
export default defineRegistrySkill({
  id: 'skill.remotion', label: 'Remotion', group: '__service',
  source: 'https://github.com/remotion-dev/skills',
  skill: 'remotion-best-practices',
  note: 'item.skill.remotion.note',
  verified: '2026-10-06',
})
