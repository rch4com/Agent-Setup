import { defineRecipe } from '../recipe.mjs'
import { skillsAdd } from '../recipe-helpers.mjs'
// cloudflare/security-audit-skill(MIT, 커밋 c1c8a8c). skills/security-audit에 SKILL.md 하나와 공격 분류별
// 참고 문서 15개 — 기본은 보안 질문·부분 리뷰에 필요한 대목만 쓰는 안내 모드이고, 사용자가 코드베이스
// 감사·펜테스트·보고서를 명시할 때만 6단계 전체 감사를 돌려 findings.json·coverage-ledger.json을 대상
// 밖(기본 ~/security-audit-skill/<저장소>/run-<N>)에 쓴다. 검증기 validate-findings.cjs·
// validate-coverage-ledger.cjs는 Node 표준 라이브러리만 쓴다. 대상 코드는 OS 샌드박스(네트워크 차단·
// 빈 환경·쓰기 제한)를 갖출 때만 실행하라고 본문이 막는다. 하위 에이전트(Task 도구)를 쓰며, 훅·API
// 키·외부 네트워크 없음. 스킬 폴더 약 370KB(2026-11-27 확인).
export default defineRecipe({
  id: 'skill.security-audit', category: 'skill', label: 'Security Audit', group: '__service',
  note: 'item.skill.security-audit.note',
  verified: '2026-11-27',
  ...skillsAdd({ source: 'https://github.com/cloudflare/security-audit-skill', skill: 'security-audit' }),
})
